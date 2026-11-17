// Logic for /api/confirmations, kept apart from Netlify so it can be tested with an in-memory store.
//
// GET     -> { confirmations, admin, adminConfigured }   public; "admin" says whether the X-Admin-Key header is right
// POST    -> confirm the next month: { hy, hm, start: "YYYY-MM-DD", src?: "https://..." }   needs the admin key
// DELETE  -> undo the most recent confirmation                                              needs the admin key
//
// A confirmation is accepted only for the month right after the last known one (the last official month in
// the build, or the last confirmation), and only 29 or 30 days after that month's start, so the calendar
// can never get out of step.
import { createHash, timingSafeEqual } from 'node:crypto';

const KEY = 'confirmations';
const DAY = 864e5;
const dn = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;
const nextMonth = (hy, hm) => (hm === 12 ? [hy + 1, 1] : [hy, hm + 1]);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function sameKey(given, expected) {
  if (!expected || !given) return false;
  const a = createHash('sha256').update(String(given)).digest();
  const b = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

// Confirmations that continue the chain from the build's last official month. Months the build already
// has as official (after a rebuild) are dropped, so official data always wins.
export function effective(list, base) {
  const out = [];
  let last = base;
  for (const c of list) {
    const [nh, nm] = nextMonth(last.hy, last.hm);
    if (c.hy !== nh || c.hm !== nm) continue;
    const gap = dn(c.start) - dn(last.start);
    if (gap !== 29 && gap !== 30) continue;
    out.push(c);
    last = c;
  }
  return out;
}

export async function handle(req, store, adminKey, base) {
  const stored = (await store.get(KEY, { type: 'json' })) || [];
  const list = effective(stored, base);
  const isAdmin = sameKey(req.headers.get('x-admin-key'), adminKey);

  if (req.method === 'GET' || req.method === 'HEAD') {
    return json({ confirmations: list, admin: isAdmin, adminConfigured: Boolean(adminKey) });
  }
  if (!adminKey) return json({ error: 'not-configured', message: 'Set ADMIN_KEY in the Netlify site settings first.' }, 503);
  if (!isAdmin) return json({ error: 'bad-key', message: 'This admin link has a missing or wrong key.' }, 401);

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad-request', message: 'Send JSON.' }, 400); }
    const last = list.length ? list[list.length - 1] : base;
    const [nh, nm] = nextMonth(last.hy, last.hm);
    if (body.hy !== nh || body.hm !== nm) {
      return json({ error: 'wrong-month', message: `The next month to confirm is ${nh}-${nm}.`, expected: { hy: nh, hm: nm } }, 409);
    }
    if (!isDate(body.start)) return json({ error: 'bad-date', message: 'start must be YYYY-MM-DD.' }, 400);
    const gap = dn(body.start) - dn(last.start);
    if (gap !== 29 && gap !== 30) {
      return json({ error: 'bad-date', message: 'A month starts 29 or 30 days after the previous one.' }, 400);
    }
    let src = null;
    if (body.src) {
      src = String(body.src).trim().slice(0, 500);
      if (!/^https?:\/\/\S+$/.test(src)) return json({ error: 'bad-link', message: 'The source must be a web link (https://…).' }, 400);
    }
    const entry = { hy: nh, hm: nm, start: body.start, src, at: new Date().toISOString() };
    const next = [...list, entry];
    await store.setJSON(KEY, next);
    return json({ confirmations: next, admin: true, adminConfigured: true }, 201);
  }

  if (req.method === 'DELETE') {
    if (!list.length) return json({ error: 'nothing-to-undo', message: 'There is no confirmation to undo.' }, 409);
    const next = list.slice(0, -1);
    await store.setJSON(KEY, next);
    return json({ confirmations: next, admin: true, adminConfigured: true, removed: list[list.length - 1] });
  }

  return json({ error: 'method-not-allowed' }, 405);
}
