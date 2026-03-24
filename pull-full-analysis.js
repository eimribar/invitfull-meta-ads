import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKEN = readFileSync(join(__dirname, 'scripts', '.meta_token'), 'utf8').trim();
const AD_ACCOUNT = 'act_104007129';
const API = 'https://graph.facebook.com/v22.0';

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

const getA = (actions, type) => actions?.find(a => a.action_type === type)?.value || '0';
const pad = (s, n) => String(s).padStart(n);
const padr = (s, n) => String(s).padEnd(n);
const pct = (v) => (parseFloat(v) * 100).toFixed(2);
const money = (v) => '$' + parseFloat(v).toFixed(2);

const SINCE = '2026-02-28';
const UNTIL = '2026-03-14';
const TIME_RANGE = JSON.stringify({ since: SINCE, until: UNTIL });
const ACTIVE_FILTER = JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }]);

// =============================================
// 1. CAMPAIGN STATUS
// =============================================
console.log('=== CAMPAIGN STATUS ===');
const campaigns = await metaGet(`/${AD_ACCOUNT}/campaigns`, {
  fields: 'name,status,effective_status,daily_budget,objective,created_time',
  filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
  limit: '50'
});
for (const c of campaigns.data || []) {
  console.log(`  [${padr(c.effective_status, 7)}] ${padr(c.name, 35)} | Budget:$${pad((c.daily_budget || 0) / 100, 3)}/day | Created:${c.created_time?.substring(0, 10)}`);
}

// =============================================
// 2. CAMPAIGN LIFETIME TOTALS
// =============================================
console.log('\n=== CAMPAIGN TOTALS (Feb 28 — Mar 14) ===');
const lifetime = await metaGetAll(`/${AD_ACCOUNT}/insights`, {
  fields: 'campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,reach,frequency',
  level: 'campaign',
  time_range: TIME_RANGE,
  limit: '50'
});
let gSpend = 0, gRegs = 0, gClicks = 0, gImpr = 0, gReach = 0;
for (const row of lifetime) {
  const spend = parseFloat(row.spend);
  const regs = parseInt(getA(row.actions, 'complete_registration'));
  const signups = parseInt(getA(row.actions, 'offsite_conversion.custom.1657158561999170'));
  const watches = parseInt(getA(row.actions, 'offsite_conversion.custom.1434390078412864'));
  const purchases = parseInt(getA(row.actions, 'offsite_conversion.custom.935955148983273'));
  const lpv = parseInt(getA(row.actions, 'landing_page_view'));
  const linkClk = parseInt(getA(row.actions, 'link_click'));
  const cpr = regs > 0 ? money(spend / regs) : 'N/A';
  gSpend += spend; gRegs += regs; gClicks += parseInt(row.clicks); gImpr += parseInt(row.impressions); gReach += parseInt(row.reach || 0);
  console.log(`  ${padr(row.campaign_name, 35)} | Spend:${pad(money(spend), 8)} | Regs:${pad(regs, 4)} | SignupV2:${pad(signups, 4)} | Watch:${pad(watches, 3)} | Purch:${pad(purchases, 2)} | CPR:${pad(cpr, 7)} | Clicks:${pad(row.clicks, 5)} | LPV:${pad(lpv, 5)} | Impr:${pad(row.impressions, 7)} | CTR:${row.ctr} | Reach:${row.reach}`);
}
console.log(`  ${padr('GRAND TOTAL', 35)} | Spend:${pad(money(gSpend), 8)} | Regs:${pad(gRegs, 4)} | CPR:${pad(gRegs > 0 ? money(gSpend / gRegs) : 'N/A', 7)} | Clicks:${pad(gClicks, 5)} | Impr:${pad(gImpr, 7)}`);

// =============================================
// 3. DAILY BREAKDOWN PER CAMPAIGN
// =============================================
console.log('\n=== DAILY BREAKDOWN BY CAMPAIGN ===');
const daily = await metaGetAll(`/${AD_ACCOUNT}/insights`, {
  fields: 'campaign_name,spend,impressions,clicks,actions,reach,ctr',
  level: 'campaign',
  time_range: TIME_RANGE,
  time_increment: '1',
  limit: '500'
});

