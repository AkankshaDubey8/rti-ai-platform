import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { clearSearchHistory } from "@/services/account";

export const DELETE = route(async ({ user }) => { await clearSearchHistory(await getStore(), user); return json({ ok: true }); }, { roles: ["citizen", "officer", "admin"] });
