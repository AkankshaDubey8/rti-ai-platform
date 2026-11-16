import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { chat, suggestedQuestions } from "@/services/assist";

export const GET = route(async () => json({ suggestions: suggestedQuestions() }), { optionalAuth: true });
export const POST = route(async ({ req, user }) => json(await chat(await getStore(), user, await body(req))), { optionalAuth: true, rate: { name: "assistant", max: 30, windowMs: 60_000 } });
