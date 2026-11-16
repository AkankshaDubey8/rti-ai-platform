import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { deleteRecord, saveRecord } from "@/services/admin";

export const PUT = route(async ({ req, user, params }) => json({ record: await saveRecord(await getStore(), user, await body(req), params.id) }), { roles: ["admin"] });
export const DELETE = route(async ({ user, params }) => { await deleteRecord(await getStore(), user, params.id); return json({ ok: true }); }, { roles: ["admin"] });
