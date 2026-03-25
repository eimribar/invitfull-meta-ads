/**
 * Tool implementations for the Meta Ads AI Agent.
 * Each tool is a function Claude can call autonomously.
 */

const META_API = 'https://graph.facebook.com/v22.0';
const AD_ACCOUNT = 'act_104007129';
const PAGE_ID = '917868684732619';
const PIXEL_ID = '1398381481388085';

function dateDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const today = new Date().toISOString().slice(0, 10);

// ─── Meta API helpers ─────────────────────────────────────────────
async function metaGet(token, path, params = {}) {
  params.access_token = token;
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${META_API}${path}?${qs}`);
  return r.json();
}

async function metaGetAll(token, path, params = {}) {
  let all = [];
  let resp = await metaGet(token, path, params);
  if (resp.error) return { error: resp.error.message };
  all.push(...(resp.data || []));
  while (resp.paging?.next) {
    const r = await fetch(resp.paging.next);
    resp = await r.json();
    if (resp.error) break;
    all.push(...(resp.data || []));
  }
  return all;
}

async function metaPost(token, path, data = {}) {
  data.access_token = token;
  const r = await fetch(`${META_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  });
  return r.json();
}

// ─── Tool Definitions (for Claude) ────────────────────────────────
export const toolDefinitions = [
  {
    name: 'pull_campaign_data',
    description: 'Pull all Meta Ads campaign, ad set, ad-level, and daily breakdown data for the ABO testing campaign. Returns comprehensive performance data for the last 14 days.',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'ABO campaign ID to pull data for' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'pause_ad',
    description: 'Pause a specific ad by setting its status to PAUSED.',
    input_schema: {
      type: 'object',
      properties: {
        ad_id: { type: 'string', description: 'The Meta ad ID to pause' },
        reason: { type: 'string', description: 'Why this ad is being paused' },
      },
      required: ['ad_id', 'reason'],
    },
  },
  {
    name: 'activate_ad',
    description: 'Activate a paused ad by setting its status to ACTIVE.',
    input_schema: {
      type: 'object',
      properties: {
        ad_id: { type: 'string', description: 'The Meta ad ID to activate' },
        reason: { type: 'string', description: 'Why this ad is being activated' },
      },
      required: ['ad_id', 'reason'],
    },
  },
  {
    name: 'update_adset_budget',
    description: 'Update the daily budget for an ad set.',
    input_schema: {
      type: 'object',
      properties: {
        adset_id: { type: 'string', description: 'The Meta ad set ID' },
        daily_budget_cents: { type: 'number', description: 'New daily budget in cents (e.g., 2000 = $20)' },
        reason: { type: 'string', description: 'Why the budget is changing' },
      },
      required: ['adset_id', 'daily_budget_cents', 'reason'],
    },
  },
  {
    name: 'get_ad_creative_details',
    description: 'Get the creative details for a specific ad, including Post ID (effective_object_story_id) for graduation.',
    input_schema: {
      type: 'object',
      properties: {
        ad_id: { type: 'string', description: 'The Meta ad ID' },
      },
      required: ['ad_id'],
    },
  },
  {
    name: 'create_cbo_campaign',
    description: 'Create a CBO (Campaign Budget Optimization) scaling campaign with one broad-targeting ad set.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        daily_budget_cents: { type: 'number', description: 'Daily budget in cents' },
      },
      required: ['name', 'daily_budget_cents'],
    },
  },
  {
    name: 'graduate_winner',
    description: 'Graduate a winning ad from ABO testing to the CBO scaling campaign using Post ID (preserves social proof). Also pauses the ad in the ABO campaign.',
    input_schema: {
      type: 'object',
      properties: {
        ad_id: { type: 'string', description: 'The winning ad ID in ABO' },
        cbo_adset_id: { type: 'string', description: 'The CBO scaling ad set ID to add the winner to' },
        reason: { type: 'string', description: 'Why this ad is being graduated' },
      },
      required: ['ad_id', 'cbo_adset_id', 'reason'],
    },
  },
  {
    name: 'upload_image_and_create_ad',
    description: 'Upload an image from a URL and create a new ad in a specific ad set. Use this to replace killed/graduated ads with reserve creatives.',
    input_schema: {
      type: 'object',
      properties: {
        image_url: { type: 'string', description: 'URL of the image to upload' },
        adset_id: { type: 'string', description: 'Ad set ID to create the ad in' },
        headline: { type: 'string', description: 'Ad headline' },
        primary_text: { type: 'string', description: 'Ad primary text / body' },
        description: { type: 'string', description: 'Ad description' },
        ad_name: { type: 'string', description: 'Name for the ad' },
        landing_page: { type: 'string', description: 'Landing page URL', default: 'https://invitfull.com/baby-shower' },
      },
      required: ['image_url', 'adset_id', 'headline', 'primary_text', 'description', 'ad_name'],
    },
  },
  {
    name: 'embed_creative',
    description: 'Generate a Gemini Embedding 2 vector for a creative image. Use this to build the creative embedding database. Returns a 768-dimensional vector (optimized for storage). Store the embedding with save_state for later similarity comparisons.',
    input_schema: {
      type: 'object',
      properties: {
        image_url: { type: 'string', description: 'URL of the creative image to embed' },
        ad_id: { type: 'string', description: 'Ad ID this creative belongs to' },
        label: { type: 'string', description: 'Label for this embedding (e.g., "winner", "loser", "reserve", "active")' },
      },
      required: ['image_url', 'ad_id'],
    },
  },
  {
    name: 'compare_creatives',
    description: 'Compare two or more creative embeddings by cosine similarity. Use this to: (1) check if a new creative is too similar to existing ads (Andromeda suppresses >60% similarity), (2) find which winner a new creative is most similar to, (3) ensure creative diversity in an ad set. Requires embeddings to be loaded from state first.',
    input_schema: {
      type: 'object',
      properties: {
        embeddings: {
          type: 'array',
          description: 'Array of {ad_id, vector} objects to compare pairwise',
          items: {
            type: 'object',
            properties: {
              ad_id: { type: 'string' },
              vector: { type: 'array', items: { type: 'number' } },
            },
          },
        },
      },
      required: ['embeddings'],
    },
  },
  {
    name: 'find_most_diverse_set',
    description: 'Given a pool of creative embeddings, find the N most diverse creatives (maximally spread in embedding space). Use this when selecting which reserve creatives to upload — pick the ones most different from each other AND from current active ads.',
    input_schema: {
      type: 'object',
      properties: {
        pool_embeddings: {
          type: 'array',
          description: 'All candidate embeddings [{ad_id, vector}]',
          items: { type: 'object', properties: { ad_id: { type: 'string' }, vector: { type: 'array', items: { type: 'number' } } } },
        },
        active_embeddings: {
          type: 'array',
          description: 'Currently active ad embeddings to maximize distance from [{ad_id, vector}]',
          items: { type: 'object', properties: { ad_id: { type: 'string' }, vector: { type: 'array', items: { type: 'number' } } } },
        },
        n: { type: 'number', description: 'Number of creatives to select' },
      },
      required: ['pool_embeddings', 'n'],
    },
  },
  {
    name: 'send_email_report',
    description: 'Send the daily analysis report via email to the team.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Email subject line' },
        body_markdown: { type: 'string', description: 'Report content in markdown format' },
      },
      required: ['subject', 'body_markdown'],
    },
  },
  {
    name: 'save_state',
    description: 'Save state files (decisions, creative DNA, optimization log) to Supabase for persistence.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'State key (e.g., decisions, creative_dna, optimization_log, cbo_config)' },
        value: { type: 'string', description: 'JSON string to save' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'load_state',
    description: 'Load a previously saved state file from Supabase.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'State key to load' },
      },
      required: ['key'],
    },
  },
];

