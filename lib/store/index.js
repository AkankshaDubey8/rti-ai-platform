import { isMongo } from '../env.js';

// Returns the active store (MongoDB when MONGODB_URI is set, otherwise the JSON-file demo store).
// In demo mode an empty database is seeded with clearly-labelled synthetic DEMO DATA on first use.
export async function getStore() {
  if (!globalThis.__rtiStorePromise) {
    globalThis.__rtiStorePromise = (async () => {
      const store = isMongo() ? (await import('./mongo.js')).default : (await import('./memory.js')).default;
      await store.connect();
      if (store.kind === 'demo' && (await store.count('users')) === 0) {
        const { seedDemo } = await import('../seedData.js');
        const { hashPassword } = await import('../password.js');
        await seedDemo(store, { hash: hashPassword });
      }
      return store;
    })().catch((e) => { globalThis.__rtiStorePromise = null; throw e; });
  }
  return globalThis.__rtiStorePromise;
}
