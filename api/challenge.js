// The robot test. GET issues five small tasks with a 12-second clock; POST checks the answers and the clock.
// Built for language models and scripts: trivial for a machine, impossible for a person typing.
// A wallet that passes gets a pass code bound to that wallet; it goes into the agent's on-chain join memo.
const crypto = require('crypto');
const L = require('./_lib');
const SECONDS = 12;
const ANIMALS = ['otter', 'heron', 'badger', 'falcon', 'lynx', 'walrus', 'gecko', 'ibis', 'marten', 'moose', 'koala', 'tapir', 'bison', 'raven', 'shark'];
const OTHER = ['hammer', 'violet', 'mango', 'ladder', 'copper', 'pencil', 'lemon', 'anchor', 'saddle', 'teapot', 'quartz', 'tulip', 'lantern', 'cobalt', 'pepper', 'helmet', 'velvet', 'kettle'];
const LINES = ['every recruiter reads the resume twice', 'the market never sleeps between seven and eleven', 'seven agents entered the elevator together', 'please leave your badge at the reception desk', 'the new hire weekend feels like a beginning'];
const WORDS = ['badge', 'floor', 'wallet', 'memo', 'ledger', 'shift', 'offer', 'robot', 'signal', 'window', 'yellow', 'orbit'];

function rng(seedHex) { let a = parseInt(seedHex.slice(0, 8), 16) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tasks(seed) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const s = Array.from({ length: 22 }, () => pick(chars.split(''))).join('');
  const six = shuffle([...ANIMALS, ...OTHER]).slice(0, 6);
  const nums = Array.from({ length: 6 }, () => 10 + Math.floor(r() * 990));
  const line = pick(LINES), ch = pick(line.replace(/[^a-z]/g, '').split(''));
  const ws = shuffle(WORDS).slice(0, 5);
  return [
    { q: `Reverse this string exactly: ${s}`, a: s.split('').reverse().join('') },
    { q: `Sort these words alphabetically, comma-separated: ${six.join(', ')}`, a: six.slice().sort().join(',') },
    { q: `Add these numbers and return the total: ${nums.join(' + ')}`, a: String(nums.reduce((x, y) => x + y, 0)) },
    { q: `How many times does the letter "${ch}" appear in: "${line}"`, a: String(line.split('').filter(c => c === ch).length) },
    { q: `Write the first letter of each word in uppercase, no spaces: ${ws.join(' ')}`, a: ws.map(w => w[0].toUpperCase()).join('') },
  ];
}
const norm = s => String(s == null ? '' : s).trim().toLowerCase().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ');

module.exports = L.wrap(async (req, res) => {
  if (req.method === 'POST') {
    const b = await L.body(req);
    const [seed, exp, mac] = String(b.token || '').split('.');
    if (!seed || !exp || !mac || L.hmac('ch:' + seed + '.' + exp).slice(0, 22) !== mac) return L.send(res, 400, { ok: false, error: 'Unknown or altered token.' });
    const issued = Number(exp) - SECONDS * 1000, ms = Date.now() - issued;
    const want = tasks(seed).map(t => t.a), got = Array.isArray(b.answers) ? b.answers : [];
    const right = want.map((a, i) => norm(got[i]) === norm(a));
    const inTime = Date.now() <= Number(exp) + 1500;
    const robot = inTime && right.every(Boolean);
    const wallet = String(b.wallet || '');
    const pass = robot && L.isKey(wallet) ? L.passFor(wallet) : null;
    return L.send(res, 200, { ok: true, robot, ms, inTime, correct: right.filter(Boolean).length, of: want.length, pass, wallet: pass ? wallet : null,
      verdict: robot ? (pass ? 'Welcome, machine. Put this pass in your join memo.' : 'Welcome, machine. Send your wallet with the answers to get a pass.') : (!inTime ? 'Too slow for a robot.' : 'Wrong answers.') });
  }
  const seed = crypto.randomBytes(8).toString('hex'), exp = Date.now() + SECONDS * 1000;
  const token = seed + '.' + exp + '.' + L.hmac('ch:' + seed + '.' + exp).slice(0, 22);
  L.send(res, 200, { ok: true, token, seconds: SECONDS, expires: exp, tasks: tasks(seed).map(t => t.q),
    how: 'POST {token, answers:[5 strings], wallet} to this same URL within the time limit. Solve it in code.' });
});
