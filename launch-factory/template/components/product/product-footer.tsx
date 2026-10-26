import { FooterProductLegal } from "@/components/blocks/footer/product-legal"
import { footerCopy } from "@/content/copy.shell.en"
import { footerBusiness } from "@/lib/footer-business"
import { hasPart } from "@/lib/launch/enabled"
import { ReportProblem } from "@/components/product/report-problem"
import { REPORT_PROBLEM_ENABLED } from "@/lib/launch/feedback"
import { analyticsEnabled, sentryDsn } from "@/lib/observability"

// 바닥글(K03·K04 · web-factory `footer/product-legal`): 제품 이름 · 약관·개인정보·환불·문의 링크 · 「Cookie settings」 + 사업자 정보 칸(값은 제품 설정에서 — lib/footer-business.ts, 빈 칸은 숨김).
// 서버 컴포넌트라 환경 변수를 요청 때 읽는다(루트 레이아웃이 headers() 를 읽으므로 모든 쪽이 동적 렌더링이다). 값이 하나도 없으면 사업자 정보 구획 자체가 없다(블록이 숨긴다).
// 블록을 서버에서 바로 그린다 — v0.0.11 부터 「쿠키 설정」 링크의 속성(`consentOpenAttrs`)이 "use client" 밖(`_shared/consent-open-attrs`)에 있어 서버 HTML 에도 `data-consent-open` 이 나간다.
// (v0.0.10 에서는 클라이언트 껍데기 `product-footer-client.tsx` 가 필요했다 — docs/qa/lfpin-v011.md)
// 분석이 꺼진 제품(live 인데 POSTHOG_HOST 나 POSTHOG_PROJECT_KEY 없음 — LFOBS·LFOBS2)에는 바꿀 선택 쿠키가 없다: 「Cookie settings」 링크도 뺀다(눌러도 열 대화상자가 없다).
export function ProductFooter() {
  const withoutCookies = { ...footerCopy, cookieSettings: undefined }
  // 분석을 고르지 않은 제품(enabled.json 에 analytics-posthog 없음)도 같다 — 동의 띠가 없어 「Cookie settings」가 열 대화상자가 없다
  const copy = hasPart("analytics-posthog") && analyticsEnabled(process.env.LF_MODE, process.env.POSTHOG_HOST, process.env.POSTHOG_PROJECT_KEY) ? footerCopy : withoutCookies
  // 「Report a problem」(D95)은 제품이 스위치를 켰고(lib/launch/feedback.ts) 오류 수집이 켜져 있을 때만 — 피드백은 Sentry 로 가므로 DSN 이 없으면 보낼 곳이 없다
  const reportProblem = REPORT_PROBLEM_ENABLED && sentryDsn() !== undefined
  return (
    <>
      <FooterProductLegal copy={copy} business={footerBusiness()} />
      {reportProblem ? (
        <div className="flex justify-center pb-4">
          <ReportProblem />
        </div>
      ) : null}
    </>
  )
}
