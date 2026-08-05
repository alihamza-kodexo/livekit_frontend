import Link from "next/link";

import { HealthBadge } from "@/components/health-badge";
import { checkAllIntegrations, isActiveError } from "@/lib/health";

/**
 * Shows at the top of every dashboard page, but only renders anything when an
 * integration that IS configured is actually broken (wrong key, quota,
 * unreachable). "Not configured yet" is expected during setup and deliberately
 * silent here -- see the /integrations page for the full picture including that.
 */
export async function IntegrationAlertBanner() {
  let checks: Awaited<ReturnType<typeof checkAllIntegrations>>;
  try {
    checks = await checkAllIntegrations();
  } catch {
    // The health check itself failing shouldn't take down every page in the
    // dashboard -- just skip the banner for this request.
    return null;
  }

  const broken = checks.filter((c) => isActiveError(c.status));
  if (broken.length === 0) return null;

  return (
    <div className="border-b border-red-300 bg-red-50 px-6 py-3 dark:border-red-900/60 dark:bg-red-950/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-red-900 dark:text-red-200">
          {broken.length} integration{broken.length === 1 ? "" : "s"} configured but not working:
        </span>
        {broken.map((check) => (
          <span key={check.name} className="inline-flex items-center gap-1.5 text-sm">
            <span className="text-red-900 dark:text-red-200">{check.name}</span>
            <HealthBadge status={check.status} />
          </span>
        ))}
        <Link
          href="/integrations"
          className="ml-auto text-sm font-medium text-red-900 underline hover:no-underline dark:text-red-200"
        >
          View details
        </Link>
      </div>
    </div>
  );
}
