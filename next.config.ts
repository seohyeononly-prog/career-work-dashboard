import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 카테고리별로 나뉘어 있던 예전 링크 화면 주소는 통합 화면으로 보낸다
  redirects: async () => [{ source: "/links/:category", destination: "/links", permanent: false }],
};

export default nextConfig;
