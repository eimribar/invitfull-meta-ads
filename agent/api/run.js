/**
 * Vercel Serverless Function — triggers the Meta Ads AI Agent
 * Endpoint: /api/run
 * Cron: daily at 6:00 UTC (8:00 AM Israel)
 */

import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, createToolExecutor } from '../tools.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const today = new Date().toISOString().slice(0, 10);

// Strategy doc (bundled at deploy time)
const strategyPath = join(__dirname, '..', '..', 'docs', 'META_ADS_STRATEGY.md');
const strategy = existsSync(strategyPath) ? readFileSync(strategyPath, 'utf8') : '';

const systemPrompt = `You are the Invitfull Meta Ads AI Optimizer. You run autonomously every day to analyze ad performance, make strategic decisions, and execute them.

## Your Tools
You have tools to: pull Meta data, pause/activate ads, update budgets, create CBO campaigns, graduate winners, upload new creatives, send email reports, and save/load state.

## Strategy
${strategy.substring(0, 8000)}

## Key Context
- ABO testing campaign: 10 ad sets × $20/day × 2 creatives = 20 ads, $200/day
- Target CPA: $3.00
- Baby shower is the monetization channel
- Ads launched March 23-24, 2026
- Phase 2 (CBO scaling) triggers when 5+ winners confirmed
- Primary metric: complete_registration

## Analysis Rules
DO NOT flag: 0 impressions in first 48h, 0 registrations with low page views, duplicate filenames (check hash), low spend Day 1-3.
DO flag: 0 impressions after 7+ days, $16+ spend with 0 conversions, 3+ day CTR/CPM trends.

## Classification
- WINNER: 5+ conv, CPA ≤ $3.00, high confidence
- LIKELY_WINNER: promising, needs data
- LOSER: $16+ spent 0 conv, or statistically hopeless
- FATIGUING: declining CTR + rising CPM 3+ days
- LEARNING: not enough data

## Rules
- Conservative before March 30
- After day 7, be decisive
- Today is ${today}`;

export const maxDuration = 300; // 5 minutes

export default async function handler(req, res) {
  // Verify cron secret or manual trigger
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const config = {
    metaToken: process.env.META_ACCESS_TOKEN,
    mailtrapToken: process.env.MAILTRAP_API_TOKEN,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    dryRun: process.env.DRY_RUN === '1',
  };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const executeTool = createToolExecutor(config);

  const messages = [{
    role: 'user',
    content: `It's ${today}. Run your daily optimization cycle. Pull campaign data for ABO campaign 52527087644338, load previous state, analyze, decide, execute, and send the report.`,
  }];

  let iterations = 0;
  const maxIterations = 15;
  let finalSummary = '';

  try {
    while (iterations < maxIterations) {
      iterations++;
      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        system: systemPrompt,
        tools: toolDefinitions,
        messages,
      });

      const toolResults = [];
      let hasToolUse = false;

      for (const block of response.content) {
        if (block.type === 'text') finalSummary = block.text;
        if (block.type === 'tool_use') {
          hasToolUse = true;
          try {
            const result = await executeTool(block.name, block.input);
            const resultStr = JSON.stringify(result);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: resultStr.length > 50000
                ? JSON.stringify({ _truncated: true, _len: resultStr.length, summary: 'Data pulled successfully' })
                : resultStr,
            });
          } catch (e) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: e.message }),
              is_error: true,
            });
          }
        }
      }

      if (!hasToolUse || response.stop_reason === 'end_turn') break;

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    return res.status(200).json({
      success: true,
      date: today,
      iterations,
      summary: finalSummary.substring(0, 500),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
