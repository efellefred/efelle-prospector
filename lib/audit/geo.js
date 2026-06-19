'use strict';

/**
 * Generative Engine Optimization (GEO) / AI Optimization (AIO) analysis.
 *
 * Inspects scraped HTML / markdown for the signals that determine how
 * "recommendable" a site is to LLM-driven search engines (ChatGPT, Gemini,
 * Perplexity). Produces a 0–100 AI Recommendation Score using a weighted
 * formula across four pillars: technical access, formatting, trust, schema.
 */

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "anthropic-ai",
  "Claude-Web",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
];

function analyzeGeo(opts) {
  const blockedAiBots = findBlockedAiBots(opts.robotsTxtBody);
  const aiCrawlerAccess = blockedAiBots.length === 0;

  const answerFirstFormatting = detectAnswerFirstFormatting(opts.scrape.markdown);
  const factDensity = analyzeFactDensity(opts.scrape.markdown);
  // Schema is in <script type="application/ld+json"> tags — must use rawHtml
  // since Firecrawl strips script contents from the processed html field.
  const schemaIntegrity = analyzeSchema(opts.scrape.rawHtml || opts.scrape.html);
  const conversationalReadiness = analyzeConversationalReadiness(opts.scrape.markdown);
  const contentFreshness = analyzeFreshness(opts.scrape);

  // Weighted score per the GEO/AIO methodology.
  let score = 0;
  // Technical (20)
  if (aiCrawlerAccess) score += 10;
  if (opts.hasValidSitemap) score += 10;
  // Formatting (30)
  if (answerFirstFormatting) score += 15;
  if ((opts.readingEaseScore ?? 0) > 50) score += 15;
  // Trust (25) — domain age would be +15 here once WHOIS is wired; for now
  // we award partial credit (8) so scores remain comparable. Fact density
  // bumped to 17 to keep the trust pillar weighted.
  if (factDensity.factCount >= 5 || factDensity.hasStatistics) score += 17;
  if (factDensity.hasExpertQuotes) score += 8;
  // Schema (25)
  if (schemaIntegrity.hasLocalBusiness) score += 10;
  if (schemaIntegrity.hasFaqPage || schemaIntegrity.hasPerson) score += 15;

  return {
    aiCrawlerAccess,
    blockedAiBots,
    answerFirstFormatting,
    factDensity,
    schemaIntegrity,
    conversationalReadiness,
    contentFreshness,
    recommendationScore: Math.min(100, score),
  };
}

function findBlockedAiBots(robotsTxt) {
  if (!robotsTxt) return [];
  const lines = robotsTxt.split(/\r?\n/);
  const blocked = [];
  let currentAgents = [];

  for (const line of lines) {
    const ua = line.match(/^\s*user-agent\s*:\s*(\S+)/i);
    const dis = line.match(/^\s*disallow\s*:\s*(\S*)/i);
    if (ua) {
      // Multiple user-agent lines apply to the same block until a Disallow appears.
      if (currentAgents.length === 0 || dis) currentAgents = [];
      currentAgents.push(ua[1]);
      continue;
    }
    if (dis) {
      const path = dis[1] ?? "";
      if (path === "/" || path === "/*") {
        for (const agent of currentAgents) {
          if (AI_BOTS.some((b) => b.toLowerCase() === agent.toLowerCase())) {
            blocked.push(agent);
          }
        }
      }
      // Reset block group on next User-agent.
      currentAgents = [];
    }
  }
  return Array.from(new Set(blocked));
}

function detectAnswerFirstFormatting(markdown) {
  const lines = markdown.split("\n");
  let totalHeadings = 0;
  let answerFirst = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,3})\s+\S/);
    if (!m) continue;
    totalHeadings++;
    // Find the next non-empty paragraph.
    let body = "";
    for (let j = i + 1; j < lines.length && j < i + 6; j++) {
      const l = lines[j].trim();
      if (!l) continue;
      if (/^#{1,6}\s/.test(l)) break;
      body += " " + l;
      if (body.split(/\s+/).filter(Boolean).length >= 30) break;
    }
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 30 && wordCount <= 100) answerFirst++;
  }

  if (totalHeadings === 0) return false;
  // Treat as answer-first when at least half of headings have a 30–100 word
  // direct response paragraph.
  return answerFirst / totalHeadings >= 0.5;
}

