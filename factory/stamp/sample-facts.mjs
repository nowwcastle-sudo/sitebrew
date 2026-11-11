// 예시 정보(v0.2.6 T5 · 설계 D5~D6) — 시안 단계에서 빈 필수 사실을 키트 고정 표의 가상 값으로 채운다.
//   · 값은 brief 에 굽지 않는다. `<run>/sample-facts.json` 한 파일에 모으고, stamp 가 메모리에서 `{ ...예시, ...brief.facts }` 로 덧씌운다(실제 값이 이긴다).
//   · 채우는 범위는 그 실행에서 지금 「확인 필요 사실」이 될 필수 키뿐이다(brief.mjs requiredFacts + content.mjs 스키마 요구 칸).
//     채우지 않는 것: 선택 섹션을 여는 사실(sitemap.mjs SECTION_FACTS), 법정 사실(legal.*), 사회적 증거(후기·고객사·수상 — 지어내지 않는다, A3).
//   · 답한 사실은 건드리지 않는다. 키가 brief.facts 에 있으면 빈 문자열("")도 답한 것이다 — intake 의 null("우리에게 없는 사실")이 이 길로 예시를 막는다.
//   · 이 모듈은 brief.mjs·content.mjs·sitemap.mjs 를 읽기 전용으로 부른다. 닫힘(06 코드 열쇠) 안의 파일은 이 모듈을 import 하지 않는다 — stamp.mjs·deliver.mjs 만 부른다.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { briefToSeed } from './brief.mjs'
import { SCHEMA_FACTS, schemaMissing } from './content.mjs'

export const SAMPLE_VERSION = 1
export const SAMPLE_LABEL = '예시 정보 — 공개 불가'
export const SAMPLE_FILE = 'sample-facts.json'
// 예시가 남은 채 미리보기를 올리는 실행의 표지 — 08-board.json sampleNotice 와 CLI 한 줄(F9). 막지는 않는다.
export const SAMPLE_PREVIEW_NOTICE = '예시 정보가 든 미리보기 — 실제 값으로 바꾸기 전에는 공개하지 않는다'

// 지어내지 않는 사실: 사회적 증거(후기·고객사·수상·인증). 법정 사실은 이름이 legal 로 시작하는 키 전부.
const SOCIAL_PROOF = new Set(['reviews', 'testimonials', 'clients', 'awards', 'recognition', 'externalReviews', 'reviewLinks', 'rating'])
const isLegalKey = (k) => /^legal(?:\.|$)/i.test(k)
// 선택 섹션을 여는 사실(sitemap.mjs SECTION_FACTS)은 범위에 들 수 없다: 범위는 필수 키에서만 나오기 때문이다. 필수이면서 섹션도 여는 이름(hours·price·shipping)만 겹치고, 그건 거래 조건이라 채운다.

