"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, EmptyState, ErrorState, Pagination, SkeletonRows } from "./ui";

// Client-side searchable table. columns: [{ header, render(row), text?(row) }]
export default function DataTable({ columns, rows, loading, error, onRetry, searchPlaceholder = "Search", toolbar, empty, pageSize = 10 }) {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((r) => !s || columns.some((c) => String(c.text ? c.text(r) : "").toLowerCase().includes(s)));
  }, [rows, q, columns]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); const p = Math.min(page, totalPages);
  const slice = filtered.slice((p - 1) * pageSize, p * pageSize);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-navy-100 p-4">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
          <input className="input pl-9" placeholder={searchPlaceholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label={searchPlaceholder} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div>
      </div>
      {loading && !rows ? <SkeletonRows /> : error ? <ErrorState error={error} onRetry={onRetry} /> : !slice.length ? (empty || <EmptyState title="Nothing to show" text={q ? "No rows match your search." : undefined} />) : (
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-navy-50/70 text-xs font-semibold text-navy-500"><tr>{columns.map((c) => <th key={c.header} className="px-4 py-3">{c.header}</th>)}</tr></thead>
          <tbody className="divide-y divide-navy-50">{slice.map((r) => <tr key={r.id} className="align-top hover:bg-navy-50/50">{columns.map((c) => <td key={c.header} className="px-4 py-3.5">{c.render(r)}</td>)}</tr>)}</tbody>
        </table></div>
      )}
      <Pagination page={p} totalPages={totalPages} total={filtered.length} onPage={setPage} />
    </Card>
  );
}
