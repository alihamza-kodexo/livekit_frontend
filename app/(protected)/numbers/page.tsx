import { ConnectNumber } from "@/app/(protected)/numbers/connect-number";
import { NumberSearch } from "@/app/(protected)/numbers/number-search";
import { OwnedNumbers, type NumberRow } from "@/app/(protected)/numbers/owned-numbers";
import {
  Card,
  Code,
  ConfigNotice,
  EmptyState,
  ErrorNotice,
  Mono,
  PageHeader,
} from "@/components/ui";
import { integrationStatus } from "@/lib/env";
import { describeSipConfig } from "@/lib/livekit";
import { listAgents, listExternalNumbers, numberAssignments } from "@/lib/queries";
import { describeSharedTrunk, listOwnedNumbers } from "@/lib/twilio";

export default async function NumbersPage() {
  const status = integrationStatus();

  if (!status.supabase) {
    return (
      <>
        <PageHeader title="Numbers" />
        <ConfigNotice
          integration="Supabase"
          vars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      </>
    );
  }

  if (!status.twilio) {
    return (
      <>
        <PageHeader title="Numbers" />
        <ConfigNotice
          integration="Twilio"
          vars={[
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "TWILIO_SIP_TRUNK_SID",
          ]}
        />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Code>TWILIO_SIP_TRUNK_SID</Code> is the SID of the one shared Elastic
          SIP Trunk (it starts with <Code>TK</Code>). Create that trunk once by
          hand, point its origination URI at the LiveKit SIP endpoint, and this
          page manages the numbers on it from then on.
        </p>
      </>
    );
  }

  const [agents, assignments, externalNumbers, numbersResult, trunkResult] =
    await Promise.all([
      listAgents(),
      numberAssignments(),
      listExternalNumbers(),
      listOwnedNumbers().then(
        (data) => ({ ok: true as const, data }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
      describeSharedTrunk().then(
        (data) => ({ ok: true as const, data }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    ]);

  const agentOptions = agents.map((agent) => ({
    agent_id: agent.agent_id,
    name: agent.name,
  }));

  if (!numbersResult.ok) {
    return (
      <>
        <PageHeader title="Numbers" />
        <ErrorNotice>
          Couldn&apos;t reach Twilio:{" "}
          {numbersResult.error instanceof Error
            ? numbersResult.error.message
            : "unknown error"}
        </ErrorNotice>
      </>
    );
  }

  const rows: NumberRow[] = [
    ...numbersResult.data.map((number) => ({
      ...number,
      source: "platform" as const,
      assignedAgent: assignments.get(number.phoneNumber) ?? null,
    })),
    ...externalNumbers.map((number) => ({
      source: "external" as const,
      externalNumberId: number.external_number_id,
      sid: number.number_sid,
      phoneNumber: number.phone_number,
      friendlyName: number.friendly_name,
      trunkSid: number.trunk_sid,
      assignedAgent: assignments.get(number.phone_number) ?? null,
    })),
  ];

  // Numbers assigned in Supabase that Twilio doesn't list and that aren't a
  // connected external number either. Usually a number released outside the
  // dashboard — the agent looks configured but can't ring.
  const owned = new Set([
    ...numbersResult.data.map((n) => n.phoneNumber),
    ...externalNumbers.map((n) => n.phone_number),
  ]);
  const orphaned = [...assignments.entries()].filter(([number]) => !owned.has(number));

  return (
    <>
      <PageHeader
        title="Numbers"
        description="Buy numbers, route them through the shared SIP trunk, and pick which agent answers each one."
      />

      {orphaned.length > 0 && (
        <ErrorNotice>
          <p className="font-medium">Assigned to an agent but not on this Twilio account:</p>
          <ul className="mt-1 space-y-0.5">
            {orphaned.map(([number, agent]) => (
              <li key={number}>
                <Mono>{number}</Mono> — {agent.name}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Those agents will never receive a call. Either buy the number back or
            clear the assignment on the agent.
          </p>
        </ErrorNotice>
      )}

      <Card
        title="Numbers on this account"
        description="Attach routes a number out through the shared trunk to LiveKit. The agent that answers is decided here, not in Twilio."
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No numbers yet"
            description="Search Twilio below to buy the first one."
          />
        ) : (
          <OwnedNumbers numbers={rows} agents={agentOptions} />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Buy a new number"
          description="Purchasing charges the Twilio account immediately. Each result is confirmed individually before anything is bought."
        >
          {agentOptions.length === 0 ? (
            <EmptyState
              title="Create an agent first"
              description="A number needs an agent to answer it. You can still buy one unassigned, but nothing will pick up."
            />
          ) : null}
          <NumberSearch agents={agentOptions} />
        </Card>

        <Card
          title="Connect a Twilio number you already own"
          description="Bring your own Twilio number with its Account SID and Auth Token — nothing is purchased, this just routes an existing number to LiveKit."
        >
          <ConnectNumber agents={agentOptions} />
        </Card>
      </div>

      <Card
        title="Routing status"
        description="The static telephony setup every number depends on. Created once — see infra/README.md."
      >
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-zinc-800 dark:text-zinc-200">
              Twilio shared trunk
            </dt>
            <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
              {trunkResult.ok ? (
                <>
                  <Mono>{trunkResult.data.friendlyName}</Mono> (
                  <Mono>{trunkResult.data.sid}</Mono>) →{" "}
                  {trunkResult.data.originationUris.length > 0 ? (
                    trunkResult.data.originationUris.map((uri) => (
                      <Mono key={uri}>{uri}</Mono>
                    ))
                  ) : (
                    <span className="text-red-600 dark:text-red-400">
                      no origination URI set — inbound calls have nowhere to go
                    </span>
                  )}
                </>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  Couldn&apos;t read the trunk:{" "}
                  {trunkResult.error instanceof Error
                    ? trunkResult.error.message
                    : "unknown error"}
                </span>
              )}
            </dd>
          </div>
          <LiveKitStatus configured={status.livekit} />
        </dl>
      </Card>
    </>
  );
}

async function LiveKitStatus({ configured }: { configured: boolean }) {
  if (!configured) {
    return (
      <div>
        <dt className="font-medium text-zinc-800 dark:text-zinc-200">
          LiveKit SIP
        </dt>
        <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
          Not configured — set <Code>LIVEKIT_URL</Code>,{" "}
          <Code>LIVEKIT_API_KEY</Code> and <Code>LIVEKIT_API_SECRET</Code> to see
          trunk and dispatch status here.
        </dd>
      </div>
    );
  }

  let config: Awaited<ReturnType<typeof describeSipConfig>>;
  try {
    config = await describeSipConfig();
  } catch (error) {
    return (
      <div>
        <dt className="font-medium text-zinc-800 dark:text-zinc-200">
          LiveKit SIP
        </dt>
        <dd className="mt-1 text-red-600 dark:text-red-400">
          Couldn&apos;t reach LiveKit:{" "}
          {error instanceof Error ? error.message : "unknown error"}
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="font-medium text-zinc-800 dark:text-zinc-200">
        LiveKit SIP
      </dt>
      <dd className="mt-1 space-y-1 text-zinc-600 dark:text-zinc-400">
        {config.trunks.length === 0 ? (
          <p className="text-red-600 dark:text-red-400">
            No inbound trunk — LiveKit will reject every call. Create one per
            infra/README.md step 4.
          </p>
        ) : (
          config.trunks.map((trunk) => (
            <p key={trunk.sipTrunkId}>
              Inbound trunk <Mono>{trunk.name || trunk.sipTrunkId}</Mono>:{" "}
              {trunk.numbers.length === 0
                ? "accepts any dialed number"
                : `restricted to ${trunk.numbers.join(", ")}`}
            </p>
          ))
        )}
        {config.dispatchRules.length === 0 ? (
          <p className="text-red-600 dark:text-red-400">
            No dispatch rule — calls will land in LiveKit but no agent worker
            gets dispatched.
          </p>
        ) : (
          config.dispatchRules.map((rule) => (
            <p key={rule.sipDispatchRuleId}>
              Dispatch <Mono>{rule.name || rule.sipDispatchRuleId}</Mono> →
              worker{" "}
              {rule.agentNames.length > 0 ? (
                rule.agentNames.map((name) => <Mono key={name}>{name}</Mono>)
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  none named
                </span>
              )}
            </p>
          ))
        )}
      </dd>
    </div>
  );
}
