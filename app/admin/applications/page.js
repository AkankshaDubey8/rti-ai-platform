"use client";
import ApplicationTable from "@/components/ApplicationTable";
import { PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/useApi";

export default function AdminApplications() {
  const { data: depts } = useApi("/api/admin/departments");
  return (
    <>
      <PageHeader title="All applications" subtitle="Open an application to reassign it, re-route it or re-run the AI pipeline." />
      <ApplicationTable staff defaultSort="priority" departments={depts?.items || []} showCitizen showOfficer pageSize={10} hrefFor={(a) => `/officer/applications/${a.applicationId}`} />
    </>
  );
}
