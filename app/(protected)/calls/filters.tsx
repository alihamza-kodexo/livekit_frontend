"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button, Field, Select } from "@/components/ui";
import { CALL_OUTCOMES } from "@/lib/types";

/**
 * Filters drive the query string, which the page reads server-side — so a
 * filtered view is a shareable URL, and the back button works.
 */
export function CallFilters({
  agents,
}: {
  agents: { agent_id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(form: FormData) {
    const next = new URLSearchParams();
    for (const key of ["agent", "outcome", "from", "to"]) {
      const value = form.get(key);
      if (typeof value === "string" && value !== "") next.set(key, value);
    }
    const query = next.toString();
    router.push(query ? `/calls?${query}` : "/calls");
  }

  return (
    <form action={apply} className="grid gap-4 sm:grid-cols-5">
      <Field label="Agent" htmlFor="filter-agent">
        <Select
          id="filter-agent"
          name="agent"
          defaultValue={params.get("agent") ?? ""}
        >
          <option value="">All agents</option>
          {agents.map((agent) => (
            <option key={agent.agent_id} value={agent.agent_id}>
              {agent.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Outcome" htmlFor="filter-outcome">
        <Select
          id="filter-outcome"
          name="outcome"
          defaultValue={params.get("outcome") ?? ""}
        >
          <option value="">All outcomes</option>
          {CALL_OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcome.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="From" htmlFor="filter-from">
        <input
          id="filter-from"
          name="from"
          type="date"
          defaultValue={params.get("from") ?? ""}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </Field>

      <Field label="To" htmlFor="filter-to">
        <input
          id="filter-to"
          name="to"
          type="date"
          defaultValue={params.get("to") ?? ""}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </Field>

      <div className="flex items-end gap-2">
        <Button type="submit">Filter</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/calls")}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
