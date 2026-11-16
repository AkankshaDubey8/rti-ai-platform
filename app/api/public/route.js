import { json, route } from "@/lib/api";
import { appMode } from "@/lib/env";
import { getStore } from "@/lib/store";
import { getSettings } from "@/services/common";

export const GET = route(async () => {
  const s = await getSettings(await getStore());
  return json({ mode: appMode(), platformName: s.platformName, announcement: s.announcement, allowRegistrations: s.allowRegistrations, supportEmail: process.env.SUPPORT_EMAIL || null });
});
