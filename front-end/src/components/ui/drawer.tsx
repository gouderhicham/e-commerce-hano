"use client";

import { useEffect } from "react";

/** Right slide-over panel with dark overlay (admin forms / order detail). */
export function Drawer({
  open,
  onClose,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150]">
      <div
        className="absolute inset-0 bg-[#11251f]/60 backdrop-blur-xs"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="light-scrollbar absolute bottom-0 right-0 top-0 flex w-full flex-col overflow-y-auto bg-[#fdfcf8] shadow-[-16px_0_48px_rgba(23,37,31,0.2)]"
        style={{ maxWidth: width, animation: "drawerIn 0.25s ease both" }}
      >
        {children}
      </div>
      <style>{`@keyframes drawerIn { from { transform: translateX(60px); opacity: 0.4; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}
