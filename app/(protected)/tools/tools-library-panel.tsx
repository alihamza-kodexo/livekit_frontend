"use client";

import { useState } from "react";

import { ToolForm } from "@/app/(protected)/tools/tool-form";
import { Button } from "@/components/ui";
import { toolTypeMeta } from "@/lib/tool-display";
import type { Tool } from "@/lib/types";

/** Vapi/Retell-style tools screen: every tool in the shared library on the
 * left, the selected one's full settings on the right. Agents pick which of
 * these they use from their own Tools tab -- this page only manages the
 * definitions themselves. */
export function ToolsLibraryPanel({ tools }: { tools: Tool[] }) {
  const [selectedId, setSelectedId] = useState<string>(tools[0]?.tool_id ?? "new");
  const selectedTool = tools.find((t) => t.tool_id === selectedId);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="w-full shrink-0 space-y-1 lg:w-56">
        <Button
          type="button"
          variant="secondary"
          className="w-full justify-center"
          onClick={() => setSelectedId("new")}
        >
          + Create tool
        </Button>

        <div className="space-y-1 pt-1">
          {tools.length === 0 && (
            <p className="px-2.5 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No tools yet.
            </p>
          )}
          {tools.map((tool) => {
            const active = tool.tool_id === selectedId;
            const { icon, badge } = toolTypeMeta(tool);
            return (
              <button
                key={tool.tool_id}
                type="button"
                onClick={() => setSelectedId(tool.tool_id)}
                className={
                  active
                    ? "flex w-full items-center gap-2 rounded-md bg-zinc-900 px-2.5 py-2 text-left dark:bg-zinc-100"
                    : "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }
              >
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white"
                >
                  {icon}
                </span>
                <span className="min-w-0">
                  <span
                    className={
                      active
                        ? "block truncate text-sm font-medium text-white dark:text-zinc-900"
                        : "block truncate text-sm font-medium text-zinc-800 dark:text-zinc-200"
                    }
                  >
                    {tool.name}
                  </span>
                  <span
                    className={
                      active
                        ? "block truncate text-xs text-zinc-300 dark:text-zinc-600"
                        : "block truncate text-xs text-zinc-500 dark:text-zinc-400"
                    }
                  >
                    {badge}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <ToolForm key={selectedId} tool={selectedTool} />
      </div>
    </div>
  );
}
