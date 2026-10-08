import type { HeroCropMarksTypedTitleProps } from "./crop-marks-typed-title"

const terminal = {
  label: "터미널 예시",
  lines: ["# 알림 규칙 설치(예시)", "$ sp rules apply ./on-call.yml \\", "    --team payments --escalate 5m", "✓ 규칙 3개 적용 · 담당 2명 연결"],
}

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r10-console A 히어로의 문구 그대로.
export const fixture: HeroCropMarksTypedTitleProps = {
  copy: {
    label: "첫 화면",
    title: "Alerts that find the right person",
    lines: ["Alerts that", "find the right"],
    typed: "person",
    lede: "서비스 쉰 곳의 신호를 받아, 지금 깨어 있는 담당자 한 사람에게 보냅니다. 몇 분 안에 규칙 파일 하나로 시작합니다(예시).",
    primaryCta: { label: "규칙 파일 받기", href: "#rules" },
    secondaryCta: { label: "당번표 예시", href: "#rota" },
    terminal,
  },
  faces: ["field-1"],
}

// 최대: 긴 줄·긴 타자 낱말·터미널 여섯 줄.
export const fixtureMax: HeroCropMarksTypedTitleProps = {
  copy: {
    label: "첫 화면",
    title: "Alerts that always find the right responder",
    lines: ["Alerts that always", "find the right"],
    typed: "responder",
    lede: "서비스 쉰 곳의 신호를 받아, 지금 깨어 있는 담당자 한 사람에게 보냅니다. 응답이 없으면 5분 뒤 다음 사람에게 넘기고, 새벽에는 깨어 있는 사람만 고릅니다. 몇 분 안에 규칙 파일 하나로 시작합니다(예시).",
    primaryCta: { label: "규칙 파일 받기", href: "#rules" },
    secondaryCta: { label: "당번표 예시", href: "#rota" },
    terminal: { label: "터미널 예시", lines: [...terminal.lines, "✓ 새벽 당번 1명 · 대기 1명", "$ sp status --team payments"] },
  },
  faces: ["field-1"],
}

// 최소: 설명·보조 링크 없음, 터미널 한 줄, 면 없음.
export const fixtureMin: HeroCropMarksTypedTitleProps = {
  copy: {
    label: "첫 화면",
    title: "Alerts for you",
    lines: ["Alerts", "for"],
    typed: "you",
    primaryCta: { label: "받기", href: "#rules" },
    terminal: { label: "터미널 예시", lines: ["$ sp rules apply"] },
  },
}
