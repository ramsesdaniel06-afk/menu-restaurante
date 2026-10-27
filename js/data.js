// Capa de datos: Supabase real, o modo demostración (localStorage) si config.js está vacío.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const BUCKET = 'dishes';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

/* ---------- utilidades ---------- */
export function fmtUsd(n) { return '$' + Number(n || 0).toFixed(2); }
export function fmtBs(usd, rate, locale = 'es-VE') {
  if (!rate || Number(rate) <= 0) return '';
  return 'Bs. ' + (Number(usd) * Number(rate)).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** Euros a partir de dólares: ambas tasas son Bs. por unidad (dólar BCV y euro BCV). */
export function fmtEur(usd, usdRate, eurRate, locale = 'es-VE') {
  if (!(Number(usdRate) > 0) || !(Number(eurRate) > 0)) return '';
  return '€' + (Number(usd) * Number(usdRate) / Number(eurRate)).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** Precio vigente: el de oferta si existe, si no el normal. */
export const unitPrice = d => (d.sale_price_usd != null && Number(d.sale_price_usd) >= 0 && Number(d.sale_price_usd) < Number(d.price_usd) ? Number(d.sale_price_usd) : Number(d.price_usd));
export const onSale = d => unitPrice(d) < Number(d.price_usd);

// Reduce y comprime la foto en el navegador antes de subirla.
export async function compressImage(file, max = 1400, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('No se pudo procesar la imagen')), 'image/jpeg', quality));
}
const blobToDataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

