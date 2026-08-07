import { AgentsSidebar } from "@/app/(protected)/agents/agents-sidebar";
import { ConfigNotice, ErrorNotice, PageBody, PageHeader } from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { listAgents, type AgentListItem } from "@/lib/queries";

/**
 * Every /agents route shares this always-visible list rail -- picking a
 * different agent just swaps the pane to its right, like Vapi's assistants
 * view. It's the second of the two rails in this shell: the primary nav is in
 * the protected layout above, this one is contextual to /agents.
 */
export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!integrationStatus().supabase) {
    return (
      <PageBody>
        <PageHeader title="Agents" />
        <ConfigNotice
          integration="Supabase"
          vars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      </PageBody>
    );
  }

  let agents: AgentListItem[];
  try {
    agents = await listAgents();
  } catch (error) {
    return (
      <PageBody>
        <PageHeader title="Agents" />
        <ErrorNotice>
          Couldn&apos;t load agents:{" "}
          {error instanceof Error ? error.message : "unknown error"}
          <br />
          Check that the migration in{" "}
          <code>supabase/migrations/0001_init_schema.sql</code> has been applied
          to this project.
        </ErrorNotice>
      </PageBody>
    );
  }

  return (
    // Plain flex row -- no 100vw breakout or transform tricks. The rail is
    // `sticky top-0 h-dvh` (see SectionSidebar) and the content column is just
    // the remaining space, so there is nothing to line up by hand.
    <div className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-start">
      <AgentsSidebar agents={agents} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
