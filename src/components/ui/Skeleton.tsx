/**
 * Skeleton placeholder for loading states.
 * Uses design tokens. Pass className for custom sizing.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-sm)] bg-[var(--background-tertiary)] ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-6 ${className}`}
    >
      <Skeleton className="mb-4 h-5 w-1/3" />
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonProjectRow() {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--border-default)] px-4 py-4">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/5" />
      </div>
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}
