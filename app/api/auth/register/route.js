import { route, json, body, invalid } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hashPassword } from "@/lib/password";
import { validateRegister } from "@/lib/validation";
import { signSession, sessionCookie, publicUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { getSettings } from "@/services/common";
import { audit } from "@/services/common";

export const POST = route(async ({ req }) => {
  const store = await getStore();
  if (!(await getSettings(store)).allowRegistrations) throw new HttpError(403, "New registrations are currently closed.");
  const v = validateRegister(await body(req));
  if (!v.ok) throw invalid(v.errors);
  let user;
  try {
    user = await store.insert("users", { name: v.value.name, email: v.value.email, passwordHash: await hashPassword(v.value.password), role: "citizen", active: true, department: null, phone: "", isDemo: false });
  } catch (e) {
    if (e.code === "DUPLICATE") throw new HttpError(409, "An account with this email already exists.", { email: "Already registered. Try signing in." });
    throw e;
  }
  await audit(store, { id: user.id, name: user.name, role: "citizen" }, "citizen.registered", "user", user.id);
  const res = json({ user: publicUser(user) }, 201);
  res.cookies.set(sessionCookie(await signSession(user)));
  return res;
}, { rate: { name: "register", max: 10, windowMs: 60_000 } });
