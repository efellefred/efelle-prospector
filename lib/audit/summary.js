'use strict';

// Calls Claude to write the executive summary, priority actions, and closing
// from confirmed (API-verified) findings. This is the ONLY AI-generated content
// in the report — everything else is data-driven.

async function generateSummary(wsrJson, anthropicKey) {
  if (!anthropicKey) {
    return fillDefaults(wsrJson);
  }

  const issuesList = wsrJson.categories
    .flatMap(cat => (cat.issues || []).map(issue => ({
      category: cat.label,
      score: cat.score,
      title: issue.title,
      description: issue.description,
      severity: issue.severity,
    })))
    .filter(i => i.severity === 'critical' || i.severity === 'moderate');

  if (issuesList.length === 0) {
    wsrJson.executive_summary = `${wsrJson.client_name}'s website is performing well across all measured categories. The audit found no critical issues. Minor improvements are outlined below.`;
    wsrJson.priority_actions = [];
    wsrJson.closing = `We'd love to discuss how efelle can help ${wsrJson.client_name} build on this strong foundation and capture more opportunities online. Contact us to schedule a strategy call.`;
    return wsrJson;
  }

  const prompt = `You are writing the executive summary for a website audit report for "${wsrJson.client_name}"${wsrJson.industry ? ` (${wsrJson.industry})` : ''}.

Overall score: ${wsrJson.overall_score}/100

Category scores:
${wsrJson.categories.map(c => `- ${c.label}: ${c.score}/100 (${c.issues.length} issues found)`).join('\n')}

Confirmed issues (all verified by API — these are REAL, not guesses):
${issuesList.map(i => `- [${i.severity.toUpperCase()}] ${i.category}: ${i.title} — ${i.description}`).join('\n')}

Write:
1. executive_summary: 2-3 sentences contextualizing these findings for this specific business. Be specific — reference actual scores and key issues. Do not be generic.
2. priority_actions: Top 5 actions ranked by business impact. Each has: rank (1-5), title (short action phrase), why (1 sentence explaining business impact), effort ("quick-win", "medium", or "major")
3. closing: 1 short paragraph with a call-to-action to discuss these findings with efelle creative

Return ONLY valid JSON with these three fields. No markdown fences, no explanation.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': anthropicKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn('[summary] Claude API error:', response.status);
      return fillDefaults(wsrJson);
    }

    const data = await response.json();
    let text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Clean markdown fences
    text = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const arrStart = text.indexOf('{');
    const arrEnd = text.lastIndexOf('}');
    if (arrStart !== -1 && arrEnd > arrStart) {
      text = text.slice(arrStart, arrEnd + 1);
    }

    const summary = JSON.parse(text);
    if (summary.executive_summary) wsrJson.executive_summary = summary.executive_summary;
    if (summary.priority_actions) wsrJson.priority_actions = summary.priority_actions;
    if (summary.closing) wsrJson.closing = summary.closing;

    return wsrJson;
  } catch (err) {
    console.warn('[summary] Failed to generate summary:', err.message);
    return fillDefaults(wsrJson);
  }
}

function fillDefaults(wsrJson) {
  const criticalCount = wsrJson.categories.reduce((n, c) =>
    n + (c.issues || []).filter(i => i.severity === 'critical').length, 0);

  wsrJson.executive_summary = `This audit of ${wsrJson.client_name}'s website identified ${criticalCount} critical issue${criticalCount !== 1 ? 's' : ''} across ${wsrJson.categories.filter(c => c.issues.length > 0).length} categories. The overall score is ${wsrJson.overall_score}/100. Addressing the critical items below will have the most immediate impact on search visibility and lead generation.`;

  // Build priority actions from the top critical/moderate issues
  const allIssues = wsrJson.categories
    .flatMap(cat => (cat.issues || []).map(i => ({ ...i, category: cat.label })));
  const sorted = allIssues
    .filter(i => i.severity === 'critical' || i.severity === 'moderate')
    .sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));

  wsrJson.priority_actions = sorted.slice(0, 5).map((issue, idx) => ({
    rank: idx + 1,
    title: issue.title,
    why: `${issue.description} This impacts your ${issue.category.toLowerCase()} performance.`,
    effort: issue.severity === 'critical' ? 'quick-win' : 'medium',
  }));

  wsrJson.closing = `These findings represent real opportunities to improve ${wsrJson.client_name}'s online presence. efelle creative can help implement these improvements — contact us to discuss a strategy tailored to your business.`;

  return wsrJson;
}

module.exports = { generateSummary };
