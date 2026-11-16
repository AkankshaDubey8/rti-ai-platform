import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";

export const GET = route(async ({ user }) => {
  const store = await getStore();
  const items = await store.find("notifications", { recipient: user.id }, { limit: 30 });
  const unread = await store.count("notifications", { recipient: user.id, read: false });
  const ids = [...new Set(items.map((n) => n.application).filter(Boolean))];
  const links = {};
  for (const id of ids) { const a = await store.get("applications", id); if (a) links[id] = a.applicationId; }
  return json({ unread, items: items.map((n) => ({ id: n.id, message: n.message, type: n.type, read: n.read, createdAt: n.createdAt, applicationId: links[n.application] || null })) });
}, { roles: ["citizen", "officer", "admin"] });

export const PATCH = route(async ({ req, user }) => {
  const store = await getStore(); const b = await body(req);
  const mine = await store.find("notifications", { recipient: user.id, read: false });
  for (const n of mine) if (b.all || n.id === b.id) await store.update("notifications", n.id, { read: true });
  return json({ ok: true });
}, { roles: ["citizen", "officer", "admin"] });
