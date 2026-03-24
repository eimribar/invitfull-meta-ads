# Invitfull Meta Ads Strategy

## Andromeda Best Practices (2025-2026)

Andromeda is Meta's AI ad retrieval engine. **Creative is now the primary targeting signal** — not audiences, interests, or demographics.

### Core Principles

1. **ABO is where you learn, CBO is where you earn.** Test with equal budgets, scale with algorithmic distribution.
2. **Creative diversity > audience targeting.** Different creatives reach different people. Andromeda matches creative to audience automatically.
3. **Broad targeting + Advantage+.** Let the algorithm find the right people. Manual interest targeting is counterproductive.
4. **$10/creative/day minimum.** Below this, the algorithm can't learn. Need $100+ total spend per creative for a confident read. (Sources: Andromeda Blueprint V2, AdManage, Flighted, VibeMyAd)
5. **Creative similarity < 40%.** Andromeda assigns Entity IDs based on visual/text fingerprint. Similarity above 60% triggers retrieval suppression — you get one auction ticket, not two.

---

## Current Structure (March 23, 2026)

### Active: ABO Testing Blitz — Phase 1

All $200/day allocated to ABO testing to find winners. No CBO scaling campaign yet.

| Campaign | ID | Type | Budget | Ad Sets | Ads | Status |
|----------|-----|------|--------|---------|-----|--------|
| Baby Shower — ABO Testing — March 2026 | 52527087644338 | ABO | $200/day | 10 | 20 | **ACTIVE** |

**Structure: 10 ad sets × $20/day × 2 creatives each**

| Ad Set | ID | Ads | Headline 1 | Headline 2 |
|--------|-----|-----|-----------|-----------|
| Test 1 | 52527087870738 | 2 | Baby Shower Invitations — Free Forever | Create Your Baby Shower Invite in Seconds |
| Test 2 | 52527088909538 | 2 | RSVPs, Registry, Directions — One Link | Free and Ad-Free Baby Shower Invitations |
| Test 3 | 52527090267338 | 2 | Invitfull vs. Other Invitation Sites | Baby Showers, Simplified |
| Test 4 | 52527091472938 | 2 | Send Baby Shower Invites in Under a Minute | 100% Free. No Ads. No Hidden Fees. |
| Test 5 | 52527093116938 | 2 | Moms Are Switching to Invitfull | Baby Shower Planning Without the Stress |
| Test 6 | 52527094600338 | 2 | Stop DIY-ing Your Baby Shower Invites | Your Dream Baby Shower Invitation |
| Test 7 | 52527095718138 | 2 | Free Baby Shower Invitations by AI | Baby Shower Invitations — $0 |
| Test 8 | 52527096966138 | 2 | The Best Baby Shower Invitation Platform | AI Baby Shower Invitations — Free |
| Test 9 | 52527098169138 | 2 | Custom Baby Shower Invites in 60 Seconds | Ready in Under 60 Seconds. Free. |
| Test 10 | 52527099421138 | 2 | Plan Your Baby Shower in 60 Seconds | Stop Paying for Baby Shower Invites |

**Targeting (identical across all ad sets):**
- Broad US, 18-65, Advantage+ Audience
- Pixel: 1398381481388085, Optimization: COMPLETE_REGISTRATION
- Placements: Advantage+ (Facebook, Instagram, Messenger)
- Bid: LOWEST_COST_WITHOUT_CAP
- Landing page: https://invitfull.com/baby-shower

**Creative mix:** Branded product ads, authentic social proof (LinkedIn/Twitter/iMessage), comparison ads, testimonial quote cards, before/after, UGC-style, pain point, story-format. Each creative has unique tailored copy.

### Paused Campaigns

| Campaign | ID | Reason |
|----------|-----|--------|
| Baby Shower — March 2026 v2 | 52522752781138 | Replaced by ABO testing (was CBO $200/day, 17 ads, $5.67 CPA — algorithm laziness problem) |
| General — Testing | 52519110833538 | Paused prior |
| Kids Birthday — Testing | 52517940474138 | Paused prior |
| Baby Shower Leads — Feb 2026 | 52515074299538 | Paused prior |

---

## Why We Restructured (March 23, 2026)

### Problem: Algorithm Laziness in CBO

The previous CBO campaign (`Baby Shower — March 2026 v2`, $200/day, 17 creatives) had severe budget concentration:

