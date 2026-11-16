import { route, json, body, invalid } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validateLogin } from "@/lib/validation";
import { signSession, sessionCookie, publicUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { clearFailures, isLocked, recordFailure } from "@/lib/rateLimit";

let dummyHash;
export const POST = route(async ({ req }) => {
  const v = validateLogin(await body(req));
  if (!v.ok) throw invalid(v.errors);
  const lock = isLocked(`login:${v.value.email}`);
  if (lock.locked) throw new HttpError(429, `Too many failed sign-in attempts for this account. Try again in ${Math.ceil(lock.retryAfter / 60)} minutes.`);
  const store = await getStore();
  const user = await store.findOne("users", { email: v.value.email });
  dummyHash ||= await hashPassword("not-a-real-password"); // keeps timing similar for unknown emails
  const ok = await verifyPassword(v.value.password, user?.passwordHash || dummyHash);
  if (!user || !ok) { recordFailure(`login:${v.value.email}`); throw new HttpError(401, "Email or password is incorrect."); }
  clearFailures(`login:${v.value.email}`);
  if (!user.active) throw new HttpError(403, "This account has been deactivated. Contact an administrator.");
  const res = json({ user: publicUser(user) });
  res.cookies.set(sessionCookie(await signSession(user)));
  return res;
}, { rate: { name: "login", max: 30, windowMs: 60_000 } });
