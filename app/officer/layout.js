import AppShell from "@/components/AppShell";
export default function Layout({ children }) { return <AppShell allowed={["officer", "admin"]}>{children}</AppShell>; }
