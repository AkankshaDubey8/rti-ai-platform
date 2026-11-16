import { route, json, body } from "@/lib/api";
import { getStore } from "@/lib/store";
import { performAction } from "@/services/applications";

// POST { action: "start_review" | "save_draft" | "mark_ready" | "approve" | "reject_draft" | "issue" | "reject_application" | "close" | "override_department" | "reanalyze" | "regenerate_draft" | "reassign" | "run_pipeline", ...payload }
export const POST = route(async ({ req, user, params }) => {
  const { action, ...payload } = await body(req);
  return json({ application: await performAction(await getStore(), user, params.id, String(action), payload) });
}, { roles: ["officer", "admin"], rate: { name: "actions", max: 60, windowMs: 60_000 } });
