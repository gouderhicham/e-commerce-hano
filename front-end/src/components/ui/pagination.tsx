"use client";

/**
 * Build the list of page slots to render: always the first and last page,
 * the current page with `siblings` neighbours on each side, and gaps for the
 * collapsed ranges. Scales to thousands of pages without overflow.
 */
function buildRange(
  page: number,
  pageCount: number,
  siblings = 1,
): (number | "…")[] {
  const first = 1;
  const last = pageCount;
  const start = Math.max(first, page - siblings);
  const end = Math.min(last, page + siblings);

  // Small enough to show every page — no ellipsis needed.
  const totalSlots = siblings * 2 + 5; // first, last, current, 2 siblings, 2 gaps
  if (pageCount <= totalSlots) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const range: (number | "…")[] = [];
  range.push(first);

  // Left gap: collapse if there's more than one page between first and window.
  if (start > first + 1) range.push("…");
  else if (start === first + 1) range.push(first + 1);

  for (let n = start; n <= end; n++) {
    if (n !== first && n !== last) range.push(n);
  }

  // Right gap: mirror of the left side.
  if (end < last - 1) range.push("…");
  else if (end === last - 1) range.push(last - 1);

  range.push(last);
  return range;
}

/** Admin pager: "x-y sur n" label, hidden when there's a single page. */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const label = total === 0 ? "" : `${start + 1}–${end} sur ${total}`;

  const btnClass = (active: boolean, disabled: boolean) =>
    `min-w-[34px] h-[34px] px-2.5 rounded-lg border text-[12px] font-bold transition ${
      active
        ? "border-[#1d4538] bg-[#1d4538] text-white"
        : `border-[#17251f]/15 bg-white ${
            disabled
              ? "cursor-default text-[#c3cbc5]"
              : "cursor-pointer text-[#58675f] hover:border-[#1d4538] hover:text-[#1d4538]"
          }`
    }`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <span className="font-mono text-[11px] text-[#78827b]">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          className={btnClass(false, page === 1)}
          disabled={page === 1}
          onClick={() => page > 1 && onPage(page - 1)}
          aria-label="Page précédente"
        >
          ‹
        </button>
        {buildRange(page, pageCount).map((n, i) =>
          n === "…" ? (
            <span
              key={`gap-${i}`}
              aria-hidden="true"
              className="flex h-[34px] min-w-[34px] select-none items-center justify-center text-[12px] text-[#78827b]"
            >
              …
            </span>
          ) : (
            <button
              key={n}
              className={btnClass(n === page, false)}
              onClick={() => onPage(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </button>
          ),
        )}
        <button
          className={btnClass(false, page === pageCount)}
          disabled={page === pageCount}
          onClick={() => page < pageCount && onPage(page + 1)}
          aria-label="Page suivante"
        >
          ›
        </button>
      </div>
    </div>
  );
}
