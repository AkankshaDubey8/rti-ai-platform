import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { deleteDepartment, saveDepartment } from "@/services/admin";

export const PUT = route(async ({ req, user, params }) => json({ department: await saveDepartment(await getStore(), user, await body(req), params.id) }), { roles: ["admin"] });
export const DELETE = route(async ({ user, params }) => { await deleteDepartment(await getStore(), user, params.id); return json({ ok: true }); }, { roles: ["admin"] });
