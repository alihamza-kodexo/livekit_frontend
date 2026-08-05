"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui";
import { IDLE, type ActionState } from "@/lib/forms";

type ServerAction = (
  prev: ActionState,
  form: FormData,
) => Promise<ActionState>;

/**
 * A `<form>` bound to a Server Action, with pending state and an inline result
 * message. Every mutation in the dashboard goes through this so success and
 * failure look the same everywhere.
 *
 * `confirm` guards destructive or costly actions (releasing a number, deleting
 * an agent) behind a native confirmation prompt.
 */
export function ActionForm({
  action,
  submitLabel = "Save",
  submitVariant = "primary",
  pendingLabel,
  confirm,
  footer,
  className,
  children,
}: {
  action: ServerAction;
  submitLabel?: string;
  submitVariant?: "primary" | "secondary" | "danger";
  pendingLabel?: string;
  confirm?: string;
  /** Extra content rendered next to the submit button. */
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    // `footer` often holds an ActionButton, which renders its own <form> --
    // that can't nest inside this one (invalid HTML, breaks hydration), so it
    // sits as a sibling below instead of inside the <form> with the fields.
    <div className={className ?? "space-y-4"}>
      <form
        action={formAction}
        className="space-y-4"
        onSubmit={(event) => {
          if (confirm && !window.confirm(confirm)) event.preventDefault();
        }}
      >
        {children}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant={submitVariant} disabled={pending}>
            {pending ? (pendingLabel ?? "Working…") : submitLabel}
          </Button>
          <ActionMessage state={state} />
        </div>
      </form>
      {footer}
    </div>
  );
}

export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role="status"
      className={
        state.status === "error"
          ? "text-sm text-red-600 dark:text-red-400"
          : "text-sm text-green-700 dark:text-green-400"
      }
    >
      {state.message}
    </p>
  );
}

/**
 * A submit-only form — no fields beyond the hidden values passed in. Used for
 * row-level actions like delete, attach, detach.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  confirm,
  hidden,
}: {
  action: ServerAction;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
  /** Hidden field name/value pairs identifying the target row. */
  hidden: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <form
      action={formAction}
      className="inline-flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? (pendingLabel ?? "Working…") : label}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}
