import { cookies } from "next/headers";

import { requireAllowedUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { IntegrationAlertBanner } from "@/components/integration-alert-banner";
import { NAV_COLLAPSED_COOKIE } from "@/lib/nav-preference";

/**
 * Every real dashboard route lives under this route group. This is where the
 * actual "is this person allowed in" check happens -- see requireAllowedUser
 * for why that's here and not in proxy.ts.
 *
 * The shell is a two-rail layout: the primary nav down the left edge, then a
 * content column. Sections that need to pick something from a list before
 * showing anything -- /agents -- add their own second rail inside that column
 * (see agents/layout.tsx and components/section-sidebar.tsx).
 *
 * Scrolling stays on the window rather than an inner container, so both rails
 * can be `sticky top-0 h-dvh` and stay exactly viewport-height without anyone
 * hardcoding a header offset.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, cookieStore] = await Promise.all([
    requireAllowedUser(),
    cookies(),
  ]);

  // Read here rather than in the rail itself so the very first paint is already
  // the right width -- the rail is a client component, but this is not state it
  // can know before hydration.
  const navCollapsed = cookieStore.get(NAV_COLLAPSED_COOKIE)?.value === "1";

  return (
    <div className="flex min-h-dvh">
      <AppSidebar userEmail={user.email} defaultCollapsed={navCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <IntegrationAlertBanner />
        {children}
      </div>
    </div>
  );
}
