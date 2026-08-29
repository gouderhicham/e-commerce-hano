"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  children,
  maxWidth = 560,
  closeOnClickOutside = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  closeOnClickOutside?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Closed on the server and on first render (modals open via interaction), so
  // portaling to <body> only ever runs client-side — no hydration mismatch. The
  // portal lets the overlay escape ancestor stacking contexts (the content
  // wrappers keep a `transform` from animate-fade-in that would otherwise trap
  // the scrim below the sticky header).
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#11251f]/60 p-4 backdrop-blur-xs sm:p-6"
      onClick={closeOnClickOutside ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="light-scrollbar max-h-[90vh] w-full animate-fade-in overflow-y-auto rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 shadow-2xl"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
