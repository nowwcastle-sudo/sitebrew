// launch-factory: 동의 조립. 가입 때의 약관·개인정보·만 14세 동의 기록은 인증 항목이 이미 남긴다(consent_records, 추가만 하는 이력 — 고칠 수 없다).
// 이 파일은 그 뒤의 동의를 다룬다: 채널별 마케팅 수신 동의(NotifyPort)와 본인 동의 이력 읽기. 로그인한 본인만 — 사용자 id 는 세션에서 읽는다.
import { notifyAdapter, type MarketingChangeEvent } from "@launch-factory/consent"
import { consentHistory, type NoticeSource } from "@launch-factory/db"
import { authPort } from "@/lib/launch/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { sendMarketingNotice } from "@/lib/launch/notices"

/** 지금 로그인한 본인의 id. 없으면 null. 대리 로그인 세션의 주인은 대상 사용자다 — 관리자가 대신 동의·거부를 바꾸지 못하도록 본인이 아닌 것으로 본다 */
export async function currentUserId(): Promise<string | null> {
  const s = await (await authPort()).session()
  return s.ok && s.data && !s.data.impersonatedBy ? s.data.userId : null
}

/**
 * 처리 결과 통지(정보통신망법 제50조제7항 · 시행령 제62조의2 — 의사를 표시한 날부터 14일 안에 전송자 명칭·의사 표시 사실과 날짜·처리 결과, 대장 D201).
 * 동의·거부·철회를 표시할 때마다 그 사람의 메일로 바로 보낸다(같은 값을 다시 표시해도 보낸다). 보내기가 실패하면 발신함에 남고 Cron(/api/cron/notices)이 다시 보낸다(대장 D210) —
 * 설정 저장은 되돌리지 않는다. 대체 주소(카카오 이메일 없는 계정)로는 보낼 수 없어 건너뛴다: 화면 응답이 통지를 대신하지 못하니 그런 계정에 마케팅을 켜기 전에 다른 통지 수단을 정해야 한다.
 * 보내는 일은 lib/launch/notices.ts 한 곳이다(가입·설정·수신거부 링크가 같은 길).
 */
export async function sendResultNotice(event: MarketingChangeEvent, source: NoticeSource = "settings"): Promise<void> {
  await sendMarketingNotice({ userId: event.userId, changes: event.changes, at: event.at }, source)
}

/**
 * 마케팅 수신 동의 포트. 채널(이메일·문자·카카오·푸시)마다 기본 거부이고, 바꿀 때마다 이력이 남는다(정보통신망법 제50조).
 * 바꿀 때마다 처리 결과 통지 메일이 나간다(제50조제7항).
 */
export async function notifyPort() {
  return notifyAdapter({ db: await database(), userId: currentUserId, locale: DEFAULT_LOCALE, onChange: sendResultNotice })
}

/** 본인의 동의 이력(오래된 것부터). 증빙에 쓰는 칸만 돌려준다 */
export async function myConsentHistory() {
  const userId = await currentUserId()
  if (!userId) return null
  const rows = await consentHistory(await database(), userId)
  return rows.map((r) => ({ kind: r.kind, granted: r.granted, version: r.version, source: r.source, locale: r.locale, at: r.createdAt.toISOString() }))
}
