import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockNotify } from "@/registry/factory/contract/adapter-mock"

import type { AccountNotificationConsentsCopy, AccountNotificationConsentsProps } from "./notification-consents"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 알림 수신 설정. 문구는 해요체.
// 갤러리 포트: ?consent=unset(기본 — 모두 꺼짐)|all(모두 켜짐) · &state=(consents 읽기) · &submit=(setConsents 결과 — 실패면 스위치가 되돌아간다).
const COPY: AccountNotificationConsentsCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "알림 받기 설정",
  lead: "혜택·새 기능 소식을 어디로 받을지 골라요. 모두 선택이에요(예시).",
  marker: "(선택)",
  channels: {
    email: { label: "이메일", body: "한 달에 두 번, 새 기능과 쓰는 요령을 보내요." },
    sms: { label: "문자", body: "할인·이벤트가 있을 때만 보내요." },
    kakao: { label: "카카오톡", body: "혜택 소식을 알림톡으로 보내요." },
    push: { label: "앱 알림", body: "앱에서 새 기능을 알려요. 일정 알림과는 따로예요." },
  },
  saved: "{date}에 {channel} 수신을 「{state}」로 바꿨어요.",
  on: "받기",
  off: "안 받기",
  lastUpdated: "마지막으로 바꾼 날: {date}",
  failed: "{channel} 설정을 저장하지 못했어요. 스위치를 되돌렸으니 잠시 뒤 다시 바꿔 주세요.",
  required: "결제·보안·일정 알림은 서비스 이용에 필요해서 이 설정과 상관없이 보내요.",
  loading: "알림 설정을 불러오는 중이에요",
  error: "알림 설정을 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: AccountNotificationConsentsProps = {
  copy: COPY,
  consents: async () => ({ ok: true, data: { email: false, sms: false, kakao: false, push: false } }),
  setConsents: async () => ({ ok: true, data: { updatedAt: "2026-10-01T00:00:00.000Z" } }),
}

export const fixtureMax: AccountNotificationConsentsProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "알림 받기 설정 — 혜택·새 기능 소식을 받을 곳을 골라요(예시)",
    lead: "혜택·새 기능 소식을 어디로 받을지 골라요. 모두 선택이고, 받지 않아도 서비스는 똑같이 쓸 수 있어요. 바꾼 결과는 바로 아래에 적어 두고 2년 동안 보관해요(예시).",
    channels: {
      email: { label: "이메일", body: "한 달에 두 번, 새 기능과 쓰는 요령을 보내요. 메일 아래 「수신 거부」로도 끌 수 있어요." },
      sms: { label: "문자", body: "할인·이벤트가 있을 때만 보내요. 밤 9시부터 아침 8시까지는 보내지 않아요." },
      kakao: { label: "카카오톡", body: "혜택 소식을 알림톡으로 보내요. 카카오톡 채널을 추가하지 않아도 받을 수 있어요." },
      push: { label: "앱 알림", body: "앱에서 새 기능을 알려요. 일정 알림은 휴대폰의 앱 알림 설정을 따라요." },
    },
  },
}

export const fixtureMin: AccountNotificationConsentsProps = { ...fixture, copy: { ...COPY, lead: undefined } }

export const fixturePorts = (q: URLSearchParams): Partial<AccountNotificationConsentsProps> => {
  const notify = mockNotify(q, { requireConfirmation: true })
  // &channels=email,push: 이 제품이 쓰는 채널만 그린다(REL12). 없으면 문구가 있는 채널 전부(예전 그대로)
  const ch = q.get("channels")
  const channels = ch ? (ch.split(",").filter((c): c is "email" | "sms" | "kakao" | "push" => ["email", "sms", "kakao", "push"].includes(c))) : undefined
  return { consents: notify.consents, setConsents: notify.setConsents, ...(channels ? { channels } : {}) }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: AccountNotificationConsentsProps = {
  ...fixture,
  copy: {
    humanHint: "You'll confirm this yourself",
    title: "Notification settings",
    lead: "Choose where to get news about offers and new features. Everything here is optional (example).",
    marker: "(Optional)",
    channels: {
      email: {
        label: "Email",
        body: "Twice a month, we send new features and tips.",
      },
      sms: {
        label: "Text message",
        body: "Only when there's a discount or event.",
      },
      kakao: {
        label: "KakaoTalk",
        body: "We send offers as Kakao notifications.",
      },
      push: {
        label: "App notifications",
        body: "The app tells you about new features. This is separate from activity alerts.",
      },
    },
    saved: "On {date}, you set {channel} to “{state}”.",
    on: "On",
    off: "Off",
    lastUpdated: "Last changed: {date}",
    failed: "We couldn't save the {channel} setting. The switch was reset, so please try again in a moment.",
    required: "Billing, security and activity alerts are needed to use the service, so we send them regardless of these settings.",
    loading: "Loading notification settings",
    error: "We couldn't load notification settings",
    retry: "Reload",
  },
}
