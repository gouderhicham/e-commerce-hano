"use client";

import { forwardRef } from "react";

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block font-mono text-[9.5px] font-bold uppercase tracking-[.1em] text-[#78827b]"
    >
      {children}
    </label>
  );
}

const INPUT_CLASSES =
  "w-full rounded-xl border border-[#17251f]/15 bg-white p-3 text-xs font-semibold text-[#17251f] outline-none transition focus:border-[#1d4538]";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...props }, ref) {
  return (
    <input ref={ref} className={`${INPUT_CLASSES} ${className}`} {...props} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className = "", ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`${INPUT_CLASSES} cursor-pointer ${className}`}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${INPUT_CLASSES} resize-y font-normal ${className}`}
      {...props}
    />
  );
});

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="mt-1 text-[11px] font-medium text-[#dc2626]">{children}</div>
  );
}
