import type { MetadataRoute } from "next";

// Chrome "앱으로 설치" 시 사용하는 설정
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "업무 대시보드",
    short_name: "업무 대시보드",
    description: "취업운영·일경험 개인 업무 대시보드",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    icons: [
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/app-icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
