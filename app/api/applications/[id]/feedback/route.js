import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { submitFeedback } from "@/services/account";

export const POST = route(async ({ req, user, params }) => { const f = await submitFeedback(await getStore(), user, params.id, await body(req)); return json({ feedback: { rating: f.rating, comment: f.comment } }); }, { roles: ["citizen"], rate: { name: "feedback", max: 20, windowMs: 60_000 } });
