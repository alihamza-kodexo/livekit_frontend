import { login } from "@/app/login/actions";
import { BrandMark } from "@/components/brand-mark";
import { ActionForm } from "@/components/form";
import { Field, Input } from "@/components/ui";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "That account isn't authorized for this dashboard.",
};

/** What the platform actually does, on the panel beside the form. Deliberately
 * describes this system's own capabilities rather than borrowing the
 * testimonial slot a public SaaS would put here -- there's nobody to quote on
 * an internal tool. */
const HIGHLIGHTS = [
  {
    title: "Build the agent, not the plumbing",
    body: "Prompt, voice, qualification criteria and tools -- all configured here, read live by the worker on the next call.",
  },
  {
    title: "Bring your own numbers",
    body: "Route a Twilio number through the shared SIP trunk and pick which agent answers it. No console spelunking.",
  },
  {
    title: "Hear it before your callers do",
    body: "Talk to any agent straight from the browser, transcript side by side, before it ever picks up a real call.",
  },
];

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const errorParam = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] : null;

  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col items-center justify-center px-6 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-3">
            <BrandMark size={36} />
            <span className="font-heading text-lg leading-none font-semibold tracking-tight text-strong">
              Kodexo <span className="font-normal text-muted">Voice</span>
            </span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-7 shadow-lg">
            <div className="mb-6 text-center">
              <h1 className="text-2xl">Sign in to your account</h1>
              <p className="mt-2 text-sm text-muted">
                Configure agents, numbers and call logs from one dashboard.
              </p>
            </div>

            {errorMessage && (
              <p className="mb-5 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text">
                {errorMessage}
              </p>
            )}

            <ActionForm
              action={login}
              submitLabel="Sign in"
              pendingLabel="Signing in…"
              submitFullWidth
            >
              <Field label="Email address" htmlFor="login-email">
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@kodexolabs.com"
                />
              </Field>
              <Field label="Password" htmlFor="login-password">
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
            </ActionForm>
          </div>

          <p className="mt-6 text-center text-xs text-faint">
            Access is limited to authorized Kodexo Labs accounts.
          </p>
        </div>
      </div>

      {/* Feature side. Static by design -- a dot lattice and one brand wash,
          no canvas and nothing animating behind the form. Hidden outright on
          narrow screens instead of stacking below the fold. */}
      <div className="relative hidden overflow-hidden border-l border-line bg-canvas-alt lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            color: "var(--n-300)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, var(--brand-red) 18%, transparent) 0%, transparent 60%)",
          }}
        />

        <div className="relative flex h-full flex-col justify-center px-12 py-16">
          <p className="mono-kicker">Voice agent platform</p>
          <h2 className="mt-3 max-w-md font-display text-3xl leading-tight font-black tracking-[0.02em] text-strong">
            Inbound calls, answered the way you scripted them.
          </h2>

          <dl className="mt-10 max-w-md space-y-6">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="border-l-2 border-brand pl-4">
                <dt className="font-heading text-sm font-semibold text-strong">
                  {item.title}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
