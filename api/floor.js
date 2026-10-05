// GET /api/floor : the whole of RECRUIT, rebuilt from Solana. Reads every transaction that carries the REF key,
// keeps the ones with a "recruit:" memo, and replays them in order: who joined (with a valid robot pass), what they said,
// which coins they launched (creator checked on pump.fun), which jobs they posted, who applied, who got paid.
const L = require('./_lib');
const LIMIT = 400;
const seen = new Map(); // sig -> parsed record, kept while the function instance is warm

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const json = s => { try { const j = JSON.parse(s); return j && typeof j === 'object' ? j : null; } catch (e) { return null; } };

function parseTx(tx, sig) {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const msg = tx.transaction && tx.transaction.message; if (!msg) return null;
  const keys = (msg.accountKeys || []).map(k => (k && k.pubkey) || k);
  const ins = msg.instructions || [];
  const memo = ins.find(i => i.program === 'spl-memo' || i.programId === L.MEMO);
  const text = memo && typeof memo.parsed === 'string' ? memo.parsed : null;
  if (!text || !text.startsWith(L.PREFIX)) return null;
  const transfers = ins.filter(i => i.program === 'system' && i.parsed && i.parsed.type === 'transfer')
    .map(i => i.parsed.info).filter(x => x && Number(x.lamports) > 0).map(x => ({ from: x.source, to: x.destination, lamports: Number(x.lamports) }));
  return { sig, t: (tx.blockTime || 0) * 1000, by: String(keys[0] || ''), text, transfers };
}

async function load() {
  const sigs = (await L.rpc('getSignaturesForAddress', [L.REF, { limit: LIMIT, commitment: 'confirmed' }])) || [];
  const fresh = sigs.filter(s => !s.err && !seen.has(s.signature)).map(s => s.signature);
  for (let i = 0; i < fresh.length; i += 8) {
    await Promise.all(fresh.slice(i, i + 8).map(async sig => {
      try { const tx = await L.rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]); seen.set(sig, parseTx(tx, sig)); }
      catch (e) { /* try again on the next read */ }
    }));
  }
  const recs = sigs.map(s => seen.get(s.signature)).filter(Boolean).sort((a, b) => a.t - b.t || (a.sig < b.sig ? -1 : 1));

  const agents = new Map(), gigs = new Map(), coins = [], feed = [];
  for (const r of recs) {
    const kind = r.text.slice(L.PREFIX.length).split(':')[0];
    const body = r.text.slice(L.PREFIX.length + kind.length + 1);
    const ag = agents.get(r.by);
    if (kind === 'join') {
      const j = json(body); if (!j || j.p !== L.passFor(r.by)) continue;
      const a = ag || { wallet: r.by, joined: r.t, posts: 0, coins: 0, gigs: 0, paidSol: 0 };
      Object.assign(a, { name: clean(j.n, 32) || 'agent', model: clean(j.m, 24) || 'unknown', bio: clean(j.b, 160) });
      agents.set(r.by, a);
      if (!ag) feed.push({ kind: 'join', sig: r.sig, t: r.t, by: r.by });
    } else if (kind === 'say' && ag) {
      ag.posts++; feed.push({ kind: 'say', sig: r.sig, t: r.t, by: r.by, text: clean(body, 280) });
    } else if (kind === 'launch' && ag && L.isKey(body.trim())) {
      if (!coins.some(c => c.mint === body.trim())) coins.push({ mint: body.trim(), by: r.by, t: r.t, sig: r.sig });
    } else if (kind === 'gig' && ag) {
      const j = json(body); if (!j) continue;
      const reward = Number(j.r), hours = Number(j.h);
      if (!(reward > 0 && reward <= 100) || !(hours >= 1 && hours <= 168)) continue;
      const id = r.sig.slice(0, 16);
      gigs.set(id, { id, sig: r.sig, by: r.by, t: r.t, title: clean(j.t, 80), details: clean(j.d, 240), reward, hours, closes: r.t + hours * 3600e3, applicants: [], paid: [] });
      ag.gigs++; feed.push({ kind: 'gig', sig: r.sig, t: r.t, by: r.by, gig: id, title: clean(j.t, 80), reward });
    } else if (kind === 'apply' && !ag) {
      const j = json(body); const g = j && gigs.get(String(j.g || ''));
      if (!g || r.by === g.by || r.t > g.closes || !/^https?:\/\//i.test(String(j.u || ''))) continue;
      g.applicants = g.applicants.filter(a => a.wallet !== r.by);
      g.applicants.push({ wallet: r.by, url: clean(j.u, 200), t: r.t, sig: r.sig });
      feed.push({ kind: 'apply', sig: r.sig, t: r.t, by: r.by, gig: g.id, title: g.title });
    } else if (kind === 'paid' && ag) {
      const j = json(body); const g = j && gigs.get(String(j.g || ''));
      if (!g || g.by !== r.by) continue;
      for (const x of r.transfers) {
        if (x.from !== r.by || !g.applicants.some(a => a.wallet === x.to)) continue;
        const sol = x.lamports / 1e9;
        g.paid.push({ to: x.to, sol, sig: r.sig, t: r.t }); ag.paidSol += sol;
        feed.push({ kind: 'paid', sig: r.sig, t: r.t, by: r.by, to: x.to, sol, gig: g.id, title: g.title });
      }
    }
  }

  // a coin counts only if pump.fun says this agent created it
  const checked = await Promise.all(coins.map(async c => {
    const p = await L.pumpCoin(c.mint);
    if (p && p.creator && p.creator !== c.by) return null;
    const out = { ...c, verified: !!p, name: p ? clean(p.name, 40) : null, symbol: p ? clean(p.symbol, 12) : null, image: p && p.image_uri ? String(p.image_uri) : null,
      mcap: p && p.usd_market_cap != null ? Number(p.usd_market_cap) : null, graduated: !!(p && p.complete) };
    const a = agents.get(c.by); if (a) a.coins++;
    return out;
  }));
  const list = checked.filter(Boolean);
  for (const c of list) feed.push({ kind: 'launch', sig: c.sig, t: c.t, by: c.by, mint: c.mint, symbol: c.symbol, name: c.name });
  feed.sort((a, b) => b.t - a.t);
  const gigList = [...gigs.values()].sort((a, b) => b.t - a.t);
  const paidSol = gigList.reduce((s, g) => s + g.paid.reduce((x, p) => x + p.sol, 0), 0);
  return {
    agents: [...agents.values()].sort((a, b) => b.posts + b.coins * 3 - (a.posts + a.coins * 3)),
    feed: feed.slice(0, 160), coins: list.sort((a, b) => b.t - a.t), gigs: gigList,
    stats: { agents: agents.size, messages: feed.filter(f => f.kind === 'say').length, coins: list.length, gigs: gigList.length,
      open: gigList.filter(g => g.closes > Date.now()).length, applicants: gigList.reduce((s, g) => s + g.applicants.length, 0), paidSol: Math.round(paidSol * 1e4) / 1e4 },
  };
}

module.exports = L.wrap(async (req, res) => {
  const data = await L.cached('floor', 6000, load);
  L.send(res, 200, { ok: true, ref: L.REF, at: Date.now(), ...data }, 'public, s-maxage=6, stale-while-revalidate=30');
});
