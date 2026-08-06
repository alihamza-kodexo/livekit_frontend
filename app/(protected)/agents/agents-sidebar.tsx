"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { AgentStatusBadge, Input } from "@/components/ui";
import type { AgentListItem } from "@/lib/queries";

/**
 * Always-visible agent picker, like Vapi's assistants list -- pick one here,
 * its config loads on the right without losing your place in the list.
 */
export function AgentsSidebar({ agents }: { agents: AgentListItem[] }) {
  const pathname = usePathname();
  const currentAgentId = pathname.match(/^\/agents\/([^/]+)/)?.[1];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(term));
  }, [agents, search]);

  return (
    <aside className="w-full shrink-0 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-[calc(var(--nav-h,4rem)+1rem)] lg:w-52 lg:self-start">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Agents <span className="font-normal text-zinc-400">{agents.length}</span>
        </h2>
        <Link
          href="/agents"
          className="rounded-md border border-blue-600/30 bg-blue-600/10 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-600/20 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-400 dark:hover:bg-blue-400/20"
        >
          + New
        </Link>
      </div>

      <Input
        type="search"
        placeholder="Search agents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search agents"
      />

      <nav className="max-h-[calc(100vh-13rem)] space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No agents match &ldquo;{search}&rdquo;.
          </p>
        ) : (
          filtered.map((agent) => {
            const active = agent.agent_id === currentAgentId;
            return (
              <Link
                key={agent.agent_id}
                href={`/agents/${agent.agent_id}`}
                className={
                  active
                    ? "block rounded-md bg-zinc-900 px-2.5 py-1.5 dark:bg-zinc-100"
                    : "block rounded-md px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      active
                        ? "truncate text-sm font-medium text-white dark:text-zinc-900"
                        : "truncate text-sm font-medium text-zinc-800 dark:text-zinc-200"
                    }
                  >
                    {agent.name}
                  </span>
                  <AgentStatusBadge status={agent.status} />
                </div>
                <div
                  className={
                    active
                      ? "mt-0.5 truncate text-xs text-zinc-300 dark:text-zinc-600"
                      : "mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400"
                  }
                >
                  {agent.stt_provider} · {agent.llm_provider} · {agent.tts_provider}
                </div>
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
