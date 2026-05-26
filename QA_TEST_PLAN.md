# AdeYaar 26 — QA Test Plan (API Integration)

Run against production: `https://adeyaar-next.vercel.app`

## User IDs
```
ASHIN="5a9ad1a3-489c-46b8-8b73-af198b473bdd"
JAYESH="a778faed-13af-4cb4-9ac4-b145b02ada54"
BOIDU="b2578655-2549-4f40-a6b8-e7cda2482340"
VAPER="1a77bbd1-d872-4934-9c7c-ab77a3337da3"
BASE="https://adeyaar-next.vercel.app"
```

## Reset (before each run)
```sql
DELETE FROM public.activity; DELETE FROM public.bets;
```

---

## Phase 1: Basic Bet Placement

| # | Action | Expected |
|---|--------|----------|
| 1 | Ashin bets 1000 home A1 | 201, balance=4000 |
| 2 | Jayesh bets 2000 away A1 | 201, balance=3000 |
| 3 | Boidu bets 500 home A1 | 201, balance=4500 |
| 4 | Vaper bets 1500 draw A1 | 201, balance=3500 |

```bash
curl -s -X POST "$BASE/api/bets" -H "Content-Type: application/json" \
  -d '{"userId":"'$ASHIN'","matchId":"A1","pick":"home","amount":1000}'
```

**Verify:** `GET /api/pool` → A1 pool=5000, home=1500, away=2000, draw=1500

---

## Phase 2: Multi-Match Concurrent Bets

| # | Action | Expected |
|---|--------|----------|
| 5 | Ashin bets 2000 away A2 | 201, balance=2000 |
| 6 | Jayesh bets 1500 home A2 | 201, balance=1500 |
| 7 | Boidu bets 1000 home A2 | 201, balance=3500 |

**Verify:** `GET /api/bets?user_id=ASHIN` shows 2 pending bets on different matches.

---

## Phase 3: Edge Cases (all should fail gracefully)

| # | Action | Expected Error |
|---|--------|----------------|
| 8 | Ashin home A1 again (duplicate) | 409: "already have a bet on this side" |
| 9 | Ashin 5000 on A3 (insufficient) | 400: "Insufficient balance" |
| 10 | Invalid pick "invalid" | 400/500: "Invalid pick" |
| 11 | Zero amount | 400: "Missing required fields" |
| 12 | Negative amount | 400: "Amount must be positive" |

---

## Phase 4: Cancel + Side Switch

| # | Action | Expected |
|---|--------|----------|
| 13 | Vaper cancels A1 | refunded=1500, balance=5000 |
| 14 | Vaper cancels A1 again | 400: "No pending bets to cancel" |
| 15 | Ashin switches A1 home→away 800 | Auto-cancels home, balance=2200 |
| 16 | Vaper re-bets A1 home 1000 | 201, balance=4000 |

**Verify DB:** Ashin's original home bet = cancelled, new away bet = pending

---

## Phase 5: Topups (Fund Manipulation)

| # | Action | Expected |
|---|--------|----------|
| 17 | Jayesh topup 3000 | success, added=3000 |
| 18 | Topup 0 | 400: "Amount must be between 1 and 50,000" |
| 19 | Topup 50001 | 400: "Amount must be between 1 and 50,000" |
| 20 | Jayesh bets 2000 A3 (using topup funds) | 201 |

**Verify:** `GET /api/leaderboard` P&L excludes topups. Wallet includes them.

---

## Phase 6: Match Resolution

Resolve via SQL:
```sql
SELECT resolve_match('A1', 'away');  -- Jayesh+Ashin win
SELECT resolve_match('A2', 'home');  -- Jayesh+Boidu win
SELECT resolve_match('A3', 'draw'); -- only Vaper wins (if bet)
```

**Verify after each resolution:**

| Check | How |
|-------|-----|
| Payouts correct (parimutuel) | DB: `SELECT * FROM bets WHERE match_id='A1' AND status='won'` |
| Sum of payouts <= pool | `SUM(payout) WHERE won` <= total pool |
| Losers marked lost | `status='lost'`, payout=null |
| Balance reflects winnings | `compute_balance(user_id)` matches expected |
| Can't bet on resolved match | POST returns "Match already resolved" |
| Can't cancel resolved match | POST cancel returns "No pending bets" |

---

## Phase 7: Re-betting With Winnings

| # | Action | Expected |
|---|--------|----------|
| 21 | Winner bets more than starting balance (using winnings) | 201 |
| 22 | Winner bets entire wallet | 201, balance=0 |
| 23 | Winner bets 1 more (zero balance) | 400: "Insufficient balance" |

---

## Phase 8: Settlement Verification

```bash
curl -s "$BASE/api/settlement" | python3 -m json.tool
```

**Invariants:**
- `SUM(positive nets) ≈ SUM(negative nets)` (off by ≤ N rupees where N = number of resolutions, due to FLOOR)
- Settlement only counts resolved bets (won/lost), NOT pending or cancelled
- Topups (`match_id='_topup'`) never appear in settlement
- `transactions` array minimizes number of payments (greedy algorithm)
- Each `from` has negative net, each `to` has positive net

**Manual verification formula per user:**
```
net = SUM(payout WHERE status='won' AND match_id!='_topup') 
    - SUM(amount WHERE status IN ('won','lost') AND match_id!='_topup')
```

---

## Phase 9: Leaderboard Correctness

```bash
curl -s "$BASE/api/leaderboard" | python3 -m json.tool
```

| Field | Formula | Includes topups? |
|-------|---------|-----------------|
| `balance` (P&L) | SUM(payout won) - SUM(amount where !cancelled), **excluding _topup** | NO |
| `wallet` | 5000 + full computeBalance (including topups) | YES |

---

## Phase 10: Concurrent Race Conditions

Fire 2 bets from same user on different matches simultaneously:
```bash
curl -s -X POST "$BASE/api/bets" ... -d '{"matchId":"A4","amount":4000}' &
curl -s -X POST "$BASE/api/bets" ... -d '{"matchId":"A5","amount":4000}' &
wait
```

**Expected:** At most one succeeds if balance is 5000. The `FOR UPDATE` on profile row serializes them.

**Known gap:** Current `place_bet` locks by match_id first, then checks balance. Two bets on DIFFERENT matches could theoretically both pass if they read balance before either commits. This is mitigated by the profile lock added in migration 005.

---

## Summary: What's Tested

- [x] Basic CRUD: place, cancel, side-switch
- [x] All validation: duplicate, insufficient, invalid pick, zero/negative
- [x] Multi-match concurrent betting
- [x] Topups: limits, wallet effect, excluded from P&L
- [x] Resolution: parimutuel payouts, losers marked, activity logged
- [x] Re-betting with winnings (exceeding starting balance)
- [x] Settlement: min-transactions, excludes topups/pending
- [x] Leaderboard: P&L vs wallet split
- [x] Post-resolution guards: can't bet or cancel on resolved match
- [x] FLOOR rounding: ≤1 rupee leakage per resolution (acceptable)
