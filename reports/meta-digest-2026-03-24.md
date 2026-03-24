# Meta Ads Daily Digest — 2026-03-24

## Headline

**Day 1 of ABO Testing. $30.38 spent. 0 registrations. All ads learning. NO ACTIONS.**

| Metric | Value |
|--------|-------|
| Total Spend | $30.38 |
| Registrations (complete_registration) | 0 |
| CPA | N/A |
| Impressions | 2,603 |
| Link Clicks | 19 |
| Landing Page Views | 13 |
| Avg CTR | 1.14% |
| Avg CPM | $14.72 |
| Avg Frequency | 1.09 |
| Custom Offsite Conversions | 15 |

---

## Critical Alert: Budget Delivery

**Expected daily spend: $200. Actual Day 1 spend: $30.38 (15% of budget).**

This is common on Day 1 as Meta's algorithm ramps up delivery, but if spend doesn't reach $150+ by Day 2, investigate:
- Ad review delays
- Audience too narrow (unlikely with broad US targeting)
- Bid cap issues
- Account spending limits

---

## Critical Alert: Conversion Tracking

**Zero `complete_registration` events** despite 19 link clicks and 13 landing page views.

Two unrecognized custom offsite conversion IDs are firing:
- `offsite_conversion.custom.1379503393742648`
- `offsite_conversion.custom.1100418405334956`

These do NOT match the documented custom conversions (signup_v2: 1657158561999170, watch_invite_v2: 1434390078412864). **Verify the pixel is correctly tracking complete_registration on the /baby-shower landing page.**

---

## Ad Performance (Day 1)

| # | Ad (Short ID) | Ad Set | Spend | Impr | Clicks | CTR | CPM | LPVs | Custom Conv | Signal |
|---|---------------|--------|------:|-----:|-------:|----:|----:|-----:|------------:|--------|
| 1 | 634334497 (7-A) | Test 7 | $2.63 | 272 | 3 | 1.10% | $9.67 | 1 | 1 | Best early signal |
| 2 | 639555072 (9-A) | Test 9 | $2.74 | 264 | 3 | 1.14% | $10.38 | 1 | 1 | Strong efficiency |
| 3 | 638120022 (8-A) | Test 8 | $3.45 | 243 | 3 | 1.23% | $14.20 | 1 | 1 | Highest spend |
| 4 | 483914283 (1-A) | Test 1 | $2.89 | 154 | 4 | 2.60% | $18.77 | 1 | 1 | Best CTR |
| 5 | 615800621 (6-A) | Test 6 | $2.63 | 187 | 1 | 0.53% | $14.06 | 1 | 1 | Solid |
| 6 | 579711182 (3-B) | Test 3 | $2.45 | 150 | 1 | 0.67% | $16.33 | 1 | 2 | Most custom conv |
| 7 | 505861666 (2-B) | Test 2 | $2.01 | 127 | 1 | 0.79% | $15.83 | 1 | 1 | Decent |
| 8 | 611603080 (5-B) | Test 5 | $1.91 | 137 | 3 | 2.19% | $13.94 | 0 | 0 | High CTR, no funnel |
| 9 | 646353941 (10-A) | Test 10 | $2.66 | 139 | 0 | 0% | $19.14 | 0 | 0 | Zero engagement |
| 10 | 586126917 (4-A) | Test 4 | $1.59 | 129 | 0 | 0% | $12.33 | 0 | 0 | Zero engagement |
| 11 | 497510807 (2-A) | Test 2 | $1.60 | 53 | 0 | 0% | $30.19 | 0 | 0 | High CPM, 0 clicks |
| 12 | 646383254 (10-B) | Test 10 | $1.12 | 56 | 1 | 1.79% | $20.00 | 1 | 1 | Small sample |
| 13 | 600240598 (4-B) | Test 4 | $0.83 | 66 | 1 | 1.52% | $12.58 | 0 | 0 | Low data |
| 14 | 645332897 (9-B) | Test 9 | $0.75 | 21 | 0 | 0% | $35.71 | 0 | 0 | Starved, high CPM |
| 15 | 635108075 (7-B) | Test 7 | $0.55 | 66 | 1 | 1.52% | $8.33 | 1 | 1 | Efficient |
| 16 | 611603080 (5-A) | Test 5 | $0.24 | 12 | 0 | 0% | $20.00 | 0 | 0 | Starved |
| 17 | 569916197 (3-A) | Test 3 | $0.14 | 8 | 0 | 0% | $17.50 | 0 | 0 | Starved |
| 18 | 632244722 (6-B) | Test 6 | $0.12 | 14 | 0 | 0% | $8.57 | 0 | 0 | Starved |
| 19 | 488074896 (1-B) | Test 1 | $0.07 | 5 | 1 | 20% | $14.00 | 1 | 1 | Noise |

**Missing:** Test 8 second ad — 0 impressions. May be stuck in ad review.

---

## Ad Set Summary

