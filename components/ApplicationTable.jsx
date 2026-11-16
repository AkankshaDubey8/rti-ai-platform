'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, FolderOpen, Search, SlidersHorizontal } from 'lucide-react';
import { useApi, useDebounced } from '@/hooks/useApi';
import { CATEGORIES, statusLabel } from '@/lib/workflow';
import { fmtDate } from '@/lib/client';
import { StatusBadge, STATUS_OPTIONS } from './StatusBadge';
import { Badge, Button, Card, DemoBadge, EmptyState, ErrorState, Pagination, Select, SkeletonRows } from './ui';

const SORTS = { newest: 'Newest first', oldest: 'Oldest first', due: 'Due date', status: 'Status', priority: 'Priority' };
const PRIO = { high: ['rose', 'High'], medium: ['amber', 'Medium'], normal: ['slate', 'Normal'] };

export function DeadlineBadge({ d }) {
  if (!d || d.state === 'done') return null;
  const tone = d.state === 'overdue' ? 'rose' : d.state === 'due_soon' ? 'amber' : 'slate';
  return <Badge tone={tone}>{d.state === 'overdue' ? `Overdue ${Math.abs(d.daysLeft)}d` : `Due in ${d.daysLeft}d`}</Badge>;
}

// Searchable, filterable, sortable, paginated list used by citizens, officers and administrators.
export default function ApplicationTable({ hrefFor, showCitizen, showOfficer, emptyAction, pageSize = 8, title, defaultSort = 'newest', staff, departments = [] }) {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [category, setCategory] = useState(''); const [page, setPage] = useState(1);
  const [sort, setSort] = useState(defaultSort); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [department, setDepartment] = useState(''); const [attention, setAttention] = useState(false); const [more, setMore] = useState(false); const [size, setSize] = useState(pageSize);
  const q = useDebounced(search);
  useEffect(() => { setPage(1); }, [q, status, category, sort, from, to, department, attention, size]);
  const qs = new URLSearchParams({ search: q, status, category, department, from, to, sort, ...(attention ? { attention: '1' } : {}), page, pageSize: size }).toString();
  const { data, error, loading, reload } = useApi(`/api/applications?${qs}`);
  const filtered = Boolean(q || status || category || department || from || to || attention);
  const clear = () => { setSearch(''); setStatus(''); setCategory(''); setDepartment(''); setFrom(''); setTo(''); setAttention(false); };
  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-navy-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {title && <h2 className="mr-auto text-lg font-semibold">{title}</h2>}
          <div className="relative min-w-[14rem] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden /><input className="input pl-9" placeholder="Search ID, subject, category or document text" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search applications" /></div>
          <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</Select>
          <Select className="w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">{Object.entries(SORTS).filter(([k]) => k !== 'priority' || staff).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <Button variant="outline" size="sm" onClick={() => setMore((m) => !m)} aria-expanded={more}><SlidersHorizontal className="h-4 w-4" />Filters<ChevronDown className={`h-4 w-4 transition ${more ? 'rotate-180' : ''}`} /></Button>
        </div>
        {more && (
          <div className="grid gap-3 rounded-xl bg-navy-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-semibold text-navy-600">Category<Select className="mt-1" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></label>
            <label className="text-xs font-semibold text-navy-600">Submitted from<input type="date" className="input mt-1" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-xs font-semibold text-navy-600">Submitted to<input type="date" className="input mt-1" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
            {departments.length > 0 ? <label className="text-xs font-semibold text-navy-600">Department<Select className="mt-1" value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">All</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></label> : null}
            <label className="text-xs font-semibold text-navy-600">Per page<Select className="mt-1" value={size} onChange={(e) => setSize(Number(e.target.value))}>{[8, 15, 30, 50].map((n) => <option key={n}>{n}</option>)}</Select></label>
            {!staff && <label className="flex items-end gap-2 pb-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-[#2754D1]" checked={attention} onChange={(e) => setAttention(e.target.checked)} />Needs my attention</label>}
            {filtered && <div className="flex items-end"><Button variant="ghost" size="sm" onClick={clear}>Clear all filters</Button></div>}
          </div>)}
      </div>
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.items.length ? (
        <EmptyState icon={FolderOpen} title={filtered ? 'No applications match these filters' : 'No applications yet'} text={filtered ? 'Try clearing the search or filters.' : 'Applications will appear here.'} action={filtered ? <Button variant="outline" onClick={clear}>Clear filters</Button> : emptyAction} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-navy-50/70 text-xs font-semibold text-navy-500"><tr>
              <th className="px-5 py-3">Application</th><th className="px-3 py-3">Category</th>{showCitizen && <th className="px-3 py-3">Citizen</th>}{showOfficer && <th className="px-3 py-3">Officer</th>}{staff && <th className="px-3 py-3">Priority</th>}<th className="px-3 py-3">Status</th><th className="px-5 py-3">Submitted</th>
            </tr></thead>
            <tbody className="divide-y divide-navy-50">
              {data.items.map((a) => (
                <tr key={a.id} className="hover:bg-navy-50/50">
                  <td className="px-5 py-3.5"><Link href={hrefFor(a)} className="font-semibold text-navy-900 hover:text-brand-700">{a.subject}</Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-navy-500">{a.applicationId}{a.isDemo && <DemoBadge />}{a.language === 'hi' && <Badge tone="sky">Hindi</Badge>}{a.matchedInDocument && <Badge tone="violet">found in document</Badge>}
                      {a.needsAttention && <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{a.attentionReason}</span>}</div></td>
                  <td className="px-3 py-3.5 text-navy-700">{a.category}</td>
                  {showCitizen && <td className="px-3 py-3.5 text-navy-700">{a.citizenName}</td>}
                  {showOfficer && <td className="px-3 py-3.5 text-navy-700">{a.officerName || <span className="text-navy-400">Unassigned</span>}</td>}
                  {staff && <td className="px-3 py-3.5">{a.priority?.level && a.priority.level !== 'none' ? <div title={a.priority.reasons.join('. ')}><Badge tone={PRIO[a.priority.level][0]}>{PRIO[a.priority.level][1]}</Badge><p className="mt-1 max-w-[11rem] text-xs text-navy-500">{a.priority.reasons[0]}</p></div> : <span className="text-navy-400">-</span>}</td>}
                  <td className="px-3 py-3.5"><div className="flex flex-col items-start gap-1"><StatusBadge status={a.status} /><DeadlineBadge d={a.deadline} /></div></td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-navy-600">{fmtDate(a.createdAt)}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
    </Card>
  );
}
