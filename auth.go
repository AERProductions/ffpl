package main

// auth.go — request authentication helpers for the three-tier access model.
//
// Tiers:
//   Admin       — FFPL_ADMIN_KEY (env) / X-FFPL-Admin-Key (header).
//                 Falls back to FFPL_API_KEY so existing deployments keep working.
//   Commissioner — X-FFPL-Commissioner-Key header. Verified via SHA-256 hash
//                 against commissioner_licenses.key_hash in PocketBase.
//                 Only active (is_suspended=false, within valid dates) licenses pass.
//   Architect   — normal PocketBase user. No server-side key; PB handles their auth.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// adminKey returns the admin secret, preferring FFPL_ADMIN_KEY with fallback
// to the legacy FFPL_API_KEY so existing deploys continue working.
func adminKey() string {
	if k := os.Getenv("FFPL_ADMIN_KEY"); k != "" {
		return k
	}
	return os.Getenv("FFPL_API_KEY")
}

// requireAdmin returns nil when the request carries a valid admin key, or an
// error describing the failure. Callers should write 401 and return on error.
func requireAdmin(r *http.Request) error {
	k := adminKey()
	if k == "" {
		// No key configured — server is running in open/dev mode. Allow.
		return nil
	}
	if r.Header.Get("X-FFPL-Admin-Key") != k {
		return fmt.Errorf("missing or invalid admin key")
	}
	return nil
}

// commissionerLicense holds the fields we care about from a commissioner_licenses record.
type commissionerLicense struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	Handle          string    `json:"handle"`
	Tier            string    `json:"tier"`
	IsSuspended     bool      `json:"is_suspended"`
	ValidFrom       time.Time `json:"-"`
	ValidUntil      time.Time `json:"-"`
	MaxParticipants int       `json:"max_participants"`
	EventsRun       int       `json:"events_run"`
}

// requireCommissioner verifies the X-FFPL-Commissioner-Key header.
// Returns the license record on success, or an error on failure.
// Checks: key_hash match, not suspended, within valid_from/valid_until window.
func requireCommissioner(r *http.Request) (commissionerLicense, error) {
	raw := r.Header.Get("X-FFPL-Commissioner-Key")
	if raw == "" {
		return commissionerLicense{}, fmt.Errorf("missing X-FFPL-Commissioner-Key")
	}

	// Hash the supplied key.
	h := sha256.Sum256([]byte(raw))
	keyHash := hex.EncodeToString(h[:])

	// Query PocketBase for a matching, active license.
	filter := fmt.Sprintf(`key_hash="%s"&&is_suspended=false`, keyHash)
	url := fmt.Sprintf(`%s/api/collections/commissioner_licenses/records?filter=%s&perPage=1`,
		pbHost(), filter)

	resp, err := pbHTTP.Get(url)
	if err != nil {
		return commissionerLicense{}, fmt.Errorf("license lookup failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return commissionerLicense{}, fmt.Errorf("license lookup error %d", resp.StatusCode)
	}

	var result struct {
		Items []struct {
			ID              string `json:"id"`
			UserID          string `json:"user_id"`
			Handle          string `json:"handle"`
			Tier            string `json:"tier"`
			IsSuspended     bool   `json:"is_suspended"`
			ValidFrom       string `json:"valid_from"`
			ValidUntil      string `json:"valid_until"`
			MaxParticipants int    `json:"max_participants"`
			EventsRun       int    `json:"events_run"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &result); err != nil || len(result.Items) == 0 {
		return commissionerLicense{}, fmt.Errorf("invalid or unrecognised commissioner key")
	}

	item := result.Items[0]
	now := time.Now().UTC()

	// Validate date window when both dates are set.
	if item.ValidFrom != "" && item.ValidUntil != "" {
		from, errF := time.Parse("2006-01-02 15:04:05.000Z", item.ValidFrom)
		until, errU := time.Parse("2006-01-02 15:04:05.000Z", item.ValidUntil)
		if errF == nil && errU == nil {
			if now.Before(from) || now.After(until) {
				return commissionerLicense{}, fmt.Errorf("commissioner license is outside its valid window")
			}
		}
	}

	return commissionerLicense{
		ID:              item.ID,
		UserID:          item.UserID,
		Handle:          item.Handle,
		Tier:            item.Tier,
		IsSuspended:     item.IsSuspended,
		MaxParticipants: item.MaxParticipants,
		EventsRun:       item.EventsRun,
	}, nil
}

// writeAuthError writes a JSON error response with the given HTTP status.
func writeAuthError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// commissionerOwnsEvent checks that the named event has commissioner_id matching
// the supplied user_id. Returns false (with no error) if the event does not exist.
func commissionerOwnsEvent(eventID, userID string) (bool, error) {
	url := fmt.Sprintf(`%s/api/collections/events/records/%s`, pbHost(), eventID)
	resp, err := pbHTTP.Get(url)
	if err != nil {
		return false, fmt.Errorf("event lookup: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	var rec struct {
		CommissionerID string `json:"commissioner_id"`
	}
	json.NewDecoder(resp.Body).Decode(&rec)
	return rec.CommissionerID == userID, nil
}
