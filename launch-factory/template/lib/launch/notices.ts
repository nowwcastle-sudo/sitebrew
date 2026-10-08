// launch-factory: 마케팅 수신 처리 결과 통지 메일 보내기(D201·D210). 가입(lib/launch/auth.ts)·설정 화면·수신거부 링크(동의 항목)가 모두 이 파일로 보낸다.
// 정보통신망법 제50조제7항 · 시행령 제62조의2 — 의사를 표시한 날부터 14일 안에 전송자 명칭·의사 표시 사실과 날짜·처리 결과를 알려야 한다.
// 보내기가 실패하면 발신함(marketing_notice_outbox)에 남고 Cron(/api/cron/notices, 동의 항목)이 늘어나는 간격으로 다시 보낸다(상한을 다 쓰면 멈추고 로그로 알린다).
// 한 통은 한 번만 나간다: 메일에는 발신함 행의 멱등 키(notice:<id>)가 가고, 보낸 행은 다시 뽑히지 않는다.
import { isPlaceholderEmail } from "@launch-factory/auth"
import { deliverNotice, runNoticeRetries, type NoticeEvent, type NoticeRetryResult, type NoticeSend } from "@launch-factory/consent"
import { user, type NoticeSource } from "@launch-factory/db"
import { consentEmails } from "@launch-factory/email"
import { eq } from "drizzle-orm"
import { DEFAULT_LOCALE, PRODUCT_NAME } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { mailer } from "@/lib/launch/mailer"

/**
 * 통지 한 통을 그 사람의 메일로 보낸다(주소·이름·언어는 보낼 때 사용자 표에서 읽는다 — 발신함에는 두지 않는다).
 * 대체 주소(카카오 이메일 없는 계정)는 보낼 수 없어 "skipped" 다: 화면 응답이 통지를 대신하지 못하니 그런 계정에 마케팅을 켜기 전에 다른 통지 수단을 정해야 한다(대장 D210).
 */
const send: NoticeSend = async (n) => {
  const [u] = await (await database()).select({ email: user.email, name: user.name, locale: user.locale, timeZone: user.timeZone }).from(user).where(eq(user.id, n.userId)).limit(1)
  if (!u || isPlaceholderEmail(u.email)) return "skipped"
  await consentEmails(mailer(), { productName: PRODUCT_NAME, defaultLocale: DEFAULT_LOCALE }).marketingResult(u.email, { changes: n.changes, at: n.at, idempotencyKey: n.idempotencyKey }, { name: u.name, locale: u.locale, timeZone: u.timeZone })
}

/** 동의·거부·철회를 표시했을 때 부른다. 실패하면 발신함에 남는다 — 던지는 것은 발신함에도 못 넣었을 때뿐이다(부르는 쪽이 로그로 남긴다) */
export async function sendMarketingNotice(event: NoticeEvent, source: NoticeSource): Promise<void> {
  await deliverNotice({ db: await database(), event, source, send })
}

/** Cron 이 부른다: 때가 된 통지를 다시 보낸다. 두 번(동시에도) 와도 한 통은 한 번만 나간다 */
export async function retryMarketingNotices(): Promise<NoticeRetryResult> {
  return runNoticeRetries({ db: await database(), send })
}
