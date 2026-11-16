import Link from 'next/link';
import { Scale } from 'lucide-react';

export function Logo({ light, href = '/' }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="RTI Assist home">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? 'bg-white/10 text-white' : 'bg-brand-600 text-white'}`}><Scale className="h-5 w-5" aria-hidden /></span>
      <span className={`text-xl font-semibold ${light ? 'text-white' : 'text-navy-900'}`}>RTI Assist</span>
    </Link>
  );
}

export const Disclaimer = ({ className = '' }) => (
  <p className={`text-xs leading-5 text-navy-500 ${className}`}>RTI Assist is an independent academic project. It is not an official government portal and is not affiliated with any government department. Demo records are fictional.</p>
);
