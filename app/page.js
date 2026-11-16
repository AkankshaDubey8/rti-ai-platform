"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, ChevronDown, FileSearch, FileText, Gavel, Languages, Route, ShieldCheck, UserCheck, UserRound, Quote } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import AnimatedNumber from "@/components/AnimatedNumber";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { useSession } from "@/components/Session";
import { useApi } from "@/hooks/useApi";

const STEPS = [
  { who: "You", icon: UserRound, text: "File the request and attach supporting documents.", ai: false },
  { who: "AI", icon: Bot, text: "Reads it, suggests a category and department, and finds similar past records.", ai: true },
  { who: "AI", icon: FileText, text: "Drafts a reply from those records and lists what it could not find.", ai: true },
  { who: "Officer", icon: UserCheck, text: "Checks every line against a quality checklist, edits, then approves or rejects.", ai: false },
  { who: "Officer", icon: Gavel, text: "Issues the response. Nothing goes out before this step.", ai: false },
];
const FEATURES = [
  [Route, "Every step is visible", "Track status, deadlines and who handled your request. Get a notification each time it changes."],
  [FileSearch, "Drafts show their sources", "Officers see which similar records a draft came from, how close they are, and what has no support."],
  [ShieldCheck, "Officers stay in charge", "Only an authorised officer can approve, reject or issue a response. Every action is audit-logged."],
  [Languages, "English and Hindi", "Use the interface in Hindi, write your request in Hindi, and see a clearly-labelled English translation next to it."],
];
const TESTIMONIALS = [
  ["I could see exactly where my request was and what was still pending.", "Fictional citizen"],
  ["The checklist stopped me from approving a draft that still had a gap. That is how it should work.", "Fictional officer"],
  ["The numbers page lets us see how long departments really take.", "Fictional journalist"],
];

function Faq({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-surface">
      {items.map((f) => (
        <div key={f.id}>
          <button type="button" className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold" aria-expanded={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)}>{f.title}<ChevronDown className={`h-5 w-5 shrink-0 transition ${open === f.id ? "rotate-180" : ""}`} aria-hidden /></button>
          {open === f.id && <p className="px-5 pb-5 text-[15px] leading-7 text-navy-700">{f.text}</p>}
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const { t } = useSession();
  const { data: stats } = useApi("/api/public/stats");
  const { data: help } = useApi("/api/help");
  const faqs = (help?.items || []).filter((e) => e.type === "faq").slice(0, 6);
  const tt = stats?.totals; const demoOnly = stats && stats.sources.platform === 0;
  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(58,107,232,.45),transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <Badge tone="sky" className="mb-5">Independent academic project</Badge>
            <h1 className="text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">{t("landing.title")}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-brand-100">{t("landing.sub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register" size="lg" className="!bg-white !text-ink hover:!bg-brand-50">{t("landing.cta")}</ButtonLink>
              <ButtonLink href="/transparency" variant="outline" size="lg" className="!border-white/25 !bg-transparent !text-white hover:!bg-white/10">{t("nav.transparency")}</ButtonLink>
            </div>
            <p className="mt-6 max-w-lg text-sm text-brand-100">Not an official portal and not affiliated with any government. All sample records are fictional.</p>
          </div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-3xl bg-surface p-6 text-navy-900 shadow-2xl sm:p-7" aria-label="How one request moves">
            <p className="text-xl font-semibold">{t("landing.how")}</p>
            <ol className="mt-5 space-y-3.5">
              {STEPS.map((s, i) => (
                <li key={i} className="flex gap-3.5">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.ai ? "border-2 border-dashed border-brand-400 bg-brand-50 text-brand-700" : "bg-brand-600 text-white"}`}><s.icon className="h-[18px] w-[18px]" aria-hidden /></span>
                  <div><p className="text-sm font-semibold">{s.who}{s.ai ? " suggests" : s.who === "You" ? "" : " decides"}</p><p className="text-sm leading-6 text-navy-600">{s.text}</p></div>
                </li>))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-4 border-t border-navy-100 pt-4 text-xs text-navy-500">
              <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded border-2 border-dashed border-brand-400 bg-brand-50" aria-hidden />AI suggestion</span>
              <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-brand-600" aria-hidden />Human action</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14" aria-labelledby="stats-h">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="stats-h" className="text-3xl font-semibold">{t("landing.stats")}</h2>
          {stats && <Badge tone="amber">{demoOnly ? "DEMO DATA: fictional demonstration records" : `Includes ${stats.sources.demo} fictional demo records`}</Badge>}</div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[["Requests submitted", tt?.submitted, ""], ["Responses issued", tt?.resolved, ""], ["Average days to respond", tt?.averageProcessingDays, ""], ["Resolution rate", tt?.resolutionRate, "%"]].map(([l, v, suf]) => (
            <Card key={l} className="p-5"><p className="text-sm text-navy-500">{l}</p><p className="mt-1 text-4xl font-semibold">{v === undefined ? "…" : v === null ? "n/a" : <AnimatedNumber value={v} decimals={suf || l.startsWith("Average") ? 1 : 0} suffix={suf} />}</p></Card>))}
        </div>
        <p className="mt-3 text-xs text-navy-500">Computed live from this platform. Not statistics of any government. <Link href="/transparency" className="font-semibold text-brand-700 hover:underline">See the full transparency dashboard</Link>.</p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14" aria-labelledby="feat-h">
        <h2 id="feat-h" className="max-w-2xl text-3xl font-semibold">{t("landing.features")}</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([Icon, title, text]) => <Card key={title} className="p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" aria-hidden /></span><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-[15px] leading-7 text-navy-600">{text}</p></Card>)}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-14" aria-labelledby="faq-h">
        <div className="mb-5 flex items-end justify-between"><h2 id="faq-h" className="text-3xl font-semibold">{t("landing.faq")}</h2><Link href="/help" className="text-sm font-semibold text-brand-700 hover:underline">All help topics</Link></div>
        {faqs.length ? <Faq items={faqs} /> : <Card className="p-6 text-sm text-navy-500">Loading…</Card>}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14" aria-labelledby="quote-h">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="quote-h" className="text-3xl font-semibold">{t("landing.testimonials")}</h2><Badge tone="amber">Fictional demo content</Badge></div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">{TESTIMONIALS.map(([q, who]) => <Card key={q} className="p-6"><Quote className="h-5 w-5 text-brand-400" aria-hidden /><p className="mt-3 text-[15px] leading-7">{q}</p><p className="mt-4 text-sm font-semibold text-navy-500">{who}</p></Card>)}</div>
      </section>

      <section className="px-5 pb-16"><div className="mx-auto max-w-6xl rounded-3xl bg-ink px-8 py-12 text-center text-white">
        <h2 className="text-3xl font-semibold">{t("landing.ctaTitle")}</h2><p className="mx-auto mt-3 max-w-xl text-brand-100">{t("landing.ctaText")}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3"><ButtonLink href="/register" size="lg" className="!bg-white !text-ink hover:!bg-brand-50">{t("common.register")}</ButtonLink><ButtonLink href="/login" size="lg" variant="outline" className="!border-white/25 !bg-transparent !text-white hover:!bg-white/10">{t("common.signIn")}</ButtonLink></div>
      </div></section>
    </PublicShell>
  );
}
