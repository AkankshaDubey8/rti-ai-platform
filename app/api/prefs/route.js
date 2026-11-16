import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { getPrefs, savePrefs } from "@/services/account";

export const GET = route(async ({ user }) => json({ prefs: await getPrefs(await getStore(), user) }), { roles: ["citizen", "officer", "admin"] });
export const PUT = route(async ({ req, user }) => json({ prefs: await savePrefs(await getStore(), user, await body(req)) }), { roles: ["citizen", "officer", "admin"] });
