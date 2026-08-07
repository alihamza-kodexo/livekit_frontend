import Link from "next/link";

import { CallFilters } from "@/app/(protected)/calls/filters";
import {
  Badge,
  Card,
  ConfigNotice,
  Duration,
  EmptyState,
  Mono,
  OutcomeBadge,
  PageBody,
  PageHeader,
  Table,
  Td,
  Th,
  Timestamp,
} from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { listAgents, listCallLogs, type CallLogFilters } from "@/lib/queries";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/types";

const PAGE_LIMIT = 100;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CallsPage({
  searchParams,
}: PageProps<"/calls">) {
  if (!integrationStatus().supabase) {
    return (
      <PageBody>
        <PageHeader title="Call logs" />
        <ConfigNotice
          integration="Supabase"
          vars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      </PageBody>
    );
  }

  const params = await searchParams;
  const single = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };

  // Query-string values are user input; anything unrecognised is dropped rather
  // than passed through to the database.
  const outcome = single("outcome");
  const from = single("from");
  const to = single("to");
  const filters: CallLogFilters = {
    ...(single("agent") ? { agentId: single("agent") } : {}),
    ...(outcome && CALL_OUTCOMES.includes(outcome as CallOutcome)
      ? { outcome: outcome as CallOutcome }
      : {}),
    ...(from && ISO_DATE.test(from) ? { from } : {}),
    ...(to && ISO_DATE.test(to) ? { to } : {}),
  };

  const [agents, calls] = await Promise.all([
    listAgents(),
    listCallLogs(filters, PAGE_LIMIT),
  ]);

  const agentNames = new Map(agents.map((a) => [a.agent_id, a.name]));
  const filtered = Object.keys(filters).length > 0;

  return (
    <PageBody>
      <PageHeader
        title="Call logs"
        description="Written by the n8n post-call workflow. Transcript and recording appear once that workflow is live."
      />

      <Card>
        <CallFilters
          agents={agents.map((a) => ({ agent_id: a.agent_id, name: a.name }))}
        />
      </Card>

      {calls.length === 0 ? (
        <EmptyState
          title={filtered ? "No calls match those filters" : "No calls logged yet"}
          description={
            filtered
              ? "Try widening the date range or clearing the outcome filter."
              : "Once a call completes, the n8n workflow writes a row here."
          }
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Caller</Th>
                <Th>Agent</Th>
                <Th>Outcome</Th>
                <Th>Lead</Th>
                <Th className="text-right">Duration</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.call_log_id}>
                  <Td className="whitespace-nowrap text-muted">
                    <Timestamp value={call.created_at} />
                  </Td>
                  <Td>
                    {call.is_test ? (
                      <Badge tone="blue">Web call</Badge>
                    ) : call.caller_number ? (
                      <Mono>{call.caller_number}</Mono>
                    ) : (
                      <span className="text-faint">unknown</span>
                    )}
                  </Td>
                  <Td>
                    {call.agent_id ? (
                      <Link
                        href={`/agents/${call.agent_id}`}
                        className="font-medium text-brand-deep underline-offset-2 hover:underline dark:text-brand"
                      >
                        {agentNames.get(call.agent_id) ?? "deleted agent"}
                      </Link>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    <OutcomeBadge outcome={call.outcome} />
                    {call.matched_department && (
                      <div className="text-xs text-muted">
                        → {call.matched_department}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {call.lead_name || call.lead_company ? (
                      <>
                        <div>{call.lead_name}</div>
                        <div className="text-xs text-muted">
                          {call.lead_company}
                        </div>
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td className="text-right text-muted">
                    <Duration seconds={call.duration_seconds} />
                  </Td>
                  <Td>
                    <Link
                      href={`/calls/${call.call_log_id}`}
                      className="text-sm font-medium text-brand-deep underline-offset-2 hover:underline dark:text-brand"
                    >
                      Details
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {calls.length === PAGE_LIMIT && (
            <p className="mt-4 text-sm text-muted">
              Showing the {PAGE_LIMIT} most recent matching calls. Narrow the date
              range to see older ones.
            </p>
          )}
        </Card>
      )}
    </PageBody>
  );
}
