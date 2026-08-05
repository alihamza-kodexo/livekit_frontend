import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BuiltinTools,
  CoreConfigForm,
  DeleteAgentButton,
  DepartmentsForm,
  KnowledgeEntryForm,
  ToolForm,
  VoiceConfigForm,
} from "@/app/(protected)/agents/[agentId]/sections";
import { TestAgentPanel } from "@/app/(protected)/agents/[agentId]/test-panel";
import {
  AgentStatusBadge,
  ButtonLink,
  Card,
  CollapsibleCard,
  Mono,
  PageHeader,
  Timestamp,
} from "@/components/ui";
import { Tabs } from "@/components/tabs";
import {
  getAgent,
  listDepartments,
  listKnowledgeBase,
  listTools,
} from "@/lib/queries";

export default async function AgentPage({
  params,
}: PageProps<"/agents/[agentId]">) {
  const { agentId } = await params;

  const agent = await getAgent(agentId);
  if (!agent) notFound();

  const [departments, knowledgeBase, customTools] = await Promise.all([
    listDepartments(agentId),
    listKnowledgeBase(agentId),
    listTools(agentId),
  ]);

  return (
    <>
      <PageHeader
        title={agent.name}
        description="Everything the worker reads when this agent answers a call."
        actions={
          <>
            <ButtonLink href="/agents">All agents</ButtonLink>
            <ButtonLink href={`/calls?agent=${agent.agent_id}`}>
              View calls
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-2">
          Status <AgentStatusBadge status={agent.status} />
        </span>
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
      </div>

      <Tabs
        tabs={[
          {
            key: "test",
            label: "Test agent",
            content: (
              <Card description="Talk to this agent right now through your browser's microphone -- no phone number or Twilio call involved.">
                <TestAgentPanel agentId={agent.agent_id} />
              </Card>
            ),
          },
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
            key: "departments",
            label: "Departments",
            content: (
              <Card description="Entirely optional — an agent works fine with zero departments. Where a caller gets transferred when you do add one: the agent matches intent against the routing keywords, then dials the number.">
                <DepartmentsForm agentId={agent.agent_id} departments={departments} />
              </Card>
            ),
          },
          {
            key: "knowledge",
            label: "Knowledge base",
            content: (
              <Card description="Entirely optional — an agent works fine with zero entries. Each one you add is used for off-script questions, then the agent steers back to the qualification flow; a Title and Answer are both required for that entry.">
                <div className="space-y-4">
                  {knowledgeBase.map((entry) => (
                    <KnowledgeEntryForm
                      key={entry.kb_id}
                      agentId={agent.agent_id}
                      entry={entry}
                    />
                  ))}
                  <KnowledgeEntryForm agentId={agent.agent_id} />
                </div>
              </Card>
            ),
          },
          {
            key: "tools",
            label: "Tools",
            content: (
              <>
                <Card description="Entirely optional — an agent works fine with zero custom tools. Each one you add calls an n8n webhook you build, so a new integration is a dashboard entry plus a workflow, no worker deploy. But once you start adding a tool, its name, description, and webhook URL are all required for that tool to actually work. All tool calls happen silently mid-call.">
                  <div className="space-y-4">
                    {customTools.map((tool) => (
                      <ToolForm key={tool.tool_id} agentId={agent.agent_id} tool={tool} />
                    ))}
                    <ToolForm agentId={agent.agent_id} />
                  </div>
                </Card>
                <CollapsibleCard
                  title="Built-in tools"
                  description="Every agent gets these automatically -- they're code in the worker, not something created per agent. Click to see what they do and what the model fills in when it calls one."
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
