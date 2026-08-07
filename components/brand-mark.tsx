import Image from "next/image";

/**
 * The Kodexo Labs mark. The asset is already brand red on transparency, so it
 * sits directly on whatever surface it's placed on -- no coloured tile behind
 * it, which would double up the red and fight the identity's "one red accent"
 * rule.
 *
 * The same file is `app/icon.png`, which is where the browser tab icon comes
 * from via Next's file convention.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/kodexo-mark.png"
      alt=""
      width={size}
      height={size}
      // Nav and sign-in chrome -- always above the fold, so it should never
      // wait for the lazy-loading observer.
      priority
      className="shrink-0"
    />
  );
}

/** Mark plus wordmark, for the nav rail and the sign-in screen. */
export function BrandLockup({
  size = 32,
  subtitle,
}: {
  size?: number;
  subtitle?: string;
}) {
  return (
    <>
      <BrandMark size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-heading text-sm leading-tight font-semibold tracking-tight text-strong">
          Kodexo Voice
        </span>
        {subtitle && (
          <span className="text-[0.6875rem] leading-tight text-faint">
            {subtitle}
          </span>
        )}
      </span>
    </>
  );
}
