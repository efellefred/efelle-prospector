'use strict';

const SYSTEM_PROMPT = `You are a competitive intelligence analyst for a marketing agency.

Your task: identify the 3 best local competitors for a given business website.

Definition of "best local competitor":
- Operates in the same geographic market (city, region, or service area) as the client.
- Offers similar core services or products.
- Targets similar customers.
- Has an active, working website.
- Comparable in size to the client, or larger. Avoid much smaller / hobbyist competitors.

Workflow:
1. Use web_search to learn about the client business: services offered, location, target customer. Visit their site if useful.
2. Use web_search to find direct competitors operating in the same location.
3. Verify each candidate is currently in business and has a working website that loads.
4. Pick 3 that best match the criteria above.

Output: a single JSON code block with EXACTLY 3 competitors. Format:

\`\`\`json
{
  "competitors": [
    {
      "url": "https://example.com",
      "name": "Example Inc",
      "rationale": "Seattle-based web design agency offering similar services with a comparable team size; targets the same SMB market as the client."
    }
  ]
}
\`\`\`

Each rationale: 1-2 sentences. Mention their services, their location relative to the client, and what makes them comparable.

Hard rules:
- Do NOT include the client itself.
- Pick competitors that ACTUALLY EXIST and are currently active. Verify with web_search.
- If you cannot find 3 strong local competitors, return fewer rather than fabricate.
- Each url must be the homepage of the competitor (https://...), not a directory listing.
- Use web_search liberally; do not rely solely on memory.`;

const RATIONALE_SYSTEM_PROMPT = `You are a competitive intelligence analyst for a marketing agency.

Your task: for each competitor URL provided, write a 1-2 sentence rationale describing how that competitor compares to the client business, and extract the competitor's canonical company name.

Each rationale should mention:
- Their geographic market relative to the client (same city / region / national)
- Their core services and how they overlap with the client's
- Their target customer and what makes them a meaningful competitor

Workflow:
1. Use web_search to learn about the client business: services offered, location, target customer.
2. For each competitor URL, use web_search to learn about them: services, location, target customer.
3. Write a 1-2 sentence rationale for each, in the same style and length as if you had picked them yourself.

Output: a single JSON code block, exactly one entry per input URL:

\`\`\`json
{
  "results": [
    {
      "url": "https://example.com",
      "name": "Example Inc",
      "rationale": "Seattle-based web design agency offering similar services with a comparable team size; targets the same SMB market as the client."
    }
  ]
}
\`\`\`

Hard rules:
- Output exactly one entry per input URL, in the same order.
- Each url in your output must match the input url exactly.
- If you cannot find information on a competitor, still include them with a brief rationale based on what you know about the domain.
- Use web_search liberally; do not rely solely on memory.`;

async function callClaude(systemPrompt, userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    throw new Error('Claude API error ' + response.status);
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter(function(b) { return b.type === 'text'; })
    .map(function(b) { return b.text; })
    .join('\n');

  const match = text.match(/```json\s*([\s\S]+?)```/);
  if (!match) {
    throw new Error('Claude did not return a JSON block');
  }

  return JSON.parse(match[1]);
}

async function suggestCompetitors(clientUrl, opts) {
  opts = opts || {};
  var count = opts.count || 3;

  var lines = ['Find ' + count + ' best local competitor' + (count === 1 ? '' : 's') + ' for this business: ' + clientUrl];
  if (opts.excludeUrls && opts.excludeUrls.length > 0) {
    lines.push('');
    lines.push('Do NOT suggest any of these URLs (they have already been considered or rejected):');
    for (var i = 0; i < opts.excludeUrls.length; i++) {
      lines.push('- ' + opts.excludeUrls[i]);
    }
  }
  if (count === 1) {
    lines.push('');
    lines.push('Output the JSON block with exactly 1 competitor in the array.');
  }

  var parsed = await callClaude(SYSTEM_PROMPT, lines.join('\n'));
  var competitors = (parsed.competitors || []).filter(function(c) {
    return c && typeof c.url === 'string' && typeof c.name === 'string' && typeof c.rationale === 'string';
  });

  return competitors;
}

async function rationalizeCompetitors(clientUrl, competitorUrls) {
  if (!competitorUrls || competitorUrls.length === 0) return [];

  var lines = [
    'Client business: ' + clientUrl,
    '',
    'Write a rationale for each of these competitor URLs (in this exact order):',
  ];
  for (var i = 0; i < competitorUrls.length; i++) {
    lines.push('- ' + competitorUrls[i]);
  }

  var parsed = await callClaude(RATIONALE_SYSTEM_PROMPT, lines.join('\n'));
  return (parsed.results || []).filter(function(c) {
    return c && typeof c.url === 'string' && typeof c.name === 'string' && typeof c.rationale === 'string';
  });
}

module.exports = { suggestCompetitors, rationalizeCompetitors };
