package main

// admin_routes.go — routes accessible to admins only (FFPL_ADMIN_KEY).
//
// Routes (registered in startParseServer):
//   GET/POST /admin/events
//   PATCH    /admin/events/{id}
//   POST     /admin/matches/{id}/override
//   POST     /admin/matches/{id}/rerun
//   GET      /admin/queue
//   POST     /admin/commissioners
//   DELETE   /admin/commissioners/{id}
//   POST     /admin/ratings/recalculate

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
)

func registerAdminRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/admin/events", handleAdminEvents)
	mux.HandleFunc("/admin/events/", handleAdminEventsSub)
	mux.HandleFunc("/admin/matches/", handleAdminMatchesSub)
	mux.HandleFunc("/admin/queue", handleAdminQueue)
	mux.HandleFunc("/admin/commissioners", handleAdminCommissioners)
	mux.HandleFunc("/admin/commissioners/", handleAdminCommissionersSub)
	mux.HandleFunc("/admin/ratings/recalculate", handleAdminRatingsRecalculate)
}

// ─── GET/POST /admin/events ───────────────────────────────────────────────────

func handleAdminEvents(w http.ResponseWriter, r *http.Request) {
	if err := requireAdmin(r); err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		resp, err := pbHTTP.Get(pbHost() + "/api/collections/events/records?sort=-created&perPage=100")
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		defer resp.Body.Close()
		io.Copy(w, resp.Body)

	case http.MethodPost:
		body, _ := io.ReadAll(io.LimitReader(r.Body, 64<<10))
		defer r.Body.Close()
		resp, err := pbHTTP.Post(
			pbHost()+"/api/collections/events/records",
			"application/json", bytes.NewBuffer(body))
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		defer resp.Body.Close()
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// ─── PATCH /admin/events/{id} ─────────────────────────────────────────────────

func handleAdminEventsSub(w http.ResponseWriter, r *http.Request) {
	if err := requireAdmin(r); err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")

	eventID := strings.TrimPrefix(r.URL.Path, "/admin/events/")
	if eventID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	if r.Method != http.MethodPatch {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	body, _ := io.ReadAll(io.LimitReader(r.Body, 64<<10))
	defer r.Body.Close()

	req, _ := http.NewRequest("PATCH",
		pbHost()+"/api/collections/events/records/"+eventID,
		bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := pbHTTP.Do(req)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// ─── /admin/matches/{id}/{action} ─────────────────────────────────────────────

func handleAdminMatchesSub(w http.ResponseWriter, r *http.Request) {
	if err := requireAdmin(r); err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/admin/matches/"), "/")
	if len(parts) < 2 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	matchID := parts[0]
	action := parts[1]

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	switch action {
	case "override":
		handleAdminMatchOverride(w, r, matchID)
	case "rerun":
		handleAdminMatchRerun(w, r, matchID)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

// POST /admin/matches/{id}/override — force a winner with reason.
// Updates admin_override_winner, sets status=completed, triggers stats+Glicko-2.
func handleAdminMatchOverride(w http.ResponseWriter, r *http.Request, matchID string) {
	body, _ := io.ReadAll(io.LimitReader(r.Body, 4<<10))
	defer r.Body.Close()

	var req struct {
		Winner string `json:"winner"` // ac_loadouts record ID, or "" for draw
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal(body, &req); err != nil || req.Reason == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "winner and reason required"})
		return
	}

	// Fetch the match to get challenger/defender IDs and current status.
	mResp, err := pbHTTP.Get(pbMatchesBase + "/" + matchID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer mResp.Body.Close()
	var match struct {
		ID                string `json:"id"`
		ChallengerLoadout string `json:"challenger_loadout"`
		DefenderLoadout   string `json:"defender_loadout"`
		Status            string `json:"status"`
		Winner            string `json:"winner"`
		Sanctioned        bool   `json:"sanctioned"` // from event if set
	}
	json.NewDecoder(mResp.Body).Decode(&match)

	// Apply override.
	patch := map[string]interface{}{
		"status":                "completed",
		"winner":                req.Winner,
		"admin_override_winner": req.Winner,
		"admin_override_reason": req.Reason,
	}
	pbPatch(pbMatchesBase+"/"+matchID, patch)

	// Update stats + Glicko-2 (only when there's a clear winner).
	if req.Winner != "" {
		loserID := match.DefenderLoadout
		if req.Winner == match.DefenderLoadout {
			loserID = match.ChallengerLoadout
		}
		incrementStat(req.Winner, "wins", 3)
		incrementStat(loserID, "losses", 0)
		updateGlicko2Ratings(req.Winner, loserID, false)
		log.Printf("[Admin] Match %s overridden: winner=%s reason=%q", matchID, req.Winner, req.Reason)
	} else {
		// Draw override — update Glicko-2 as draw.
		updateGlicko2Ratings(match.ChallengerLoadout, match.DefenderLoadout, true)
		log.Printf("[Admin] Match %s overridden as draw: reason=%q", matchID, req.Reason)
	}

	json.NewEncoder(w).Encode(map[string]string{
		"match_id": matchID,
		"winner":   req.Winner,
		"status":   "completed",
	})
}

// POST /admin/matches/{id}/rerun — reset match (and linked pairing) back to queued.
func handleAdminMatchRerun(w http.ResponseWriter, r *http.Request, matchID string) {
	// Fetch match to get event_id for pairing reset.
	mResp, err := pbHTTP.Get(pbMatchesBase + "/" + matchID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer mResp.Body.Close()
	var match struct {
		EventID string `json:"event_id"`
	}
	json.NewDecoder(mResp.Body).Decode(&match)

	// Reset the match.
	pbPatch(pbMatchesBase+"/"+matchID, map[string]string{
		"status":    "queued",
		"winner":    "",
		"error_msg": "",
	})

	// Reset the linked pairing if this match belongs to an event.
	if match.EventID != "" {
		pUrl := fmt.Sprintf(
			`%s/api/collections/event_pairings/records?filter=match_id="%s"&perPage=1`,
			pbHost(), matchID)
		pResp, err := pbHTTP.Get(pUrl)
		if err == nil {
			defer pResp.Body.Close()
			var pr struct {
				Items []struct {
					ID string `json:"id"`
				} `json:"items"`
			}
			if json.NewDecoder(pResp.Body).Decode(&pr) == nil && len(pr.Items) > 0 {
				pbPatch(pbHost()+"/api/collections/event_pairings/records/"+pr.Items[0].ID,
					map[string]string{"status": "queued"})
			}
		}
	}

	log.Printf("[Admin] Match %s reset to queued", matchID)
	json.NewEncoder(w).Encode(map[string]string{"match_id": matchID, "status": "queued"})
}

// ─── GET /admin/queue ─────────────────────────────────────────────────────────

func handleAdminQueue(w http.ResponseWriter, r *http.Request) {
	if err := requireAdmin(r); err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")

	queuedGlobal := countMatchesByStatus("queued")
	runningGlobal := countMatchesByStatus("running")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"queued":     queuedGlobal,
		"running":    runningGlobal,
		"capacity":   maxConcurrentMatches,
		"slots_free": maxConcurrentMatches - len(matchSem),
	})
}

// ─── POST /admin/commissioners — create license, return key once ──────────────

func handleAdminCommissioners(w http.ResponseWriter, r *http.Request) {
	if err := requireAdmin(r); err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	body, _ := io.ReadAll(io.LimitReader(r.Body, 4<<10))
	defer r.Body.Close()

	var req struct {
		UserID          string `json:"user_id"`
		Handle          string `json:"handle"`
		Tier            string `json:"tier"`
		ValidFrom       string `json:"valid_from"`
		ValidUntil      string `json:"valid_until"`
		MaxParticipants int    `json:"max_participants"`
	}
	if err := json.Unmarshal(body, &req); err != nil || req.UserID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "user_id required"})
		return
	}
	if req.Tier == "" {
		req.Tier = "standard"
	}

	// Generate a random 32-byte key.
	rawKey := make([]byte, 32)
	if _, err := rand.Read(rawKey); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "key generation failed"})
		return
	}
	rawKeyHex := hex.EncodeToString(rawKey)
	h := sha256.Sum256(rawKey)
	keyHash := hex.EncodeToString(h[:])

	// Store the hash, never the raw key.
	payload, _ := json.Marshal(map[string]interface{}{
		"user_id":          req.UserID,
		"handle":           req.Handle,
		"key_hash":         keyHash,
		"tier":             req.Tier,
		"valid_from":       req.ValidFrom,
		"valid_until":      req.ValidUntil,
		"max_participants": req.MaxParticipants,
		"is_suspended":     false,
		"events_run":       0,
	})

	resp, err := pbHTTP.Post(
		pbHost()+"/api/collections/commissioner_licenses/records",
		"application/json", bytes.NewBuffer(payload))
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	var rec map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&rec)

	if resp.StatusCode >= 400 {
		w.WriteHeader(resp.StatusCode)
		json.NewEncoder(w).Encode(rec)
		return
	}

	// Return the raw key exactly once. It is NOT stored and cannot be recovered.
	rec["commissioner_key"] = rawKeyHex
	rec["_note"] = "Store this key securely. It will not be shown again."
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rec)
	log.Printf("[Admin] Commissioner license created for user %s (handle=%q tier=%s)", req.UserID, req.Handle, req.Tier)
}

