// Test-only module loader: resolves the "@/" alias and substitutes tiny offline stand-ins for packages
// that cannot be installed in a sandbox. Real packages are used whenever they are installed (jose, bcryptjs).
// "next/server" is always stood in for, because route handlers are executed outside the Next.js runtime.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shim = (f) => pathToFileURL(path.join(root, 'tests', 'helpers', 'shims', f)).href;
const SHIMS = { 'next/server': 'next-server.mjs' };
const OPTIONAL = { jose: 'jose.mjs', bcryptjs: 'bcryptjs.mjs', nodemailer: 'nodemailer.mjs' };

export async function resolve(specifier, context, nextResolve) {
  if (SHIMS[specifier]) return { url: shim(SHIMS[specifier]), shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const base = path.join(root, specifier.slice(2));
    for (const c of [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return { url: pathToFileURL(c).href, shortCircuit: true };
    }
  }
  if (OPTIONAL[specifier]) {
    try { return await nextResolve(specifier, context); } catch { return { url: shim(OPTIONAL[specifier]), shortCircuit: true }; }
  }
  return nextResolve(specifier, context);
}
