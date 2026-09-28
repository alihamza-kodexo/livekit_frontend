"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { ToolTypeGlyph, type GlyphTone } from "@/components/ui";

export type DropdownOption = {
  value: string;
  label: string;
  /** Second line under the label -- the trade-off, the sample, the caveat. */
  description?: string;
  disabled?: boolean;
  /** A glyph shown before the label, in the menu and on the closed trigger.
   * Optional so every other dropdown in the app is unaffected. */
  icon?: string;
  /** Accent for `icon`. Ignored without one. */
  iconTone?: GlyphTone;
};

export type DropdownTone = "default" | "neutral" | "green" | "amber" | "red";

const TRIGGER_TONES: Record<DropdownTone, string> = {
  default: "border-input-line bg-input text-body",
  neutral: "border-input-line bg-input font-medium text-muted",
  green: "border-success-border bg-success-bg font-semibold text-success-text",
  amber: "border-warning-border bg-warning-bg font-semibold text-warning-text",
  red: "border-error-border bg-error-bg font-semibold text-error-text",
};

/** Viewport coordinates for the portaled menu. Exactly one of `top`/`bottom`
 * and one of `left`/`right` is set -- which, depends on where the menu fits. */
type MenuPosition = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth: number;
  maxHeight: number;
  placement: "bottom" | "top";
};

/** Gap between trigger and menu, and the margin kept clear of the window edge
 * so a menu never sits flush against it. */
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
/** Matches the old `max-h-72`. The menu never grows past this, even given room. */
const MENU_MAX_HEIGHT = 288;

/** Nothing to subscribe to -- `useIsClient` only wants the two snapshots. */
const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** False while rendering on the server, true once hydrated. The portal needs
 * `document`, which only exists on the client. `useSyncExternalStore` rather
 * than a mount effect: it takes a server snapshot directly instead of setting
 * state from an effect and cascading a second render. */
function useIsClient() {
  return useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
}

/** Keeps an offset at least `VIEWPORT_MARGIN` from either window edge. */
function clamp(offset: number, max: number) {
  return Math.max(VIEWPORT_MARGIN, Math.min(offset, max));
}

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * The dashboard's select control.
 *
 * A native `<select>` can't be styled where it matters: the open list is drawn
 * by the OS, so on Windows it lands as a white menu with a blue highlight in the
 * middle of a dark dashboard, ignores our radii and spacing, and can't show more
 * than one line per option. This renders the list itself instead.
 *
 * It stays a real form control: the value posts through a hidden input under the
 * same `name`, so every action reading `form.get(name)` is unchanged, and it
 * works uncontrolled (`defaultValue`) or controlled (`value` + `onValueChange`)
 * exactly like the element it replaces.
 *
 * Open/close is animated in CSS rather than by timing an unmount in JS -- see
 * `.dropdown-menu` in globals.css. The list is always in the DOM and toggles
 * `display` as part of the transition, which is what lets the closing direction
 * animate too.
 *
 * The list is rendered into `document.body` rather than beside the trigger. An
 * absolutely positioned menu is clipped by any ancestor that scrolls or hides
 * its overflow, and two of ours do -- `Card` is `overflow-hidden` and `Table`
 * is `overflow-x-auto` -- which inside a table cell left the menu sliced off
 * mid-list. It was also painted over by the sticky agent header, which starts
 * its own stacking context. A portal to the body has neither problem: position
 * is measured from the trigger and kept in sync while open, including flipping
 * above the trigger when the list would run off the bottom.
 */
