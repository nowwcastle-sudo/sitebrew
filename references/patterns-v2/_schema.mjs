// 레퍼런스 패턴 카드 v2(factory v1 Task 2.2, 합의안 D10). 사이트 하나 = 카드 하나.
// 원본 화면·영상은 저장소 밖 선택 자료 폴더(WF_DESIGN_RULES_DIR 아래 factory/refs-v2)에 있고, 카드에는 정리한 관찰만 둔다 — 원문·그림·긴 인용 없음.
import { z } from 'zod'

export const ARCHETYPES = ['brand', 'commerce', 'dashboard', 'detail', 'local', 'portfolio', 'public', 'pwa', 'saas', 'landing']
export const COLOR_LOGIC = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9']

const Ms = z.number().int().min(0).max(20000)

export const RefCardV2 = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/),
  archetype: z.enum(ARCHETYPES),
  sourceGallery: z.string().min(2),
  url: z.string().url(),
  structure: z.object({
    hero: z.string().min(3).max(160),
    sections: z.array(z.string().min(2).max(60)).min(1).max(30),
  }),
  type: z.object({
    display: z.string().min(2).max(80),
    body: z.string().min(2).max(80),
    scale: z.string().min(2).max(80),
  }),
  colorLogic: z.enum(COLOR_LOGIC),
  motion: z.object({
    entrance: z.string().max(160).nullable(),
    scroll: z.string().max(160).nullable(),
    hover: z.string().max(160).nullable(),
    transition: z.string().max(160).nullable(),
    durationsMs: z.array(Ms).max(12),
    easing: z.string().max(80).nullable(),
    measured: z.enum(['video-frames', 'stills-only', 'none']),
    note: z.string().max(200).optional(),
  }),
  interaction: z.array(z.string().min(3).max(120)).max(12),
  cta: z.object({ pattern: z.string().min(3).max(120), count: z.number().int().min(0).max(30) }),
  perf: z.object({ lcpMs: Ms.nullable(), weightKb: z.number().int().min(0).nullable() }),
  fit: z.object({ archetypes: z.array(z.enum(ARCHETYPES)).min(1), score: z.number().min(0).max(1) }),
  boldness: z.enum(['safe', 'balanced', 'bold']),
  takeaways: z.array(z.string().min(5).max(200)).min(1).max(8),
}).strict()

/** 문자열 값들을 모두 모은다(키 이름은 빼고) */
const stringsOf = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(stringsOf) : v && typeof v === 'object' ? Object.values(v).flatMap(stringsOf) : [])

/**
 * 값 안에 실제로 들어 있는 따옴표 인용(“…” "…" ‘…’ '…' 「…」)이 12낱말 이상이면 제3자 글을 옮긴 것으로 본다.
 * 값 자체의 길이는 보지 않는다 — 긴 한국어 서술은 인용이 아니다.
 */
export function longQuotes(card) {
  const QUOTE = /“([^”]+)”|"([^"]+)"|‘([^’]+)’|'([^']+)'|「([^」]+)」/g
  return stringsOf(card).flatMap((s) => [...s.matchAll(QUOTE)].map((m) => m.slice(1).find(Boolean))).filter((q) => q.trim().split(/\s+/).length >= 12)
}
