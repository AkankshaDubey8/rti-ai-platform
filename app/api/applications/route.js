import { route, json, invalid } from "@/lib/api";
import { getStore } from "@/lib/store";
import { validateApplication, MAX_FILE_BYTES } from "@/lib/validation";
import { HttpError } from "@/lib/errors";
import { listApplications, submitApplication, getApplication } from "@/services/applications";
import { deleteDraft } from "@/services/drafts";

export const GET = route(async ({ req, user }) => {
  const p = new URL(req.url).searchParams;
  const store = await getStore();
  return json(await listApplications(store, user, { search: p.get("search") || "", status: p.get("status") || "", category: p.get("category") || "", department: p.get("department") || "", from: p.get("from") || "", to: p.get("to") || "", sort: p.get("sort") || "newest", attention: p.get("attention") || "", page: p.get("page"), pageSize: p.get("pageSize") }));
}, { roles: ["citizen", "officer", "admin"] });

export const POST = route(async ({ req, user }) => {
  const form = await req.formData().catch(() => { throw new HttpError(400, "Send the application as multipart form data."); });
  const v = validateApplication({ subject: form.get("subject"), description: form.get("description"), referenceInfo: form.get("referenceInfo"), department: form.get("department"), applicant: form.get("applicant"), translation: form.get("translation") });
  if (!v.ok) throw invalid(v.errors);
  const incoming = form.getAll("documents").filter((f) => typeof f !== "string" && f.size);
  if (incoming.length > 5) throw invalid({ documents: "Attach at most 5 files." });
  const files = [];
  for (const f of incoming) {
    files.push({ name: f.name, type: f.type, size: f.size, bytes: f.size > MAX_FILE_BYTES ? Buffer.alloc(0) : Buffer.from(await f.arrayBuffer()) });
  }
  const store = await getStore();
  const app = await submitApplication(store, user, v.value, files);
  const draftId = form.get("draftId"); if (draftId) { try { await deleteDraft(store, user, String(draftId)); } catch { /* draft already gone */ } }
  return json({ application: await getApplication(store, user, app.applicationId) }, 201);
}, { roles: ["citizen"], rate: { name: "submit", max: 10, windowMs: 60_000 } });
