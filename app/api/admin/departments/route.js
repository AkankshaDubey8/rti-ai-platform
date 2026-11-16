import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { listDepartments, saveDepartment } from "@/services/admin";

export const GET = route(async () => json({ items: await listDepartments(await getStore(), { withCounts: true }) }), { roles: ["admin"] });
export const POST = route(async ({ req, user }) => json({ department: await saveDepartment(await getStore(), user, await body(req)) }, 201), { roles: ["admin"] });
