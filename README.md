# 업무 대시보드

취업운영·일경험 업무와 일정을 관리하고, 자주 쓰는 Drive·Google Sheets·Notion 링크를 빠르게 여는 개인용 대시보드입니다.

- Next.js (App Router) · TypeScript · Tailwind CSS
- 데이터 저장소: Google Sheets (서비스 계정, 서버에서만 호출)

## 화면

| 경로 | 내용 |
| --- | --- |
| `/` | 홈: 오늘 마감 업무, 미완료·지연 업무, 이번 주 일정, 카테고리별 진행 상황, 즐겨찾기 링크 |
| `/kanban` | 칸반보드(대기·진행 중·완료), 카테고리·상태 필터, 체크박스 완료 처리, 드래그로 상태 이동 |
| `/calendar` | `업무 확인`(업무 마감일·완료 여부) / `일정 확인`(미팅·교육·행사) 캘린더 |
| `/links/employment` | 취업운영 링크 |
| `/links/work-experience` | 일경험 링크 |

완료 체크를 해제하면 업무는 `대기` 상태로 돌아갑니다.

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다.

환경변수가 없으면 **개발용 예시 데이터**로 동작합니다. 이때 화면 상단과 사이드바에 노란색 안내가 표시되며, 변경 사항은 서버 메모리에만 있어 서버를 재시작하면 초기화됩니다.

## Google Sheets 연결

1. **스프레드시트 만들기**
   빈 Google 스프레드시트를 하나 만듭니다. 탭(`Tasks`, `Schedules`, `Links`)과 헤더 행은 앱이 처음 접속할 때 자동으로 만듭니다. 직접 만들어도 됩니다(아래 형식 참고).
2. **Google Cloud 설정**
   1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만들거나 선택합니다.
   2. `API 및 서비스 > 라이브러리`에서 **Google Sheets API**를 사용 설정합니다.
   3. `IAM 및 관리자 > 서비스 계정`에서 서비스 계정을 만듭니다(역할 부여 불필요).
   4. 서비스 계정의 `키 > 키 추가 > 새 키 만들기 > JSON`으로 키 파일을 내려받습니다. 이 파일은 저장소에 넣지 마세요.
3. **시트 공유**
   스프레드시트의 `공유`에서 서비스 계정 이메일(`...@...iam.gserviceaccount.com`)을 **편집자**로 추가합니다.
4. **환경변수 설정**
   `.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

   ```bash
   cp .env.example .env.local
   ```

   | 변수 | 값 |
   | --- | --- |
   | `GOOGLE_SHEETS_SPREADSHEET_ID` | 시트 URL `https://docs.google.com/spreadsheets/d/<ID>/edit`의 `<ID>` |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON 키의 `client_email` |
   | `GOOGLE_PRIVATE_KEY` | JSON 키의 `private_key` (줄바꿈은 `\n` 그대로, 큰따옴표로 감싸기) |

5. `npm run dev`를 다시 실행하면 사이드바에 `저장소: Google Sheets`가 표시됩니다. 인증이나 권한에 문제가 있으면 각 화면에 오류 메시지가 나옵니다.

### 보안

- Sheets API 호출과 인증은 서버(`src/lib/server/`, `src/app/api/`)에서만 합니다. 이 모듈은 `server-only`로 표시되어 있어 브라우저 번들에 포함되면 빌드가 실패합니다.
- 환경변수 이름에 `NEXT_PUBLIC_`을 붙이지 마세요. 붙이면 브라우저에 노출됩니다.
- `.env`, `.env.local` 등은 `.gitignore`로 제외되고 `.env.example`만 커밋됩니다.
- 별도 로그인 기능은 없습니다. 배포 URL을 아는 사람은 데이터를 보고 수정할 수 있으므로, 공개 배포 시 Vercel의 Deployment Protection(비밀번호/Vercel 인증) 사용을 권장합니다.

## 시트 형식

