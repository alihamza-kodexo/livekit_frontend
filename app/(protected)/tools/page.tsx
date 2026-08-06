import { ToolsLibraryPanel } from "@/app/(protected)/tools/tools-library-panel";
import { Card, ConfigNotice, PageHeader } from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { listAllTools } from "@/lib/queries";

export default async function ToolsPage() {
  if (!integrationStatus().supabase) {
    return (
      <>
        <PageHeader title="Tools" />
        <ConfigNotice
          integration="Supabase"
          vars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      </>
    );
  }

  const tools = await listAllTools();

  return (
    <>
      <PageHeader
        title="Tools"
        description="Shared across every agent -- each one you add calls an n8n webhook you build, so a new integration is a dashboard entry plus a workflow, no worker deploy. Pick which of these an agent uses from its own Tools tab."
      />
      <Card>
        <ToolsLibraryPanel tools={tools} />
      </Card>
    </>
  );
}
