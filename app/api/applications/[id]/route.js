import { route, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { getApplication } from "@/services/applications";
import { touchRecent } from "@/services/account";

export const GET = route(async ({ user, params }) => {
  const store = await getStore(); const application = await getApplication(store, user, params.id);
  await touchRecent(store, user, application.applicationId).catch(() => {}); // recently viewed (never blocks the page)
  return json({ application });
}, { roles: ["citizen", "officer", "admin"] });
