import type { PillColors } from "@/lib/labels";

/**
 * Bordered, tinted status pill (orders / payments / stock).
 * Sizes: sm = 22px (card chips), md = 26px (tables), lg = 30px (detail page).
 */
export function StatusPill({
  label,
  colors,
  size = "md",
}: {
  label: string;
  colors: PillColors;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses =
    size === "sm"
      ? "h-[22px] px-[9px] text-[11px]"
      : size === "lg"
        ? "h-[30px] px-3.5 text-sm"
        : "h-[26px] px-3 text-xs";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold ${sizeClasses}`}
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
