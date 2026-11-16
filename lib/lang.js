// Language detection by script (no model needed): share of Devanagari letters among all letters.
export function detectLanguage(text) {
  const letters = String(text || '').match(/\p{L}/gu) || [];
  if (!letters.length) return { code: 'unknown', devanagariShare: 0 };
  const dev = letters.filter((c) => /[\u0900-\u097F]/.test(c)).length / letters.length;
  return { code: dev > 0.5 ? 'hi' : dev > 0.1 ? 'mixed' : 'en', devanagariShare: Number(dev.toFixed(2)) };
}
