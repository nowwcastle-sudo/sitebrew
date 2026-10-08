// 사이트 공통 안내 글(P3-4 perf, C172) — 없는 주소(404)·오류(500) 쪽의 글. 사이트 콘텐츠(사실)가 아니라 로캘별 시스템 문구라 코드에 둔다.
// error·global-error 는 클라이언트 번들에 들어가므로 이 파일은 작게 유지한다(content/site.json 을 끌어오지 않는다).
export type SystemLocale = "ko" | "en"

export const NOT_FOUND_COPY = {
  ko: { title: "페이지를 찾을 수 없어요", body: "주소가 바뀌었거나 없어졌을 수 있어요. 홈에서 다시 찾아 주세요.", home: "홈으로 가기" },
  en: { title: "Page not found", body: "The address may have changed or no longer exists. Try finding it again from the home page.", home: "Go to the home page" },
} satisfies Record<SystemLocale, { title: string; body: string; home: string }>

export const ERROR_COPY = {
  ko: { title: "문제가 생겼어요", body: "잠시 뒤에 다시 시도해 주세요. 계속되면 홈으로 돌아가 주세요.", retry: "다시 시도", home: "홈으로 가기", code: "오류 코드" },
  en: { title: "Something went wrong", body: "Please try again in a moment. If it keeps happening, head back to the home page.", retry: "Try again", home: "Go to the home page", code: "Error code" },
} satisfies Record<SystemLocale, { title: string; body: string; retry: string; home: string; code: string }>