| Ad | Spend | Regs | CPR | % Budget |
|-----|-------|------|-----|----------|
| 587103467 (branded) | $450 | 41 | $10.98 | 25% |
| An_2qJG5 (authentic) | $418 | 32 | $13.07 | 23% |
| Eimri's Video | $412 | 25 | $16.46 | 23% |
| OpenAI Playground | $234 | 46 | **$5.08** | 13% |
| *13 other creatives* | *$271 combined* | — | — | *16%* |

**Top 4 ads consumed 84% of budget.** 13 creatives were starved ($1-23 total each). The algorithm locked onto high-CPR ads and ignored lower-CPR options. The best performer (OpenAI Playground at $5.08 CPR) got less budget than three worse performers.

CPR trended from $5.00 (Mar 18) to $25.82 (Mar 21) — campaign was fatiguing.

### Solution: ABO Testing Blitz

Based on research from 8 sources (Andromeda Blueprint V2, Foxwell Digital, AdsUploader, VibeMyAd, Motion, AdManage, Flighted, Metalla Digital):

- **ABO guarantees equal budget per ad set** — algorithm cannot starve creatives
- **$20/day per ad set × 2 creatives** = $10/creative/day = confident read in 10 days
- **1 campaign** avoids auction overlap and data fragmentation
- **Phase 1 = all testing**, Phase 2 = graduate winners to CBO

---

## Operating Playbook

### Phase 1: ABO Testing (Current — started March 23)

**Timeline:** 7-10 days of hands-off testing.

**Day 7 Evaluation (March 30):**

| Result | Criteria | Action |
|--------|----------|--------|
| **Winner** | 5+ conversions at ≤ $4.00 CPA | Note for CBO graduation |
| **Loser** | Spent $16+ with 0 conversions | Kill immediately |
| **Loser** | 0 impressions after 7 days | Kill |
| **Inconclusive** | Some data, not enough | Run 3-5 more days |

**Refresh:**
- Replace killed creatives with fresh ones from the 13 reserves
- If reserves exhausted, generate new batch via `run_batch.py`

### Phase 2: ABO + CBO (After Day 10-14)

Once 5-10 winners confirmed:

1. **Create CBO Scaling campaign** — 70% of budget ($140/day)
   - 1 ad set, all winners via Post ID (preserves social proof)
   - Apply 60-30-10 rule: 60% winners, 30% variations, 10% fresh

2. **Reduce ABO Testing** — 30% of budget ($60/day)
   - 3 ad sets × $20/day × 2-3 creatives
   - Continuous testing, feed winners to CBO

### Phase 3: Steady State

| Campaign | Type | Budget | Purpose |
|----------|------|--------|---------|
| Invitfull — Testing | ABO | 30% of total | Test new creatives |
| Invitfull — Scaling | CBO | 70% of total | Scale proven winners |

**Weekly cadence:**
- Evaluate ABO results, graduate winners, kill losers
- Refresh ABO with new creatives
- Monitor CBO for fatigue (frequency > 3, rising CPM)
- Maintain 10-14 active creatives in CBO

### Kill Rules

| Rule | Trigger | Action |
|------|---------|--------|
| Overspend | Spent 3-4× target CPA ($12-16) with 0 conversions | Kill immediately |
| Zero spend | 0 impressions after 7 days | Kill |
| Fatigue | Frequency > 3 AND rising CPM for 5+ days | Pause in CBO |
| Campaign death | CPA 5×+ target ($20+) for 10+ days | Kill campaign, start fresh |

### Graduation Protocol

1. Creative must have 5+ conversions at ≤ $4.00 CPA in ABO
2. Copy the **Post ID** (not duplicate) — preserves likes, comments, shares
3. Create ad in CBO Scaling ad set using that Post ID
4. Turn off the ad in ABO
5. Replace the ABO slot with a fresh creative

### The 60-30-10 Rule (for CBO Scaling)

| Allocation | Budget | Content |
|-----------|--------|---------|
| 60% | Winners | Ads with 5+ conversions at target CPA, stable 7+ days |
| 30% | Variations | Same core concept as winners, different hooks/formats |
| 10% | Fresh | Completely new angles, discovery budget |

Source: VibeMyAd 2026 framework, corroborated by Andromeda Blueprint V2.

### Budget Scaling Path

Scale CBO by max 20% every 48-72 hours when CPA is stable:

| Total Budget | Testing (30%) | Scaling (70%) | Test Creatives | Scale Creatives |
|-------------|--------------|--------------|----------------|-----------------|
| $200/day | $60 | $140 | 6-9 | 10-14 |
| $250/day | $75 | $175 | 7-9 | 14-17 |
| $300/day | $90 | $210 | 9-12 | 15-21 |
| $400/day | $100 | $300 | 10-15 | 20-30 |

