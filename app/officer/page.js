"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, CheckCheck, ClipboardList, Flame, Hourglass, ListChecks, SearchCheck } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/components/Session";
import ApplicationTable from "@/components/ApplicationTable";
import { DonutCard } from "@/components/Charts";
import { PageHeader, StatCard } from "@/components/ui";

export default function OfficerDashboard() {
  const { user } = useSession(); const router = useRouter();
  useEffect(() => { if (user?.role === "admin") router.replace("/admin"); }, [user, router]);
  const { data, loading } = useApi(user?.role === "officer" ? "/api/stats" : null);
  if (user?.role !== "officer") return null;
  return (
    <>
      <PageHeader title="My review queue" subtitle="Ranked by explainable priority rules: overdue, nearly due, life or liberty keywords, drafts waiting for approval. Hover a priority to see why." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total assigned" value={data?.total} icon={ClipboardList} loading={loading} />
        <StatCard label="Pending" value={data?.pending} icon={Hourglass} tone="amber" loading={loading} />
        <StatCard label="Under review" value={data?.underReview} icon={SearchCheck} tone="teal" loading={loading} />
        <StatCard label="Awaiting approval" value={data?.awaitingApproval} icon={ListChecks} tone="rose" loading={loading} />
        <StatCard label="Completed" value={data?.completed} icon={CheckCheck} tone="green" loading={loading} />
        <StatCard label="Overdue" value={data?.overdue} icon={AlarmClock} tone="rose" loading={loading} />
        <StatCard label="High priority" value={data?.highPriority} icon={Flame} tone="rose" loading={loading} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ApplicationTable title="Assigned applications" staff defaultSort="priority" showCitizen hrefFor={(a) => `/officer/applications/${a.applicationId}`} />
        <DonutCard title="By category" subtitle="Your assigned applications" data={data?.byCategory || []} />
      </div>
    </>
  );
}
