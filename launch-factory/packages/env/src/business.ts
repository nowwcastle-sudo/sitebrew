// 사업자 정보 설정(K03 — 전자상거래법 제10조 · 시행규칙 제7조: 초기 화면에 상호·대표자·주소·전화·이메일·사업자등록번호·약관·호스팅 서비스 제공자 상호,
// 통신판매업 신고번호는 신고 대상일 때). 값은 **제품 설정(환경 변수)에서 읽는다** — 공장 코드·블록·예시에 실제 값을 넣지 않는다(남도 쓰는 공장, 대표 10-03).
// 모든 칸은 선택이다. 푸터 블록은 filledBusinessInfo() 가 돌려준 **채워진 칸만** 그린다(빈 칸은 숨긴다). 푸터 화면은 web-factory 블록이 맡는다(이 파일은 값만).
// 이름과 뜻은 .env.example 의 「사업자 정보」 절. doctor 의 business-info 점검이 live·preview 에서 필수 칸이 비면 경고한다(값은 출력하지 않는다).

/** 칸 키 → 환경 변수 이름. 표시 순서가 이 순서다 */
export const BUSINESS_ENV = {
  name: "LF_BUSINESS_NAME",
  owner: "LF_BUSINESS_OWNER",
  address: "LF_BUSINESS_ADDRESS",
  phone: "LF_BUSINESS_PHONE",
  email: "LF_BUSINESS_EMAIL",
  regNo: "LF_BUSINESS_REG_NO",
  mailOrderNo: "LF_MAIL_ORDER_NO",
  hostingProvider: "LF_HOSTING_PROVIDER",
} as const

export type BusinessKey = keyof typeof BUSINESS_ENV
export const BUSINESS_KEYS = Object.keys(BUSINESS_ENV) as BusinessKey[]
/** 환경 변수 이름 목록(doctor 가 읽는 이름 목록에 합친다) */
export const BUSINESS_ENV_NAMES = Object.values(BUSINESS_ENV)

/** 값이 있는 칸만 담는다(모든 칸 선택). 값은 앞뒤 공백을 뗀 문자열 */
export type BusinessInfo = Partial<Record<BusinessKey, string>>

/** 화면에 보이는 기본 이름(영어). 제품이 문구 파일로 바꿔 쓴다 */
export const BUSINESS_LABELS: Record<BusinessKey, string> = {
  name: "Business name",
  owner: "Representative",
  address: "Address",
  phone: "Phone",
  email: "Email",
  regNo: "Business registration no.",
  mailOrderNo: "Mail-order business report no.",
  hostingProvider: "Hosting provider",
}

/**
 * 표시 의무가 있는 칸(전상법 제10조·시행규칙 제7조). 통신판매업 신고번호(mailOrderNo)는 간이과세자이거나 직전 연도 거래가 50회 미만이면 신고가 면제라(공정위 고시 2022-4)
 * 필수가 아니다 — 신고 대상이 되면 값을 넣는다.
 */
export const REQUIRED_BUSINESS_KEYS: readonly BusinessKey[] = ["name", "owner", "address", "phone", "email", "regNo", "hostingProvider"]

type Source = Record<string, string | undefined>

/** 환경 변수에서 사업자 정보를 읽는다. 비었거나 공백뿐인 칸은 없는 것으로 본다 */
export function businessInfo(env: Source = process.env): BusinessInfo {
  const out: BusinessInfo = {}
  for (const key of BUSINESS_KEYS) {
    const v = env[BUSINESS_ENV[key]]?.trim()
    if (v) out[key] = v
  }
  return out
}

export interface BusinessField {
  key: BusinessKey
  envName: string
  label: string
  value: string
}

/** 채워진 칸만, 표시 순서대로. 푸터가 이 목록을 그대로 그리면 빈 칸은 숨겨진다 */
export function filledBusinessInfo(env: Source = process.env): BusinessField[] {
  const info = businessInfo(env)
  return BUSINESS_KEYS.flatMap((key) => {
    const value = info[key]
    return value ? [{ key, envName: BUSINESS_ENV[key], label: BUSINESS_LABELS[key], value }] : []
  })
}

/** 표시 의무가 있는데 비어 있는 칸의 환경 변수 이름(값은 다루지 않는다) */
export function missingRequiredBusinessInfo(env: Source = process.env): string[] {
  const info = businessInfo(env)
  return REQUIRED_BUSINESS_KEYS.filter((k) => !info[k]).map((k) => BUSINESS_ENV[k])
}
