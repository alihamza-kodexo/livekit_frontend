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

  return (
    <div className="space-y-3">
      <Input
        type="search"
        placeholder="Search by number, label, or assigned agent…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search numbers"
        className="sm:max-w-xs"
      />
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
              {filtered.map((number) => (
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
