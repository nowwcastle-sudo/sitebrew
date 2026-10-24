// 이 패키지가 사람에게 보이는 문구(ko·en). 다른 패키지의 i18n 표는 건드리지 않고 여기 작게 둔다.
// 비밀값(VAPID 개인키)과 엔드포인트 주소는 문구에 넣지 않는다.
export type PushLocale = "ko" | "en"
export const DEFAULT_PUSH_LOCALE: PushLocale = "ko"

type Shape<T> = { readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> }

const KO = {
  signInRequired: "로그인이 필요해요.",
  unavailable: "지금은 알림을 보낼 수 없어요. 잠시 뒤에 다시 시도해 주세요.",
  notConfigured: "푸시 알림이 아직 설정되지 않았어요.",
  saveFailed: "알림 설정을 저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
  invalidInput: "입력을 확인해 주세요.",
  sub: {
    object: "구독 정보가 올바르지 않아요.",
    endpointRequired: "엔드포인트가 필요해요.",
    endpointHttps: "엔드포인트는 https 주소여야 해요.",
    endpointHost: "사용할 수 없는 엔드포인트 주소예요.",
    endpointLong: "엔드포인트가 너무 길어요.",
    p256dh: "p256dh 키가 올바르지 않아요.",
    auth: "auth 키가 올바르지 않아요.",
    expirationTime: "만료 시각이 올바르지 않아요.",
  },
  payload: {
    object: "알림 내용이 올바르지 않아요.",
    titleRequired: "알림 제목이 필요해요.",
    titleLong: "알림 제목이 너무 길어요.",
    bodyLong: "알림 본문이 너무 길어요.",
    url: "알림 링크는 이 사이트 안 경로(/로 시작)만 쓸 수 있어요.",
    tag: "알림 태그가 올바르지 않아요.",
    icon: "알림 아이콘은 이 사이트 안 경로(/로 시작)만 쓸 수 있어요.",
    tooLarge: "알림 내용이 너무 커서 보낼 수 없어요.",
  },
} as const

const EN: Shape<typeof KO> = {
  signInRequired: "Please sign in.",
  unavailable: "Notifications can't be sent right now. Please try again shortly.",
  notConfigured: "Push notifications are not set up yet.",
  saveFailed: "Couldn't save your notification settings. Please try again shortly.",
  invalidInput: "Please check your input.",
  sub: {
    object: "The subscription is not valid.",
    endpointRequired: "An endpoint is required.",
    endpointHttps: "The endpoint must be an https address.",
    endpointHost: "This endpoint address can't be used.",
    endpointLong: "The endpoint is too long.",
    p256dh: "The p256dh key is not valid.",
    auth: "The auth key is not valid.",
    expirationTime: "The expiration time is not valid.",
  },
  payload: {
    object: "The notification content is not valid.",
    titleRequired: "A notification title is required.",
    titleLong: "The notification title is too long.",
    bodyLong: "The notification body is too long.",
    url: "The notification link must be a path on this site (starting with /).",
    tag: "The notification tag is not valid.",
    icon: "The notification icon must be a path on this site (starting with /).",
    tooLarge: "The notification is too large to send.",
  },
}

export type PushMessages = Shape<typeof KO>

export function pushMessages(locale: PushLocale = DEFAULT_PUSH_LOCALE): PushMessages {
  return locale === "en" ? EN : KO
}
