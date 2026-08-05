import { login } from "@/app/login/actions";
import ColorBends from "@/components/color-bends";
import { ActionForm } from "@/components/form";
import { Field, Input } from "@/components/ui";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "That account isn't authorized for this dashboard.",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const errorParam = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] : null;

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-6 py-16">
      {/* Decorative -- fixed behind the card, doesn't need to track light/dark theme.
          Plain stacking order (painted first, no z-index) rather than a negative
          z-index: negative z-index can end up behind an ancestor's own stacking
          context depending on the browser, which also breaks pointer hit-testing
          for the mouse-parallax effect. */}
      <div className="fixed inset-0">
        <ColorBends
          colors={["#f75555"]}
          rotation={74}
          autoRotate={-5}
          speed={0.2}
          scale={0.2}
          frequency={5}
          warpStrength={0.9}
          mouseInfluence={2}
          parallax={0.5}
          noise={0}
          iterations={1}
          intensity={0.5}
          bandWidth={6.5}
          transparent={false}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white/95 p-8 shadow-xl backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Kodexo Voice Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to continue.
          </p>
        </div>

        {errorMessage && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {errorMessage}
          </p>
        )}

        <ActionForm action={login} submitLabel="Sign in" pendingLabel="Signing in…">
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
    </div>
  );
}
