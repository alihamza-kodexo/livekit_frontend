"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@livekit/components-styles";
import {
  BarVisualizer,
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";

import { createTestSession } from "@/app/(protected)/agents/[agentId]/test-actions";
import { Button } from "@/components/ui";

type Session = { token: string; url: string; roomName: string };

/**
 * Talk to this agent directly through the browser, entirely local to whatever
 * LiveKit server is configured -- no Twilio/SIP involved. Explicitly
 * dispatches the worker into a fresh room (see test-actions.ts) the same way
 * a real call would, just without a phone number in the middle. Works for
 * draft/paused agents too, since that's the point of testing before going live.
 *
 * Built on @livekit/components-react rather than hand-rolled: it already
 * solves the audio-visualizer and live-transcript problems against the exact
 * same AgentSession transcription protocol the Python worker publishes.
 */
export function TestAgentPanel({ agentId }: { agentId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    const result = await createTestSession(agentId);
    setStarting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSession(result);
  }, [agentId]);

  // The only way to reach this panel is the header's "Test agent" button
  // (there's no tab for it anymore), so that click should actually start the
  // call -- landing here and still requiring a second click felt broken.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    start();
  }, [start]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Uses your microphone to talk to this agent directly, without a phone
        call -- draft and paused agents can be tested here too. This session
        isn&apos;t logged to call history.
      </p>

      {!session ? (
        <Button type="button" onClick={start} disabled={starting}>
          {starting ? "Connecting…" : "Start test call"}
        </Button>
      ) : (
        <LiveKitRoom
          serverUrl={session.url}
          token={session.token}
          audio
          connect
          onDisconnected={() => setSession(null)}
          onError={(err) => {
            setError(`Couldn't connect: ${err.message}`);
            setSession(null);
          }}
        >
          <TestCallUI />
          <RoomAudioRenderer />
        </LiveKitRoom>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

const STATE_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  initializing: "Connecting…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  disconnected: "Waiting for the agent to join…",
};

function TestCallUI() {
  const room = useRoomContext();
  const { state, audioTrack, agent } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const transcriptions = useTranscriptions();

  const messages = useMemo(
    () =>
      [...transcriptions]
        .sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp)
        .map((t) => ({
          id: t.streamInfo.id,
          text: t.text,
          fromAgent: agent !== undefined && t.participantInfo.identity === agent.identity,
        })),
    [transcriptions, agent],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="danger" onClick={() => room.disconnect()}>
          End test call
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? "Mute" : "Unmute"}
        </Button>
        <div className="h-10 w-32">
          <BarVisualizer state={state} barCount={5} track={audioTrack} />
        </div>
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          {STATE_LABEL[state] ?? state}
        </span>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Transcript will appear here once the conversation starts.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.fromAgent ? "justify-start" : "justify-end"}`}
          >
            <div
              className={
                message.fromAgent
                  ? "max-w-[80%] rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                  : "max-w-[80%] rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
              }
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