// ─── Tool Implementations ─────────────────────────────────────────
export function createToolExecutor(config) {
  const { metaToken, mailtrapToken, supabaseUrl, supabaseKey, dryRun } = config;

  const sb = (path, method = 'GET', body = null) => {
    const opts = {
      method,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: method === 'POST' ? 'resolution=merge-duplicates' : undefined,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(`${supabaseUrl}/rest/v1${path}`, opts).then(r => r.json());
  };

  return async function executeTool(name, input) {
    console.log(`  [TOOL] ${name}(${JSON.stringify(input).substring(0, 100)}...)`);

    if (dryRun && ['pause_ad', 'activate_ad', 'update_adset_budget', 'create_cbo_campaign', 'graduate_winner', 'upload_image_and_create_ad'].includes(name)) {
      return { success: true, dry_run: true, message: `[DRY RUN] Would execute ${name}` };
    }

    switch (name) {
      case 'pull_campaign_data': {
        const cid = input.campaign_id;
        const since14 = dateDaysAgo(14);
        const since10 = dateDaysAgo(10);
        const [campaigns, adSetInsights, adInsights, dailyBreakdown, adStatuses] = await Promise.all([
          metaGetAll(metaToken, `/${AD_ACCOUNT}/campaigns`, {
            fields: 'name,status,effective_status,daily_budget,objective,created_time',
            filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
            limit: '50',
          }),
          metaGetAll(metaToken, `/${cid}/insights`, {
            fields: 'adset_name,adset_id,spend,impressions,clicks,actions,ctr,cpc,cpm,reach,frequency',
            level: 'adset', time_range: JSON.stringify({ since: since14, until: today }), limit: '100',
          }),
          metaGetAll(metaToken, `/${cid}/insights`, {
            fields: 'ad_name,ad_id,adset_name,adset_id,spend,impressions,clicks,actions,ctr,cpc,cpm,reach,frequency',
            level: 'ad', time_range: JSON.stringify({ since: since14, until: today }), limit: '200',
          }),
          metaGetAll(metaToken, `/${cid}/insights`, {
            fields: 'ad_name,ad_id,spend,impressions,clicks,actions,ctr,cpc,cpm,frequency',
            level: 'ad', time_range: JSON.stringify({ since: since10, until: today }), time_increment: '1', limit: '500',
          }),
          metaGetAll(metaToken, `/${cid}/ads`, {
            fields: 'name,status,effective_status,creative{id,effective_object_story_id,image_url,object_story_spec},created_time',
            limit: '100',
          }),
        ]);
        return { date: today, campaigns, adSetInsights, adInsights, dailyBreakdown, adStatuses };
      }

      case 'pause_ad': {
        const result = await metaPost(metaToken, `/${input.ad_id}`, { status: 'PAUSED' });
        return { success: result.success, ad_id: input.ad_id, reason: input.reason };
      }

      case 'activate_ad': {
        const result = await metaPost(metaToken, `/${input.ad_id}`, { status: 'ACTIVE' });
        return { success: result.success, ad_id: input.ad_id, reason: input.reason };
      }

      case 'update_adset_budget': {
        const result = await metaPost(metaToken, `/${input.adset_id}`, { daily_budget: String(input.daily_budget_cents) });
        return { success: result.success, adset_id: input.adset_id, budget: `$${input.daily_budget_cents / 100}` };
      }

      case 'get_ad_creative_details': {
        const data = await metaGet(metaToken, `/${input.ad_id}`, {
          fields: 'creative{id,effective_object_story_id,image_url,object_story_spec}',
        });
        return data;
      }

      case 'create_cbo_campaign': {
        const camp = await metaPost(metaToken, `/${AD_ACCOUNT}/campaigns`, {
          name: input.name,
          objective: 'OUTCOME_LEADS',
          status: 'PAUSED',
          special_ad_categories: JSON.stringify([]),
        });
        if (!camp.id) return { error: 'Failed to create campaign', details: camp };

        const adSet = await metaPost(metaToken, `/${AD_ACCOUNT}/adsets`, {
          campaign_id: camp.id,
          name: 'Scaling — Broad US',
          daily_budget: String(input.daily_budget_cents),
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'OFFSITE_CONVERSIONS',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          promoted_object: JSON.stringify({ pixel_id: PIXEL_ID, custom_event_type: 'COMPLETE_REGISTRATION' }),
          targeting: JSON.stringify({ geo_locations: { countries: ['US'] }, age_min: 18, age_max: 65 }),
          publisher_platforms: JSON.stringify(['facebook', 'instagram', 'messenger']),
          status: 'PAUSED',
        });

        return { campaign_id: camp.id, adset_id: adSet.id, name: input.name };
      }

      case 'graduate_winner': {
        // Get Post ID
        const adData = await metaGet(metaToken, `/${input.ad_id}`, {
          fields: 'creative{effective_object_story_id}',
        });
        const postId = adData.creative?.effective_object_story_id;
        if (!postId) return { error: 'Could not get Post ID', ad_id: input.ad_id };

        // Create ad in CBO using Post ID
        const newAd = await metaPost(metaToken, `/${AD_ACCOUNT}/ads`, {
          name: `[graduated] ${input.ad_id}`,
          adset_id: input.cbo_adset_id,
          creative: JSON.stringify({ object_story_id: postId }),
          status: 'ACTIVE',
        });

        // Pause in ABO
        await metaPost(metaToken, `/${input.ad_id}`, { status: 'PAUSED' });

        return { success: !!newAd.id, new_ad_id: newAd.id, post_id: postId, original_ad_id: input.ad_id };
      }

      case 'upload_image_and_create_ad': {
        // Download image
        const imgResp = await fetch(input.image_url);
        const imgBlob = await imgResp.blob();

        // Upload to Meta
        const formData = new FormData();
        formData.append('filename', new File([imgBlob], 'creative.png', { type: 'image/png' }));
        formData.append('access_token', metaToken);
        const uploadResp = await fetch(`${META_API}/${AD_ACCOUNT}/adimages`, { method: 'POST', body: formData });
        const uploadData = await uploadResp.json();
        const imageHash = Object.values(uploadData.images || {})[0]?.hash;
        if (!imageHash) return { error: 'Image upload failed', details: uploadData };

        // Create creative
        const creative = await metaPost(metaToken, `/${AD_ACCOUNT}/adcreatives`, {
          name: input.ad_name,
          object_story_spec: JSON.stringify({
            page_id: PAGE_ID,
            link_data: {
              image_hash: imageHash,
              link: input.landing_page || 'https://invitfull.com/baby-shower',
              message: input.primary_text,
              name: input.headline,
              description: input.description,
              call_to_action: { type: 'LEARN_MORE' },
            },
          }),
        });
        if (!creative.id) return { error: 'Creative creation failed', details: creative };

        // Create ad
        const ad = await metaPost(metaToken, `/${AD_ACCOUNT}/ads`, {
          name: input.ad_name,
          adset_id: input.adset_id,
          creative: JSON.stringify({ creative_id: creative.id }),
          status: 'ACTIVE',
        });

        return { success: !!ad.id, ad_id: ad.id, creative_id: creative.id, image_hash: imageHash };
      }

      case 'embed_creative': {
        const geminiKey = process.env.GEMINI_API_KEY || config.geminiKey || '';
        if (!geminiKey) return { error: 'No GEMINI_API_KEY configured' };

        // Download image
        const imgResp2 = await fetch(input.image_url);
        const imgBuf = Buffer.from(await imgResp2.arrayBuffer());
        const base64Img = imgBuf.toString('base64');
        const mimeType = input.image_url.endsWith('.jpg') || input.image_url.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';

        // Call Gemini Embedding 2
        const embResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: {
              parts: [{ inline_data: { mime_type: mimeType, data: base64Img } }],
            },
            output_dimensionality: 768, // MRL: balanced quality vs storage
          }),
        });
        const embData = await embResp.json();

        if (embData.error) return { error: `Gemini Embedding error: ${embData.error.message}` };

        const vector = embData.embedding?.values;
        if (!vector) return { error: 'No embedding returned', raw: JSON.stringify(embData).substring(0, 200) };

        return {
          ad_id: input.ad_id,
          label: input.label || 'unknown',
          dimensions: vector.length,
          vector, // 768-dim float array
        };
      }

      case 'compare_creatives': {
        // Cosine similarity between all pairs
        function cosineSim(a, b) {
          let dot = 0, magA = 0, magB = 0;
          for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
          }
          return dot / (Math.sqrt(magA) * Math.sqrt(magB));
        }

        const embs = input.embeddings;
        const pairs = [];
        for (let i = 0; i < embs.length; i++) {
          for (let j = i + 1; j < embs.length; j++) {
            const sim = cosineSim(embs[i].vector, embs[j].vector);
            pairs.push({
              ad_a: embs[i].ad_id,
              ad_b: embs[j].ad_id,
              similarity: Math.round(sim * 1000) / 1000,
              risk: sim > 0.6 ? 'HIGH — Andromeda may suppress' : sim > 0.4 ? 'MEDIUM' : 'LOW — good diversity',
            });
          }
        }
        pairs.sort((a, b) => b.similarity - a.similarity);
        return { pairs, count: pairs.length };
      }

      case 'find_most_diverse_set': {
        function cosineSim2(a, b) {
          let dot = 0, magA = 0, magB = 0;
          for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
          return dot / (Math.sqrt(magA) * Math.sqrt(magB));
        }

        const pool = input.pool_embeddings;
        const active = input.active_embeddings || [];
        const n = input.n;

        // Greedy farthest-first selection
        const selected = [];
        const remaining = [...pool];

        // Start with the creative most different from all active ads
        if (active.length > 0) {
          let bestIdx = 0, bestMinDist = -1;
          for (let i = 0; i < remaining.length; i++) {
            const minSim = Math.max(...active.map(a => cosineSim2(remaining[i].vector, a.vector)));
            const dist = 1 - minSim;
            if (dist > bestMinDist) { bestMinDist = dist; bestIdx = i; }
          }
          selected.push(remaining.splice(bestIdx, 1)[0]);
        } else if (remaining.length > 0) {
          selected.push(remaining.splice(0, 1)[0]);
        }

        // Greedily add the most distant creative from all selected + active
        while (selected.length < n && remaining.length > 0) {
          let bestIdx = 0, bestMinDist = -1;
          for (let i = 0; i < remaining.length; i++) {
            const allSelected = [...selected, ...active];
            const maxSim = Math.max(...allSelected.map(s => cosineSim2(remaining[i].vector, s.vector)));
            const dist = 1 - maxSim;
            if (dist > bestMinDist) { bestMinDist = dist; bestIdx = i; }
          }
          selected.push(remaining.splice(bestIdx, 1)[0]);
        }

        return {
          selected: selected.map(s => ({ ad_id: s.ad_id, min_similarity_to_others: 'computed' })),
          count: selected.length,
        };
      }

      case 'send_email_report': {
        if (!mailtrapToken) return { error: 'No Mailtrap token configured' };
        const html = `<div style="font-family:monospace;font-size:13px;max-width:800px;white-space:pre-wrap">${
          input.body_markdown
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
            .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
            .replace(/\n/g, '<br>')
        }</div>`;

        const r = await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: { 'Api-Token': mailtrapToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: { email: 'ads@invitfull.com', name: 'Invitfull AI Optimizer' },
            to: [{ email: 'eimribar@gmail.com' }, { email: 'tomer@invitfull.com' }],
            subject: input.subject,
            html,
          }),
        });
        const data = await r.json();
        return { success: data.success, message_ids: data.message_ids };
      }

      case 'save_state': {
        try {
          // Validate JSON if value looks like JSON
          if (input.value.startsWith('{') || input.value.startsWith('[')) JSON.parse(input.value);
          await sb('/ads_config', 'POST', { key: `state_${input.key}`, value: input.value });
          return { success: true, key: input.key };
        } catch (e) {
          return { error: `Save failed: ${e.message}`, key: input.key };
        }
      }

      case 'load_state': {
        try {
          const data = await sb(`/ads_config?key=eq.state_${input.key}&select=value`);
          return { value: data?.[0]?.value || null };
        } catch (e) {
          return { error: `Load failed: ${e.message}`, key: input.key };
        }
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  };
}