const bycamp = {};
const bydate = {};
for (const row of daily) {
  if (!bycamp[row.campaign_name]) bycamp[row.campaign_name] = [];
  bycamp[row.campaign_name].push(row);
  if (!bydate[row.date_start]) bydate[row.date_start] = { spend: 0, regs: 0, clicks: 0, impr: 0 };
  const s = parseFloat(row.spend);
  const r = parseInt(getA(row.actions, 'complete_registration'));
  bydate[row.date_start].spend += s;
  bydate[row.date_start].regs += r;
  bydate[row.date_start].clicks += parseInt(row.clicks);
  bydate[row.date_start].impr += parseInt(row.impressions);
}

for (const [name, rows] of Object.entries(bycamp)) {
  console.log(`\n  --- ${name} ---`);
  for (const row of rows.sort((a, b) => a.date_start.localeCompare(b.date_start))) {
    const regs = parseInt(getA(row.actions, 'complete_registration'));
    const signups = getA(row.actions, 'offsite_conversion.custom.1657158561999170');
    const lpv = getA(row.actions, 'landing_page_view');
    const linkClk = getA(row.actions, 'link_click');
    const spend = parseFloat(row.spend);
    const cpr = regs > 0 ? money(spend / regs) : '   N/A';
    console.log(`    ${row.date_start} | $${pad(row.spend, 7)} | Regs:${pad(regs, 3)} | V2:${pad(signups, 3)} | LPV:${pad(lpv, 4)} | LinkClk:${pad(linkClk, 4)} | Impr:${pad(row.impressions, 6)} | CTR:${(row.ctr || '0').padStart(5)} | CPR:${cpr}`);
  }
}

console.log('\n=== DAILY TOTALS (all campaigns combined) ===');
for (const [date, t] of Object.entries(bydate).sort()) {
  const cpr = t.regs > 0 ? money(t.spend / t.regs) : 'N/A';
  console.log(`  ${date} | $${pad(t.spend.toFixed(2), 7)} | Regs:${pad(t.regs, 3)} | Clicks:${pad(t.clicks, 4)} | Impr:${pad(t.impr, 6)} | CPR:${cpr}`);
}

// =============================================
// 4. AD-LEVEL PERFORMANCE (all time)
// =============================================
console.log('\n=== AD-LEVEL PERFORMANCE (by spend) ===');
const adInsights = await metaGetAll(`/${AD_ACCOUNT}/insights`, {
  fields: 'ad_name,ad_id,campaign_name,spend,impressions,clicks,actions,ctr,cpc',
  level: 'ad',
  time_range: TIME_RANGE,
  sort: JSON.stringify(['spend_descending']),
  limit: '50'
});
for (const row of adInsights) {
  const regs = parseInt(getA(row.actions, 'complete_registration'));
  const signups = getA(row.actions, 'offsite_conversion.custom.1657158561999170');
  const spend = parseFloat(row.spend);
  const cpr = regs > 0 ? money(spend / regs) : '   N/A';
  const campaign = row.campaign_name.substring(0, 18);
  const adName = (row.ad_name || 'unnamed').substring(0, 55);
  console.log(`  [${padr(campaign, 18)}] ${padr(adName, 55)} | $${pad(row.spend, 7)} | Regs:${pad(regs, 3)} | V2:${pad(signups, 3)} | Impr:${pad(row.impressions, 6)} | CTR:${row.ctr.padStart(5)} | CPR:${cpr}`);
}

