import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { subscribe, snapshot, state } from './stubs/navstore.js';
import { Providers } from '@/components/Session';
import AssistantWidget from '@/components/AssistantWidget';
import NotFound from '@/app/not-found.js';
import ROUTES from './routes.gen.js';

function match(path) {
  const segs = path.split('/').filter(Boolean);
  for (const r of ROUTES) {
    if (r.pattern.length !== segs.length) continue; const params = {};
    if (r.pattern.every((p, i) => (p.startsWith('[') ? ((params[p.slice(1, -1)] = decodeURIComponent(segs[i])), true) : p === segs[i]))) return { r, params };
  }
  return null;
}
function App() {
  useSyncExternalStore(subscribe, snapshot);
  const m = match(state.path); state.params = m?.params || {};
  const body = m ? m.r.layouts.reduceRight((child, L) => <L>{child}</L>, <m.r.Page />) : <NotFound />;
  return <Providers><a href="#main" className="skip-link">Skip to main content</a>{body}<AssistantWidget /></Providers>;
}
createRoot(document.getElementById('root')).render(<App />);
