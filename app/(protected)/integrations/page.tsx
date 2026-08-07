import { CredentialsForm } from "@/app/(protected)/integrations/credentials-form";
import { HealthBadge } from "@/components/health-badge";
import {
  Card,
  Code,
  CollapsibleCard,
  PageBody,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { checkAllIntegrations, isActiveError } from "@/lib/health";
import {
  MANAGED_SECRETS,
  SECRET_GROUPS,
  secretStatuses,
  type SecretStatus,
} from "@/lib/secrets";

export default async function IntegrationsPage() {
  const checks = await checkAllIntegrations();

  // Masked previews only -- `secretStatuses` never returns a usable secret, so
  // nothing here can leak one into the client payload.
  const statuses: Record<string, SecretStatus> = Object.fromEntries(
    secretStatuses().map((status) => [status.name, status]),
  );
  const broken = checks.filter((c) => isActiveError(c.status)).length;
  const notConfigured = checks.filter((c) => c.status === "not_configured").length;
  const ok = checks.filter((c) => c.status === "ok").length;

  const tallies = [
    { count: ok, label: "working", tone: "text-success-text" },
    { count: broken, label: "broken", tone: "text-error-text" },
    { count: notConfigured, label: "not configured", tone: "text-muted" },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Integrations"
        description="Live status for every external service the dashboard and worker depend on."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {tallies.map((tally) => (
          <div
            key={tally.label}
            className="rounded-lg border border-line bg-surface px-4 py-3.5 shadow-sm"
          >
            <p className={`font-display text-2xl leading-none ${tally.tone}`}>
              {tally.count}
            </p>
            <p className="mono-kicker mt-2">{tally.label}</p>
          </div>
        ))}
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
                <Td className="font-medium text-strong">{check.name}</Td>
                <Td className="text-muted">{check.usedFor}</Td>
                <Td>
                  <HealthBadge status={check.status} />
                </Td>
                <Td className="max-w-md text-sm text-muted">{check.message}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <p className="max-w-3xl text-xs leading-relaxed text-faint">
        Checks run fresh on every page load -- a passing check means the key was
        accepted at that moment, not that the service will stay reachable. Slack
        is configuration-only (a live test would post a real message to the
        channel every time this page loads).
      </p>

      <div className="border-t border-line pt-6">
        <h2 className="font-heading text-base font-semibold text-strong">
          Credentials
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
          Saving here overrides the matching variable in{" "}
          <Code>dashboard/.env.local</Code> and takes effect on the next request
          — the health checks above re-run against the new value straight away.
          The agent worker reads its own environment, so a new provider key
          reaches live calls when that service restarts. Every change needs your
          dashboard password.
        </p>
      </div>

      {SECRET_GROUPS.map((group) => {
        const fields = MANAGED_SECRETS.filter((secret) => secret.group === group);
        const configured = fields.filter(
          (field) => statuses[field.name]?.source !== "unset",
        ).length;
        return (
          <CollapsibleCard
            key={group}
            title={group}
            description={`${configured} of ${fields.length} set — ${fields
              .map((field) => field.label)
              .join(", ")}`}
          >
            <CredentialsForm group={group} fields={fields} statuses={statuses} />
          </CollapsibleCard>
        );
      })}

      <p className="max-w-3xl text-xs leading-relaxed text-faint">
        Supabase&apos;s own <Code>SUPABASE_URL</Code>,{" "}
        <Code>SUPABASE_SERVICE_ROLE_KEY</Code> and <Code>SUPABASE_ANON_KEY</Code>{" "}
        aren&apos;t editable here on purpose: they&apos;re what it takes to read
        the table these overrides live in, so a wrong value would lock the
        dashboard out of its own database with no way back through the UI. Change
        those in <Code>dashboard/.env.local</Code> and restart.
      </p>
    </PageBody>
  );
}
