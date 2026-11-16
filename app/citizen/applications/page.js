"use client";
import { FilePlus2 } from "lucide-react";
import ApplicationTable from "@/components/ApplicationTable";
import { ButtonLink, PageHeader } from "@/components/ui";
import { useSession } from "@/components/Session";

export default function MyApplications() {
  const { t } = useSession();
  return (
    <>
      <PageHeader title={t("nav.myApplications")} subtitle="Search, filter and sort everything you have filed, including text found inside your attached documents." actions={<ButtonLink href="/citizen/apply"><FilePlus2 className="h-4 w-4" />{t("nav.newRequest")}</ButtonLink>} />
      <ApplicationTable hrefFor={(a) => `/citizen/applications/${a.applicationId}`} emptyAction={<ButtonLink href="/citizen/apply">File a request</ButtonLink>} />
    </>
  );
}
