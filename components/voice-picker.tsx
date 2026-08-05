"use client";

import { useMemo, useRef, useState } from "react";

import { DEEPGRAM_VOICES, findDeepgramVoice, type DeepgramVoice } from "@/lib/deepgram-voices";

const CONTROL =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const MAX_RESULTS = 40;

function labelFor(voice: DeepgramVoice): string {
  return `${voice.name} -- ${voice.language}, ${voice.gender}`;
}

/** "male"/"female" are how people actually search; "Masculine"/"Feminine" don't contain either as a substring. */
const GENDER_ALIASES: Record<DeepgramVoice["gender"], string> = {
  Masculine: "male man",
  Feminine: "female woman",
};

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matches(voice: DeepgramVoice, query: string): boolean {
  const haystack = `${voice.name} ${voice.id} ${voice.language} ${voice.gender} ${GENDER_ALIASES[voice.gender]} ${voice.tags.join(" ")}`.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  // Word-boundary prefix match per term -- "male" must not also match inside "female".
  return terms.every((term) => new RegExp(`\\b${escapeRegExp(term)}`).test(haystack));
}

/**
 * A searchable Deepgram Aura voice picker. Submits the same `voice_id` field
 * a plain text input would, so an operator can still paste a raw model name
 * that isn't in the catalog (e.g. a brand-new Deepgram release).
 */
export function VoicePicker({
  id,
  fieldName,
  defaultValue,
}: {
  id?: string;
  fieldName: string;
  defaultValue: string;
}) {
  const [voiceId, setVoiceId] = useState(defaultValue);
  const [query, setQuery] = useState(() => {
    const known = findDeepgramVoice(defaultValue);
    return known ? labelFor(known) : defaultValue;
  });
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // False right after a catalog selection (or on mount) -- true once the user
  // types again. Blur only falls back to raw-text-as-id when this is true, so
  // it doesn't clobber a just-picked model id with its own display label.
  const typedSinceSelect = useRef(false);

  const results = useMemo(() => {
    const filtered = query.trim()
      ? DEEPGRAM_VOICES.filter((voice) => matches(voice, query))
      : DEEPGRAM_VOICES;
    return filtered.slice(0, MAX_RESULTS);
  }, [query]);
  const totalMatches = useMemo(
    () => (query.trim() ? DEEPGRAM_VOICES.filter((voice) => matches(voice, query)).length : DEEPGRAM_VOICES.length),
    [query],
  );

  function selectVoice(voice: DeepgramVoice) {
    typedSinceSelect.current = false;
    setVoiceId(voice.id);
    setQuery(labelFor(voice));
    setOpen(false);
  }

  return (
    <div
      className="relative"
      onBlur={() => {
        // Delay so a click on a dropdown option (which also fires blur first) still registers.
        blurTimeout.current = setTimeout(() => {
          setOpen(false);
          // Only fall back to raw-text-as-id if the user actually typed since
          // the last catalog pick -- otherwise this would overwrite a good
          // voice_id with its own friendly display label.
          if (typedSinceSelect.current) setVoiceId(query.trim());
        }, 120);
      }}
      onFocus={() => {
        if (blurTimeout.current) clearTimeout(blurTimeout.current);
      }}
    >
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${fieldName}-listbox`}
        autoComplete="off"
        className={CONTROL}
        value={query}
        placeholder="Search voices by name, language, gender, or style…"
        onChange={(event) => {
          typedSinceSelect.current = true;
          setQuery(event.target.value);
          setVoiceId(event.target.value.trim());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <input type="hidden" name={fieldName} value={voiceId} />

      {open && (
        <div
          id={`${fieldName}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {results.length === 0 && (
            <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              No catalog match -- saving will use &ldquo;{query.trim()}&rdquo; as a raw model name.
            </p>
          )}
          {results.map((voice) => (
            <button
              key={voice.id}
              type="button"
              role="option"
              aria-selected={voice.id === voiceId}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onMouseDown={(event) => {
                // Prevent the input's blur (which would fire before this click) from racing the selection.
                event.preventDefault();
                selectVoice(voice);
              }}
            >
              <span className="text-sm text-zinc-900 dark:text-zinc-100">
                {voice.name}{" "}
                <span className="text-zinc-500 dark:text-zinc-400">
                  &middot; {voice.language} &middot; {voice.gender}
                </span>
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {voice.tags.join(", ")} &middot; <span className="font-mono">{voice.id}</span>
              </span>
            </button>
          ))}
          {totalMatches > MAX_RESULTS && (
            <p className="border-t border-zinc-100 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {totalMatches - MAX_RESULTS} more match -- keep typing to narrow it down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
