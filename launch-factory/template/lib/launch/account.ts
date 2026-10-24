// launch-factory: 셀프 탈퇴·내 정보 내려받기·파기 조립. 흐름은 @launch-factory/account-lifecycle 이 갖는다:
//   탈퇴 요청 = 살아 있는 구독을 먼저 기간 끝 해지 → 유예(기본 7일) 기록 → 세션 전부 끊기. 유예 중 다시 로그인하면 취소된다(인증 항목의 로그인 훅).
//   파기 Cron = 유예가 지난 요청을 잡아 구독 즉시 해지 → 개인 식별 정보 삭제(거래기록은 가명 참조로 분리 보존) → 계측 삭제.
import { authAdapter, isPlaceholderEmail, type LaunchAuthPort } from "@launch-factory/auth"
import { exportMyData, NO_ANALYTICS_ERASER, requestAccountDeletion, runPurge, type AnalyticsEraser, type PurgeReport } from "@launch-factory/account-lifecycle"
import { postHogEraser } from "@launch-factory/analytics-posthog/erase"
import { user } from "@launch-factory/db"
import { authEmails } from "@launch-factory/email"
import { eq } from "drizzle-orm"
import { authIO, getAuth } from "@/lib/launch/auth"
import { billingPorts } from "@/lib/launch/account-billing"
import { appUrl, DEFAULT_LOCALE, PRODUCT_NAME } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { env, optional, required } from "@/lib/launch/env"
import { mailer } from "@/lib/launch/mailer"
import { afterPurge, purgers } from "@/lib/launch/purgers"

/**
 * 탈퇴 접수 메일(D09). 새 요청일 때만 보낸다(두 번 눌러도 한 통). 메일이 실패해도 탈퇴는 이미 기록됐다 — 던지지 않고 이름만 로그로 남긴다(주소가 섞일 수 있어 메시지는 싣지 않는다).
 * 대체 주소(카카오 이메일 없는 계정)로는 보낼 수 없어 건너뛴다.
 */
async function sendDeletionReceipt(userId: string, graceUntil: string): Promise<void> {
  try {
    const [u] = await (await database()).select({ email: user.email, name: user.name, locale: user.locale, timeZone: user.timeZone }).from(user).where(eq(user.id, userId)).limit(1)
    if (!u || isPlaceholderEmail(u.email)) return
    await authEmails(mailer(), { productName: PRODUCT_NAME, defaultLocale: DEFAULT_LOCALE }).accountDeletionRequested(
      u.email,
      { graceUntil, signInUrl: `${appUrl()}/sign-in` },
      { name: u.name, locale: u.locale, timeZone: u.timeZone },
    )
  } catch (e) {
    console.error(`[account] deletion receipt email failed: ${e instanceof Error ? e.name : "unknown"}`)
  }
}

/** 탈퇴·내려받기가 켜진 인증 포트(서버 액션용). 결제 포트는 탈퇴를 요청할 때 처음 만든다 — 내려받기는 결제 키 없이도 된다 */
export async function accountPort(): Promise<LaunchAuthPort> {
  const db = await database()
  return authAdapter(await getAuth(), await authIO(), {
    callbackURL: "/",
    locale: DEFAULT_LOCALE,
    account: {
      requestDeletion: async (userId) => {
        const r = await requestAccountDeletion({ db, billingFor: await billingPorts() }, userId)
        if (r.ok && !r.alreadyRequested) await sendDeletionReceipt(userId, r.graceUntil)
        return r
      },
      exportData: (userId) => exportMyData(db, userId),
    },
  })
}

/**
 * live 는 PostHog 사람·이벤트·녹화를 지운다(개인 API 키). mock 은 지우지 않는다(계측 공급자가 없다).
 * 분석은 선택이다(LFOBS): POSTHOG_HOST·지움 키가 모두 없으면 분석을 켠 적이 없다 — PostHog 에 쌓인 것이 없어 지울 것이 없다(DB 파기는 그대로 돈다).
 * 일부만 있으면 지울 수 없는 상태다 — 던져서 파기 Cron 전체를 멈추지 않고, 지움 단계가 「분석 지움 실패」로 남아 계속 다시 시도하게 한다(빠진 이름만 알린다).
 */
export function analyticsEraser(): AnalyticsEraser {
  if (env().LF_MODE !== "live") return NO_ANALYTICS_ERASER
  const host = optional("POSTHOG_HOST")
  const personalApiKey = optional("POSTHOG_PERSONAL_API_KEY")
  const projectId = optional("POSTHOG_PROJECT_ID")
  if (!host && !personalApiKey && !projectId) return NO_ANALYTICS_ERASER
  const missing = Object.entries({ POSTHOG_HOST: host, POSTHOG_PERSONAL_API_KEY: personalApiKey, POSTHOG_PROJECT_ID: projectId }).filter(([, v]) => !v).map(([n]) => n)
  if (missing.length) {
    return {
      erase: async () => {
        throw Object.assign(new Error(`PostHog erase is not configured: ${missing.join(", ")} is not set (see .env.example)`), { code: "not_configured" })
      },
    }
  }
  return postHogEraser({ personalApiKey: required("POSTHOG_PERSONAL_API_KEY"), projectId: required("POSTHOG_PROJECT_ID"), host: required("POSTHOG_HOST") })
}

/** 파기 Cron 본체. SUBJECT_REF_KEY(32자 이상)로 거래기록의 가명 참조를 만든다 — 바꾸면 이미 남긴 기록을 이메일로 찾을 수 없다 */
export async function purge(): Promise<PurgeReport> {
  const report = await runPurge({ db: await database(), billingFor: await billingPorts(), subjectKey: required("SUBJECT_REF_KEY"), analytics: analyticsEraser(), purgers })
  // 커밋된 뒤의 정리(예: 올린 파일 객체 삭제). 실패해도 파기는 끝났다 — 이름만 남기고, 못 지운 것은 각 기능의 Cron 이 다시 한다
  if (report.purged > 0) {
    try {
      await afterPurge()
    } catch (e) {
      console.error(`[account] after-purge cleanup failed: ${e instanceof Error ? e.name : "unknown"}`)
    }
  }
  return report
}
