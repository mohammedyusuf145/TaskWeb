import { Skeleton } from '@/components/ui';

/** Loading skeleton shaped like a page: header bar and a few content blocks. */
export function RouteFallback() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-[var(--content-max)]">
      <div className="flex h-14 items-center border-b border-border px-4 md:h-16 md:px-8">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-4 px-4 py-6 md:grid-cols-3 md:px-8 md:py-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Splash({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <p className="anim-shimmer text-base text-text-3">{label}</p>
    </div>
  );
}
