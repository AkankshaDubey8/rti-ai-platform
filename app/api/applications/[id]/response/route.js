import { route } from "@/lib/api";
import { getStore } from "@/lib/store";
import { responseDocument } from "@/services/applications";
import { responsePdf } from "@/services/documents";

// GET ?format=pdf for a PDF, otherwise a plain-text download.
export const GET = route(async ({ req, user, params }) => {
  const store = await getStore(); const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (new URL(req.url).searchParams.get("format") === "pdf") {
    const pdf = await responsePdf(store, user, params.id);
    return new Response(pdf.buffer, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdf.filename}"` } });
  }
  const doc = await responseDocument(store, user, params.id);
  return new Response(doc.text, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${doc.filename}"` } });
}, { roles: ["citizen", "officer", "admin"] });
