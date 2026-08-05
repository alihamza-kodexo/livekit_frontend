"use client";

import { useId, useMemo, useState } from "react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";

type ParamType = "string" | "number" | "boolean" | "array";

type ParamRow = {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
};

const TYPE_LABELS: Record<ParamType, string> = {
  string: "Text",
  number: "Number",
  boolean: "Yes / no",
  array: "List of text",
};

function rowsToSchema(rows: ParamRow[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const row of rows) {
    if (!row.name) continue;
    const prop: Record<string, unknown> =
      row.type === "array" ? { type: "array", items: { type: "string" } } : { type: row.type };
    if (row.description) prop.description = row.description;
    properties[row.name] = prop;
    if (row.required) required.push(row.name);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Best-effort parse of a JSON Schema object back into builder rows. Returns
 * null for anything that doesn't round-trip faithfully (nested objects,
 * enums, unsupported keywords, etc.) so a hand-written complex schema is
 * never silently mangled -- it just stays in raw-JSON mode instead.
 */
function schemaToRows(schema: unknown): ParamRow[] | null {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return null;
  const obj = schema as Record<string, unknown>;

  const topAllowed = new Set(["type", "properties", "required"]);
  if (Object.keys(obj).some((k) => !topAllowed.has(k))) return null;
  if (obj.type !== undefined && obj.type !== "object") return null;

  if (obj.properties === undefined) {
    return Object.keys(obj).length === 0 || (obj.type === "object" && obj.properties === undefined)
      ? []
      : null;
  }
  if (typeof obj.properties !== "object" || obj.properties === null || Array.isArray(obj.properties)) {
    return null;
  }

  const requiredList = Array.isArray(obj.required)
    ? obj.required.filter((x): x is string => typeof x === "string")
    : [];

  const rows: ParamRow[] = [];
  for (const [key, value] of Object.entries(obj.properties as Record<string, unknown>)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;

    let type: ParamType;
    if (v.type === "string") type = "string";
    else if (v.type === "number" || v.type === "integer") type = "number";
    else if (v.type === "boolean") type = "boolean";
    else if (v.type === "array") type = "array";
    else return null;

    const allowed = type === "array" ? ["type", "description", "items"] : ["type", "description"];
    if (Object.keys(v).some((k) => !allowed.includes(k))) return null;

    rows.push({
      name: key,
      type,
      description: typeof v.description === "string" ? v.description : "",
      required: requiredList.includes(key),
    });
  }

  return rows;
}

export function ToolParameterBuilder({
  fieldName,
  initialSchema,
}: {
  fieldName: string;
  initialSchema: Record<string, unknown>;
}) {
  const idPrefix = useId();
  const parsedInitial = useMemo(() => schemaToRows(initialSchema), [initialSchema]);

  const [mode, setMode] = useState<"simple" | "advanced">(
    parsedInitial === null ? "advanced" : "simple",
  );
  const [rows, setRows] = useState<ParamRow[]>(parsedInitial ?? []);
  const [rowKeys, setRowKeys] = useState<number[]>(() => (parsedInitial ?? []).map((_, i) => i));
  const [nextKey, setNextKey] = useState((parsedInitial ?? []).length);
  const [rawJson, setRawJson] = useState(() => JSON.stringify(initialSchema ?? {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const compiledValue =
    mode === "simple" ? JSON.stringify(rowsToSchema(rows)) : jsonError === null ? rawJson : rawJson;

  function addRow() {
    setRows((r) => [...r, { name: "", type: "string", description: "", required: false }]);
    setRowKeys((k) => [...k, nextKey]);
    setNextKey((n) => n + 1);
  }

  function updateRow(index: number, patch: Partial<ParamRow>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((r) => r.filter((_, i) => i !== index));
    setRowKeys((k) => k.filter((_, i) => i !== index));
  }

  function switchToAdvanced() {
    setRawJson(JSON.stringify(rowsToSchema(rows), null, 2));
    setJsonError(null);
    setMode("advanced");
  }

  function switchToSimple() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      setJsonError("Fix the JSON error below before switching to the simple builder.");
      return;
    }
    const asRows = schemaToRows(parsed);
    if (asRows === null) {
      setJsonError(
        "This schema is too complex for the simple builder (nested objects, enums, etc.) -- keep editing it as JSON.",
      );
      return;
    }
    setRows(asRows);
    setRowKeys(asRows.map((_, i) => i));
    setNextKey(asRows.length);
    setJsonError(null);
    setMode("simple");
  }

  function handleRawJsonChange(value: string) {
    setRawJson(value);
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setJsonError("Must be a JSON object, e.g. {\"type\": \"object\", \"properties\": {}}.");
      } else {
        setJsonError(null);
      }
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON.");
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={fieldName} value={compiledValue} />

      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "simple" ? "primary" : "secondary"}
          onClick={switchToSimple}
        >
          Simple builder
        </Button>
        <Button
          type="button"
          variant={mode === "advanced" ? "primary" : "secondary"}
          onClick={switchToAdvanced}
        >
          Raw JSON
        </Button>
      </div>

      {mode === "simple" ? (
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No parameters yet -- add one for each piece of information this tool needs, or leave
              empty for a tool that takes none.
            </p>
          )}
          {rows.map((row, index) => {
            const base = `${idPrefix}-${rowKeys[index]}`;
            return (
              <div
                key={rowKeys[index]}
                className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="min-w-40 flex-1">
                  <label
                    htmlFor={`${base}-name`}
                    className={index === 0 ? "mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200" : "sr-only"}
                  >
                    Parameter name
                  </label>
                  <Input
                    id={`${base}-name`}
                    value={row.name}
                    placeholder="date"
                    onChange={(e) => updateRow(index, { name: e.target.value })}
                  />
                </div>
                <div className="w-40">
                  <label
                    htmlFor={`${base}-type`}
                    className={index === 0 ? "mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200" : "sr-only"}
                  >
                    Type
                  </label>
                  <Select
                    id={`${base}-type`}
                    value={row.type}
                    onChange={(e) => updateRow(index, { type: e.target.value as ParamType })}
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="min-w-48 flex-1">
                  <label
                    htmlFor={`${base}-description`}
                    className={index === 0 ? "mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200" : "sr-only"}
                  >
                    What is this for?
                  </label>
                  <Input
                    id={`${base}-description`}
                    value={row.description}
                    placeholder="The date the caller wants to book, e.g. 2026-08-10"
                    onChange={(e) => updateRow(index, { description: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 pb-1.5">
                  <input
                    id={`${base}-required`}
                    type="checkbox"
                    checked={row.required}
                    onChange={(e) => updateRow(index, { required: e.target.checked })}
                    className="size-4 rounded border-zinc-300 dark:border-zinc-600"
                  />
                  <label htmlFor={`${base}-required`} className="text-sm text-zinc-700 dark:text-zinc-300">
                    Required
                  </label>
                </div>
                <Button type="button" variant="secondary" onClick={() => removeRow(index)}>
                  Remove
                </Button>
              </div>
            );
          })}
          <Button type="button" variant="secondary" onClick={addRow}>
            Add parameter
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Field
            label="Parameter schema (JSON Schema)"
            hint="Describes the tool's arguments. Leave as {} for a tool that takes none."
          >
            <Textarea
              rows={10}
              value={rawJson}
              onChange={(e) => handleRawJsonChange(e.target.value)}
              aria-invalid={jsonError !== null}
            />
          </Field>
          {jsonError && (
            <p className="text-sm text-red-600 dark:text-red-400">Invalid JSON: {jsonError}</p>
          )}
        </div>
      )}
    </div>
  );
}
