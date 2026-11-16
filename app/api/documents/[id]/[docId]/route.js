import { route } from "@/lib/api";
import { getStore } from "@/lib/store";
import { openDocument } from "@/services/documents";

// Authorised access only (owner, officer of the department, administrator). Never served from /public.
// ?inline=1 lets the in-app preview show PDFs and images; everything else is a download.
export const GET = route(async ({ req, user, params }) => {
  const { doc, bytes } = await openDocument(await getStore(), user, params.id, params.docId);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const name = doc.originalName.replace(/[^\w.\- ]/g, "_");
  return new Response(bytes, { headers: { "Content-Type": doc.mimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'" } });
}, { roles: ["citizen", "officer", "admin"] });
