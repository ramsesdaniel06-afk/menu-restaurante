// Horarios: reloj del restaurante (zona horaria propia), apertura por día, franjas del menú y ofertas por horario.
let TZ = 'America/Caracas';
export const setTz = tz => { if (tz) TZ = tz; };
export const getTz = () => TZ;

export const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAYS_ES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAYS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes primero
export const DAYPARTS = ['breakfast', 'lunch', 'dinner'];
export const DEFAULT_DAYPARTS = { breakfast: ['06:00', '11:00'], lunch: ['11:00', '16:00'], dinner: ['16:00', '24:00'] };

const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
/** Día de la semana (0 = domingo) y minutos desde medianoche en la zona del restaurante. */
export function clock(at = new Date(), tz = TZ) {
  let parts;
  try { parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at); }
  catch { parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at); }
  const g = t => parts.find(p => p.type === t)?.value;
  return { dow: WD[g('weekday')] ?? 0, min: (Number(g('hour')) % 24) * 60 + Number(g('minute')) };
}

/** "14:30" → 870. Acepta 24:00. Devuelve null si no es válida. */
export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && v <= 1440 ? v : null;
}
export const toHM = min => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export function fmtHM(min, lang = 'es') {
  const m = ((min % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'am' : 'pm'}`;
}
/** ¿min está dentro de [from, to)? Admite rangos que cruzan la medianoche. */
export function inRange(min, from, to) {
  if (from == null || to == null || from === to) return true;
  return from < to ? min >= from && min < to : min >= from || min < to;
}

/* ---------- Ofertas con horario ---------- */
export function saleActive(d, at = new Date()) {
  const p = Number(d.sale_price_usd);
  if (d.sale_price_usd == null || d.sale_price_usd === '' || !(p >= 0 && p < Number(d.price_usd))) return false;
  const days = d.sale_days || [];
  const from = parseHM(d.sale_from), to = parseHM(d.sale_to);
  if (!days.length && from == null && to == null) return true;
  const { dow, min } = clock(at);
  if (days.length && !days.includes(dow)) return false;
  return from == null || to == null ? true : inRange(min, from, to);
}

/* ---------- Disponibilidad de un platillo ---------- */
export function currentDaypart(settings, at = new Date()) {
  if (!settings?.dayparts_on) return null;
  const cfg = { ...DEFAULT_DAYPARTS, ...(settings.dayparts || {}) };
  const { min } = clock(at);
  for (const k of DAYPARTS) {
    const f = parseHM(cfg[k]?.[0]), t = parseHM(cfg[k]?.[1]);
    if (f != null && t != null && inRange(min, f, t)) return k;
  }
  return null;
}
/** 'hidden' (hoy no se sirve), 'later' (hoy se sirve, pero en otra franja) o 'now'. */
export function availability(d, settings, showAll = false, at = new Date()) {
  if (!d.active) return 'hidden';
  const days = d.avail_days || [];
  if (days.length && !days.includes(clock(at).dow)) return 'hidden';
  const dp = d.dayparts || [];
  if (dp.length && settings?.dayparts_on) {
    const cur = currentDaypart(settings, at);
    if (cur && !dp.includes(cur)) return showAll ? 'later' : 'hidden';
  }
  return 'now';
}

/* ---------- Horario de apertura por día ---------- */
function rangeOf(week, d) {
  const r = week?.[d];
  if (!Array.isArray(r)) return null;
  const o = parseHM(r[0]), c = parseHM(r[1]);
  return o == null || c == null || o === c ? null : [o, c];
}
export const hasWeek = week => [0, 1, 2, 3, 4, 5, 6].some(d => rangeOf(week, d));
/** { open, closes } o { open:false, next:{ days, dow, at } }. null si no hay horario por día. */
export function openStatus(week, at = new Date()) {
  if (!hasWeek(week)) return null;
  const { dow, min } = clock(at);
  const today = rangeOf(week, dow), yest = rangeOf(week, (dow + 6) % 7);
  if (yest && yest[1] < yest[0] && min < yest[1]) return { open: true, closes: yest[1] };
  if (today) {
    const [o, c] = today;
    if (o < c ? min >= o && min < c : min >= o) return { open: true, closes: c };
    if (min < o) return { open: false, next: { days: 0, dow, at: o } };
  }
  for (let i = 1; i <= 7; i++) { const d = (dow + i) % 7, r = rangeOf(week, d); if (r) return { open: false, next: { days: i, dow: d, at: r[0] } }; }
  return { open: false, next: null };
}
/** Líneas "Lun–Vie · 11:00 am – 10:00 pm" agrupando días consecutivos con el mismo horario. */
export function weekLines(week, lang = 'es', closedWord = 'Cerrado') {
  if (!hasWeek(week)) return [];
  const names = lang === 'en' ? DAYS_EN_SHORT : DAYS_ES_SHORT;
  const key = d => { const r = rangeOf(week, d); return r ? `${fmtHM(r[0])} – ${fmtHM(r[1])}` : closedWord; };
  const out = [];
  for (const d of WEEK_ORDER) {
    const k = key(d), last = out[out.length - 1];
    if (last && last.k === k) last.to = d; else out.push({ k, from: d, to: d });
  }
  return out.map(g => `${g.from === g.to ? names[g.from] : `${names[g.from]}–${names[g.to]}`} · ${g.k}`);
}
