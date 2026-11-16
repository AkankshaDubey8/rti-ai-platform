import { route, json, body } from "@/lib/api";
import { translateText } from "@/services/assist";

export const POST = route(async ({ req }) => json({ translation: await translateText((await body(req)).text) }), { roles: ["citizen"], rate: { name: "translate", max: 15, windowMs: 60_000 } });