function analyzeFactDensity(markdown) {
  // Statistics: numbers with units, percentages, year ranges, currency.
  const statPatterns = [
    /\b\d{1,3}\s*%/g,
    /\$\s*\d[\d,]*/g,
    /\b\d{4}\b/g, // years
    /\b\d+\+?\s*(years|yrs|months|days|customers|users|clients|projects|reviews|stars|awards|locations|markets)\b/gi,
    /\b\d+\s*(out of|in|of)\s*\d+/gi,
  ];
  let factCount = 0;
  let hasStatistics = false;
  for (const re of statPatterns) {
    const matches = markdown.match(re) ?? [];
    factCount += matches.length;
    if (matches.length >= 1) hasStatistics = true;
  }

  // Expert quotes: attribution patterns ("said", "explains", "according to").
  const quotePatterns = [
    /\b(said|says|explains|explained|notes|noted|points out|points|stated|argues|emphasizes)\b/gi,
    /according to\b/gi,
    /research (shows|suggests|indicates|finds)/gi,
    /studies show/gi,
  ];
  let hasExpertQuotes = false;
  for (const re of quotePatterns) {
    if (re.test(markdown)) {
      hasExpertQuotes = true;
      break;
    }
  }

  return { hasStatistics, hasExpertQuotes, factCount };
}

function analyzeSchema(html) {
  const detectedTypes = new Set();
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]+?)<\/script>/gi) ?? [];

  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
    try {
      const parsed = JSON.parse(inner);
      collectTypes(parsed, detectedTypes);
    } catch {
      // Invalid JSON-LD — skip.
    }
  }

  const types = Array.from(detectedTypes);
  const has = (t) => types.some((x) => x.toLowerCase() === t.toLowerCase());

  return {
    hasFaqPage: has("FAQPage"),
    hasPerson: has("Person"),
    hasLocalBusiness:
      has("LocalBusiness") ||
      has("ProfessionalService") ||
      has("Restaurant") ||
      has("Store") ||
      has("Dentist") ||
      has("Electrician") ||
      has("Plumber"),
    hasOrganization: has("Organization"),
    hasArticle: has("Article") || has("BlogPosting") || has("NewsArticle"),
    detectedTypes: types,
  };
}

function collectTypes(node, out) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out);
    return;
  }
  if (typeof node === "object") {
    const obj = node;
    const t = obj["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") out.add(x);
    if (obj["@graph"]) collectTypes(obj["@graph"], out);
  }
}

function analyzeConversationalReadiness(markdown) {
  // FAQ-style headings: "What is", "How do", "Why", "When", "Can I", "Does it"
  const headings = markdown.split("\n").filter((l) => /^#{1,4}\s/.test(l));
  let faqHeadings = 0;
  for (const h of headings) {
    if (/^(#{1,4})\s+(what|how|why|when|where|who|can|does|do |is |are |should)\b/i.test(h)) {
      faqHeadings++;
    }
  }
  const faqPromptMatching = faqHeadings >= 2;

  // Natural language proxy: average sentence length under 25 words.
  const sentences = markdown.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgWords = sentences.length
    ? sentences.reduce((acc, s) => acc + s.split(/\s+/).filter(Boolean).length, 0) / sentences.length
    : 0;
  // Score: 100 = avg sentence ≤ 12 words; 0 = avg ≥ 35.
  const naturalLanguageScore = Math.round(
    Math.max(0, Math.min(100, 100 - Math.max(0, avgWords - 12) * 4)),
  );

  return { faqPromptMatching, naturalLanguageScore };
}

function analyzeFreshness(scrape) {
  // Try to find a date in the content / metadata.
  const meta = scrape.metadata;
  const candidates = [
    meta.modifiedTime,
    meta["article:modified_time"],
    meta["og:updated_time"],
    meta.lastModified,
  ]
    .filter((v) => typeof v === "string");

  for (const c of candidates) {
    const d = new Date(c);
    if (!isNaN(d.getTime())) {
      const daysOld = Math.round((Date.now() - d.getTime()) / 86_400_000);
      return { lastModified: d.toISOString(), daysOld };
    }
  }

  // Look for "Updated" / "Last modified" in the text.
  const m = scrape.markdown.match(
    /(?:updated|last (?:updated|modified)|posted)\s*(?:on)?\s*[:\-]?\s*([A-Z][a-z]+\.?\s+\d{1,2},?\s*\d{4}|\d{4}-\d{2}-\d{2})/,
  );
  if (m && m[1]) {
    const d = new Date(m[1]);
    if (!isNaN(d.getTime())) {
      const daysOld = Math.round((Date.now() - d.getTime()) / 86_400_000);
      return { lastModified: d.toISOString(), daysOld };
    }
  }

  return { lastModified: null, daysOld: null };
}

module.exports = { analyzeGeo };
