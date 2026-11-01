import * as api from './data.js';
import { h, toast } from './ui.js';
import { sortable } from './sortable.js';
import { qrSvg, qrPng } from './qr.js';
import { DAYS_ES_SHORT, WEEK_ORDER, DEFAULT_DAYPARTS, DAYPARTS, parseHM } from './schedule.js';

const $ = id => document.getElementById(id);
const S = { cats: [], dishes: [], settings: {}, editing: null, photos: [], removed: [], opts: [], role: 'owner', me: '' };
const DP_LABEL = { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena' };
const chipBox = (box, items, selected) => box.replaceChildren(...items.map(([v, l]) => h('label', { class: 'tagchk' }, h('input', { type: 'checkbox', value: String(v), checked: selected.map(String).includes(String(v)) ? true : null }), h('span', {}, l))));
const chipVals = box => [...box.querySelectorAll('input:checked')].map(i => i.value);
const dayItems = () => WEEK_ORDER.map(d => [d, DAYS_ES_SHORT[d]]);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const TAG_LABELS = {
  picante: 'Picante', vegetariano: 'Vegetariano', vegano: 'Vegano', sin_gluten: 'Sin gluten', sin_lactosa: 'Sin lactosa',
  mariscos: 'Contiene mariscos', frutos_secos: 'Contiene frutos secos', huevo: 'Contiene huevo',
};

/* ---------- Acceso ---------- */
async function boot() {
  if (api.isDemo) $('demo-note').hidden = false;
  const session = await api.getSession().catch(() => null);
  session ? showPanel(session) : ($('login').hidden = false);
}
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.submitter, err = $('login-err');
  err.textContent = ''; btn.disabled = true;
  try { const ses = await api.signIn($('email').value.trim(), $('password').value); $('login').hidden = true; showPanel(ses); }
  catch (ex) { err.textContent = ex.message; }
  btn.disabled = false;
});
$('logout').addEventListener('click', async () => { await api.signOut(); location.reload(); });

async function showPanel(session) {
  S.role = session?.role || 'owner'; S.me = session?.email || '';
  $('panel').hidden = false;
  applyRole();
  await loadAll();
}
/** Dueño: todo. Gerente: todo menos el equipo y restaurar copias. Empleado: solo marcar agotados. */
function applyRole() {
  const r = S.role;
  const allowed = r === 'staff' ? ['tab-dishes'] : r === 'manager' ? ['tab-dishes', 'tab-stats', 'tab-qr', 'tab-cats', 'tab-settings', 'tab-backup'] : TABS.map(x => x[0]);
  for (const [t] of TABS) $(t).hidden = !allowed.includes(t);
  $('new-dish').hidden = r === 'staff';
  $('bk-restore').hidden = r !== 'owner';
}
async function loadAll() {
  try {
    [S.settings, S.cats, S.dishes] = await Promise.all([api.getSettings(), api.listCategories(), api.listDishes()]);
  } catch (e) { toast('No se pudieron cargar los datos: ' + e.message, 'err'); return; }
  renderFilters(); renderDishes(); renderSettings(); renderCats();
}

/* ---------- Pestañas ---------- */
const TABS = [['tab-dishes', 'v-dishes'], ['tab-stats', 'v-stats'], ['tab-qr', 'v-qr'], ['tab-cats', 'v-cats'], ['tab-settings', 'v-settings'], ['tab-backup', 'v-backup'], ['tab-team', 'v-team']];
for (const [tab, view] of TABS) {
  $(tab).addEventListener('click', () => {
    for (const [t, v] of TABS) { $(t).setAttribute('aria-selected', String(t === tab)); $(v).hidden = v !== view; }
    if (tab === 'tab-stats') loadStats();
    if (tab === 'tab-qr') initQr();
    if (tab === 'tab-team') loadTeam();
  });
}