// =============================================
// 5. BABY SHOWER AD-LEVEL DAILY (to see new creatives)
// =============================================
console.log('\n=== BABY SHOWER ADS — DAILY (last 5 days) ===');
const babyAdDaily = await metaGetAll(`/${AD_ACCOUNT}/insights`, {
  fields: 'ad_name,ad_id,spend,impressions,clicks,actions,ctr',
  level: 'ad',
  filtering: JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: 'Baby' }]),
  time_range: JSON.stringify({ since: '2026-03-10', until: UNTIL }),
  time_increment: '1',
  limit: '500'
});
const babyByAd = {};
for (const row of babyAdDaily) {
  const key = row.ad_name || row.ad_id;
  if (!babyByAd[key]) babyByAd[key] = [];
  babyByAd[key].push(row);
}
for (const [adName, rows] of Object.entries(babyByAd)) {
  console.log(`\n  --- ${adName.substring(0, 70)} ---`);
  let tSpend = 0, tRegs = 0;
  for (const row of rows.sort((a, b) => a.date_start.localeCompare(b.date_start))) {
    const regs = parseInt(getA(row.actions, 'complete_registration'));
    const spend = parseFloat(row.spend);
    tSpend += spend; tRegs += regs;
    const cpr = regs > 0 ? money(spend / regs) : '   N/A';
    console.log(`    ${row.date_start} | $${pad(spend.toFixed(2), 7)} | Regs:${pad(regs, 3)} | Clicks:${pad(row.clicks, 3)} | Impr:${pad(row.impressions, 5)} | CTR:${row.ctr.padStart(5)} | CPR:${cpr}`);
  }
  const tCpr = tRegs > 0 ? money(tSpend / tRegs) : 'N/A';
  console.log(`    TOTAL: $${tSpend.toFixed(2)} | Regs:${tRegs} | CPR:${tCpr}`);
}

// =============================================
// 6. PLATFORM BREAKDOWN
// =============================================
console.log('\n=== PLATFORM BREAKDOWN ===');
const platforms = await metaGetAll(`/${AD_ACCOUNT}/insights`, {
  fields: 'campaign_name,spend,impressions,clicks,actions',
  level: 'campaign',
  time_range: TIME_RANGE,
  breakdowns: 'publisher_platform',
  limit: '100'
});
for (const row of platforms) {
  const regs = parseInt(getA(row.actions, 'complete_registration'));
  const spend = parseFloat(row.spend);
  const cpr = regs > 0 ? money(spend / regs) : '   N/A';
  console.log(`  ${padr(row.campaign_name.substring(0, 25), 25)} | ${padr(row.publisher_platform, 12)} | $${pad(row.spend, 7)} | Regs:${pad(regs, 3)} | Clicks:${pad(row.clicks, 4)} | Impr:${pad(row.impressions, 6)} | CPR:${cpr}`);
}

// =============================================
// 7. AGE/GENDER BREAKDOWN (Baby Shower only)
// =============================================
console.log('\n=== BABY SHOWER — AGE/GENDER BREAKDOWN ===');
const ageGender = await metaGetAll(`/${AD_ACCOUNT}/insights`, {
  fields: 'spend,impressions,clicks,actions',
  level: 'campaign',
  filtering: JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: 'Baby' }]),
  time_range: TIME_RANGE,
  breakdowns: 'age,gender',
  limit: '100'
});
for (const row of ageGender.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend))) {
  const regs = parseInt(getA(row.actions, 'complete_registration'));
  const spend = parseFloat(row.spend);
  const cpr = regs > 0 ? money(spend / regs) : '   N/A';
  console.log(`  ${padr(row.age, 6)} ${padr(row.gender, 8)} | $${pad(row.spend, 7)} | Regs:${pad(regs, 3)} | Clicks:${pad(row.clicks, 4)} | Impr:${pad(row.impressions, 6)} | CPR:${cpr}`);
}

// =============================================
// 8. DEVICE BREAKDOWN
// =============================================
console.log('\n=== DEVICE BREAKDOWN (by campaign) ===');
const devices = await metaGetAll(`/${AD_ACCOUNT}/insights`, {
  fields: 'campaign_name,spend,impressions,clicks,actions',
  level: 'campaign',
  time_range: TIME_RANGE,
  breakdowns: 'impression_device',
  limit: '100'
});
for (const row of devices.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend))) {
  const regs = parseInt(getA(row.actions, 'complete_registration'));
  const spend = parseFloat(row.spend);
  const cpr = regs > 0 ? money(spend / regs) : '   N/A';
  console.log(`  ${padr(row.campaign_name.substring(0, 25), 25)} | ${padr(row.impression_device, 18)} | $${pad(row.spend, 7)} | Regs:${pad(regs, 3)} | Clicks:${pad(row.clicks, 4)} | Impr:${pad(row.impressions, 6)} | CPR:${cpr}`);
}

console.log('\n=== DONE ===');