/* ---------- Supabase ---------- */
let _sb;
async function sb() {
  if (!_sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _sb;
}
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

/* ---------- Demo: datos de ejemplo ---------- */
function plate(a, b, c) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="400" cy="300" r="210" fill="#fff" fill-opacity=".92"/><circle cx="400" cy="300" r="165" fill="${c}" fill-opacity=".9"/><circle cx="340" cy="260" r="46" fill="#fff" fill-opacity=".35"/><circle cx="460" cy="340" r="62" fill="#000" fill-opacity=".12"/><text x="780" y="40" text-anchor="end" font-family="sans-serif" font-size="22" fill="#fff" fill-opacity=".8">Foto de ejemplo</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function seed() {
  const cats = [['Entradas', 'Starters'], ['Platillos fuertes', 'Main courses'], ['Especialidades', 'Specialties'], ['Postres', 'Desserts']]
    .map(([name, name_en], i) => ({ id: 'c' + (i + 1), name, name_en, position: i + 1 }));
  const P = [
    ['#0E6F73', '#0B3B3C', '#F0A202'], ['#C2410C', '#7C2D12', '#FACC15'], ['#1D4ED8', '#1E3A8A', '#FB7185'],
    ['#166534', '#14532D', '#FDE68A'], ['#7E22CE', '#4C1D95', '#FDBA74'], ['#9A3412', '#431407', '#FCD34D'],
  ];
  const mk = (i, n) => Array.from({ length: n }, (_, k) => { const p = P[(i + k) % P.length]; return { id: uid(), url: plate(...p), path: null, position: k }; });
  // [cat, nombre, name_en, descripción, description_en, precio, etiquetas, extras]
  const rows = [
    ['c1', 'Tequeños', 'Tequeños', 'Seis deditos de queso blanco en masa crujiente, con salsa de guasacaca.', 'Six white-cheese fingers in crispy dough, with guasacaca sauce.', 6.5, ['vegetariano'], {}],
    ['c1', 'Ceviche de pescado', 'Fish ceviche', 'Pesca del día curada en limón, cebolla morada, cilantro y ají dulce.', 'Catch of the day cured in lime with red onion, cilantro and sweet pepper.', 9, ['sin_gluten', 'sin_lactosa', 'picante'], { featured: true }],
    ['c1', 'Empanadas surtidas', 'Assorted empanadas', 'Tres empanadas: carne mechada, queso y cazón.', 'Three empanadas: shredded beef, cheese and dogfish shark.', 5, [], {}],
    ['c2', 'Pabellón criollo', 'Pabellón criollo', 'Carne mechada, caraotas negras, arroz blanco y tajadas de plátano maduro.', 'Shredded beef, black beans, white rice and fried ripe plantain.', 12, ['sin_gluten', 'sin_lactosa'], { daily: true }],
    ['c2', 'Pescado frito con tostones', 'Fried fish with tostones', 'Pargo entero frito, tostones, ensalada y salsa de ajo.', 'Whole fried snapper, twice-fried plantain, salad and garlic sauce.', 16, ['sin_gluten'], { featured: true, sale: 13.5 }],
    ['c2', 'Churrasco', 'Grilled steak', 'Corte de res a la parrilla con yuca sancochada y chimichurri.', 'Grilled beef cut with boiled cassava and chimichurri.', 17, ['sin_gluten', 'sin_lactosa'], {}],
    ['c3', 'Parrilla del puerto', 'Harbor grill', 'Langostinos, calamares, pulpo y pescado a las brasas para compartir.', 'Prawns, squid, octopus and fish over the coals, to share.', 32, ['mariscos', 'sin_gluten'], { featured: true }],
    ['c3', 'Arroz con mariscos', 'Seafood rice', 'Arroz meloso con mejillones, camarones y calamar, sofrito de la casa.', 'Creamy rice with mussels, shrimp and squid in our house sofrito.', 22, ['mariscos', 'picante'], { sold_out: true }],
    ['c3', 'Asado negro', 'Asado negro', 'Lomo cocido lento en papelón y especias, con puré de ñame.', 'Slow-cooked loin in panela and spices, with yam purée.', 15, ['sin_gluten'], { active: false }],
    ['c4', 'Quesillo', 'Quesillo', 'Flan venezolano de leche condensada, con caramelo oscuro.', 'Venezuelan condensed-milk flan with dark caramel.', 5, ['huevo', 'vegetariano'], {}],
    ['c4', 'Tres leches', 'Tres leches cake', 'Bizcocho empapado en tres leches con merengue ligero.', 'Sponge soaked in three milks with light meringue.', 5.5, ['huevo', 'vegetariano'], {}],
    ['c4', 'Torta de chocolate', 'Chocolate cake', 'Cacao de Chuao, relleno de dulce de leche.', 'Chuao cocoa, filled with dulce de leche.', 6, ['huevo', 'frutos_secos', 'vegetariano'], { featured: true }],
  ];
  const catCount = {};
  const dishes = rows.map((r, i) => {
    const [category_id, name, name_en, description, description_en, price_usd, tags, x] = r;
    catCount[category_id] = (catCount[category_id] || 0) + 1;
    return {
      id: 'd' + (i + 1), category_id, name, name_en, description, description_en, price_usd, tags,
      sale_price_usd: x.sale ?? null, featured: !!x.featured, daily: !!x.daily, sold_out: !!x.sold_out, active: x.active !== false,
      position: catCount[category_id], created_at: new Date(2026, 0, i + 1).toISOString(), photos: mk(i, 2 + (i % 2)),
    };
  });
  return {
    settings: {
      id: 1, name: 'Mi Restaurante', tagline: 'Cocina de mar y parrilla frente al puerto', tagline_en: 'Seafood and grill by the harbor',
      address: 'Av. Principal, Puerto Cabello', phone: '+58 241 000 0000', hours: 'Martes a domingo · 11:00 a 22:00', hours_en: 'Tuesday to Sunday · 11:00 am to 10:00 pm',
      google_place_id: '', whatsapp: '584140000000', whatsapp_message: 'Hola, quisiera hacer una reserva.', instagram: 'mirestaurante',
      facebook: '', tiktok: '', x_twitter: '', youtube: '', website: '', site_url: '',
      order_enabled: true, promo_active: true, promo_text: '2×1 en postres todos los jueves', promo_text_en: '2-for-1 desserts every Thursday',
      bcv_rate: 0, eur_rate: 0, bcv_updated_at: null,
    },
    categories: cats, dishes, events: [],
  };
}
const LS = 'rm_demo_v2';
function dLoad() { try { const r = localStorage.getItem(LS); if (r) return JSON.parse(r); } catch { /* ignore */ } const d = seed(); dSave(d, true); return d; }
function dSave(d, quiet) {
  try { localStorage.setItem(LS, JSON.stringify(d)); }
  catch { if (!quiet) throw new Error('El navegador se quedó sin espacio de demostración. Quita alguna foto.'); }
}
export function resetDemo() { localStorage.removeItem(LS); }

/* ---------- Ajustes ---------- */
export async function getSettings() {
  if (isDemo) return dLoad().settings;
  return must(await (await sb()).from('settings').select('*').eq('id', 1).single());
}
export async function saveSettings(patch) {
  if (isDemo) { const d = dLoad(); d.settings = { ...d.settings, ...patch }; dSave(d); return d.settings; }
  return must(await (await sb()).from('settings').update(patch).eq('id', 1).select().single());
}

/* ---------- Categorías ---------- */
export async function listCategories() {
  if (isDemo) return dLoad().categories.slice().sort((a, b) => a.position - b.position);
  return must(await (await sb()).from('categories').select('*').order('position'));
}
export async function saveCategory(cat) {
  if (isDemo) {
    const d = dLoad();
    if (cat.id) Object.assign(d.categories.find(c => c.id === cat.id), cat);
    else d.categories.push({ id: uid(), position: d.categories.length + 1, name_en: '', ...cat });
    dSave(d); return;
  }
  const c = await sb();
  const row = { name: cat.name, name_en: cat.name_en ?? '', position: cat.position };
  must(cat.id ? await c.from('categories').update(row).eq('id', cat.id) : await c.from('categories').insert(row));
}
export async function saveCategoryOrder(ids) {
  if (isDemo) { const d = dLoad(); ids.forEach((id, i) => { d.categories.find(c => c.id === id).position = i + 1; }); dSave(d); return; }
  const c = await sb();
  await Promise.all(ids.map((id, i) => c.from('categories').update({ position: i + 1 }).eq('id', id).then(must)));
}
export async function deleteCategory(id) {
  if (isDemo) {
    const d = dLoad();
    if (d.dishes.some(x => x.category_id === id)) throw new Error('Esta categoría aún tiene platillos. Muévelos a otra antes de borrarla.');
    d.categories = d.categories.filter(c => c.id !== id); dSave(d); return;
  }
  const { error } = await (await sb()).from('categories').delete().eq('id', id);
  if (error) throw new Error(error.code === '23503' ? 'Esta categoría aún tiene platillos. Muévelos a otra antes de borrarla.' : error.message);
}

/* ---------- Platillos ---------- */
const normDish = r => ({
  ...r, price_usd: Number(r.price_usd), tags: r.tags || [],
  sale_price_usd: r.sale_price_usd == null ? null : Number(r.sale_price_usd),
  photos: (r.dish_photos || r.photos || []).slice().sort((a, b) => a.position - b.position),
});
const byPosition = (a, b) => (a.position - b.position) || String(a.created_at).localeCompare(String(b.created_at));
export async function listDishes() {
  if (isDemo) return dLoad().dishes.map(normDish).sort(byPosition);
  const rows = must(await (await sb()).from('dishes').select('*, dish_photos(id,url,path,position)').order('position').order('created_at'));
  return rows.map(normDish);
}
export async function setFlag(id, patch) {
  if (isDemo) { const d = dLoad(); Object.assign(d.dishes.find(x => x.id === id), patch); dSave(d); return; }
  must(await (await sb()).from('dishes').update(patch).eq('id', id));
}
export async function saveDishOrder(ids) {
  if (isDemo) { const d = dLoad(); ids.forEach((id, i) => { d.dishes.find(x => x.id === id).position = i + 1; }); dSave(d); return; }
  const c = await sb();
  await Promise.all(ids.map((id, i) => c.from('dishes').update({ position: i + 1 }).eq('id', id).then(must)));
}
export async function deleteDish(id) {
  if (isDemo) { const d = dLoad(); d.dishes = d.dishes.filter(x => x.id !== id); dSave(d); return; }
  const c = await sb();
  const photos = must(await c.from('dish_photos').select('path').eq('dish_id', id));
  const paths = photos.map(p => p.path).filter(Boolean);
  if (paths.length) await c.storage.from(BUCKET).remove(paths);
  must(await c.from('dishes').delete().eq('id', id));
}

const DISH_FIELDS = ['category_id', 'name', 'name_en', 'description', 'description_en', 'price_usd', 'sale_price_usd', 'tags', 'active', 'featured', 'daily', 'sold_out'];
/**
 * Guarda un platillo con sus fotos.
 * photos: lista ordenada de { id?, url, path?, file? } — las que traen `file` son nuevas.
 * removed: fotos existentes que el admin quitó ({ id, path }).
 */
export async function saveDish(dish, photos, removed) {
  const fields = Object.fromEntries(DISH_FIELDS.map(k => [k, dish[k]]));
  if (isDemo) {
    const d = dLoad();
    let rec = dish.id && d.dishes.find(x => x.id === dish.id);
    if (!rec) {
      const last = Math.max(0, ...d.dishes.filter(x => x.category_id === dish.category_id).map(x => x.position || 0));
      rec = { id: uid(), created_at: new Date().toISOString(), photos: [], position: last + 1 }; d.dishes.push(rec);
    }
    Object.assign(rec, fields);
    const out = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.file) { const b = await compressImage(p.file, 900, 0.72); out.push({ id: uid(), url: await blobToDataUrl(b), path: null, position: i }); }
      else out.push({ id: p.id, url: p.url, path: p.path || null, position: i });
    }
    rec.photos = out; dSave(d); return rec.id;
  }
  const c = await sb();
  let id = dish.id;
  if (id) must(await c.from('dishes').update(fields).eq('id', id));
  else {
    const last = must(await c.from('dishes').select('position').eq('category_id', dish.category_id).order('position', { ascending: false }).limit(1));
    id = must(await c.from('dishes').insert({ ...fields, position: (last[0]?.position || 0) + 1 }).select('id').single()).id;
  }
  if (removed.length) {
    must(await c.from('dish_photos').delete().in('id', removed.map(r => r.id)));
    const paths = removed.map(r => r.path).filter(Boolean);
    if (paths.length) await c.storage.from(BUCKET).remove(paths);
  }
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (p.file) {
      const blob = await compressImage(p.file);
      const path = `${id}/${uid()}.jpg`;
      const up = await c.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (up.error) throw new Error('No se pudo subir una foto: ' + up.error.message);
      const url = c.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      must(await c.from('dish_photos').insert({ dish_id: id, url, path, position: i }));
    } else if (p.position !== i) {
      must(await c.from('dish_photos').update({ position: i }).eq('id', p.id));
    }
  }
  return id;
}

