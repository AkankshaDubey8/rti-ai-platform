import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { setTicketStatus } from "@/services/account";

export const PATCH = route(async ({ req, user, params }) => json({ ticket: await setTicketStatus(await getStore(), user, params.id, (await body(req)).status) }), { roles: ["admin"] });
