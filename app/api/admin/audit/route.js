import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { listAudit } from "@/services/admin";

export const GET = route(async ({ req }) => {
  const p = new URL(req.url).searchParams;
  return json(await listAudit(await getStore(), { page: p.get("page"), action: p.get("action") || "", q: p.get("q") || "" }));
}, { roles: ["admin"] });
