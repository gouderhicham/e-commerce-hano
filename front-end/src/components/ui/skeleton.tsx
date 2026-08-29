/** Shimmer placeholder block (catalogue + admin list loading, ~420 ms). */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8]">
      <Skeleton className="h-[150px] rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-[15px] w-4/5" />
        <Skeleton className="h-3 w-2/5" />
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <Skeleton className="h-[22px] w-[90px]" />
          <Skeleton className="h-6 w-[70px] rounded-full" />
        </div>
        <Skeleton className="mt-1 h-[42px]" />
      </div>
    </div>
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div
      className="grid items-center gap-4 border-b border-[#17251f]/10 px-5 py-4"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {Array.from({ length: cols }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}