/** Carga todo lo que necesita el menú público; si no hay red, usa la última copia guardada. */
const SNAP = 'rm_snapshot_v2';
export async function loadMenu() {
  try {
    const [settings, cats, dishes] = await Promise.all([getSettings(), listCategories(), listDishes()]);
    if (!isDemo) { try { localStorage.setItem(SNAP, JSON.stringify({ settings, cats, dishes })); } catch { /* sin espacio */ } }
    return { settings, cats, dishes, offline: false };
  } catch (e) {
    if (!isDemo) { try { const s = JSON.parse(localStorage.getItem(SNAP)); if (s) return { ...s, offline: true }; } catch { /* sin copia */ } }
    throw e;
  }
}

/* ---------- Estadísticas ---------- */
const EVENT_TYPES = ['visit', 'dish_view', 'order_item', 'order_sent', 'click_whatsapp', 'click_review_read', 'click_review_write', 'click_social'];
/** Registra un evento anónimo. Nunca interrumpe la página si falla. */
export function track(type, { dish_id = null, qty = null, meta = null } = {}) {
  if (!EVENT_TYPES.includes(type)) return;
  try {
    if (isDemo) {
      const d = dLoad(); d.events = d.events || [];
      d.events.push({ type, dish_id, qty, meta: meta && String(meta).slice(0, 60), at: Date.now() });
      if (d.events.length > 500) d.events.splice(0, d.events.length - 500);
      dSave(d, true); return;
    }
    sb().then(c => c.from('events').insert({ type, dish_id, qty, meta: meta && String(meta).slice(0, 60) })).catch(() => {});
  } catch { /* ignorar */ }
}

