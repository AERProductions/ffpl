package main

// commissioner_routes.go — routes accessible to licensed commissioners.
//
// All handlers require a valid X-FFPL-Commissioner-Key header (see auth.go).
// Scope is enforced per-handler: commissioners can only read/write events they own.
//
// Routes (registered in startParseServer):
//   GET  /commissioner/events
//   POST /commissioner/events
//   GET  /commissioner/events/{id}/status
//   POST /commissioner/events/{id}/pairings
//   POST /commissioner/events/{id}/batch
//   POST /commissioner/matches/{id}/flag

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
)

func registerCommissionerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/commissioner/events", handleCommissionerEvents)
	mux.HandleFunc("/commissioner/events/", handleCommissionerEventsSub)
	mux.HandleFunc("/commissioner/matches/", handleCommissionerMatchesSub)
}

// ─── GET/POST /commissioner/events ───────────────────────────────────────────

func handleCommissionerEvents(w http.ResponseWriter, r *http.Request) {
	lic, err := requireCommissioner(r)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		// List events owned by this commissioner.
		url := fmt.Sprintf(`%s/api/collections/events/records?filter=commissioner_id="%s"&sort=-created`,
			pbHost(), lic.UserID)
		resp, err := pbHTTP.Get(url)
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

		var payload map[string]interface{}
		if err := json.Unmarshal(body, &payload); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON"})
			return
		}
		// Force commissioner_id to the caller — cannot create events for others.
		payload["commissioner_id"] = lic.UserID
		// Default to draft status.
		if _, ok := payload["status"]; !ok {
			payload["status"] = "draft"
		}

		out, _ := json.Marshal(payload)
		resp, err := pbHTTP.Post(
			pbHost()+"/api/collections/events/records",
			"application/json", bytes.NewBuffer(out))
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

// ─── /commissioner/events/{id}/... ────────────────────────────────────────────

