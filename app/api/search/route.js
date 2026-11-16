import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { globalSearch } from "@/services/account";

export const GET = route(async ({ req, user }) => json(await globalSearch(await getStore(), user, new URL(req.url).searchParams.get("q"))), { roles: ["citizen", "officer", "admin"], rate: { name: "search", max: 60, windowMs: 60_000 } });
