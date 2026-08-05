"use client";

import { useRef, useState } from "react";
import {
  deleteAgent,
  deleteKnowledgeEntry,
  deleteTool,
  saveDepartments,
  saveKnowledgeEntry,
  saveTool,
  updateAgentCore,
  updateAgentVoice,
} from "@/app/(protected)/agents/actions";
import { ActionButton, ActionForm } from "@/components/form";
import { RepeatableRows } from "@/components/repeatable-rows";
import { ToolParameterBuilder } from "@/components/tool-parameter-builder";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { VoicePicker } from "@/components/voice-picker";
import type {
  Agent,
  AgentStatus,
  Department,
  FirstMessageMode,
  KnowledgeBaseEntry,
  LLMProvider,
  Tool,
} from "@/lib/types";
import {
  AGENT_STATUSES,
  BUILTIN_TOOLS,
  CONVERSATION_SETTING_DEFAULTS,
  FIRST_MESSAGE_MODES,
  LLM_PROVIDERS,
} from "@/lib/types";

const LLM_PROVIDER_LABELS: Record<LLMProvider, string> = {
  groq: "Groq (Llama 3.3 70B) -- fast, default",
  deepseek: "DeepSeek (v4 Flash) -- cheaper, slower",
  gemini_live: "Gemini Live -- realtime, cheapest, fewer tuning options",
};

/** Shown as each <option>'s hover tooltip (native `title` attribute). */
const LLM_PROVIDER_TOOLTIPS: Record<LLMProvider, string> = {
  groq: "Fast responses via Llama 3.3 70B on Groq's LPU hardware. Best default for natural call latency.",
  deepseek: "Cheaper per output token than Groq, but DeepSeek's API adds roughly 1.5s of extra latency per turn -- noticeable to callers.",
  gemini_live: "Google's realtime speech-to-speech model. Skips separate STT/TTS entirely, so it's the cheapest option -- but it can't use the pronunciation dictionary or most tuning settings below.",
};

const AGENT_STATUS_TOOLTIPS: Record<AgentStatus, string> = {
  draft: "Not live. Safe to leave incomplete -- won't answer calls even if a number is assigned.",
  paused: "Temporarily off. Callers to an assigned number hear the number's fallback instead of this agent.",
  active: "Live. Answers real calls on any number assigned to this agent. Requires a system prompt below.",
};

const FIRST_MESSAGE_LABELS: Record<FirstMessageMode, string> = {
  agent_generates: "Agent greets, ad-libbed from the prompt (default)",
  agent_says_exact: "Agent says this exact line",
  user_starts: "Caller speaks first -- agent stays silent until then",
};

const FIRST_MESSAGE_TOOLTIPS: Record<FirstMessageMode, string> = {
  agent_generates:
    "The model writes its own greeting each call, following the system prompt's persona -- never word-for-word identical twice.",
  agent_says_exact:
    "Skips the model entirely for the opening line -- spoken exactly as typed below, every call, then the conversation continues normally from the prompt.",
  user_starts:
    "The agent says nothing when the call connects. It waits for the caller to speak first, then responds normally.",
};

/* -------------------------------------------------------------------------- */
/* Prompt, persona, status, qualification criteria                            */
/* -------------------------------------------------------------------------- */