// ─── DELETE /admin/commissioners/{id} — soft revoke ──────────────────────────

func handleAdminCommissionersSub(w http.ResponseWriter, r *http.Request) {
	if err := requireAdmin(r); err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")

	licID := strings.TrimPrefix(r.URL.Path, "/admin/commissioners/")
	if licID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	pbPatch(pbHost()+"/api/collections/commissioner_licenses/records/"+licID,
		map[string]bool{"is_suspended": true})

	log.Printf("[Admin] Commissioner license %s suspended", licID)
	json.NewEncoder(w).Encode(map[string]string{"id": licID, "status": "suspended"})
}

// ─── POST /admin/ratings/recalculate ─────────────────────────────────────────
//
// Walks all completed matches in created order and rebuilds every Glicko-2
// rating from scratch. Use the optional ?event_id= query param to limit scope.
func handleAdminRatingsRecalculate(w http.ResponseWriter, r *http.Request) {
	if err := requireAdmin(r); err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")

	eventID := r.URL.Query().Get("event_id")

	// Reset all loadout ratings to Glicko-2 defaults before replaying.
	resetAllRatings()

	// Fetch completed matches in chronological order.
	filter := `status="completed"&&winner!=""`
	if eventID != "" {
		filter = fmt.Sprintf(`status="completed"&&winner!=""&&event_id="%s"`, eventID)
	}
	url := fmt.Sprintf(`%s/api/collections/matches/records?filter=%s&sort=created&perPage=500`,
		pbHost(), filter)

	resp, err := pbHTTP.Get(url)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	var result struct {
		Items []struct {
			ID                string `json:"id"`
			ChallengerLoadout string `json:"challenger_loadout"`
			DefenderLoadout   string `json:"defender_loadout"`
			Winner            string `json:"winner"`
		} `json:"items"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	processed := 0
	for _, m := range result.Items {
		if m.Winner == "" {
			continue
		}
		loserID := m.DefenderLoadout
		if m.Winner == m.DefenderLoadout {
			loserID = m.ChallengerLoadout
		}
		updateGlicko2Ratings(m.Winner, loserID, false)
		processed++
	}

	log.Printf("[Admin] Ratings recalculated: %d matches replayed (event_id=%q)", processed, eventID)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"processed": processed,
		"event_id":  eventID,
	})
}

// resetAllRatings sets every ac_loadout back to Glicko-2 starting values.
func resetAllRatings() {
	url := pbLoadoutsBase + "?perPage=500&fields=id"
	resp, err := pbHTTP.Get(url)
	if err != nil {
		log.Printf("[Admin] resetAllRatings: fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()

	var result struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	defaults := map[string]interface{}{
		"rating":            float64(1500),
		"rating_deviation":  float64(350),
		"rating_volatility": math.Round(0.06*10000) / 10000,
		"wins":              0,
		"losses":            0,
		"draws":             0,
		"score":             0,
	}
	for _, item := range result.Items {
		pbPatch(pbLoadoutsBase+"/"+item.ID, defaults)
	}
	log.Printf("[Admin] Reset ratings for %d loadouts", len(result.Items))
}
