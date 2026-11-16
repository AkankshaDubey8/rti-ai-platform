import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { listDepartments } from "@/services/admin";

export const GET = route(async () => {
  const depts = await listDepartments(await getStore(), { activeOnly: true });
  return json({ items: depts.map((d) => ({ id: d.id, name: d.name, description: d.description, categories: d.categories })) });
}, { roles: ["citizen", "officer", "admin"] });
