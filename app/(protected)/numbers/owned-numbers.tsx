"use client";

import { useActionState, useMemo, useState } from "react";

import {
  assignNumber,
  attachNumber,
  detachNumber,
  disconnectExternalNumberAction,
  releaseNumberAction,
} from "@/app/(protected)/numbers/actions";
import { ActionButton, ActionMessage } from "@/components/form";
import { Badge, Button, Input, Mono, Select, Table, Td, Th } from "@/components/ui";
import { IDLE } from "@/lib/forms";
import type { AgentStatus } from "@/lib/types";
import type { OwnedNumber } from "@/lib/twilio";

type AssignedAgent = { agent_id: string; name: string; status: AgentStatus } | null;

/** Recognized third-party voice platforms, so a known one gets a clean badge
 * instead of dumping its raw webhook URL into the table. */
const KNOWN_VOICE_PLATFORMS: { host: RegExp; label: string }[] = [
  { host: /(^|\.)vapi\.ai$/, label: "Vapi" },
];

function externalVoicePlatform(voiceUrl: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(voiceUrl).hostname;
  } catch {
    return null;
  }
  return KNOWN_VOICE_PLATFORMS.find((p) => p.host.test(hostname))?.label ?? null;
}

/** A number bought on the platform's own Twilio account. */
export type PlatformNumberRow = OwnedNumber & {
  source: "platform";
  assignedAgent: AssignedAgent;
};

/**
 * A number connected from a customer's own Twilio account. Deliberately
 * carries only `externalNumberId` and not the stored Account SID/Auth Token --
 * those stay server-side; the disconnect action looks them up by ID.
 */
export type ExternalNumberRow = {
  source: "external";
  externalNumberId: string;
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  trunkSid: string;
  assignedAgent: AssignedAgent;
};

export type NumberRow = PlatformNumberRow | ExternalNumberRow;

export function OwnedNumbers({
  numbers,
  agents,
}: {
  numbers: NumberRow[];
  agents: { agent_id: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const [page, setPage] = useState(1);

  // A new search or page size can leave the current page pointed at a now-
  // stale slice (e.g. page 3 of a search that now only has 1 page). Reset
  // during render rather than in an effect -- see "Adjusting state when a
  // prop changes" in the React docs.
  const [resetKey, setResetKey] = useState(`${search}|${pageSize}`);
  const currentResetKey = `${search}|${pageSize}`;
  if (resetKey !== currentResetKey) {
    setResetKey(currentResetKey);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return numbers;
    return numbers.filter(
      (number) =>
        number.phoneNumber.toLowerCase().includes(term) ||
        number.friendlyName.toLowerCase().includes(term) ||
        number.assignedAgent?.name.toLowerCase().includes(term),
    );
  }, [numbers, search]);

  const totalPages =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows =
    pageSize === "all"
      ? filtered
      : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Search by number, label, or assigned agent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search numbers"
          className="sm:max-w-xs"
        />
        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          Show
          <Select
            aria-label="Numbers per page"
            value={pageSize}
            onChange={(e) =>
              setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="w-auto py-1"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value="all">All</option>
          </Select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No numbers match &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {filtered.length} of {numbers.length} number{numbers.length === 1 ? "" : "s"}
          </p>
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Routing</Th>
                <Th>Answered by</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((number) => (
                <tr key={number.sid}>
                  <Td>
                    <Mono>{number.phoneNumber}</Mono>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {number.friendlyName}
                    </div>
                  </Td>
                  <Td>
                    {number.source === "external" ? (
                      <Badge tone="green">connected (own trunk)</Badge>
                    ) : number.onSharedTrunk ? (
                      <Badge tone="green">on shared trunk</Badge>
                    ) : number.trunkSid ? (
                      <Badge tone="amber">other trunk</Badge>
                    ) : (
                      <Badge tone="red">not routed</Badge>
                    )}
                    {number.source === "platform" &&
                      !number.onSharedTrunk &&
                      number.voiceUrl &&
                      (() => {
                        const platform = externalVoicePlatform(number.voiceUrl);
                        return platform ? (
                          <div className="mt-1.5">
                            <Badge tone="violet">Live on {platform}</Badge>
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            Currently calls <Mono>{number.voiceUrl}</Mono>
                          </div>
                        );
                      })()}
                  </Td>
                  <Td>
                    <AssignmentPicker number={number} agents={agents} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-2">
                      {number.source === "external" ? (
                        <ActionButton
                          action={disconnectExternalNumberAction}
                          label="Disconnect"
                          variant="danger"
                          confirm={`Stop routing ${number.phoneNumber} to LiveKit? This removes it from this dashboard and detaches it from the trunk it was given. The Twilio account keeps the number itself.`}
                          hidden={{ external_number_id: number.externalNumberId }}
                        />
                      ) : (
                        <>
                          {number.onSharedTrunk ? (
                            <ActionButton
                              action={detachNumber}
                              label="Detach"
                              confirm={`Stop routing ${number.phoneNumber} to LiveKit? Callers will stop reaching the agent, and any agent assignment is cleared. You keep the number.`}
                              hidden={{
                                number_sid: number.sid,
                                phone_number: number.phoneNumber,
                              }}
                            />
                          ) : (
                            <ActionButton
                              action={attachNumber}
                              label="Attach"
                              variant="primary"
                              confirm={
                                number.voiceUrl
                                  ? `${number.phoneNumber} is currently live on ${
                                      externalVoicePlatform(number.voiceUrl) ??
                                      number.voiceUrl
                                    }. Attaching it to the shared trunk overrides that immediately -- Twilio ignores a number's Voice URL once it's on a trunk, so whatever answers it today stops receiving calls the moment you confirm. Continue?`
                                  : undefined
                              }
                              hidden={{
                                number_sid: number.sid,
                                phone_number: number.phoneNumber,
                              }}
                            />
                          )}
                          <ActionButton
                            action={releaseNumberAction}
                            label="Release"
                            variant="danger"
                            confirm={`Release ${number.phoneNumber} back to Twilio? This is permanent — the number returns to the public pool and cannot be reclaimed.`}
                            hidden={{
                              number_sid: number.sid,
                              phone_number: number.phoneNumber,
                            }}
                          />
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The assignment dropdown. Submits on change rather than behind a Save button —
 * this is a single-field decision and the row already shows the result.
 */
function AssignmentPicker({
  number,
  agents,
}: {
  number: NumberRow;
  agents: { agent_id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(assignNumber, IDLE);

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="phone_number" value={number.phoneNumber} />
      <div className="flex items-center gap-2">
        <Select
          name="agent_id"
          defaultValue={number.assignedAgent?.agent_id ?? ""}
          aria-label={`Agent answering ${number.phoneNumber}`}
          disabled={pending}
          className="sm:w-52"
        >
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.agent_id} value={agent.agent_id}>
              {agent.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Set"}
        </Button>
      </div>
      {number.assignedAgent && number.assignedAgent.status !== "active" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Assigned agent is {number.assignedAgent.status} — it won&apos;t answer
          this number yet.
        </p>
      )}
      <ActionMessage state={state} />
    </form>
  );
}
