import { loadMenu, fmtUsd, fmtBs, unitPrice, onSale, isDemo, track } from './data.js';
import { h, googleLinks, socialLinks, waNumber } from './ui.js';
import { t, L, getLang, setLang, locale, TAGS, ALLERGEN_TAGS } from './i18n.js';

const $ = id => document.getElementById(id);
const state = { settings: {}, cats: [], dishes: [], cat: 'all', sort: 'menu', q: '', filters: new Set(), offline: false, mesa: '' };
const byId = new Map();
const cart = new Map(); // id -> cantidad

/* ---------- almacenamiento seguro ---------- */
const store = {
  get(k, s = localStorage) { try { return s.getItem(k); } catch { return null; } },
  set(k, v, s = localStorage) { try { s.setItem(k, v); } catch { /* ignore */ } },
};
const session = { get: k => store.get(k, sessionStorage), set: (k, v) => store.set(k, v, sessionStorage) };

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nameOf = d => L(d, 'name');
const orderingOn = () => state.settings.order_enabled !== false && !!waNumber(state.settings.whatsapp);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Carrusel de fotos ---------- */
function carousel(d) {
  const photos = d.photos, nm = nameOf(d);
  if (!photos.length) return h('div', { class: 'ph ph-empty', 'aria-hidden': 'true' }, nm.slice(0, 1));
  const track = h('div', { class: 'track', tabindex: photos.length > 1 ? '0' : null, role: 'group', 'aria-label': `${nm}: ${t('foto_alt')}` },
    photos.map((p, i) => h('img', { src: p.url, alt: `${nm}, ${t('foto_alt')} ${i + 1}/${photos.length}`, loading: 'lazy', decoding: 'async' })));
  const wrap = h('div', { class: 'ph' }, track);
  if (photos.length > 1) {
    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, photos.map((_, i) => h('i', { class: i === 0 ? 'on' : '' })));
    const go = dir => track.scrollBy({ left: dir * track.clientWidth, behavior: reduceMotion() ? 'auto' : 'smooth' });
    wrap.append(
      h('button', { class: 'nav prev', type: 'button', 'aria-label': '‹', onclick: () => go(-1) }, '‹'),
      h('button', { class: 'nav next', type: 'button', 'aria-label': '›', onclick: () => go(1) }, '›'),
      dots);
    let raf;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        [...dots.children].forEach((x, k) => x.classList.toggle('on', k === i));
      });
    }, { passive: true });
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
  }
  return wrap;
}

/* ---------- Vistas de platillo (estadística) ---------- */
const seen = new Set(JSON.parse(session.get('rm_seen') || '[]'));
const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const id = e.target.dataset.dish; io.unobserve(e.target);
    if (id && !seen.has(id)) { seen.add(id); session.set('rm_seen', JSON.stringify([...seen])); track('dish_view', { dish_id: id }); }
  }
}, { threshold: 0.6 }) : null;

/* ---------- Tarjeta de platillo ---------- */
function stepper(id) {
  const q = cart.get(id) || 0;
  return h('div', { class: 'stepper', role: 'group', 'aria-label': `${q} ${t('in_cart')}` },
    h('button', { type: 'button', 'aria-label': t('less'), onclick: () => setQty(id, q - 1) }, '−'),
    h('output', { 'aria-live': 'polite' }, String(q)),
    h('button', { type: 'button', 'aria-label': t('more'), onclick: () => setQty(id, q + 1) }, '+'));
}
function renderCtl(el) {
  const id = el.dataset.dish, d = byId.get(id);
  el.replaceChildren();
  if (!d || !orderingOn() || d.sold_out) return;
  el.append((cart.get(id) || 0) > 0 ? stepper(id) : h('button', { type: 'button', class: 'btn-add', onclick: () => setQty(id, 1) }, t('add')));
}

