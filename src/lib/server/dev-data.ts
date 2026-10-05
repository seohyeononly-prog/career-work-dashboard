import "server-only";
import { addDays, nowStr, todayStr } from "../date";
import type { LinkItem, Routine, Schedule, Task } from "../types";

// 개발용 예시 데이터. Google Sheets가 연결되지 않았을 때만 사용되며
// 서버 메모리에만 있으므로 서버를 재시작하면 초기화된다.
// 날짜는 오늘을 기준으로 상대적으로 만든다.

export function createDevData(): {
  tasks: Task[];
  schedules: Schedule[];
  links: LinkItem[];
  routines: Routine[];
} {
  const t = todayStr();
  const d = (n: number) => addDays(t, n);
  const now = nowStr();

  // endOffset을 주면 기간 업무/일정
  const task = (
    id: number,
    title: string,
    category: Task["category"],
    status: Task["status"],
    startOffset: number,
    endOffset?: number,
  ): Task => ({
    id: `dev-task-${id}`,
    title,
    category,
    status,
    startDate: d(startOffset),
    endDate: endOffset === undefined ? "" : d(endOffset),
    order: 0,
    routineId: "",
    checklist: [],
    createdAt: now,
    updatedAt: now,
  });

  const tasks: Task[] = [
    task(1, "수료식 준비", "취업운영", "대기", 0),
    task(2, "수료보고 정리", "취업운영", "대기", -1, 1),
    task(3, "동기야고마워 메일 발송 세팅", "취업운영", "대기", 1),
    task(4, "취업운영 OT 진행", "취업운영", "완료", -1),
    task(5, "헬스케어 취업운영 OT 모니터링", "취업운영", "완료", -2),
    task(6, "수강생 상담일지 공유", "취업운영", "대기", -2),
    task(7, "일경험 인수인계", "일경험", "대기", 0, 2),
    task(8, "일경험 참여기업 매칭 결과 정리", "일경험", "대기", -1),
    task(9, "일경험 프로젝트 중간 점검", "일경험", "대기", 4),
    task(10, "참여자 만족도 조사 리마인드", "일경험", "완료", 0),
    task(11, "기업 멘토링 일정 확정", "일경험", "대기", 6),
    {
      ...task(12, "면접평가표 세팅", "일경험", "대기", 1),
      checklist: [
        { text: "한빛소프트", done: true },
        { text: "그린랩스", done: false },
      ],
    },
  ];

  const sch = (
    id: number,
    title: string,
    category: Schedule["category"],
    startOffset: number,
    endOffset?: number,
  ): Schedule => ({
    id: `dev-schedule-${id}`,
    title,
    category,
    startDate: d(startOffset),
    endDate: endOffset === undefined ? "" : d(endOffset),
  });

  const schedules: Schedule[] = [
    sch(1, "주간 운영 미팅", "취업운영", 0),
    sch(2, "수료식", "취업운영", 2),
    sch(3, "취업 특강: 이력서 작성법", "취업운영", 3),
    sch(4, "일경험 참여기업 미팅", "일경험", 1),
    sch(5, "일경험 운영 교육", "일경험", 4),
    sch(6, "일경험 네트워킹 행사", "일경험", 8, 9),
    sch(7, "[한빛소프트] 킥오프 미팅", "일경험", 0),
    sch(8, "[한빛소프트] 중간 발표", "일경험", 5),
    sch(9, "[그린랩스] 현장 방문", "일경험", 1),
    sch(10, "[그린랩스] 멘토링", "일경험", 3, 4),
  ];

  const links: LinkItem[] = [
    {
      id: "dev-link-1",
      name: "취업운영 공유 드라이브",
      url: "https://drive.google.com/",
      category: "취업운영",
      service: "Drive",
      description: "수료 자료, 상담 서류 보관",
      favorite: true,
      order: 0,
    },
    {
      id: "dev-link-2",
      name: "수강생 관리 시트",
      url: "https://docs.google.com/spreadsheets/",
      category: "취업운영",
      service: "Google Sheets",
      description: "출결·상담 현황",
      favorite: true,
      order: 0,
    },
    {
      id: "dev-link-3",
      name: "취업운영 매뉴얼",
      url: "https://www.notion.so/",
      category: "취업운영",
      service: "Notion",
      description: "",
      favorite: false,
      order: 0,
    },
    {
      id: "dev-link-4",
      name: "일경험 참여기업 목록",
      url: "https://docs.google.com/spreadsheets/",
      category: "일경험",
      service: "Google Sheets",
      description: "기업별 담당자·매칭 현황",
      favorite: true,
      order: 0,
    },
    {
      id: "dev-link-5",
      name: "일경험 운영 가이드",
      url: "https://www.notion.so/",
      category: "일경험",
      service: "Notion",
      description: "",
      favorite: false,
      order: 0,
    },
  ];

  const routines: Routine[] = [
    {
      id: "dev-routine-1",
      title: "메일·문의 확인",
      category: "취업운영",
      repeat: "평일",
      weekdays: [],
      monthDay: 1,
      holidayShift: "앞",
      checklist: [],
      startDate: d(-30),
      endDate: "",
      skipDates: [],
    },
    {
      id: "dev-routine-2",
      title: "주간 운영 현황 공유",
      category: "일경험",
      repeat: "요일",
      weekdays: [1, 3],
      monthDay: 1,
      holidayShift: "앞",
      checklist: ["한빛소프트", "그린랩스"],
      startDate: d(-30),
      endDate: "",
      skipDates: [],
    },
    {
      id: "dev-routine-3",
      title: "수당 서류 취합",
      category: "일경험",
      repeat: "매월",
      weekdays: [],
      monthDay: 10,
      holidayShift: "앞",
      checklist: [],
      startDate: d(-30),
      endDate: "",
      skipDates: [],
    },
  ];

  return { tasks, schedules, links, routines };
}
