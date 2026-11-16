import { route, json, body, invalid } from "@/lib/api";
import { getStore } from "@/lib/store";
import { publicUser, sessionCookie, signSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validatePassword, validateProfile } from "@/lib/validation";
import { HttpError } from "@/lib/errors";
import { audit } from "@/services/common";

export const GET = route(async ({ user }) => {
  const store = await getStore();
  const dept = user.department ? await store.get("departments", user.department) : null;
  return json({ user: { ...user, departmentName: dept?.name || null } });
}, { roles: ["citizen", "officer", "admin"] });

// PATCH { name, phone }  or  { currentPassword, newPassword }
export const PATCH = route(async ({ req, user }) => {
  const store = await getStore(); const b = await body(req);
  if (b.newPassword !== undefined) {
    const err = validatePassword(b.newPassword);
    if (err) throw invalid({ newPassword: err });
    const row = await store.get("users", user.id);
    if (!(await verifyPassword(String(b.currentPassword || ""), row.passwordHash))) throw invalid({ currentPassword: "Current password is incorrect." });
    const updated = await store.update("users", user.id, { passwordHash: await hashPassword(b.newPassword), tokenVersion: (row.tokenVersion || 0) + 1 });
    await audit(store, user, "password.changed", "user", user.id);
    const res = json({ ok: true, otherSessionsSignedOut: true });
    res.cookies.set(sessionCookie(await signSession(updated))); // keep this browser signed in; all older tokens are now invalid
    return res;
  }
  const v = validateProfile(b);
  if (!v.ok) throw invalid(v.errors);
  return json({ user: publicUser(await store.update("users", user.id, v.value)) });
}, { roles: ["citizen", "officer", "admin"], rate: { name: "profile", max: 20, windowMs: 60_000 } });
