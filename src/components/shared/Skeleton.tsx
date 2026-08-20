export function SkeletonLine({ width = 'w-full' }: { width?: string }) {
  return <div className={`h-3.5 ${width} animate-pulse rounded-full bg-surface-alt`} />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-surface p-4">
      <SkeletonLine width="w-1/3" />
      <SkeletonLine width="w-2/3" />
      <SkeletonLine width="w-1/4" />
    </div>
  );
}

export function PlannerSkeleton() {
  return (
    <div className="space-y-3 px-4">
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
