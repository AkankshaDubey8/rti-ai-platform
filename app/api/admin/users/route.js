import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hashPassword } from "@/lib/password";
import { createOfficer, listUsers } from "@/services/admin";

export const GET = route(async ({ req }) => {
  const p = new URL(req.url).searchParams;
  return json({ items: await listUsers(await getStore(), { role: p.get("role") || undefined, search: p.get("search") || "" }) });
}, { roles: ["admin"] });

export const POST = route(async ({ req, user }) => json({ user: await createOfficer(await getStore(), user, await body(req), hashPassword) }, 201), { roles: ["admin"] });
