"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import AnalysisPanel from "@/components/AnalysisPanel";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";

export default function CitizenAnalysis() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/api/applications/${id}`);
  if (loading && !data) return <Skeleton className="h-80 w-full" />;
  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  const a = data.application;
  return (
    <>
      <Link href={`/citizen/applications/${a.applicationId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" />Back to application</Link>
      <PageHeader title="AI analysis" subtitle={`${a.subject} (${a.applicationId})`} />
      <div className="max-w-3xl"><AnalysisPanel analysis={a.aiAnalysis} staff={false} /></div>
    </>
  );
}
