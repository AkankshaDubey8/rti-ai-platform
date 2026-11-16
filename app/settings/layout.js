import AppShell from "@/components/AppShell";
export default function Layout({ children }) { return <AppShell allowed={["citizen", "officer", "admin"]}>{children}</AppShell>; }
