"use client";

import { useState } from "react";

import { ToolForm } from "@/app/(protected)/tools/tool-form";
import { Button, ToolTypeGlyph } from "@/components/ui";
import { toolTypeMeta } from "@/lib/tool-display";
import type { Tool } from "@/lib/types";

/** Vapi/Retell-style tools screen: every tool in the shared library in a list
 * rail on the left, the selected one's full settings to the right. Agents pick
 * which of these they use from their own Tools tab -- this page only manages
 * the definitions themselves.
 *
 * Styled to match the route-level rails (components/section-sidebar.tsx) so the
 * app reads as one layout, but it isn't one: which tool is selected is local
 * state, not a URL, so this stays a client component inside the page. */
export function ToolsLibraryPanel({ tools }: { tools: Tool[] }) {
  const [selectedId, setSelectedId] = useState<string>(tools[0]?.tool_id ?? "new");
  const selectedTool = tools.find((t) => t.tool_id === selectedId);

  return (
    <div className="flex flex-col lg:flex-row">
      <div className="w-full shrink-0 space-y-3 border-b border-line p-4 lg:w-64 lg:border-b-0 lg:border-r">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => setSelectedId("new")}
        >
          + Create tool
        </Button>

        <div className="space-y-1">
          {tools.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-faint">
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
                aria-current={active ? "true" : undefined}
                onClick={() => setSelectedId(tool.tool_id)}
                className={
                  active
                    ? "flex w-full items-center gap-2.5 rounded-md border border-brand/40 bg-brand-tint px-2.5 py-2 text-left"
                    : "flex w-full items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-canvas-alt"
                }
              >
                <ToolTypeGlyph icon={icon} />
                <span className="min-w-0">
                  <span
                    className={
                      active
                        ? "block truncate font-mono text-sm font-semibold text-brand-deep dark:text-brand"
                        : "block truncate font-mono text-sm font-medium text-body"
                    }
                  >
                    {tool.name}
                  </span>
                  <span className="block truncate text-xs text-faint">{badge}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <ToolForm key={selectedId} tool={selectedTool} />
      </div>
    </div>
  );
}