export async function getStats(days = 30) {
  if (!isDemo) return must(await (await sb()).rpc('admin_stats', { days }));
  // Demostración: datos de ejemplo generados + los eventos reales registrados en este navegador.
  const d = dLoad();
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const daily = [], totals = { visit: 0, dish_view: 0, order_sent: 0, click_whatsapp: 0, click_review_read: 0, click_review_write: 0, click_social: 0, order_item: 0 };
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now); day.setDate(now.getDate() - i);
    const visits = Math.round(18 + rnd() * 40 + (day.getDay() === 5 || day.getDay() === 6 ? 25 : 0));
    daily.push({ day: day.toISOString().slice(0, 10), visits }); totals.visit += visits;
  }
  totals.dish_view = totals.visit * 4; totals.order_sent = Math.round(totals.visit * .12); totals.click_whatsapp = Math.round(totals.visit * .09);
  totals.click_review_read = Math.round(totals.visit * .05); totals.click_review_write = Math.round(totals.visit * .02); totals.click_social = Math.round(totals.visit * .07);
  const names = d.dishes.filter(x => x.active).map(x => x.name);
  const top = n => names.map(name => ({ name, n: Math.round(rnd() * n) + 5 })).sort((a, b) => b.n - a.n).slice(0, 8);
  const out = { totals, daily, top_viewed: top(180), top_ordered: top(40), socials: { instagram: Math.round(totals.click_social * .6), facebook: Math.round(totals.click_social * .25), tiktok: Math.round(totals.click_social * .15) }, orders_usd: totals.order_sent * 31.5, demo: true };
  // eventos reales de esta sesión de demostración
  const cutoff = Date.now() - days * 864e5;
  for (const e of (d.events || []).filter(e => e.at >= cutoff)) {
    out.totals[e.type] = (out.totals[e.type] || 0) + 1;
    if (e.type === 'visit') out.daily[out.daily.length - 1].visits += 1;
    if (e.type === 'click_social' && e.meta) out.socials[e.meta] = (out.socials[e.meta] || 0) + 1;
    if (e.type === 'order_sent') out.orders_usd += Number(String(e.meta || '').replace(/[^0-9.]/g, '')) || 0;
  }
  return out;
}

