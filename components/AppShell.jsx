'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BookOpen, Building2, Inbox as InboxIcon, BarChart3, ClipboardList, FilePlus2, FolderClock, History, LayoutDashboard, LogOut, Menu, Settings, SlidersHorizontal, Users, X, Database, Inbox } from 'lucide-react';
import { useSession } from './Session';
import GlobalSearch from './GlobalSearch';
import PrefsMenu from './PrefsMenu';
import { Logo } from './Logo';
import { Badge, cn } from './ui';
import { api, fmtDate, HOME } from '@/lib/client';
import { useApi } from '@/hooks/useApi';

const NAV = {
  citizen: [['/citizen', 'nav.dashboard', LayoutDashboard], ['/citizen/apply', 'nav.newRequest', FilePlus2], ['/citizen/applications', 'nav.myApplications', FolderClock], ['/help', 'nav.help', BookOpen], ['/settings', 'nav.settings', Settings]],
  officer: [['/officer', 'nav.queue', ClipboardList], ['/help', 'nav.help', BookOpen], ['/settings', 'nav.settings', Settings]],
  admin: [['/admin', 'nav.overview', LayoutDashboard], ['/admin/applications', 'nav.applications', FolderClock], ['/admin/users', 'nav.people', Users], ['/admin/departments', 'nav.departments', Building2],
    ['/admin/records', 'nav.records', Database], ['/admin/inbox', 'nav.inbox', InboxIcon], ['/admin/audit', 'nav.audit', History], ['/admin/platform', 'nav.platform', SlidersHorizontal], ['/transparency', 'nav.transparency', BarChart3], ['/settings', 'nav.settings', Settings]],
};

function NotificationBell({ user }) {
  const { data, reload } = useApi('/api/notifications');
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setInterval(reload, 30000); return () => clearInterval(t); }, [reload]);
  const markAll = async () => { await api('/api/notifications', { method: 'PATCH', body: { all: true } }); reload(); };
  const unread = data?.unread || 0;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-xl p-2.5 text-navy-600 hover:bg-navy-100" aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-navy-100 bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3"><span className="font-semibold">Notifications</span>{unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-brand-700 hover:underline">Mark all read</button>}</div>
              <div className="max-h-80 overflow-y-auto">
                {!data?.items?.length && <div className="flex flex-col items-center px-4 py-8 text-sm text-navy-500"><Inbox className="mb-2 h-6 w-6 text-navy-300" />Nothing new yet.</div>}
                {data?.items?.map((n) => (
                  <Link key={n.id} href={n.applicationId ? `${user.role === 'citizen' ? '/citizen' : '/officer'}/applications/${n.applicationId}` : '#'} onClick={() => setOpen(false)} className={cn('block border-b border-navy-50 px-4 py-3 text-sm hover:bg-navy-50', !n.read && 'bg-brand-50/60')}>
                    <p className="text-navy-800">{n.message}</p>
                    <p className="mt-1 text-xs text-navy-400">{fmtDate(n.createdAt, true)}</p>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppShell({ allowed, children }) {
  const { user, pub, loading, logout, t } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (allowed && !allowed.includes(user.role)) router.replace(HOME[user.role]);
  }, [loading, user, allowed, router, pathname]);

  if (loading || !user || (allowed && !allowed.includes(user.role))) {
    return <div className="grid min-h-screen place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-navy-200 border-t-brand-600" role="status" aria-label="Loading" /></div>;
  }
  const items = NAV[user.role];
  const active = (href) => (href === HOME[user.role] ? pathname === href : pathname.startsWith(href));
  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
      {items.map(([href, key, Icon]) => (
        <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
          className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', active(href) ? 'bg-white/10 text-white' : 'text-brand-100 hover:bg-white/5 hover:text-white')}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />{t(key)}
        </Link>
      ))}
    </nav>
  );
  const side = (
    <div className="flex h-full flex-col bg-ink">
      <div className="px-5 pt-5"><Logo light href={HOME[user.role]} /></div>
      {nav}
      <div className="m-3 rounded-xl bg-white/5 p-3 text-xs leading-5 text-brand-100">AI only suggests. Authorised officers review, edit, approve and issue every response.</div>
    </div>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 lg:block">{side}</aside>
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-navy-950/50" onClick={() => setDrawer(false)} aria-hidden />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'tween', duration: 0.2 }} className="absolute inset-y-0 left-0 w-64">
              {side}<button className="absolute right-3 top-4 rounded-lg p-1.5 text-white/80 hover:bg-white/10" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-navy-100 bg-surface/90 px-4 py-2.5 backdrop-blur sm:px-8">
        <button className="rounded-xl p-2.5 text-navy-700 hover:bg-navy-100 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <div className="mx-2 hidden flex-1 items-center gap-3 md:flex"><GlobalSearch />{pub?.mode === 'demo' && <Badge tone="amber" className="hidden xl:inline-flex">Demo mode</Badge>}</div>
        <div className="ml-auto flex items-center gap-1.5">
          <PrefsMenu />
          <NotificationBell user={user} />
          <div className="ml-1 hidden text-right sm:block"><p className="text-sm font-semibold leading-tight">{user.name}</p><p className="text-xs capitalize text-navy-500">{user.role}</p></div>
          <button onClick={logout} className="ml-1 rounded-xl p-2.5 text-navy-600 hover:bg-navy-100" aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>
      {pub?.announcement && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 sm:px-8">{pub.announcement}</div>}
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
