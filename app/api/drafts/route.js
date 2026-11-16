import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { listDrafts, saveDraft } from "@/services/drafts";

export const GET = route(async ({ user }) => json({ items: await listDrafts(await getStore(), user) }), { roles: ["citizen"] });
export const POST = route(async ({ req, user }) => { const d = await saveDraft(await getStore(), user, await body(req)); return json({ draft: { id: d.id, updatedAt: d.updatedAt } }, 201); }, { roles: ["citizen"], rate: { name: "drafts", max: 60, windowMs: 60_000 } });
