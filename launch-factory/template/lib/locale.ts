// 제품 화면의 표시 로캘·시간대(I01·I02·I03). 서버·클라이언트 어느 쪽에서도 읽는다(import 가 없다).
//
// 한 화면 한 로캘: 화면 글(content/copy.en.ts)이 영어이면 날짜·접근 이름도 영어다 — 블록에 locale 을 넘기지 않으면 블록 기본값(ko·Asia/Seoul)이 나온다.
// 시간대는 사용자가 가입 때 저장한 값(user.timeZone)이고, 없으면 제품 기본이다. 메일도 같은 값을 쓴다 — 메일 템플릿(@launch-factory/email)의 기본은
// 영어(en) → UTC 라서 DEFAULT_TIME_ZONE 이 그 값과 같아야 화면과 메일이 같은 날을 말한다(template.test 가 둘을 맞춰 본다).

/** 블록에 넘기는 로캘. 화면 문구 판의 언어(content/copy.en.ts 의 COPY_LOCALE)와 같아야 한다 — ux2.test 가 맞춰 본다. alias 를 쓰지 않아 node 시험이 바로 불러온다 */
export const DISPLAY_LOCALE = "en" as const
/** 사용자 시간대가 없을 때의 제품 기본. 메일 템플릿의 영어 기본(UTC)과 같다 */
export const DEFAULT_TIME_ZONE = "UTC"

/** IANA 시간대 이름인지(Intl 이 아는 이름만) */
function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** 화면이 날짜를 적을 시간대 — 사용자 값이 올바르면 그것, 아니면 제품 기본 */
export function displayTimeZone(userTimeZone?: string | null): string {
  return isTimeZone(userTimeZone) ? userTimeZone : DEFAULT_TIME_ZONE
}
