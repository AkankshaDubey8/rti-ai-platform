import AppShell from "@/components/AppShell";
export default function Layout({ children }) { return <AppShell allowed={["admin"]}>{children}</AppShell>; }
