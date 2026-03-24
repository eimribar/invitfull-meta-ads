# Invitfull Creative Intelligence Blueprint

## The Science of Winning Creatives at Scale

**Version 1.0 | March 24, 2026**

This document defines the complete system, process, and science behind Invitfull's AI-driven creative optimization engine. Every decision is data-driven. Every creative is mathematically scored. Every action is traceable.

---

# PART 1: THE EMBEDDING FOUNDATION

## What Are Embeddings?

An embedding is a numerical fingerprint of a creative. It maps an image (and optionally its copy) into a 768-dimensional vector — a list of 768 numbers that captures the semantic meaning of the creative: its visual style, layout, colors, mood, messaging, and format.

Two creatives that look/feel similar → their embeddings are close together (high cosine similarity).
Two creatives that are completely different → their embeddings are far apart (low cosine similarity).

## Why Embeddings Matter for Meta Ads

Meta's Andromeda engine assigns each creative an **Entity ID** based on its visual/text fingerprint. Creatives with >60% similarity get clustered under ONE Entity ID → one auction ticket instead of two → wasted ad slot.

Embeddings let us:
1. **Pre-check similarity** before uploading → avoid Andromeda suppression
2. **Map what wins** → identify visual/copy patterns that correlate with low CPA
3. **Score new creatives** → predict performance before spending a dollar
4. **Ensure diversity** → mathematically guarantee each ad is different enough

## The Model: Gemini Embedding 2

- **Model ID**: `gemini-embedding-2-preview`
- **Input**: Images (PNG/JPEG), text, or both (multimodal)
- **Output**: Up to 3072-dimensional vector (we use 768 for storage efficiency via MRL)
- **API**: Google Generative AI API (`generativelanguage.googleapis.com`)
- **Cost**: See Google pricing (very low per embedding)
- **Latency**: ~500ms per embedding

### Why 768 Dimensions?

Gemini Embedding 2 supports Matryoshka Representation Learning (MRL) — it "nests" information so you can reduce dimensions without losing much quality:
- 3072: Maximum quality
- 1536: High quality, 50% storage
- 768: Good quality, 75% storage savings

We use 768 because:
- Quality difference from 3072 is <2% for similarity tasks
- Supabase storage is 4x cheaper
- API response is faster
- Sufficient for our use case (scoring ~100-500 creatives, not millions)

### Multimodal Embedding

Gemini Embedding 2 can embed image + text together in one request. This captures the FULL ad experience:

```
Image-only embedding:   captures visual style, layout, colors, people, objects
Text-only embedding:    captures copy angle, hook, CTA, messaging
Image + text embedding: captures the holistic ad experience — what the viewer sees AND reads
```

**We use image + text embedding for all ads.** The primary text / headline is concatenated and embedded alongside the image. This means two ads with the same image but different copy → different embeddings. The embedding captures what the VIEWER experiences.

---

# PART 2: THE EMBEDDING DATABASE

## Schema

Every creative that enters the system gets an entry:

```json
{
  "ad_id": "52527088268338",
  "ad_name": "baby_shower — invitfull_483914283",
  "image_hash": "5a1d8a79a0761600405a452fa7c4c540",
  "image_url": "https://...",
  "headline": "Baby Shower Invitations — Free Forever",
  "primary_text": "Invitfull makes custom baby shower invitations with AI...",
  "embedding": [0.0234, -0.0891, 0.1452, ...],  // 768 floats
  "embedding_type": "image_and_text",
  "dimensions": 768,
  "status": "ACTIVE",          // ACTIVE | WINNER | LOSER | RESERVE | FATIGUED | RETIRED
  "performance": {
    "spend": 4.87,
    "conversions": 0,
    "cpa": null,
    "ctr": 1.27,
    "cpm": 15.46,
    "impressions": 315,
    "days_active": 2
  },
  "classification": "LEARNING",  // from the agent's analysis
  "confidence": 0.50,            // Bayesian P(CPA ≤ $3.00)
  "format_tags": ["branded", "product_screenshot", "phone_mockup", "pregnant_woman"],
  "copy_angle": "free_forever",
  "created_at": "2026-03-23",
  "last_updated": "2026-03-24"
}
```

### Storage: Supabase

Table: `creative_embeddings`

