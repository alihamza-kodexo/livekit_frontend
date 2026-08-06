"use client";

import { useActionState, useId } from "react";

import { updateAgentIdentity } from "@/app/(protected)/agents/actions";
import { ActionMessage, SubmitButton, useFlashStatus } from "@/components/form";
import { Input, Select } from "@/components/ui";
import { IDLE } from "@/lib/forms";
import { AGENT_STATUSES, type Agent, type AgentStatus } from "@/lib/types";

const AGENT_STATUS_TOOLTIPS: Record<AgentStatus, string> = {
  draft: "Not live. Safe to leave incomplete -- won't answer calls even if a number is assigned.",
  paused: "Temporarily off. Callers to an assigned number hear the number's fallback instead of this agent.",
  active: "Live. Answers real calls on any number assigned to this agent. Requires a system prompt.",
};

/**
 * Quick persona-name/status editor, lifted out of the Prompt & qualification
 * tab into the sticky header so renaming or (de)activating an agent doesn't
 * need a scroll + tab switch. CoreConfigForm still carries these two as
 * hidden fields (unchanged) so its own full-form save doesn't clobber
 * whatever's set here, and vice versa.
 */
export function AgentIdentityForm({ agent }: { agent: Agent }) {
  const [state, formAction, pending] = useActionState(updateAgentIdentity, IDLE);
  const flash = useFlashStatus(state);
  const formId = useId();

  return (
    <div className="flex flex-col items-end gap-1">
      <form id={formId} action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="agent_id" value={agent.agent_id} />
        <Input
          name="name"
          defaultValue={agent.name}
          required
          aria-label="Persona name"
          placeholder="Persona name"
          className="w-28 sm:w-32"
        />
        <Select name="status" defaultValue={agent.status} aria-label="Status" className="w-24">
          {AGENT_STATUSES.map((status) => (
            <option key={status} value={status} title={AGENT_STATUS_TOOLTIPS[status]}>
              {status}
            </option>
          ))}
        </Select>
        <SubmitButton
          formId={formId}
          variant="secondary"
          idleLabel="Save"
          pendingLabel="Saving…"
          pending={pending}
          flash={flash}
        />
      </form>
      {/* Success now shows on the button itself; this stays only for error,
          since the reason (e.g. the missing-API-key message) needs more room
          than the button has -- constrained so it wraps near the button
          instead of stretching the full width of the header. */}
      {flash === "error" && (
        <div className="max-w-[16rem] text-right">
          <ActionMessage state={state} />
        </div>
      )}
    </div>
  );
}
