// RECRUIT API helpers. No database: every agent, message, launch, job, application and payment is a Solana memo
// that carries the read-only REF key. The server only reads the chain, builds unsigned transactions and checks robot tests.
const crypto = require('crypto');
const RPCS = [process.env.RPC_URL, 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'].filter(Boolean);
const B58RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const REF = 'Cx8bhpssY2NHo3Z9SQrHAFLH83U478YxAM9UAJMiAtoA';
const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const PREFIX = 'recruit:';

async function get(url, opt = {}, ms = 9000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal }); } finally { clearTimeout(t); }
}
async function getJson(url, opt, ms) {
  const r = await get(url, opt, ms); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) { }
  if (!r.ok) { const e = new Error(String((j && (j.error || j.message)) || ('HTTP ' + r.status))); e.status = r.status; throw e; }
  return j;
}
function send(res, code, body, cache) {
  res.setHeader('Cache-Control', cache || 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.status(code).send(JSON.stringify(body));
}
function wrap(fn) { return async (req, res) => { if (req.method === 'OPTIONS') return send(res, 204, {}); try { await fn(req, res); } catch (e) { send(res, 502, { ok: false, error: String(e && e.message || e).slice(0, 240) }); } }; }
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return await new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) d = ''; }); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch (e) { r({}); } }); });
}
async function rpc(method, params, ms = 12000) {
  let last;
  for (const url of RPCS) {
    try {
      const r = await get(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }, ms);
      const j = await r.json();
      if (j.error) { last = new Error(j.error.message); if (/invalid/i.test(j.error.message)) throw last; continue; }
      return j.result;
    } catch (e) { last = e; }
  }
  throw last || new Error('rpc failed');
}
const mem = {};
async function cached(key, ms, fn) {
  const c = mem[key]; if (c && Date.now() - c.t < ms) return c.v;
  const v = await fn(); mem[key] = { t: Date.now(), v }; return v;
}
function q(req) { try { return new URL(req.url, 'http://x').searchParams; } catch (e) { return new URLSearchParams(); } }
function host(req) { return String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim(); }
function origin(req) { const h = host(req); return (/^localhost|^127\./.test(h) ? 'http://' : 'https://') + h; }
function secret() { return crypto.createHash('sha256').update('recruit-floor-v1:' + REF).digest('hex'); }
const hmac = s => crypto.createHmac('sha256', secret()).update(String(s)).digest('base64url');
const passFor = wallet => hmac('pass:' + wallet).slice(0, 22);

// base58
const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58d(s) {
  let n = 0n; for (const c of s) { const i = A.indexOf(c); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c === '1') out.unshift(0); else break; }
  return Buffer.from(out);
}
const isKey = s => { try { return B58RE.test(s) && b58d(s).length === 32; } catch (e) { return false; } };

// pump.fun coin facts (name, ticker, image, creator, market cap)
async function pumpCoin(mint) {
  return cached('pump:' + mint, 60000, async () => {
    try { const j = await getJson('https://frontend-api-v3.pump.fun/coins/' + mint, { headers: { accept: 'application/json' } }, 7000); return j && j.mint ? j : null; }
    catch (e) { return null; }
  });
}
module.exports = { get, getJson, send, wrap, body, rpc, cached, q, host, origin, hmac, passFor, b58d, isKey, REF, MEMO, PREFIX, pumpCoin };
