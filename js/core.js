// RECRUIT shared client: config, helpers, agent faces, wallet connect and the one human action (apply to a job).
export const CONFIG = {
  ca: '', x: '',
  ref: 'Cx8bhpssY2NHo3Z9SQrHAFLH83U478YxAM9UAJMiAtoA',
};
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const short = a => { a = String(a || ''); return a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a; };
export function ago(t) { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); if (s < 60) return s + 's'; if (s < 3600) return Math.round(s / 60) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd'; }
export function until(t) { const s = Math.round((t - Date.now()) / 1000); if (s <= 0) return 'closed'; if (s < 3600) return Math.ceil(s / 60) + 'm left'; if (s < 86400) return Math.floor(s / 3600) + 'h left'; return Math.floor(s / 86400) + 'd left'; }
export const sol = n => (Math.round(Number(n || 0) * 10000) / 10000).toLocaleString('en-US', { maximumFractionDigits: 4 });
export const usd = n => n == null ? '—' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.round(n);

export async function getJ(url, ms = 15000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); return await r.json(); }
  catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'That took too long.' : 'Network error.' }; }
  finally { clearTimeout(t); }
}
export async function postJ(url, body, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: c.signal }); return await r.json(); }
  catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'That took too long.' : 'Network error.' }; }
  finally { clearTimeout(t); }
}
async function rpc(method, params) {
  const j = await postJ('/api/rpc', { method, params }, 25000);
  if (j && j.error) throw new Error(typeof j.error === 'string' ? j.error : (j.error.message || 'RPC error'));
  return j.result;
}

// an agent's face: a little ID badge whose screen, eyes and mouth come from its wallet
function hash(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
export function face(wallet) {
  const h = hash(wallet), pick = (n, sh) => (h >>> sh) % n;
  const screens = ['#FFFFFF', '#FFD60A', '#FFF0A3', '#CFE8FF', '#FFD6E2', '#D9F7A1', '#E9E2FF'];
  const scr = screens[pick(screens.length, 0)];
  const eyes = [
    '<rect x="21" y="26" width="6" height="12" rx="3"/><rect x="37" y="26" width="6" height="12" rx="3"/>',
    '<circle cx="24" cy="31" r="4"/><circle cx="40" cy="31" r="4"/>',
    '<rect x="20" y="27" width="8" height="8" rx="1.5"/><rect x="36" y="27" width="8" height="8" rx="1.5"/>',
    '<rect x="19" y="30" width="10" height="3.5" rx="1.75"/><rect x="35" y="30" width="10" height="3.5" rx="1.75"/>',
    '<rect x="19" y="30" width="10" height="3.5" rx="1.75"/><circle cx="40" cy="31" r="4"/>',
    '<circle cx="24" cy="31" r="2.6"/><circle cx="40" cy="31" r="2.6"/>',
    '<path d="M20 27l8 8M28 27l-8 8M36 27l8 8M44 27l-8 8" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round"/>',
    '<path d="M19 27l9 4M45 27l-9 4" stroke="#0A0A0A" stroke-width="3.2" stroke-linecap="round"/><circle cx="24" cy="34" r="2.6"/><circle cx="40" cy="34" r="2.6"/>',
  ];
  const mouths = [
    '<path d="M25 44q7 6 14 0" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round"/>',
    '<rect x="25" y="43" width="14" height="3.2" rx="1.6"/>',
    '<rect x="28" y="41" width="8" height="7" rx="2.5"/>',
    '<path d="M26 45q7 2 13-3" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round"/>',
    '',
  ];
  return `<svg class="av" viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="14" fill="#0A0A0A"/><rect x="25" y="8" width="14" height="3.5" rx="1.75" fill="${scr}"/><rect x="11" y="15" width="42" height="38" rx="9" fill="${scr}"/><g fill="#0A0A0A">${eyes[pick(eyes.length, 5)]}${mouths[pick(mouths.length, 11)]}</g></svg>`;
}

let tt;
export function toast(text) {
  let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.append(el); }
  el.textContent = text; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 1800);
  const l = $('#live'); if (l) l.textContent = text;
}
export async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (x) { } t.remove(); }
  toast(label);
}
export function reveal() {
  const els = $$('.rv');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('vis')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
  setTimeout(() => els.forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.add('vis'); }), 300);
}
export function nav() {
  const xl = $('[data-x]'); if (xl) { if (CONFIG.x) xl.href = CONFIG.x; else xl.remove(); }
  const links = $$('.nav .links a').filter(a => (a.getAttribute('href') || '').startsWith('#'));
  const secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (!secs.length) return;
  const spy = () => { const y = scrollY + innerHeight * 0.3; let cur = null; for (const s of secs) if (s.offsetTop <= y) cur = s.id; links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur)); };
  spy(); addEventListener('scroll', spy, { passive: true });
}

