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
  if (d.error) throw new Error(d.error.message);
  return d;
}

const getA = (actions, type) => actions?.find(a => a.action_type === type)?.value || '0';

// Daily breakdown
const daily = await metaGet(`/${AD_ACCOUNT}/insights`, {
  fields: 'campaign_name,spend,impressions,clicks,actions,reach',
  level: 'campaign',
  filtering: JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }]),
  time_range: JSON.stringify({ since: '2026-02-28', until: '2026-03-10' }),
  time_increment: '1',
  limit: '200'
});

let currentCampaign = '';
const totals = {};
const dailyTotals = {};

for (const row of daily.data || []) {
  if (row.campaign_name !== currentCampaign) {
    currentCampaign = row.campaign_name;
    console.log(`\n--- ${currentCampaign} ---`);
    if (!totals[currentCampaign]) totals[currentCampaign] = { spend: 0, regs: 0 };
  }
  const regs = getA(row.actions, 'complete_registration');
  const signupV2 = getA(row.actions, 'offsite_conversion.custom.1657158561999170');
  const lpv = getA(row.actions, 'landing_page_view');
  const linkClk = getA(row.actions, 'link_click');
  const spend = parseFloat(row.spend);
  const r = parseInt(regs);
  totals[currentCampaign].spend += spend;
  totals[currentCampaign].regs += r;

  if (!dailyTotals[row.date_start]) dailyTotals[row.date_start] = { spend: 0, regs: 0 };
  dailyTotals[row.date_start].spend += spend;
  dailyTotals[row.date_start].regs += r;

  const cpr = r > 0 ? `$${(spend / r).toFixed(2)}` : 'N/A';
  console.log(`  ${row.date_start} | $${row.spend.padStart(7)} | Regs:${regs.padStart(3)} | V2:${signupV2.padStart(3)} | LPV:${lpv.padStart(4)} | LinkClk:${linkClk.padStart(4)} | CPR:${cpr}`);
}

console.log('\n=== CAMPAIGN TOTALS (complete_registration) ===');
let grandSpend = 0, grandRegs = 0;
for (const [name, t] of Object.entries(totals)) {
  const cpr = t.regs > 0 ? `$${(t.spend / t.regs).toFixed(2)}` : 'N/A';
  console.log(`  ${name} | Spend:$${t.spend.toFixed(2)} | Regs:${t.regs} | CPR:${cpr}`);
  grandSpend += t.spend;
  grandRegs += t.regs;
}
console.log(`  TOTAL | Spend:$${grandSpend.toFixed(2)} | Regs:${grandRegs} | CPR:$${(grandSpend / grandRegs).toFixed(2)}`);

console.log('\n=== DAILY TOTALS (all campaigns combined) ===');
for (const [date, t] of Object.entries(dailyTotals).sort()) {
  const cpr = t.regs > 0 ? `$${(t.spend / t.regs).toFixed(2)}` : 'N/A';
  console.log(`  ${date} | $${t.spend.toFixed(2).padStart(7)} | Regs:${String(t.regs).padStart(3)} | CPR:${cpr}`);
}

// Ad-level
console.log('\n=== TOP ADS (by spend, complete_registration) ===');
const adInsights = await metaGet(`/${AD_ACCOUNT}/insights`, {
  fields: 'ad_name,campaign_name,spend,impressions,clicks,actions,ctr',
  level: 'ad',
  filtering: JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }]),
  time_range: JSON.stringify({ since: '2026-02-28', until: '2026-03-10' }),
  sort: JSON.stringify(['spend_descending']),
  limit: '25'
});
for (const row of adInsights.data || []) {
  const regs = parseInt(getA(row.actions, 'complete_registration'));
  const v2 = getA(row.actions, 'offsite_conversion.custom.1657158561999170');
  const spend = parseFloat(row.spend);
  const cpr = regs > 0 ? `$${(spend / regs).toFixed(2)}` : 'N/A';
  const adName = (row.ad_name || 'unnamed').substring(0, 50);
  console.log(`  [${row.campaign_name.substring(0, 15)}] ${adName.padEnd(50)} | $${row.spend.padStart(7)} | Regs:${String(regs).padStart(3)} | V2:${v2.padStart(3)} | CPR:${cpr}`);
}
