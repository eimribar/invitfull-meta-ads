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

// 1. All campaigns
console.log('=== ALL CAMPAIGNS ===');
const campaigns = await metaGet(`/${AD_ACCOUNT}/campaigns`, {
  fields: 'name,status,effective_status,daily_budget,objective,created_time',
  filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
  limit: '50'
});
for (const c of campaigns.data || []) {
  console.log(`[${c.effective_status}] ${c.name} (ID:${c.id}) | Budget:$${(c.daily_budget || 0) / 100}/day | Obj:${c.objective} | Created:${c.created_time?.substring(0, 10)}`);
}

// 2. Campaign lifetime insights
console.log('\n=== CAMPAIGN INSIGHTS (Lifetime) ===');
const lifetime = await metaGet(`/${AD_ACCOUNT}/insights`, {
  fields: 'campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,reach,frequency',
  level: 'campaign',
  filtering: JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }]),
  time_range: JSON.stringify({ since: '2026-03-01', until: '2026-03-23' }),
  limit: '50'
});
for (const row of lifetime.data || []) {
  const acts = (row.actions || []).map(a => `${a.action_type}:${a.value}`).join(', ');
  console.log(`${row.campaign_name}`);
  console.log(`  Spend:$${row.spend} | Impr:${row.impressions} | Reach:${row.reach} | Freq:${row.frequency} | Clicks:${row.clicks} | CTR:${row.ctr} | CPC:$${row.cpc}`);
  console.log(`  Actions: ${acts}`);
  if (row.cost_per_action_type) {
    const cpas = row.cost_per_action_type.map(a => `${a.action_type}:$${a.value}`).join(', ');
    console.log(`  Cost/Action: ${cpas}`);
  }
  console.log();
}

// 3. Daily breakdown per campaign
console.log('=== DAILY BREAKDOWN (Feb 28 — Mar 10) ===');
const daily = await metaGet(`/${AD_ACCOUNT}/insights`, {
  fields: 'campaign_name,spend,impressions,clicks,actions,reach,ctr',
  level: 'campaign',
  filtering: JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }]),
  time_range: JSON.stringify({ since: '2026-03-01', until: '2026-03-23' }),
  time_increment: '1',
  limit: '200'
});
let currentCampaign = '';
for (const row of daily.data || []) {
  if (row.campaign_name !== currentCampaign) {
    currentCampaign = row.campaign_name;
    console.log(`\n--- ${currentCampaign} ---`);
  }
  const getAction = (type) => row.actions?.find(a => a.action_type === type)?.value || '0';
  const regs = getAction('offsite_conversion.custom.1657158561999170') !== '0'
    ? getAction('offsite_conversion.custom.1657158561999170')
    : getAction('complete_registration');
  const lpv = getAction('landing_page_view');
  const linkClicks = getAction('link_click');
  const signup = getAction('offsite_conversion.custom.1657158561999170');
  const watchInvite = getAction('offsite_conversion.custom.1434390078412864');
  const purchase = getAction('offsite_conversion.custom.935955148983273');
  const spend = parseFloat(row.spend);
  const cpr = parseFloat(regs) > 0 ? '$' + (spend / parseFloat(regs)).toFixed(2) : 'N/A';
  console.log(`  ${row.date_start} | $${row.spend.padStart(7)} | Impr:${row.impressions.padStart(6)} | Clicks:${row.clicks.padStart(4)} | LPV:${lpv.padStart(4)} | LinkClk:${linkClicks.padStart(4)} | Signup:${signup.padStart(3)} | Watch:${watchInvite.padStart(3)} | Purch:${purchase.padStart(2)} | Regs:${regs.padStart(3)} | CPR:${cpr}`);
}

// 4. Ad-level performance (top 30 by spend)
console.log('\n\n=== AD-LEVEL PERFORMANCE (by spend, lifetime) ===');
const adInsights = await metaGet(`/${AD_ACCOUNT}/insights`, {
  fields: 'ad_name,ad_id,campaign_name,spend,impressions,clicks,actions,ctr,cpc',
  level: 'ad',
  filtering: JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }]),
  time_range: JSON.stringify({ since: '2026-03-01', until: '2026-03-23' }),
  sort: JSON.stringify(['spend_descending']),
  limit: '35'
});
for (const row of adInsights.data || []) {
  const getAction = (type) => row.actions?.find(a => a.action_type === type)?.value || '0';
  const regs = getAction('offsite_conversion.custom.1657158561999170') !== '0'
    ? getAction('offsite_conversion.custom.1657158561999170')
    : getAction('complete_registration');
  const signup = getAction('offsite_conversion.custom.1657158561999170');
  const spend = parseFloat(row.spend);
  const cpr = parseFloat(regs) > 0 ? '$' + (spend / parseFloat(regs)).toFixed(2) : 'N/A';
  const campaign = row.campaign_name.substring(0, 18);
  const adName = (row.ad_name || 'unnamed').substring(0, 50);
  console.log(`  [${campaign}] ${adName.padEnd(50)} | $${row.spend.padStart(7)} | Impr:${row.impressions.padStart(6)} | CTR:${row.ctr.padStart(5)} | Signup:${signup.padStart(3)} | Regs:${regs.padStart(3)} | CPR:${cpr}`);
}

// 5. Platform breakdown
console.log('\n=== PLATFORM BREAKDOWN (Lifetime, active campaigns) ===');
const platforms = await metaGet(`/${AD_ACCOUNT}/insights`, {
  fields: 'campaign_name,spend,impressions,clicks,actions,publisher_platform',
  level: 'campaign',
  filtering: JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }]),
  time_range: JSON.stringify({ since: '2026-03-01', until: '2026-03-23' }),
  breakdowns: 'publisher_platform',
  limit: '50'
});
for (const row of platforms.data || []) {
  const getAction = (type) => row.actions?.find(a => a.action_type === type)?.value || '0';
  const regs = getAction('offsite_conversion.custom.1657158561999170') !== '0'
    ? getAction('offsite_conversion.custom.1657158561999170')
    : getAction('complete_registration');
  console.log(`  ${row.campaign_name.substring(0, 20)} | ${row.publisher_platform.padEnd(12)} | $${row.spend.padStart(7)} | Impr:${row.impressions.padStart(6)} | Clicks:${row.clicks.padStart(4)} | Regs:${regs}`);
}
