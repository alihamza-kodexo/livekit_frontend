/**
 * Row types for the Supabase schema in `supabase/migrations/0001_init_schema.sql`.
 *
 * Hand-written rather than generated so the JSONB columns get real shapes
 * instead of `Json`. If you change the migration, change this file too.
 */

export type AgentStatus = "active" | "paused" | "draft";

export const AGENT_STATUSES: AgentStatus[] = ["active", "paused", "draft"];

/**
 * Switchable anytime, no worker redeploy -- see VOICE_STACK_DECISION.md.
 * "gemini_live" is a different shape: a realtime speech-to-speech model that
 * replaces the whole STT+LLM+TTS pipeline, not just the LLM leg -- it gives
 * up the pronunciation dictionary and most tuning knobs below in exchange
 * for lower cost. Groq/DeepSeek keep the pipeline and all of those.
 */
export type LLMProvider = "groq" | "deepseek" | "gemini_live";

export const LLM_PROVIDERS: LLMProvider[] = ["groq", "deepseek", "gemini_live"];

/** How the agent opens a call -- see flow.py's on_enter for what each does. */
export type FirstMessageMode = "agent_generates" | "agent_says_exact" | "user_starts";

export const FIRST_MESSAGE_MODES: FirstMessageMode[] = [
  "agent_generates",
  "agent_says_exact",
  "user_starts",
];

export type CallOutcome =
  | "qualified"
  | "department_transfer"
  | "not_qualified"
  | "transfer_failed"
  | "dropped";

export const CALL_OUTCOMES: CallOutcome[] = [
  "qualified",
  "department_transfer",
  "not_qualified",
  "transfer_failed",
  "dropped",
];

/** One entry in `agents.qualification_criteria`. */
export type QualificationCriterion = {
  /** Stable key the worker uses when reporting what it captured. */
  key: string;
  /** The question the agent should get answered. */
  question: string;
  required: boolean;
};

/** One entry in `agents.pronunciation_dictionary` (FSD 4.1 / FR-07). */
export type PronunciationEntry = {
  /** The written form, e.g. "Kodexo Labs". */
  term: string;
  /** How TTS should say it, e.g. "Ko-DEX-oh Labs". */
  say_as: string;
};

/**
 * `agents.conversation_settings` — the FSD Section 4.3 humanness parameters.
 * Every field is optional in the database; the worker applies its own defaults
 * for anything unset, and `CONVERSATION_SETTING_DEFAULTS` below mirrors those
 * so the dashboard can show an admin what "unset" actually resolves to.
 */
export type ConversationSettings = {
  temperature?: number;
  max_reply_sentences?: number;
  tts_stability?: number;
  speech_rate?: number;
  vad_threshold_ms?: number;
  interruption_sensitivity?: number;
  backchannel_frequency?: number;
};

export const CONVERSATION_SETTING_DEFAULTS: Required<ConversationSettings> = {
  temperature: 0.7,
  max_reply_sentences: 2,
  tts_stability: 0.6,
  speech_rate: 1,
  vad_threshold_ms: 500,
  interruption_sensitivity: 0.5,
  backchannel_frequency: 0.2,
};

/**
 * The 4 tools baked into the worker's Python code (`agent-worker/src/worker/tools.py`).
 * Every agent gets all of them automatically, unconditionally -- there's no
 * dashboard entry that creates them the way custom `Tool` rows work, and
 * nothing here is per-agent configurable. Purely informational display.
 */
export type BuiltinToolId =
  | "transfer_to_department"
  | "record_lead_info"
  | "record_callback_number"
  | "end_call";

export type BuiltinToolInfo = {
  id: BuiltinToolId;
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string }[];
};

/** Mirrors the `@function_tool` definitions in `agent-worker/src/worker/tools.py` --
 * keep this in sync if those signatures or descriptions change. */