/* ---------- Lista de platillos ---------- */
const catName = id => S.cats.find(c => c.id === id)?.name || 'Sin categoría';
function renderFilters() {
  const cur = $('fcat').value;
  $('fcat').replaceChildren(h('option', { value: '' }, 'Todas las categorías'), ...S.cats.map(c => h('option', { value: c.id }, c.name)));
  $('fcat').value = S.cats.some(c => c.id === cur) ? cur : '';
}
function dishRow(d, grip) {
  const cover = d.photos[0];
  const tags = [];
  if (d.featured) tags.push(h('span', { class: 'tag star' }, 'De la casa'));
  if (d.daily) tags.push(h('span', { class: 'tag star' }, 'Del día'));
  if (d.sale_price_usd != null && d.sale_price_usd < d.price_usd) tags.push(h('span', { class: 'tag star' }, 'Oferta'));
  if (d.sold_out) tags.push(h('span', { class: 'tag off' }, 'Agotado'));
  if (!d.active) tags.push(h('span', { class: 'tag off' }, 'Oculto'));
  const price = d.sale_price_usd != null && d.sale_price_usd < d.price_usd
    ? h('div', { class: 'price-col' }, h('s', { text: api.fmtUsd(d.price_usd) }), ' ', api.fmtUsd(d.sale_price_usd))
    : h('div', { class: 'price-col', text: api.fmtUsd(d.price_usd) });
  return h('div', { class: 'drow' + (d.active ? '' : ' off') + (grip ? '' : ' nogrip'), 'data-id': d.id },
    grip ? h('button', { type: 'button', class: 'grip', 'aria-label': `Mover ${d.name}. Usa las flechas arriba y abajo.`, title: 'Arrastrar para ordenar' }, '⠿') : null,
    cover ? h('img', { class: 'thumb', src: cover.url, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb', 'aria-hidden': 'true' }, d.name.slice(0, 1)),
    h('div', { class: 'info' },
      h('h3', { text: d.name }),
      h('div', { class: 'meta' }, `${catName(d.category_id)} · ${d.photos.length} ${d.photos.length === 1 ? 'foto' : 'fotos'}`),
      tags.length ? h('div', { class: 'tags' }, tags) : null),
    price,
    h('div', { class: 'row-actions' },
      S.role === 'staff' ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-pressed': String(d.featured), onclick: () => flag(d, { featured: !d.featured }, d.featured ? 'Quitado de las recomendaciones' : 'Agregado a las recomendaciones') }, d.featured ? '★ Recomendado' : '☆ Recomendar'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-pressed': String(d.sold_out), onclick: () => flag(d, { sold_out: !d.sold_out }, d.sold_out ? 'Platillo disponible de nuevo' : 'Marcado como agotado') }, d.sold_out ? 'Agotado ✓' : 'Agotado'),
      S.role === 'staff' ? null : h('button', { class: 'icon-btn', type: 'button', onclick: () => flag(d, { active: !d.active }, d.active ? 'Platillo oculto del menú' : 'Platillo visible en el menú') }, d.active ? 'Ocultar' : 'Mostrar'),
      S.role === 'staff' ? null : h('button', { class: 'icon-btn', type: 'button', onclick: () => openEditor(d) }, 'Editar')));
}
function renderDishes() {
  const q = norm($('q').value.trim()), fc = $('fcat').value, searching = q !== '' || S.role === 'staff';
  const rows = S.dishes.filter(d => (!fc || d.category_id === fc) && (!q || norm(d.name + ' ' + (d.name_en || '')).includes(q)));
  const box = $('dish-list'); box.replaceChildren();
  $('drag-hint').hidden = searching || !S.dishes.length;
  if (S.role === 'staff') $('drag-hint').hidden = true;
  if (!rows.length) {
    box.append(h('p', { class: 'empty' }, S.dishes.length ? 'Ningún platillo coincide con la búsqueda.' : 'Aún no hay platillos. Crea el primero con “Nuevo platillo”.'));
    return;
  }
  for (const c of S.cats) {
    const list = rows.filter(d => d.category_id === c.id);
    if (!list.length) continue;
    const items = h('div', { class: 'dgroup-items' }, list.map(d => dishRow(d, !searching)));
    box.append(h('section', { class: 'dgroup', 'aria-label': c.name }, h('h3', { class: 'dgroup-t', text: c.name }), items));
    if (!searching) sortable(items, { itemSel: '.drow', handleSel: '.grip', onDone: ids => reorderDishes(ids) });
  }
}
async function reorderDishes(ids) {
  try {
    await api.saveDishOrder(ids);
    ids.forEach((id, i) => { const d = S.dishes.find(x => x.id === id); if (d) d.position = i + 1; });
    S.dishes.sort((a, b) => a.position - b.position);
    toast('Orden guardado');
  } catch (e) { toast(e.message, 'err'); renderDishes(); }
}
async function flag(d, patch, msg) {
  try { await api.setFlag(d.id, patch); Object.assign(d, patch); renderDishes(); toast(msg); }
  catch (e) { toast(e.message, 'err'); }
}
$('q').addEventListener('input', renderDishes);
$('fcat').addEventListener('change', renderDishes);

