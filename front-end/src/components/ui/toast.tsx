"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  pushToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const TOAST_META: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: "#1d4538", icon: "✓" },
  error: { bg: "#dc2626", icon: "!" },
  warning: { bg: "#a06b1f", icon: "!" },
  info: { bg: "#2c5b48", icon: "i" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 3000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-6 z-[200] flex -translate-x-1/2 flex-col items-center gap-3">
          {toasts.map((t) => {
            const meta = TOAST_META[t.type];
            return (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto flex min-w-[300px] max-w-[420px] animate-fade-in items-center gap-3 rounded-full border border-[#17251f]/10 bg-[#fdfcf8]/95 px-4 py-3 shadow-[0_16px_40px_rgba(23,37,31,0.14)] backdrop-blur-xl"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white shadow-sm"
                  style={{ background: meta.bg }}
                >
                  {meta.icon}
                </span>
                <span className="flex-1 text-[14px] font-semibold leading-tight text-[#17251f]">
                  {t.message}
                </span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Fermer / إغلاق"
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-[#17251f]/5 p-0 text-[22px] leading-none text-[#58675f] transition-colors hover:bg-[#17251f]/10 hover:text-[#17251f]"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}
