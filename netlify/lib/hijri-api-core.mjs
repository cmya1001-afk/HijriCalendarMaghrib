// Public JSON API, kept apart from Netlify so it can be tested without it.
//
//   GET /api                       -> list of endpoints
//   GET /api/date[?date=YYYY-MM-DD] -> the Hijri date for a Gregorian day (default: today in Morocco)
//   GET /api/months[?year=1448]     -> the months of a Hijri year (default: the current one)
//   GET /api/holidays[?year=1448]   -> the holidays and occasions of a Hijri year (default: the current one)
//
// Dates come from the official announcements, then the months confirmed on the admin page, then the
// forecast (scripts/engine.js). Forecast answers carry status "expected" and a certainty between 0 and 1.
import HijriEngine from './engine.mjs';   // generated from scripts/engine.js by scripts/build_simple.py

const DAY = 864e5;
const { dn, iso, chain } = HijriEngine;

export const NAMES = {
  en: ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhul-Qadah', 'Dhul-Hijjah'],
  ar: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
  fr: ['Moharram', 'Safar', 'Rabia al-Awal', 'Rabia ath-Thani', 'Joumada al-Oula', 'Joumada ath-Thania', 'Rajab', 'Chaabane', 'Ramadan', 'Chaoual', 'Dou al-Qiada', 'Dou al-Hijja'],
};
const SUFFIX = { en: 'AH', ar: 'هـ', fr: 'H' };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// [Hijri month, day, key, public holiday in Morocco, names]
const HOLIDAYS = [
  [1, 1, 'islamic-new-year', true, { en: 'Islamic New Year', ar: 'رأس السنة الهجرية', fr: 'Nouvel An de l’Hégire' }],
  [1, 10, 'ashura', false, { en: 'Ashura', ar: 'عاشوراء', fr: 'Achoura' }],
  [3, 12, 'eid-al-mawlid', true, { en: 'Eid al-Mawlid (Prophet’s Birthday)', ar: 'عيد المولد النبوي', fr: 'Aïd al-Mawlid' }],
  [3, 13, 'eid-al-mawlid-day-2', true, { en: 'Eid al-Mawlid, day 2', ar: 'عيد المولد النبوي (اليوم الثاني)', fr: 'Aïd al-Mawlid, 2e jour' }],
  [7, 27, 'isra-and-miraj', false, { en: 'Isra and Mi’raj', ar: 'الإسراء والمعراج', fr: 'Al-Isra wal-Miraj' }],
  [9, 1, 'ramadan-begins', false, { en: 'First day of Ramadan', ar: 'أول أيام رمضان', fr: 'Premier jour du Ramadan' }],
  [10, 1, 'eid-al-fitr', true, { en: 'Eid al-Fitr', ar: 'عيد الفطر', fr: 'Aïd al-Fitr' }],
  [10, 2, 'eid-al-fitr-day-2', true, { en: 'Eid al-Fitr, day 2', ar: 'عيد الفطر (اليوم الثاني)', fr: 'Aïd al-Fitr, 2e jour' }],
  [12, 9, 'day-of-arafah', false, { en: 'Day of Arafah', ar: 'يوم عرفة', fr: 'Jour d’Arafat' }],
  [12, 10, 'eid-al-adha', true, { en: 'Eid al-Adha', ar: 'عيد الأضحى', fr: 'Aïd al-Adha' }],
  [12, 11, 'eid-al-adha-day-2', true, { en: 'Eid al-Adha, day 2', ar: 'عيد الأضحى (اليوم الثاني)', fr: 'Aïd al-Adha, 2e jour' }],
];

const round = (p) => Math.round(p * 1000) / 1000;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export const moroccoToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

function respond(body, status = 200, cache = 'public, max-age=60') {
  return new Response(JSON.stringify(body, null, 1), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? cache : 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
    },
  });
}
const fail = (status, message) => respond({ error: message }, status);

// Months with derived fields, from the engine
export function months(data, confirmations) {
  const list = chain(data, confirmations).months.filter((m) => !(m.hy === data.end[0] && m.hm === data.end[1]));
  return list.map((m, i) => {
    const pStart = m.fc ? (m.dist[iso(m.t0)] ?? 0) : 1;
    const next = list[i + 1];
    const pNext = next ? (next.fc ? (next.dist[iso(next.t0)] ?? 0) : 1) : 1;
    return { ...m, i, t1: m.t0 + m.len, pStart, lengthCertain: pStart >= 0.9 && pNext >= 0.9 };
  });
}
const status = (m) => (m.fc ? 'expected' : 'confirmed');
const source = (m) => (m.fc ? 'forecast' : m.src === 'admin' ? 'admin' : 'official');
const names = (hm) => ({ en: NAMES.en[hm - 1], ar: NAMES.ar[hm - 1], fr: NAMES.fr[hm - 1] });
const formatted = (d, hm, hy) => Object.fromEntries(['en', 'ar', 'fr'].map((l) => [l, `${d} ${NAMES[l][hm - 1]} ${hy} ${SUFFIX[l]}`]));
function alternatives(m) {
  if (!m.fc) return [];
  return Object.entries(m.dist).filter(([d]) => d !== iso(m.t0)).sort((a, b) => b[1] - a[1])
    .map(([d, p]) => ({ start: d, certainty: round(p) }));
}

