"use client";

import { Button } from "@/components/ui";

/**
 * Replaces the browser's native `window.confirm()` -- which shows as an ugly
 * "localhost:3737 says..." box the user can't style -- with a dialog that
 * matches the rest of the dashboard. Wired into ActionForm/ActionButton, so
 * every `confirm={...}` prop already in use gets this automatically.
 */
export function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm action"
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm text-zinc-800 dark:text-zinc-200">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" autoFocus onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
