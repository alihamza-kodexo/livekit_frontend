"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Dropdown } from "@/components/dropdown";
import { Button, Field, Input } from "@/components/ui";
import { CALL_OUTCOMES } from "@/lib/types";

type Filters = { agent: string; outcome: string; from: string; to: string };

const EMPTY: Filters = { agent: "", outcome: "", from: "", to: "" };

/** The query string these four fields produce. Also used as the identity of a
 * URL, to notice when navigation has caught up with the controls. */
function toQuery(filters: Filters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  // `page` is deliberately not carried over: changing a filter produces a
  // different result set, and page 5 of it probably doesn't exist.
  return query.toString();
}

/**
 * Filters drive the query string, which the page reads server-side — so a
 * filtered view is a shareable URL, and the back button works.
 *
 * Each control applies as soon as it changes; there is no Filter button to
 * press. That costs a navigation per change, which is the right trade here:
 * the result set is one indexed query, and a filter you have to confirm is one
 * people set and then wonder why the table didn't move.
 *
 * The date inputs are safe to treat the same way even though they're typed
 * rather than picked: a native date input reports an empty value until the
 * date is complete, so a half-typed "12/" never triggers a navigation.
 */
export function CallFilters({
  agents,
}: {
  agents: { agent_id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const fromUrl: Filters = {
    agent: params.get("agent") ?? "",
    outcome: params.get("outcome") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };

  // Mirrors the URL, but moves the instant a control changes so the control
  // doesn't visibly snap back to its old value while the navigation is still
  // in flight. The URL stays the source of truth — this just gets there first.
  const [draft, setDraft] = useState(fromUrl);

  // Adjusting state when a prop changes, per the React docs: a Clear, a back
  // button or a shared link arrives as a new query string, and the controls
  // follow it rather than holding whatever was last clicked.
  const [lastQuery, setLastQuery] = useState(toQuery(fromUrl));
  const currentQuery = toQuery(fromUrl);
  if (lastQuery !== currentQuery) {
    setLastQuery(currentQuery);
    setDraft(fromUrl);
  }

  function apply(next: Filters) {
    setDraft(next);
    const query = toQuery(next);
    startTransition(() => router.push(query ? `/calls?${query}` : "/calls"));
  }

  const set = (field: keyof Filters) => (value: string) =>
    apply({ ...draft, [field]: value });

  const isFiltered = Object.values(draft).some(Boolean);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Agent" htmlFor="filter-agent">
        <Dropdown
          id="filter-agent"
          value={draft.agent}
          onValueChange={set("agent")}
          options={[
            { value: "", label: "All agents" },
            ...agents.map((agent) => ({
              value: agent.agent_id,
              label: agent.name,
            })),
          ]}
        />
      </Field>

      <Field label="Outcome" htmlFor="filter-outcome">
        <Dropdown
          id="filter-outcome"
          value={draft.outcome}
          onValueChange={set("outcome")}
          options={[
            { value: "", label: "All outcomes" },
            ...CALL_OUTCOMES.map((outcome) => ({
              value: outcome,
              label: outcome.replace(/_/g, " "),
            })),
          ]}
        />
      </Field>

      <Field label="From" htmlFor="filter-from">
        <Input
          id="filter-from"
          type="date"
          value={draft.from}
          max={draft.to || undefined}
          onChange={(e) => set("from")(e.target.value)}
        />
      </Field>

      <Field label="To" htmlFor="filter-to">
        <Input
          id="filter-to"
          type="date"
          value={draft.to}
          min={draft.from || undefined}
          onChange={(e) => set("to")(e.target.value)}
        />
      </Field>

      {/* Holds the row's height whether or not there's anything to show, so the
          controls above don't shift when Clear appears or the table reloads. */}
      <div className="flex min-h-9 items-end gap-3">
        {isFiltered && (
          <Button type="button" variant="ghost" onClick={() => apply(EMPTY)}>
            Clear
          </Button>
        )}
        {isPending && (
          <span className="pb-2 text-xs text-muted" role="status">
            Updating…
          </span>
        )}
      </div>
    </div>
  );
}
