"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "dark" | "tint";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-[#1d4538] text-white border-none hover:bg-[#14352b] disabled:bg-[#b6bfb8] disabled:cursor-not-allowed",
  secondary:
    "bg-white text-[#17251f] border border-[#17251f]/15 hover:border-[#1d4538] hover:text-[#1d4538]",
  danger: "bg-[#dc2626] text-white border-none hover:bg-[#b91c1c]",
  dark: "bg-[#17251f] text-white border-none hover:bg-[#0f1a15]",
  tint: "bg-[#edf3ee] text-[#1d4538] border border-[#1d4538]/25 hover:bg-[#e0ebe2]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", className = "", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={`inline-flex h-11 cursor-pointer items-center justify-center rounded-xl px-[18px] text-[13px] font-bold uppercase tracking-[.08em] transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
        {...props}
      />
    );
  },
);