| Ad Set | Spend | Impr | CTR | CPM | Link Clicks | Custom Conv | Notes |
|--------|------:|-----:|----:|----:|------------:|------------:|-------|
| Test 7 | $3.18 | 338 | 1.18% | $9.41 | 2 | 2 | Lowest CPM, post save, best reach |
| Test 9 | $3.49 | 285 | 1.05% | $12.25 | 2 | 1 | Efficient delivery |
| Test 8 | $3.45 | 243 | 1.23% | $14.20 | 2 | 1 | Only 1 ad serving |
| Test 1 | $2.96 | 159 | 3.14% | $18.62 | 2 | 1 | Highest CTR |
| Test 6 | $2.75 | 201 | 0.50% | $13.68 | 1 | 1 | Steady |
| Test 3 | $2.59 | 158 | 0.63% | $16.39 | 1 | 2 | Most custom conversions |
| Test 10 | $3.78 | 195 | 0.51% | $19.38 | 1 | 1 | Uneven — A bad, B promising |
| Test 4 | $2.42 | 195 | 0.51% | $12.41 | 0 | 0 | Zero funnel activity |
| Test 2 | $3.61 | 180 | 0.56% | $20.06 | 1 | 1 | High CPM |
| Test 5 | $2.15 | 149 | 2.01% | $14.43 | 2 | 0 | Clicks but no funnel |

---

## Decisions

### Actions Taken: NONE

**Rationale:** Day 1 of a 7-10 day learning phase. Strategy mandates conservative approach before March 30. Every ad has spent less than $4 — far below the $16 kill threshold. No statistical confidence is possible at these volumes.

### Watch List

**Promising (early signals only):**
1. **Test 7** — Lowest CPMs ($8-10), highest reach (338), post save engagement. "Free Baby Shower Invitations by AI" / "$0" messaging resonates.
2. **Test 9** — Efficient delivery (264 impressions at $10.38 CPM), 2 link clicks. "Custom Baby Shower Invites in 60 Seconds" angle performing.
3. **Test 1** — Highest CTR (3.14%). "Baby Shower Invitations — Free Forever" hooks attention.
4. **Test 3-B** — 2 custom conversions on $2.45 spend. Best downstream conversion rate. "Invitfull vs. Other Invitation Sites" comparison angle.

**Concerning (early signals only):**
1. **Test 4** — $2.42 spent, 195 impressions, 0 link clicks across both ads. "Send Baby Shower Invites in Under a Minute" / "100% Free. No Ads." not resonating yet.
2. **Test 2-A** — $1.60 spent at $30 CPM, 0 clicks. High cost, no engagement.
3. **Test 10-A** — $2.66 spent, 0 clicks. "Plan Your Baby Shower in 60 Seconds" creative may not be stopping scrolls.

---

## Creative Insights

### Early Patterns (Low Confidence)

**What seems to work:**
- **"Free" + "AI" combination** (Test 7): Lowest CPM suggests Andromeda finds strong audience match
- **Comparison angles** (Test 3-B): 2 custom conversions suggests downstream intent
- **"Free Forever" phrasing** (Test 1): Highest CTR — strong scroll-stopper
- **Speed claims** (Test 9): "60 Seconds" + "Custom" performs well

**What seems weak:**
- **Feature-heavy copy** (Test 4): "100% Free. No Ads. No Hidden Fees." — too many claims, nothing stands out
- **Generic planning copy** (Test 10-A): "Plan Your Baby Shower" lacks specificity
- **"RSVPs, Registry, Directions" copy** (Test 2-A): Feature list doesn't create urgency

### Duplicate Creative Alert
Test 5-A and 5-B use the same base image (`invitfull_611603080`). Per Andromeda rules, similarity >60% triggers retrieval suppression. This may explain why 5-A is starved ($0.24) while 5-B gets $1.91. Consider replacing 5-A with a different creative.

---

## Fatigue Alerts

**None.** All frequencies at ~1.0. No fatigue possible on Day 1.

---

## Phase 2 Readiness

| Metric | Current | Target |
|--------|---------|--------|
| Winners | 0 | 5 |
| Days of data | 1 | 7-10 |
| Ready for CBO? | NO | — |
| Earliest possible | April 2 | — |

---

## Budget Concern

The campaign budget is set at $200/day (10 ad sets x $20), but Day 1 only delivered $30.38 (15%). This is likely because:
1. Campaign just exited review (launched March 23 evening)
2. Meta ramps delivery gradually for new campaigns
3. The data extraction may have captured a partial day

**If Day 2 spend is still under $100, investigate delivery issues.**

---

## Recommendations

1. **Do nothing.** Let the algorithm learn for 5-6 more days minimum.
2. **Verify conversion tracking.** Zero `complete_registration` with 13 LPVs is concerning. Check pixel helper on /baby-shower.
3. **Investigate Test 8's missing ad.** Should have 2 creatives, only 1 is serving.
4. **Identify the unknown custom conversions** (1379503393742648, 1100418405334956). These may be tracking useful events.
5. **Monitor spend ramp.** Expect $150-200/day by Day 2-3.
6. **Next digest: March 26** (Day 3) for early signal validation.

---

*Generated by Invitfull AI Optimizer | Data extracted 2026-03-24T12:01:06Z*
