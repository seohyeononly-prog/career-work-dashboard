/** 화면 전환 중 데이터를 불러오는 동안 보여주는 자리 표시 */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="불러오는 중" className="animate-pulse space-y-3">
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 h-4 w-1/3 rounded bg-slate-200" />
            <div className="mb-1.5 h-3 w-5/6 rounded bg-slate-100" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
