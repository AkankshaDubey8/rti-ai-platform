// Minimal dependency-free PDF 1.4 writer (A4, Helvetica). Used for acknowledgement receipts, final responses and reports.
// Limitation: standard PDF fonts only cover Latin-1 text. Other scripts (e.g. Devanagari) are replaced with "?".
const W = 595.28; const H = 841.89; const M = 56;
const HELV = { 32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191, 40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556, 64: 1015,
  65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611,
  91: 278, 92: 278, 93: 278, 94: 469, 95: 556, 96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556, 104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556, 111: 556, 112: 556, 113: 556, 114: 333,
  115: 500, 116: 278, 117: 556, 118: 500, 119: 722, 120: 500, 121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584 };
for (let c = 48; c <= 57; c++) HELV[c] = 556;

const MAP = { '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"', '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u20B9': 'Rs.', '\u2022': '\u2022', '\t': '    ' };
export function pdfSafe(s) {
  return String(s ?? '').replace(/\r/g, '').replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u20B9\t]/g, (c) => MAP[c]).replace(/[^\n\x20-\x7E\xA0-\xFF\u2022]/g, '?');
}
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const toLatin1 = (s) => s.replace(/\u2022/g, '\x95');
export const textWidth = (s, size, bold) => [...s].reduce((w, ch) => w + (HELV[ch.charCodeAt(0)] ?? 556), 0) * size / 1000 * (bold ? 1.06 : 1);

function wrap(text, maxW, size, bold) {
  const out = [];
  for (const para of pdfSafe(text).split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (let word of para.split(/ +/)) {
      while (textWidth(word, size, bold) > maxW) { // break very long tokens
        let cut = word.length; while (cut > 1 && textWidth(word.slice(0, cut), size, bold) > maxW) cut--;
        if (line) { out.push(line); line = ''; }
        out.push(word.slice(0, cut)); word = word.slice(cut);
      }
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, bold) <= maxW) line = next; else { if (line) out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

// blocks: { t:'h1'|'h2'|'p'|'pre'|'kv'|'rule'|'gap'|'note', text, key, value }
export function buildPdf({ title, subtitle = '', blocks = [], footer = '' }) {
  const pages = []; let ops; let y;
  const newPage = (first) => { ops = []; pages.push(ops); y = H - M; if (first) { ops.push(`q 0.153 0.329 0.82 rg 0 ${H - 84} ${W} 84 re f Q`); } };
  newPage(true);
  const text = (s, x, yy, size, bold, rgb = '0.05 0.12 0.25') => ops.push(`BT ${rgb} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${esc(toLatin1(s))}) Tj ET`);
  const ensure = (need) => { if (y - need < M + 24) newPage(false); };
  // header band
  ops.push(`BT 1 1 1 rg /F2 20 Tf ${M} ${H - 46} Td (${esc(toLatin1(pdfSafe(title).slice(0, 70)))}) Tj ET`);
  if (subtitle) ops.push(`BT 0.86 0.91 1 rg /F1 10 Tf ${M} ${H - 66} Td (${esc(toLatin1(pdfSafe(subtitle).slice(0, 110)))}) Tj ET`);
  y = H - 84 - 30;
  for (const b of blocks) {
    if (b.t === 'gap') { y -= b.size || 10; continue; }
    if (b.t === 'rule') { ensure(12); ops.push(`0.8 0.85 0.92 RG 0.8 w ${M} ${y} m ${W - M} ${y} l S`); y -= 14; continue; }
    if (b.t === 'kv') {
      const lines = wrap(b.value || '-', W - 2 * M - 130, 10.5, false); ensure(lines.length * 14 + 4);
      text(b.key, M, y, 9.5, true, '0.35 0.42 0.55'); lines.forEach((l, i) => text(l, M + 130, y - i * 14, 10.5, false)); y -= lines.length * 14 + 4; continue;
    }
    const style = { h1: [16, true, 22], h2: [12.5, true, 18], p: [10.5, false, 15], pre: [10.5, false, 15], note: [9, false, 12.5] }[b.t] || [10.5, false, 15];
    const [size, bold, lead] = style; const indent = b.t === 'note' ? 0 : 0;
    const lines = wrap(b.text || '', W - 2 * M - indent, size, bold);
    if (b.t === 'h1' || b.t === 'h2') ensure(lead * 2);
    for (const l of lines) { ensure(lead); text(l, M + indent, y, size, bold, b.t === 'note' ? '0.4 0.45 0.55' : '0.05 0.12 0.25'); y -= lead; }
    y -= b.t === 'h1' ? 6 : b.t === 'h2' ? 3 : 4;
  }
  pages.forEach((p, i) => { p.push(`BT 0.45 0.5 0.6 rg /F1 8 Tf ${M} 34 Td (${esc(toLatin1(pdfSafe(footer).slice(0, 120)))}) Tj ET`); p.push(`BT 0.45 0.5 0.6 rg /F1 8 Tf ${W - M - 50} 34 Td (Page ${i + 1} of ${pages.length}) Tj ET`); });

  // objects: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then per page: content, page
  const objs = []; const add = (body) => { objs.push(body); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${pages.map((_, i) => `${6 + i * 2 + 1} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add(`<< /Title (${esc(toLatin1(pdfSafe(title)))}) /Producer (RTI Assist) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);
  pages.forEach((p, i) => {
    const stream = Buffer.from(p.join('\n'), 'latin1');
    add(`<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`);
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
  });
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
