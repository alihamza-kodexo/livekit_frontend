import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AgentToolsPanel,
  BuiltinTools,
  CoreConfigForm,
  DeleteAgentButton,
  KnowledgeBaseForm,
  VoiceConfigForm,
} from "@/app/(protected)/agents/[agentId]/sections";
import { AgentIdentityForm } from "@/app/(protected)/agents/[agentId]/identity-form";
import { AgentModelSummary } from "@/app/(protected)/agents/[agentId]/model-summary";
import { TestAgentPanel } from "@/app/(protected)/agents/[agentId]/test-panel";
import { Card, CollapsibleCard, Mono, PageHeader, Timestamp } from "@/components/ui";
import { StickyBand } from "@/components/sticky-band";
import { Tabs } from "@/components/tabs";
import { getAgent, listAgentTools, listAllTools } from "@/lib/queries";

export default async function AgentPage({
  params,
  searchParams,
}: PageProps<"/agents/[agentId]">) {
  const { agentId } = await params;
  const { tab } = await searchParams;

  const agent = await getAgent(agentId);
  if (!agent) notFound();

  const [allTools, agentTools] = await Promise.all([
    listAllTools(),
    listAgentTools(agentId),
  ]);
  const selectedToolIds = new Set(agentTools.map((t) => t.tool_id));

  const defaultTab = typeof tab === "string" ? tab : undefined;

  return (
    <>
      <StickyBand
        top="var(--nav-h, 4rem)"
        publishHeightAs="--agent-header-h"
        className="z-10 bg-zinc-50 pt-4 pb-4 dark:bg-zinc-950"
      >
        <PageHeader
          title={agent.name}
          description="Everything the worker reads when this agent answers a call."
          actions={
            <>
              <AgentIdentityForm agent={agent} />
              <TestAgentPanel agentId={agent.agent_id} agentName={agent.name} />
            </>
          }
        />
      </StickyBand>

      <AgentModelSummary agent={agent} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-2">
          Number{" "}
          {agent.twilio_number ? (
            <Mono>{agent.twilio_number}</Mono>
          ) : (
            <Link
              href="/numbers"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              assign one
            </Link>
          )}
        </span>
        <span>
          Updated <Timestamp value={agent.updated_at} />
        </span>
        <Link
          href={`/calls?agent=${agent.agent_id}`}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          View calls
        </Link>
      </div>

      <Tabs
        key={defaultTab ?? "default"}
        defaultTab={defaultTab}
        stickyTop="calc(var(--nav-h, 4rem) + var(--agent-header-h, 6rem))"
        tabs={[
            {
              key: "prompt",
              label: "Prompt & qualification",
              content: (
                <Card description="The prompt is the agent's whole personality and script. Qualification criteria are what it has to come away knowing.">
                  <CoreConfigForm key={agent.agent_id} agent={agent} />
                </Card>
              ),
            },
            {
              key: "voice",
              label: "Voice & humanness",
              content: (
                <Card description="FSD Section 4 tuning: which voice, how it's pronounced, and how it paces a conversation.">
                  <VoiceConfigForm agent={agent} />
                </Card>
              ),
            },
            {
              key: "knowledge",
              label: "Knowledge base",
              content: (
                <Card description="Entirely optional — an agent works fine with an empty knowledge base. Exposed to the model as a single on-demand lookup rather than always included, so it only costs tokens on the calls that actually need it.">
                  <KnowledgeBaseForm agent={agent} />
                </Card>
              ),
            },
            {
              key: "tools",
              label: "Tools",
              content: (
                <>
                  <Card description="Tools are a shared library across every agent -- pick which of them this one uses below. Create or edit a tool's own definition from the Tools page in the top nav.">
                    <AgentToolsPanel
                      agentId={agent.agent_id}
                      allTools={allTools}
                      selectedToolIds={selectedToolIds}
                    />
                  </Card>
                  <CollapsibleCard
                    title="Built-in tools"
                    description="The one tool every agent always has automatically -- something has to be able to hang up regardless of what's attached above. Click to see what it does and what the model fills in when it calls it."
                  >
                    <BuiltinTools />
                  </CollapsibleCard>
                </>
              ),
            },
            {
              key: "danger",
              label: "Danger zone",
              content: (
                <Card>
                  <DeleteAgentButton
                    agentId={agent.agent_id}
                    agentName={agent.name}
                    hasNumber={agent.twilio_number !== null}
                  />
                </Card>
              ),
            },
          ]}
        />
    </>
  );
}
