import { z } from "zod";
import { CATEGORIES, PRIORITIES, SERVICE_TYPES, TASK_STATUSES } from "./types";
import { DATE_RE, DATETIME_RE } from "./date";

const text = (max: number) => z.string().trim().max(max);

export const taskInputSchema = z.object({
  title: text(200).min(1, "업무명을 입력해 주세요."),
  category: z.enum(CATEGORIES, { message: "카테고리는 취업운영 또는 일경험만 가능합니다." }),
  status: z.enum(TASK_STATUSES, { message: "상태는 대기, 진행 중, 완료 중 하나여야 합니다." }),
  dueDate: z.string().regex(DATE_RE, "마감일 형식은 YYYY-MM-DD 입니다."),
  priority: z.enum(PRIORITIES, { message: "중요도는 높음, 보통, 낮음 중 하나여야 합니다." }),
  description: text(2000).default(""),
});

export const scheduleInputSchema = z
  .object({
    title: text(200).min(1, "일정명을 입력해 주세요."),
    category: z.enum(CATEGORIES, { message: "카테고리는 취업운영 또는 일경험만 가능합니다." }),
    start: z.string().regex(DATETIME_RE, "시작일시 형식은 YYYY-MM-DD HH:mm 입니다."),
    end: z.string().regex(DATETIME_RE, "종료일시 형식은 YYYY-MM-DD HH:mm 입니다."),
    location: text(200).default(""),
    description: text(2000).default(""),
  })
  .refine((s) => s.end >= s.start, {
    message: "종료일시는 시작일시보다 빠를 수 없습니다.",
    path: ["end"],
  });

export const linkInputSchema = z.object({
  name: text(200).min(1, "링크명을 입력해 주세요."),
  url: z
    .string()
    .trim()
    .url("올바른 URL을 입력해 주세요.")
    .refine((u) => /^https?:\/\//i.test(u), "http 또는 https 주소만 등록할 수 있습니다."),
  category: z.enum(CATEGORIES, { message: "카테고리는 취업운영 또는 일경험만 가능합니다." }),
  service: z.enum(SERVICE_TYPES, { message: "서비스 종류는 Drive, Google Sheets, Notion, 기타 중 하나여야 합니다." }),
  description: text(1000).default(""),
  favorite: z.boolean({ message: "즐겨찾기 여부는 true 또는 false여야 합니다." }).default(false),
});

export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "입력값을 확인해 주세요.";
}
