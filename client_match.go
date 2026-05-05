package main

// client_match.go — client-execution match flow.
//
// When a match has execution_mode="client" the server issues a signed PPST
// token via IssueClientMatch (backend/match_token.go).  The client runs the
// match locally with PPSSPP and calls POST /submit-client-match with the
// result PPST.  This handler verifies the HMAC token, reads the AP values
// from the result PPST, determines the winner, and commits stats + Glicko-2
// exactly as the server-side PPSSPP path does.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/AERProductions/ffpl/backend"
)

// ─── POST /submit-client-match ────────────────────────────────────────────────

type clientMatchSubmission struct {
	MatchID    string `json:"match_id"`
	Token      string `json:"token"`       // HMAC token from MatchIssuance.Token
	ResultPPST string `json:"result_ppst"` // base64-encoded result save file
}

func handleSubmitClientMatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")

	body, _ := io.ReadAll(io.LimitReader(r.Body, 4<<20)) // 4 MiB cap
	defer r.Body.Close()

	var sub clientMatchSubmission
	if err := json.Unmarshal(body, &sub); err != nil || sub.MatchID == "" || sub.Token == "" || sub.ResultPPST == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "match_id, token, and result_ppst required"})
		return
	}

	// Fetch the match record to get challenger/defender loadout IDs, the
	// issued_ppst_sha256, and confirm it is still in "issued" status.
	mResp, err := pbHTTP.Get(pbMatchesBase + "/" + sub.MatchID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "match lookup failed"})
		return
	}
	defer mResp.Body.Close()

	var matchRec struct {
		ID                string `json:"id"`
		Status            string `json:"status"`
		ChallengerLoadout string `json:"challenger_loadout"`
		DefenderLoadout   string `json:"defender_loadout"`
		IssuedPPSTSHA256  string `json:"issued_ppst_sha256"`
		ChallengeID       string `json:"challenge_id"`
		EventID           string `json:"event_id"`
		MatchFormat       string `json:"match_format"`
		Region            string `json:"region"`
	}
	if err := json.NewDecoder(mResp.Body).Decode(&matchRec); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "match decode failed"})
		return
	}

	// Only accept submissions for matches in "issued" state.
	if matchRec.Status != "issued" {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("match is in status=%q; submissions only accepted for status=issued", matchRec.Status),
		})
		return
	}

	// Verify the HMAC token.  VerifyClientSubmission also checks the
	// issued_ppst_sha256 so we can't be replayed with a different save.
	challAP, defAP, verifyErr := backend.VerifyClientSubmission(
		sub.MatchID,
		matchRec.IssuedPPSTSHA256,
		sub.Token,
		sub.ResultPPST,
		matchRec.Region,
	)
	if verifyErr != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": verifyErr.Error()})
		return
	}

	// Determine the winner from the AP values.
	winner := backend.WinnerFromAP(challAP, defAP, matchRec.ChallengerLoadout, matchRec.DefenderLoadout)
	finalStatus := "completed"
	if winner == "" {
		finalStatus = "need_review"
	}

	// Compute a SHA-256 of the result PPST for audit purposes.
	resultHash := sha256ResultPPST(sub.ResultPPST)

	pbPatch(pbMatchesBase+"/"+sub.MatchID, map[string]interface{}{
		"status":             finalStatus,
		"winner":             winner,
		"issued_ppst_sha256": resultHash, // overwrite with result hash for audit trail
	})

	// Stats + Glicko-2.
	if winner != "" {
		loserID := matchRec.DefenderLoadout
		if winner == matchRec.DefenderLoadout {
			loserID = matchRec.ChallengerLoadout
		}
		incrementStat(winner, "wins", 3)
		incrementStat(loserID, "losses", 0)
		updateGlicko2Ratings(winner, loserID, false)
	}

	// Challenge close-out.
	if matchRec.ChallengeID != "" {
		cs := "completed"
		if finalStatus == "need_review" {
			cs = "need_review"
		}
		pbPatch(pbChallengesBase+"/"+matchRec.ChallengeID, map[string]string{
			"status":   cs,
			"match_id": sub.MatchID,
		})
	}

	// Pairing mirror.
	if matchRec.EventID != "" {
		mirrorPairingStatus(sub.MatchID, finalStatus)
	}

	log.Printf("[Client] Match %s submitted: winner=%s challAP=%d defAP=%d",
		sub.MatchID, winner, challAP, defAP)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"match_id": sub.MatchID,
		"winner":   winner,
		"status":   finalStatus,
	})
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// sha256ResultPPST returns a hex SHA-256 of the base64-encoded result PPST
// for audit purposes only.  Does not decode — hashes the raw b64 bytes.
func sha256ResultPPST(b64 string) string {
	h := sha256.Sum256([]byte(b64))
	return hex.EncodeToString(h[:])
}

// mirrorPairingStatus finds the event_pairings row linked to matchID and
// updates its status to mirror the match outcome.
func mirrorPairingStatus(matchID, status string) {
	url := fmt.Sprintf(
		`%s/api/collections/event_pairings/records?filter=match_id="%s"&perPage=1`,
		pbHost(), matchID)
	resp, err := pbHTTP.Get(url)
	if err != nil {
		log.Printf("[FFPL] mirrorPairingStatus: lookup failed for match %s: %v", matchID, err)
		return
	}
	defer resp.Body.Close()

	var pr struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil || len(pr.Items) == 0 {
		return
	}
	pbPatch(
		pbHost()+"/api/collections/event_pairings/records/"+pr.Items[0].ID,
		map[string]string{"status": status},
	)
}
