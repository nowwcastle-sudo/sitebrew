// 브리프 입력(J12, P3-3 Task 2): 대표의 주제 한 줄 + 사실 5~10개 → 콘텐츠 씨앗.
//   사실을 지어내지 않는다(§9 Q8). 원형이 요구하는 사실이 비면 missing 에 이름을 올리고 콘텐츠에는 넣지 않는다 —
//   화면은 그 자리를 「확인 필요」로 그리고, 공개 관문(ops-gate·legal-gate)이 종료 1을 낸다.
//   locale 은 ko 또는 en 하나다(§9 Q4).
//   원형 로더(archetypes.mjs, Task 1)는 부르지 않는다 — 원형 객체는 부르는 쪽이 넘긴다.
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { z } from 'zod'

export const ARCHETYPE_IDS = ['brand', 'commerce', 'dashboard', 'detail', 'local', 'portfolio', 'public', 'pwa', 'saas', 'landing']

// 원형별 필수 사실. 목록에 없는 원형은 DEFAULT_REQUIRED.
export const REQUIRED_FACTS = {
  local: ['name', 'phone', 'address', 'hours', 'bizNo'],
  saas: ['name', 'bizNo', 'email', 'price'],
  detail: ['name', 'price', 'seller', 'bizNo'],
}
export const DEFAULT_REQUIRED = ['name', 'email']
export const requiredFacts = (archetypeId) => REQUIRED_FACTS[archetypeId] ?? DEFAULT_REQUIRED

// 사실 이름 → 콘텐츠 객체 자리(content-core Business 필드 이름). 여기 없는 사실은 content.facts 에 원문 그대로 둔다
// (영업시간·가격처럼 구조로 풀어야 하는 것은 04-content 단계가 원문을 보고 채운다).
const BUSINESS_FIELDS = { name: 'name', legalName: 'legalName', representative: 'representative', bizNo: 'bizRegNo', mailOrderNo: 'mailOrderNo', address: 'address', phone: 'phone', email: 'email' }
// 회사 정보(Business 필드)를 받는 콘텐츠 뿌리는 원형마다 다르다(P4GR 골든 실측 — 문구 에이전트가 brand·public 에서 막혔다):
//   business(commerce·detail·local·saas) · organization(brand — 스키마가 `business` 를 모르는 최상위 칸으로 거절한다).
//   public 은 agency 에 이름·주소·대표전화(mainPhone)만 있고(FACT_PATHS), dashboard·portfolio·pwa 는 회사 정보 칸이 없어 모든 사실이 facts 에 원문으로 남는다.
export const BUSINESS_ROOT = { brand: 'organization', commerce: 'business', detail: 'business', landing: 'business', local: 'business', saas: 'business' }
// 04-content 스키마 검사가 「회사 정보 칸」으로 읽는 뿌리(public agency 포함 — content.mjs schemaMissing).
export const SCHEMA_BUSINESS_ROOT = { ...BUSINESS_ROOT, public: 'agency' }
// 상세 페이지(detail)에서 name 은 상품 이름이고 판매자는 seller 다.
const FACT_PATHS = {
  detail: { name: ['product', 'name'], seller: ['business', 'name'] },
  public: { name: ['agency', 'name'], address: ['agency', 'address'], phone: ['agency', 'mainPhone'] },
}

/** 사실 이름 → 콘텐츠 객체 자리(경로 배열). 04-content 가 빈 사실 자리를 찾을 때도 같은 표를 쓴다. */
export function factPath(archetypeId, name) {
  const root = BUSINESS_ROOT[archetypeId]
  return FACT_PATHS[archetypeId]?.[name] ?? (root && BUSINESS_FIELDS[name] ? [root, BUSINESS_FIELDS[name]] : ['facts', name])
}

// 브리프 조건(P4GD · 대장 C280): 레시피 archetypeConditions 의 쓰임 조건 문장(예: r8「헤리티지 업장(한옥 스테이·찻집…)에만」, r9「식품·생활·키즈 몰에만」)에서 읽는 낱말 id.
// 레시피 쪽 표기를 이 표로 읽어 id 를 만들고(conditionIdsOf), 브리프의 선택 칸 `conditions` 가 그 id 와 겹치면 01 방향이 그 레시피의 조건부 적합도(0.9)를 1 로 읽는다.
// 새 조건 낱말은 레시피 문장에 적고 여기 한 줄을 더한다(시험이 모든 레시피 조건 문장이 id 를 하나 이상 갖는지 본다).
export const CONDITION_PATTERNS = { heritage: /헤리티지/, food: /식품/, living: /생활/, kids: /키즈/ }
export const CONDITION_IDS = Object.keys(CONDITION_PATTERNS)
/** 조건 문장 → 읽히는 조건 id 목록(CONDITION_IDS 순서). */
export const conditionIdsOf = (text) => CONDITION_IDS.filter((id) => CONDITION_PATTERNS[id].test(String(text ?? '')))

