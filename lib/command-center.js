// ─── Command Center handoff: signed proposal → the Client Record ───────
// On acceptance the signed offer is published to the Command Center's
// client-record API (efelle-contracts BOUNDARIES.md: Prospector may mint a
// record and writes the offer slice; Command Center owns everything else).
// Fire-and-forget like the HubSpot sync — it never blocks or breaks signing.
//
// Env (set in the Railway dashboard, never committed):
//   COMMAND_CENTER_URL           default https://efelle-command-center.vercel.app
//   COMMAND_CENTER_RECORD_TOKEN  the shared bearer (PROSPECTOR_RECORD_TOKEN's value)

// Read at call time, not require time — server.js parses .env after requires.
const ccUrl = () => (process.env.COMMAND_CENTER_URL || 'https://efelle-command-center.vercel.app').replace(/\/$/, '');
const ccToken = () => process.env.COMMAND_CENTER_RECORD_TOKEN || '';

const unescapeAttr = (s) => String(s).replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/**
 * Derive the contract's offer slice from a signed published record.
 * Amounts come from the signed doc's own option checkboxes — the same
 * source of truth the acceptance endpoint validates selections against —
 * filtered to what the client actually selected. The efelle-offer-data
 * marker (embedded at generation) adds identity and payment structure;
 * proposals published before the marker existed still produce an offer,
 * just without company details.
 */
function ccParseOffer(rec) {
  let meta = {};
  const mm = /id="efelle-offer-data"[^>]*data-offer="([^"]*)"/.exec(rec.html || '');
  if (mm) { try { meta = JSON.parse(unescapeAttr(mm[1])); } catch (e) { /* marker unreadable → no company details */ } }

  const opts = {};
  ((rec.html || '').match(/<input[^>]*class="prog-opt-check"[^>]*>/g) || []).forEach(tag => {
    const k = /data-opt="([a-z_0-9]{1,30})"/.exec(tag);
    if (!k) return;
    const label = /data-label="([^"]*)"/.exec(tag);
    opts[k[1]] = {
      label: unescapeAttr((label && label[1]) || k[1]).slice(0, 150),
      mprice: parseInt((/data-mprice="(\d{1,6})"/.exec(tag) || [])[1] || '0', 10),
      oprice: parseInt((/data-oprice="(\d{1,6})"/.exec(tag) || [])[1] || '0', 10),
    };
  });
  const selected = new Set(((rec.accepted && rec.accepted.options) || []).map(o => o.key));
  const baseMatch = /id="monthly-total" data-base="(\d{1,6})"/.exec(rec.html || '');
  const base = baseMatch ? parseInt(baseMatch[1], 10) : 0;

  const offer = {};
  const recurring = [];
  // New-site programs start at launch; WO / RGS-only programs start month one.
  const startsOn = meta.type === 'new_website' ? 'launch' : 'signature';

  if (selected.has('website') && opts.website) {
    const total = opts.website.oprice || 0;
    if (total > 0) {
      const depositPct = Number(meta.depositPct) > 0 ? Number(meta.depositPct) : 50;
      offer.oneTime = { total, deposit: Math.round(total * depositPct / 100) };
      const n = Number(meta.installments) || 0;
      if (n > 0) {
        offer.oneTime.schedule = { installments: n, amount: Math.round((total - offer.oneTime.deposit) / n), interest: 0 };
      }
    }
    if (opts.website.mprice > 0) {
      recurring.push({ label: 'Hosting & support', amount: opts.website.mprice, cadence: 'monthly', startsOn: 'launch' });
    }
  }
  if (selected.has('rgs') && opts.rgs && opts.rgs.mprice > 0) {
    recurring.push({ label: 'RGS program', amount: opts.rgs.mprice, cadence: 'monthly', startsOn });
  }
  for (const key of selected) {
    if (key.indexOf('addon_') === 0 && opts[key] && opts[key].mprice > 0) {
      recurring.push({ label: opts[key].label, amount: opts[key].mprice, cadence: 'monthly', startsOn });
    }
  }
  // RGS-only docs have no program checkboxes — the base program IS the deal.
  if (meta.type === 'rgs_only' && base > 0 && !recurring.some(r => r.label === 'RGS program')) {
    recurring.push({ label: 'RGS program', amount: base, cadence: 'monthly', startsOn: 'signature' });
  }
  if (recurring.length) offer.recurring = recurring;
  if (meta.type === 'wo_rgs') offer.projectType = 'workOrder';

  offer.signature = {
    acceptedBy: (rec.accepted && rec.accepted.name) || '',
    acceptedAt: new Date((rec.accepted && rec.accepted.t) || Date.now()).toISOString(),
    ref: rec.token,
  };
  return { offer, meta };
}

async function ccFetch(path, opts = {}) {
  return fetch(ccUrl() + path, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + ccToken(),
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

/** Find the Client Record by exact display name, or mint one with the company slice. */
async function ccFindOrMint(rec, meta) {
  const want = String(rec.company || '').trim().toLowerCase();
  if (!want) throw new Error('published record has no company name');

  const q = await ccFetch('/api/clients?q=' + encodeURIComponent(rec.company.trim()));
  if (q.ok) {
    const list = (await q.json()).clients || [];
    const hit = list.find(c => String(c.display_name || '').trim().toLowerCase() === want);
    if (hit) return { id: hit.id, minted: false };
  }

  const email = meta.email || (Array.isArray(rec.contactEmails) && rec.contactEmails[0]) || '';
  const address = {};
  if (meta.street) address.line1 = meta.street;
  if (meta.city) address.city = meta.city;
  if (meta.state) address.state = meta.state;
  if (meta.zip) address.postalCode = meta.zip;
  const owner = {};
  if (rec.accepted && rec.accepted.name) owner.fullName = rec.accepted.name;
  if (email) owner.email = email;
  const company = { legalName: rec.company.trim() };
  if (meta.website) company.website = meta.website;
  if (meta.phone) company.phone = meta.phone;
  if (Object.keys(address).length) company.address = address;
  if (Object.keys(owner).length) company.owner = owner;

  const res = await ccFetch('/api/clients', {
    method: 'POST',
    body: JSON.stringify({ displayName: rec.company.trim(), company }),
  });
  if (!res.ok) throw new Error('mint failed: ' + res.status + ' ' + (await res.text()).slice(0, 300));
  return { id: (await res.json()).id, minted: true };
}

/** The whole handoff. Call fire-and-forget after an acceptance is recorded. */
async function ccPublishSignedOffer(rec) {
  if (!ccToken()) {
    console.log('Command Center handoff skipped: COMMAND_CENTER_RECORD_TOKEN is not set');
    return { skipped: true };
  }
  try {
    const { offer, meta } = ccParseOffer(rec);
    const { id, minted } = await ccFindOrMint(rec, meta);
    const res = await ccFetch('/api/clients/' + id, { method: 'PATCH', body: JSON.stringify({ offer }) });
    if (!res.ok) throw new Error('offer patch failed: ' + res.status + ' ' + (await res.text()).slice(0, 300));
    console.log('Command Center: signed offer published to ' + id + ' ("' + rec.company + '", record ' + (minted ? 'minted' : 'matched') + ')');
    return { ok: true, id, minted };
  } catch (err) {
    console.error('Command Center handoff failed (non-fatal, signing already recorded):', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { ccParseOffer, ccPublishSignedOffer };
