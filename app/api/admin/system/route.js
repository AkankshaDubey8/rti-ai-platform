import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { systemHealth } from "@/services/admin";

export const GET = route(async () => json(await systemHealth(await getStore())), { roles: ["admin"] });
