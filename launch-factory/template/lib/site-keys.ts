// 브라우저로 내려가는 공개 키(비밀이 아니다)를 서버 페이지가 읽어 클라이언트 잎에 props 로 넘긴다(LFFIX F1·F2). proxy.ts 도 같은 값으로 CSP 를 정한다.
// mock 에서는 두 값 모두 없다 — 위젯도 결제 창도 그리지 않고 예전 경로(서버 mock 통과·이동)로 간다. live 에서만 환경에서 읽는다.
//   TURNSTILE_SITE_KEY  Cloudflare Turnstile 위젯의 사이트 키(가입 폼). live 에서 필수다(lib/live-env.ts).
//   PADDLE_CLIENT_TOKEN Paddle.js 클라이언트 토큰(`test_…` = 샌드박스, `live_…` = 실결제). 없으면 결제는 Paddle 결제 링크로 이동한다.
// env() 를 거치지 않는다: proxy 는 모든 요청 앞에서 돌고, 환경 검사(빠진 이름 던지기)는 레이아웃의 env() 가 맡는다.
const live = () => process.env.LF_MODE === "live"

export function turnstileSiteKey(): string | undefined {
  return live() ? process.env.TURNSTILE_SITE_KEY || undefined : undefined
}

export function checkoutClientToken(): string | undefined {
  return live() ? process.env.PADDLE_CLIENT_TOKEN || undefined : undefined
}
