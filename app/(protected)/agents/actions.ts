"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  fail,
  guard,
  isE164,
  isIdentifier,
  num,
  ok,
  optionalStr,
  rows,
  str,
  type ActionState,
} from "@/lib/forms";
import { db } from "@/lib/supabase";
import type {
  AgentStatus,
  ConversationSettings,
  FirstMessageMode,
  LLMProvider,
  PronunciationEntry,
  QualificationCriterion,
} from "@/lib/types";
import { AGENT_STATUSES, FIRST_MESSAGE_MODES, LLM_PROVIDERS } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Create / delete                                                            */
/* -------------------------------------------------------------------------- */

export async function createAgent(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const name = str(form, "name");
    if (!name) return fail("Give the agent a name.");

    const { data, error } = await db()
      .from("agents")
      .insert({
        name,
        prompt: str(form, "prompt"),
        // New agents start as drafts so an unfinished prompt can't take a live
        // call the moment a number gets attached.
        status: "draft",
      })
      .select("agent_id")
      .single();

    if (error) return fail(`Could not create agent: ${error.message}`);

    revalidatePath("/agents");
    redirect(`/agents/${(data as { agent_id: string }).agent_id}`);
  });
}

export async function deleteAgent(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    // Departments, knowledge base rows and tools cascade (see the migration).
    // call_logs deliberately do not — they're set to null so call history
    // survives deleting the agent that handled it.
    const { error } = await db().from("agents").delete().eq("agent_id", agentId);
    if (error) return fail(`Could not delete agent: ${error.message}`);

    revalidatePath("/agents");
    redirect("/agents");
  });
}

/* -------------------------------------------------------------------------- */
/* Core config: prompt, persona, status, qualification                        */
/* -------------------------------------------------------------------------- */

