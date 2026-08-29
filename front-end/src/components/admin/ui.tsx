"use client";

// Shared back-office building blocks, in the pc store .39 palette.

import { mediaSrc } from "@/lib/api-client";
import { Pagination } from "@/components/ui/pagination";
import type { PillColors } from "@/lib/labels";

/** Cream card used for every admin panel. */
export function Card({
  children,
  className = "",
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: "ltr" | "rtl" | "auto";
}) {
  return (
    <div
      dir={dir}
      className={`rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] shadow-2xs ${className}`}
    >
      {children}
    </div>
  );
}

/** Eyebrow + title + hint block that opens every admin page. */
export function PageHeader({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#78827b]">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-medium tracking-[-.06em] text-[#17251f]">
          {title}
        </h1>
        {hint && <p className="mt-1.5 text-[11px] text-[#627269]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Pill({ label, colors }: { label: string; colors: PillColors }) {
  return (
    <span
      className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full px-3 font-mono text-[10px] font-bold uppercase tracking-[.06em]"
      style={{
        color: colors.color,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
    </span>
  );
}

/** Product tile: the catalogue tone as background + the cover image. */
export function ProductThumb({
  imageUrl,
  name,
  tone,
  size = 40,
}: {
  imageUrl: string | null;
  name: string;
  tone: string;
  size?: number;
}) {
  const src = mediaSrc(imageUrl);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#17251f]/10 font-mono text-[10px] font-bold text-[#1d4538]"
      style={{ width: size, height: size, background: tone }}
    >
      {src ? (
        <span
          className="block h-full w-full mix-blend-multiply"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

/** Card-footer pager: the shared {@link Pagination} inside a table's footer bar. */
export function CardPager(props: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (props.pageCount <= 1) return null;
  return (
    <div className="border-t border-[#17251f]/10 bg-[#f4f7f3] px-[18px] pb-3">
      <Pagination {...props} />
    </div>
  );
}

/** Filter / status tab chip (orders, payments, stock, quotes). */
export function TabChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number | string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-[#1d4538] bg-[#1d4538] text-white"
          : "border-[#17251f]/10 bg-white text-[#4e5d56] hover:bg-[#edf3ee]"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] font-mono text-[10px] font-bold ${
            active ? "bg-white/25 text-white" : "bg-[#edf3ee] text-[#1d4538]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Amber advisory used across the back office for frontoffice-coherence hints. */
export function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[10.5px] font-medium leading-4 text-amber-900">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/** Green confirmation banner shown after a save. */
export function SavedBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex animate-fade-in items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/** Red error banner. */
export function ErrorBanner({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
      {children}
    </div>
  );
}

/** Table loading shimmer. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      <div className="mb-[18px] flex gap-2.5">
        <div className="skeleton h-9 w-[120px]" />
        <div className="skeleton h-9 w-[120px]" />
        <div className="skeleton h-9 w-[120px]" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] py-2">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[#17251f]/5 px-[18px] py-3.5 last:border-b-0"
          >
            <div className="skeleton h-10 w-10 shrink-0 rounded-lg" />
            <div className="skeleton h-3.5 flex-[2] rounded" />
            <div className="skeleton h-3.5 flex-1 rounded" />
            <div className="skeleton h-3.5 flex-1 rounded" />
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shared form classes so every admin form looks the same. */
export const labelCls =
  "block font-mono text-[9.5px] font-bold uppercase tracking-[.1em] text-[#78827b] mb-1";
export const inputCls =
  "w-full rounded-xl border border-[#17251f]/15 bg-white p-3 text-xs font-semibold outline-none transition focus:border-[#1d4538]";
export const smallInputCls =
  "w-full rounded-lg border border-[#17251f]/15 bg-white p-2 text-xs outline-none transition focus:border-[#1d4538]";
export const hintCls = "mt-1 text-[10px] leading-4 text-[#78827b]";
export const sectionCls =
  "rounded-2xl border border-[#17251f]/10 bg-[#f8faf7] p-4 space-y-3.5";

export const primaryBtn =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1d4538] px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[.1em] text-white shadow-sm transition hover:bg-[#14352b] disabled:cursor-not-allowed disabled:opacity-50";
export const ghostBtn =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#17251f]/20 bg-white px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[.1em] text-[#17251f] transition hover:border-[#1d4538] hover:text-[#1d4538]";
export const dangerBtn =
  "inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-red-600 transition hover:bg-red-100";

export const iconBtn = (danger = false) =>
  `flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border bg-white transition ${
    danger
      ? "border-red-200 text-red-600 hover:bg-red-50"
      : "border-[#17251f]/15 text-[#17251f] hover:border-[#1d4538] hover:text-[#1d4538]"
  }`;

export const ADMIN_TABLE_HEAD =
  "grid gap-3 items-center px-[18px] py-3.5 bg-[#f4f7f3] border-b border-[#17251f]/10 font-mono text-[9.5px] font-bold text-[#78827b] uppercase tracking-[.14em]";
export const ADMIN_TABLE_ROW =
  "grid gap-3 items-center px-[18px] py-3 border-b border-[#17251f]/5 text-sm hover:bg-[#f8faf7] transition";
