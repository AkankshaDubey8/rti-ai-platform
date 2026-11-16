import { route, json } from "@/lib/api";
import { kb } from "@/lib/kb";
import { searchHelp } from "@/services/account";

// Public: searchable FAQs, guides and glossary (built-in knowledge base).
export const GET = route(async ({ req }) => {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  const items = q ? searchHelp(q) : kb().entries;
  return json({ items, note: kb().note });
});