```sql
CREATE TABLE public.creative_embeddings (
  ad_id TEXT PRIMARY KEY,
  ad_name TEXT,
  image_hash TEXT,
  image_url TEXT,
  headline TEXT,
  primary_text TEXT,
  embedding VECTOR(768),           -- pgvector extension
  embedding_type TEXT DEFAULT 'image_and_text',
  status TEXT DEFAULT 'ACTIVE',
  performance JSONB DEFAULT '{}',
  classification TEXT DEFAULT 'LEARNING',
  confidence FLOAT DEFAULT 0.5,
  format_tags TEXT[],
  copy_angle TEXT,
  created_at DATE DEFAULT CURRENT_DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Index for similarity search
CREATE INDEX ON public.creative_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

---

# PART 3: SIMILARITY SCIENCE

## Cosine Similarity

The metric for comparing embeddings. Ranges from -1 (opposite) to 1 (identical).

```
cosine_similarity(A, B) = (A · B) / (|A| × |B|)
```

### Thresholds (Calibrated for Meta Ads)

| Similarity | Meaning | Action |
|:---:|---|---|
| **> 0.85** | Near-identical creatives | REJECT — Andromeda will definitely suppress. Wasted ad slot. |
| **0.60 - 0.85** | Very similar — same format, similar visuals/copy | HIGH RISK — Andromeda likely suppresses. Avoid having both active simultaneously. |
| **0.40 - 0.60** | Moderate similarity — same general category | ACCEPTABLE — Different enough for separate Entity IDs. OK to run together. |
| **0.20 - 0.40** | Low similarity — different formats or angles | GOOD — High creative diversity. Andromeda treats as distinct. |
| **< 0.20** | Very different creatives | EXCELLENT — Maximum diversity. Different audiences reached. |

### The 0.60 Rule

**Never have two active ads with cosine similarity > 0.60.**

This is derived from Andromeda's Entity ID clustering (Blueprint V2, Section 1): "A Creative Similarity Score above 60% triggers retrieval suppression." Our embedding similarity maps directly to this — cosine similarity of 0.60 ≈ Meta's 60% similarity threshold.

## Distance Metrics

For diversity optimization, we use cosine distance:

```
cosine_distance(A, B) = 1 - cosine_similarity(A, B)
```

- Distance 0 = identical
- Distance 1 = completely different
- We want active ads to have distance > 0.40 from each other

---

# PART 4: CLUSTER ANALYSIS

## Winner and Loser Centroids

As performance data accumulates, we compute cluster centers:

```
winner_centroid = mean(embeddings where status = 'WINNER')
loser_centroid  = mean(embeddings where status = 'LOSER')
```

These centroids represent the "average winning creative" and "average losing creative" in embedding space.

## Creative Scoring Formula

For any new creative candidate, compute:

```
relevance_score  = cosine_similarity(candidate, winner_centroid)
danger_score     = cosine_similarity(candidate, loser_centroid)
suppression_risk = max(cosine_similarity(candidate, active_ad) for each active_ad)
diversity_score  = min(cosine_distance(candidate, active_ad) for each active_ad)

COMPOSITE SCORE = (relevance_score × 0.40)
               + ((1 - danger_score) × 0.20)
               + ((1 - suppression_risk) × 0.25)
               + (diversity_score × 0.15)
```

### Score Interpretation

| Composite Score | Meaning | Action |
|:---:|---|---|
| **> 0.70** | Excellent candidate | Upload immediately |
| **0.55 - 0.70** | Good candidate | Upload if slot available |
| **0.40 - 0.55** | Marginal | Only upload if no better options |
| **< 0.40** | Poor candidate | Reject — too similar to losers or active ads |

### Weight Rationale

- **Relevance (0.40)**: Most important — does this creative look like a winner?
- **Suppression risk (0.25)**: Critical — will Andromeda suppress this?
- **Danger (0.20)**: Important — does this look like a loser?
- **Diversity (0.15)**: Supporting — does this add something new to the mix?

These weights are initial calibration. Adjust after 30+ days of data.

---

# PART 5: THE CREATIVE LIFECYCLE

## Stage 1: Generation

Creatives are generated via Gemini 3 Pro Image from inspiration images.

**Process:**
1. Source inspiration images (competitor ads, new angles, winner variations)
2. Run `run_batch.py --segment baby_shower --dir /path/to/inspirations`
3. Gemini generates creatives following the system instruction
4. Output saved to `generations/` directory

**Embedding step:**
- Embed each generated candidate IMMEDIATELY
- Store in the embedding database with `status: 'CANDIDATE'`

## Stage 2: Scoring and Selection

Before any creative enters the ad account:

1. **Compute composite score** against winner/loser centroids and active ads
2. **Rank all candidates** by composite score
3. **Apply the 0.60 rule** — reject any candidate with >0.60 similarity to any active ad
4. **Apply diversity constraint** — among selected candidates, no two should be >0.60 similar to each other
5. **Select top N** candidates that pass all filters

**Selection algorithm (greedy farthest-first):**
```
selected = []
pool = all candidates sorted by composite_score descending

