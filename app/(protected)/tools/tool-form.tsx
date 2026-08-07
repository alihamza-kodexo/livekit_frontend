"use client";

import { useState } from "react";

import { saveTool, deleteTool } from "@/app/(protected)/tools/actions";
import { Dropdown } from "@/components/dropdown";
import { ActionButton, ActionForm } from "@/components/form";
import { ToolParameterBuilder } from "@/components/tool-parameter-builder";
import { Field, Input, StaticValue, Textarea } from "@/components/ui";
import type { Tool, ToolType } from "@/lib/types";

const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  function: "Function -- calls your own n8n webhook",
  transfer_call: "Transfer call -- silently transfers to a fixed number",
  record_lead_info: "Record lead info -- captures name/company/need into the call log",
  record_callback_number: "Record callback number -- captures a number to call back",
};

/** Detail pane for one tool in the global library -- either an existing row
 * (`tool` set) or the blank "create" form. Rendered on the right of
 * `ToolsLibraryPanel`'s tool list. Editing here affects every agent that has
 * this tool selected. */
export function ToolForm({ tool }: { tool?: Tool }) {
  const suffix = tool?.tool_id ?? "new";
  // Type is only choosable on create -- an existing tool's shape (webhook vs
  // destination number vs fixed native params) doesn't transform cleanly if
  // you change type after the fact, so it's fixed once created.
  const [toolType, setToolType] = useState<ToolType>(tool?.tool_type ?? "function");

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
      <input type="hidden" name="tool_type" value={toolType} />

      <div className="space-y-5 rounded-lg border border-line bg-canvas-alt p-5">
        <div>
          <h3 className="font-heading text-sm font-semibold text-strong">Tool settings</h3>
          <p className="mt-1 text-xs text-muted">
            What the model sees: the name it calls, and when it should call it.
          </p>
        </div>

        <Field
          label="Tool type"
          htmlFor={`tool-type-${suffix}`}
          badge="required"
          hint="Fixed once created -- delete and recreate the tool if you need a different type."
        >
          {tool ? (
            <StaticValue>{TOOL_TYPE_LABELS[toolType]}</StaticValue>
          ) : (
            <Dropdown
              id={`tool-type-${suffix}`}
              value={toolType}
              onValueChange={(next) => setToolType(next as ToolType)}
              options={(Object.entries(TOOL_TYPE_LABELS) as [ToolType, string][]).map(
                ([value, label]) => ({
                  value,
                  label: label.split(" -- ")[0],
                  description: label.split(" -- ")[1],
                }),
              )}
            />
          )}
        </Field>

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
              placeholder={toolType === "transfer_call" ? "transfer_to_sales" : "book_calendar_slot"}
            />
          </Field>

          {toolType === "function" && (
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
          )}

          {toolType === "transfer_call" && (
            <Field
              label="Destination number"
              htmlFor={`tool-destination-${suffix}`}
              badge="required"
              hint="E.164 format. This tool always transfers to this one number -- create another Transfer call tool for a different destination."
            >
              <Input
                id={`tool-destination-${suffix}`}
                name="destination_number"
                defaultValue={tool?.destination_number ?? ""}
                placeholder="+15105550100"
              />
            </Field>
          )}
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
            placeholder={
              toolType === "transfer_call"
                ? "Transfer the caller to Sales when they want pricing, a quote, or a new project."
                : "This description will be used by the model to call the tools, you dont have to mention tools in the agent prompt!"
            }
          />
        </Field>

        {(toolType === "record_lead_info" || toolType === "record_callback_number") && (
          <p className="rounded-md border border-info-border bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
            {toolType === "record_lead_info"
              ? "Fixed behavior: captures the caller's name, company, need, and qualification answers into this call's log -- not configurable beyond name and description."
              : "Fixed behavior: captures a callback number into this call's log, and into the transfer-failed alert -- not configurable beyond name and description."}
          </p>
        )}
      </div>

      {toolType === "function" && (
        <div className="space-y-4 rounded-lg border border-line bg-canvas-alt p-5">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-semibold text-strong">Parameters</h3>
            <span className="rounded-pill bg-surface px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-faint">
              Optional
            </span>
          </div>
          <ToolParameterBuilder
            fieldName="parameter_schema"
            initialSchema={tool?.parameter_schema ?? {}}
          />
        </div>
      )}
    </ActionForm>
  );
}
