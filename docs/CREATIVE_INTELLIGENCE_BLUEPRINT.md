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

# PART 12: THE INTELLIGENT GENERATION ENGINE

This section defines exactly how the agent constructs generation requests — from deciding what to generate, to selecting inputs, to building the prompt, to scoring outputs.

## Overview

The generation pipeline has 4 layers:

```
Layer 1: WHAT to generate     → Agent decides based on embedding analysis
Layer 2: WITH WHAT inputs     → Agent selects references + inspirations by embedding score
Layer 3: HOW to instruct      → Agent constructs dynamic system instruction
Layer 4: VALIDATE output      → Agent embeds output + scores before approving
```

Each layer is data-driven. Nothing is static. Nothing is guesswork.

---

## 12.1: Reference Image Architecture

### The Reference Image Pool

Instead of a fixed set of 4-6 reference images, we maintain a scored pool:

**Table: `reference_images`**

```sql
CREATE TABLE public.reference_images (
  id TEXT PRIMARY KEY,                    -- filename or hash
  category TEXT NOT NULL,                 -- 'logo' | 'product_screenshot' | 'invitation' | 'brand_asset' | 'winning_creative'
  description TEXT,                       -- human-readable: "Mobile homepage — Your Event Handled"
  file_path TEXT,                         -- local or Supabase Storage path
  image_url TEXT,                         -- public URL for API access
  embedding VECTOR(768),                  -- Gemini Embedding 2 vector
  usage_count INTEGER DEFAULT 0,         -- how many times used as reference
  win_count INTEGER DEFAULT 0,           -- how many outputs became winners
  lose_count INTEGER DEFAULT 0,          -- how many outputs became losers
  win_rate FLOAT GENERATED ALWAYS AS (
    CASE WHEN usage_count > 0 THEN win_count::float / usage_count ELSE 0 END
  ) STORED,
  avg_output_cpa FLOAT,                  -- average CPA of creatives generated with this reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ
);
```

### Reference Categories

| Category | What | Examples | Max per generation |
|---|---|---|:---:|
| **logo** | Brand mark | Full logo, icon-only | 1 |
| **product_screenshot** | What Invitfull looks like | Homepage, event page, RSVP dashboard, mobile view, creation flow | 2-4 |
| **invitation** | Example output designs | Baby shower invites, themed designs | 1-2 |
| **brand_asset** | Style guide elements | Values page, color palette, typography | 0-1 |
| **winning_creative** | Previous winning ads | Used as "generate more like this" | 0-2 |