모든 날짜·시간은 한국 시간 기준이며 시간대 표기 없이 저장합니다.
날짜는 `YYYY-MM-DD`, 일시는 `YYYY-MM-DD HH:mm` 형식입니다. 값은 서식 변환 없이(RAW) 문자열로 기록됩니다.

**Tasks**

| 업무 ID | 업무명 | 카테고리 | 상태 | 마감일 | 중요도 | 설명 | 생성일 | 수정일 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-1a2b3c4d | 수료식 준비 | 취업운영 | 대기 | 2026-09-28 | 높음 | … | 2026-09-20 10:00 | 2026-09-28 09:12 |

**Schedules**

| 일정 ID | 일정명 | 카테고리 | 시작일시 | 종료일시 | 장소 | 설명 |
| --- | --- | --- | --- | --- | --- | --- |
| S-1a2b3c4d | 수료식 | 취업운영 | 2026-09-30 14:00 | 2026-09-30 16:00 | 대강당 | … |

**Links**

| 링크 ID | 링크명 | URL | 카테고리 | 서비스 종류 | 설명 | 즐겨찾기 여부 |
| --- | --- | --- | --- | --- | --- | --- |
| L-1a2b3c4d | 수강생 관리 시트 | https://docs.google.com/… | 취업운영 | Google Sheets | … | TRUE |

허용 값

- 카테고리: `취업운영`, `일경험`
- 상태: `대기`, `진행 중`, `완료`
- 중요도: `높음`, `보통`, `낮음`
- 서비스 종류: `Drive`, `Google Sheets`, `Notion`, `기타`

시트에서 직접 행을 추가할 때는 ID 칸을 비우지 말고 겹치지 않는 값을 넣어 주세요(ID가 빈 행은 무시됩니다). 목록에 없는 값은 기본값(취업운영·대기·보통·기타)으로 읽힙니다.

## Vercel 배포

1. 저장소를 Vercel에 가져옵니다(Framework: Next.js, 설정 변경 불필요).
2. `Settings > Environment Variables`에 다음을 추가합니다.
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` — JSON의 `private_key` 값을 그대로 붙여 넣습니다(여러 줄 또는 `\n` 모두 가능).
3. 배포합니다. 환경변수 없이 배포하면 개발용 예시 데이터로 동작하며, 서버리스 환경이라 변경 사항이 유지되지 않습니다.

## 무료로 사용하기

유료 서비스 없이 사용할 수 있도록 구성되어 있습니다.

| 구성 요소 | 비용 | 참고 |
| --- | --- | --- |
| Google Sheets / Google Sheets API | 무료 | 결제 계정(카드 등록) 없이 API 사용 설정 가능. 분당 요청 수 제한만 있으며 1인 사용으로는 도달하지 않습니다. |
| 서비스 계정·JSON 키 | 무료 | Google Sheets API 외의 API는 켤 필요가 없습니다. |
| 로컬 실행 (`npm run dev` / `npm run build && npm start`) | 무료 | 내 PC에서만 접속. 가장 확실한 무료 방법입니다. |
| Vercel Hobby 플랜 | 무료 | 개인·비상업적 용도 기준 플랜입니다. 회사 업무용이면 약관을 확인하세요. 카드 등록 없이 가입 가능하고 한도 초과 시 과금 대신 제한됩니다. |

- 이 앱은 유료 데이터베이스나 외부 유료 API를 사용하지 않습니다.
- 회사(Google Workspace) 계정에서는 관리자 정책으로 서비스 계정 키 발급이 막혀 있을 수 있습니다. 이 경우 개인 Gmail 계정으로 Google Cloud 프로젝트를 만들고, 서비스 계정 이메일에 시트를 공유하면 됩니다.

## 구조

```
src/
  app/                 페이지와 API 라우트(/api/tasks, /api/schedules, /api/links)
  components/          화면 컴포넌트
  lib/
    types.ts           타입·허용 값
    date.ts            날짜 유틸(KST)
    validation.ts      입력 검증(zod)
    client-api.ts      브라우저 → /api 호출
    server/            서버 전용: Sheets 클라이언트, 탭 정의, 저장소, 개발용 데이터
```