export function CoreConfigForm({ agent }: { agent: Agent }) {
  const [firstMessageMode, setFirstMessageMode] = useState<FirstMessageMode>(
    agent.first_message_mode,
  );

  return (
    <ActionForm action={updateAgentCore} pendingLabel="Saving…">
      <input type="hidden" name="agent_id" value={agent.agent_id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Persona name" htmlFor="agent-name" badge="required">
          <Input id="agent-name" name="name" defaultValue={agent.name} required />
        </Field>
        <Field
          label="Status"
          htmlFor="agent-status"
          badge="required"
          hint={
            <>
              Only active agents answer calls. Paused sends callers to the
              number&apos;s fallback. Setting this to &ldquo;active&rdquo;
              requires a system prompt below — saving without one keeps the
              agent as draft and the message under Save will say why.
            </>
          }
        >
          <Select id="agent-status" name="status" defaultValue={agent.status}>
            {AGENT_STATUSES.map((status) => (
              <option key={status} value={status} title={AGENT_STATUS_TOOLTIPS[status]}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Call opening
        </legend>
        <Field
          label="Who speaks first"
          htmlFor="first-message-mode"
          badge="required"
          hint="Controls only the very first line of the call -- everything after follows the prompt normally regardless of this setting."
        >
          <Select
            id="first-message-mode"
            name="first_message_mode"
            value={firstMessageMode}
            onChange={(e) => setFirstMessageMode(e.target.value as FirstMessageMode)}
          >
            {FIRST_MESSAGE_MODES.map((mode) => (
              <option key={mode} value={mode} title={FIRST_MESSAGE_TOOLTIPS[mode]}>
                {FIRST_MESSAGE_LABELS[mode]}
              </option>
            ))}
          </Select>
        </Field>
        {/* Stays mounted (just visually hidden) rather than unmounting when the
            mode changes -- so switching away and back doesn't lose whatever
            was typed here, and saving in another mode doesn't wipe it. */}
        <div hidden={firstMessageMode !== "agent_says_exact"}>
          <Field
            label="Exact opening line"
            htmlFor="first-message-text"
            badge="required"
            hint="Spoken word-for-word, every call -- not written by the model."
          >
            <Textarea
              id="first-message-text"
              name="first_message_text"
              rows={2}
              defaultValue={agent.first_message_text ?? ""}
              placeholder="Thanks for calling Kodexo Labs, this is Ava -- how can I help you today?"
            />
          </Field>
        </div>
      </fieldset>

      <Field
        label="System prompt"
        htmlFor="agent-prompt"
        badge="Required to activate"
        hint="The agent's standing instructions: who it is, how it opens, how it handles the call. The worker sends this as the system message on every turn. Can be left blank while the agent is a draft, but Status can't be set to active without one."
      >
        <Textarea
          id="agent-prompt"
          name="prompt"
          rows={18}
          defaultValue={agent.prompt}
          placeholder="You are the receptionist for Kodexo Labs…"
        />
      </Field>

      <fieldset className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Qualification criteria
        </legend>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Optional overall — no rows means the agent qualifies freely from the
          prompt alone. But once a row is started, both Key and What to find
          out become required for that row. The key is how the answer is
          reported back in the call log, so it has to be identifier-safe.
        </p>
        <RepeatableRows
          addLabel="Add criterion"
          emptyHint="No criteria yet — the agent will qualify freely from the prompt alone."
          columns={[
            {
              name: "criterion_key",
              kind: "text",
              label: "Key",
              placeholder: "project_type",
              width: "sm:w-52",
            },
            {
              name: "criterion_question",
              kind: "text",
              label: "What to find out",
              placeholder: "What kind of project are they looking to build?",
            },
            { name: "criterion_required", kind: "bool", label: "Required" },
          ]}
          initial={agent.qualification_criteria.map((c) => ({
            criterion_key: c.key,
            criterion_question: c.question,
            criterion_required: String(c.required),
          }))}
        />
      </fieldset>

      <fieldset className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          When to end the call
        </legend>
        <Field
          label="End-call conditions"
          htmlFor="end-call-instructions"
          badge="optional"
          hint='The built-in end_call tool always does the actual hang-up -- this only changes the conditions the model watches for before calling it. Leave blank to use the default: end once qualification is complete and there is nothing further to transfer or discuss. Example: "End the call once the caller has booked a demo slot, or after they decline twice."'
        >
          <Textarea
            id="end-call-instructions"
            name="end_call_instructions"
            rows={3}
            defaultValue={agent.end_call_instructions ?? ""}
            placeholder="End once qualification is complete and there's nothing further to discuss."
          />
        </Field>
      </fieldset>
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/* Voice & humanness                                                          */
/* -------------------------------------------------------------------------- */

/** The FSD Section 4.3 tuning parameters, with the ranges the action enforces. */
const TUNING_FIELDS = [
  {
    name: "temperature",
    label: "Temperature",
    step: "0.05",
    min: 0,
    max: 2,
    hint: "Lower is more predictable and on-script.",
  },
  {
    name: "max_reply_sentences",
    label: "Max reply sentences",
    step: "1",
    min: 1,
    max: 10,
    hint: "Long answers feel like a bot reading. Two is usually right.",
  },
  {
    name: "tts_stability",
    label: "TTS stability",
    step: "0.05",
    min: 0,
    max: 1,
    hint: "Higher is steadier but flatter.",
  },
  {
    name: "speech_rate",
    label: "Speech rate",
    step: "0.05",
    min: 0.5,
    max: 2,
    hint: "1.0 is the voice's natural pace.",
  },
  {
    name: "vad_threshold_ms",
    label: "Silence before replying (ms)",
    step: "10",
    min: 100,
    max: 3000,
    hint: "Too low and the agent talks over a caller who paused to think.",
  },
  {
    name: "interruption_sensitivity",
    label: "Interruption sensitivity",
    step: "0.05",
    min: 0,
    max: 1,
    hint: "How readily barge-in stops the agent mid-sentence.",
  },
  {
    name: "backchannel_frequency",
    label: "Backchannel frequency",
    step: "0.05",
    min: 0,
    max: 1,
    hint: 'How often it drops in an "mm-hm" while listening.',
  },
] as const;

export function VoiceConfigForm({ agent }: { agent: Agent }) {
  const tuningRef = useRef<HTMLDivElement>(null);

  return (
    <ActionForm action={updateAgentVoice} pendingLabel="Saving…">
      <input type="hidden" name="agent_id" value={agent.agent_id} />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Fixed, not editable: the worker always uses Deepgram for both --
            agent.stt_provider/tts_provider aren't read anywhere in the worker
            code, so an editable field here would silently do nothing. */}
        <Field label="STT provider" badge="Fixed" hint="Fixed for every agent.">
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Deepgram
          </p>
          <input type="hidden" name="stt_provider" value="deepgram" />
        </Field>
        <Field label="TTS provider" badge="Fixed" hint="Fixed for every agent.">
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Deepgram (Aura)
          </p>
          <input type="hidden" name="tts_provider" value="deepgram" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Conversation engine"
          htmlFor="llm-provider"
          badge="required"
          hint="Groq is the fast default. DeepSeek is cheaper per-token but noticeably slower to respond. Gemini Live replaces the whole voice pipeline (no separate STT/TTS) -- cheapest option, but it drops the pronunciation dictionary and most tuning settings below. See VOICE_STACK_DECISION.md before switching a live agent."
        >
          <Select id="llm-provider" name="llm_provider" defaultValue={agent.llm_provider}>
            {LLM_PROVIDERS.map((provider) => (
              <option key={provider} value={provider} title={LLM_PROVIDER_TOOLTIPS[provider]}>
                {LLM_PROVIDER_LABELS[provider]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Voice ID"
          htmlFor="voice-id"
          badge="optional"
          hint="Search by name, language, gender, or style. You can also paste a raw Deepgram model name directly. Leave blank to use the worker's default voice."
        >
          <VoicePicker id="voice-id" fieldName="voice_id" defaultValue={agent.voice_id ?? ""} />
        </Field>
      </div>

      <fieldset className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Conversation tuning
        </legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Leave a field blank to use the worker&apos;s default, shown as the
            placeholder. &ldquo;Reset to default&rdquo; clears these fields --
            click Save afterward to persist it.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const inputs = tuningRef.current?.querySelectorAll("input");
              inputs?.forEach((input) => {
                input.value = "";
              });
            }}
          >
            Reset to default
          </Button>
        </div>
        <div ref={tuningRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TUNING_FIELDS.map((field) => (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={`tuning-${field.name}`}
              hint={field.hint}
            >
              <Input
                id={`tuning-${field.name}`}
                name={field.name}
                type="number"
                step={field.step}
                min={field.min}
                max={field.max}
                defaultValue={agent.conversation_settings[field.name] ?? ""}
                placeholder={String(CONVERSATION_SETTING_DEFAULTS[field.name])}
              />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Pronunciation dictionary
        </legend>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Applied to TTS output and used to boost the same terms in STT, so
          &ldquo;Kodexo&rdquo; is both said and heard correctly.
        </p>
        <RepeatableRows
          addLabel="Add term"
          emptyHint="No overrides — every term uses the voice's default pronunciation."
          columns={[
            {
              name: "term",
              kind: "text",
              label: "Written as",
              placeholder: "Kodexo Labs",
            },
            {
              name: "say_as",
              kind: "text",
              label: "Said as",
              placeholder: "Ko-DEX-oh Labs",
            },
          ]}
          initial={agent.pronunciation_dictionary.map((entry) => ({
            term: entry.term,
            say_as: entry.say_as,
          }))}
        />
      </fieldset>
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/* Departments                                                                */
/* -------------------------------------------------------------------------- */

export function DepartmentsForm({
  agentId,
  departments,
}: {
  agentId: string;
  departments: Department[];
}) {
  return (
    <ActionForm
      action={saveDepartments}
      submitLabel="Save departments"
      pendingLabel="Saving…"
    >
      <input type="hidden" name="agent_id" value={agentId} />
      <RepeatableRows
        addLabel="Add department"
        emptyHint="No departments yet — the agent has nowhere to transfer a caller who asks for a human."
        columns={[
          { name: "department_id", kind: "hidden" },
          {
            name: "department_name",
            kind: "text",
            label: "Department",
            placeholder: "Sales",
            width: "sm:w-44",
          },
          {
            name: "transfer_number",
            kind: "text",
            label: "Transfer to",
            placeholder: "+15105550100",
            width: "sm:w-44",
          },
          {
            name: "routing_keywords",
            kind: "text",
            label: "Routing keywords",
            placeholder: "pricing, quote, new project",
          },
        ]}
        initial={departments.map((d) => ({
          department_id: d.department_id,
          department_name: d.department_name,
          transfer_number: d.transfer_number,
          routing_keywords: d.routing_keywords ?? "",
        }))}
      />
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/* Knowledge base                                                             */
/* -------------------------------------------------------------------------- */

export function KnowledgeEntryForm({
  agentId,
  entry,
}: {
  agentId: string;
  entry?: KnowledgeBaseEntry;
}) {
  const suffix = entry?.kb_id ?? "new";
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <ActionForm
        action={saveKnowledgeEntry}
        submitLabel={entry ? "Update entry" : "Add entry"}
        pendingLabel="Saving…"
        footer={
          entry ? (
            <ActionButton
              action={deleteKnowledgeEntry}
              label="Delete"
              variant="danger"
              confirm={`Delete the knowledge base entry "${entry.title}"?`}
              hidden={{ agent_id: agentId, kb_id: entry.kb_id }}
            />
          ) : undefined
        }
      >
        <input type="hidden" name="agent_id" value={agentId} />
        {entry && <input type="hidden" name="kb_id" value={entry.kb_id} />}
        <Field label="Title" htmlFor={`kb-title-${suffix}`} badge="required">
          <Input
            id={`kb-title-${suffix}`}
            name="title"
            defaultValue={entry?.title ?? ""}
            placeholder="What does Kodexo Labs build?"
          />
        </Field>
        <Field
          label="Answer"
          htmlFor={`kb-content-${suffix}`}
          badge="required"
          hint="The agent reads from this when a caller goes off-script, then returns to the flow."
        >
          <Textarea
            id={`kb-content-${suffix}`}
            name="content"
            rows={5}
            defaultValue={entry?.content ?? ""}
          />
        </Field>
      </ActionForm>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Built-in tools                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read-only: these 4 tools are code in `agent-worker/src/worker/tools.py`,
 * not a dashboard entry. Every agent gets all of them automatically, so
 * there's nothing to configure here -- just what each one does and the
 * arguments the model fills in when it decides to call one.
 */
export function BuiltinTools() {
  return (
    <div className="space-y-2">
      {BUILTIN_TOOLS.map((tool) => (
        <details
          key={tool.id}
          className="group rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-medium text-zinc-900 marker:content-none dark:text-zinc-100">
            <span
              aria-hidden
              className="text-zinc-400 transition-transform group-open:rotate-90 dark:text-zinc-500"
            >
              ▸
            </span>
            <span className="font-mono">{tool.name}</span>
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Built in -- every agent
            </span>
          </summary>
          <p className="mt-2 pl-5 text-xs text-zinc-500 dark:text-zinc-400">{tool.description}</p>
          {tool.parameters.length > 0 && (
            <dl className="mt-2 space-y-1 border-t border-zinc-100 pt-2 pl-5 dark:border-zinc-900">
              {tool.parameters.map((param) => (
                <div key={param.name} className="flex flex-wrap gap-x-2 text-xs">
                  <dt className="font-mono text-zinc-600 dark:text-zinc-300">{param.name}</dt>
                  <dd className="text-zinc-500 dark:text-zinc-400">
                    ({param.type}) {param.description}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </details>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tools                                                                      */
/* -------------------------------------------------------------------------- */

export function ToolForm({
  agentId,
  tool,
}: {
  agentId: string;
  tool?: Tool;
}) {
  const suffix = tool?.tool_id ?? "new";
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <ActionForm
        action={saveTool}
        submitLabel={tool ? "Update tool" : "Add tool"}
        pendingLabel="Saving…"
        footer={
          tool ? (
            <ActionButton
              action={deleteTool}
              label="Delete"
              variant="danger"
              confirm={`Delete the tool "${tool.name}"? The agent will stop being able to call it.`}
              hidden={{ agent_id: agentId, tool_id: tool.tool_id }}
            />
          ) : undefined
        }
      >
        <input type="hidden" name="agent_id" value={agentId} />
        {tool && <input type="hidden" name="tool_id" value={tool.tool_id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tool name"
            htmlFor={`tool-name-${suffix}`}
            badge="required"
            hint="Identifier-safe. This is the function name the model calls."
          >
            <Input
              id={`tool-name-${suffix}`}
              name="name"
              defaultValue={tool?.name ?? ""}
              placeholder="book_calendar_slot"
            />
          </Field>
          <Field
            label="n8n webhook URL"
            htmlFor={`tool-webhook-${suffix}`}
            badge="required"
            hint="Called with the tool's arguments as JSON; its response goes back into the conversation."
          >
            <Input
              id={`tool-webhook-${suffix}`}
              name="webhook_url"
              defaultValue={tool?.webhook_url ?? ""}
              placeholder="https://n8n.example.com/webhook/book-slot"
            />
          </Field>
        </div>

        <Field
          label="When to use it"
          htmlFor={`tool-description-${suffix}`}
          badge="required"
          hint="Written for the model, not for a person — this is the only thing it uses to decide whether to call the tool."
        >
          <Textarea
            id={`tool-description-${suffix}`}
            name="description"
            rows={3}
            defaultValue={tool?.description ?? ""}
            placeholder="This description will be used by the model to call the tools, you dont have to mention tools in the agent prompt!"
          />
        </Field>

        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Parameters
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Optional
            </span>
          </label>
          <ToolParameterBuilder
            fieldName="parameter_schema"
            initialSchema={tool?.parameter_schema ?? {}}
          />
        </div>
      </ActionForm>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Danger zone                                                                */
/* -------------------------------------------------------------------------- */

export function DeleteAgentButton({
  agentId,
  agentName,
  hasNumber,
}: {
  agentId: string;
  agentName: string;
  hasNumber: boolean;
}) {
  return (
    <ActionButton
      action={deleteAgent}
      label="Delete agent"
      variant="danger"
      confirm={
        hasNumber
          ? `Delete "${agentName}"? Its phone number stays on the Twilio account but will route to nothing until you assign it to another agent.`
          : `Delete "${agentName}"? Its prompt, departments, knowledge base and tools go with it. Call logs are kept.`
      }
      hidden={{ agent_id: agentId }}
    />
  );
}
