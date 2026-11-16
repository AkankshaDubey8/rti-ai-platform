"use client";
import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { useApi, useDebounced } from "@/hooks/useApi";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Pagination, Select, SkeletonRows } from "@/components/ui";
import { fmtDate } from "@/lib/client";

const GROUPS = ["draft.", "response.", "application.", "department.", "record.", "officer.", "user.", "settings.", "analysis.", "pipeline.", "citizen."];

export default function Audit() {
  const [q, setQ] = useState(""); const [action, setAction] = useState(""); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  useEffect(() => { setPage(1); }, [dq, action]);
  const { data, error, loading, reload } = useApi(`/api/admin/audit?page=${page}&action=${encodeURIComponent(action)}&q=${encodeURIComponent(dq)}`);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every officer and administrator action that changes data is recorded here." />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-navy-100 p-4">
          <input className="input max-w-xs" placeholder="Search person, action or ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" />
          <Select className="w-auto" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action"><option value="">All actions</option>{GROUPS.map((g) => <option key={g} value={g}>{g}*</option>)}</Select>
        </div>
        {loading && !data ? <SkeletonRows /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.items.length ? <EmptyState icon={ScrollText} title="No matching entries" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-navy-50/70 text-xs font-semibold text-navy-500"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Who</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Details</th></tr></thead>
            <tbody className="divide-y divide-navy-50">{data.items.map((r) => (
              <tr key={r.id} className="align-top"><td className="whitespace-nowrap px-4 py-3 text-navy-600">{fmtDate(r.createdAt, true)}</td><td className="px-4 py-3">{r.userName} <Badge tone="slate">{r.role}</Badge></td><td className="px-4 py-3 font-medium">{r.action}</td>
                <td className="px-4 py-3 text-xs text-navy-600">{r.entityType}<br />{r.entityId}</td><td className="max-w-xs px-4 py-3 text-xs text-navy-600">{Object.entries(r.metadata || {}).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("; ").slice(0, 160)}</td></tr>))}</tbody>
          </table></div>
        )}
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
