import { AgentsSidebar } from "@/app/(protected)/agents/agents-sidebar";
import { ConfigNotice, ErrorNotice, PageHeader } from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { listAgents, type AgentListItem } from "@/lib/queries";

/**
 * Every /agents route shares this always-visible sidebar -- picking a
 * different agent just swaps the right-hand pane, like Vapi's assistants view.
 */
export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    // Breaks out of <main>'s `mx-auto max-w-6xl` centering -- with a
    // persistent sidebar there's no reason to waste the space that leaves on
    // wide screens, so this spans the full viewport width instead.
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <AgentsSidebar agents={agents} />
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </div>
    </div>
  );
}
