import type { StateScreenErrorRetryProps } from "./error-retry"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 앱의 오류 화면, 문구마다 「예시」.
// onRetry 는 소비자가 끼운다(다시 불러오기 — 예: router.refresh). 예시는 누른 횟수를 창에 남긴다(검사가 호출을 본다).
const retry = () => {
  const w = window as Window & { __wfRetried?: number }
  w.__wfRetried = (w.__wfRetried ?? 0) + 1
}
const COPY = {
  code: "503",
  title: "예약 목록을 불러오지 못했어요",
  body: "서버가 잠시 응답하지 않아요. 적어 둔 내용은 이 기기에 그대로 있어요(예시).",
  retryLabel: "다시 시도",
  retryingLabel: "다시 불러오는 중이에요",
  home: { label: "처음 화면으로", href: "/" },
  helpTitle: "도움이 필요하면",
  help: [
    { label: "서비스 상태 보기", href: "https://status.example.com" },
    { label: "도움말 센터", href: "https://help.example.com" },
    { label: "고객센터에 문의", href: "mailto:help@example.com" },
  ],
  details: { summary: "자세히(문의할 때 알려 주세요)", rows: [{ label: "오류 번호", value: "E-503-7F2A" }, { label: "시각", value: "2026-09-29 09:41:07" }] },
}

export const fixture: StateScreenErrorRetryProps = { copy: COPY, onRetry: retry }

// 최대: 문구 끝까지, 도움말 6개.
export const fixtureMax: StateScreenErrorRetryProps = {
  errorCode: "service_unavailable",
  requestId: "req_01J9Z7Q4K3M8N2P5R6S7T8U9V0",
  copy: {
    ...COPY,
    support: { label: "고객센터에 문의", href: "/contact" },
    requestIdLabel: "요청 번호",
    title: "예약 목록을 불러오지 못했어요 — 잠시 뒤 다시 시도하거나 아래 도움말을 확인해 주세요(예시)",
    body: "서버가 잠시 응답하지 않아요. 적어 둔 내용은 이 기기에 그대로 있고, 연결이 돌아오면 자동으로 다시 보내요. 10분 넘게 같은 화면이 보이면 고객센터에 오류 번호를 알려 주세요(예시).",
    help: Array.from({ length: 6 }, (_, i) => ({ label: `도움말 ${i + 1} — 예약이 안 보일 때 확인할 것(예시)`, href: `https://help.example.com/${i + 1}` })),
    details: { summary: COPY.details.summary, rows: [...COPY.details.rows, { label: "요청 번호", value: "req_01J9Z7Q4K3M8N2P5R6S7T8U9V0" }] },
  },
  onRetry: retry,
}

// 최소: 번호·처음으로·도움말·자세히 없이, 다시 시도 없이(소비자가 끼우지 않은 경우).
export const fixtureMin: StateScreenErrorRetryProps = { copy: { title: COPY.title, body: COPY.body, retryLabel: COPY.retryLabel, retryingLabel: COPY.retryingLabel } }
