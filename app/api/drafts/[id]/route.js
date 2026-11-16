import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { deleteDraft, getDraft } from "@/services/drafts";

export const GET = route(async ({ user, params }) => json({ draft: await getDraft(await getStore(), user, params.id) }), { roles: ["citizen"] });
export const DELETE = route(async ({ user, params }) => { await deleteDraft(await getStore(), user, params.id); return json({ ok: true }); }, { roles: ["citizen"] });
