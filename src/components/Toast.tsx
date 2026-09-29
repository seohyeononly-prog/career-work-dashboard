"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "./ui";

type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

/** 화면 아래쪽에 잠깐 떴다 사라지는 알림 */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: Tone = "success") => {
    const id = ++nextId.current;
    setToasts((l) => [...l.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-toast flex max-w-sm items-center gap-2.5 rounded-full bg-slate-900/95 py-2.5 pr-5 pl-3 text-sm text-white shadow-lg ring-1 ring-black/5"
          >
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                t.tone === "success" ? "bg-emerald-500" : "bg-rose-500",
              )}
            >
              {t.tone === "success" ? "✓" : "!"}
            </span>
            <span className="min-w-0 truncate">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
