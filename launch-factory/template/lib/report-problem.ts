// 문제 신고(D95)의 Sentry 피드백 설정 — 한국어는 제품이 문구를 바꾼다(지금 제품 화면은 영어다). 이름·이메일 칸과 스크린샷은 받지 않는다: 사용자가 쓴 글 한 칸만 Sentry 로 간다.
// 바닥글 단추(components/product/report-problem.tsx)가 이 옵션으로 만든 피드백에 붙는다. 단추는 lib/launch/feedback.ts 의 스위치가 켜졌을 때만 그려진다.
export const REPORT_PROBLEM_OPTIONS = {
  autoInject: false,
  showBranding: false,
  colorScheme: "system",
  showName: false,
  showEmail: false,
  isNameRequired: false,
  isEmailRequired: false,
  enableScreenshot: false,
  formTitle: "Report a problem",
  submitButtonLabel: "Send",
  cancelButtonLabel: "Cancel",
  messageLabel: "What went wrong?",
  messagePlaceholder: "Describe the problem. Please do not write passwords or personal details here.",
  successMessageText: "Thank you. We received your report.",
} as const
