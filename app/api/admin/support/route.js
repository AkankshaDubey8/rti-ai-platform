import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { listTickets } from "@/services/account";
import { listFeedback, listOutbox } from "@/services/admin";

// Inbox for administrators: support tickets, citizen feedback and the email outbox.
export const GET = route(async () => { const s = await getStore(); return json({ tickets: await listTickets(s), feedback: await listFeedback(s), outbox: await listOutbox(s) }); }, { roles: ["admin"] });
