"use server";

import { revalidatePath } from "next/cache";

import { fail, guard, isE164, isIdentifier, ok, optionalStr, str, type ActionState } from "@/lib/forms";
import { db } from "@/lib/supabase";
import { TOOL_TYPES, type ToolType } from "@/lib/types";

/**
 * Tools are a shared library now (see 0014_global_tools.sql) -- creating or
 * editing one here can affect every agent that's selected it, so this
 * revalidates the whole /agents subtree, not just one agent's page.
 */
export async function saveTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
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

    const toolType = str(form, "tool_type") as ToolType;
    if (!TOOL_TYPES.includes(toolType)) return fail("Unknown tool type.");

    // Each type only fills in the columns it actually uses -- e.g. a Transfer
    // call tool has no webhook, a Function tool has no destination number.
    let webhookUrl: string | null = null;
    let destinationNumber: string | null = null;
    let parameterSchema: Record<string, unknown> = {};

    if (toolType === "function") {
      webhookUrl = optionalStr(form, "webhook_url");
      if (!webhookUrl) {
        return fail("Function tools run by calling an n8n webhook, so a webhook URL is required.");
      }
      if (!/^https?:\/\//.test(webhookUrl)) {
        return fail("Webhook URL must start with http:// or https://.");
      }

      // Stored as JSON Schema. Parsed here rather than at call time so a typo
      // surfaces to the admin now, not to a caller mid-conversation.
      const rawSchema = str(form, "parameter_schema") || "{}";
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
    } else if (toolType === "transfer_call") {
      destinationNumber = optionalStr(form, "destination_number");
      if (!destinationNumber || !isE164(destinationNumber)) {
        return fail("Transfer call tools need a destination number in E.164 format, e.g. +15105550100.");
      }
    }
    // record_lead_info / record_callback_number: fixed native behavior, no
    // extra columns beyond name/description.

    const toolId = optionalStr(form, "tool_id");
    const payload = {
      name,
      description,
      tool_type: toolType,
      parameter_schema: parameterSchema,
      webhook_url: webhookUrl,
      destination_number: destinationNumber,
      is_builtin: false,
    };

    const { error } = toolId
      ? await db().from("tools").update(payload).eq("tool_id", toolId)
      : await db().from("tools").insert(payload);

    if (error) return fail(`Could not save tool: ${error.message}`);

    revalidatePath("/tools");
    revalidatePath("/agents/[agentId]", "layout");
    return ok(toolId ? "Tool updated." : "Tool added.");
  });
}

export async function deleteTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const toolId = str(form, "tool_id");
    if (!toolId) return fail("Missing tool id.");

    // agent_tools rows for this tool cascade automatically (see the migration).
    const { error } = await db().from("tools").delete().eq("tool_id", toolId);
    if (error) return fail(`Could not delete tool: ${error.message}`);

    revalidatePath("/tools");
    revalidatePath("/agents/[agentId]", "layout");
    return ok("Tool deleted.");
  });
}