---

## Creative Production Pipeline

### Current Inventory

| Source | Count | Status |
|--------|-------|--------|
| Approved creatives | 33 | 20 uploaded, 13 in reserve |
| Full pipeline (`generations 23.03/`) | 88 | Baby shower creatives from Mar 22-23 generation |

### Generation Pipeline

```bash
# 1. Generate from inspiration images
python3 scripts/run_batch.py --segment baby_shower --dir "/path/to/inspirations" --output-dir "/path/to/output"

# 2. Dry run upload
python3 scripts/setup_abo_testing.py --dir "/path/to/approved" --dry-run

# 3. Upload to Meta
python3 scripts/setup_abo_testing.py --dir "/path/to/approved"

# Or upload to existing ad set
python3 scripts/upload_to_meta.py --segment baby_shower --ad-set-id XXXXX --dir "/path/to/approved"
```

### Generation Details

- Model: Gemini 3 Pro Image (`gemini-3-pro-image-preview`), 4K output
- System instruction: `baby-shower/system_instruction.md`
- Reference images: logo, product screenshots (4), invitation examples (2)
- Format detection: model determines branded vs authentic from inspiration
- Creative types: branded product, authentic social proof, comparison, testimonial, UGC, pain point

### Production Cadence

- 10-15 new creatives every 2 weeks
- Each batch: 2+ angles not currently active
- Creative similarity < 40% between ads
- Mix formats: branded, authentic, comparison, testimonial, product demo

---

## Account IDs

| Resource | ID |
|----------|-----|
| Ad Account | act_104007129 |
| Page | 917868684732619 |
| Instagram | 17841477854992643 (not set via API — uses Page identity on IG) |
| Pixel | 1398381481388085 |

### Custom Conversions (v2)

| Name | ID | Rule |
|------|-----|------|
| invitfull_signup_v2 | 1657158561999170 | URL contains /auth/callback |
| invitfull_watch_invite_v2 | 1434390078412864 | URL contains /i/ OR /e/ |
| invitfull_purchase_v2 | 935955148983273 | URL contains /checkout/thank-you |

### Landing Pages

| Segment | URL |
|---------|-----|
| Baby Shower | https://invitfull.com/baby-shower |
| Kids Birthday | https://invitfull.com/kids-birthday |
| Generic | https://invitfull.com |

---

## Key Files

| File | Purpose |
|------|---------|
| `scripts/run_batch.py` | Generate ad creatives from inspiration images via Gemini |
| `scripts/setup_abo_testing.py` | Create ABO campaign with multiple ad sets + upload creatives |
| `scripts/upload_to_meta.py` | Upload creatives to existing ad sets |
| `pull-meta-report.js` | Pull campaign performance data from Meta API |
| `pull-full-analysis.js` | Detailed campaign analysis with daily breakdowns |
| `baby-shower/system_instruction.md` | AI prompt for baby shower creative generation |
| `.meta_token` / `.env` | Meta API access token |

---

## Research Sources

- Andromeda Agency Blueprint V2 (internal document)
- [Foxwell Digital — Creative Testing Frameworks 2026](https://www.foxwelldigital.com/blog/the-meta-creative-testing-frameworks-top-brands-use-in-2026)
- [AdsUploader — ABO vs CBO 2026](https://adsuploader.com/blog/abo-vs-cbo)
- [VibeMyAd — Testing Framework That Works](https://www.vibemyad.com/blog/the-meta-ads-testing-framework-that-actually-works)
- [Motion — Ultimate Guide to Creative Testing](https://motionapp.com/blog/ultimate-guide-creative-testing-2025)
- [AdManage — How Many Creatives to Test](https://admanage.ai/blog/how-many-ad-creatives-to-test)
- [Flighted — Best Meta Ads Structure 2026](https://www.flighted.co/blog/best-meta-ads-account-structure-2026)
- [Metalla — Why 2 Campaigns Scale Better Than 20](https://metalla.digital/meta-ads-strategy-2026-blueprint/)

---

## Next Steps

1. **March 30:** Day 7 evaluation — identify winners and losers from ABO testing
2. **March 30:** Kill losers, replace with 13 reserve creatives
3. **April 2-5:** Phase 2 transition — launch CBO with winners, reduce ABO to 30%
4. **Ongoing:** Generate 10-15 new creatives every 2 weeks
5. **Ongoing:** Weekly graduation/kill cycle
