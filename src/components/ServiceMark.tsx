import type { ServiceType } from "@/lib/types";
import { cn } from "./ui";

const MARK: Record<ServiceType, { label: string; cls: string }> = {
  Drive: { label: "D", cls: "bg-yellow-100 text-yellow-800" },
  "Google Sheets": { label: "S", cls: "bg-green-100 text-green-800" },
  Notion: { label: "N", cls: "bg-slate-800 text-white" },
  기타: { label: "•", cls: "bg-slate-100 text-slate-600" },
};

/** small: 사이드바처럼 좁은 곳에 쓰는 작은 크기 */
export function ServiceMark({ service, small }: { service: ServiceType; small?: boolean }) {
  const m = MARK[service];
  return (
    <span
      title={service}
      aria-label={service}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold",
        small ? "h-4 w-4 rounded text-[9px]" : "h-7 w-7 rounded-md text-xs",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
