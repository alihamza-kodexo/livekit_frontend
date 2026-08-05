"use server";

import { revalidatePath } from "next/cache";

import {
  fail,
  guard,
  isE164,
  num,
  ok,
  optionalStr,
  str,
  type ActionState,
} from "@/lib/forms";
import { removeNumberFromTrunks, syncNumberOntoTrunks } from "@/lib/livekit";
import { db } from "@/lib/supabase";
import {
  attachToSharedTrunk,
  connectExternalNumber,
  detachFromSharedTrunk,
  disconnectExternalNumber,
  purchaseNumber,
  releaseNumber,
  searchAvailableNumbers,
  type AvailableNumber,
} from "@/lib/twilio";
import { integrationStatus } from "@/lib/env";

/** Twilio Account SIDs are always "AC" followed by 32 hex characters. */
const TWILIO_ACCOUNT_SID = /^AC[a-f0-9]{32}$/i;

/** Search results are returned to the client rather than persisted anywhere. */
export type SearchState = ActionState & {
  results?: AvailableNumber[];
  /** Echoed back so the form keeps showing what was searched for. */
  query?: { country: string; areaCode: string; contains: string };
};

export async function searchNumbers(
  _prev: SearchState,
  form: FormData,
): Promise<SearchState> {
  const country = (str(form, "country") || "US").toUpperCase();
  const areaCodeRaw = str(form, "area_code");
  const contains = str(form, "contains");
  const query = { country, areaCode: areaCodeRaw, contains };

  const result = await guard<SearchState>(async () => {
    if (!/^[A-Z]{2}$/.test(country)) {
      return fail("Country must be a two-letter ISO code, e.g. US or GB.");
    }
    const areaCode = num(form, "area_code");
    if (areaCodeRaw && areaCode === null) {
      return fail("Area code must be a number.");
    }

    const results = await searchAvailableNumbers({
      country,
      ...(areaCode !== null ? { areaCode } : {}),
      ...(contains ? { contains } : {}),
    });

    if (results.length === 0) {
      return fail("Twilio has nothing matching that search. Try a wider filter.");
    }
    return { ...ok(`${results.length} available.`), results };
  });

  return { ...result, query };
}

/**
 * Buys a number, puts it on the shared SIP trunk, and optionally assigns it to
 * an agent — the "add a new number" path.
 *
 * This spends money on the Twilio account, so the UI gates it behind an explicit
 * per-number confirmation.
 */
export async function buyNumber(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const phoneNumber = str(form, "phone_number");
    if (!isE164(phoneNumber)) {
      return fail("Expected an E.164 number like +15105550100.");
    }

    const agentId = optionalStr(form, "agent_id");
    const label = str(form, "friendly_name") || `Kodexo voice ${phoneNumber}`;

    const purchased = await purchaseNumber(phoneNumber, label);

    if (!purchased.onSharedTrunk) {
      // Twilio accepted the purchase but didn't route it to the trunk. The
      // number is now billable, so say so plainly instead of reporting success.
      return fail(
        `Bought ${phoneNumber}, but it did not attach to the shared SIP trunk. ` +
          `It is on the account and billable — attach it below before using it.`,
      );
    }

    // Only matters for trunks locked to an explicit DID allowlist; a catch-all
    // trunk needs no LiveKit change at all.
    if (integrationStatus().livekit) {
      await syncNumberOntoTrunks(phoneNumber);
    }

    if (agentId) {
      const assigned = await assignNumberToAgent(agentId, phoneNumber);
      if (assigned.status === "error") {
        return fail(
          `Bought and attached ${phoneNumber}, but couldn't assign it: ${assigned.message}`,
        );
      }
    }

    revalidatePath("/numbers");
    revalidatePath("/agents");
    return ok(
      agentId
        ? `Bought ${phoneNumber} and assigned it.`
        : `Bought ${phoneNumber}. Assign it to an agent to start taking calls.`,
    );
  });
}

