'use strict';

async function tavilySearch(opts) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: opts.query,
      max_results: opts.maxResults ?? 5,
      include_answer: opts.includeAnswer ?? true,
      search_depth: opts.searchDepth ?? "basic",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return await res.json();
}

module.exports = { tavilySearch };