while len(selected) < N and pool is not empty:
    for candidate in pool:
        if similarity(candidate, any active ad) > 0.60: skip
        if similarity(candidate, any selected) > 0.60: skip
        selected.append(candidate)
        break
```

## Stage 3: Testing (ABO)

Selected creatives enter the ABO testing campaign:
- 2 creatives per ad set, $20/day per ad set
- $10/creative/day minimum for confident reads
- Run for 7-10 days before decisions

**Daily embedding updates:**
- Performance data (spend, conversions, CPA) updated daily
- Fatigue drift calculated: is the embedding "moving" toward the loser cluster? (Not literally — the embedding doesn't change, but the performance trajectory tells us if this creative is becoming a loser)

## Stage 4: Classification

After sufficient data ($100+ spend):

| Classification | Criteria | Embedding Action |
|---|---|---|
| **WINNER** | 5+ conv, CPA ≤ $3.00, >90% Bayesian confidence | Add to winner cluster. Update centroid. |
| **LOSER** | $16+ spend, 0 conv, or <10% confidence | Add to loser cluster. Update centroid. |
| **FATIGUED** | Was winner, now CTR declining + CPM rising 3+ days | Move from winner to fatigued. Track drift. |

## Stage 5: Graduation (Winners → CBO)

When a creative is confirmed as a winner:
1. Graduate to CBO via Post ID (preserves social proof)
2. Update embedding database: `status: 'WINNER'`
3. Recalculate winner centroid
4. Generate 3-5 variations (same format, different angles)
5. Score variations → upload best to ABO as replacements

## Stage 6: Retirement

When a creative fatigues (frequency > 3, rising CPM, declining CTR for 5+ days):
1. Pause in CBO
2. Update embedding database: `status: 'FATIGUED'`
3. Do NOT add to loser cluster — fatigued ≠ bad creative, just exhausted
4. Generate replacements targeting the same embedding region (similar format/angle)
5. Keep the embedding for historical analysis

---

# PART 6: THE DIVERSITY MANAGEMENT SYSTEM

## Active Ad Similarity Matrix

At any time, the system maintains a pairwise similarity matrix of all active ads:

```
         Ad1   Ad2   Ad3   Ad4   Ad5
Ad1      1.00  0.35  0.22  0.58  0.41
Ad2      0.35  1.00  0.67* 0.28  0.19
Ad3      0.22  0.67* 1.00  0.31  0.44
Ad4      0.58  0.28  0.31  1.00  0.25
Ad5      0.41  0.19  0.44  0.25  1.00

* = ALERT: Ad2-Ad3 similarity 0.67 exceeds 0.60 threshold
```

**Daily check:** If any pair exceeds 0.60, the agent flags it and recommends pausing the lower-performing ad.

## Diversity Score for the Active Set

The overall diversity of the active ad set:

```
diversity_score = mean(all pairwise distances between active ads)
```

| Score | Rating | Meaning |
|:---:|---|---|
| **> 0.65** | Excellent | Maximum creative diversity — Andromeda has many distinct signals |
| **0.50 - 0.65** | Good | Healthy diversity |
| **0.35 - 0.50** | Moderate | Some clustering — consider adding more diverse formats |
| **< 0.35** | Poor | Ads are too similar — Andromeda will suppress most of them |

**Target: Keep active set diversity score above 0.50 at all times.**

---

# PART 7: COMPETITIVE INTELLIGENCE

## Competitor Embedding Process

Weekly (Mondays):
1. Scrape Meta Ad Library for competitor baby shower ads
2. Embed each competitor creative
3. Plot in our embedding space

## Analysis

### Gap Analysis
```
Our coverage:  regions of embedding space where we have active/tested ads
Their coverage: regions where competitors have active ads
Gaps:          regions competitors cover but we don't → TEST THESE
```

### Convergence Detection
```
If competitor ads cluster near our winner centroid:
  → They've found the same winning pattern
  → We need to DIFFERENTIATE or we'll compete in the same auction
  → Generate creatives that maintain our winning pattern but add unique elements
