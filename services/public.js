// Public transparency statistics. Aggregated counts only: no names, request text, personal details or documents are ever included.
import { toCsv } from '../lib/csv.js';
import { CATEGORIES } from '../lib/workflow.js';

const DAY = 864e5; const RESOLVED = ['response_issued', 'closed'];
const ymd = (d) => new Date(d).toISOString().slice(0, 7);

export async function publicStats(store, { from, to, department, category, source = 'all' } = {}) {
  const [apps, depts, feedback] = await Promise.all([store.find('applications'), store.find('departments', {}, { sort: { name: 1 } }), store.find('feedback')]);
  const fromT = from && !Number.isNaN(Date.parse(from)) ? Date.parse(from) : null; const toT = to && !Number.isNaN(Date.parse(to)) ? Date.parse(to) + DAY - 1 : null;
  const inScope = apps.filter((a) => (fromT === null || new Date(a.createdAt) >= fromT) && (toT === null || new Date(a.createdAt) <= toT) && (!department || a.department === department) && (!category || a.category === category));
  const sel = inScope.filter((a) => source === 'all' || (source === 'demo' ? a.isDemo : !a.isDemo));
  const resolved = sel.filter((a) => RESOLVED.includes(a.status)); const rejected = sel.filter((a) => a.status === 'rejected'); const pending = sel.length - resolved.length - rejected.length;
  const times = resolved.filter((a) => a.respondedAt).map((a) => (new Date(a.respondedAt) - new Date(a.createdAt)) / DAY);
  const dn = Object.fromEntries(depts.map((d) => [d.id, d.name]));
  const byDept = {}; for (const a of sel) { const n = dn[a.department] || 'Not yet routed'; const r = (byDept[n] ||= { name: n, submitted: 0, resolved: 0, rejected: 0, pending: 0 }); r.submitted++; if (RESOLVED.includes(a.status)) r.resolved++; else if (a.status === 'rejected') r.rejected++; else r.pending++; }
  const cats = {}; sel.forEach((a) => { cats[a.category] = (cats[a.category] || 0) + 1; });
  const months = {}; for (const a of sel) { const m = (months[ymd(a.createdAt)] ||= { month: ymd(a.createdAt), submitted: 0, resolved: 0 }); m.submitted++; if (RESOLVED.includes(a.status)) m.resolved++; }
  const ids = new Set(sel.map((a) => a.id)); const fb = feedback.filter((f) => ids.has(f.application));
  return {
    totals: { submitted: sel.length, resolved: resolved.length, rejected: rejected.length, pending, resolutionRate: sel.length ? Number(((resolved.length / sel.length) * 100).toFixed(1)) : null, averageProcessingDays: times.length ? Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)) : null },
    byDepartment: Object.values(byDept).sort((a, b) => b.submitted - a.submitted), byCategory: Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    byMonth: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)), sources: { demo: inScope.filter((a) => a.isDemo).length, platform: inScope.filter((a) => !a.isDemo).length },
    satisfaction: { average: fb.length ? Number((fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(1)) : null, responses: fb.length },
    filters: { departments: depts.filter((d) => d.active !== false).map((d) => ({ id: d.id, name: d.name })), categories: CATEGORIES },
    applied: { from: from || null, to: to || null, department: department || null, category: category || null, source },
    notice: 'Statistics of this platform only. They are not statistics of any government. Records marked DEMO are fictional demonstration data; "Platform" records were created by people using this installation.',
  };
}

export function publicStatsCsv(stats) {
  const rows = [
    { section: 'summary', name: 'Submitted', a: stats.totals.submitted, b: '', c: '' }, { section: 'summary', name: 'Resolved', a: stats.totals.resolved, b: '', c: '' }, { section: 'summary', name: 'Rejected', a: stats.totals.rejected, b: '', c: '' },
    { section: 'summary', name: 'Pending', a: stats.totals.pending, b: '', c: '' }, { section: 'summary', name: 'Resolution rate (%)', a: stats.totals.resolutionRate ?? '', b: '', c: '' }, { section: 'summary', name: 'Average processing days', a: stats.totals.averageProcessingDays ?? '', b: '', c: '' },
    ...stats.byDepartment.map((d) => ({ section: 'department', name: d.name, a: d.submitted, b: d.resolved, c: d.pending })), ...stats.byCategory.map((c) => ({ section: 'category', name: c.name, a: c.value, b: '', c: '' })),
    ...stats.byMonth.map((m) => ({ section: 'month', name: m.month, a: m.submitted, b: m.resolved, c: '' })),
  ];
  return toCsv([{ header: 'section', value: 'section' }, { header: 'name', value: 'name' }, { header: 'count_or_value', value: 'a' }, { header: 'resolved', value: 'b' }, { header: 'pending', value: 'c' }], rows)
    + `# Source filter: ${stats.applied.source}. ${stats.notice}\r\n`;
}
