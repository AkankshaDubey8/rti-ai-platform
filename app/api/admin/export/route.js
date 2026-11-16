import { route } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { getStore } from "@/lib/store";
import { exportCsv } from "@/services/admin";

export const GET = route(async ({ req, user }) => { const type = new URL(req.url).searchParams.get("type") || ""; return csvResponse(`rti-assist-${type}.csv`, await exportCsv(await getStore(), user, type)); }, { roles: ["admin"], rate: { name: "export", max: 20, windowMs: 60_000 } });
