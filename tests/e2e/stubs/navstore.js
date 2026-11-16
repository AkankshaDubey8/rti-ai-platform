// Tiny client router state shared by the next/navigation and next/link stand-ins.
const listeners = new Set();
export const state = { path: location.pathname, search: location.search, params: {} };
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const snapshot = () => state.path + state.search;
export function navigate(to, replace) { const u = new URL(to, location.href); (replace ? history.replaceState : history.pushState).call(history, {}, '', u.pathname + u.search + u.hash); sync(); }
export function sync() { state.path = location.pathname; state.search = location.search; listeners.forEach((l) => l()); }
window.addEventListener('popstate', sync);
