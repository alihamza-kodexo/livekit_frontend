import { requireAllowedUser } from "@/lib/auth";
import { CursorGrid } from "@/components/cursor-grid";
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
      {/* Fixed, full-viewport, and behind everything (-z-10) -- it only ever
          shows through the plain zinc-50/zinc-900 body background around real
          content. pointer-events-none so it never intercepts a click even at
          the very edges; it tracks the cursor via a window-level listener
          internally regardless. Positioned via this wrapper rather than
          CursorGrid's own className, since its CSS hard-sets position:
          relative on that element. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <CursorGrid
          color="#323232"
          cellSize={155}
          radius={230}
          falloff="smooth"
          holdTime={400}
          fadeDuration={800}
          lineWidth={1.2}
          maxOpacity={1}
          fillOpacity={0}
          gridOpacity={0}
          cellRadius={0}
          clickPulse={false}
          pulseSpeed={600}
          targetFps={24}
        />
      </div>
      <Nav userEmail={user.email} />
      <IntegrationAlertBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-8">{children}</main>
    </>
  );
}
