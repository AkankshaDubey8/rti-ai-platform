import { route } from "@/lib/api";
import { getStore } from "@/lib/store";
import { receiptPdf } from "@/services/documents";

export const GET = route(async ({ user, params }) => {
  const doc = await receiptPdf(await getStore(), user, params.id);
  return new Response(doc.buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${doc.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}, { roles: ["citizen", "officer", "admin"] });
