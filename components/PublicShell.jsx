'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ButtonLink } from './ui';
import { Logo } from './Logo';
import PrefsMenu from './PrefsMenu';
import { useSession } from './Session';
import { HOME } from '@/lib/client';

// Header + footer for public pages (landing, help, contact, transparency).
export default function PublicShell({ children }) {
  const { user, t, pub } = useSession(); const [open, setOpen] = useState(false);
  const links = [['/transparency', t('nav.transparency')], ['/help', t('nav.help')], ['/contact', t('nav.contact')]];
  return (
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">{links.map(([h, l]) => <Link key={h} href={h} className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-100">{l}</Link>)}</nav>
          <div className="flex items-center gap-1.5">
            <PrefsMenu />
            <div className="hidden items-center gap-2 sm:flex">{user ? <ButtonLink href={HOME[user.role]} size="sm">{t('nav.dashboard')}</ButtonLink> : <><ButtonLink href="/login" variant="ghost" size="sm">{t('common.signIn')}</ButtonLink><ButtonLink href="/register" size="sm">{t('common.register')}</ButtonLink></>}</div>
            <button className="rounded-xl p-2.5 text-navy-700 hover:bg-navy-100 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {open && <nav className="border-t border-navy-100 px-5 py-3 md:hidden" aria-label="Mobile">{[...links, ...(user ? [[HOME[user.role], t('nav.dashboard')]] : [['/login', t('common.signIn')], ['/register', t('common.register')]])].map(([h, l]) => <Link key={h} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-navy-800 hover:bg-navy-100">{l}</Link>)}</nav>}
      </header>
      {pub?.announcement && <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center text-sm text-amber-900">{pub.announcement}</div>}
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="border-t border-navy-100 bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div><Logo /><p className="mt-3 max-w-sm text-sm leading-6 text-navy-600">{t('common.disclaimer')}</p></div>
          <div><p className="text-sm font-semibold">Explore</p><ul className="mt-3 space-y-2 text-sm text-navy-600">{[['/transparency', t('nav.transparency')], ['/help', t('nav.help')], ['/login', t('common.signIn')], ['/register', t('common.register')]].map(([h, l]) => <li key={h}><Link href={h} className="hover:text-brand-700 hover:underline">{l}</Link></li>)}</ul></div>
          <div><p className="text-sm font-semibold">{t('nav.contact')}</p><p className="mt-3 text-sm leading-6 text-navy-600">Questions or problems? Use the <Link href="/contact" className="font-semibold text-brand-700 hover:underline">contact form</Link>.{pub?.supportEmail ? <> You can also write to <a className="font-semibold text-brand-700 hover:underline" href={`mailto:${pub.supportEmail}`}>{pub.supportEmail}</a>.</> : null}</p><p className="mt-3 text-xs text-navy-500">For real RTI filings, use the channel your public authority provides.</p></div>
        </div>
      </footer>
    </div>
  );
}
