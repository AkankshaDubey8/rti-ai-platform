import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hashPassword } from "@/lib/password";
import { resetPassword } from "@/services/account";

export const POST = route(async ({ req }) => { const b = await body(req); await resetPassword(await getStore(), b.token, b.password, hashPassword); return json({ ok: true }); }, { rate: { name: "reset", max: 10, windowMs: 15 * 60_000 } });