function card(d, { rail = false, daily = false } = {}) {
  const price = unitPrice(d), sale = onSale(d), nm = nameOf(d), desc = L(d, 'description');
  const bs = fmtBs(price, state.settings.bcv_rate, locale());
  const badges = [];
  if (d.daily && !daily) badges.push(h('span', { class: 'badge badge-daily' }, t('badge_daily')));
  if (d.featured && !rail) badges.push(h('span', { class: 'badge' }, t('badge_house')));
  if (sale) badges.push(h('span', { class: 'badge badge-offer' }, t('badge_offer')));
  const photo = carousel(d);
  if (d.sold_out) photo.append(h('span', { class: 'soldout' }, t('badge_soldout')));
  const el = h('article', { class: 'dish' + (daily ? ' dish-daily' : '') + (d.sold_out ? ' is-soldout' : ''), 'data-dish': d.id },
    photo,
    badges.length ? h('div', { class: 'badges' }, badges) : null,
    h('div', { class: 'dish-body' },
      h('h3', { text: nm }),
      h('p', { class: 'price' },
        h('b', { text: fmtUsd(price) }),
        sale ? h('s', { text: fmtUsd(d.price_usd) }) : null,
        bs ? h('small', { text: bs }) : null),
      desc ? h('p', { class: 'desc', text: desc }) : null,
      d.tags.length ? h('ul', { class: 'tags' }, TAGS.filter(x => d.tags.includes(x)).map(x => h('li', { class: 'tag' + (ALLERGEN_TAGS.includes(x) ? ' tag-warn' : '') }, t('t_' + x)))) : null),
    h('div', { class: 'cart-ctl', 'data-dish': d.id }));
  renderCtl(el.querySelector('.cart-ctl'));
  if (io) io.observe(el);
  return el;
}

/* ---------- Filtros ---------- */
function matches(d) {
  if (state.cat !== 'all' && d.category_id !== state.cat) return false;
  const q = norm(state.q).trim();
  if (q) {
    const hay = norm([d.name, d.name_en, d.description, d.description_en].join(' '));
    if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
  }
  for (const f of state.filters) {
    if (ALLERGEN_TAGS.includes(f)) { if (d.tags.includes(f)) return false; }
    else if (f === 'vegetariano') { if (!d.tags.includes('vegetariano') && !d.tags.includes('vegano')) return false; }
    else if (!d.tags.includes(f)) return false;
  }
  return true;
}
const filtering = () => state.q.trim() !== '' || state.filters.size > 0;

function renderDiet() {
  const box = $('diet'); box.replaceChildren();
  const active = state.dishes.filter(d => d.active);
  const present = new Set(active.flatMap(d => d.tags));
  const opts = [];
  for (const k of ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa', 'picante']) if (present.has(k)) opts.push([k, t('t_' + k)]);
  for (const k of ALLERGEN_TAGS) if (present.has(k)) opts.push([k, t('f_' + k)]);
  $('diet-btn').hidden = !opts.length;
  if (!opts.length) { box.hidden = true; return; }
  for (const [k, label] of opts) {
    box.append(h('button', { type: 'button', class: 'chip chip-sm', 'aria-pressed': String(state.filters.has(k)), onclick: () => { state.filters.has(k) ? state.filters.delete(k) : state.filters.add(k); renderDiet(); renderList(); renderHighlights(); } }, label));
  }
  if (state.filters.size) box.append(h('button', { type: 'button', class: 'link-btn', onclick: () => { state.filters.clear(); renderDiet(); renderList(); renderHighlights(); } }, t('clear')));
  $('diet-btn').setAttribute('aria-pressed', String(state.filters.size > 0));
}

function renderChips() {
  const chips = $('chips'); chips.replaceChildren();
  const used = new Set(state.dishes.filter(d => d.active).map(d => d.category_id));
  const mk = (id, label) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.cat === id), onclick: () => { state.cat = id; renderChips(); renderList(); } }, label);
  chips.append(mk('all', t('all')), ...state.cats.filter(c => used.has(c.id)).map(c => mk(c.id, L(c, 'name'))));
}

