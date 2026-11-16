import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { requestPasswordReset } from "@/services/account";

export const POST = route(async ({ req }) => json(await requestPasswordReset(await getStore(), (await body(req)).email)), { rate: { name: "forgot", max: 5, windowMs: 15 * 60_000 } });