export const BUILTIN_TOOLS: BuiltinToolInfo[] = [
  {
    id: "transfer_to_department",
    name: "transfer_to_department",
    description:
      "Silently transfers the caller to a department by name, after the agent has already told the caller out loud. Uses this agent's Departments list to resolve the name to a transfer number.",
    parameters: [
      {
        name: "department_name",
        type: "string",
        description: "Must match a configured department's name.",
      },
    ],
  },
  {
    id: "record_lead_info",
    name: "record_lead_info",
    description:
      "Records what the agent has learned about the caller as the conversation goes -- name, company, what they need, and qualification answers. Called incrementally, not just once at the end.",
    parameters: [
      { name: "lead_name", type: "string (optional)", description: "The caller's name." },
      { name: "lead_company", type: "string (optional)", description: "The caller's company." },
      { name: "lead_need", type: "string (optional)", description: "What they're calling about." },
      {
        name: "qualification_answers",
        type: "object (optional)",
        description: "Answers keyed by this agent's qualification criterion keys.",
      },
    ],
  },
  {
    id: "record_callback_number",
    name: "record_callback_number",
    description:
      "Records a callback number after a failed transfer, or whenever the caller needs to be called back instead.",
    parameters: [
      { name: "callback_number", type: "string", description: "The number to call back." },
    ],
  },
  {
    id: "end_call",
    name: "end_call",
    description:
      "Ends the call after the agent's closing line finishes playing. Every call needs this eventually, or it never hangs up. The hang-up itself can't be customized, but the conditions that tell the model when to call it are editable per agent -- see \"When to end the call\" on the Prompt & qualification tab.",
    parameters: [
      {
        name: "outcome",
        type: "string (optional)",
        description: 'One of the call outcomes, e.g. "not_qualified" or "dropped".',
      },
    ],
  },
];

export type Agent = {
  agent_id: string;
  name: string;
  twilio_number: string | null;
  status: AgentStatus;
  prompt: string;
  first_message_mode: FirstMessageMode;
  /** Only used when first_message_mode is "agent_says_exact". */
  first_message_text: string | null;
  qualification_criteria: QualificationCriterion[];
  stt_provider: string;
  tts_provider: string;
  llm_provider: LLMProvider;
  voice_id: string | null;
  pronunciation_dictionary: PronunciationEntry[];
  conversation_settings: ConversationSettings;
  /** Null means "use the worker's default end-of-call guidance" -- see BuiltinTools' end_call entry. */
  end_call_instructions: string | null;
  /** Free-form reference text for off-topic questions -- exposed to the model
   * as a single on-demand tool rather than concatenated into every turn's
   * prompt, so it only costs tokens on the calls that actually need it. */
  knowledge_base_content: string;
  /** Model-facing summary of what knowledge_base_content covers -- this, not
   * the content itself, is what the model sees to decide whether to look it up. */
  knowledge_base_description: string;
  /** Posted the full call record (transcript, outcome, lead info) once the
   * call ends. Null means "don't send". No recording pipeline exists yet, so
   * the posted payload's recording_url is always null too -- see
   * agent-worker's notify.send_end_call_webhook. */
  end_call_webhook_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Department = {
  department_id: string;
  agent_id: string;
  department_name: string;
  transfer_number: string;
  routing_keywords: string | null;
  created_at: string;
  updated_at: string;
};

/** Global now -- the same tool can be selected by more than one agent via
 * the `agent_tools` join table (see 0014_global_tools.sql), rather than
 * belonging to exactly one. */
export type Tool = {
  tool_id: string;
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments, passed to DeepSeek function calling. */
  parameter_schema: Record<string, unknown>;
  webhook_url: string | null;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
};

/** One row of the `agent_tools` join table -- which global tool an agent has selected. */
export type AgentToolLink = {
  agent_id: string;
  tool_id: string;
  created_at: string;
};

export type CallLog = {
  call_log_id: string;
  call_sid: string | null;
  room_id: string | null;
  agent_id: string | null;
  caller_number: string | null;
  transcript: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  outcome: CallOutcome | null;
  matched_department: string | null;
  lead_name: string | null;
  lead_company: string | null;
  lead_need: string | null;
  /** True for a dashboard "Test agent" browser session -- no phone number or Twilio call involved. */
  is_test: boolean;
  created_at: string;
};

/** The login allowlist -- see supabase/migrations/0003_allowed_users.sql. */
export type AllowedUser = {
  email: string;
  created_at: string;
};

/**
 * A number connected from a customer's own Twilio account -- see
 * supabase/migrations/0010_external_numbers.sql. `account_sid`/`auth_token`
 * are that Twilio account's credentials, kept so the number can later be
 * disconnected (detached from the trunk this row created for it).
 */
export type ExternalNumber = {
  external_number_id: string;
  phone_number: string;
  friendly_name: string;
  account_sid: string;
  auth_token: string;
  number_sid: string;
  trunk_sid: string;
  created_at: string;
};
