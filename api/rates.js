// Tasas oficiales del Banco Central de Venezuela (dólar y euro), vía ve.dolarapi.com.
// Vercel guarda la respuesta 1 hora y, si el servicio cae, sigue entregando la última tasa buena hasta por 1 día.
const BASE = 'https://ve.dolarapi.com/v1/';
const num = j => { const v = Number(j && (j.promedio ?? j.venta ?? j.compra)); return v > 0 ? v : 0; };

async function get(path) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(7000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

module.exports = async (req, res) => {
  const [u, e] = await Promise.allSettled([
    get('dolares/oficial'),
    get('euros/oficial').catch(async () => { const a = await get('euros'); return Array.isArray(a) ? a.find(x => x.fuente === 'oficial') : a; }),
  ]);
  const du = u.status === 'fulfilled' ? u.value : null, de = e.status === 'fulfilled' ? e.value : null;
  const out = { usd: num(du), eur: num(de), updated: (du && du.fechaActualizacion) || (de && de.fechaActualizacion) || '', source: 've.dolarapi.com (BCV oficial)' };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!out.usd && !out.eur) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.statusCode = 502; res.end(JSON.stringify({ error: 'sin datos' })); return;
  }
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.statusCode = 200; res.end(JSON.stringify(out));
};
