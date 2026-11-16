// Sandbox browser harness: bundles the real pages/components with esbuild (stand-ins for next/*, framer-motion, lucide-react, recharts),
// compiles the real Tailwind config with the Tailwind v4 compiler, and writes /tmp/rti-e2e/{bundle.js,styles.css,index.html}.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = process.cwd(); const OUT = process.env.E2E_OUT || '/tmp/rti-e2e'; const TOOLS = process.env.E2E_TOOLS || '/opt/npm-tools/node_modules';
const require = createRequire(`${TOOLS}/`); const esbuild = require('esbuild'); const { compile } = require('tailwindcss');
fs.mkdirSync(OUT, { recursive: true });
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

// 1. route table from the app/ directory (pages + nested layouts; api and root layout excluded)
const appDir = path.join(ROOT, 'app'); const pages = walk(appDir).filter((f) => f.endsWith('/page.js') && !f.includes(`${path.sep}api${path.sep}`));
let imports = ''; let rows = ''; let i = 0;
for (const f of pages) {
  const rel = path.relative(appDir, path.dirname(f)).split(path.sep).filter(Boolean); const layouts = [];
  for (let n = 0; n <= rel.length; n++) { const l = path.join(appDir, ...rel.slice(0, n), 'layout.js'); if (n > 0 && fs.existsSync(l)) layouts.push(l); }
  imports += `import P${i} from '${f}';\n`; const ls = layouts.map((l, k) => { imports += `import L${i}_${k} from '${l}';\n`; return `L${i}_${k}`; });
  rows += `  { pattern: ${JSON.stringify(rel)}, Page: P${i}, layouts: [${ls.join(', ')}] },\n`; i++;
}
fs.writeFileSync(path.join(ROOT, 'tests/e2e/routes.gen.js'), `${imports}export default [\n${rows}];\n`);

// 2. stand-ins that need explicit named exports
const src = walk(ROOT).filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.includes('node_modules') && !f.includes('/tests/') && !f.includes('/.next/'));
const text = src.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const named = (pkg) => [...new Set([...text.matchAll(new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${pkg}['"]`, 'g'))].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)))];
const stubDir = path.join(OUT, 'stubs'); fs.mkdirSync(stubDir, { recursive: true });
fs.writeFileSync(path.join(stubDir, 'lucide.js'), `import React from 'react';\nconst I = (name) => (p) => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'data-icon': name, 'aria-hidden': p['aria-label'] ? undefined : true, className: p.className }, React.createElement('rect', { x: 4, y: 4, width: 16, height: 16, rx: 4 }));\n${named('lucide-react').map((n) => `export const ${n} = I('${n}');`).join('\n')}\n`);
fs.writeFileSync(path.join(stubDir, 'recharts.js'), `import React from 'react';\nconst B = (n) => ({ children, data }) => React.createElement('div', { 'data-chart': n, 'data-points': Array.isArray(data) ? data.length : undefined, className: 'flex h-full items-center justify-center rounded-lg bg-navy-50 text-xs text-navy-400' }, n);\nconst P = () => null;\n${named('recharts').map((n) => (/Chart$/.test(n) ? `export const ${n} = B('${n}');` : n === 'ResponsiveContainer' ? `export const ${n} = ({ children }) => React.createElement('div', { style: { width: '100%', height: '100%' } }, children);` : `export const ${n} = P;`)).join('\n')}\n`);

// 3. bundle
fs.writeFileSync(path.join(OUT, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: ROOT, paths: { '@/*': ['./*'] } } }));
await esbuild.build({ entryPoints: [path.join(ROOT, 'tests/e2e/entry.jsx')], bundle: true, outfile: path.join(OUT, 'bundle.js'), format: 'iife', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, tsconfig: path.join(OUT, 'tsconfig.json'), nodePaths: [TOOLS], logLevel: 'error',
  define: { 'process.env.NODE_ENV': '"development"' },
  alias: { 'framer-motion': path.join(ROOT, 'tests/e2e/stubs/framer-motion.js'), 'lucide-react': path.join(stubDir, 'lucide.js'), recharts: path.join(stubDir, 'recharts.js'), 'next/link': path.join(ROOT, 'tests/e2e/stubs/next-link.js'), 'next/navigation': path.join(ROOT, 'tests/e2e/stubs/next-navigation.js') } });

// 4. CSS: the real globals.css + tailwind.config.js compiled with the Tailwind v4 compiler (legacy @config)
let css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8').replace(/@import url\([^)]*\);/, '').replace(/@tailwind base;\s*@tailwind components;\s*@tailwind utilities;/, '@import "tailwindcss";\n@config "./tailwind.config.js";');
const loadStylesheet = async (id, base) => { const p = id === 'tailwindcss' ? `${TOOLS}/tailwindcss/index.css` : id.startsWith('tailwindcss/') ? `${TOOLS}/${id}${id.endsWith('.css') ? '' : '.css'}` : path.resolve(base, id); return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') }; };
const loadModule = async (id, base) => { const p = path.resolve(base, id); return { path: p, base: path.dirname(p), module: (await import(pathToFileURL(p).href)).default }; };
const compiler = await compile(css, { base: ROOT, loadStylesheet, loadModule });
const candidates = [...new Set(text.match(/[^\s"'`<>={}()|;,]+/g) || [])];
fs.writeFileSync(path.join(OUT, 'styles.css'), compiler.build(candidates));
fs.writeFileSync(path.join(OUT, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTI Assist</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
console.log(`built: ${pages.length} pages, bundle ${(fs.statSync(path.join(OUT, 'bundle.js')).size / 1024).toFixed(0)} KB, css ${(fs.statSync(path.join(OUT, 'styles.css')).size / 1024).toFixed(0)} KB`);
