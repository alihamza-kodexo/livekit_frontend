import "server-only";

import TwilioSdk from "twilio";

import { twilioEnv } from "@/lib/env";

let cached: ReturnType<typeof TwilioSdk> | null = null;

function client() {
  if (!cached) {
    const { accountSid, authToken } = twilioEnv();
    cached = TwilioSdk(accountSid, authToken);
  }
  return cached;
}

/** A number Twilio has for sale, as shown in the search results table. */
export type AvailableNumber = {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  isoCountry: string;
  /** True when Twilio requires a verified Address on file before purchase. */
  addressRequired: boolean;
};

/** A number this Twilio account already owns. */
export type OwnedNumber = {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  /** Non-empty when the number is routed out through a SIP trunk. */
  trunkSid: string | null;
  /** True when it's attached to *our* shared trunk specifically. */
  onSharedTrunk: boolean;
};

export type NumberSearchParams = {
  /** ISO country code, e.g. "US". */
  country: string;
  areaCode?: number;
  /** Digit/letter pattern, e.g. "510*" or "*KODEXO". */
  contains?: string;
  limit?: number;
};

export async function searchAvailableNumbers({
  country,
  areaCode,
  contains,
  limit = 20,
}: NumberSearchParams): Promise<AvailableNumber[]> {
  const results = await client()
    .availablePhoneNumbers(country)
    .local.list({
      ...(areaCode ? { areaCode } : {}),
      ...(contains ? { contains } : {}),
      // The agent answers calls, so a number that can't receive voice is useless.
      voiceEnabled: true,
      limit,
    });

  return results.map((n) => ({
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    locality: n.locality || null,
    region: n.region || null,
    isoCountry: n.isoCountry,
    addressRequired: n.addressRequirements !== "none",
  }));
}

export async function listOwnedNumbers(): Promise<OwnedNumber[]> {
  const { trunkSid } = twilioEnv();
  const numbers = await client().incomingPhoneNumbers.list({ limit: 200 });

  return numbers.map((n) => ({
    sid: n.sid,
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    trunkSid: n.trunkSid || null,
    onSharedTrunk: n.trunkSid === trunkSid,
  }));
}

/**
 * Buys a number and attaches it to the shared SIP trunk in a single API call.
 *
 * Doing both at once matters: a number that exists but isn't on the trunk is a
 * number that rings into nothing, and this account is billed for it either way.
 *
 * Costs real money and is not reversible without releasing the number — every
 * caller must have explicit admin confirmation behind it.
 */
export async function purchaseNumber(
  phoneNumber: string,
  friendlyName: string,
): Promise<OwnedNumber> {
  const { trunkSid } = twilioEnv();
  const created = await client().incomingPhoneNumbers.create({
    phoneNumber,
    friendlyName,
    trunkSid,
  });

  return {
    sid: created.sid,
    phoneNumber: created.phoneNumber,
    friendlyName: created.friendlyName,
    trunkSid: created.trunkSid || null,
    onSharedTrunk: created.trunkSid === trunkSid,
  };
}

/** Routes an already-owned number out through the shared SIP trunk. */
export async function attachToSharedTrunk(numberSid: string): Promise<void> {
  const { trunkSid } = twilioEnv();
  await client()
    .trunking.v1.trunks(trunkSid)
    .phoneNumbers.create({ phoneNumberSid: numberSid });
}

/**
 * Takes a number off the shared trunk. The account keeps owning (and paying
 * for) it — this only stops routing calls to LiveKit.
 */
export async function detachFromSharedTrunk(numberSid: string): Promise<void> {
  const { trunkSid } = twilioEnv();
  await client().trunking.v1.trunks(trunkSid).phoneNumbers(numberSid).remove();
}

/**
 * Permanently releases a number back to Twilio. Irreversible — the number
 * cannot be reclaimed, and anyone who calls it later reaches a stranger.
 */
export async function releaseNumber(numberSid: string): Promise<void> {
  await client().incomingPhoneNumbers(numberSid).remove();
}

/** Sanity-checks that the configured shared trunk exists and where it points. */
export async function describeSharedTrunk(): Promise<{
  sid: string;
  friendlyName: string;
  /** Null for a freshly created trunk until Twilio assigns one. */
  domainName: string | null;
  originationUris: string[];
}> {
  const { trunkSid } = twilioEnv();
  const trunk = await client().trunking.v1.trunks(trunkSid).fetch();
  const uris = await client()
    .trunking.v1.trunks(trunkSid)
    .originationUrls.list({ limit: 20 });

  return {
    sid: trunk.sid,
    friendlyName: trunk.friendlyName,
    domainName: trunk.domainName,
    originationUris: uris.map((u) => u.sipUrl),
  };
}