function renderList() {
  const list = $('list'); list.replaceChildren();
  const items = state.dishes.filter(d => d.active && matches(d));
  if (!items.length) {
    const any = state.dishes.some(d => d.active);
    list.append(h('div', { class: 'empty' },
      h('p', { text: filtering() ? t('no_results') : any ? t('empty_cat') : t('preparing') }),
      filtering() ? h('p', { class: 'muted', text: t('no_results_hint') }) : null,
      filtering() ? h('button', { type: 'button', class: 'btn btn-ghost-dark', onclick: () => { state.q = ''; $('q').value = ''; state.filters.clear(); renderDiet(); renderList(); renderHighlights(); } }, t('clear')) : null));
    return;
  }
  const grid = arr => h('div', { class: 'grid' }, arr.map(d => card(d)));
  if (state.sort === 'menu' && state.cat === 'all') {
    for (const c of state.cats) {
      const arr = items.filter(d => d.category_id === c.id);
      if (arr.length) list.append(h('section', { class: 'cat', 'aria-label': L(c, 'name') }, h('h3', { class: 'cat-t', text: L(c, 'name') }), grid(arr)));
    }
  } else {
    const arr = items.slice();
    if (state.sort === 'asc') arr.sort((a, b) => unitPrice(a) - unitPrice(b) || nameOf(a).localeCompare(nameOf(b)));
    else if (state.sort === 'desc') arr.sort((a, b) => unitPrice(b) - unitPrice(a) || nameOf(a).localeCompare(nameOf(b)));
    list.append(grid(arr));
  }
}

function renderHighlights() {
  const hide = filtering();
  const daily = hide ? null : state.dishes.find(d => d.active && d.daily);
  $('dia').hidden = !daily;
  $('dia-card').replaceChildren(...(daily ? [card(daily, { daily: true })] : []));
  const featured = hide ? [] : state.dishes.filter(d => d.active && d.featured);
  $('casa').hidden = !featured.length;
  $('rail').replaceChildren(...featured.map(d => card(d, { rail: true })));
}

/* ---------- Carrito y pedido por WhatsApp ---------- */
const cartLines = () => [...cart].map(([id, q]) => ({ d: byId.get(id), q })).filter(x => x.d);
const cartTotal = () => cartLines().reduce((s, x) => s + unitPrice(x.d) * x.q, 0);
const cartCount = () => cartLines().reduce((s, x) => s + x.q, 0);

function setQty(id, q) {
  q = Math.max(0, Math.min(99, q));
  q ? cart.set(id, q) : cart.delete(id);
  store.set('rm_cart_v2', JSON.stringify(Object.fromEntries(cart)));
  document.querySelectorAll(`.cart-ctl[data-dish="${CSS.escape(id)}"]`).forEach(renderCtl);
  renderCartBar();
  if ($('cart-dlg').open) renderCartDialog();
}

function money(usd) {
  const bs = fmtBs(usd, state.settings.bcv_rate, locale());
  return bs ? `${fmtUsd(usd)} · ${bs}` : fmtUsd(usd);
}
function renderCartBar() {
  const n = cartCount(), on = orderingOn() && n > 0;
  $('cart-bar').hidden = !on;
  $('cart-btn').hidden = !orderingOn();
  $('cart-badge').hidden = n === 0; $('cart-badge').textContent = String(n);
  document.body.classList.toggle('has-cart', on);
  $('cart-count').textContent = String(n);
  $('cart-total').textContent = fmtUsd(cartTotal());
  if (!on && $('cart-dlg').open) $('cart-dlg').close();
}

function currentType() { return document.querySelector('input[name=otype]:checked')?.value || 'dine_in'; }
function syncLocation() {
  const ty = currentType();
  $('o-loc-wrap').hidden = ty === 'takeaway';
  $('o-loc-label').textContent = ty === 'delivery' ? t('address') : t('table');
  if (ty === 'dine_in' && !$('o-loc').value && state.mesa) $('o-loc').value = state.mesa;
}
function buildOrder() {
  const s = state.settings, lines = cartLines(), total = cartTotal();
  const type = currentType(), name = $('o-name').value.trim(), loc = $('o-loc').value.trim(), notes = $('o-notes').value.trim();
  const out = [t('order_msg_hello'), '', `*${t('order_msg_title')} — ${s.name}*`];
  if (name) out.push(`${t('order_msg_client')}: ${name}`);
  out.push(`${t('order_msg_type')}: ${t(type)}`);
  if (type === 'dine_in' && loc) out.push(`${t('order_msg_table')}: ${loc}`);
  if (type === 'delivery' && loc) out.push(`${t('order_msg_address')}: ${loc}`);
  out.push('');
  for (const { d, q } of lines) out.push(`${q} x ${nameOf(d)} — ${fmtUsd(unitPrice(d) * q)}`);
  out.push('');
  const bs = fmtBs(total, s.bcv_rate, locale());
  out.push(`*${t('order_msg_total')}: ${fmtUsd(total)}*${bs ? ` (${bs})` : ''}`);
  if (notes) out.push('', `${t('order_msg_notes')}: ${notes}`);
  return { url: `https://wa.me/${waNumber(s.whatsapp)}?text=${encodeURIComponent(out.join('\n'))}`, total };
}
function updateSend() { if (cart.size) { $('o-send').href = buildOrder().url; $('cart-sum-total').textContent = money(cartTotal()); } }

