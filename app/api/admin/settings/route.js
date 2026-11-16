import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { getSettings } from "@/services/common";
import { updateSettings } from "@/services/admin";

export const GET = route(async () => json({ settings: await getSettings(await getStore()) }), { roles: ["admin"] });
export const PUT = route(async ({ req, user }) => json({ settings: await updateSettings(await getStore(), user, await body(req)) }), { roles: ["admin"] });