/* ---------- Editor de platillo ---------- */
const dlg = $('dish-dlg'), form = $('dish-form');
function openEditor(d) {
  if (!S.cats.length) { toast('Primero crea una categoría en la pestaña Restaurante.', 'err'); return; }
  S.editing = d || null; S.removed = [];
  S.photos = d ? d.photos.map(p => ({ ...p })) : [];
  $('dlg-title').textContent = d ? 'Editar platillo' : 'Nuevo platillo';
  $('dish-del').hidden = !d;
  form.name.value = d?.name || '';
  form.name_en.value = d?.name_en || '';
  form.category_id.replaceChildren(...S.cats.map(c => h('option', { value: c.id }, c.name)));
  form.category_id.value = d?.category_id || ($('fcat').value || S.cats[0].id);
  form.price_usd.value = d ? d.price_usd : '';
  form.sale_price_usd.value = d?.sale_price_usd ?? '';
  form.description.value = d?.description || '';
  form.description_en.value = d?.description_en || '';
  form.active.checked = d ? d.active : true;
  form.featured.checked = d ? d.featured : false;
  form.daily.checked = d ? !!d.daily : false;
  form.sold_out.checked = d ? !!d.sold_out : false;
  form.is_combo.checked = !!d?.is_combo; form.suggest.checked = !!d?.suggest;
  chipBox($('avail-days'), dayItems(), d?.avail_days || []);
  chipBox($('dayparts'), DAYPARTS.map(k => [k, DP_LABEL[k]]), d?.dayparts || []);
  chipBox($('sale-days'), dayItems(), d?.sale_days || []);
  form.sale_from.value = d?.sale_from || ''; form.sale_to.value = d?.sale_to || '';
  S.opts = (d?.options || []).map(g => ({ name: g.name || '', name_en: g.name_en || '', multi: !!g.multi, required: !!g.required, text: (g.items || []).map(it => [it.name, it.price ?? 0, ...(it.name_en ? [it.name_en] : [])].join(' | ')).join('\n') }));
  renderOpts();
  $('tag-box').replaceChildren(...Object.entries(TAG_LABELS).map(([k, label]) =>
    h('label', { class: 'tagchk' }, h('input', { type: 'checkbox', name: 'tag', value: k, checked: d?.tags?.includes(k) ? true : null }), h('span', {}, label))));
  form.querySelector('details.en').open = !!(d && (d.name_en || d.description_en));
  renderPhotos();
  dlg.showModal();
  form.name.focus();
}
$('new-dish').addEventListener('click', () => openEditor(null));
$('dlg-close').addEventListener('click', () => dlg.close());
$('dlg-cancel').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => S.photos.forEach(p => p.file && URL.revokeObjectURL(p.url)));

function renderOpts() {
  const box = $('opt-list'); box.replaceChildren();
  S.opts.forEach((g, gi) => {
    const name = h('input', { value: g.name, placeholder: 'Nombre del grupo (ej. Término de la carne)', maxlength: '60', 'aria-label': 'Nombre del grupo' });
    name.addEventListener('input', () => { g.name = name.value; });
    const en = h('input', { value: g.name_en, placeholder: 'Group name (EN, opcional)', maxlength: '60', 'aria-label': 'Nombre del grupo en inglés' });
    en.addEventListener('input', () => { g.name_en = en.value; });
    const kind = h('select', { 'aria-label': 'Tipo de elección' }, h('option', { value: 'one' }, 'Elegir una'), h('option', { value: 'many' }, 'Elegir varias'));
    kind.value = g.multi ? 'many' : 'one'; kind.addEventListener('change', () => { g.multi = kind.value === 'many'; });
    const req = h('input', { type: 'checkbox', checked: g.required ? true : null }); req.addEventListener('change', () => { g.required = req.checked; });
    const ta = h('textarea', { rows: '4', placeholder: 'Medio | 0\nBien cocido | 0\nQueso extra | 1.5', 'aria-label': 'Ítems del grupo' });
    ta.value = g.text; ta.addEventListener('input', () => { g.text = ta.value; });
    box.append(h('div', { class: 'optg' },
      h('div', { class: 'optg-top' }, name, en, h('button', { type: 'button', class: 'btn btn-danger-ghost', onclick: () => { S.opts.splice(gi, 1); renderOpts(); } }, 'Quitar')),
      h('div', { class: 'optg-sw' }, kind, h('label', { class: 'tagchk' }, req, h('span', {}, 'Obligatoria'))),
      ta));
  });
}
$('opt-add-g').addEventListener('click', () => { S.opts.push({ name: '', name_en: '', multi: false, required: false, text: '' }); renderOpts(); $('opt-list').lastElementChild.querySelector('input').focus(); });
function parseOpts() {
  return S.opts.map(g => {
    const name = g.name.trim();
    const items = g.text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [n, p, e] = l.split('|').map(x => x.trim());
      const price = Number(String(p || '0').replace('$', '').replace(',', '.'));
      if (!n || !(price >= 0)) throw new Error(`Revisa la línea “${l}” en “${name || 'opciones'}”: usa Nombre | precio.`);
      return { name: n, name_en: e || '', price };
    });
    if (!name && !items.length) return null;
    if (!name) throw new Error('Ponle un nombre al grupo de opciones.');
    if (!items.length) throw new Error(`El grupo “${name}” no tiene ítems.`);
    return { name, name_en: g.name_en.trim(), multi: !!g.multi, required: !!g.required, items };
  }).filter(Boolean);
}

