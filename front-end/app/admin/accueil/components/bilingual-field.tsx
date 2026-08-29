"use client";

import { hintCls, inputCls, labelCls } from "@/components/admin/ui";

/**
 * A French input paired with its Arabic counterpart.
 *
 * Every translatable field in the back office goes through this component so
 * the two languages are always edited side by side — a French box with no
 * Arabic box next to it is how a field ends up untranslated on the storefront.
 */
export function BilingualField({
  label,
  value,
  valueAr,
  onChange,
  onChangeAr,
  placeholder,
  placeholderAr,
  hint,
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  valueAr: string;
  onChange: (next: string) => void;
  onChangeAr: (next: string) => void;
  placeholder?: string;
  placeholderAr?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelCls}>{label} (Français)</label>
        {multiline ? (
          <textarea
            value={value}
            rows={rows}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputCls}
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputCls}
          />
        )}
        {hint && <p className={hintCls}>{hint}</p>}
      </div>
      <div>
        <label className={labelCls}>{label} (العربية)</label>
        {multiline ? (
          <textarea
            value={valueAr}
            rows={rows}
            dir="rtl"
            onChange={(e) => onChangeAr(e.target.value)}
            placeholder={placeholderAr}
            className={`${inputCls} font-arabic`}
          />
        ) : (
          <input
            value={valueAr}
            dir="rtl"
            onChange={(e) => onChangeAr(e.target.value)}
            placeholder={placeholderAr}
            className={`${inputCls} font-arabic`}
          />
        )}
        <p className={hintCls}>
          Vide = le texte français s&apos;affiche aux clients arabophones.
        </p>
      </div>
    </div>
  );
}