/**
 * Connects a number from a customer's own Twilio account -- the "bring your
 * own Twilio" path, alongside buying one on the platform's account above.
 *
 * Nothing is charged here: the number is already theirs. This creates a
 * dedicated trunk in *their* account pointed at the same LiveKit endpoint and
 * moves their number onto it, then records the connection in Supabase, since
 * Twilio has no cross-account listing to rediscover it from later.
 */
export async function connectNumber(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const accountSid = str(form, "account_sid");
    const authToken = str(form, "auth_token");
    const phoneNumber = str(form, "phone_number");
    const friendlyName = str(form, "friendly_name");
    const agentId = optionalStr(form, "agent_id");

    if (!TWILIO_ACCOUNT_SID.test(accountSid)) {
      return fail('Account SID should look like "AC" followed by 32 characters.');
    }
    if (!authToken) return fail("Auth Token is required.");
    if (!isE164(phoneNumber)) {
      return fail("Expected an E.164 number like +15105550100.");
    }

    const connected = await connectExternalNumber({
      accountSid,
      authToken,
      phoneNumber,
      friendlyName: friendlyName || `Kodexo voice ${phoneNumber}`,
    });

    const { error } = await db().from("external_numbers").insert({
      phone_number: connected.phoneNumber,
      friendly_name: connected.friendlyName,
      account_sid: accountSid,
      auth_token: authToken,
      number_sid: connected.sid,
      trunk_sid: connected.trunkSid,
    });
    if (error) {
      // The Twilio side already succeeded -- say so plainly rather than
      // reporting failure for a number that's actually live and billable.
      return fail(
        `Connected ${phoneNumber} on Twilio, but couldn't save it here: ` +
          `${error.message}. It's routing to LiveKit either way.`,
      );
    }

    if (agentId) {
      const assigned = await assignNumberToAgent(agentId, phoneNumber);
      if (assigned.status === "error") {
        return fail(
          `Connected ${phoneNumber}, but couldn't assign it: ${assigned.message}`,
        );
      }
    }

    revalidatePath("/numbers");
    revalidatePath("/agents");
    return ok(
      agentId
        ? `Connected ${phoneNumber} and assigned it.`
        : `Connected ${phoneNumber}. Assign it to an agent to start taking calls.`,
    );
  });
}

/**
 * Undoes connectNumber: detaches the number from the trunk it was given (in
 * the customer's own account) and forgets the connection here. The customer
 * keeps the number -- there is no "release" for a number we never owned.
 *
 * Only takes the row ID from the form, not the stored credentials -- those
 * are looked up here, server-side, so the Auth Token never has to round-trip
 * through a hidden field in the rendered page.
 */
export async function disconnectExternalNumberAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const externalNumberId = str(form, "external_number_id");
    if (!externalNumberId) return fail("Missing number ID.");

    const { data: row, error: fetchError } = await db()
      .from("external_numbers")
      .select("*")
      .eq("external_number_id", externalNumberId)
      .maybeSingle();
    if (fetchError) return fail(fetchError.message);
    if (!row) return fail("That connection no longer exists.");

    await disconnectExternalNumber({
      accountSid: row.account_sid,
      authToken: row.auth_token,
      numberSid: row.number_sid,
      trunkSid: row.trunk_sid,
    });

    const { error: clearError } = await db()
      .from("agents")
      .update({ twilio_number: null })
      .eq("twilio_number", row.phone_number);
    if (clearError) {
      return fail(
        `Disconnected ${row.phone_number}, but couldn't clear its agent assignment: ${clearError.message}`,
      );
    }

    const { error } = await db()
      .from("external_numbers")
      .delete()
      .eq("external_number_id", externalNumberId);
    if (error) return fail(`Disconnected on Twilio, but couldn't remove the row: ${error.message}`);

    revalidatePath("/numbers");
    revalidatePath("/agents");
    return ok(`${row.phone_number} no longer routes to LiveKit.`);
  });
}

/**
 * Points a number at an agent. This is the routing decision: the worker resolves
 * the dialed number against `agents.twilio_number`, so this row *is* the
 * telephony config — nothing changes on the Twilio side.
 */
