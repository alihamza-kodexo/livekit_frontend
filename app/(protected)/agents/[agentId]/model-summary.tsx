import Link from "next/link";

import { findDeepgramVoice } from "@/lib/deepgram-voices";
import type { Agent, LLMProvider } from "@/lib/types";

/**
 * Short, card-friendly version of sections.tsx's LLM_PROVIDER_LABELS -- that
 * one is written for a <select> option/tooltip, this is written to fit a
 * two-line summary card.
 */
const LLM_SUMMARY: Record<LLMProvider, { name: string; note: string }> = {
  groq: { name: "Groq", note: "Llama 3.3 70B -- fast, default" },
  deepseek: { name: "DeepSeek", note: "v4 Flash -- cheaper, slower" },
  gemini_live: { name: "Gemini Live", note: "Realtime speech-to-speech" },
};

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function SummaryCard({
  dotColor,
  label,
  title,
  subtitle,
  editHref,
}: {
  dotColor: string;
  label: string;
  title: string;
  subtitle: string;
  editHref: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
          {label}
        </span>
        <Link
          href={editHref}
          aria-label={`Edit ${label.toLowerCase()}`}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <PencilIcon />
        </Link>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
    </div>
  );
}

/**
 * Vapi-style "which models is this agent using" strip -- Transcriber/Model/
 * Voice, each linking its pencil to where it's actually configured (all three
 * live on the Voice & humanness tab, see sections.tsx's VoiceConfigForm).
 * Deliberately only shows fields this system actually has: no cost/latency
 * numbers, since nothing here measures those per-provider.
 */
export function AgentModelSummary({ agent }: { agent: Agent }) {
  const llm = LLM_SUMMARY[agent.llm_provider];
  const voice = agent.voice_id ? findDeepgramVoice(agent.voice_id) : undefined;
  const editHref = `/agents/${agent.agent_id}?tab=voice`;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        dotColor="bg-orange-500"
        label="Transcriber"
        title="Deepgram"
        subtitle="Speech-to-text -- fixed for every agent"
        editHref={editHref}
      />
      <SummaryCard
        dotColor="bg-blue-500"
        label="Model"
        title={llm.name}
        subtitle={llm.note}
        editHref={editHref}
      />
      <SummaryCard
        dotColor="bg-fuchsia-500"
        label="Voice"
        title={voice ? voice.name : "Worker default"}
        subtitle={voice ? `Deepgram (Aura) -- ${voice.language}` : "Deepgram (Aura)"}
        editHref={editHref}
      />
    </div>
  );
}
