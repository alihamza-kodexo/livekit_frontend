"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { signOut } from "@/components/nav-actions";

const LINKS = [
  { href: "/agents", label: "Agents" },
  { href: "/tools", label: "Tools" },
  { href: "/numbers", label: "Numbers" },
  { href: "/calls", label: "Call logs" },
  { href: "/integrations", label: "Integrations" },
];

export function Nav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  // Publishes this nav's real rendered height as a CSS var, so anything that
  // stacks a sticky element below it (see components/sticky-band.tsx) can
  // position against the actual height instead of a guessed pixel value --
  // guessing is exactly what produced the gap/overlap this replaces.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () =>
      document.documentElement.style.setProperty("--nav-h", `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link
          href="/agents"
          className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Kodexo Voice
        </Link>
        <nav className="flex flex-1 gap-1">
          {LINKS.map((link) => {
            // Agent detail pages live under /agents/..., so highlight by prefix.
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{userEmail}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
