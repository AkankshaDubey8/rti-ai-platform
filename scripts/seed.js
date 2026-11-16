// Usage: npm run seed            (seeds an empty database)
//        npm run seed -- --reset (wipes ALL collections first, then seeds)
// Uses MongoDB when MONGODB_URI is set, otherwise writes the local demo store (data/demo-db.json).
import fs from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const { isMongo } = await import('../lib/env.js');
const store = isMongo() ? (await import('../lib/store/mongo.js')).default : (await import('../lib/store/memory.js')).default;
const { seedDemo } = await import('../lib/seedData.js');
const { hashPassword } = await import('../lib/password.js');

await store.connect();
if (process.argv.includes('--reset')) { await store.clearAll(); console.log('Existing data removed.'); }
else if ((await store.count('users')) > 0) { console.log('The database already has data. Run "npm run seed -- --reset" to wipe it and reseed.'); process.exit(0); }
const { password } = await seedDemo(store, { hash: hashPassword, log: (m) => console.log(' -', m) });
console.log(`\nSeeded DEMO DATA into ${store.kind}. Demo password for all demo accounts: ${password}`);
console.log('Accounts: admin@rti-demo.test, officer.education@rti-demo.test, citizen1@rti-demo.test (see README for the full list)');
process.exit(0);
