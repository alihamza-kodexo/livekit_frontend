"use client";

import { useState, type ReactNode } from "react";

export type TabDef = {
  key: string;
  label: string;
  content: ReactNode;
};

/**
 * Tab panels stay mounted (just visually hidden via `hidden`) rather than
 * unmounting on switch -- so typing into one section's form, then checking
 * another tab, doesn't lose anything that hasn't been saved yet.
 */
export function Tabs({
  tabs,
  defaultTab,
  stickyTop,
}: {
  tabs: TabDef[];
  /** Which tab starts selected. Falls back to the first tab if it doesn't match any key. */
  defaultTab?: string;
  /** Raw CSS `top` value/expression to stick the tab bar under something above it (e.g. a page header stacked via StickyBand). Omit for normal (non-sticky) flow. */
  stickyTop?: string;
}) {
  const [active, setActive] = useState(
    tabs.some((tab) => tab.key === defaultTab) ? defaultTab : tabs[0]?.key,
  );

  return (
    <div>
      <div
        role="tablist"
        className="z-10 flex gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
        style={stickyTop ? { position: "sticky", top: stickyTop } : undefined}
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={
                selected
                  ? "shrink-0 border-b-2 border-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="pt-6">
        {tabs.map((tab) => (
          <div key={tab.key} hidden={tab.key !== active} className="space-y-6">
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