export async function updateAgentCore(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    const name = str(form, "name");
    if (!name) return fail("Name can't be empty.");

    const status = str(form, "status") as AgentStatus;
    if (!AGENT_STATUSES.includes(status)) return fail("Unknown status.");

    const prompt = str(form, "prompt");
    if (status === "active" && !prompt) {
      return fail("An active agent needs a prompt — it has nothing to say yet.");
    }

    const firstMessageMode = str(form, "first_message_mode") as FirstMessageMode;
    if (!FIRST_MESSAGE_MODES.includes(firstMessageMode)) {
      return fail("Unknown first-message mode.");
    }
    const firstMessageText = optionalStr(form, "first_message_text");
    if (firstMessageMode === "agent_says_exact" && !firstMessageText) {
      return fail(
        'The "agent says this exact line" opening needs the line to actually say.',
      );
    }

    const criteria: QualificationCriterion[] = [];
    for (const row of rows(form, [
      "criterion_key",
      "criterion_question",
      "criterion_required",
    ] as const)) {
      // A row with neither field filled in is an empty template row.
      if (!row.criterion_key && !row.criterion_question) continue;
      if (!isIdentifier(row.criterion_key)) {
        return fail(
          `Qualification key "${row.criterion_key}" must be letters, digits and underscores, starting with a letter.`,
        );
      }
      if (!row.criterion_question) {
        return fail(`Qualification "${row.criterion_key}" needs a question.`);
      }
      criteria.push({
        key: row.criterion_key,
        question: row.criterion_question,
        // Checkbox groups collapse when unchecked, so the required flag rides
        // along as an explicit "true"/"false" hidden value per row.
        required: row.criterion_required === "true",
      });
    }

    const duplicate = criteria
      .map((c) => c.key)
      .find((key, i, all) => all.indexOf(key) !== i);
    if (duplicate) return fail(`Duplicate qualification key "${duplicate}".`);

    const { error } = await db()
      .from("agents")
      .update({
        name,
        status,
        prompt,
        first_message_mode: firstMessageMode,
        first_message_text: firstMessageText,
        qualification_criteria: criteria,
        end_call_instructions: optionalStr(form, "end_call_instructions"),
      })
      .eq("agent_id", agentId);

    if (error) return fail(`Could not save: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    revalidatePath("/agents");
    return ok("Saved.");
  });
}

/* -------------------------------------------------------------------------- */
/* Voice & humanness (FSD Section 4)                                          */
/* -------------------------------------------------------------------------- */

const CONVERSATION_FIELDS = [
  "temperature",
  "max_reply_sentences",
  "tts_stability",
  "speech_rate",
  "vad_threshold_ms",
  "interruption_sensitivity",
  "backchannel_frequency",
] as const;

/** Accepted ranges for the Section 4.3 tuning parameters. */
const CONVERSATION_RANGES: Record<
  (typeof CONVERSATION_FIELDS)[number],
  [number, number]
> = {
  temperature: [0, 2],
  max_reply_sentences: [1, 10],
  tts_stability: [0, 1],
  speech_rate: [0.5, 2],
  vad_threshold_ms: [100, 3000],
  interruption_sensitivity: [0, 1],
  backchannel_frequency: [0, 1],
};

export async function updateAgentVoice(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    const llmProvider = str(form, "llm_provider") as LLMProvider;
    if (!LLM_PROVIDERS.includes(llmProvider)) return fail("Unknown LLM provider.");

    const settings: ConversationSettings = {};
    for (const field of CONVERSATION_FIELDS) {
      const value = num(form, field);
      if (value === null) continue; // Left blank: fall back to the worker default.
      const [min, max] = CONVERSATION_RANGES[field];
      if (value < min || value > max) {
        return fail(
          `${field.replace(/_/g, " ")} must be between ${min} and ${max}.`,
        );
      }
      settings[field] = value;
    }

    const dictionary: PronunciationEntry[] = [];
    for (const row of rows(form, ["term", "say_as"] as const)) {
      if (!row.term && !row.say_as) continue;
      if (!row.term || !row.say_as) {
        return fail("Each pronunciation entry needs both a term and a spoken form.");
      }
      dictionary.push({ term: row.term, say_as: row.say_as });
    }

    const { error } = await db()
      .from("agents")
      .update({
        stt_provider: str(form, "stt_provider") || "deepgram",
        tts_provider: str(form, "tts_provider") || "deepgram",
        llm_provider: llmProvider,
        voice_id: optionalStr(form, "voice_id"),
        pronunciation_dictionary: dictionary,
        conversation_settings: settings,
      })
      .eq("agent_id", agentId);

    if (error) return fail(`Could not save: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok("Saved.");
  });
}

/* -------------------------------------------------------------------------- */
/* Departments (the transfer directory)                                       */
/* -------------------------------------------------------------------------- */

export async function saveDepartments(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    const parsed: {
      department_id: string | null;
      department_name: string;
      transfer_number: string;
      routing_keywords: string | null;
    }[] = [];

    for (const row of rows(form, [
      "department_id",
      "department_name",
      "transfer_number",
      "routing_keywords",
    ] as const)) {
      if (!row.department_name && !row.transfer_number) continue;
      if (!row.department_name) return fail("Each department needs a name.");
      if (!isE164(row.transfer_number)) {
        return fail(
          `"${row.department_name}" needs a transfer number in E.164 format, e.g. +15105550100.`,
        );
      }
      parsed.push({
        department_id: row.department_id || null,
        department_name: row.department_name,
        transfer_number: row.transfer_number,
        routing_keywords: row.routing_keywords || null,
      });
    }

    const existing = (await db()
      .from("departments")
      .select("department_id")
      .eq("agent_id", agentId)) as {
      data: { department_id: string }[] | null;
      error: { message: string } | null;
    };
    if (existing.error) return fail(`Could not load departments: ${existing.error.message}`);

    const kept = new Set(
      parsed.map((p) => p.department_id).filter((id): id is string => !!id),
    );
    const removed = (existing.data ?? [])
      .map((d) => d.department_id)
      .filter((id) => !kept.has(id));

    if (removed.length > 0) {
      const { error } = await db()
        .from("departments")
        .delete()
        .in("department_id", removed);
      if (error) return fail(`Could not remove department: ${error.message}`);
    }

    for (const row of parsed) {
      const payload = {
        agent_id: agentId,
        department_name: row.department_name,
        transfer_number: row.transfer_number,
        routing_keywords: row.routing_keywords,
      };
      const { error } = row.department_id
        ? await db()
            .from("departments")
            .update(payload)
            .eq("department_id", row.department_id)
        : await db().from("departments").insert(payload);
      if (error) return fail(`Could not save "${row.department_name}": ${error.message}`);
    }

    revalidatePath(`/agents/${agentId}`);
    return ok("Departments saved.");
  });
}

