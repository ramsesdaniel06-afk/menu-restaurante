import { loadMenu, getAutoRates, fmtUsd, fmtBs } from './data.js';
import { h } from './ui.js';
import { t, L, getLang, setLang, TAGS } from './i18n.js';
import { weekLines } from './schedule.js';

const $ = id => document.getElementById(id);
const st = { settings: {}, cats: [], dishes: [], usd: 0 };
const ABBR = { picante: 'P', vegetariano: 'V', vegano: 'VG', sin_gluten: 'SG', sin_lactosa: 'SL', mariscos: 'M', frutos_secos: 'FS', huevo: 'H' };

function render() {
  const { settings: s, cats, dishes } = st, lang = getLang();
  const showBs = $('o-bs').checked && st.usd > 0;
  $('sheet').classList.toggle('nodesc', !$('o-desc').checked);
  document.documentElement.lang = lang;
  const usedTags = new Set();
  const sections = cats.map(c => {
    const list = dishes.filter(d => d.active && d.category_id === c.id);
    if (!list.length) return null;
    return h('section', { class: 'cat' }, h('h2', { text: L(c, 'name') }), list.map(d => {
      (d.tags || []).forEach(k => usedTags.add(k));
      const tags = TAGS.filter(k => (d.tags || []).includes(k)).map(k => ABBR[k]).join(' · ');
      return h('div', { class: 'dish' },
        h('div', { class: 'line' }, h('span', { text: L(d, 'name') }), h('span', { class: 'fill' }),
          h('span', { class: 'p' }, fmtUsd(d.price_usd), showBs ? h('span', { class: 'bs', text: ' · ' + fmtBs(d.price_usd, st.usd, lang === 'en' ? 'en-US' : 'es-VE') }) : null)),
        L(d, 'description') ? h('p', { class: 'desc', text: L(d, 'description') }) : null,
        tags ? h('p', { class: 'tg', text: tags }) : null,
        $('o-extras').checked && d.options?.length ? h('p', { class: 'extras' }, d.options.map(g => `${L(g, 'name')}: ${g.items.map(it => L(it, 'name') + (it.price > 0 ? ` +${fmtUsd(it.price)}` : '')).join(', ')}`).join(' — ')) : null);
    }));
  }).filter(Boolean);
  const week = weekLines(s.hours_week, lang, t('closed_word'));
  const legend = TAGS.filter(k => usedTags.has(k)).map(k => `${ABBR[k]} = ${t('t_' + k)}`).join('   ');
  $('sheet').replaceChildren(
    h('header', {}, h('h1', { text: s.name }), L(s, 'tagline') ? h('p', { text: L(s, 'tagline') }) : null,
      h('p', { text: [s.address, s.phone].filter(Boolean).join(' · ') }),
      week.length ? h('p', { text: week.join('   |   ') }) : (L(s, 'hours') ? h('p', { text: L(s, 'hours') }) : null)),
    sections.length ? h('div', { class: 'cats' }, sections) : h('p', { text: t('preparing') }),
    h('footer', {}, legend, showBs ? h('div', { text: `${t('rate_note', { rate: Number(st.usd).toLocaleString(lang === 'en' ? 'en-US' : 'es-VE', { minimumFractionDigits: 2 }), date: new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-VE', { day: 'numeric', month: 'long' }), eur: '' })}` }) : null));
  document.title = `${s.name} · ${t('nav_menu')}`;
}

(async () => {
  try {
    const d = await loadMenu(); Object.assign(st, d);
    $('o-lang').value = getLang();
    for (const id of ['o-desc', 'o-extras', 'o-bs']) $(id).addEventListener('change', render);
    $('o-lang').addEventListener('change', e => { setLang(e.target.value); render(); });
    $('o-print').addEventListener('click', () => window.print());
    const r = Number(d.settings.bcv_rate) > 0 && d.settings.rates_auto === false ? { usd: Number(d.settings.bcv_rate) } : await getAutoRates().catch(() => ({}));
    st.usd = r.usd || Number(d.settings.bcv_rate) || 0;
    if (!st.usd) $('o-bs').closest('label').hidden = true;
    render();
  } catch (e) { $('sheet').replaceChildren(h('p', { text: t('load_error') })); }
})();
