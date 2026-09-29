import { redirect } from "next/navigation";

// 캘린더는 칸반보드 화면 오른쪽으로 합쳐졌다. 예전 주소는 그대로 넘겨준다.
export default async function CalendarPage(props: PageProps<"/calendar">) {
  const { view } = await props.searchParams;
  redirect(view === "schedule" ? "/kanban?view=schedule" : "/kanban");
}
