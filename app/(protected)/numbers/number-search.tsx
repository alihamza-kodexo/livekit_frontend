"use client";

import { useActionState } from "react";

import {
  buyNumber,
  searchNumbers,
  type SearchState,
} from "@/app/(protected)/numbers/actions";
import { ActionMessage } from "@/components/form";
import {
  Badge,
  Button,
  Field,
  Input,
  Mono,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { IDLE } from "@/lib/forms";

export type AgentOption = { agent_id: string; name: string };

/**
 * Search Twilio's inventory, then buy one of the results.
 *
 * Purchase is a separate form per row rather than a radio-and-submit, so the
 * confirmation names the exact number being bought — this step costs money and
 * is only undone by releasing the number.
 */
export function NumberSearch({ agents }: { agents: AgentOption[] }) {
  // Explicit state type: the search action carries its results back on the
  // action state, which the default inference from `IDLE` would widen away.
  const [search, searchAction, searching] = useActionState<
    SearchState,
    FormData
  >(searchNumbers, IDLE);
  const [purchase, purchaseAction, purchasing] = useActionState(
    buyNumber,
    IDLE,
  );

  return (
    <div className="space-y-5">
      <form action={searchAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Country" htmlFor="search-country" hint="ISO code">
            <Input
              id="search-country"
              name="country"
              defaultValue={search.query?.country ?? "US"}
              maxLength={2}
              className="uppercase"
            />
          </Field>
          <Field label="Area code" htmlFor="search-area-code" hint="US/CA only">
            <Input
              id="search-area-code"
              name="area_code"
              inputMode="numeric"
              defaultValue={search.query?.areaCode ?? ""}
              placeholder="510"
            />
          </Field>
          <Field
            label="Contains"
            htmlFor="search-contains"
            hint="Digits or letters, * as a wildcard"
          >
            <Input
              id="search-contains"
              name="contains"
              defaultValue={search.query?.contains ?? ""}
              placeholder="555*"
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={searching}>
              {searching ? "Searching…" : "Search Twilio"}
            </Button>
          </div>
        </div>
        <ActionMessage state={search} />
      </form>

      {search.results && search.results.length > 0 && (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Location</Th>
                <Th>Assign to</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {search.results.map((result) => (
                <tr key={result.phoneNumber}>
                  <Td>
                    <Mono>{result.friendlyName}</Mono>
                    {result.addressRequired && (
                      <span className="ml-2">
                        <Badge tone="amber">address required</Badge>
                      </span>
                    )}
                  </Td>
                  <Td className="text-zinc-500 dark:text-zinc-400">
                    {[result.locality, result.region, result.isoCountry]
                      .filter(Boolean)
                      .join(", ")}
                  </Td>
                  <Td colSpan={2}>
                    {/* One form per row: the hidden number is what gets bought. */}
                    <form
                      action={purchaseAction}
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            `Buy ${result.phoneNumber}? This charges the Twilio account immediately, ` +
                              `and the only way to undo it is to release the number.`,
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input
                        type="hidden"
                        name="phone_number"
                        value={result.phoneNumber}
                      />
                      <Select
                        name="agent_id"
                        defaultValue=""
                        aria-label={`Agent for ${result.phoneNumber}`}
                        className="sm:w-52"
                      >
                        <option value="">Leave unassigned</option>
                        {agents.map((agent) => (
                          <option key={agent.agent_id} value={agent.agent_id}>
                            {agent.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="submit"
                        disabled={purchasing || result.addressRequired}
                        title={
                          result.addressRequired
                            ? "Twilio requires a verified address on the account for this number."
                            : undefined
                        }
                      >
                        {purchasing ? "Buying…" : "Buy & attach"}
                      </Button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <ActionMessage state={purchase} />
        </>
      )}
    </div>
  );
}
