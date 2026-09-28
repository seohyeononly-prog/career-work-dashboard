import type { ServiceType } from "@/lib/types";
import { cn } from "./ui";

const MARK: Record<ServiceType, { label: string; cls: string }> = {
  Drive: { label: "D", cls: "bg-yellow-100 text-yellow-800" },
  "Google Sheets": { label: "S", cls: "bg-green-100 text-green-800" },
  Notion: { label: "N", cls: "bg-slate-800 text-white" },
  기타: { label: "•", cls: "bg-slate-100 text-slate-600" },
};

export function ServiceMark({ service, className }: { service: ServiceType; className?: string }) {
  const m = MARK[service];
  return (
    <span
      title={service}
      aria-label={service}
      className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold", m.cls, className)}
    >
      {m.label}
    </span>
  );
}
