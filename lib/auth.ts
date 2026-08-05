import "server-only";

import { redirect } from "next/navigation";

import { db } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
};

/** Null if there's no session, or the session's JWT has no email on it. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

/**
 * The allowlist gate: Supabase Auth will happily authenticate any email that
 * asks for a magic link, so this table is the actual access control. Checked
 * with the service-role client -- `allowed_users` intentionally has no
 * anon/authenticated grant (see the 0003 migration), so there's no other way
 * to read it from app code.
 */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const { data, error } = await db()
    .from("allowed_users")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`isEmailAllowed: ${error.message}`);
  return data !== null;
}

/**
 * The one real authorization check in the app -- call this from
 * `app/(protected)/layout.tsx`, not from `proxy.ts`. Proxy only refreshes the
 * session cookie and does an optimistic "is there a session at all" redirect;
 * it deliberately doesn't touch the database (Next's own guidance is to keep
 * proxy/middleware fast and push real authorization into the route/layout).
 *
 * Signs the user out and redirects if they're authenticated but not
 * allow-listed, rather than just redirecting -- otherwise they'd land right
 * back here on their next request with the same still-valid session.
 */
export async function requireAllowedUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!(await isEmailAllowed(user.email))) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  return user;
}
