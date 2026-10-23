"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { destroyOtherSessions, destroySession, requireUser } from "@/lib/auth";
import { one, run } from "@/lib/db";
import { fail, hasErrors, INVALID, succeed, text } from "@/lib/forms";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";

const DEMO_LOCKED = "This is a demo sandbox — create a free account to change this.";

export async function updateProfile(_prev, formData) {
  const user = await requireUser();
  if (user.isDemo) return fail(DEMO_LOCKED);

  const errors = {};
  const name = text(formData, "name", 100);
  const university = text(formData, "university", 100);
  if (name.length < 2 || name.length > 60) errors.name = "Between 2 and 60 characters.";
  if (university.length > 80) errors.university = "Keep it under 80 characters.";
  if (hasErrors(errors)) return fail(INVALID, errors);

  run("UPDATE users SET name = ?, university = ? WHERE id = ?", name, university, user.id);
  revalidatePath("/", "layout");
  return succeed("Profile saved.");
}

export async function changePassword(_prev, formData) {
  const user = await requireUser();
  if (user.isDemo) return fail(DEMO_LOCKED);

  const current = String(formData.get("current") ?? "").slice(0, 200);
  const next = String(formData.get("next") ?? "").slice(0, 200);

  const errors = {};
  const { hash } = one("SELECT password_hash AS hash FROM users WHERE id = ?", user.id);
  if (!(await verifyPassword(current, hash))) errors.current = "That isn't your current password.";
  const problem = passwordProblem(next, { email: user.email, name: user.name });
  if (problem) errors.next = problem;
  else if (next === current) errors.next = "Choose something different from the old one.";
  if (hasErrors(errors)) return fail(INVALID, errors);

  run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(next), user.id);
  // A password change is usually a reaction to "someone else might be in";
  // ending every other session is what makes it actually lock them out.
  const ended = await destroyOtherSessions(user.id);
  return succeed(
    ended > 0
      ? `Password changed. ${ended} other device${ended === 1 ? " was" : "s were"} signed out.`
      : "Password changed.",
  );
}

export async function signOutEverywhere() {
  const user = await requireUser();
  const ended = await destroyOtherSessions(user.id);
  revalidatePath("/settings");
  return succeed(ended > 0 ? `Signed out of ${ended} other device${ended === 1 ? "" : "s"}.` : "No other devices were signed in.");
}

export async function deleteAccount(_prev, formData) {
  const user = await requireUser();

  if (text(formData, "confirm", 50) !== "DELETE") {
    return fail(INVALID, { confirm: 'Type DELETE in capitals to confirm.' });
  }
  if (!user.isDemo) {
    const { hash } = one("SELECT password_hash AS hash FROM users WHERE id = ?", user.id);
    if (!(await verifyPassword(String(formData.get("password") ?? "").slice(0, 200), hash))) {
      return fail(INVALID, { password: "Wrong password." });
    }
  }

  // ON DELETE CASCADE takes every transaction, limit, goal and session with it.
  await destroySession();
  run("DELETE FROM users WHERE id = ?", user.id);
  redirect("/?deleted=1");
}

/**
 * The theme lives in a cookie rather than localStorage so the *server* knows it
 * and stamps `data-theme` on <html> while rendering — no flash of the wrong
 * theme on first paint.
 */
export async function setTheme(theme) {
  (await cookies()).set("sbp-theme", theme === "dark" ? "dark" : "light", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
