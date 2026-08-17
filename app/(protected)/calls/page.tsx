import Link from "next/link";

import { CallFilters } from "@/app/(protected)/calls/filters";
import { Pagination } from "@/components/pagination";
import {
  Badge,
  Card,
  ConfigNotice,
  Duration,
  EmptyState,
  Money,
  Mono,
  OutcomeBadge,
  PageBody,
  PageHeader,
  PriorityBadge,
  Table,
  Td,
  Th,
  Timestamp,
} from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { listAgents, listCallLogs, type CallLogFilters } from "@/lib/queries";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/types";

const PAGE_SIZE = 50;

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

  // Anything that isn't a positive integer -- "0", "-3", "abc", "1e9" -- falls
  // back to the first page rather than producing a negative range offset.
  const requestedPage = Number(single("page"));
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [agents, { rows: calls, total }] = await Promise.all([
    listAgents(),
    listCallLogs(filters, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
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

      {total === 0 ? (
        <EmptyState
          title={filtered ? "No calls match those filters" : "No calls logged yet"}
          description={
            filtered
              ? "Try widening the date range or clearing the outcome filter."
              : "Once a call completes, the n8n workflow writes a row here."
          }
        />
      ) : calls.length === 0 ? (
        // There are matching calls, just not this far in -- a hand-edited or
        // stale `?page=`. Keep the pager so there's a way back to them.
        <Card>
          <EmptyState
            title="Nothing on this page"
            description="There are fewer pages of results than this. Step back to see them."
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/calls"
            params={params}
            unit="calls"
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Caller</Th>
                <Th>Agent</Th>
                <Th>Outcome</Th>
                <Th>Priority</Th>
                <Th>Lead</Th>
                <Th className="text-right">Duration</Th>
                <Th className="text-right">Cost</Th>
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
                    {call.has_error && (
                      // The session broke on this call. Surfaced in the list
                      // because a failed call that still shows a normal outcome
                      // is otherwise indistinguishable from one that worked.
                      <div className="text-xs text-error-text">session error</div>
                    )}
                  </Td>
                  <Td>
                    <PriorityBadge priority={call.priority} />
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
                  <Td className="text-right text-muted">
                    <Money usd={call.cost_total_usd} />
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

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/calls"
            params={params}
            unit="calls"
          />
        </Card>
      )}
    </PageBody>
  );
}
