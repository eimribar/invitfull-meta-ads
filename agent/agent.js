/**
 * Invitfull Meta Ads Autonomous AI Agent
 *
 * Uses Claude Opus 4.6 with tool use to autonomously:
 * 1. Pull Meta Ads data
 * 2. Analyze performance
 * 3. Make and execute optimization decisions
 * 4. Generate and upload new creatives
 * 5. Email daily report
 *
 * Usage:
 *   node agent.js              # Full autonomous run
 *   DRY_RUN=1 node agent.js    # Analysis only, no actions
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toolDefinitions, createToolExecutor } from './tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const DRY_RUN = !!process.env.DRY_RUN;
const today = new Date().toISOString().slice(0, 10);

// ─── Config ───────────────────────────────────────────────────────
const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicKey) {
  console.error('ERROR: Set ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

const config = {
  metaToken: process.env.META_ACCESS_TOKEN || readFileSync(join(__dirname, '..', 'scripts', '.meta_token'), 'utf8').trim(),
  mailtrapToken: process.env.MAILTRAP_API_TOKEN || '',
  supabaseUrl: process.env.SUPABASE_URL || 'https://yhrifwcqwluhbhwquxqn.supabase.co',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  dryRun: DRY_RUN,
};

const client = new Anthropic({ apiKey: anthropicKey });
const executeTool = createToolExecutor(config);

// ─── Strategy context (loaded from file) ──────────────────────────
const strategyPath = join(__dirname, '..', 'docs', 'META_ADS_STRATEGY.md');
const strategy = existsSync(strategyPath) ? readFileSync(strategyPath, 'utf8') : '';

// ─── System prompt ────────────────────────────────────────────────
const systemPrompt = `You are the Invitfull Meta Ads AI Optimizer. You run autonomously every day to analyze ad performance, make strategic decisions, and execute them.

## Your Tools
You have tools to: pull Meta data, pause/activate ads, update budgets, create CBO campaigns, graduate winners, upload new creatives, send email reports, and save/load state.

## Context
${strategy ? 'Strategy document loaded. Key points:' : 'No strategy doc found.'}
- ABO testing campaign: 10 ad sets × $20/day × 2 creatives = 20 ads, $200/day
- Target CPA: $3.00
- Baby shower is the monetization channel
- Ads launched March 23-24, 2026
- Phase 2 (CBO scaling) triggers when 5+ winners confirmed
- Primary metric: complete_registration in the actions array

## Analysis Rules
DO NOT flag as issues:
- Ads with 0 impressions in first 48 hours — normal with $200/day across 20 ads
- 0 registrations with low page views — funnel is click → page view → sign up → registration (20-30% CVR)
- Duplicate filenames — check image hash, not filename
- Low spend on Day 1-3 — algorithm is learning

DO flag:
- Ads with 0 impressions after 7+ days
- Ads with $16+ spend and 0 conversions
- CTR/CPM trends over 3+ consecutive days (fatigue)

## Classification
- WINNER: 5+ conversions, CPA ≤ $3.00, high confidence
- LIKELY_WINNER: promising but needs more data
- LOSER: $16+ spent with 0 conversions, or statistically hopeless
- FATIGUING: declining CTR + rising CPM over 3+ days
- LEARNING: not enough data yet

## Workflow
1. Pull campaign data
2. Load previous state (creative DNA, optimization log)
3. Analyze each ad with judgment — consider patterns, formats, trends
4. Execute decisions: pause losers, graduate winners if ready
5. If Phase 2 ready (5+ winners): create CBO, graduate all winners, reduce ABO
6. Save state
7. Send email report

## Creative Embeddings (Gemini Embedding 2)
You have access to Gemini Embedding 2 for creative intelligence:
- **embed_creative**: Generate a 768-dim embedding for any creative image. Store it with save_state.
- **compare_creatives**: Cosine similarity between creatives. >0.6 = Andromeda suppression risk.
- **find_most_diverse_set**: Pick the N most diverse creatives from a pool.

Use embeddings to:
1. Build a creative DNA database — embed every new creative
2. When replacing killed/graduated ads, pick replacements MOST DIFFERENT from active ads
3. Flag any two active ads with >60% similarity (Andromeda Entity ID suppression)
4. Track which visual patterns correlate with winning (low CPA) vs losing

## Rules
- Be conservative before March 30 (learning phase) — NO actions except obvious losers ($16+ spend, 0 conv)
- After day 7, be decisive
- Always explain your reasoning
- ${DRY_RUN ? 'DRY RUN MODE — analyze and report but do NOT execute any actions' : 'LIVE MODE — execute decisions'}
- Today is ${today}`;

// ─── Agentic loop ─────────────────────────────────────────────────
async function runAgent() {
  console.log(`=== Invitfull Meta Ads AI Agent ===${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`Date: ${today}`);
  console.log(`Model: claude-opus-4-6\n`);

  const messages = [
    {
      role: 'user',
      content: `It's ${today}. Run your daily optimization cycle. Start by pulling campaign data for the ABO testing campaign (ID: 52527087644338), then load previous state, analyze everything, make decisions, execute them, and send the report.`,
    },
  ];

  let iterations = 0;
  const maxIterations = 20; // safety limit

  while (iterations < maxIterations) {
    iterations++;
    console.log(`\n--- Iteration ${iterations} ---`);

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      system: systemPrompt,
      tools: toolDefinitions,
      messages,
    });

    // Process response
    const toolResults = [];
    let hasToolUse = false;
    let finalText = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
        console.log(block.text);
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        console.log(`\n  → Calling: ${block.name}`);

        try {
          const result = await executeTool(block.name, block.input);
          const resultStr = JSON.stringify(result);
          console.log(`  ← Result: ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultStr.length > 50000
              ? JSON.stringify({ ...result, _truncated: true, _originalLength: resultStr.length })
              : resultStr,
          });
        } catch (e) {
          console.log(`  ← Error: ${e.message}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: e.message }),
            is_error: true,
          });
        }
      }
    }

    // If no tool use, agent is done
    if (!hasToolUse) {
      console.log('\n=== Agent completed ===');
      break;
    }

    // Add assistant response and tool results to messages
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    // Check stop reason
    if (response.stop_reason === 'end_turn') {
      console.log('\n=== Agent completed (end_turn) ===');
      break;
    }
  }

  if (iterations >= maxIterations) {
    console.log('\n=== Agent hit max iterations ===');
  }

  console.log(`\nTotal iterations: ${iterations}`);
}

runAgent().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
