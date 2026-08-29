"use client";

/** Switch used for product active state + settings toggles. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[40px] shrink-0 rounded-full border-none p-0 transition-colors duration-200 ${
        checked ? "bg-[#1d4538]" : "bg-[#c3cbc5]"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(23,37,31,0.3)] transition-[left] duration-200"
        style={{ left: checked ? 21 : 3 }}
      />
    </button>
  );
}
