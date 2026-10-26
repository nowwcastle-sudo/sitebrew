// 법정 쪽(약관·개인정보·환불) 본문의 자리표시 `{{이름.칸}}` 를 채운다. 별칭(@/) 없이 쓴다 — 시험이 직접 불러 본다.
// 값의 출처는 셋이다. 어떤 값도 이 저장소 코드에 박지 않는다(남도 쓰는 공장).
//   business.*  제품 설정(LF_BUSINESS_*, @launch-factory/env businessInfo) — 상호·대표자·주소·전화·이메일·사업자등록번호·통신판매업 신고번호·호스팅 업체
//   product.*   제품 코드가 정한 값(이름·탈퇴 유예 일수)
//   legal.*     content/legal/variables.json — 제품·운영자가 정하는 값(시행일·준거법·관할·DB 지역·환불 기간). 개인정보 보호책임자는 business.owner(대표자)다
// 값이 없으면 본문에 「[이름 — to be confirmed]」가 그대로 보이고, status 가 "final" 이면 그리지 않고 던진다(공개 불가).

export const LEGAL_TOKEN = /\{\{\s*([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+)\s*\}\}/g

/** 「business.name」 → 값. 빈 문자열·공백뿐인 값은 없는 것으로 본다 */
export type LegalVars = Record<string, string | undefined>

export const BUSINESS_TOKEN_KEYS = ["name", "owner", "address", "phone", "email", "regNo", "mailOrderNo", "hostingProvider"] as const

/** 본문에 쓰인 자리표시 이름(중복 없이, 나온 순서) */
export function tokensIn(text: string): string[] {
  return [...new Set([...text.matchAll(LEGAL_TOKEN)].map((m) => m[1] as string))]
}

/** 자리표시를 값으로 바꾼다. 값이 없는 것은 「[이름 — to be confirmed]」로 두고 unresolved 에 담는다 */
export function fillLegalText(text: string, vars: LegalVars): { text: string; unresolved: string[] } {
  const unresolved: string[] = []
  const out = text.replace(LEGAL_TOKEN, (_all, key: string) => {
    const v = vars[key]?.trim()
    if (v) return v
    if (!unresolved.includes(key)) unresolved.push(key)
    return `[${key} — to be confirmed]`
  })
  return { text: out, unresolved }
}

/** 세 출처를 한 표로 합친다 */
export function legalVars(src: {
  business: Partial<Record<(typeof BUSINESS_TOKEN_KEYS)[number], string>>
  product: Record<string, string | number | undefined>
  legal: Record<string, string | undefined>
}): LegalVars {
  const out: LegalVars = {}
  for (const k of BUSINESS_TOKEN_KEYS) out[`business.${k}`] = src.business[k]
  for (const [k, v] of Object.entries(src.product)) out[`product.${k}`] = v === undefined ? undefined : String(v)
  for (const [k, v] of Object.entries(src.legal)) out[`legal.${k}`] = v
  return out
}

export interface LegalDoc {
  status: string
  contact: string
  notice?: string
  clauses: { title: string; text: string }[]
}

/**
 * 문의 화면(/contact)이 없는 제품(문의를 고르지 않음)의 본문: 「our Contact page (/contact)」 안내를 사업자 이메일 자리표시로 바꾼다.
 * 이메일이 이미 적힌 문장(「… or use our Contact page」)은 문의 화면 쪽만 뺀다. 자리표시는 fillLegalDoc 이 채우므로 값이 없으면 「to be confirmed」로 보인다
 */
export function withoutContactPage(text: string): string {
  const email = "{{business.email}}"
  return text
    .replace(/\s+or\s+(?:use|on) our Contact page \(\/contact\)/g, "")
    .replace(/\bon our Contact page \(\/contact\)/g, `at ${email}`)
    .replace(/our Contact page \(\/contact\),\s+or\s+/g, "")
    .replace(/our Contact page \(\/contact\)/g, email)
}

/** 문서 하나의 모든 글(안내·조항 본문)에 withoutContactPage 를 적용한다 */
export function legalDocWithoutContactPage(doc: LegalDoc): LegalDoc {
  return { ...doc, ...(doc.notice === undefined ? {} : { notice: withoutContactPage(doc.notice) }), clauses: doc.clauses.map((c) => ({ ...c, text: withoutContactPage(c.text) })) }
}

/** 문서 하나(안내·연락처·조항 제목과 본문)를 채운다. 못 채운 이름은 모아서 돌려준다 */
export function fillLegalDoc(doc: LegalDoc, vars: LegalVars): { doc: LegalDoc; unresolved: string[] } {
  const unresolved: string[] = []
  const fill = (s: string) => {
    const r = fillLegalText(s, vars)
    for (const u of r.unresolved) if (!unresolved.includes(u)) unresolved.push(u)
    return r.text
  }
  return {
    doc: {
      status: doc.status,
      contact: fill(doc.contact),
      ...(doc.notice === undefined ? {} : { notice: fill(doc.notice) }),
      clauses: doc.clauses.map((c) => ({ title: fill(c.title), text: fill(c.text) })),
    },
    unresolved,
  }
}

/** 공개 상태. placeholder = 본문 없음 · draft = 초안을 검토했고 운영자 승인을 기다림(공개 불가) · final = 운영자가 승인함 */
export const LEGAL_STATUSES = ["placeholder", "draft", "final"] as const
export type LegalStatus = (typeof LEGAL_STATUSES)[number]

/** final 이 아닌 쪽이 하나라도 있으면 공개하면 안 된다(doctor 의 legal-pages 점검이 이 판정을 쓴다) */
export function legalPublishIssues(docs: Record<string, { status: string }>): string[] {
  return Object.entries(docs).flatMap(([slug, d]) => (d.status === "final" ? [] : [`${slug}: ${d.status}`]))
}
