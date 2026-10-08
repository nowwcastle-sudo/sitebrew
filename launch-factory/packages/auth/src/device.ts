// 기기 판별(기기 목록 C05 · 새 기기 로그인 알림 C06). User-Agent 에서 브라우저·운영체제 이름만 뽑는다 — 원문 UA 는 저장하지 않는다.
// 기기 지문 = sha256(사용자 id + 브라우저 + 운영체제)의 앞 32자: 같은 사용자가 같은 브라우저·같은 OS 로 오면 같은 기기로 본다(브라우저 업데이트·IP 변화로 흔들리지 않는다).
// 쿠키를 지운 같은 브라우저도 같은 기기로 본다(알림이 너무 잦으면 안 된다). 다른 사용자와는 지문이 겹치지 않는다(사용자 id 가 섞인다).
// 대략적인 위치는 제3자 조회 없이 호스팅이 요청 머리로 주는 값만 쓴다: Vercel 의 x-vercel-ip-city(퍼센트 인코딩)·x-vercel-ip-country. 없으면 위치를 싣지 않는다.
import { createHash } from "node:crypto"
import { fill, messages, type Locale } from "@launch-factory/i18n"

export const BROWSERS = [
  [/KAKAOTALK/i, "KakaoTalk"],
  [/NAVER\(inapp/i, "Naver app"],
  [/Whale\//, "Whale"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
] as const
export const SYSTEMS = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
] as const

/** User-Agent → 브라우저·운영체제 이름(모르면 undefined) */
export function deviceParts(ua: string | null | undefined): { browser?: string; os?: string } {
  const s = ua ?? ""
  return { browser: BROWSERS.find(([re]) => re.test(s))?.[1], os: SYSTEMS.find(([re]) => re.test(s))?.[1] }
}

/** 알림 메일에 싣는 기기 이름(사용자 언어 — 메시지 auth.deviceName). 브라우저·OS 둘 다 모르면 「알 수 없는 기기」 */
export function deviceLabel(ua: string | null | undefined, locale: Locale): string {
  const m = messages(locale).auth
  const { browser, os } = deviceParts(ua)
  if (browser && os) return fill(m.deviceName, { browser, os })
  return browser ?? os ?? m.unknownDevice
}

/** 사용자 한 명의 기기 지문. 브라우저·OS 를 둘 다 모르면 「알 수 없는 기기」 한 칸으로 묶인다 */
export function deviceFingerprint(userId: string, ua: string | null | undefined): string {
  const { browser, os } = deviceParts(ua)
  return createHash("sha256").update(`lf-device:${userId}:${browser ?? "?"}:${os ?? "?"}`).digest("hex").slice(0, 32)
}

/** 호스팅이 요청 머리로 준 대략적인 위치 한 줄(예: 「Seoul, KR」). 없거나 이상하면 undefined — 제3자 IP 조회는 하지 않는다 */
export function roughLocation(headers: Pick<Headers, "get"> | undefined): string | undefined {
  if (!headers) return undefined
  const clean = (v: string | null): string | undefined => {
    if (!v) return undefined
    let decoded: string
    try {
      decoded = decodeURIComponent(v)
    } catch {
      return undefined
    }
    const s = decoded.trim()
    return s && s.length <= 64 && !/[\p{Cc}<>]/u.test(s) ? s : undefined
  }
  const city = clean(headers.get("x-vercel-ip-city"))
  const country = clean(headers.get("x-vercel-ip-country"))
  if (city && country) return `${city}, ${country}`
  return country ?? city
}