/* -------------------------------------------------------------------------- */
/* Knowledge base                                                             */
/* -------------------------------------------------------------------------- */

export async function saveKnowledgeEntry(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    const title = str(form, "title");
    const content = str(form, "content");
    if (!agentId) return fail("Missing agent id.");
    if (!title) return fail("Give the entry a title.");
    if (!content) return fail("Give the entry some content.");

    const kbId = optionalStr(form, "kb_id");
    const { error } = kbId
      ? await db().from("knowledge_base").update({ title, content }).eq("kb_id", kbId)
      : await db().from("knowledge_base").insert({ agent_id: agentId, title, content });

    if (error) return fail(`Could not save entry: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok(kbId ? "Entry updated." : "Entry added.");
  });
}

export async function deleteKnowledgeEntry(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    const kbId = str(form, "kb_id");
    if (!kbId) return fail("Missing entry id.");

    const { error } = await db().from("knowledge_base").delete().eq("kb_id", kbId);
    if (error) return fail(`Could not delete entry: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok("Entry deleted.");
  });
}

/* -------------------------------------------------------------------------- */
/* Tools (Project Plan v2 — Vapi-style tools framework)                       */
/* -------------------------------------------------------------------------- */

export async function saveTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    const name = str(form, "name");
    if (!isIdentifier(name)) {
      return fail(
        "Tool name must be letters, digits and underscores, starting with a letter — it's passed straight to the model's function-calling interface.",
      );
    }

    const description = str(form, "description");
    if (!description) {
      return fail("Describe when the agent should use this tool — the model reads this to decide.");
    }

    const webhookUrl = optionalStr(form, "webhook_url");
    if (!webhookUrl) {
      return fail(
        "Custom tools run by calling an n8n webhook, so a webhook URL is required.",
      );
    }
    if (!/^https?:\/\//.test(webhookUrl)) {
      return fail("Webhook URL must start with http:// or https://.");
    }

    // Stored as JSON Schema. Parsed here rather than at call time so a typo
    // surfaces to the admin now, not to a caller mid-conversation.
    const rawSchema = str(form, "parameter_schema") || "{}";
    let parameterSchema: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawSchema);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return fail("Parameter schema must be a JSON object.");
      }
      parameterSchema = parsed as Record<string, unknown>;
    } catch (error) {
      return fail(
        `Parameter schema isn't valid JSON: ${error instanceof Error ? error.message : "parse error"}`,
      );
    }

    const toolId = optionalStr(form, "tool_id");
    const payload = {
      agent_id: agentId,
      name,
      description,
      parameter_schema: parameterSchema,
      webhook_url: webhookUrl,
      is_builtin: false,
    };

    const { error } = toolId
      ? await db().from("tools").update(payload).eq("tool_id", toolId)
      : await db().from("tools").insert(payload);

    if (error) return fail(`Could not save tool: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok(toolId ? "Tool updated." : "Tool added.");
  });
}

export async function deleteTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    const toolId = str(form, "tool_id");
    if (!toolId) return fail("Missing tool id.");

    const { error } = await db().from("tools").delete().eq("tool_id", toolId);
    if (error) return fail(`Could not delete tool: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok("Tool deleted.");
  });
}
