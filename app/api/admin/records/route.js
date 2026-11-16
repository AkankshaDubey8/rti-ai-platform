import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { listRecords, saveRecord } from "@/services/admin";

export const GET = route(async ({ req }) => {
  const p = new URL(req.url).searchParams;
  return json({ items: await listRecords(await getStore(), { search: p.get("search") || "", category: p.get("category") || "" }) });
}, { roles: ["admin"] });
export const POST = route(async ({ req, user }) => json({ record: await saveRecord(await getStore(), user, await body(req)) }, 201), { roles: ["admin"] });
