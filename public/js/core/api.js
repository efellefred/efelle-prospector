import { API_MODEL } from './state.js';

export function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-session-token': sessionStorage.getItem('prospector_token') || '',
  };
}

export function repairJSON(raw) {

  let s = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/,'').trim();


  s = s.replace(/^[\u0000-\u001F\uFEFF]+/, '');


  const start = s.indexOf('{');
  if (start === -1) return s;
  s = s.slice(start);


  let depth = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{' || c === '[') depth.push(c);
    else if (c === '}' || c === ']') {
      if (depth.length > 0) depth.pop();
      if (depth.length === 0) { s = s.slice(0, i + 1); break; }
    }
  }


  if (depth.length > 0) {
    s = s.trimEnd().replace(/,\s*$/, '');
    for (let i = depth.length - 1; i >= 0; i--) {
      s += depth[i] === '{' ? '}' : ']';
    }
  }



  let fixed = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { fixed += c; esc = false; continue; }
    if (c === '\\') { fixed += c; esc = true; continue; }
    if (c === '"') { inStr = !inStr; fixed += c; continue; }
    if (inStr && (c === '\n' || c === '\r' || c === '\t')) {
      fixed += c === '\n' ? '\\n' : c === '\r' ? '\\r' : '\\t';
      continue;
    }
    fixed += c;
  }
  return fixed;
}

export async function callAPI(prompt, system, useSearch, maxTokens) {
  const messages = [{ role:'user', content: prompt }];
  const headers  = getApiHeaders();
  const body = {
    model: API_MODEL,
    max_tokens: maxTokens || 3000,
    system: system,
    messages
  };
  if (useSearch) {
    body.tools = [{ type:'web_search_20250305', name:'web_search' }];
  }

  const res = await fetch('/api/messages', {
    method:'POST', headers, body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('');
}

export async function callWithWebSearch(system, prompt, maxTokens, onStatus) {
  const mt = maxTokens || 4000;
  const TOOLS = [{ type: 'web_search_20250305', name: 'web_search' }];

  // No training-data fallback. If live web search fails for any reason, we throw
  // so the caller surfaces a clear error message rather than silently populating
  // fields with potentially hallucinated data.

  try {
    const messages = [{ role: 'user', content: prompt }];
    let lastText = '';

    for (let turn = 0; turn < 5; turn++) {
      let res, d;
      for (let retry = 0; retry < 3; retry++) {
        if (retry > 0) {
          if (onStatus) onStatus('Rate limited — retrying in ' + (retry * 5) + 's…', 'warn');
          await new Promise(r => setTimeout(r, retry * 5000));
        }
        res = await fetch('/api/messages', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            model: API_MODEL,
            max_tokens: mt,
            system,
            tools: TOOLS,
            messages
          })
        });
        if (res.ok) break;
        if (res.status === 429 || res.status === 529) continue;
        const errBody = await res.text();
        console.warn('callWithWebSearch: API error turn ' + turn + ' (' + res.status + '): ' + errBody.slice(0, 200));
        throw new Error('Research failed: API error ' + res.status + '. Please try again.');
      }
      if (!res.ok) throw new Error('Research failed: rate limited after retries. Please wait a minute and try again.');

      d = await res.json();
      const content = d.content || [];

      const turnText = content.filter(b => b.type === 'text' && b.text).map(b => b.text).join('').trim();
      if (turnText) lastText = turnText;

      const serverToolBlocks = content.filter(b => b.type === 'server_tool_use');
      if (onStatus && serverToolBlocks.length > 0) {
        serverToolBlocks.forEach(b => {
          const q = b.input && b.input.query ? b.input.query : 'web search';
          onStatus('Searching: ' + q, 'searching');
        });
      }

      if (d.stop_reason === 'end_turn') {
        if (onStatus) onStatus('Compiling profile data…', 'building');
        if (lastText) return lastText;
        break;
      }

      if (d.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content });

        const toolUseBlocks = content.filter(b => b.type === 'tool_use');
        if (onStatus && toolUseBlocks.length > 0) {
          toolUseBlocks.forEach(b => {
            const q = b.input && b.input.query ? b.input.query : b.name;
            onStatus('Searching: ' + q, 'searching');
          });
        }

        const hasResults = content.some(b => b.type === 'tool_result');
        if (hasResults) {
          if (onStatus) onStatus('Processing results…', 'info');
          messages.push({ role: 'user', content: 'Please continue and provide the requested JSON output based on the search results above.' });
          continue;
        }

        // Web search returned no results — fail hard rather than fall back to training data.
        if (toolUseBlocks.length === 0) break;
        throw new Error('Research failed: web search returned no results for this URL. Please try again or fill in the fields manually.');
      }

      break;
    }

    if (lastText) return lastText;
    throw new Error('Research failed: web search completed but returned no usable data. Please try again or fill in the fields manually.');

  } catch (err) {
    // Re-throw all errors — no silent fallback to training data.
    throw err;
  }
}