```

### Competitive Advantage Map
```
If our winners are in regions competitors DON'T cover:
  → We have a creative moat
  → Double down on this territory
  → These creatives may have lower CPMs (less auction competition)
```

---

# PART 8: GENERATION STRATEGY

## The 60-30-10 Generation Rule

When producing new creatives:

| Allocation | Source | Embedding Target |
|:---:|---|---|
| **60%** | Winner variations | Within 0.30-0.55 similarity to winner centroid. Same format, different angle. |
| **30%** | Adjacent exploration | 0.20-0.40 similarity to winner centroid. New formats with winning elements. |
| **10%** | Wild exploration | <0.20 similarity to anything active. Completely new territory. |

## Generation Prompt Engineering with Embeddings

When the agent triggers creative generation, the prompt includes embedding context:

```
"Generate a baby shower ad creative.

WINNING PATTERNS (target these):
- Phone mockup with product screenshot, bold headline, orange/cream palette
- Similarity target: 0.35-0.50 to our winner centroid

AVOID (these patterns lose):
- Generic testimonial quotes on plain backgrounds
- These have 0.70+ similarity to our loser centroid

DIFFERENTIATE FROM (active ads):
- [descriptions of current active ads]
- New creative must be <0.55 similar to any of these

FORMAT: Branded product ad with real people"
```

## Inspiration Image Selection

When choosing inspiration images for generation:
1. Embed all available inspiration images
2. Score each against winner centroid → select the most relevant
3. Filter out inspirations too similar to existing creatives
4. Use the top-scoring, most diverse set as inputs to `run_batch.py`

---

# PART 9: THE FEEDBACK LOOP

## Daily Data Flow

```
Morning (8:00 AM):
├── Pull Meta performance data
├── Update all active ad performance metrics
├── Recalculate Bayesian confidence for each ad
├── Update winner/loser centroids (if any new classifications)
├── Compute active ad similarity matrix
├── Check diversity score
├── Compute fatigue drift for each ad
├── Classify ads (WINNER / LOSER / LEARNING / FATIGUED)
├── Execute decisions (pause, graduate, replace)
├── Score reserve creatives against updated clusters
├── If reserves < 5: trigger generation + scoring pipeline
├── Send report with embedding insights
└── Save all state to Supabase
```

## Weekly Intelligence Report

Every Monday, the agent produces an extended report:

```
# Weekly Creative Intelligence Report

## Embedding Space Health
- Active set diversity score: 0.58 (Good)
- Winner cluster size: 8 creatives
- Loser cluster size: 12 creatives
- Centroid shift from last week: [direction]

## Top Performing Patterns (by embedding region)
1. Branded + phone mockup + "free" hook → avg CPA $2.10
2. Comparison (us vs them) → avg CPA $2.45
3. Authentic LinkedIn post → avg CPA $2.80

## Underperforming Patterns
1. Generic testimonial quotes → avg CPA $4.50
2. UGC selfie style → avg CPA $5.20

## Diversity Alerts
- Ad pair (X, Y) similarity 0.63 → recommend pausing Y
- Active set has no "story format" representation → generate 2 story ads

## Competitive Landscape
- Paperless Post launched 4 new ads in our winner region
- Evite has no presence in the comparison format space → opportunity