function renderPhotos() {
  const grid = $('photo-grid'); grid.replaceChildren();
  if (!S.photos.length) { grid.append(h('li', { class: 'pempty' }, 'Sin fotos todavía. Usa “Agregar fotos”.')); return; }
  S.photos.forEach((p, i) => {
    const move = (to) => { const [x] = S.photos.splice(i, 1); S.photos.splice(to, 0, x); renderPhotos(); };
    grid.append(h('li', { class: 'pitem' },
      i === 0 ? h('span', { class: 'cover' }, 'Portada') : null,
      h('img', { src: p.url, alt: `Foto ${i + 1}` }),
      h('div', { class: 'pbar' },
        h('button', { type: 'button', 'aria-label': 'Mover antes', disabled: i === 0, onclick: () => move(i - 1) }, '←'),
        h('button', { type: 'button', class: 'del', 'aria-label': 'Quitar foto', onclick: () => { const [x] = S.photos.splice(i, 1); if (x.id) S.removed.push(x); else if (x.file) URL.revokeObjectURL(x.url); renderPhotos(); } }, 'Quitar'),
        h('button', { type: 'button', 'aria-label': 'Mover después', disabled: i === S.photos.length - 1, onclick: () => move(i + 1) }, '→'))));
  });
}
$('photo-input').addEventListener('change', e => {
  for (const f of e.target.files) {
    if (!f.type.startsWith('image/')) { toast(`“${f.name}” no es una imagen.`, 'err'); continue; }
    S.photos.push({ file: f, url: URL.createObjectURL(f) });
  }
  e.target.value = ''; renderPhotos();
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('dish-save'); btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const price = Number(form.price_usd.value), saleRaw = form.sale_price_usd.value.trim();
    const sale = saleRaw === '' ? null : Number(saleRaw);
    if (sale != null && !(sale >= 0 && sale < price)) throw new Error('El precio de oferta debe ser menor que el precio normal.');
    const dish = {
      id: S.editing?.id, name: form.name.value.trim(), name_en: form.name_en.value.trim(), category_id: form.category_id.value,
      description: form.description.value.trim(), description_en: form.description_en.value.trim(),
      price_usd: price, sale_price_usd: sale,
      tags: [...form.querySelectorAll('input[name=tag]:checked')].map(i => i.value),
      active: form.active.checked, featured: form.featured.checked, daily: form.daily.checked, sold_out: form.sold_out.checked,
      is_combo: form.is_combo.checked, suggest: form.suggest.checked, options: parseOpts(),
      avail_days: chipVals($('avail-days')).map(Number), dayparts: chipVals($('dayparts')),
      sale_days: chipVals($('sale-days')).map(Number), sale_from: form.sale_from.value || '', sale_to: form.sale_to.value || '',
    };
    const savedId = await api.saveDish(dish, S.photos, S.removed);
    if (dish.daily) for (const o of S.dishes.filter(x => x.daily && x.id !== savedId)) await api.setFlag(o.id, { daily: false });
    S.removed = []; dlg.close();
    S.dishes = await api.listDishes(); renderDishes();
    toast(S.editing ? 'Cambios guardados' : 'Platillo creado');
  } catch (ex) { toast(ex.message, 'err'); }
  btn.disabled = false; btn.textContent = 'Guardar platillo';
});
$('dish-del').addEventListener('click', async () => {
  if (!S.editing || !confirm(`¿Eliminar “${S.editing.name}” para siempre? Si solo quieres quitarlo del menú, usa “Ocultar”.`)) return;
  try { await api.deleteDish(S.editing.id); dlg.close(); S.dishes = await api.listDishes(); renderDishes(); toast('Platillo eliminado'); }
  catch (ex) { toast(ex.message, 'err'); }
});

