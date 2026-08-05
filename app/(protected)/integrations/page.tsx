import { HealthBadge } from "@/components/health-badge";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { checkAllIntegrations, isActiveError } from "@/lib/health";

export default async function IntegrationsPage() {
  const checks = await checkAllIntegrations();
  const broken = checks.filter((c) => isActiveError(c.status)).length;
  const notConfigured = checks.filter((c) => c.status === "not_configured").length;
  const ok = checks.filter((c) => c.status === "ok").length;

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Live status for every external service the dashboard and worker depend on."
      />

      <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          <span className="font-medium text-green-700 dark:text-green-400">{ok}</span> working
        </span>
        <span>
          <span className="font-medium text-red-700 dark:text-red-400">{broken}</span> broken
        </span>
        <span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{notConfigured}</span> not
          configured
        </span>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Integration</Th>
              <Th>Used for</Th>
              <Th>Status</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.name}>
                <Td className="font-medium text-zinc-900 dark:text-zinc-100">{check.name}</Td>
                <Td className="text-zinc-500 dark:text-zinc-400">{check.usedFor}</Td>
                <Td>
                  <HealthBadge status={check.status} />
                </Td>
                <Td className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                  {check.message}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Checks run fresh on every page load -- a passing check means the key was
        accepted at that moment, not that the service will stay reachable. Slack
        is configuration-only (a live test would post a real message to the
        channel every time this page loads).
      </p>
    </>
  );
}
