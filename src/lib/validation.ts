import { z } from "zod";
import { CATEGORIES, LINK_CATEGORIES, SERVICE_TYPES, TASK_STATUSES } from "./types";
import { DATE_RE } from "./date";

const text = (max: number) => z.string().trim().max(max);

const category = z.enum(CATEGORIES, { message: "카테고리는 일경험, 취업운영, 기타 중 하나여야 합니다." });

/** 시작일 + (기간이면) 종료일 */
const dateRange = {
  startDate: z.string().regex(DATE_RE, "날짜 형식은 YYYY-MM-DD 입니다."),
  endDate: z.string().regex(DATE_RE, "종료일 형식은 YYYY-MM-DD 입니다.").or(z.literal("")).default(""),
};

const endNotBeforeStart = (r: { startDate: string; endDate: string }) => !r.endDate || r.endDate >= r.startDate;
const endMessage = { message: "종료일은 시작일보다 빠를 수 없습니다.", path: ["endDate"] };

/** 종료일이 시작일과 같으면 하루짜리로 저장한다 */
const collapseSameDay = <T extends { startDate: string; endDate: string }>(r: T): T =>
  r.endDate === r.startDate ? { ...r, endDate: "" } : r;

export const taskInputSchema = z
  .object({
    title: text(200).min(1, "업무명을 입력해 주세요."),
    category,
    status: z.enum(TASK_STATUSES, { message: "상태는 대기 또는 완료만 가능합니다." }).default("대기"),
    ...dateRange,
  })
  .refine(endNotBeforeStart, endMessage)
  .transform(collapseSameDay);

export const scheduleInputSchema = z
  .object({
    title: text(200).min(1, "일정명을 입력해 주세요."),
    category,
    ...dateRange,
  })
  .refine(endNotBeforeStart, endMessage)
  .transform(collapseSameDay);

export const linkInputSchema = z.object({
  name: text(200).min(1, "링크명을 입력해 주세요."),
  url: z
    .string()
    .trim()
    .url("올바른 URL을 입력해 주세요.")
    .refine((u) => /^https?:\/\//i.test(u), "http 또는 https 주소만 등록할 수 있습니다."),
  category: z.enum(LINK_CATEGORIES, { message: "링크 카테고리는 일경험 또는 취업운영만 가능합니다." }),
  service: z.enum(SERVICE_TYPES, { message: "서비스 종류는 Drive, Google Sheets, Notion, 기타 중 하나여야 합니다." }),
  description: text(1000).default(""),
  favorite: z.boolean({ message: "즐겨찾기 여부는 true 또는 false여야 합니다." }).default(false),
});

export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "입력값을 확인해 주세요.";
}

export const shortcutInputSchema = z.object({
  name: text(30).min(1, "버튼 이름을 입력해 주세요."),
  url: z
    .string()
    .trim()
    .url("올바른 URL을 입력해 주세요.")
    .refine((u) => /^https?:\/\//i.test(u), "http 또는 https 주소만 등록할 수 있습니다."),
});
