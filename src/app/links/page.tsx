import type { Metadata } from "next";
import { LinksView } from "@/components/LinksView";
import { LoadError } from "@/components/LoadError";
import { load } from "@/lib/server/load";
import { listLinks } from "@/lib/server/repository";

export const metadata: Metadata = { title: "자주 보는 링크 · 업무 대시보드" };

export default async function LinksPage() {
  const res = await load(listLinks);
  if (!res.ok) return <LoadError message={res.error} />;
  return <LinksView initialLinks={res.data} />;
}
