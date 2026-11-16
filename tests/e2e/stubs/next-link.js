import React from 'react';
import { navigate } from './navstore.js';
export default function Link({ href, children, onClick, replace, prefetch, ...rest }) {
  return React.createElement('a', { href, ...rest, onClick: (e) => { onClick?.(e); if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || rest.target === '_blank' || /^https?:|^mailto:|^#/.test(href)) return; e.preventDefault(); navigate(href); } }, children);
}