const Fact = z.string()
export const BriefSchema = z
  .object({
    topic: z.string().trim().min(1, { error: '주제 한 줄(topic)을 적어 주세요' }),
    archetype: z.enum(ARCHETYPE_IDS, { error: `원형(archetype)은 ${ARCHETYPE_IDS.join('·')} 중 하나입니다` }),
    locale: z.enum(['ko', 'en'], { error: 'locale 은 ko 또는 en 하나입니다' }),
    facts: z.record(z.string(), Fact),
    brand: z
      .object({
        logo: z.string().min(1).optional(),
        colors: z.array(z.string().min(1)).optional(),
        fonts: z.array(z.string().min(1)).optional(),
      })
      .strict()
      .optional(),
    seed: z.number().int().optional(),
    // 대화형 입구(factory v1 Task 4.1)가 빈 답(사실·로고)을 남긴 채 만든 브리프의 표지 — 미리보기 자산 + 「공개 전 교체」 표지로만 끝까지 간다는 뜻이다.
    // 사실 자체는 지어내지 않는다: 빈 사실은 facts 에 없고(위 briefToSeed → 04-content 가 「확인 필요」 자리 표시로 남긴다), 이 표지는 그 사실을 사람에게 알린다.
    previewOnly: z.boolean().optional(),
    // 사업체가 레시피 쓰임 조건에 드는지(헤리티지 업장·식품·생활·키즈) — 모르는 id 는 거절한다. 사실과 맞을 때만 적는다.
    conditions: z.array(z.enum(CONDITION_IDS, { error: `조건(conditions)은 ${CONDITION_IDS.join('·')} 중에서 고릅니다` })).optional(),
    // 03 변형 선호(P3-5 MOTKIT — 시안·결선 보드용): 섹션 키("<쪽>/<섹션>") → 블록 이름 차례. 후보 a·b·c 가 「덜 쓰인 것」 다음 순서로 이 차례를 따른다
    // (a 가 첫째, b 가 둘째 …). 원형 allowedVariants 밖이면 03 이 거절하고, 못 채우는 변형(readiness 2)·누설이 남는 변형은 여전히 피한다.
    prefer: z.record(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, { error: 'prefer 키는 "<쪽>/<섹션>" 입니다' }), z.array(z.string().regex(/^block-[a-z0-9-]+$/)).min(1)).optional(),
  })
  .strict()

/**
 * 메모리 위의 브리프 객체를 검사한다 — 파일 로더(loadBrief)와 같은 스키마다. 틀리면 칸 이름을 붙여 던진다.
 * 대화형 입구(intake/to-brief.mjs)가 파일 없이 만든 브리프를 넘긴다. 파일 경로를 모르므로 상대 로고 경로는 풀지 않고 그대로 둔다.
 * @param {unknown} raw
 * @param {{ label?: string, extraArchetypes?: string[] }} [opts]  label = 오류 문구의 출처 이름(기본 「메모리」). extraArchetypes = ARCHETYPE_IDS 에 아직 없는 원형을 시험용으로 넓힐 때만(지금 쓰는 곳 없음 — landing 은 ARCHETYPE_IDS 에 들어왔다)
 */
export function loadBriefObject(raw, { label = '메모리', extraArchetypes = [] } = {}) {
  const schema = extraArchetypes.length
    ? BriefSchema.extend({ archetype: z.enum([...ARCHETYPE_IDS, ...extraArchetypes], { error: `원형(archetype)은 ${[...ARCHETYPE_IDS, ...extraArchetypes].join('·')} 중 하나입니다` }) })
    : BriefSchema
  const r = schema.safeParse(raw)
  if (!r.success) throw new Error(`브리프 모양이 틀렸다 (${label}): ${r.error.issues.map((i) => `${i.path.join('.') || '(맨 위)'} — ${i.message}`).join('; ')}`)
  return r.data
}

/** 브리프 파일을 읽고 검사한다. 틀리면 파일 경로와 칸 이름을 붙여 던진다. */
export function loadBrief(path) {
  let raw
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`브리프를 읽지 못했다 (${path}): ${e.message}`)
  }
  const r = BriefSchema.safeParse(raw)
  if (!r.success) throw new Error(`브리프 모양이 틀렸다 (${path}): ${r.error.issues.map((i) => `${i.path.join('.') || '(맨 위)'} — ${i.message}`).join('; ')}`)
  // 브랜드 로고 경로는 브리프 파일 기준이다(골든 브리프의 assets/ 처럼) — 이후 단계는 찍어내는 폴더에서 돌아 상대 경로를 못 찾는다.
  if (r.data.brand?.logo && !isAbsolute(r.data.brand.logo)) r.data.brand = { ...r.data.brand, logo: resolve(dirname(resolve(path)), r.data.brand.logo) }
  return r.data
}

function put(obj, path, value) {
  let o = obj
  for (const k of path.slice(0, -1)) o = o[k] ??= {}
  o[path.at(-1)] = value
}

/**
 * 사실 → 콘텐츠 씨앗. 빈 사실(없음·공백)은 콘텐츠에 넣지 않고, 원형이 요구하는 것이면 missing 에 올린다.
 * @returns {{ content: object, missing: string[] }}
 */
export function briefToSeed(brief, archetype) {
  const b = BriefSchema.parse(brief)
  if (archetype?.id !== b.archetype) throw new Error(`원형이 브리프와 다르다: 브리프 ${b.archetype} · 넘긴 원형 ${archetype?.id}`)
  const facts = Object.fromEntries(Object.entries(b.facts).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
  const content = { ...(BUSINESS_ROOT[b.archetype] ? { [BUSINESS_ROOT[b.archetype]]: {} } : {}), facts: {} }
  for (const [k, v] of Object.entries(facts)) put(content, factPath(b.archetype, k), v)
  const missing = requiredFacts(b.archetype).filter((k) => !(k in facts))
  return { content, missing }
}
