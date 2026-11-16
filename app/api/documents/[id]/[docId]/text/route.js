import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { extractDocument, openDocument } from "@/services/documents";

export const GET = route(async ({ user, params }) => {
  const { doc } = await openDocument(await getStore(), user, params.id, params.docId);
  return json({ extracted: doc.extracted || null });
}, { roles: ["citizen", "officer", "admin"] });
export const POST = route(async ({ user, params }) => json({ extracted: await extractDocument(await getStore(), user, params.id, params.docId, { force: true }) }), { roles: ["citizen", "officer", "admin"], rate: { name: "extract", max: 10, windowMs: 60_000 } });
