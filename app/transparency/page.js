"use client";
import { useState } from "react";
import { CalendarClock, CheckCheck, Download, FileStack, Gauge, Hourglass, Percent, Star, XCircle } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import AnimatedNumber from "@/components/AnimatedNumber";
import { BarCard, DonutCard, StackedBarCard, TrendCard } from "@/components/Charts";
import { Badge, Card, ErrorState, Select, Skeleton } from "@/components/ui";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/components/Session";

const SOURCES = [["all", "All records"], ["demo", "Demo data only"], ["platform", "Platform data only"]];
function Tile({ icon: Icon, label, value, suffix = "", decimals = 0, tone = "bg-brand-50 text-brand-700" }) {
  return <Card className="flex items-center gap-4 p-5"><span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" aria-hidden /></span><div><p className="text-sm text-navy-500">{label}</p><div className="text-3xl font-semibold leading-tight">{value === undefined ? <Skeleton className="mt-1 h-7 w-14" /> : value === null ? "n/a" : <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />}</div></div></Card>;
}

export default function Transparency() {
  const { t } = useSession();
  const [f, setF] = useState({ from: "", to: "", department: "", category: "", source: "all" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data: s, error, reload } = useApi(`/api/public/stats?${qs}`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const bad = f.from && f.to && f.from > f.to;
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-4xl font-semibold">{t("transp.title")}</h1>
        <p className="mt-2 max-w-3xl text-navy-600">Anonymous, aggregated figures about requests handled on this platform. No names, request text, personal details or documents are ever shown here.</p>
        <div role="note" className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><Badge tone="amber">Read this</Badge>{s?.notice || "These are statistics of this platform only, not of any government."}</div>

        <Card className="mt-6 p-5"><form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
          <label className="text-sm font-medium">From<input type="date" className="input mt-1.5" value={f.from} onChange={set("from")} max={f.to || undefined} /></label>
          <label className="text-sm font-medium">To<input type="date" className="input mt-1.5" value={f.to} onChange={set("to")} min={f.from || undefined} /></label>
          <label className="text-sm font-medium">Department<Select className="mt-1.5" value={f.department} onChange={set("department")}><option value="">All departments</option>{s?.filters.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></label>
          <label className="text-sm font-medium">Category<Select className="mt-1.5" value={f.category} onChange={set("category")}><option value="">All categories</option>{s?.filters.categories.map((c) => <option key={c}>{c}</option>)}</Select></label>
          <label className="text-sm font-medium">Data source<Select className="mt-1.5" value={f.source} onChange={set("source")}>{SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></label>
        </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-navy-500">{s && <><Badge tone="amber">{s.sources.demo} demo</Badge><Badge tone="sky">{s.sources.platform} platform</Badge><span>records in the selected period, department and category</span></>}{bad && <span role="alert" className="font-semibold text-rose-600">The start date is after the end date.</span>}</div>
            <div className="flex gap-2"><button type="button" onClick={() => setF({ from: "", to: "", department: "", category: "", source: "all" })} className="rounded-xl border border-navy-200 px-3.5 py-2 text-sm font-semibold hover:bg-navy-50">Reset filters</button>
              <a href={`/api/public/stats?${new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), format: "csv" })}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"><Download className="h-4 w-4" aria-hidden />Download CSV</a></div>
          </div>
        </Card>

        {error ? <Card className="mt-6"><ErrorState error={error} onRetry={reload} /></Card> : (<>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile icon={FileStack} label="Submitted" value={s?.totals.submitted} />
            <Tile icon={CheckCheck} label="Resolved" value={s?.totals.resolved} tone="bg-emerald-100 text-emerald-700" />
            <Tile icon={Hourglass} label="Pending" value={s?.totals.pending} tone="bg-amber-100 text-amber-700" />
            <Tile icon={XCircle} label="Rejected" value={s?.totals.rejected} tone="bg-rose-100 text-rose-700" />
            <Tile icon={Percent} label="Resolution rate" value={s?.totals.resolutionRate} suffix="%" decimals={1} />
            <Tile icon={CalendarClock} label="Average days to respond" value={s?.totals.averageProcessingDays} decimals={1} />
            <Tile icon={Star} label={`Average rating (${s?.satisfaction.responses ?? 0} responses)`} value={s?.satisfaction.average} decimals={1} tone="bg-violet-100 text-violet-700" />
            <Tile icon={Gauge} label="Departments with requests" value={s?.byDepartment.length} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <TrendCard title="Monthly trend" subtitle="Requests submitted and resolved per month" data={s?.byMonth || []} />
            <DonutCard title="Outcomes" subtitle="Share of requests by outcome" data={s ? [{ name: "Resolved", value: s.totals.resolved }, { name: "Pending", value: s.totals.pending }, { name: "Rejected", value: s.totals.rejected }] : []} />
            <StackedBarCard title="By department" subtitle="Resolved, pending and rejected" data={s?.byDepartment || []} />
            <BarCard title="Most requested categories" subtitle="Number of requests" data={s?.byCategory || []} horizontal />
          </div>
          <p className="mt-6 text-xs text-navy-500">Resolution rate = requests with an issued response divided by requests submitted in the selected period. Average days counts only requests that have a response. Small numbers can change a lot from one request.</p>
        </>)}
      </div>
    </PublicShell>
  );
}