func handleCommissionerEventsSub(w http.ResponseWriter, r *http.Request) {
	lic, err := requireCommissioner(r)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")

	// Path: /commissioner/events/{id}/{action}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/commissioner/events/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	eventID := parts[0]
	action := ""
	if len(parts) >= 2 {
		action = parts[1]
	}

	// Scope check.
	owned, err := commissionerOwnsEvent(eventID, lic.UserID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	if !owned {
		writeAuthError(w, http.StatusForbidden, "you do not own this event")
		return
	}

	switch action {
	case "status":
		handleEventStatus(w, r, eventID)
	case "pairings":
		handleEventPairings(w, r, eventID)
	case "batch":
		handleEventBatch(w, r, eventID, lic)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

// GET /commissioner/events/{id}/status — live burn board
func handleEventStatus(w http.ResponseWriter, r *http.Request, eventID string) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Fetch the event record.
	evResp, err := pbHTTP.Get(pbHost() + "/api/collections/events/records/" + eventID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer evResp.Body.Close()
	var event map[string]interface{}
	json.NewDecoder(evResp.Body).Decode(&event)

	// Fetch all pairings for the event, sorted by sort_order.
	pUrl := fmt.Sprintf(
		`%s/api/collections/event_pairings/records?filter=event_id="%s"&sort=sort_order&perPage=500`,
		pbHost(), eventID)
	pResp, err := pbHTTP.Get(pUrl)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer pResp.Body.Close()

	var pairingsResult struct {
		Items []map[string]interface{} `json:"items"`
	}
	json.NewDecoder(pResp.Body).Decode(&pairingsResult)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"event":    event,
		"pairings": pairingsResult.Items,
	})
}

// POST /commissioner/events/{id}/pairings — bulk upload bracket pairings
func handleEventPairings(w http.ResponseWriter, r *http.Request, eventID string) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	body, _ := io.ReadAll(io.LimitReader(r.Body, 256<<10))
	defer r.Body.Close()

	var pairings []struct {
		ChallengerLoadout string `json:"challenger_loadout"`
		DefenderLoadout   string `json:"defender_loadout"`
		RoundNumber       int    `json:"round_number"`
		SortOrder         int    `json:"sort_order"`
	}
	if err := json.Unmarshal(body, &pairings); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "expected JSON array of pairings"})
		return
	}

	created := 0
	for _, p := range pairings {
		payload, _ := json.Marshal(map[string]interface{}{
			"event_id":           eventID,
			"challenger_loadout": p.ChallengerLoadout,
			"defender_loadout":   p.DefenderLoadout,
			"round_number":       p.RoundNumber,
			"sort_order":         p.SortOrder,
			"status":             "pending",
		})
		resp, err := pbHTTP.Post(
			pbHost()+"/api/collections/event_pairings/records",
			"application/json", bytes.NewBuffer(payload))
		if err != nil {
			log.Printf("[Commissioner] pairing create error: %v", err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode < 300 {
			created++
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"created": created,
		"total":   len(pairings),
	})
}

// POST /commissioner/events/{id}/batch — queue all pending pairings ("burn" button)
func handleEventBatch(w http.ResponseWriter, r *http.Request, eventID string, lic commissionerLicense) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Parse optional body for match_format and stage_id overrides.
	var opts struct {
		MatchFormat string `json:"match_format"`
		StageID     uint32 `json:"stage_id"`
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 4<<10))
	json.Unmarshal(body, &opts) //nolint:errcheck — defaults fine if missing
	if opts.MatchFormat == "" {
		opts.MatchFormat = "5v5"
	}

	// Fetch all pending pairings in sort_order.
	pUrl := fmt.Sprintf(
		`%s/api/collections/event_pairings/records?filter=event_id="%s"&&status="pending"&sort=sort_order&perPage=500`,
		pbHost(), eventID)
	pResp, err := pbHTTP.Get(pUrl)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer pResp.Body.Close()

	var pairingsResult struct {
		Items []struct {
			ID                string `json:"id"`
			ChallengerLoadout string `json:"challenger_loadout"`
			DefenderLoadout   string `json:"defender_loadout"`
			RoundNumber       int    `json:"round_number"`
			SortOrder         int    `json:"sort_order"`
		} `json:"items"`
	}
	json.NewDecoder(pResp.Body).Decode(&pairingsResult)

	// Sort by sort_order (PB may not guarantee it perfectly across pages).
	sort.Slice(pairingsResult.Items, func(i, j int) bool {
		return pairingsResult.Items[i].SortOrder < pairingsResult.Items[j].SortOrder
	})

	queued := 0
	for _, p := range pairingsResult.Items {
		// Create match record.
		matchPayload, _ := json.Marshal(map[string]interface{}{
			"challenger_loadout": p.ChallengerLoadout,
			"defender_loadout":   p.DefenderLoadout,
			"event_id":           eventID,
			"match_format":       normaliseMatchFormat(opts.MatchFormat),
			"status":             "queued",
		})
		resp, err := pbHTTP.Post(pbMatchesBase, "application/json", bytes.NewBuffer(matchPayload))
		if err != nil {
			log.Printf("[Commissioner] batch: match create error pairing %s: %v", p.ID, err)
			continue
		}
		var matchRec struct {
			ID string `json:"id"`
		}
		json.NewDecoder(resp.Body).Decode(&matchRec)
		resp.Body.Close()

		if matchRec.ID == "" {
			continue
		}

		// Update the pairing to link the match and mark as queued.
		pairPatch, _ := json.Marshal(map[string]interface{}{
			"match_id": matchRec.ID,
			"status":   "queued",
		})
		pairReq, _ := http.NewRequest("PATCH",
			pbHost()+"/api/collections/event_pairings/records/"+p.ID,
			bytes.NewBuffer(pairPatch))
		pairReq.Header.Set("Content-Type", "application/json")
		patchResp, err := pbHTTP.Do(pairReq)
		if err == nil {
			patchResp.Body.Close()
		}

		queued++
		log.Printf("[Commissioner] event %s: pairing %s → match %s queued", eventID, p.ID, matchRec.ID)
	}

	// Advance event status to in_progress if any matches were queued.
	if queued > 0 {
		statusPatch, _ := json.Marshal(map[string]string{"status": "in_progress"})
		req, _ := http.NewRequest("PATCH",
			pbHost()+"/api/collections/events/records/"+eventID,
			bytes.NewBuffer(statusPatch))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := pbHTTP.Do(req)
		if resp != nil {
			resp.Body.Close()
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"queued": queued,
		"total":  len(pairingsResult.Items),
	})
}

// ─── POST /commissioner/matches/{id}/flag ─────────────────────────────────────

func handleCommissionerMatchesSub(w http.ResponseWriter, r *http.Request) {
	lic, err := requireCommissioner(r)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")

	// Path: /commissioner/matches/{id}/{action}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/commissioner/matches/"), "/")
	if len(parts) < 2 || parts[1] != "flag" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	matchID := parts[0]

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Verify the match belongs to an event this commissioner owns.
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

	if match.EventID != "" {
		owned, _ := commissionerOwnsEvent(match.EventID, lic.UserID)
		if !owned {
			writeAuthError(w, http.StatusForbidden, "match does not belong to your event")
			return
		}
	}

	// Read flag reason from body.
	body, _ := io.ReadAll(io.LimitReader(r.Body, 4<<10))
	defer r.Body.Close()
	var req struct {
		Reason string `json:"reason"`
	}
	json.Unmarshal(body, &req) //nolint:errcheck

	// Create a dispute record — commissioner cannot resolve, only flag.
	disputePayload, _ := json.Marshal(map[string]string{
		"match_id": matchID,
		"reporter": lic.UserID,
		"reason":   req.Reason,
		"status":   "open",
	})
	dResp, err := pbHTTP.Post(
		pbHost()+"/api/collections/disputes/records",
		"application/json", bytes.NewBuffer(disputePayload))
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer dResp.Body.Close()

	var disputeRec map[string]interface{}
	json.NewDecoder(dResp.Body).Decode(&disputeRec)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(disputeRec)
}
