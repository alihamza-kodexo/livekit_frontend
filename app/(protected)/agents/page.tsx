import { CreateAgentForm } from "@/app/(protected)/agents/create-agent-form";
import { Card, PageHeader } from "@/components/ui";

/**
 * Landing pane when no agent is selected from the sidebar -- the sidebar (see
 * layout.tsx) is the actual agent list now, so this just orients a first-time
 * visitor and hosts the create form.
 */
export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Agents"
        description="Pick one from the list on the left, or create a new one below."
      />

      <Card
        title="New agent"
        description="Starts as a draft — it won't answer calls until you set it active."
      >
        <CreateAgentForm />
      </Card>
    </>
  );
}