/* ---------- Estadísticas ---------- */
$('stats-days').addEventListener('change', loadStats);
async function loadStats() {
  const body = $('stats-body'), days = Number($('stats-days').value);
  $('stats-demo').hidden = !api.isDemo;
  body.replaceChildren(h('p', { class: 'muted' }, 'Cargando…'));
  try { renderStats(await api.getStats(days), days); }
  catch (e) { body.replaceChildren(h('p', { class: 'form-err' }, `No se pudieron cargar las estadísticas (${e.message}). Si es tu primera vez con esta versión, ejecuta de nuevo supabase/schema.sql.`)); }
}
const SOC = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', x_twitter: 'X (Twitter)', youtube: 'YouTube', website: 'Sitio web', whatsapp: 'WhatsApp' };
const nf = n => Number(n || 0).toLocaleString('es-VE');
function tile(label, value, sub) { return h('div', { class: 'tile' }, h('span', { class: 'tile-v', text: value }), h('span', { class: 'tile-l', text: label }), sub ? h('span', { class: 'tile-s', text: sub }) : null); }
function rankList(title, rows, unit) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return h('section', { class: 'panel-card stat-card' }, h('h2', { text: title }),
    rows.length ? h('ol', { class: 'rank' }, rows.map(r => h('li', {}, h('span', { class: 'rank-n', text: r.name }), h('span', { class: 'rank-bar' }, h('i', { style: `width:${Math.max(4, Math.round(r.n / max * 100))}%` })), h('b', { text: nf(r.n) + (unit ? ' ' + unit : '') }))))
      : h('p', { class: 'muted', text: 'Aún no hay datos en este periodo.' }));
}
function renderStats(s, days) {
  const T = s.totals || {};
  // completa los días sin visitas
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' });
  const map = new Map((s.daily || []).map(d => [String(d.day).slice(0, 10), d.visits]));
  const series = [];
  if (s.demo) (s.daily || []).forEach(d => series.push({ day: d.day, v: d.visits }));
  else for (let i = days - 1; i >= 0; i--) { const day = fmt.format(new Date(Date.now() - i * 864e5)); series.push({ day, v: map.get(day) || 0 }); }
  const max = Math.max(1, ...series.map(x => x.v));
  const peak = series.reduce((a, b) => (b.v > a.v ? b : a), series[0] || { day: '', v: 0 });
  const chart = h('div', { class: 'bars', role: 'img', 'aria-label': `Visitas por día. Máximo: ${peak.v} el ${peak.day}.` },
    series.map(x => h('i', { style: `height:${Math.max(2, Math.round(x.v / max * 100))}%`, title: `${x.day}: ${x.v} visitas` })));
  const socials = Object.entries(s.socials || {}).map(([name, n]) => ({ name: SOC[name] || name, n })).sort((a, b) => b.n - a.n);
  const body = $('stats-body'); body.replaceChildren(
    h('div', { class: 'tiles' },
      tile('Visitas', nf(T.visit)),
      tile('Pedidos enviados', nf(T.order_sent), s.orders_usd ? `${api.fmtUsd(s.orders_usd)} en total` : null),
      tile('Toques en WhatsApp', nf(T.click_whatsapp)),
      tile('Clics en reseñas', nf((T.click_review_write || 0) + (T.click_review_read || 0)), `${nf(T.click_review_write)} para escribir una`)),
    h('section', { class: 'panel-card stat-card' }, h('h2', { text: 'Visitas por día' }), chart,
      h('div', { class: 'bars-axis' }, h('span', { text: series[0]?.day || '' }), h('span', { text: series[series.length - 1]?.day || '' }))),
    h('div', { class: 'two' },
      rankList('Platillos más vistos', s.top_viewed || [], 'vistas'),
      rankList('Platillos más pedidos', s.top_ordered || [], 'uds.')),
    rankList('Clics en redes sociales', socials, 'clics'),
    h('p', { class: 'hint', text: 'Las estadísticas son anónimas: se cuentan visitas y clics, sin guardar nombres, teléfonos ni direcciones.' }));
}

/* ---------- Código QR ---------- */
let qrReady = false;
function defaultMenuUrl() {
  if (S.settings.site_url) return S.settings.site_url;
  const u = new URL(location.href); u.hash = ''; u.search = '';
  u.pathname = u.pathname.replace(/[^/]*$/, '');
  return u.href;
}
const isLocalHost = u => { try { const x = new URL(u); return location.protocol === 'file:' || /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(x.hostname); } catch { return false; } };
function initQr() {
  if (!qrReady) {
    qrReady = true;
    $('qr-url').value = defaultMenuUrl();
    for (const id of ['qr-url', 'qr-tables', 'qr-level']) $(id).addEventListener('input', renderQr);
    $('qr-png').addEventListener('click', downloadPng);
    $('qr-svg').addEventListener('click', downloadSvg);
    $('qr-print').addEventListener('click', printCards);
  }
  renderQr();
}
function qrBase() {
  try { const u = new URL($('qr-url').value.trim()); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; }
}
const withMesa = (base, n) => { const u = new URL(base); u.searchParams.set('mesa', String(n)); return u.href; };
function renderQr() {
  const base = qrBase(), prev = $('qr-preview');
  $('qr-url-hint').textContent = !base ? 'Escribe una dirección válida que empiece por https://' : isLocalHost(base) ? 'Esta dirección es local: el QR solo funcionará en tu red o computador. Cuando publiques el menú, escribe aquí la dirección pública.' : '';
  const tables = Math.max(0, Math.min(200, Number($('qr-tables').value) || 0));
  $('qr-msg').textContent = tables ? `Se imprimirán ${tables} tarjetas (Mesa 1 a ${tables}), cada una con su QR.` : 'Se imprimirá una tarjeta con el QR general.';
  for (const id of ['qr-png', 'qr-svg', 'qr-print']) $(id).disabled = !base;
  if (!base) { prev.replaceChildren(h('p', { class: 'muted', text: 'Sin dirección válida' })); return; }
  try { prev.innerHTML = qrSvg(tables ? withMesa(base, 1) : base, { level: $('qr-level').value }); }
  catch (e) { prev.replaceChildren(h('p', { class: 'form-err', text: e.message })); }
}
function saveBlob(blob, name) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
async function downloadPng() { try { saveBlob(await qrPng(qrBase(), { level: $('qr-level').value }), 'menu-qr.png'); } catch (e) { toast(e.message, 'err'); } }
function downloadSvg() { try { saveBlob(new Blob([qrSvg(qrBase(), { level: $('qr-level').value })], { type: 'image/svg+xml' }), 'menu-qr.svg'); } catch (e) { toast(e.message, 'err'); } }
function buildSheet() {
  const base = qrBase(), tables = Math.max(0, Math.min(200, Number($('qr-tables').value) || 0)), level = $('qr-level').value;
  const sheet = $('qr-sheet'); sheet.replaceChildren();
  const mk = (url, label) => {
    const card = h('div', { class: 'qr-card' },
      h('h3', { text: S.settings.name || 'Menú' }),
      h('p', { class: 'qr-call' }, 'Escanea para ver el menú', h('br'), h('span', { text: 'Scan to see the menu' })));
    const holder = h('div', { class: 'qr-img' }); holder.innerHTML = qrSvg(url, { level });
    card.append(holder, label ? h('p', { class: 'qr-table', text: label }) : null);
    return card;
  };
  if (tables) for (let i = 1; i <= tables; i++) sheet.append(mk(withMesa(base, i), `Mesa ${i}`));
  else sheet.append(mk(base, ''));
  return sheet;
}
function printCards() {
  try { buildSheet(); } catch (e) { toast(e.message, 'err'); return; }
  document.body.classList.add('printing-qr');
  window.addEventListener('afterprint', () => document.body.classList.remove('printing-qr'), { once: true });
  window.print();
}

