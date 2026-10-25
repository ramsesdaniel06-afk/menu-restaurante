// Ayudantes de interfaz compartidos por el menú público y el panel.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

export function googleLinks(s) {
  const id = (s.google_place_id || '').trim();
  const q = encodeURIComponent(`${s.name} ${s.address || ''}`.trim());
  return {
    reviews: id ? `https://search.google.com/local/reviews?placeid=${encodeURIComponent(id)}` : `https://www.google.com/maps/search/?api=1&query=${q}`,
    write: id ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}` : `https://www.google.com/maps/search/?api=1&query=${q}`,
    exact: !!id,
  };
}

let toastTimer;
export function toast(msg, kind = 'ok') {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = msg; t.dataset.kind = kind; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- Contacto y redes ---------- */
const clean = v => String(v || '').trim();
const handle = v => clean(v).replace(/^@+/, '').replace(/\s+/g, '');
function safeUrl(v) {
  let u = clean(v); if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x.href : ''; } catch { return ''; }
}
function viaHandle(v, base) { const t = clean(v); if (!t) return ''; return /[./]/.test(t) && !/^@/.test(t) ? safeUrl(t) : base + encodeURIComponent(handle(t)); }

/** Número de WhatsApp -> solo dígitos con código de país (si empieza por 0, asume Venezuela +58). */
export function waNumber(v) {
  let d = clean(v).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '58' + d.slice(1);
  return d.length >= 8 ? d : '';
}
export function socialLinks(s) {
  const out = [];
  const wa = waNumber(s.whatsapp);
  if (wa) out.push({ key: 'whatsapp', label: 'WhatsApp', url: `https://wa.me/${wa}` + (clean(s.whatsapp_message) ? `?text=${encodeURIComponent(clean(s.whatsapp_message))}` : '') });
  const add = (key, label, url) => { if (url) out.push({ key, label, url }); };
  add('instagram', 'Instagram', viaHandle(s.instagram, 'https://www.instagram.com/'));
  add('facebook', 'Facebook', viaHandle(s.facebook, 'https://www.facebook.com/'));
  add('tiktok', 'TikTok', viaHandle(s.tiktok, 'https://www.tiktok.com/@'));
  add('x', 'X', viaHandle(s.x_twitter, 'https://x.com/'));
  add('youtube', 'YouTube', viaHandle(s.youtube, 'https://www.youtube.com/@'));
  add('website', 'Sitio web', safeUrl(s.website));
  return out;
}
