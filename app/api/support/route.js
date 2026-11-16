import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { createTicket } from "@/services/account";

export const POST = route(async ({ req, user }) => { const t = await createTicket(await getStore(), user, await body(req)); return json({ ok: true, ticketId: t.id }, 201); }, { optionalAuth: true, rate: { name: "support", max: 5, windowMs: 10 * 60_000 } });