export function Dropdown({
  name,
  value,
  defaultValue,
  onValueChange,
  options,
  id,
  ariaLabel,
  disabled,
  tone = "default",
  placeholder = "Select…",
  className,
  menuClassName,
  align = "start",
}: {
  /** Omit for a dropdown that only drives local state. */
  name?: string;
  /** Controlled value. Leave unset and pass `defaultValue` for uncontrolled. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: DropdownOption[];
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  tone?: DropdownTone;
  placeholder?: string;
  className?: string;
  /** For a menu that shouldn't just inherit the trigger's width -- a narrow
   * control whose options carry descriptions, say. */
  menuClassName?: string;
  /** Which edge the menu lines up with when it's wider than the trigger. */
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Where the portaled menu sits, in viewport coordinates. Null until measured.
  const [position, setPosition] = useState<MenuPosition | null>(null);
  // The portal waits for the client; see `useIsClient`.
  const isClient = useIsClient();

  const controlled = value !== undefined;
  const selectedValue = controlled ? value : internalValue;
  const selected = options.find((option) => option.value === selectedValue);

  function commit(next: string) {
    if (!controlled) setInternalValue(next);
    onValueChange?.(next);
    setOpen(false);
  }

  function openMenu() {
    if (disabled) return;
    // Start the keyboard cursor on whatever is currently selected, so
    // Arrow-then-Enter is a one-step move rather than a hunt from the top.
    const index = options.findIndex((option) => option.value === selectedValue);
    setActiveIndex(index);
    setOpen(true);
  }

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // The menu is at least as wide as its trigger, but its content can make it
    // wider -- so measure the rendered menu when there is one to measure.
    const width = Math.max(rect.width, listRef.current?.offsetWidth ?? 0);

    const below = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const above = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    // Flip only when below is genuinely cramped AND above is roomier, so the
    // menu doesn't swap sides over a few pixels as the page scrolls.
    const flip = below < Math.min(MENU_MAX_HEIGHT, 160) && above > below;

    setPosition({
      ...(flip
        ? { bottom: window.innerHeight - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
      // Pinning the edge the menu is aligned to keeps it attached to the
      // trigger even when it turns out wider than the trigger itself. Both
      // edges are then clamped into the window, which matters when the trigger
      // is itself partly scrolled out of view -- inside the numbers table it
      // can be, and a menu that simply followed it would hang off the side.
      ...(align === "end"
        ? {
            right: clamp(
              window.innerWidth - rect.right,
              window.innerWidth - VIEWPORT_MARGIN - width,
            ),
          }
        : {
            left: clamp(rect.left, window.innerWidth - VIEWPORT_MARGIN - width),
          }),
      minWidth: rect.width,
      maxHeight: Math.max(120, Math.min(MENU_MAX_HEIGHT, flip ? above : below)),
      placement: flip ? "top" : "bottom",
    });
  }, [align]);

  // Before paint, so the menu is never shown at a stale position for a frame.
  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, measure, options.length]);

  // A fixed menu doesn't travel with its trigger, so anything that moves the
  // trigger has to move the menu too. Capture phase, because the trigger may
  // sit inside a scrolling container (the numbers table) and not the window.
  useEffect(() => {
    if (!open) return;
    const sync = () => measure();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open, measure]);

  // Click-outside and Escape, only while open. The menu is portaled out of the
  // container, so it needs checking separately -- otherwise dragging its own
  // scrollbar reads as a click outside and closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keeps the keyboard cursor in view in a long list (the Gemini voice list is
  // 30 entries). Scrolls the row, never the page.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const row = listRef.current?.querySelectorAll("[data-option]")[activeIndex];
    row?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function moveActive(delta: number) {
    const enabled = options
      .map((option, index) => ({ option, index }))
      .filter((entry) => !entry.option.disabled);
    if (enabled.length === 0) return;
    const currentPosition = enabled.findIndex((entry) => entry.index === activeIndex);
    const nextPosition =
      currentPosition === -1
        ? delta > 0
          ? 0
          : enabled.length - 1
        : (currentPosition + delta + enabled.length) % enabled.length;
    setActiveIndex(enabled[nextPosition].index);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          openMenu();
          return;
        }
        moveActive(event.key === "ArrowDown" ? 1 : -1);
        return;
      case "Home":
      case "End":
        if (!open) return;
        event.preventDefault();
        setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!open) {
          openMenu();
          return;
        }
        if (activeIndex >= 0 && !options[activeIndex]?.disabled) {
          commit(options[activeIndex].value);
        }
        return;
      case "Tab":
        // Leaving the control commits nothing and closes -- same as a native
        // select losing focus.
        if (open) setOpen(false);
        return;
      default:
        return;
    }
  }

  // Always rendered once mounted; `.dropdown-menu` animates both directions,
  // including the discrete display change. Portaled to the body so no
  // scrolling, overflow-hidden or stacking-context ancestor can clip it.
  const menu = isClient
    ? createPortal(
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          data-open={open}
          data-placement={position?.placement ?? "bottom"}
          style={{
            top: position?.top,
            bottom: position?.bottom,
            left: position?.left,
            right: position?.right,
            minWidth: position?.minWidth,
            maxHeight: position?.maxHeight,
          }}
          className={cx(
            // Clamped to the viewport so a menu wider than its trigger (or
            // one aligned to the right edge) can't run off a phone screen.
            "dropdown-menu fixed z-[70] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-lg",
            menuClassName,
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === selectedValue;
            const isActive = index === activeIndex;
            return (
              <div
                key={option.value}
                data-option
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                // mousedown, not click: the trigger's blur would otherwise race
                // the selection on some browsers.
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (!option.disabled) commit(option.value);
                }}
                className={cx(
                  "flex cursor-pointer items-start gap-2 rounded-sm px-2.5 py-2 text-sm",
                  option.disabled && "cursor-not-allowed opacity-50",
                  isActive && !option.disabled && "bg-canvas-alt",
                  isSelected ? "font-semibold text-strong" : "text-body",
                )}
              >
                <CheckIcon visible={isSelected} />
                {option.icon && (
                  // Nudged down so it lines up with the label's cap height rather
                  // than the row's top edge, since rows can be two lines tall.
                  <ToolTypeGlyph icon={option.icon} tone={option.iconTone} size="sm" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block text-xs leading-snug text-muted">
                      {option.description}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          {options.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-faint">Nothing to choose from.</p>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={containerRef} className={cx("relative", className)}>
      {name && <input type="hidden" name={name} value={selectedValue} />}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cx(
          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          TRIGGER_TONES[tone],
          open && "border-brand",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {/* On the trigger too, not just in the menu -- otherwise the mark
              disappears the moment a choice is made, which is when it's most
              useful as confirmation of what's selected. */}
          {selected?.icon && (
            <ToolTypeGlyph icon={selected.icon} tone={selected.iconTone} size="sm" />
          )}
          <span className={cx("min-w-0 truncate", !selected && "text-faint")}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {menu}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx(
        "h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-150",
        open && "rotate-180",
      )}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Kept in the layout even when hidden, so labels line up whether or not a row
 * is the selected one. */
function CheckIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("mt-0.5 h-3.5 w-3.5 shrink-0 text-brand", !visible && "invisible")}
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