function renderCartDialog() {
  const items = $('cart-items'); items.replaceChildren();
  const lines = cartLines(), empty = !lines.length;
  $('cart-form').hidden = empty; $('cart-foot').hidden = empty;
  if (empty) {
    items.append(h('div', { class: 'empty' }, h('p', { text: t('order_empty') }), h('p', { class: 'muted', text: t('order_empty_hint') })));
    return;
  }
  for (const { d, q } of lines) {
    items.append(h('div', { class: 'cart-row' },
      h('div', { class: 'cart-row-main' }, h('strong', { text: nameOf(d) }), h('span', { class: 'muted', text: fmtUsd(unitPrice(d)) })),
      stepper(d.id),
      h('b', { class: 'cart-row-total', text: fmtUsd(unitPrice(d) * q) })));
  }
  syncLocation(); updateSend();
}
function openCart() { renderCartDialog(); $('cart-dlg').showModal(); }

/* ---------- Contacto, reseñas, pie ---------- */
function renderContact() {
  const s = state.settings, links = socialLinks(s);
  $('contacto').hidden = !links.length;
  $('soc').replaceChildren(...links.map(l => h('a', {
    class: 'btn btn-social btn-' + l.key, href: l.url, target: '_blank', rel: 'noopener',
    onclick: () => track(l.key === 'whatsapp' ? 'click_whatsapp' : 'click_social', { meta: l.key === 'whatsapp' ? null : l.key }),
  }, l.key === 'website' ? t('website') : l.label)));
  const wa = links.find(l => l.key === 'whatsapp');
  $('wa-float').hidden = !wa;
  if (wa) $('wa-float').href = wa.url;
}
function renderFooter() {
  const s = state.settings;
  $('f-name').textContent = s.name; $('f-address').textContent = s.address || ''; $('f-phone').textContent = s.phone || '';
  if (Number(s.bcv_rate) > 0) {
    const date = s.bcv_updated_at ? new Date(s.bcv_updated_at).toLocaleDateString(locale(), { day: 'numeric', month: 'long' }) : '';
    $('f-rate').textContent = t('rate_note', { rate: Number(s.bcv_rate).toLocaleString(locale(), { minimumFractionDigits: 2 }), date });
  } else $('f-rate').textContent = '';
  $('f-demo').hidden = !isDemo; $('f-demo').textContent = t('demo_note');
}
function renderHero() {
  const s = state.settings;
  document.title = `${s.name} · ${t('nav_menu')}`;
  $('r-name').textContent = s.name;
  $('brand-mark').textContent = String(s.name || 'M').trim().slice(0, 1).toUpperCase();
  const hrs = L(s, 'hours');
  $('r-tagline').textContent = L(s, 'tagline');
  $('r-hours').textContent = hrs; $('hoursbar').hidden = !hrs;
  $('table-chip').hidden = !state.mesa; $('table-chip').textContent = state.mesa ? t('table_banner', { n: state.mesa }) : '';
  $('lang').textContent = getLang() === 'es' ? 'EN' : 'ES';
}
function renderPromo() {
  const s = state.settings, text = L(s, 'promo_text').trim();
  const dismissed = session.get('rm_promo_x') === text;
  $('promo').hidden = !(s.promo_active && text && !dismissed);
  $('promo-text').textContent = text;
}

function applyStatic() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $('lang').setAttribute('aria-label', t('lang_toggle'));
  $('menu-btn').setAttribute('aria-label', t('open_menu'));
  $('search-btn').setAttribute('aria-label', t('search_open'));
  $('cart-btn').setAttribute('aria-label', t('cart_open'));
  $('menu-close').setAttribute('aria-label', t('close'));
  $('drawer-t').textContent = state.settings.name || t('nav_menu');
  $('promo-x').setAttribute('aria-label', t('dismiss'));
  $('cart-close').setAttribute('aria-label', t('close'));
  $('chips').setAttribute('aria-label', t('cats'));
  $('diet').setAttribute('aria-label', t('diet'));
  $('wa-float').setAttribute('aria-label', 'WhatsApp');
  $('offline').hidden = !state.offline; $('offline').textContent = t('offline');
}