function dateInfo(ms, t) {
  const m = ms.find((x) => t >= x.t0 && t < x.t1);
  if (!m) return null;
  const day = t - m.t0 + 1;
  const hol = HOLIDAYS.find((h) => h[0] === m.hm && h[1] === day);
  const alt = alternatives(m)[0];
  let alternative = null;
  if (alt && alt.certainty >= 0.1) {
    const d2 = t - dn(alt.start) + 1;
    const prev = ms[m.i - 1];
    alternative = d2 >= 1
      ? { day: d2, month: m.hm, year: m.hy, certainty: alt.certainty }
      : prev ? { day: t - prev.t0 + 1, month: prev.hm, year: prev.hy, certainty: alt.certainty } : null;
  }
  return {
    gregorian: iso(t),
    weekday: WEEKDAYS[new Date(t * DAY).getUTCDay()],
    hijri: { day, month: m.hm, year: m.hy, monthName: names(m.hm), formatted: formatted(day, m.hm, m.hy) },
    status: status(m),
    certainty: round(m.pStart),
    source: source(m),
    alternative,
    month: { start: iso(m.t0), length: m.len, lengthCertain: m.lengthCertain, announcement: m.url || null },
    holiday: hol ? { key: hol[2], name: hol[4], publicHoliday: hol[3] } : null,
    isRamadan: m.hm === 9,
    note: 'Civil-day date as used in Morocco. The Islamic day itself begins at sunset the evening before.',
  };
}

function yearOf(ms, url, today) {
  const y = url.searchParams.get('year');
  if (y === null) return (ms.find((x) => today >= x.t0 && today < x.t1) || ms[ms.length - 1]).hy;
  if (!/^\d{4}$/.test(y)) return NaN;
  return +y;
}

export async function handleApi(req, data, getConfirmations, now = new Date()) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-max-age': '86400' } });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(405, 'Only GET is supported.');
  const url = new URL(req.url);
  const route = url.pathname.replace(/\/+$/, '');
  if (route === '/api') {
    return respond({
      name: 'Hijri Calendar for Morocco API',
      endpoints: {
        '/api/date': 'Hijri date for a Gregorian day. ?date=YYYY-MM-DD (default: today in Morocco)',
        '/api/months': 'Months of a Hijri year with their start dates. ?year=1448 (default: current Hijri year)',
        '/api/holidays': 'Holidays and religious occasions of a Hijri year. ?year=1448 (default: current Hijri year)',
      },
      status: '"confirmed" = official or confirmed after the Ministry’s announcement; "expected" = forecast, with "certainty" from 0 to 1',
    }, 200, 'public, max-age=3600');
  }

  let confs = [];
  try { confs = (await getConfirmations()) || []; } catch { confs = []; }
  const ms = months(data, confs);
  const today = dn(moroccoToday(now));
  const range = { first: iso(ms[0].t0), last: iso(ms[ms.length - 1].t1 - 1) };

  if (route === '/api/date') {
    const q = url.searchParams.get('date');
    if (q !== null && !isDate(q)) return fail(400, 'date must be YYYY-MM-DD, for example 2027-02-08.');
    const t = q === null ? today : dn(q);
    const info = dateInfo(ms, t);
    if (!info) return fail(404, `No data for that date. Use a date from ${range.first} to ${range.last}.`);
    return respond(info);
  }

  if (route === '/api/months' || route === '/api/holidays') {
    const y = yearOf(ms, url, today);
    const inYear = ms.filter((m) => m.hy === y);
    if (!inYear.length) return fail(404, `No data for that year. Use a Hijri year from ${ms[0].hy} to ${ms[ms.length - 1].hy}.`);
    if (route === '/api/months') {
      return respond({
        year: y,
        months: inYear.map((m) => ({
          month: m.hm, name: names(m.hm), start: iso(m.t0), end: iso(m.t1 - 1),
          length: m.len, lengthCertain: m.lengthCertain, status: status(m), certainty: round(m.pStart), source: source(m),
          alternatives: alternatives(m), announcement: m.url || null,
        })),
      });
    }
    const out = [];
    inYear.forEach((m) => HOLIDAYS.forEach(([hm, d, key, pub, nm]) => {
      if (m.hm !== hm || d > m.len) return;
      const t = m.t0 + d - 1;
      out.push({
        key, name: nm, publicHoliday: pub, gregorian: iso(t), weekday: WEEKDAYS[new Date(t * DAY).getUTCDay()],
        hijri: { day: d, month: hm, year: m.hy }, status: status(m), certainty: round(m.pStart),
        alternatives: alternatives(m).map((a) => ({ gregorian: iso(dn(a.start) + d - 1), certainty: a.certainty })),
        daysFromToday: t - today,
      });
    }));
    return respond({ year: y, holidays: out });
  }

  return fail(404, 'Unknown endpoint. See /api for the list.');
}
