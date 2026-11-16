import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { analyzeDraftRequest } from "@/services/assist";

export const POST = route(async ({ req, user }) => json({ analysis: await analyzeDraftRequest(await getStore(), user, await body(req)) }), { roles: ["citizen"], rate: { name: "assist", max: 20, windowMs: 60_000 } });
