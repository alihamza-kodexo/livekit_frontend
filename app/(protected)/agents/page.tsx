import Link from "next/link";

import { CreateAgentForm } from "@/app/(protected)/agents/create-agent-form";
import {
  AgentStatusBadge,
  Card,
  ConfigNotice,
  EmptyState,
  ErrorNotice,
  Mono,
  PageHeader,
  Table,
  Td,
  Th,
  Timestamp,
} from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { listAgents, type AgentListItem } from "@/lib/queries";

export default async function AgentsPage() {
  if (!integrationStatus().supabase) {
    return (
      <>
        <PageHeader title="Agents" />
        <ConfigNotice
          integration="Supabase"
          vars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      </>
    );
  }

  let agents: AgentListItem[];
  try {
    agents = await listAgents();
  } catch (error) {
    return (
      <>
        <PageHeader title="Agents" />
        <ErrorNotice>
          Couldn&apos;t load agents:{" "}
          {error instanceof Error ? error.message : "unknown error"}
          <br />
          Check that the migration in{" "}
          <code>supabase/migrations/0001_init_schema.sql</code> has been applied
          to this project.
        </ErrorNotice>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Agents"
        description="Each agent is one persona: its own prompt, voice, transfer directory and phone number."
      />

      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Create the first agent, then write its prompt and attach a phone number."
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Agent</Th>
                <Th>Status</Th>
                <Th>Number</Th>
                <Th className="text-right">Calls</Th>
                <Th>Last call</Th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.agent_id}>
                  <Td>
                    <Link
                      href={`/agents/${agent.agent_id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {agent.name}
                    </Link>
                    {!agent.prompt && (
                      <span className="ml-2 text-xs text-zinc-400">
                        no prompt yet
                      </span>
                    )}
                  </Td>
                  <Td>
                    <AgentStatusBadge status={agent.status} />
                  </Td>
                  <Td>
                    {agent.twilio_number ? (
                      <Mono>{agent.twilio_number}</Mono>
                    ) : (
                      <Link
                        href="/numbers"
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        assign a number
                      </Link>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{agent.call_count}</Td>
                  <Td className="text-zinc-500 dark:text-zinc-400">
                    <Timestamp value={agent.last_call_at} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card
        title="New agent"
        description="Starts as a draft — it won't answer calls until you set it active."
      >
        <CreateAgentForm />
      </Card>
    </>
  );
}
