import { route, json } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { getStore } from "@/lib/store";
import { publicStats, publicStatsCsv } from "@/services/public";

// Public, anonymous, aggregated. ?from=YYYY-MM-DD&to=&department=&category=&source=all|demo|platform&format=csv
export const GET = route(async ({ req }) => {
  const p = new URL(req.url).searchParams; const source = ["all", "demo", "platform"].includes(p.get("source")) ? p.get("source") : "all";
  const stats = await publicStats(await getStore(), { from: p.get("from") || "", to: p.get("to") || "", department: p.get("department") || "", category: p.get("category") || "", source });
  return p.get("format") === "csv" ? csvResponse("rti-assist-transparency.csv", publicStatsCsv(stats)) : json(stats);
}, { rate: { name: "pubstats", max: 60, windowMs: 60_000 } });
