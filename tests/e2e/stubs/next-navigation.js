import { useSyncExternalStore } from 'react';
import { navigate, snapshot, state, subscribe } from './navstore.js';
const useLoc = () => useSyncExternalStore(subscribe, snapshot);
export const useRouter = () => ({ push: (t) => navigate(t), replace: (t) => navigate(t, true), back: () => history.back(), refresh: () => {} });
export const usePathname = () => { useLoc(); return state.path; };
export const useParams = () => { useLoc(); return state.params; };
export const useSearchParams = () => { useLoc(); return new URLSearchParams(state.search); };