**Total reference images per generation: 4-8** (Gemini supports up to 14, but more isn't always better — quality over quantity)

### Reference Selection Algorithm

When the agent decides to generate a creative, it selects references using this algorithm:

```
function selectReferences(target_embedding, generation_type):

  # 1. Always include the logo (mandatory)
  refs = [best_performing_logo]

  # 2. Select product screenshots by:
  #    a. Win rate (which screenshots correlate with winners?)
  #    b. Embedding proximity to target (which screenshots steer output toward target?)
  screenshots = reference_images.where(category = 'product_screenshot')

  for each screenshot:
    screenshot.score = (
      screenshot.win_rate × 0.50                           # 50% weight: does this reference produce winners?
      + cosine_similarity(screenshot.embedding, target) × 0.30  # 30% weight: is this reference close to where we want the output?
      + (1 / (screenshot.usage_count + 1)) × 0.20          # 20% weight: freshness bonus for underused references
    )

  refs += top_2_screenshots_by_score

  # 3. Select invitation example (if branded format)
  if generation_type in ['branded', 'product_demo']:
    invitations = reference_images.where(category = 'invitation')
    refs += top_1_invitation_by_win_rate

  # 4. Optionally include a winning creative as reference (for "more like this")
  if generation_type == 'winner_variation':
    refs += the_winning_creative_we_are_varying

  return refs  # 4-7 images total
```

### Reference Attribution Tracking

Every generation records which references were used:

**Table: `generation_runs`**

```sql
CREATE TABLE public.generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE DEFAULT CURRENT_DATE,
  generation_type TEXT,               -- 'winner_variation' | 'adjacent_exploration' | 'wild_card'
  target_description TEXT,            -- "branded product ad near winner cluster"
  target_embedding VECTOR(768),       -- where we wanted the output to land

  -- Inputs
  inspiration_id TEXT,                -- which inspiration image was used
  inspiration_embedding VECTOR(768),
  reference_ids TEXT[],               -- which reference images were selected
  system_instruction_hash TEXT,       -- hash of the dynamic system instruction used

  -- Output
  output_path TEXT,                   -- file path of generated creative
  output_embedding VECTOR(768),       -- embedding of the actual output
  output_composite_score FLOAT,       -- scoring result
  output_distance_to_target FLOAT,    -- how close did we get to the target?

  -- Outcome (updated later)
  ad_id TEXT,                         -- Meta ad ID if uploaded
  final_status TEXT,                  -- WINNER | LOSER | LEARNING | REJECTED
  final_cpa FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

This table is the learning engine. After enough data, we can answer:
- "Which reference + inspiration combos produce winners?"
- "Which system instruction variants lead to lower CPA?"
- "How accurately can we predict output embedding from input embeddings?"

---

## 12.2: Inspiration Image Intelligence

### The Inspiration Pool

All inspiration images (competitor ads, style references, new angles) get embedded and scored:

**Table: `inspiration_images`**

```sql
CREATE TABLE public.inspiration_images (
  id TEXT PRIMARY KEY,
  source TEXT,                         -- 'canva' | 'manychat' | 'staticflow' | 'anthropic' | 'openai' | 'zapier' | 'competitor' | 'custom'
  description TEXT,
  file_path TEXT,
  image_url TEXT,
  embedding VECTOR(768),
  usage_count INTEGER DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  lose_count INTEGER DEFAULT 0,
  win_rate FLOAT GENERATED ALWAYS AS (
    CASE WHEN usage_count > 0 THEN win_count::float / usage_count ELSE 0 END
  ) STORED,
  similarity_to_winner_centroid FLOAT,  -- updated when centroids change
  similarity_to_loser_centroid FLOAT,
  relevance_score FLOAT,               -- composite score for this inspiration
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Inspiration Selection Algorithm

```
function selectInspirations(generation_brief):

  for each inspiration in pool:
    # Score based on what we're trying to generate
    if brief.type == 'winner_variation':
      # Want inspirations close to winner cluster
      score = similarity_to_winner_centroid × 0.60
            + (1 - similarity_to_loser_centroid) × 0.20
            + win_rate × 0.20

    elif brief.type == 'adjacent_exploration':
      # Want inspirations moderately close to winners but in new territory
      score = similarity_to_winner_centroid × 0.30
            + distance_from_all_tested_inspirations × 0.40
            + (1 - similarity_to_loser_centroid) × 0.30

    elif brief.type == 'wild_card':
      # Want inspirations far from everything we've tried
      score = distance_from_all_tested_inspirations × 0.70
            + (1 - similarity_to_loser_centroid) × 0.30

  return top_inspirations_by_score
```

---

## 12.3: Dynamic System Instruction Construction

### The Problem with Static Instructions

Our current system instruction (`baby-shower/system_instruction.md`) is the same for every generation. It says "recreate this ad for Invitfull" regardless of whether we're generating a branded product ad or an authentic social proof post.

### The Solution: Modular Instruction Assembly

The agent constructs the system instruction from building blocks based on:
- What format type it wants (branded, authentic, comparison, etc.)
- What the embedding analysis says about winning patterns
- What specific visual/copy elements to include or avoid

### Instruction Template Structure

```
SYSTEM INSTRUCTION = [
  ROLE_BLOCK           (always included — who you are)
  REFERENCE_BLOCK      (dynamically built — describes each reference image)
  PRODUCT_BLOCK        (always included — what Invitfull is)
  FORMAT_BLOCK         (selected based on target format type)
  EMBEDDING_BLOCK      (dynamically built — what patterns win/lose)
  WORKFLOW_BLOCK       (always included — generation steps)
  CONSTRAINTS_BLOCK    (dynamically built — what to avoid)
]
```

### Block Definitions

**ROLE_BLOCK** (static):
```markdown
# ROLE
You are an ad creative designer for Invitfull. You receive reference images
and an inspiration ad, and recreate it for Invitfull. Output a finished ad image.
```

**REFERENCE_BLOCK** (dynamic — built by agent based on selected references):
```markdown
# REFERENCE IMAGES
You receive these images in order:

1. **Invitfull logo** — paste exactly as-is. Never redraw.
2. **Product screenshot: Mobile homepage** — shows "Your event. Handled." page.
   This screenshot has a 72% win rate as a reference. Feature it prominently.
3. **Product screenshot: RSVP dashboard** — shows guest tracking.
   Include only if the ad format has room for multiple screens.
4. **Invitation example: Woodland baby shower** — real Invitfull design output.
5. **Ad inspiration** (last) — recreate this layout for Invitfull.

Priority: Inspiration controls layout. Product screenshots are the hero visual.
Logo goes in exactly as-is.
```

**FORMAT_BLOCK** (selected by agent — one of these):

```markdown
# FORMAT: BRANDED PRODUCT AD
- Logo visible, product screenshots as hero visual
- Match brand colors from screenshots (green, cream, dark red)
- Include CTA button text
- Real photorealistic people — never cartoon
- Show the product on a device (phone or laptop)
```

```markdown
# FORMAT: AUTHENTIC SOCIAL PROOF
- NO logo, NO product screenshots, NO brand colors
- Flat screenshot of a social platform (Twitter, LinkedIn, iMessage, Facebook group)
- Must look like a real organic post by a real person
- Mention "Invitfull" by name in the text
- Casual voice, lowercase, specific details
```

```markdown
# FORMAT: COMPARISON AD
- Split layout: competitor/old way vs Invitfull
- Use checkmarks vs X marks, or side-by-side
- Specific feature comparisons (not generic)
- Price anchoring: "$15+ per event" vs "$0 forever"
```

```markdown
# FORMAT: TESTIMONIAL / QUOTE CARD
- Speech bubble or quote marks
- Photo of a real person (not stock-looking)
- Specific details about their baby shower experience
- Product screenshot shown alongside
```

```markdown
# FORMAT: STORY / UGC STYLE
- Vertical 9:16 format
- Speech bubbles or text overlays in sequence
- First-person narrative
- Casual, relatable tone
- Phone-recorded aesthetic
```

**EMBEDDING_BLOCK** (dynamic — built from creative DNA analysis):
```markdown
# CREATIVE INTELLIGENCE

Based on performance data, these patterns WIN:
- Phone mockups showing the Invitfull homepage (avg CPA $2.10)
- Bold "FREE" or "$0" text as dominant element (avg CPA $2.30)
- Real pregnant women in lifestyle settings (avg CPA $2.40)
- Comparison layouts with checkmarks (avg CPA $2.50)

These patterns LOSE — AVOID:
- Generic testimonial text on plain backgrounds (avg CPA $5.20)
- Cluttered layouts with too many screenshots (avg CPA $4.80)
- Stock-photo-looking people without context (avg CPA $4.50)

The output creative should be visually DIFFERENT from these currently active ads:
- [brief description of active ad 1]
- [brief description of active ad 2]
- [etc.]
```

**CONSTRAINTS_BLOCK** (dynamic — includes standard rules + data-driven rules):
```markdown
# CONSTRAINTS

Standard:
- USE THE LOGO EXACTLY AS PROVIDED — NEVER REDRAW
- PRODUCT IS DIGITAL — NEVER SHOW PRINTED CARDS OR PHYSICAL MAIL
- USE REAL PHOTOREALISTIC PEOPLE — NEVER CARTOON
- "BABY SHOWER" MUST APPEAR IN THE AD
- "FREE" AND "AD-FREE" MUST APPEAR — AS A SELLING POINT, NOT THE ENTIRE MESSAGE
- DO NOT RENDER ANY LABELS, TAG NAMES, OR INSTRUCTION TEXT

Data-driven:
- DO NOT use plain white/gray backgrounds (0% win rate in 12 tests)
- DO include the Invitfull interface on a phone screen (68% win rate)
- DO NOT write more than 15 words in the headline area (long headlines: 0/8 wins)
- DO include at least one real person in the image (person present: 45% win rate vs 12% without)
```

### Instruction Assembly Function

```javascript
function buildSystemInstruction(brief, embeddingAnalysis, referenceSet) {
  const blocks = [];

  // Always included
  blocks.push(ROLE_BLOCK);

  // Dynamic reference block — describes each selected reference image
  blocks.push(buildReferenceBlock(referenceSet));

  // Always included
  blocks.push(PRODUCT_BLOCK);

  // Selected based on agent's format decision
  blocks.push(FORMAT_BLOCKS[brief.format_type]);

  // Dynamic — built from winner/loser pattern analysis
  if (embeddingAnalysis.hasEnoughData) {
    blocks.push(buildEmbeddingBlock(embeddingAnalysis));
  }

  // Always included
  blocks.push(WORKFLOW_BLOCK);

  // Dynamic — standard + data-driven constraints
  blocks.push(buildConstraintsBlock(embeddingAnalysis));

  return blocks.join('\n\n---\n\n');
}
```

---

## 12.4: The Contents Array (What Gets Sent to Gemini)

Gemini's image generation API takes a `contents` array — interleaved text labels and images. The agent builds this dynamically:

```javascript
function buildContents(referenceSet, inspirationImage, brief) {
  const contents = [];

  // 1. Logo (always first)
  contents.push("This is the Invitfull brand logo. Paste this exact image into the ad:");
  contents.push(Image.open(referenceSet.logo));

  // 2. Product screenshots (selected by attribution score)
  for (const [i, screenshot] of referenceSet.screenshots.entries()) {
    contents.push(
      `Invitfull product screenshot ${i+1} (win rate: ${screenshot.win_rate}%). ` +
      `Show this prominently. Match these colors and design language:`
    );
    contents.push(Image.open(screenshot.path));
  }

  // 3. Invitation examples (if applicable for this format)
  if (brief.format_type !== 'authentic') {
    for (const [i, invitation] of referenceSet.invitations.entries()) {
      contents.push(`Example invitation design ${i+1} — can be featured in the ad:`);
      contents.push(Image.open(invitation.path));
    }
  }

  // 4. Winning creative reference (if generating variations)
  if (brief.type === 'winner_variation' && referenceSet.winnerRef) {
    contents.push(
      "This is a WINNING ad creative (CPA: $" + referenceSet.winnerRef.cpa + "). " +
      "Generate a variation that keeps the same energy but with a different angle:"
    );
    contents.push(Image.open(referenceSet.winnerRef.path));
  }

  // 5. Inspiration image (ALWAYS LAST — model adopts its layout/aspect ratio)
  contents.push(
    "Ad inspiration — recreate this ad's layout for Invitfull using the " +
    "product screenshots and branding above:"
  );
  contents.push(Image.open(inspirationImage.path));

  // 6. Final instruction
  contents.push(brief.final_instruction);

  return contents;
}
```

### Label Best Practices (from Gemini research)

1. **Label BEFORE each image, not after** — model processes sequentially
2. **No bracket tags** — model may render `[LOGO]` literally in the output
3. **State the role of each image** — "This is the brand logo" vs just "Logo:"
4. **Include performance context** — "This screenshot has a 72% win rate" helps the model weight it
5. **Inspiration image ALWAYS LAST** — model adopts the layout/aspect ratio of the last image
6. **4-8 reference images total** — more than 10 degrades quality (context overload)
7. **Keep text labels concise** — don't write paragraphs between images

---

## 12.5: The Generation API Call

### Model Configuration

```javascript
const response = client.models.generate_content({
  model: "gemini-3-pro-image-preview",
  contents: contents,                          // built by buildContents()
  config: {
    response_modalities: ["IMAGE", "TEXT"],
    system_instruction: systemInstruction,      // built by buildSystemInstruction()
    temperature: 1.0,                           // Google strongly recommends default
    image_config: {
      aspect_ratio: detectAspectRatio(inspirationImage),  // match inspiration
      image_size: "4K",                         // maximum quality
    },
  },
});
```

### Why These Settings

| Parameter | Value | Reason |
|---|---|---|
| model | `gemini-3-pro-image-preview` | Best quality, supports system instructions, mandatory thinking step |
| temperature | 1.0 | Google warns other values cause "looping or degraded performance" |
| aspect_ratio | detected from inspiration | Matches the intended platform placement (9:16 for stories, 1:1 for feed) |
| image_size | 4K | Maximum resolution — can always downscale, can't upscale |
| response_modalities | IMAGE + TEXT | Sometimes the model explains what it did — useful for debugging |

---

## 12.6: Output Validation Pipeline

Every generated creative goes through this pipeline before being approved:

### Step 1: Embed the Output

```javascript
const outputEmbedding = await embedCreative(outputImagePath, {
  text: brief.headline + " " + brief.primary_text  // embed with the ad copy too
});
```

### Step 2: Compute Scores

```javascript
const scores = {
  // How close to our target?
  target_distance: cosineDistance(outputEmbedding, brief.target_embedding),

  // How close to winner cluster?
  relevance: cosineSimilarity(outputEmbedding, winner_centroid),

  // How close to loser cluster?
  danger: cosineSimilarity(outputEmbedding, loser_centroid),

  // Will Andromeda suppress it?
  max_similarity_to_active: Math.max(
    ...activeAds.map(ad => cosineSimilarity(outputEmbedding, ad.embedding))
  ),

  // How different from other candidates in this batch?
  min_distance_to_batch: Math.min(
    ...otherCandidates.map(c => cosineDistance(outputEmbedding, c.embedding))
  ),

  // Composite
  composite: computeCompositeScore(outputEmbedding, winner_centroid, loser_centroid, activeAds),
};
```

### Step 3: Decision Gate

```
IF composite_score > 0.70 AND max_similarity_to_active < 0.60:
  → APPROVE — flag for human review

IF composite_score > 0.55 AND max_similarity_to_active < 0.60:
  → CONDITIONAL — approve only if no better candidates available

IF composite_score < 0.55 OR max_similarity_to_active > 0.60:
  → REJECT — too similar to active ads or too close to loser patterns
  → Regenerate with different inspiration or references
```

### Step 4: Record Everything

```javascript
await saveGenerationRun({
  generation_type: brief.type,
  target_embedding: brief.target_embedding,
  inspiration_id: inspiration.id,
  reference_ids: referenceSet.map(r => r.id),
  system_instruction_hash: hash(systemInstruction),
  output_embedding: outputEmbedding,
  output_composite_score: scores.composite,
  output_distance_to_target: scores.target_distance,
  // ad_id and final_status updated later when uploaded and tested
});
```

---

## 12.7: The Agent's Generation Decision Flow

When the daily agent runs and determines new creatives are needed:

```
1. CHECK INVENTORY
   - How many reserve creatives remain?
   - How many ABO slots are empty (from kills/graduations)?
   - How many creatives needed? = empty_slots + (reserves_needed - reserves_available)

2. DEFINE GENERATION BRIEF
   Apply 60-30-10 rule:
   - 60% of needed → type: 'winner_variation'
     Target: 0.30-0.55 similarity to winner centroid
     Inspiration: high-scoring inspirations near winner cluster
     References: highest win-rate screenshots + winner creative as ref

   - 30% of needed → type: 'adjacent_exploration'
     Target: 0.20-0.40 similarity to winner centroid
     Inspiration: mid-scoring inspirations in untested regions
     References: diverse screenshots to broaden output

   - 10% of needed → type: 'wild_card'
     Target: any region >0.40 distance from winner AND loser centroid
     Inspiration: lowest-tested, most novel inspirations
     References: minimal set (logo + 1 screenshot only)

3. FOR EACH CREATIVE NEEDED:
   a. Select inspiration image (by scoring algorithm)
   b. Select reference images (by attribution + embedding proximity)
   c. Build system instruction (modular assembly from blocks)
   d. Build contents array (interleaved labels + images)
   e. Call Gemini API
   f. Embed output
   g. Score output
   h. Accept or reject → if rejected, retry with different inspiration
   i. Record the full generation run

4. FLAG APPROVED CREATIVES FOR HUMAN REVIEW
   - Save to `generations-auto/{date}/` directory
   - Include scores and reasoning in the daily report
   - Human reviews and approves/rejects before upload to Meta
```

---

## 12.8: Learning and Improvement

### After Each Testing Cycle (7-10 days)

When ads are classified (WINNER/LOSER):

```
1. UPDATE GENERATION RUNS
   - Fill in final_status and final_cpa for each generation run
   - We now know: these inputs → this output → this result

2. UPDATE REFERENCE ATTRIBUTION
   - For each reference image used in winning generation → increment win_count
   - For each reference image used in losing generation → increment lose_count
   - Recalculate win_rate for all references

3. UPDATE INSPIRATION SCORES
   - Same win/lose attribution for inspiration images
   - Recalculate relevance_score for all inspirations

4. RECALCULATE CENTROIDS
   - Winner centroid = mean of all winner embeddings
   - Loser centroid = mean of all loser embeddings

5. UPDATE COMPOSITE SCORE WEIGHTS (monthly)
   - Backtest: which weight combination best predicts winners?
   - Adjust relevance, danger, suppression, diversity weights

6. UPDATE CONSTRAINT BLOCKS
   - Analyze which visual elements appear in winners vs losers
   - Add new data-driven constraints to the instruction builder

7. REPORT
   - "Reference Image A: 5 wins / 8 uses = 63% win rate (↑12% from last week)"
   - "Inspiration Source 'Canva': 2 wins / 10 uses = 20% (below average)"
   - "System instruction variant 'branded_with_comparison' outperforms 'branded_simple' by 40%"
```

### The Flywheel Effect

```
Week 1:  Random references, random inspirations, static instruction
         → 15% win rate (industry average)

Week 4:  Scored references, scored inspirations, format-specific instructions
         → 20% win rate

Week 8:  Attribution-optimized references, embedding-targeted inspirations,
         data-driven constraints in instructions
         → 30% win rate

Week 16: Full feedback loop, predictive scoring, automatic quality gates
         → 40%+ win rate
         → 2x industry average
         → Half the generation cost (fewer rejected candidates)
```

---

# PART 13: GLOSSARY

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
| **Reference image pool** | Scored collection of brand assets the agent selects from per generation |
| **Reference attribution** | Tracking which reference images correlate with winning outputs |
| **Inspiration scoring** | Ranking inspiration images by predicted win probability via embedding proximity |
| **Generation run** | Complete record of inputs, instruction, output, and score for one generation |
| **Dynamic instruction** | System instruction assembled from modular blocks based on data |
| **Contents array** | Interleaved text labels + images sent to Gemini's generation API |
| **Output validation** | Embedding + scoring pipeline that gates generated creatives before approval |
| **Feedback loop** | Process of updating scores, attributions, and centroids after performance data arrives |

---

*Blueprint v1.1 — March 24, 2026. Created by Claude Opus 4.6 for Invitfull.*
*Added: Part 12 (Intelligent Generation Engine) — reference architecture, inspiration scoring, dynamic instructions, output validation, learning system.*
*Next review: April 24, 2026.*

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
