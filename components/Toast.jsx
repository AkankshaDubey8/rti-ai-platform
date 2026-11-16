'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const Ctx = createContext({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
  }, [dismiss]);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-navy-100 bg-surface p-3.5 shadow-lg" role={t.type === 'error' ? 'alert' : 'status'}>
              {t.type === 'error' ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />}
              <p className="flex-1 text-sm text-navy-800">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-navy-400 hover:text-navy-700" aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