// ── 고정 표 ──────────────────────────────────────────────────────────────
// 값 규칙: 메일·주소 도메인은 example.com, 사업자번호는 검증 숫자가 틀린 번호, 도로명은 없는 이름, 전화는 0000, 가격은 둥근 숫자.
// 영어 전화는 +82-2-0000-0000 이다: Business.phone 은 한국 번호만 받는다(P2 F6 — +1 555-0100 은 스키마를 통과하지 못한다).
// scan: false 인 값은 deliver 의 값 스캔(site.json 에서 글자 그대로 찾기)에서 뺀다 — 열거형·짧은 값은 실제 사이트에도 우연히 있을 수 있다.
const same = (v) => ({ ko: v, en: v })
const EXAMPLE_URL = (path) => same(`https://example.com/${path}`)
const SAMPLES = {
  representative: { ko: '홍길동', en: 'Gil-dong Hong' },
  legalName: { ko: '예시컴퍼니 주식회사', en: 'Example Company Ltd.' },
  bizNo: same('123-45-67890'),
  mailOrderNo: same('제0000-서울예시-0000호'),
  address: { ko: '서울특별시 예시구 예시로 00길 0', en: '0 Yesi-ro 00-gil, Yesi-gu, Seoul' },
  phone: { ko: '02-0000-0000', en: '+82-2-0000-0000' },
  email: same('hello@example.com'),
  hours: { ko: '월~금 09:00~18:00, 토·일·공휴일 휴무', en: 'Mon-Fri 09:00-18:00, closed on weekends and holidays' },
  seller: { ko: '예시상회', en: 'Example Shop' },
  shipping: { ko: '결제 후 영업일 기준 2~3일 안에 보내요. 배송비 3,000원, 5만원 이상 무료예요', en: 'Ships within 2-3 business days. Shipping fee $5, free over $50' },
  returns: { ko: '받은 날부터 7일 안에 반품할 수 있어요. 단순 변심 반품 배송비는 고객이 부담해요', en: 'Returns accepted within 7 days of delivery. The buyer pays return shipping for a change of mind' },
  shippingFee: { ko: '3,000원', en: '$5' },
  returnsFeePayer: { ...same('buyer'), scan: false },
  courier: { ko: '예시택배', en: 'Example Courier' },
  noticeCategory: { ko: '예시 품목', en: 'Example item' },
  noticeRows: { ko: '제조국: 예시국 ; 품질보증기준: 예시 기준', en: 'Country of origin: Exampleland ; Warranty: Example terms' },
  naverMapUrl: EXAMPLE_URL('maps/naver/sample'),
  kakaoMapUrl: EXAMPLE_URL('maps/kakao/sample'),
  transit: { ko: '예시역 1번 출구에서 걸어서 5분', en: '5 minutes on foot from Example Station, exit 1' },
  parking: { ko: '예시 주차장 이용(2시간 무료)', en: 'Example parking lot (2 hours free)' },
  refresh: { ko: '5분마다 새로 고쳐요', en: 'Refreshes every 5 minutes' },
  phoneNote: { ko: '평일 09:00~18:00에 받아요', en: 'Weekdays 09:00-18:00' },
  accessibilityPolicyUrl: EXAMPLE_URL('accessibility'),
  copyright: { ko: '© 예시컴퍼니. 모든 권리를 가지고 있어요', en: '© Example Company. All rights reserved' },
  productUrl: EXAMPLE_URL('app'),
  companyUrl: EXAMPLE_URL(''),
  eventDate: { ko: '2027-03-06(토) 10:00~18:00', en: 'Sat, 2027-03-06, 10:00-18:00' },
  eventVenue: { ko: '예시홀 2층', en: 'Example Hall, 2nd floor' },
}
// 가격은 원형마다 흔한 모양이 다르다. 월 구독(saas)과 그 밖(한 번 사는 값).
const PRICES = {
  saas: { ko: '월 49,000원(부가세 포함)', en: '$49 per month' },
  default: { ko: '29,000원(부가세 포함)', en: '$29' },
}
const valueOf = (key, archetypeId, locale) => {
  const row = key === 'price' ? (PRICES[archetypeId] ?? PRICES.default) : SAMPLES[key]
  return row ? (row[locale] ?? row.ko) : null
}
const scannable = (key) => key === 'price' || SAMPLES[key]?.scan !== false

/** 예시 표가 값을 가진 사실 이름. */
export const SAMPLE_KEYS = Object.freeze([...Object.keys(SAMPLES), 'price'])

// ── 범위 ─────────────────────────────────────────────────────────────────
/** 스키마가 요구하는 칸 이름(예: mapLinks.naver)을 예시 표 키로 읽는다. 사실 이름이면 그대로. 모르면 null. */
function sampleKeyOf(archetypeId, name) {
  if (name === 'price' || Object.hasOwn(SAMPLES, name)) return name
  const from = SCHEMA_FACTS[archetypeId]?.[name]?.from ?? []
  return from.find((f) => f === 'price' || Object.hasOwn(SAMPLES, f)) ?? null
}

/**
 * 지금 「확인 필요 사실」이 될 필수 키(사실 이름). 04 문구 요청의 `missing` 과 같은 규칙으로 센다(content.mjs contentRequest):
 * 원형 필수 사실이 비었거나 스키마가 필수로 요구하는 칸의 사실이 없을 때. 제외 집합(선택 섹션 사실·법정·사회적 증거)은 넣지 않는다.
 * 키가 brief.facts 에 있으면(빈 문자열도) 범위에 남는다 — 채울지는 buildSampleFacts 가 정한다.
 */
