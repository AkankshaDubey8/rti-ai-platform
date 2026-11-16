// Stand-in for framer-motion used only by the sandbox browser harness (no animations; keeps layout and behaviour).
import React from 'react';
const STRIP = new Set(['initial', 'animate', 'exit', 'transition', 'layout', 'variants', 'whileHover', 'whileTap', 'whileInView', 'viewport', 'drag']);
const cache = new Map();
const make = (tag) => React.forwardRef(({ children, animate, style, ...p }, ref) => {
  const props = Object.fromEntries(Object.entries(p).filter(([k]) => !STRIP.has(k)));
  const extra = animate && typeof animate === 'object' ? Object.fromEntries(Object.entries(animate).filter(([k]) => ['width', 'height', 'opacity'].includes(k))) : {};
  return React.createElement(tag, { ...props, style: { ...style, ...extra }, ref }, children);
});
export const motion = new Proxy({}, { get: (_, tag) => { if (!cache.has(tag)) cache.set(tag, make(tag)); return cache.get(tag); } });
export const AnimatePresence = ({ children }) => React.createElement(React.Fragment, null, children);
export const MotionConfig = ({ children }) => React.createElement(React.Fragment, null, children);
export const animate = (from, to, o = {}) => { o.onUpdate?.(to); return { stop() {} }; };