function renderAll() {
  applyStatic(); renderHero(); renderPromo(); renderHighlights(); renderDiet(); renderChips(); renderList();
  renderContact(); renderFooter(); renderCartBar();
  const g = googleLinks(state.settings); $('g-write').href = g.write; $('g-read').href = g.reviews;
  if ($('cart-dlg').open) renderCartDialog();
}

/* ---------- Inicio ---------- */
async function init() {
  let data;
  try { data = await loadMenu(); }
  catch (e) { console.error(e); applyStatic(); $('list').append(h('p', { class: 'empty' }, t('load_error'))); return; }
  Object.assign(state, { settings: data.settings, cats: data.cats, dishes: data.dishes, offline: data.offline });
  state.dishes.forEach(d => byId.set(d.id, d));

  const mesa = new URLSearchParams(location.search).get('mesa');
  if (mesa && /^[\p{L}\p{N} _-]{1,12}$/u.test(mesa)) session.set('rm_mesa', mesa.trim());
  state.mesa = session.get('rm_mesa') || '';
  if (state.mesa) { $('o-loc').value = state.mesa; }

  try { for (const [id, q] of Object.entries(JSON.parse(store.get('rm_cart_v2') || '{}'))) { const d = byId.get(id); if (d && d.active && !d.sold_out && q > 0) cart.set(id, Math.min(99, q)); } } catch { /* carrito corrupto */ }
  $('o-name').value = store.get('rm_oname') || '';

  // eventos
  $('lang').addEventListener('click', () => { setLang(getLang() === 'es' ? 'en' : 'es'); renderAll(); });
  const drawer = $('menu-dlg');
  $('menu-btn').addEventListener('click', () => drawer.showModal());
  $('menu-close').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', e => { if (e.target === drawer || e.target.closest('.drawer-nav a')) drawer.close(); });
  $('search-btn').addEventListener('click', () => {
    const open = $('finder').hidden; $('finder').hidden = !open; $('search-btn').setAttribute('aria-expanded', String(open));
    if (open) $('q').focus();
  });
  $('cart-btn').addEventListener('click', openCart);
  $('see-all').addEventListener('click', () => { state.cat = 'all'; state.sort = 'menu'; $('sort').value = 'menu'; renderChips(); renderList(); });
  $('promo-x').addEventListener('click', () => { session.set('rm_promo_x', L(state.settings, 'promo_text').trim()); renderPromo(); });
  $('sort').addEventListener('change', e => { state.sort = e.target.value; renderList(); });
  $('q').addEventListener('input', e => {
    state.q = e.target.value; renderList(); renderHighlights();
    if (state.q.trim() && $('menu').getBoundingClientRect().top > 160) $('menu').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
  });
  $('diet-btn').addEventListener('click', () => { const open = $('diet').hidden; $('diet').hidden = !open; $('diet-btn').setAttribute('aria-expanded', String(open)); });
  $('cart-bar').addEventListener('click', openCart);
  $('cart-close').addEventListener('click', () => $('cart-dlg').close());
  $('cart-dlg').addEventListener('click', e => { if (e.target === $('cart-dlg')) $('cart-dlg').close(); });
  $('cart-clear').addEventListener('click', () => { for (const id of [...cart.keys()]) setQty(id, 0); });
  document.querySelectorAll('input[name=otype]').forEach(r => r.addEventListener('change', () => { syncLocation(); updateSend(); }));
  for (const id of ['o-name', 'o-loc', 'o-notes']) $(id).addEventListener('input', () => { if (id === 'o-name') store.set('rm_oname', $('o-name').value); updateSend(); });
  $('o-send').addEventListener('click', () => {
    const { total } = buildOrder();
    for (const { d, q } of cartLines()) track('order_item', { dish_id: d.id, qty: q });
    track('order_sent', { meta: total.toFixed(2) });
  });
  $('g-read').addEventListener('click', () => track('click_review_read'));
  $('g-write').addEventListener('click', () => track('click_review_write'));
  $('wa-float').addEventListener('click', () => track('click_whatsapp'));

  renderAll();
  if (!session.get('rm_visit')) { session.set('rm_visit', '1'); track('visit', { meta: state.mesa ? `mesa:${state.mesa}` : null }); }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
