import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinksView } from "@/components/LinksView";
import { LoadError } from "@/components/LoadError";
import { load } from "@/lib/server/load";
import { listLinks } from "@/lib/server/repository";
import { CATEGORY_SLUGS } from "@/lib/types";

export async function generateMetadata(props: PageProps<"/links/[category]">): Promise<Metadata> {
  const category = CATEGORY_SLUGS[(await props.params).category];
  return { title: `${category ?? "링크"} 링크 · 업무 대시보드` };
}

export default async function LinksPage(props: PageProps<"/links/[category]">) {
  const category = CATEGORY_SLUGS[(await props.params).category];
  if (!category) notFound();
  const res = await load(listLinks);
  if (!res.ok) return <LoadError message={res.error} />;
  return (
    <LinksView
      key={category}
      category={category}
      initialLinks={res.data.filter((l) => l.category === category)}
    />
  );
}
