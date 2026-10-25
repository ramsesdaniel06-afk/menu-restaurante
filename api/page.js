// Sirve index.html con título, descripción, Open Graph y datos estructurados (JSON-LD)
// tomados de la base de datos, para que Google y WhatsApp muestren bien el restaurante.
// Si algo falla, devuelve index.html tal cual (el sitio sigue funcionando).
const fs = require('fs');
const path = require('path');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

function readConfig(root) {
  try {
    const txt = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
    const get = k => (txt.match(new RegExp(`export\\s+const\\s+${k}\\s*=\\s*['"\`]([^'"\`]*)['"\`]`)) || [])[1] || '';
    return { url: get('SUPABASE_URL').replace(/\/+$/, ''), key: get('SUPABASE_ANON_KEY') };
  } catch { return { url: '', key: '' }; }
}

async function rest(cfg, p) {
  const r = await fetch(`${cfg.url}/rest/v1/${p}`, { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function buildHead(s, dishes, origin) {
  const name = s.name || 'Menú';
  const title = clip(`${name} · Menú`, 70);
  const desc = clip([s.tagline, 'Menú con fotos y precios.', s.address].filter(Boolean).join(' '), 160);
  const base = (s.site_url || origin || '').replace(/\/?$/, '/');
  const img = dishes.map(d => (d.dish_photos || []).sort((a, b) => a.position - b.position)[0]?.url).find(Boolean) || (base ? base + 'icons/icon-512.png' : '');
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    base ? `<link rel="canonical" href="${esc(base)}">` : '',
    `<meta property="og:type" content="restaurant.menu">`,
    `<meta property="og:site_name" content="${esc(name)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    base ? `<meta property="og:url" content="${esc(base)}">` : '',
    img ? `<meta property="og:image" content="${esc(img)}">` : '',
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
  ];
  const sameAs = [];
  const h = (v, pre) => v && (/^https?:\/\//i.test(v) ? v : v.replace(/^@/, '') && pre + v.replace(/^@/, ''));
  if (s.instagram) sameAs.push(h(s.instagram, 'https://instagram.com/'));
  if (s.facebook) sameAs.push(h(s.facebook, 'https://facebook.com/'));
  if (s.tiktok) sameAs.push(h(s.tiktok, 'https://tiktok.com/@'));
  const ld = {
    '@context': 'https://schema.org', '@type': 'Restaurant', name,
    ...(s.tagline ? { description: s.tagline } : {}),
    ...(s.address ? { address: s.address } : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.hours ? { openingHours: s.hours } : {}),
    ...(base ? { url: base, hasMenu: base } : {}),
    ...(img ? { image: img } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  return tags.filter(Boolean).join('\n  ');
}

module.exports = async (req, res) => {
  const root = process.cwd();
  let html;
  try { html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); }
  catch { res.statusCode = 500; res.end('index.html no encontrado'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const cfg = readConfig(root);
    if (cfg.url && cfg.key) {
      const [[s], dishes] = await Promise.all([
        rest(cfg, 'settings?id=eq.1&select=*'),
        rest(cfg, 'dishes?active=eq.true&select=id,dish_photos(url,position)&order=position&limit=12'),
      ]);
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = host ? `https://${host}` : '';
      const head = buildHead(s || {}, dishes || [], origin);
      html = html
        .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
        .replace(/<meta name="description"[^>]*>\s*/i, '')
        .replace('<!--SEO-->', () => head);
    }
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=30');
  }
  res.statusCode = 200;
  res.end(html);
};
module.exports.buildHead = buildHead;
