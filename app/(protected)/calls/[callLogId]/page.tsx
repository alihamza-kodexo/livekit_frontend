import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  ButtonLink,
  Card,
  Duration,
  Mono,
  OutcomeBadge,
  PageHeader,
  Timestamp,
} from "@/components/ui";
import { getAgent, getCallLog } from "@/lib/queries";

export default async function CallDetailPage({
  params,
}: PageProps<"/calls/[callLogId]">) {
  const { callLogId } = await params;

  const call = await getCallLog(callLogId);
  if (!call) notFound();

  const agent = call.agent_id ? await getAgent(call.agent_id) : null;

  return (
    <>
      <PageHeader
        title="Call detail"
        actions={<ButtonLink href="/calls">All calls</ButtonLink>}
      />

      <Card title="Summary">
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="When">
            <Timestamp value={call.created_at} />
          </Detail>
          <Detail label="Source">
            {call.is_test ? (
              <Badge tone="blue">Web call</Badge>
            ) : (
              "Phone call"
            )}
          </Detail>
          <Detail label="Caller">
            {call.is_test ? (
              <span className="text-zinc-400">no phone number — browser test</span>
            ) : call.caller_number ? (
              <Mono>{call.caller_number}</Mono>
            ) : (
              "unknown"
            )}
          </Detail>
          <Detail label="Duration">
            <Duration seconds={call.duration_seconds} />
          </Detail>
          <Detail label="Outcome">
            <OutcomeBadge outcome={call.outcome} />
          </Detail>
          <Detail label="Agent">
            {agent ? (
              <Link
                href={`/agents/${agent.agent_id}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {agent.name}
              </Link>
            ) : (
              "—"
            )}
          </Detail>
          <Detail label="Transferred to">
            {call.matched_department ?? "—"}
          </Detail>
          <Detail label="Lead name">{call.lead_name ?? "—"}</Detail>
          <Detail label="Company">{call.lead_company ?? "—"}</Detail>
          <Detail label="Twilio call SID">
            {call.call_sid ? <Mono>{call.call_sid}</Mono> : "—"}
          </Detail>
          <Detail label="LiveKit room">
            {call.room_id ? <Mono>{call.room_id}</Mono> : "—"}
          </Detail>
        </dl>

        {call.lead_need && (
          <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              What they need
            </dt>
            <dd className="mt-1 text-sm">{call.lead_need}</dd>
          </div>
        )}
      </Card>

      {call.recording_url && (
        <Card title="Recording">
          <audio controls src={call.recording_url} className="w-full">
            <a href={call.recording_url}>Download the recording</a>
          </audio>
        </Card>
      )}

      <Card title="Transcript">
        {call.transcript ? (
          <pre className="max-h-[32rem] overflow-auto rounded-md bg-zinc-50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap dark:bg-zinc-900">
            {call.transcript}
          </pre>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No transcript was recorded for this call.
          </p>
        )}
      </Card>
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
