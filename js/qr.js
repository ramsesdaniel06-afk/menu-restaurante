// Generador de códigos QR (modo byte, versiones 1–20, corrección de errores L/M/Q/H).
// Implementación propia, sin dependencias. Basada en el estándar ISO/IEC 18004.

const ECC_PER_BLOCK = [ // [nivel][versión]
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28],
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25],
];
const LEVEL = { L: 0, M: 1, Q: 2, H: 3 };
const FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H
const MAX_VERSION = 20;

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function rawModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
  return r;
}
const dataCodewords = (ver, lvl) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[lvl][ver] * NUM_BLOCKS[lvl][ver];

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) { r[j] = gfMul(r[j], root); if (j + 1 < degree) r[j] ^= r[j + 1]; }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, divisor) {
  const r = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ r.shift(); r.push(0);
    divisor.forEach((c, i) => { r[i] ^= gfMul(c, factor); });
  }
  return r;
}

function utf8(text) { return Array.from(new TextEncoder().encode(text)); }

function buildData(bytes, ver, lvl) {
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCodewords(ver, lvl) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xEC; out.length < cap / 8; pad ^= 0xEC ^ 0x11) out.push(pad);
  return out;
}

function interleave(data, ver, lvl) {
  const nb = NUM_BLOCKS[lvl][ver], eccLen = ECC_PER_BLOCK[lvl][ver];
  const raw = Math.floor(rawModules(ver) / 8), shortCount = nb - (raw % nb), shortLen = Math.floor(raw / nb);
  const blocks = [], div = rsDivisor(eccLen);
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < shortCount ? 0 : 1)); k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < shortCount) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= shortCount) out.push(b[i]); });
  return out;
}

function alignPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
  return r;
}

function penalty(m, size) {
  let score = 0;
  const line = (get) => {
    let run = 1;
    for (let i = 1; i < size; i++) { if (get(i) === get(i - 1)) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1; }
  };
  for (let y = 0; y < size; y++) line(i => m[y][i]);
  for (let x = 0; x < size; x++) line(i => m[i][x]);
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
  const pat = [true, false, true, true, true, false, true];
  const scan = (get) => {
    for (let i = 0; i + 7 <= size; i++) {
      if (!pat.every((v, k) => get(i + k) === v)) continue;
      const before = i >= 4 && [1, 2, 3, 4].every(k => !get(i - k));
      const after = i + 11 <= size && [7, 8, 9, 10].every(k => !get(i + k));
      if (before || after) score += 40;
    }
  };
  for (let y = 0; y < size; y++) scan(i => m[y][i]);
  for (let x = 0; x < size; x++) scan(i => m[i][x]);
  let dark = 0; for (const row of m) for (const v of row) if (v) dark++;
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

/** Devuelve { size, modules[y][x] (true = oscuro), version }. */
export function qrMatrix(text, level = 'M', forceMask = -1) {
  const lvl = LEVEL[level] ?? 1, bytes = utf8(text);
  let ver = 1;
  for (; ver <= MAX_VERSION; ver++) {
    const need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (need <= dataCodewords(ver, lvl) * 8) break;
  }
  if (ver > MAX_VERSION) throw new Error('El enlace es demasiado largo para el código QR.');
  const size = ver * 4 + 17;
  const codewords = interleave(buildData(bytes, ver, lvl), ver, lvl);

  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, Math.max(Math.abs(dx), Math.abs(dy)) !== 2 && Math.max(Math.abs(dx), Math.abs(dy)) !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = alignPositions(ver);
  ap.forEach((ax, i) => ap.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const formatBits = (mask, put) => {
    const data = (FORMAT_BITS[lvl] << 3) | mask; let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) put(8, i, bit(bits, i));
    put(8, 7, bit(bits, 6)); put(8, 8, bit(bits, 7)); put(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) put(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) put(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) put(8, size - 15 + i, bit(bits, i));
    put(8, size - 8, true);
  };
  formatBits(0, set); // reserva el espacio; se vuelve a escribir con la máscara elegida
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit(bits, i)); set(b, a, bit(bits, i)); }
  }
  // datos en zigzag
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
      if (!fn[y][x] && k < codewords.length * 8) { mod[y][x] = bit(codewords[k >>> 3], 7 - (k & 7)); k++; }
    }
  }
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
  ];
  let best = null, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask >= 0 && mask !== forceMask) continue;
    const m = mod.map((row, y) => row.map((v, x) => (!fn[y][x] && MASKS[mask](x, y) ? !v : v)));
    formatBits(mask, (x, y, d) => { m[y][x] = d; });
    const score = penalty(m, size);
    if (score < bestScore) { bestScore = score; best = m; }
  }
  return { size, version: ver, modules: best };
}

/** SVG listo para mostrar o descargar. */
export function qrSvg(text, { level = 'M', border = 4, dark = '#000', light = '#fff' } = {}) {
  const { size, modules } = qrMatrix(text, level), n = size + border * 2;
  let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) d += `M${x + border} ${y + border}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

/** PNG (Blob) del QR; `scale` = píxeles por módulo. */
export function qrPng(text, { level = 'M', border = 4, scale = 12 } = {}) {
  const { size, modules } = qrMatrix(text, level), n = (size + border * 2) * scale;
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); g.fillStyle = '#000';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) g.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo crear el PNG'))), 'image/png'));
}