async function assignNumberToAgent(
  agentId: string,
  phoneNumber: string | null,
): Promise<ActionState> {
  // `agents.twilio_number` is unique, so a number has to be cleared from its
  // previous owner before it can move — otherwise the update hits a constraint.
  if (phoneNumber) {
    const { error } = await db()
      .from("agents")
      .update({ twilio_number: null })
      .eq("twilio_number", phoneNumber)
      .neq("agent_id", agentId);
    if (error) return fail(`Could not release the previous assignment: ${error.message}`);
  }

  const { error } = await db()
    .from("agents")
    .update({ twilio_number: phoneNumber })
    .eq("agent_id", agentId);
  if (error) return fail(error.message);

  return ok();
}

export async function assignNumber(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const phoneNumber = str(form, "phone_number");
    const agentId = str(form, "agent_id");

    if (!isE164(phoneNumber)) return fail("Expected an E.164 number.");

    // The empty option means "unassign this number".
    if (!agentId) {
      const { error } = await db()
        .from("agents")
        .update({ twilio_number: null })
        .eq("twilio_number", phoneNumber);
      if (error) return fail(`Could not unassign: ${error.message}`);

      revalidatePath("/numbers");
      revalidatePath("/agents");
      return ok(`${phoneNumber} is no longer assigned to any agent.`);
    }

    const result = await assignNumberToAgent(agentId, phoneNumber);
    if (result.status === "error") return result;

    revalidatePath("/numbers");
    revalidatePath("/agents");
    return ok(`${phoneNumber} now routes to this agent.`);
  });
}

/** Routes an already-owned number through the shared trunk. */
export async function attachNumber(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const numberSid = str(form, "number_sid");
    const phoneNumber = str(form, "phone_number");
    if (!numberSid) return fail("Missing number SID.");

    await attachToSharedTrunk(numberSid);
    if (integrationStatus().livekit && isE164(phoneNumber)) {
      await syncNumberOntoTrunks(phoneNumber);
    }

    revalidatePath("/numbers");
    return ok(`${phoneNumber} is now routed to LiveKit.`);
  });
}

/** Stops routing a number to LiveKit. The account keeps owning it. */
export async function detachNumber(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const numberSid = str(form, "number_sid");
    const phoneNumber = str(form, "phone_number");
    if (!numberSid) return fail("Missing number SID.");

    await detachFromSharedTrunk(numberSid);
    if (integrationStatus().livekit && isE164(phoneNumber)) {
      await removeNumberFromTrunks(phoneNumber);
    }

    // A detached number can't reach the agent, so drop the stale assignment
    // rather than leaving the agents list claiming a number that won't ring.
    const { error } = await db()
      .from("agents")
      .update({ twilio_number: null })
      .eq("twilio_number", phoneNumber);
    if (error) {
      return fail(
        `Detached ${phoneNumber} from the trunk, but couldn't clear its agent assignment: ${error.message}`,
      );
    }

    revalidatePath("/numbers");
    revalidatePath("/agents");
    return ok(`${phoneNumber} no longer routes to LiveKit.`);
  });
}

/**
 * Permanently gives a number back to Twilio. Irreversible: the number goes back
 * into the pool and cannot be reclaimed.
 */
export async function releaseNumberAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const numberSid = str(form, "number_sid");
    const phoneNumber = str(form, "phone_number");
    if (!numberSid) return fail("Missing number SID.");

    // Clear the Supabase assignment first. If the release then fails, the worst
    // case is a live number nobody is routed to — the reverse ordering would
    // leave an agent pointing at a number that no longer exists.
    const { error } = await db()
      .from("agents")
      .update({ twilio_number: null })
      .eq("twilio_number", phoneNumber);
    if (error) return fail(`Could not clear the agent assignment: ${error.message}`);

    if (integrationStatus().livekit && isE164(phoneNumber)) {
      await removeNumberFromTrunks(phoneNumber);
    }
    await releaseNumber(numberSid);

    revalidatePath("/numbers");
    revalidatePath("/agents");
    return ok(`Released ${phoneNumber} back to Twilio.`);
  });
}