/* ---------- Restaurante ---------- */
const sf = $('settings-form');
const TEXT_FIELDS = ['name', 'tagline', 'tagline_en', 'address', 'phone', 'hours', 'hours_en', 'promo_text', 'promo_text_en', 'google_place_id', 'payment_methods', 'whatsapp', 'whatsapp_message', 'instagram', 'facebook', 'tiktok', 'x_twitter', 'youtube', 'website', 'site_url'];
function renderLogo() {
  const url = S.settings.logo_url, box = $('logo-preview');
  box.replaceChildren(url ? h('img', { src: url, alt: '' }) : h('span', { text: String(S.settings.name || 'M').trim().slice(0, 1).toUpperCase() }));
  $('logo-del').hidden = !url;
  $('logo-label').textContent = url ? 'Cambiar logo' : 'Subir logo';
}
$('logo-input').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (!f.type.startsWith('image/')) { toast('Elige una imagen (PNG o JPG).', 'err'); return; }
  $('logo-label').textContent = 'Subiendo…';
  try { S.settings = await api.setLogo(f); toast('Logo guardado'); }
  catch (ex) { toast(ex.message + ' (si es la primera vez, ejecuta el SQL del logo en Supabase)', 'err'); }
  renderLogo();
});
$('logo-del').addEventListener('click', async () => {
  if (!confirm('¿Quitar el logo? Se mostrará la inicial del restaurante.')) return;
  try { S.settings = await api.removeLogo(); toast('Logo quitado'); } catch (ex) { toast(ex.message, 'err'); }
  renderLogo();
});
function syncRates() {
  const on = sf.rates_auto.checked;
  sf.bcv_rate.disabled = on; sf.eur_rate.disabled = on; $('fetch-rate').disabled = false;
}
const MODES = [['dine_in', 'Comer aquí'], ['takeaway', 'Para llevar'], ['delivery', 'A domicilio']];
function weekRow(label, on, a, b, key) {
  const row = h('div', { class: 'wrow' + (on ? '' : ' off'), 'data-key': key });
  const chk = h('input', { type: 'checkbox', checked: on ? true : null, 'aria-label': `${label}: abierto` });
  const ti = h('input', { type: 'time', value: a || '', 'aria-label': `${label}: desde` }), to = h('input', { type: 'time', value: b || '', 'aria-label': `${label}: hasta` });
  chk.addEventListener('change', () => row.classList.toggle('off', !chk.checked));
  row.append(h('label', { class: 'sw' }, chk, h('span', {}, label)), h('div', { class: 'times' }, ti, h('span', {}, 'a'), to));
  return row;
}
function renderSchedule() {
  const week = S.settings.hours_week || {};
  $('hours-week').replaceChildren(...WEEK_ORDER.map(d => {
    const r = Array.isArray(week[d]) ? week[d] : null;
    return weekRow(['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d], !!r, r?.[0] || '11:00', r?.[1] || '22:00', d);
  }));
  const dp = { ...DEFAULT_DAYPARTS, ...(S.settings.dayparts || {}) };
  $('dayparts-cfg').replaceChildren(...DAYPARTS.map(k => {
    const row = weekRow(DP_LABEL[k], true, dp[k][0], dp[k][1] === '24:00' ? '23:59' : dp[k][1], k);
    row.querySelector('input[type=checkbox]').closest('label').replaceChildren(h('span', { style: 'font-weight:600' }, DP_LABEL[k]));
    return row;
  }));
  chipBox($('order-modes'), MODES, String(S.settings.order_modes || 'dine_in,takeaway,delivery').split(','));
  chipBox($('promo-days'), dayItems(), S.settings.promo_days || []);
}
function readSchedule() {
  const week = {};
  for (const row of $('hours-week').children) {
    const on = row.querySelector('input[type=checkbox]').checked, [a, b] = [...row.querySelectorAll('input[type=time]')].map(i => i.value);
    if (on) {
      if (parseHM(a) == null || parseHM(b) == null || a === b) throw new Error('Revisa las horas de apertura: cada día abierto necesita hora de inicio y de cierre distintas.');
      week[row.dataset.key] = [a, b];
    }
  }
  const dayparts = {};
  for (const row of $('dayparts-cfg').children) {
    const [a, b] = [...row.querySelectorAll('input[type=time]')].map(i => i.value);
    if (parseHM(a) == null || parseHM(b) == null) throw new Error('Revisa las horas de desayuno, almuerzo y cena.');
    dayparts[row.dataset.key] = [a, b];
  }
  const modes = chipVals($('order-modes'));
  if (!modes.length) throw new Error('Elige al menos un tipo de pedido.');
  return { hours_week: week, dayparts, order_modes: modes.join(','), promo_days: chipVals($('promo-days')).map(Number) };
}
function renderSettings() {
  renderLogo(); renderSchedule();
  sf.dayparts_on.checked = !!S.settings.dayparts_on;
  for (const k of TEXT_FIELDS) sf[k].value = S.settings[k] ?? '';
  sf.bcv_rate.value = S.settings.bcv_rate ?? '';
  sf.eur_rate.value = S.settings.eur_rate ?? '';
  sf.rates_auto.checked = S.settings.rates_auto !== false;
  syncRates();
  sf.order_enabled.checked = S.settings.order_enabled !== false;
  sf.promo_active.checked = !!S.settings.promo_active;
  sf.querySelector('details.en').open = !!(S.settings.tagline_en || S.settings.hours_en);
  const t = S.settings.bcv_updated_at;
  $('rate-hint').textContent = S.settings.rates_auto !== false ? 'Se usa la tasa oficial del BCV, actualizada sola.' : (S.settings.bcv_rate > 0) ? `Tasa fija. Última actualización: ${t ? new Date(t).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}. Borra el valor para volver a la automática.` : 'Vacío = se usa la tasa oficial BCV automática.';
}
$('fetch-rate').addEventListener('click', async e => {
  e.target.disabled = true;
  try { const v = await api.fetchBcvRate(); toast(`Tasa BCV de hoy: Bs. ${v.toFixed(2)} por $1. El menú la usa solo; no hace falta escribirla.`); }
  catch { toast('No se pudo traer la tasa. Escríbela a mano.', 'err'); }
  e.target.disabled = false;
});
sf.rates_auto.addEventListener('change', syncRates);
sf.addEventListener('submit', async e => {
  e.preventDefault();
  const rate = Number(sf.bcv_rate.value) || 0;
  const eur = Number(sf.eur_rate.value) || 0;
  const patch = { rates_auto: sf.rates_auto.checked, bcv_rate: rate, eur_rate: eur, order_enabled: sf.order_enabled.checked, promo_active: sf.promo_active.checked };
  for (const k of TEXT_FIELDS) patch[k] = sf[k].value.trim();
  try { Object.assign(patch, readSchedule(), { dayparts_on: sf.dayparts_on.checked }); } catch (ex) { toast(ex.message, 'err'); return; }
  if (patch.site_url && !/^https?:\/\//i.test(patch.site_url)) patch.site_url = 'https://' + patch.site_url;
  if (rate !== Number(S.settings.bcv_rate || 0) || eur !== Number(S.settings.eur_rate || 0)) patch.bcv_updated_at = new Date().toISOString();
  try { S.settings = await api.saveSettings(patch); renderSettings(); qrReady && ($('qr-url').value = defaultMenuUrl()); toast('Datos guardados'); }
  catch (ex) { toast(ex.message, 'err'); }
});

/* ---------- Equipo ---------- */
const ROLES = { owner: 'Dueño', manager: 'Gerente', staff: 'Empleado' };
async function loadTeam() {
  const box = $('team-list');
  box.replaceChildren(h('p', { class: 'muted' }, 'Cargando…'));
  try {
    const rows = await api.teamList();
    box.replaceChildren(...rows.map(r => {
      const sel = h('select', { 'aria-label': `Rol de ${r.email}` }, Object.entries(ROLES).map(([k, v]) => h('option', { value: k }, v)));
      sel.value = r.role;
      const me = r.email === S.me;
      sel.disabled = me;
      sel.addEventListener('change', async () => { try { await api.teamAdd(r.email, sel.value); toast('Rol actualizado'); } catch (ex) { toast(ex.message, 'err'); loadTeam(); } });
      return h('div', { class: 'trow' }, h('span', { class: 'who', text: r.email + (me ? ' (tú)' : '') }), sel,
        me ? null : h('button', { class: 'icon-btn', type: 'button', onclick: async () => {
          if (!confirm(`¿Quitar a ${r.email} del equipo? Su usuario seguirá existiendo pero ya no podrá entrar al panel.`)) return;
          try { await api.teamRemove(r.user_id); toast('Persona quitada'); loadTeam(); } catch (ex) { toast(ex.message, 'err'); }
        } }, 'Quitar'));
    }));
  } catch (e) { box.replaceChildren(h('p', { class: 'form-err', text: `${e.message} Si es tu primera vez con esta versión, ejecuta supabase/migracion-v3.sql.` })); }
}
$('team-add').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try { await api.teamAdd(f.email.value, f.role.value); f.reset(); toast('Agregado al equipo'); loadTeam(); }
  catch (ex) { toast(ex.message, 'err'); }
});

/* ---------- Copias e impresión ---------- */
const today = () => new Date().toISOString().slice(0, 10);
function saveBlobFile(blob, name) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
$('bk-json').addEventListener('click', async () => {
  try { saveBlobFile(new Blob([JSON.stringify(await api.exportAll(), null, 1)], { type: 'application/json' }), `copia-menu-${today()}.json`); $('bk-msg').textContent = 'Copia descargada. Guárdala en un lugar seguro.'; }
  catch (e) { toast(e.message, 'err'); }
});
$('bk-csv').addEventListener('click', () => {
  const q = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const head = ['Categoría', 'Platillo', 'Precio USD', 'Oferta USD', 'Descripción', 'Etiquetas', 'Combo', 'Visible', 'Agotado'];
  const rows = S.dishes.map(d => [catName(d.category_id), d.name, d.price_usd.toFixed(2), d.sale_price_usd == null ? '' : d.sale_price_usd.toFixed(2), d.description, (d.tags || []).map(k => TAG_LABELS[k] || k).join(', '), d.is_combo ? 'Sí' : '', d.active ? 'Sí' : 'No', d.sold_out ? 'Sí' : '']);
  saveBlobFile(new Blob(['\ufeff' + [head, ...rows].map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `platillos-${today()}.csv`);
  $('bk-msg').textContent = 'Archivo para Excel descargado.';
});
$('bk-file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const b = JSON.parse(await f.text());
    if (!confirm(`¿Restaurar la copia del ${String(b.at || '').slice(0, 10) || 'archivo'}? Trae ${b.dishes?.length ?? 0} platillos y ${b.categories?.length ?? 0} categorías. Se agregan o actualizan; no se borra nada.`)) return;
    const r = await api.restoreAll(b); await loadAll();
    $('bk-msg').textContent = `Copia restaurada: ${r.dishes} platillos y ${r.categories} categorías.`; toast('Copia restaurada');
  } catch (ex) { toast(ex instanceof SyntaxError ? 'Ese archivo no es una copia válida.' : ex.message, 'err'); }
});

/* ---------- Categorías ---------- */
function renderCats() {
  const box = $('cat-list'); box.replaceChildren();
  for (const c of S.cats) {
    const save = async (patch, msg) => {
      try { await api.saveCategory({ id: c.id, name: c.name, name_en: c.name_en || '', position: c.position, ...patch }); Object.assign(c, patch); renderFilters(); renderDishes(); toast(msg); }
      catch (ex) { toast(ex.message, 'err'); }
    };
    const name = h('input', { value: c.name, 'aria-label': `Nombre de la categoría ${c.name}`, maxlength: '40' });
    name.addEventListener('change', () => { const v = name.value.trim(); if (!v) { name.value = c.name; return; } save({ name: v }, 'Categoría renombrada'); });
    const en = h('input', { value: c.name_en || '', placeholder: 'Nombre en inglés', 'aria-label': `Nombre en inglés de ${c.name}`, maxlength: '40' });
    en.addEventListener('change', () => save({ name_en: en.value.trim() }, 'Nombre en inglés guardado'));
    box.append(h('div', { class: 'crow', 'data-id': c.id },
      h('button', { type: 'button', class: 'grip', 'aria-label': `Mover ${c.name}. Usa las flechas arriba y abajo.`, title: 'Arrastrar para ordenar' }, '⠿'),
      name, en,
      h('button', { class: 'icon-btn', type: 'button', onclick: async () => {
        if (!confirm(`¿Borrar la categoría “${c.name}”?`)) return;
        try { await api.deleteCategory(c.id); S.cats = await api.listCategories(); renderCats(); renderFilters(); renderDishes(); toast('Categoría borrada'); }
        catch (ex) { toast(ex.message, 'err'); }
      } }, 'Borrar')));
  }
  sortable(box, { itemSel: '.crow', handleSel: '.grip', onDone: async ids => {
    try { await api.saveCategoryOrder(ids); S.cats = await api.listCategories(); renderFilters(); renderDishes(); toast('Orden guardado'); }
    catch (ex) { toast(ex.message, 'err'); renderCats(); }
  } });
}
$('cat-add').addEventListener('submit', async e => {
  e.preventDefault();
  const name = e.target.name.value.trim(); if (!name) return;
  try {
    await api.saveCategory({ name, name_en: e.target.name_en.value.trim(), position: (Math.max(0, ...S.cats.map(c => c.position)) + 1) });
    e.target.reset(); S.cats = await api.listCategories(); renderCats(); renderFilters(); renderDishes(); toast('Categoría agregada');
  } catch (ex) { toast(ex.message, 'err'); }
});

boot();