/* ---------- Autenticación (admin) ---------- */
async function checkAdmin(c, userId) {
  const { data } = await c.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}
export async function getSession() {
  if (isDemo) return sessionStorage.getItem('rm_demo_admin') ? { email: 'demo@demo' } : null;
  const c = await sb();
  const { data } = await c.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  if (!(await checkAdmin(c, u.id))) { await c.auth.signOut(); return null; }
  return { email: u.email };
}
export async function signIn(email, password) {
  if (isDemo) { sessionStorage.setItem('rm_demo_admin', '1'); return { email: email || 'demo@demo' }; }
  const c = await sb();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Correo o contraseña incorrectos.');
  if (!(await checkAdmin(c, data.user.id))) { await c.auth.signOut(); throw new Error('Esta cuenta existe, pero no tiene permisos de administrador.'); }
  return { email: data.user.email };
}
export async function signOut() {
  if (isDemo) { sessionStorage.removeItem('rm_demo_admin'); return; }
  await (await sb()).auth.signOut();
}

/* ---------- Tasa BCV (opcional, si el servicio responde) ---------- */
/** Tasas oficiales BCV automáticas (dólar y euro, Bs. por unidad). Se guardan 30 min en el navegador;
 *  si el servicio falla se usa la última tasa conocida. Devuelve { usd, eur, updated } con 0 si no hay dato. */
const RATES_KEY = 'rm_rates_v1', RATES_TTL = 30 * 60 * 1000;
export async function getAutoRates() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(RATES_KEY) || 'null'); } catch { /* sin caché */ }
  if (cached && Date.now() - cached.ts < RATES_TTL) return cached.v;
  const num = j => { const v = Number(j?.promedio ?? j?.venta ?? j?.compra); return v > 0 ? v : 0; };
  const get = async p => { const r = await fetch('https://ve.dolarapi.com/v1/' + p, { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
  const [u, e] = await Promise.allSettled([
    get('dolares/oficial'),
    get('euros/oficial').catch(async () => { const a = await get('euros'); return Array.isArray(a) ? a.find(x => x.fuente === 'oficial') : a; }),
  ]);
  const du = u.status === 'fulfilled' ? u.value : null, de = e.status === 'fulfilled' ? e.value : null;
  const v = { usd: num(du), eur: num(de), updated: du?.fechaActualizacion || de?.fechaActualizacion || '' };
  if (!v.usd && cached?.v?.usd) { v.usd = cached.v.usd; v.updated = cached.v.updated; }
  if (!v.eur && cached?.v?.eur) v.eur = cached.v.eur;
  if (v.usd || v.eur) { try { localStorage.setItem(RATES_KEY, JSON.stringify({ ts: Date.now(), v })); } catch { /* ignore */ } }
  return v;
}

export async function fetchBcvRate() {
  const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
  if (!r.ok) throw new Error('El servicio de tasas no respondió.');
  const j = await r.json();
  const v = Number(j.promedio ?? j.venta ?? j.compra);
  if (!v) throw new Error('No se pudo leer la tasa.');
  return v;
}
