'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button, Modal } from './ui';

const Ctx = createContext(async () => true);
// const confirm = useConfirm(); if (await confirm({ title, text, confirmLabel, danger: true })) { ... }
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); const resolver = useRef(null);
  const confirm = useCallback((opts) => new Promise((resolve) => { resolver.current = resolve; setState(opts); }), []);
  const done = (v) => { resolver.current?.(v); resolver.current = null; setState(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal open={Boolean(state)} onClose={() => done(false)} title={state?.title || 'Are you sure?'}
        footer={<><Button variant="outline" onClick={() => done(false)}>{state?.cancelLabel || 'Cancel'}</Button><Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => done(true)}>{state?.confirmLabel || 'Confirm'}</Button></>}>
        <p className="text-sm leading-6 text-navy-700">{state?.text}</p>
      </Modal>
    </Ctx.Provider>
  );
}
