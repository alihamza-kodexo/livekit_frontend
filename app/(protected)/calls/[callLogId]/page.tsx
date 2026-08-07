import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  ButtonLink,
  Card,
  Duration,
  Mono,
  OutcomeBadge,
  PageBody,
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
    <PageBody>
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
              <span className="text-faint">no phone number — browser test</span>
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
                className="font-medium text-brand-deep underline-offset-2 hover:underline dark:text-brand"
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
          <div className="mt-6 border-t border-divider pt-5">
            <dt className="mono-kicker">
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
          <pre className="max-h-[32rem] overflow-auto rounded-md bg-canvas-alt p-4 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
            {call.transcript}
          </pre>
        ) : (
          <p className="text-sm text-muted">
            No transcript was recorded for this call.
          </p>
        )}
      </Card>
    </PageBody>
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
      <dt className="mono-kicker">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
