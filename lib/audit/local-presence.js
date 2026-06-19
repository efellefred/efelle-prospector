'use strict';

const { tavilySearch } = require('./tavily');
const { findBusinessOnPlaces } = require('./places');

const SYSTEM_PROMPT = `You are a local SEO data analyst. Given web search snippets about a
business, extract structured information about its local presence.

Guidelines:
- Mark fields true / populate values when the snippets give reasonable evidence,
  even if not 100% verbatim. For example, if a snippet shows "4.7 ★ · 44 reviews"
  alongside the business name and a Google-related domain, that's strong
  evidence of a Google Business Profile with that rating + review count.
- Treat snippets from google.com/maps, business.google.com, search.google.com,
  yelp.com, facebook.com/<business>, and trusted directory sites as
  authoritative.
- google_business_profile.is_complete: ALWAYS set this to false. This field is
  authoritatively decided upstream by the Google Places API, not from search
  snippets. Your job here is to enrich rating, review_count, has_opening_hours
  and is_claimed when the snippets give clear evidence.
- google_business_profile.is_claimed = true when the snippets indicate the
  owner has verified the listing (e.g., "Claim this business" is NOT shown,
  or the listing has clear branding/owner-managed content).
- directory_consistency.is_address_consistent = true unless there's specific
  evidence of mismatched addresses across directories. When unsure, default
  to true (most legitimate businesses are consistent).
- Verify the snippets refer to the SAME business (matching domain or name)
  before trusting them. Discard clearly off-topic snippets.

Output: ONLY a JSON code block matching the user-provided schema. No prose.`;

const SCHEMA_HINT = `{
  "google_business_profile": {
    "is_complete": boolean,
    "rating": number | null,
    "review_count": number | null,
    "has_opening_hours": boolean,
    "is_claimed": boolean
  },
  "directory_consistency": {
    "facebook_found": boolean,
    "google_maps_found": boolean,
    "bing_maps_found": boolean,
    "is_address_consistent": boolean
  },
  "contact_details": {
    "phone_discovered": string | null,
    "email_discovered": string | null
  }
}`;

async function fetchLocalPresence(opts) {
  const queryName = (opts.businessName || opts.domain).trim();

  try {
    const places = await findBusinessOnPlaces({
      businessName: queryName,
      domain: opts.domain,
    });
    if (places) {
      console.log(
        `[places] ${opts.domain} matched → place_id=${places.placeId} name="${places.name}" rating=${places.rating} reviews=${places.reviewCount}`,
      );
      const tavily = await tavilySearch({
        query: `"${queryName}" site:facebook.com OR site:bingplaces.com`,
        maxResults: 5,
        searchDepth: 'basic',
      }).catch(() => null);
      const otherDirs = ((tavily && tavily.results) || []).map((r) => r.url.toLowerCase()).join(' ');
      return {
        google_business_profile: {
          is_complete: places.isComplete,
          rating: places.rating,
          review_count: places.reviewCount,
          has_opening_hours: places.hasOpeningHours,
          is_claimed: places.isLikelyClaimed,
          place_id: places.placeId,
          matched_name: places.name,
          matched_address: places.address,
        },
        directory_consistency: {
          facebook_found: otherDirs.includes('facebook.com'),
          google_maps_found: true,
          bing_maps_found: otherDirs.includes('bingplaces.com') || otherDirs.includes('bing.com/maps'),
          is_address_consistent: true,
        },
        contact_details: {
          phone_discovered: places.phone,
          email_discovered: null,
        },
      };
    }
  } catch (err) {
    console.warn('[local-presence] Places lookup failed, falling back to Tavily:', err);
  }

  // Fallback: Tavily search + Claude extraction
  const queries = [
    `"${queryName}" Google Business Profile rating reviews`,
    `"${queryName}" reviews stars`,
    `${queryName} site:maps.google.com OR site:google.com/maps`,
    `${queryName} site:facebook.com OR site:bingplaces.com`,
    `${queryName} contact phone email address`,
  ];

  const searches = await Promise.allSettled(
    queries.map((q) => tavilySearch({ query: q, maxResults: 5, searchDepth: 'advanced' })),
  );

  const allResults = searches
    .flatMap((s) => (s.status === 'fulfilled' ? s.value.results : []))
    .map((r) => `[${r.title}](${r.url})\n${r.content}`)
    .join('\n\n---\n\n')
    .slice(0, 14000);

  const answers = searches
    .map((s) => (s.status === 'fulfilled' ? s.value.answer : null))
    .filter(Boolean)
    .join('\n\n');

  const userMessage = `Business: ${queryName}
Website: ${opts.url}
Domain: ${opts.domain}

Web search snippets:
${allResults}

${answers ? `\nSearch summaries:\n${answers}\n` : ''}

Extract local presence into this exact JSON shape, in a \`\`\`json code block:
${SCHEMA_HINT}`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not set (needed for local-presence fallback)');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': anthropicKey,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Claude API error ${response.status} in local-presence`);
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const match = text.match(/```json\s*([\s\S]+?)```/);
  if (!match) throw new Error('Claude did not return a JSON block for local presence');

  const parsed = JSON.parse(match[1]);
  // is_complete is only true via the Places API path above
  if (parsed.google_business_profile) {
    parsed.google_business_profile.is_complete = false;
  }

  return parsed;
}

module.exports = { fetchLocalPresence };
