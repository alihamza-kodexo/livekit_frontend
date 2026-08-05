/**
 * Shared presentational primitives.
 *
 * Deliberately plain Tailwind rather than a component library — the dashboard
 * is a handful of admin screens, and the whole surface fits in one file.
 */

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import type { AgentStatus, CallOutcome } from "@/lib/types";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {(title || description || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Same look as `Card`, but the whole thing starts closed -- for reference
 * material that's worth having on the page without taking up space by default. */
export function CollapsibleCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-5 py-4 marker:content-none">
        <span
          aria-hidden
          className="mt-0.5 shrink-0 text-zinc-400 transition-transform group-open:rotate-90 dark:text-zinc-500"
        >
          ▸
        </span>
        <div className="min-w-0">
          {title && (
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          )}
          {description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          )}
        </div>
      </summary>
      <div className="border-t border-zinc-200 p-5 dark:border-zinc-800">{children}</div>
    </details>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Explains a missing integration instead of letting the page throw.
 * `lib/env.ts` intentionally fails loudly on unset credentials; this is the
 * friendly version of that error for a half-configured install.
 */
export function ConfigNotice({
  integration,
  vars,
}: {
  integration: string;
  vars: string[];
}) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
      <p className="font-medium text-amber-900 dark:text-amber-200">
        {integration} isn&apos;t configured yet
      </p>
      <p className="mt-1 text-amber-800 dark:text-amber-300/90">
        Set{" "}
        {vars.map((v, i) => (
          <span key={v}>
            {i > 0 && ", "}
            <Code>{v}</Code>
          </span>
        ))}{" "}
        in <Code>dashboard/.env.local</Code> and restart the dev server.
      </p>
    </div>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Text bits                                                                  */
/* -------------------------------------------------------------------------- */

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.8125rem] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-sm tabular-nums">{children}</span>;
}

/** Renders a UTC timestamp deterministically so SSR and the client agree. */
export function Timestamp({ value }: { value: string | null }) {
  if (!value) return <span className="text-zinc-400">—</span>;
  const iso = new Date(value).toISOString();
  return (
    <time dateTime={iso} className="tabular-nums">
      {iso.slice(0, 16).replace("T", " ")} UTC
    </time>
  );
}

export function Duration({ seconds }: { seconds: number | null }) {
  if (seconds === null) return <span className="text-zinc-400">—</span>;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return <span className="tabular-nums">{`${m}:${String(s).padStart(2, "0")}`}</span>;
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

const BADGE_TONES = {
  neutral:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const AGENT_STATUS_TONES: Record<AgentStatus, keyof typeof BADGE_TONES> = {
  active: "green",
  paused: "amber",
  draft: "neutral",
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return <Badge tone={AGENT_STATUS_TONES[status]}>{status}</Badge>;
}

const OUTCOME_TONES: Record<CallOutcome, keyof typeof BADGE_TONES> = {
  qualified: "green",
  department_transfer: "blue",
  not_qualified: "neutral",
  transfer_failed: "red",
  dropped: "amber",
};

export function OutcomeBadge({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) return <span className="text-zinc-400">—</span>;
  return (
    <Badge tone={OUTCOME_TONES[outcome]}>{outcome.replace(/_/g, " ")}</Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons & links                                                            */
/* -------------------------------------------------------------------------- */

const BUTTON_VARIANTS = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
  danger:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40",
} as const;

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      {...props}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
    />
  );
}

export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <Link
      {...props}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

const CONTROL =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const FIELD_BADGE_CLASSES: Record<"required" | "optional", string> = {
  required:
    "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  optional:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

/** Pass `"required"`/`"optional"` for the common cases, or a short string
 * (e.g. `"Required to activate"`) for a field that's conditionally needed. */
export function Field({
  label,
  hint,
  htmlFor,
  badge,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  badge?: "required" | "optional" | string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        {label}
        {badge && (
          <span
            className={cx(
              "rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap",
              badge === "required" || badge === "optional"
                ? FIELD_BADGE_CLASSES[badge]
                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
            )}
          >
            {badge === "required" ? "Required" : badge === "optional" ? "Optional" : badge}
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cx(CONTROL, "font-mono leading-relaxed", className)}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cx(CONTROL, className)} />;
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-zinc-200 px-3 py-2 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: ComponentProps<"td">) {
  return (
    <td
      className={cx(
        "border-b border-zinc-100 px-3 py-2.5 align-middle dark:border-zinc-900",
        className,
      )}
    >
      {children}
    </td>
  );
}
