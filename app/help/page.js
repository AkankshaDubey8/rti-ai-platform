"use client";
import { useEffect, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { Badge, Card, EmptyState, ErrorState, SkeletonRows } from "@/components/ui";
import { useApi, useDebounced } from "@/hooks/useApi";
import { useSession } from "@/components/Session";

const TYPES = [["all", "All"], ["faq", "FAQs"], ["guide", "Guides"], ["glossary", "Glossary"]];

export default function Help() {
  const { t } = useSession();
  const [q, setQ] = useState(""); const [type, setType] = useState("all"); const dq = useDebounced(q, 250);
  const { data, error, loading, reload } = useApi(`/api/help?q=${encodeURIComponent(dq)}`);
  useEffect(() => { if (data && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [data]);
  const items = (data?.items || []).filter((e) => type === "all" || e.type === type);
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-4xl font-semibold">{t("help.title")}</h1>
        <p className="mt-2 text-navy-600">Plain-language answers about the RTI process and about this platform. {data?.note}</p>
        <div className="relative mt-6"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden /><input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search FAQs, guides and terms" aria-label="Search help" /></div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by type">{TYPES.map(([k, l]) => <button key={k} onClick={() => setType(k)} aria-pressed={type === k} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${type === k ? "border-brand-600 bg-brand-600 text-white" : "border-navy-200 text-navy-700 hover:bg-navy-100"}`}>{l}</button>)}</div>
        <div className="mt-6 space-y-4">
          {loading && !data ? <Card><SkeletonRows rows={4} /></Card> : error ? <Card><ErrorState error={error} onRetry={reload} /></Card> : !items.length ? <Card><EmptyState icon={BookOpen} title="No matching topics" text="Try different words, or ask the assistant (bottom-right) or use the contact page." /></Card> : items.map((e) => (
            <Card key={e.id} id={e.id} className="scroll-mt-24 p-6">
              <div className="flex items-center gap-2"><Badge tone={e.type === "faq" ? "sky" : e.type === "guide" ? "green" : "slate"}>{e.type}</Badge></div>
              <h2 className="mt-2 text-xl font-semibold">{e.title}</h2>
              <p className="mt-2 text-[15px] leading-7 text-navy-700">{e.text}</p>
              {e.steps && <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-navy-700">{e.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
            </Card>))}
        </div>
        <p className="mt-8 text-xs text-navy-500">General educational information, not legal advice. Fees, forms and time limits differ between authorities: confirm with the public authority concerned.</p>
      </div>
    </PublicShell>
  );
}
