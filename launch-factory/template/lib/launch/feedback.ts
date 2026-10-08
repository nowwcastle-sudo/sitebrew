// launch-factory: 제품이 고치는 값(문제 신고 — D95). 이 파일은 제품 것이다.
// true 로 바꾸면 Sentry 의 사용자 피드백(feedbackIntegration)과 바닥글의 「Report a problem」 단추가 켜진다(오류 수집이 켜져 있을 때만 — SENTRY_DSN 이 있는 live).
// 켜기 전에 확인한다: 피드백은 사용자가 쓴 글(자유 서술)을 Sentry 로 보낸다. 지금의 개인정보처리방침은 Sentry 를 「개인정보를 가린 오류 보고」로만 적는다 — 사용자가 직접 보내는 글은
// 적혀 있지 않으므로, 켜기 전에 방침(content/legal/privacy.json)에 한 줄을 더하고 법률 검토를 거친다. 이름·이메일 칸은 받지 않게 해 두었다(lib/report-problem.ts).
// 이 파일은 브라우저에도 간다 — 아무것도 가져오지 않는다.
export const REPORT_PROBLEM_ENABLED = false
