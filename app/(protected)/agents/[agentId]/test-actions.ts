"use server";

import { randomUUID } from "node:crypto";

import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";

import { livekitEnv } from "@/lib/env";

export type TestSession = { token: string; url: string; roomName: string };
export type TestSessionResult = TestSession | { error: string };

/**
 * Starts a browser-testable session with this agent, entirely local to
 * whatever LiveKit server is configured (no Twilio/SIP involved). An explicit
 * agent dispatch tells the worker to join this specific room; job metadata
 * carries which agent to load, since there's no SIP-dialed number to resolve
 * it from -- see agent-worker/src/worker/entrypoint.py's test-mode branch.
 */
export async function createTestSession(agentId: string): Promise<TestSessionResult> {
  try {
    const { url, apiKey, apiSecret } = livekitEnv();
    const httpUrl = url.replace(/^ws/, "http");
    const roomName = `test-${agentId}-${randomUUID().slice(0, 8)}`;

    const dispatch = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
    await dispatch.createDispatch(roomName, "kodexo-inbound-agent", {
      metadata: JSON.stringify({ test_agent_id: agentId }),
    });

    const token = new AccessToken(apiKey, apiSecret, {
      identity: `tester-${randomUUID().slice(0, 8)}`,
      ttl: "15m",
    });
    token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });

    return { token: await token.toJwt(), url, roomName };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Could not start a test session: ${error.message}`
          : "Could not start a test session.",
    };
  }
}