export function sampleScope({ archetype, brief }) {
  const facts = Object.fromEntries(Object.entries(brief.facts ?? {}).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v))
  const { content, missing } = briefToSeed(brief, archetype)
  const wanted = [...missing, ...Object.keys(schemaMissing(archetype.id, content, facts, brief.locale))]
  const keys = []
  for (const name of wanted) {
    const key = sampleKeyOf(archetype.id, name) ?? name
    if (isLegalKey(key) || SOCIAL_PROOF.has(key)) continue
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

/** 예시 파일 내용. 답한 키(brief.facts 에 키가 있음 — 빈 문자열 포함)와 표에 값이 없는 키는 채우지 않는다. 같은 입력이면 같은 출력. */
export function buildSampleFacts({ archetype, brief, locale = brief.locale }) {
  const facts = {}
  // 한 번 채우면 새로 필수가 되는 칸이 있다(예: 배송 설명이 생기면 배송비·택배사·반품 배송비 부담) — 더 늘지 않을 때까지 되풀이한다.
  for (let round = 0, current = brief; round < 4; round++) {
    const added = {}
    for (const key of sampleScope({ archetype, brief: current })) {
      if (Object.hasOwn(current.facts ?? {}, key)) continue
      const value = valueOf(key, archetype.id, locale)
      if (value !== null) added[key] = value
    }
    if (!Object.keys(added).length) break
    Object.assign(facts, added)
    current = mergeFacts({ facts: added }, current)
  }
  return { version: SAMPLE_VERSION, label: SAMPLE_LABEL, facts }
}

/** 메모리 합치기 — 실제 값이 이긴다(빈 문자열도 실제 답이다). 받은 브리프는 바꾸지 않는다. */
export const mergeFacts = (sample, brief) => ({ ...brief, facts: { ...(sample?.facts ?? {}), ...brief.facts } })

/** 아직 예시로 남은 키 — brief.facts 에 키가 없는 것. 빈 문자열("")은 답한 것으로 센다. */
export const remainingSamples = (sample, brief) => Object.keys(sample?.facts ?? {}).filter((k) => !Object.hasOwn(brief.facts ?? {}, k))

// ── 파일 ─────────────────────────────────────────────────────────────────
export const sampleFilePath = (runDir) => join(runDir, SAMPLE_FILE)

/** 실행 폴더의 예시 파일. 없거나 모양이 틀리면 null. */
export function readSampleFacts(runDir) {
  const file = sampleFilePath(runDir)
  if (!existsSync(file)) return null
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    const ok = data && data.version === SAMPLE_VERSION && data.facts && typeof data.facts === 'object' && Object.values(data.facts).every((v) => typeof v === 'string')
    return ok ? data : null
  } catch { return null }
}

export function writeSampleFacts(runDir, sample) {
  const file = sampleFilePath(runDir)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(sample, null, 2) + '\n')
  renameSync(`${file}.tmp`, file)
  return file
}

// ── 값 스캔(deliver 의 독립 검사 — P2 F6) ─────────────────────────────────
/** text 안에 예시 파일의 값이 글자 그대로 들어 있는 키들. 열거형·짧은 값(scan:false)은 뺀다. 04 문구에 옮겨 적은 경우도 잡는다. */
export function sampleValuesIn(text, sample) {
  const hay = String(text ?? '')
  return Object.entries(sample?.facts ?? {}).filter(([key, value]) => scannable(key) && value && containsSampleValue(hay, value)).map(([key]) => key)
}

// 금액 숫자가 더 긴 금액의 앞부분이면 다른 값이다($29 ≠ $299·$29.99).
// 문장부호 뒤 숫자만 이어지는 소수점·천 단위 구분자를 숫자의 일부로 본다.
function containsSampleValue(text, value) {
  if (!/^[$₩€]\s?\d[\d,]*(?:\.\d+)?$/.test(value)) return text.includes(value)
  let at = text.indexOf(value)
  while (at !== -1) {
    const tail = text.slice(at + value.length)
    if (!/^(?:\d|[.,]\d)/.test(tail)) return true
    at = text.indexOf(value, at + value.length)
  }
  return false
}
