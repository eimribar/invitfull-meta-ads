/**
 * Invitfull Meta Ads Daily Digest & Auto-Optimizer
 *
 * Pulls Meta Ads data, classifies ads (Bayesian), auto-pauses losers,
 * auto-graduates winners to CBO, generates creative DNA analysis,
 * predicts fatigue, monitors competitors, and delivers reports.
 *
 * Usage:
 *   node meta-daily-digest.js              # Full run with auto-actions
 *   node meta-daily-digest.js --dry-run    # Report only, no actions
 *   node meta-daily-digest.js --no-email   # Skip email delivery
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

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

// ─── Config ───────────────────────────────────────────────────────────
const TOKEN = readFileSync(join(__dirname, 'scripts', '.meta_token'), 'utf8').trim();
const AD_ACCOUNT = 'act_104007129';
const API = 'https://graph.facebook.com/v22.0';
const PAGE_ID = '917868684732619';
const PIXEL_ID = '1398381481388085';

const CONFIG = {
  aboTesting: {
    campaignId: '52527087644338',
    name: 'Baby Shower — ABO Testing — March 2026',
  },
  cboScaling: {
    campaignId: null, // auto-created when 5+ winners
    name: 'Invitfull — CBO Scaling',
    configFile: join(__dirname, 'cbo-config.json'),
  },
  rules: {
    winnerMinConversions: 5,
    winnerMaxCPA: 3.00,
    winnerConfidence: 0.90,    // Bayesian P(CPA ≤ target) threshold
    loserMinSpend: 16.00,
    loserConfidence: 0.10,     // P(CPA ≤ target) below this = loser
    loserMinDays: 7,
    fatigueThreshold: 60,      // fatigue score 0-100
    phase2WinnerThreshold: 5,
    cboBudgetCents: 14000,
    aboBudgetReducedCents: 6000,
  },
  reserveDir: join(__dirname, 'baby-shower', 'reserve'),
  generationsAutoDir: join(__dirname, 'baby-shower', 'generations-auto'),
  reportsDir: join(__dirname, 'reports'),
  landingPage: 'https://invitfull.com/baby-shower',
  competitors: ['Paperless Post', 'Evite', 'Canva', 'Punchbowl', 'Greetings Island', 'Greenvelope'],
};

// Load CBO config if exists
if (existsSync(CONFIG.cboScaling.configFile)) {
  const cboConf = JSON.parse(readFileSync(CONFIG.cboScaling.configFile, 'utf8'));
  CONFIG.cboScaling.campaignId = cboConf.campaignId;
}

const DRY_RUN = process.argv.includes('--dry-run');
const NO_EMAIL = process.argv.includes('--no-email');
const today = new Date().toISOString().slice(0, 10);
const actions = [];
const warnings = [];

// ─── Meta API ─────────────────────────────────────────────────────────
async function metaGet(path, params = {}) {
  params.access_token = TOKEN;
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${API}${path}?${qs}`);
  const d = await r.json();
  if (d.error) throw new Error(`Meta API: ${d.error.message}`);
  return d;
}

async function metaGetAll(path, params = {}) {
  let all = [];
  let resp = await metaGet(path, params);
  all.push(...(resp.data || []));
  while (resp.paging?.next) {
    const r = await fetch(resp.paging.next);
    resp = await r.json();
    if (resp.error) break;
    all.push(...(resp.data || []));
  }
  return all;
}

async function metaPost(path, data = {}) {
  data.access_token = TOKEN;
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  });
  return r.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────
const getAction = (actions, type) => parseFloat(actions?.find(a => a.action_type === type)?.value || '0');
const money = v => '$' + parseFloat(v).toFixed(2);
const pad = (s, n) => String(s).padStart(n);
const padr = (s, n) => String(s).padEnd(n);

function dateDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Bayesian Statistical Significance ────────────────────────────────
// Beta CDF using incomplete beta function approximation
function logBeta(a, b) {
  // Stirling's approximation for log(Gamma)
  function logGamma(z) {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    z -= 1;
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function betaCDF(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Continued fraction approximation (Lentz's method)
  const maxIter = 200;
  const eps = 1e-10;
  const lbeta = logBeta(a, b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

  // Use the continued fraction
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= maxIter; i++) {
    let m = Math.floor(i / 2);
    let numerator;
    if (i === 0) {
      numerator = 1;
    } else if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    }
    d = 1 + numerator * d;
    if (Math.abs(d) < eps) d = eps;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < eps) c = eps;
    f *= c * d;
    if (Math.abs(c * d - 1) < eps) break;
  }
  return front * (f - 1);
}

function bayesianWinProbability(clicks, conversions, avgCPC, targetCPA) {
  if (clicks < 5) return 0.5; // not enough data
  const alpha = 1 + conversions;
  const beta_param = 1 + clicks - conversions;
  // P(CPA ≤ target) = P(CVR ≥ CPC/target)
  const targetCVR = avgCPC / targetCPA;
  if (targetCVR >= 1) return 0;
  if (targetCVR <= 0) return 1;
  return 1 - betaCDF(targetCVR, alpha, beta_param);
}

// ─── Fatigue Predictor ────────────────────────────────────────────────
function linearSlope(values) {
  const n = values.length;
  if (n < 3) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function computeFatigueScore(dailyData) {
  if (dailyData.length < 3) return 0;
  const last5 = dailyData.slice(-5);
  let score = 0;

  // CTR declining (0-25)
  const ctrs = last5.map(d => d.ctr);
  const ctrSlope = linearSlope(ctrs);
  if (ctrSlope < 0) score += Math.min(25, Math.abs(ctrSlope) * 1000);

  // CPM rising (0-25)
  const cpms = last5.map(d => d.cpm);
  const cpmSlope = linearSlope(cpms);
  if (cpmSlope > 0) score += Math.min(25, cpmSlope * 10);

  // CVR declining (0-25)
  const cvrs = last5.map(d => d.cvr);
  const cvrSlope = linearSlope(cvrs);
  if (cvrSlope < 0) score += Math.min(25, Math.abs(cvrSlope) * 500);

  // Frequency (0-25)
  const freq = last5[last5.length - 1]?.frequency || 0;
  if (freq > 2) score += Math.min(25, (freq - 2) * 12.5);

  return Math.min(100, Math.round(score));
}

// ─── Data Pulling ─────────────────────────────────────────────────────
async function pullCampaigns() {
  console.log('Pulling campaigns...');
  return metaGetAll(`/${AD_ACCOUNT}/campaigns`, {
    fields: 'name,status,effective_status,daily_budget,objective,created_time',
    filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
    limit: '50',
  });
}

async function pullAdSetInsights(campaignId, since, until) {
  console.log(`Pulling ad set insights (${since} to ${until})...`);
  return metaGetAll(`/${campaignId}/insights`, {
    fields: 'adset_name,adset_id,spend,impressions,clicks,actions,ctr,cpc,cpm,reach,frequency',
    level: 'adset',
    time_range: JSON.stringify({ since, until }),
    limit: '100',
  });
}

async function pullAdInsights(campaignId, since, until) {
  console.log(`Pulling ad insights (${since} to ${until})...`);
  return metaGetAll(`/${campaignId}/insights`, {
    fields: 'ad_name,ad_id,adset_name,adset_id,spend,impressions,clicks,actions,ctr,cpc,cpm,reach,frequency',
    level: 'ad',
    time_range: JSON.stringify({ since, until }),
    limit: '200',
  });
}

async function pullAdDailyBreakdown(campaignId, since, until) {
  console.log(`Pulling daily ad breakdown (${since} to ${until})...`);
  return metaGetAll(`/${campaignId}/insights`, {
    fields: 'ad_name,ad_id,spend,impressions,clicks,actions,ctr,cpc,cpm,frequency',
    level: 'ad',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '500',
  });
}

async function pullAdStatuses(campaignId) {
  console.log('Pulling ad statuses...');
  return metaGetAll(`/${campaignId}/ads`, {
    fields: 'name,status,effective_status,creative{id,effective_object_story_id,image_url,object_story_spec},created_time',
    limit: '100',
  });
}

// ─── Ad Classification ───────────────────────────────────────────────
function classifyAd(ad, dailyData) {
  const spend = parseFloat(ad.spend || 0);
  const clicks = parseInt(ad.clicks || 0);
  const impressions = parseInt(ad.impressions || 0);
  const conversions = getAction(ad.actions, 'complete_registration');
  const cpa = conversions > 0 ? spend / conversions : Infinity;
  const avgCPC = clicks > 0 ? spend / clicks : 0;
  const ctr = parseFloat(ad.ctr || 0);
  const frequency = parseFloat(ad.frequency || 0);

  // Bayesian confidence
  const winProb = bayesianWinProbability(clicks, conversions, avgCPC, CONFIG.rules.winnerMaxCPA);
  const fatigueScore = computeFatigueScore(dailyData);

  // Days running
  const createdDate = ad._createdTime ? new Date(ad._createdTime) : null;
  const daysRunning = createdDate ? Math.floor((Date.now() - createdDate.getTime()) / 86400000) : 0;

  let status = 'LEARNING';
  let reason = '';

  if (conversions >= CONFIG.rules.winnerMinConversions && winProb >= CONFIG.rules.winnerConfidence) {
    status = 'WINNER';
    reason = `${conversions} conv, ${money(cpa)} CPA, ${(winProb * 100).toFixed(0)}% confidence`;
  } else if (conversions >= 3 && winProb >= 0.75) {
    status = 'LIKELY_WINNER';
    reason = `${conversions} conv, ${money(cpa)} CPA, ${(winProb * 100).toFixed(0)}% confidence — needs more data`;
  } else if (spend >= CONFIG.rules.loserMinSpend && conversions === 0) {
    status = 'LOSER';
    reason = `${money(spend)} spent, 0 conversions`;
  } else if (winProb < CONFIG.rules.loserConfidence && spend >= 10) {
    status = 'LIKELY_LOSER';
    reason = `${money(spend)} spent, ${(winProb * 100).toFixed(0)}% confidence — unlikely to hit target`;
  } else if (impressions === 0 && daysRunning >= CONFIG.rules.loserMinDays) {
    status = 'LOSER';
    reason = `0 impressions after ${daysRunning} days`;
  } else if (fatigueScore >= CONFIG.rules.fatigueThreshold) {
    status = 'FATIGUED';
    reason = `Fatigue score: ${fatigueScore}/100`;
  } else if (spend < 100) {
    status = 'LEARNING';
    reason = `${money(spend)} of $100 confident-read threshold`;
  } else {
    status = 'ACTIVE';
    reason = `${conversions} conv, ${money(cpa)} CPA`;
  }

  return {
    adId: ad.ad_id,
    adName: ad.ad_name,
    adSetId: ad.adset_id,
    adSetName: ad.adset_name,
    spend, clicks, impressions, conversions, cpa, ctr, frequency, avgCPC,
    winProbability: winProb,
    fatigueScore,
    daysRunning,
    status,
    reason,
  };
}

// ─── Auto-Actions ─────────────────────────────────────────────────────
async function pauseAd(adId, reason) {
  if (DRY_RUN) {
    actions.push(`[DRY RUN] Would pause ad ${adId}: ${reason}`);
    return;
  }
  const result = await metaPost(`/${adId}`, { status: 'PAUSED' });
  if (result.success) {
    actions.push(`Paused ad ${adId}: ${reason}`);
  } else {
    warnings.push(`Failed to pause ad ${adId}: ${JSON.stringify(result)}`);
  }
}

async function graduateWinner(classified) {
  if (!CONFIG.cboScaling.campaignId) {
    actions.push(`Winner ${classified.adId} flagged for CBO (no CBO campaign yet — need ${CONFIG.rules.phase2WinnerThreshold} winners)`);
    return;
  }

  // Get the post ID from the creative
  try {
    const adData = await metaGet(`/${classified.adId}`, {
      fields: 'creative{effective_object_story_id}',
    });
    const postId = adData.creative?.effective_object_story_id;
    if (!postId) {
      warnings.push(`Could not get Post ID for winner ${classified.adId}`);
      return;
    }

    if (DRY_RUN) {
      actions.push(`[DRY RUN] Would graduate ad ${classified.adId} to CBO via Post ID ${postId}`);
      return;
    }

    // Get CBO ad set ID
    const adSets = await metaGetAll(`/${CONFIG.cboScaling.campaignId}/adsets`, {
      fields: 'id,name', limit: '5',
    });
    if (!adSets.length) {
      warnings.push('CBO campaign has no ad sets');
      return;
    }

    // Create ad in CBO using Post ID
    const result = await metaPost(`/${AD_ACCOUNT}/ads`, {
      name: `[graduated] ${classified.adName}`,
      adset_id: adSets[0].id,
      creative: JSON.stringify({ object_story_id: postId }),
      status: 'ACTIVE',
    });

    if (result.id) {
      actions.push(`Graduated ad ${classified.adId} to CBO as ${result.id} (Post ID: ${postId})`);
      // Pause in ABO
      await pauseAd(classified.adId, 'Graduated to CBO');
    } else {
      warnings.push(`Failed to graduate ${classified.adId}: ${JSON.stringify(result)}`);
    }
  } catch (e) {
    warnings.push(`Error graduating ${classified.adId}: ${e.message}`);
  }
}

async function createCBOCampaign(winners) {
  console.log(`Creating CBO Scaling campaign with ${winners.length} winners...`);
  if (DRY_RUN) {
    actions.push(`[DRY RUN] Would create CBO campaign "${CONFIG.cboScaling.name}" with ${winners.length} winners`);
    return;
  }

  // Create campaign
  const campResult = await metaPost(`/${AD_ACCOUNT}/campaigns`, {
    name: CONFIG.cboScaling.name,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    special_ad_categories: JSON.stringify([]),
    // CBO = campaign_budget_optimization enabled
  });

  if (!campResult.id) {
    warnings.push(`Failed to create CBO campaign: ${JSON.stringify(campResult)}`);
    return;
  }

  const campaignId = campResult.id;
  CONFIG.cboScaling.campaignId = campaignId;

  // Save config
  writeFileSync(CONFIG.cboScaling.configFile, JSON.stringify({ campaignId }, null, 2));

  // Create ad set
  const adSetResult = await metaPost(`/${AD_ACCOUNT}/adsets`, {
    campaign_id: campaignId,
    name: 'Scaling — Broad US',
    daily_budget: String(CONFIG.rules.cboBudgetCents),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: JSON.stringify({ pixel_id: PIXEL_ID, custom_event_type: 'COMPLETE_REGISTRATION' }),
    targeting: JSON.stringify({ geo_locations: { countries: ['US'] }, age_min: 18, age_max: 65 }),
    publisher_platforms: JSON.stringify(['facebook', 'instagram', 'messenger']),
    status: 'PAUSED',
  });

  if (!adSetResult.id) {
    warnings.push(`Failed to create CBO ad set: ${JSON.stringify(adSetResult)}`);
    return;
  }

  actions.push(`Created CBO campaign ${campaignId} with ad set ${adSetResult.id} ($${CONFIG.rules.cboBudgetCents / 100}/day)`);

  // Graduate each winner
  for (const w of winners) {
    await graduateWinner(w);
  }

  actions.push(`CBO campaign ready — activate in Ads Manager after review`);
}

// ─── Creative DNA Analysis ────────────────────────────────────────────
async function analyzeCreativeDNA(classified) {
  // Get creative image URL
  try {
    const adData = await metaGet(`/${classified.adId}`, {
      fields: 'creative{image_url,object_story_spec}',
    });

    const imageUrl = adData.creative?.image_url ||
      adData.creative?.object_story_spec?.link_data?.picture ||
      null;

    if (!imageUrl) return null;

    // Store basic DNA (Gemini analysis happens offline / in generation phase)
    return {
      adId: classified.adId,
      adName: classified.adName,
      imageUrl,
      cpa: classified.cpa,
      conversions: classified.conversions,
      clicks: classified.clicks,
      ctr: classified.ctr,
      winProbability: classified.winProbability,
      fatigueScore: classified.fatigueScore,
      status: classified.status,
      date: today,
    };
  } catch (e) {
    return null;
  }
}

// ─── Competitor Monitoring ────────────────────────────────────────────
async function monitorCompetitors() {
  console.log('Monitoring competitor ads...');
  try {
    const results = await metaGet('/ads_archive', {
      search_terms: 'baby shower invitation',
      ad_reached_countries: 'US',
      ad_active_status: 'ACTIVE',
      fields: 'id,ad_creative_bodies,ad_creative_link_titles,ad_snapshot_url,page_name,ad_delivery_start_time',
      limit: '50',
    });

    const competitorAds = (results.data || []).filter(ad =>
      CONFIG.competitors.some(c => ad.page_name?.toLowerCase().includes(c.toLowerCase()))
    );

    return competitorAds.map(ad => ({
      pageName: ad.page_name,
      body: ad.ad_creative_bodies?.[0]?.substring(0, 100) || '',
      title: ad.ad_creative_link_titles?.[0] || '',
      snapshotUrl: ad.ad_snapshot_url,
      startDate: ad.ad_delivery_start_time,
    }));
  } catch (e) {
    warnings.push(`Competitor monitoring failed: ${e.message}`);
    return [];
  }
}

// ─── Report Generation ────────────────────────────────────────────────
function generateReport(campaigns, classifiedAds, competitorAds, dnaEntries) {
  const winners = classifiedAds.filter(a => a.status === 'WINNER');
  const likelyWinners = classifiedAds.filter(a => a.status === 'LIKELY_WINNER');
  const losers = classifiedAds.filter(a => a.status === 'LOSER');
  const likelyLosers = classifiedAds.filter(a => a.status === 'LIKELY_LOSER');
  const fatigued = classifiedAds.filter(a => a.status === 'FATIGUED');
  const learning = classifiedAds.filter(a => a.status === 'LEARNING');
  const active = classifiedAds.filter(a => a.status === 'ACTIVE');

  const totalSpend = classifiedAds.reduce((s, a) => s + a.spend, 0);
  const totalConv = classifiedAds.reduce((s, a) => s + a.conversions, 0);
  const totalCPA = totalConv > 0 ? totalSpend / totalConv : 0;

  // Count reserve creatives
  let reserveCount = 0;
  try {
    if (existsSync(CONFIG.reserveDir)) {
      reserveCount = readdirSync(CONFIG.reserveDir).filter(f => /\.(png|jpg|jpeg|mp4)$/i.test(f)).length;
    }
  } catch {}

  let md = `# Meta Ads Daily Digest — ${today}\n\n`;

  // Headline
  md += `**${money(totalSpend)}** spent | **${totalConv}** conv | **${money(totalCPA)}** CPA`;
  md += DRY_RUN ? ' | **DRY RUN**\n\n' : '\n\n';

  // Campaign overview
  md += `## Campaigns\n\n`;
  md += `| Campaign | Status | Budget |\n|----------|--------|--------|\n`;
  for (const c of campaigns) {
    md += `| ${c.name} | ${c.effective_status} | $${(c.daily_budget || 0) / 100}/day |\n`;
  }
  md += '\n';

  // Ad classification table
  md += `## Ad Performance & Classification\n\n`;
  md += `| Ad | Spend | Conv | CPA | CTR | Confidence | Fatigue | Status |\n`;
  md += `|-----|------:|-----:|----:|----:|-----------:|--------:|--------|\n`;
  for (const a of classifiedAds.sort((x, y) => y.spend - x.spend)) {
    const name = a.adName?.substring(0, 40) || a.adId;
    md += `| ${name} | ${money(a.spend)} | ${a.conversions} | ${a.conversions > 0 ? money(a.cpa) : '—'} | ${a.ctr.toFixed(1)}% | ${(a.winProbability * 100).toFixed(0)}% | ${a.fatigueScore}/100 | **${a.status}** |\n`;
  }
  md += '\n';

  // Winners
  if (winners.length) {
    md += `## Winners (${winners.length})\n\n`;
    for (const w of winners) md += `- **${w.adName}**: ${w.reason}\n`;
    md += '\n';
  }

  // Likely winners
  if (likelyWinners.length) {
    md += `## Likely Winners — Keep Running (${likelyWinners.length})\n\n`;
    for (const w of likelyWinners) md += `- ${w.adName}: ${w.reason}\n`;
    md += '\n';
  }

  // Losers
  if (losers.length) {
    md += `## Losers — Auto-Paused (${losers.length})\n\n`;
    for (const l of losers) md += `- ${l.adName}: ${l.reason}\n`;
    md += '\n';
  }

  // Likely losers
  if (likelyLosers.length) {
    md += `## Likely Losers — Watching (${likelyLosers.length})\n\n`;
    for (const l of likelyLosers) md += `- ${l.adName}: ${l.reason}\n`;
    md += '\n';
  }

  // Fatigued
  if (fatigued.length) {
    md += `## Fatigued Creatives (${fatigued.length})\n\n`;
    for (const f of fatigued) md += `- ${f.adName}: ${f.reason}\n`;
    md += '\n';
  }

  // Actions taken
  if (actions.length) {
    md += `## Actions Taken\n\n`;
    for (const a of actions) md += `- ${a}\n`;
    md += '\n';
  }

  // Warnings
  if (warnings.length) {
    md += `## Warnings\n\n`;
    for (const w of warnings) md += `- ${w}\n`;
    md += '\n';
  }

  // Creative inventory
  md += `## Creative Inventory\n\n`;
  md += `- Reserve creatives: **${reserveCount}**\n`;
  md += `- Winners to date: **${winners.length}**\n`;
  md += `- Total ads tested: **${classifiedAds.length}**\n`;

  // Check for auto-generated creatives pending review
  try {
    if (existsSync(CONFIG.generationsAutoDir)) {
      const autoDirs = readdirSync(CONFIG.generationsAutoDir).filter(d => d.startsWith('20'));
      if (autoDirs.length) {
        const latestDir = join(CONFIG.generationsAutoDir, autoDirs[autoDirs.length - 1]);
        const pending = readdirSync(latestDir).filter(f => /\.(png|jpg)$/i.test(f)).length;
        if (pending > 0) {
          md += `- **${pending} new auto-generated creatives pending review** in \`${latestDir}\`\n`;
        }
      }
    }
  } catch {}
  md += '\n';

  // Competitor activity
  if (competitorAds.length) {
    md += `## Competitor Activity (${competitorAds.length} active ads found)\n\n`;
    md += `| Advertiser | Title | Started |\n|------------|-------|--------|\n`;
    for (const c of competitorAds.slice(0, 10)) {
      md += `| ${c.pageName} | ${c.title.substring(0, 50)} | ${c.startDate?.substring(0, 10) || '?'} |\n`;
    }
    md += '\n';
  }

  // Phase 2 readiness
  const totalWinners = winners.length;
  if (!CONFIG.cboScaling.campaignId) {
    md += `## Phase 2 Status\n\n`;
    md += `Winners: **${totalWinners}/${CONFIG.rules.phase2WinnerThreshold}** needed for CBO launch\n\n`;
    if (totalWinners >= CONFIG.rules.phase2WinnerThreshold) {
      md += `**READY FOR PHASE 2** — CBO Scaling campaign will be auto-created\n\n`;
    }
  }

  return md;
}

// ─── Delivery ─────────────────────────────────────────────────────────
function buildSlackMessage(classifiedAds) {
  const winners = classifiedAds.filter(a => a.status === 'WINNER');
  const losers = classifiedAds.filter(a => a.status === 'LOSER');
  const totalSpend = classifiedAds.reduce((s, a) => s + a.spend, 0);
  const totalConv = classifiedAds.reduce((s, a) => s + a.conversions, 0);
  const totalCPA = totalConv > 0 ? totalSpend / totalConv : 0;

  let text = `*Meta Ads Digest — ${today}*\n`;
  text += `${money(totalSpend)} spent | ${totalConv} conv | ${money(totalCPA)} CPA\n\n`;

  if (winners.length) text += `*Winners:* ${winners.map(w => w.adName?.substring(0, 30)).join(', ')}\n`;
  if (losers.length) text += `*Losers paused:* ${losers.length}\n`;
  if (actions.length) text += `\n*Actions:*\n${actions.map(a => `• ${a}`).join('\n')}\n`;
  if (warnings.length) text += `\n*Warnings:*\n${warnings.map(w => `• ${w}`).join('\n')}`;

  return text;
}

async function sendSlack(text) {
  const url = process.env.META_SLACK_WEBHOOK_URL?.trim();
  if (!url) { console.log('  Slack: skipped (not configured)'); return; }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    console.log('  Slack: sent');
  } catch (e) {
    console.log(`  Slack: FAILED — ${e.message}`);
  }
}

async function sendEmail(markdown) {
  if (NO_EMAIL) { console.log('  Email: skipped (--no-email)'); return; }
  const apiToken = process.env.MAILTRAP_API_TOKEN?.trim();
  const emailStr = process.env.DIGEST_EMAIL?.trim();
  const fromEmail = process.env.DIGEST_FROM_EMAIL?.trim() || 'ads@invitfull.com';
  if (!apiToken || !emailStr) { console.log('  Email: skipped (not configured)'); return; }

  const recipients = emailStr.split(',').map(e => ({ email: e.trim() }));
  const html = markdown
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^# (.*?)(<br>)/gm, '<h1>$1</h1>')
    .replace(/^## (.*?)(<br>)/gm, '<h2>$1</h2>')
    .replace(/^### (.*?)(<br>)/gm, '<h3>$1</h3>');

  try {
    const r = await fetch('https://send.api.mailtrap.io/api/send', {
      method: 'POST',
      headers: { 'Api-Token': apiToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { email: fromEmail, name: 'Invitfull Meta Ads' },
        to: recipients,
        subject: `Meta Ads Digest — ${today}`,
        html: `<div style="font-family:monospace;font-size:13px;max-width:800px">${html}</div>`,
      }),
    });
    const d = await r.json();
    console.log(`  Email: ${d.success ? 'sent' : 'FAILED — ' + JSON.stringify(d)}`);
  } catch (e) {
    console.log(`  Email: FAILED — ${e.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`=== Invitfull Meta Ads Daily Digest ===${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`Date: ${today}\n`);

  // 1. Pull data
  const since = dateDaysAgo(14);
  const campaigns = await pullCampaigns();
  const adInsights = await pullAdInsights(CONFIG.aboTesting.campaignId, since, today);
  const dailyBreakdown = await pullAdDailyBreakdown(CONFIG.aboTesting.campaignId, dateDaysAgo(10), today);
  const adStatuses = await pullAdStatuses(CONFIG.aboTesting.campaignId);

  // Build daily data map per ad
  const dailyByAd = {};
  for (const row of dailyBreakdown) {
    if (!dailyByAd[row.ad_id]) dailyByAd[row.ad_id] = [];
    const spend = parseFloat(row.spend || 0);
    const impr = parseInt(row.impressions || 0);
    const clicks = parseInt(row.clicks || 0);
    const conv = getAction(row.actions, 'complete_registration');
    dailyByAd[row.ad_id].push({
      date: row.date_start,
      spend, impressions: impr, clicks, conversions: conv,
      ctr: clicks > 0 ? (clicks / impr * 100) : 0,
      cpm: impr > 0 ? (spend / impr * 1000) : 0,
      cvr: clicks > 0 ? (conv / clicks * 100) : 0,
      frequency: parseFloat(row.frequency || 0),
    });
  }

  // Enrich ad insights with created_time from status pull
  const createdTimeMap = {};
  for (const ad of adStatuses) {
    createdTimeMap[ad.id] = ad.created_time;
  }

  // 2. Classify ads
  console.log('\nClassifying ads...');
  const classifiedAds = [];
  for (const ad of adInsights) {
    ad._createdTime = createdTimeMap[ad.ad_id];
    const daily = dailyByAd[ad.ad_id] || [];
    const classified = classifyAd(ad, daily);
    classifiedAds.push(classified);
  }

  // Sort by status priority
  const statusOrder = { WINNER: 0, LIKELY_WINNER: 1, ACTIVE: 2, LEARNING: 3, FATIGUED: 4, LIKELY_LOSER: 5, LOSER: 6 };
  classifiedAds.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  console.log(`  Winners: ${classifiedAds.filter(a => a.status === 'WINNER').length}`);
  console.log(`  Likely winners: ${classifiedAds.filter(a => a.status === 'LIKELY_WINNER').length}`);
  console.log(`  Active: ${classifiedAds.filter(a => a.status === 'ACTIVE').length}`);
  console.log(`  Learning: ${classifiedAds.filter(a => a.status === 'LEARNING').length}`);
  console.log(`  Losers: ${classifiedAds.filter(a => a.status === 'LOSER').length}`);
  console.log(`  Fatigued: ${classifiedAds.filter(a => a.status === 'FATIGUED').length}`);

  // 3. Auto-actions
  console.log('\nExecuting actions...');
  const winners = classifiedAds.filter(a => a.status === 'WINNER');
  const losers = classifiedAds.filter(a => a.status === 'LOSER');

  // Pause losers
  for (const loser of losers) {
    await pauseAd(loser.adId, loser.reason);
  }

  // Phase 2 check: create CBO if enough winners
  if (winners.length >= CONFIG.rules.phase2WinnerThreshold && !CONFIG.cboScaling.campaignId) {
    await createCBOCampaign(winners);
  } else if (winners.length > 0 && CONFIG.cboScaling.campaignId) {
    // Graduate new winners to existing CBO
    for (const w of winners) {
      await graduateWinner(w);
    }
  }

  // 4. Creative DNA
  console.log('\nAnalyzing creative DNA...');
  const dnaEntries = [];
  for (const ad of classifiedAds) {
    if (ad.status === 'WINNER' || ad.status === 'LIKELY_WINNER' || ad.status === 'LOSER') {
      const dna = await analyzeCreativeDNA(ad);
      if (dna) dnaEntries.push(dna);
    }
  }

  // Save DNA
  const dnaFile = join(__dirname, 'creative-dna.json');
  let existingDNA = [];
  if (existsSync(dnaFile)) {
    existingDNA = JSON.parse(readFileSync(dnaFile, 'utf8'));
  }
  // Merge (update existing entries, add new)
  for (const entry of dnaEntries) {
    const idx = existingDNA.findIndex(e => e.adId === entry.adId);
    if (idx >= 0) existingDNA[idx] = entry;
    else existingDNA.push(entry);
  }
  writeFileSync(dnaFile, JSON.stringify(existingDNA, null, 2));

  // 5. Winner-informed creative generation
  if (winners.length > 0) {
    const genDir = join(CONFIG.generationsAutoDir, today);
    mkdirSync(genDir, { recursive: true });
    actions.push(`${winners.length} winner(s) detected — generate variations from: ${genDir}`);
    // Actual generation is triggered but output flagged for human review
    for (const w of winners) {
      try {
        const dna = dnaEntries.find(d => d.adId === w.adId);
        if (dna?.imageUrl) {
          // Download winner image for use as inspiration
          const imgResp = await fetch(dna.imageUrl);
          if (imgResp.ok) {
            const buf = Buffer.from(await imgResp.arrayBuffer());
            const imgPath = join(genDir, `winner_${w.adId}.png`);
            writeFileSync(imgPath, buf);
            actions.push(`Downloaded winner creative ${w.adId} for variation generation`);
          }
        }
      } catch (e) {
        warnings.push(`Could not download winner image ${w.adId}: ${e.message}`);
      }
    }
  }

  // 6. Competitor monitoring (weekly — only on Mondays)
  let competitorAds = [];
  if (new Date().getDay() === 1) {
    competitorAds = await monitorCompetitors();
  }

  // 7. Generate report
  console.log('\nGenerating report...');
  const report = generateReport(campaigns, classifiedAds, competitorAds, dnaEntries);

  // Save report
  mkdirSync(CONFIG.reportsDir, { recursive: true });
  const reportPath = join(CONFIG.reportsDir, `meta-digest-${today}.md`);
  writeFileSync(reportPath, report);
  console.log(`  Report saved: ${reportPath}`);

  // 8. Deliver
  console.log('\nDelivering...');
  await sendSlack(buildSlackMessage(classifiedAds));
  await sendEmail(report);

  // 9. Log actions
  const logFile = join(__dirname, 'meta-optimization-log.json');
  let log = [];
  if (existsSync(logFile)) log = JSON.parse(readFileSync(logFile, 'utf8'));
  log.push({
    date: today,
    dryRun: DRY_RUN,
    actions,
    warnings,
    summary: {
      totalAds: classifiedAds.length,
      winners: winners.length,
      losers: losers.length,
      totalSpend: classifiedAds.reduce((s, a) => s + a.spend, 0),
      totalConversions: classifiedAds.reduce((s, a) => s + a.conversions, 0),
    },
  });
  writeFileSync(logFile, JSON.stringify(log, null, 2));

  // Summary
  const totalSpend = classifiedAds.reduce((s, a) => s + a.spend, 0);
  const totalConv = classifiedAds.reduce((s, a) => s + a.conversions, 0);
  console.log(`\n  ${money(totalSpend)} | ${totalConv} conv | ${money(totalConv > 0 ? totalSpend / totalConv : 0)} CPA`);
  console.log(`  ${winners.length} winners | ${losers.length} losers paused | ${actions.length} actions`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