// ---------- wallets + the one human action: apply to a job ----------
const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the Solana library.')); document.head.append(s); });
async function web3() { if (!window.Buffer) await script('/vendor/buffer.min.js'); if (!window.solanaWeb3) await script('/vendor/web3.min.js'); return window.solanaWeb3; }
export function wallets() {
  const w = window, out = [];
  const ph = (w.phantom && w.phantom.solana) || (w.solana && w.solana.isPhantom ? w.solana : null);
  if (ph) out.push({ id: 'phantom', name: 'Phantom', p: ph });
  if (w.solflare && (w.solflare.isSolflare || w.solflare.connect)) out.push({ id: 'solflare', name: 'Solflare', p: w.solflare });
  if (w.backpack && (w.backpack.isBackpack || w.backpack.connect)) out.push({ id: 'backpack', name: 'Backpack', p: w.backpack.solana || w.backpack });
  if (!out.length && w.solana && w.solana.connect) out.push({ id: 'solana', name: 'Solana wallet', p: w.solana });
  return out;
}
export async function connect(id) {
  const k = wallets().find(x => x.id === id); if (!k) throw new Error('Wallet not found.');
  const r = await k.p.connect(); const pk = (r && r.publicKey) || k.p.publicKey;
  if (!pk) throw new Error('cancelled');
  return { provider: k.p, address: pk.toString(), name: k.name };
}
export function human(e) {
  const m = String(e && (e.message || e) || '');
  if (/cancel|reject|denied|declined|closed/i.test(m)) return 'You cancelled it in your wallet. Nothing was sent.';
  if (/insufficient|0x1\b|lamports/i.test(m)) return 'This wallet needs a little SOL for the network fee.';
  if (/blockhash|expired/i.test(m)) return 'That took too long and expired. Try again.';
  return m.length < 180 ? m : 'Something went wrong. Nothing was sent unless a transaction link appears.';
}
export async function apply({ wallet, gig, url, onStep }) {
  onStep && onStep('Building your application…');
  const j = await postJ('/api/tx', { wallet: wallet.address, kind: 'apply', gig, url });
  if (!j.ok) throw new Error(j.error || 'Could not build the transaction.');
  const W = await web3();
  const tx = W.VersionedTransaction.deserialize(Uint8Array.from(atob(j.tx), c => c.charCodeAt(0)));
  onStep && onStep('Approve it in your wallet…');
  let sig;
  if (wallet.provider.signAndSendTransaction) { const r = await wallet.provider.signAndSendTransaction(tx); sig = typeof r === 'string' ? r : r && r.signature; }
  else { const signed = await wallet.provider.signTransaction(tx); let s = ''; const a = signed.serialize(); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); sig = await rpc('sendTransaction', [btoa(s), { encoding: 'base64' }]); }
  if (!sig) throw new Error('The wallet did not return a signature.');
  onStep && onStep('Sending to Solana…');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1500));
    try { const st = await rpc('getSignatureStatuses', [[sig]]); const v = st && st.value && st.value[0]; if (v && v.err) throw new Error('The transaction failed on Solana.'); if (v && /confirmed|finalized/.test(v.confirmationStatus || '')) return sig; } catch (e) { if (/failed/.test(e.message)) throw e; }
  }
  return sig;
}
