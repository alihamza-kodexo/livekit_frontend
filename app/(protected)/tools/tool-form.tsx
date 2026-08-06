"use client";

import { saveTool, deleteTool } from "@/app/(protected)/tools/actions";
import { ActionButton, ActionForm } from "@/components/form";
import { ToolParameterBuilder } from "@/components/tool-parameter-builder";
import { Field, Input, Textarea } from "@/components/ui";
import type { Tool } from "@/lib/types";

/** Detail pane for one tool in the global library -- either an existing row
 * (`tool` set) or the blank "create" form. Rendered on the right of
 * `ToolsLibraryPanel`'s tool list. Editing here affects every agent that has
 * this tool selected. */
export function ToolForm({ tool }: { tool?: Tool }) {
  const suffix = tool?.tool_id ?? "new";

  return (
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
            confirm={`Delete the tool "${tool.name}"? Every agent that has it selected will stop being able to call it.`}
            hidden={{ tool_id: tool.tool_id }}
          />
        ) : undefined
      }
    >
      {tool && <input type="hidden" name="tool_id" value={tool.tool_id} />}

      <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tool settings</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Configure the basic settings for this tool.
          </p>
        </div>

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
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Parameters</h3>
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Optional
          </span>
        </div>
        <ToolParameterBuilder
          fieldName="parameter_schema"
          initialSchema={tool?.parameter_schema ?? {}}
        />
      </div>
    </ActionForm>
  );
}
