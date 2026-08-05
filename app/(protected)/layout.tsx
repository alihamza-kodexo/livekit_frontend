import { requireAllowedUser } from "@/lib/auth";
import { IntegrationAlertBanner } from "@/components/integration-alert-banner";
import { Nav } from "@/components/nav";

/**
 * Every real dashboard route lives under this route group. This is where the
 * actual "is this person allowed in" check happens -- see requireAllowedUser
 * for why that's here and not in proxy.ts.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAllowedUser();

  return (
    <>
      <Nav userEmail={user.email} />
      <IntegrationAlertBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-8">{children}</main>
    </>
  );
}
