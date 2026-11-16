'use client';
import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

// Counts up to `value`. Shows the final number immediately when the user prefers reduced motion.
export default function AnimatedNumber({ value, decimals = 0, suffix = '' }) {
  const [shown, setShown] = useState(typeof value === 'number' ? 0 : value); const from = useRef(0);
  useEffect(() => {
    if (typeof value !== 'number') { setShown(value); return undefined; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return undefined; }
    const c = animate(from.current, value, { duration: 0.9, ease: 'easeOut', onUpdate: (v) => { from.current = v; setShown(v); } });
    return () => c.stop();
  }, [value]);
  return <>{typeof shown === 'number' ? shown.toFixed(decimals) : shown}{typeof shown === 'number' ? suffix : ''}</>;
}
