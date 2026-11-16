import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { citizenStats, officerStats } from "@/services/applications";
import { adminStats } from "@/services/admin";

// Every number is derived from stored data at request time (nothing is hardcoded).
export const GET = route(async ({ user }) => {
  const store = await getStore();
  if (user.role === "citizen") return json(await citizenStats(store, user));
  if (user.role === "officer") return json(await officerStats(store, user));
  return json(await adminStats(store));
}, { roles: ["citizen", "officer", "admin"] });