## Generation Recommendations
- Generate 6 branded product ads (winner cluster, different angles)
- Generate 3 comparison ads (high performer, expand coverage)
- Generate 1 wild card (unexplored region near [0.2, -0.1, ...])
```

---

# PART 10: METRICS AND CALIBRATION

## System Metrics

Track these to evaluate the embedding system itself:

| Metric | Definition | Target |
|---|---|---|
| **Prediction accuracy** | % of candidates scored >0.70 that become winners | >30% |
| **Loser avoidance** | % of candidates scored <0.40 that become losers | >60% |
| **Suppression rate** | % of active ad pairs with >0.60 similarity | 0% |
| **Diversity score** | Mean pairwise distance of active set | >0.50 |
| **Generation efficiency** | Winners per 10 creatives generated | >1.5 (15%) |
| **Time to winner** | Days from generation to confirmed winner | <14 days |
| **Centroid stability** | Cosine distance between weekly centroid updates | <0.10 |

## Calibration Schedule

| Timeframe | Action |
|---|---|
| **Week 1-2** | Seed the database. Embed all 33 creatives. Establish baseline. |
| **Week 3-4** | First winners/losers classified. Compute initial centroids. |
| **Month 2** | Calibrate composite score weights based on prediction accuracy. |
| **Month 3** | Calibrate similarity thresholds (0.60 rule) against actual Andromeda behavior. |
| **Quarterly** | Full system review. Update all thresholds, weights, and generation rules. |

## How to Calibrate

After 30+ classified creatives:

1. **Plot CPA vs similarity-to-winner-centroid** → should show negative correlation (higher similarity = lower CPA)
2. **Plot CPA vs similarity-to-loser-centroid** → should show positive correlation
3. **Check Andromeda suppression** → for ad pairs with measured similarity, check if they received separate auction participation
4. **Adjust the 0.60 threshold** — if pairs at 0.55 are getting suppressed, tighten to 0.55. If pairs at 0.65 run fine, loosen to 0.65.
5. **Adjust composite score weights** — if danger_score has more predictive power than relevance_score, increase its weight.

---

# PART 11: IMPLEMENTATION CHECKLIST

## Phase 1: Database Setup (Day 1)
- [ ] Enable pgvector extension in Supabase
- [ ] Create `creative_embeddings` table
- [ ] Embed all 20 active ads (image + text)
- [ ] Embed all 13 reserve creatives
- [ ] Store all embeddings in Supabase
- [ ] Compute initial pairwise similarity matrix
- [ ] Verify no active ad pairs exceed 0.60

## Phase 2: Agent Integration (Day 2-3)
- [ ] Add embedding tools to agent: `embed_creative`, `compare_creatives`, `find_most_diverse_set`
- [ ] Agent embeds new creatives on upload
- [ ] Agent checks similarity before recommending uploads
- [ ] Agent includes diversity score in daily report
- [ ] Agent flags high-similarity active ad pairs

## Phase 3: Cluster Analysis (Week 3-4, after first winners/losers)
- [ ] Compute winner centroid from confirmed winners
- [ ] Compute loser centroid from confirmed losers
- [ ] Implement composite scoring formula
- [ ] Score all reserve creatives
- [ ] Rank and recommend next uploads based on score

## Phase 4: Generation Integration (Week 4+)
- [ ] Embed candidate creatives during generation
- [ ] Apply composite score filter before flagging for review
- [ ] Include embedding context in generation prompts
- [ ] Implement 60-30-10 generation rule with embedding targets

## Phase 5: Competitive Intelligence (Month 2+)
- [ ] Weekly Ad Library scrape + embedding
- [ ] Gap analysis: our coverage vs competitor coverage
- [ ] Convergence alerts

## Phase 6: Full Calibration (Month 3+)
- [ ] Backtest composite score against actual performance
- [ ] Calibrate all thresholds and weights
- [ ] Publish internal benchmark report

---

# PART 12: GLOSSARY

| Term | Definition |
|---|---|
| **Embedding** | 768-dimensional vector representing a creative's semantic meaning |
| **Cosine similarity** | Metric from -1 to 1 measuring how similar two embeddings are |
| **Cosine distance** | 1 - cosine similarity. Higher = more different |
| **Centroid** | Average embedding of a cluster (e.g., winner centroid = mean of all winner embeddings) |
| **Entity ID** | Andromeda's internal fingerprint for a creative. Similar creatives share one Entity ID |
| **Suppression** | Andromeda treating two ads as one because they're too similar |
| **MRL (Matryoshka Representation Learning)** | Technique allowing flexible embedding dimension reduction |
| **Composite score** | Weighted combination of relevance, danger, suppression risk, and diversity scores |
| **Fatigue drift** | When a winning creative's performance trajectory approaches loser patterns |
| **Winner cluster** | Region of embedding space where winning creatives concentrate |
| **Loser cluster** | Region of embedding space where losing creatives concentrate |
| **Gap** | Region of embedding space with no tested creatives — potential opportunity |

---

*Blueprint v1.0 — March 24, 2026. Created by Claude Opus 4.6 for Invitfull.*
*Next review: April 24, 2026.*
