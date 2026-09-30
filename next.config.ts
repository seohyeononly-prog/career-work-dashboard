import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 링크 화면은 사이드바로 옮겨졌다. 예전 주소(/links, /links/카테고리)는 홈으로 보낸다
  redirects: async () => [{ source: "/links/:category*", destination: "/", permanent: false }],
};

export default nextConfig;
