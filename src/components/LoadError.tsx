export function LoadError({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-semibold">데이터를 불러오지 못했습니다.</p>
      <p className="mt-1 break-words">{message}</p>
      <p className="mt-2 text-rose-700">
        환경변수와 스프레드시트 공유 설정(서비스 계정에 편집자 권한)을 확인해 주세요.
      </p>
    </div>
  );
}
