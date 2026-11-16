import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { setUserActive } from "@/services/admin";

export const PATCH = route(async ({ req, user, params }) => json({ user: await setUserActive(await getStore(), user, params.id, (await body(req)).active) }), { roles: ["admin"] });
