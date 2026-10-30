/**
 * WBS 동기화 중간 다리 (Google Apps Script 웹 앱)
 *
 * 대시보드 서버가 보낸 Sheets API 요청을, 배포한 사람(나)의 권한으로 WBS 시트에만 대신 보낸다.
 * WBS 시트의 공유 설정이나 시트 안 스크립트는 바꾸지 않는다.
 *
 * 설치
 * 1. 회사 계정으로 https://script.google.com → 새 프로젝트, 이 파일 내용을 Code.gs에 붙여 넣기
 * 2. 왼쪽 "서비스" 옆 + → Google Sheets API → 추가 (식별자 Sheets 그대로)
 * 3. 프로젝트 설정(톱니) → 스크립트 속성 → 속성 추가: KEY = .env.local의 WBS_SCRIPT_KEY 값
 * 4. 배포 → 새 배포 → 유형: 웹 앱, 실행: 나, 액세스: 모든 사용자 → 권한 허용
 * 5. 웹 앱 URL(…/exec)을 .env.local의 WBS_SCRIPT_URL에 넣기
 * 코드를 고치면 배포 → 배포 관리 → 수정(연필) → 버전: 새 버전 → 배포 해야 반영된다 (URL은 그대로).
 */

/** 이 스프레드시트에만 요청을 보낸다 */
var WBS_SPREADSHEET_ID = "1rzAz-WZI-wsCtXZ_CDMRQjKe3mwi58HTDuvw7MqQ8dY";

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var key = PropertiesService.getScriptProperties().getProperty("KEY");
    if (!key || req.key !== key) return reply({ status: 401, error: "WBS 스크립트 키가 맞지 않습니다." });
    return reply({ status: 200, data: run(String(req.path), req.data) });
  } catch (err) {
    return reply({ status: 500, error: String((err && err.message) || err) });
  }
}

/** 대시보드가 쓰는 네 가지 Sheets API 요청을 Google Sheets API 서비스(Sheets) 호출로 바꾼다 */
function run(path, data) {
  var id = WBS_SPREADSHEET_ID;
  if (path === "/values:batchUpdate") return Sheets.Spreadsheets.Values.batchUpdate(data, id);
  if (path === ":batchUpdate") return Sheets.Spreadsheets.batchUpdate(data, id);
  if (path.indexOf("/values/") === 0) return Sheets.Spreadsheets.Values.get(id, decodeURIComponent(path.slice(8).split("?")[0]));
  if (path.indexOf("?fields=") === 0) return Sheets.Spreadsheets.get(id, { fields: decodeURIComponent(path.slice(8)) });
  throw new Error("허용하지 않는 요청입니다: " + path);
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
