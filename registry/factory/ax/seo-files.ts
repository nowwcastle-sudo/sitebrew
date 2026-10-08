// llms.txt 상한 100KB(바이트)
export const LLMS_MAX_BYTES = 100 * 1024

/** 사이트 한 쪽. sitemap·llms.txt 가 같은 목록에서 나온다. */
export interface SeoPage {
  /** 절대 주소 또는 사이트 안 경로(/…) */
  url: string
  title: string
  description?: string
  /** YYYY-MM-DD */
  lastModified?: string
  /** llms.txt 의 H2 묶음 이름(기본 「페이지」) */
  section?: string
  /** 이미지 사이트맵(옵션) — 이 페이지에 보이는 이미지 주소(절대 주소 또는 /경로) */
  images?: string[]
}

/** seoFiles 입력 — 콘텐츠 객체에서 이름·요약·페이지 목록을 옮겨 만든다(화면과 같은 값). */
export interface SeoInput {
  /** 사이트 기준 주소(https://…) */
  siteUrl: string
  /** 사이트·가게·회사 이름 — llms.txt H1 */
  name: string
  /** 한두 문장 요약 — llms.txt 인용문 */
  summary: string
  pages: SeoPage[]
}

/**
 * AI 봇 정책(DESIGN §12): 학습용 · 검색 인용용 · 사용자 요청 단발 조회를 따로 정한다.
 * 기본값은 셋 다 허용이다 — 공장 사이트는 찾히려고 만든다(§12 「공개 콘텐츠를 봇 차단으로 막지 않는다」, 스펙 원안의 GPTBot·ClaudeBot 허용 목록,
 * 컨트롤러 판정 2026-09-26 Task 11 I8). 학습에 쓰이기 싫으면 { training: false } 로 끈다(검색 인용·사용자 요청은 그대로).
 */
export interface AiBotPolicy {
  training?: boolean
  search?: boolean
  user?: boolean
}

export interface SeoOptions {
  /** 다음(Daum) 웹마스터도구 인증 PIN — robots.txt 에 `#DaumWebMasterTool:<PIN>` 줄을 넣는다 */
  daumPin?: string
  /** 모든 봇에게 막을 경로(색인되면 안 되는 페이지는 noindex 도 함께 — robots 로만 막지 않는다) */
  disallow?: string[]
  /** 기본값: 학습·검색 인용·사용자 요청 모두 허용. 끄려면 해당 키를 false 로(예: { training: false }) */
  ai?: AiBotPolicy
  /** llms.txt 상한(바이트). 기본·최대 100KB(102400) */
  llmsMaxBytes?: number
  /** llms.txt 켜기. 기본 끔(C-7 — 요청이 거의 없고 Google 은 쓰지 않는다고 밝혔다). 끄면 llmsTxt 가 null */
  llms?: boolean
}

export interface SeoFiles {
  robots: string
  /** sitemap.xml 본문. urls 를 안 주면 입력 pages 로 만든다 */
  sitemap: (urls?: SeoPage[]) => string
  /** options.llms 가 true 일 때만 문자열, 기본 null */
  llmsTxt: string | null
}

/**
 * 이름으로 허용하는 검색 엔진 로봇(Google·Bing·네이버). `*` 그룹이 이미 허용하지만, 학습용 봇을 막을 때도 검색은 그대로임을 드러내려고 적는다.
 * 이름은 각 회사 문서(2026-09-30 확인): Googlebot(Google 크롤러 목록)·bingbot(Bing 웹마스터 도움말)·Yeti(네이버 서치어드바이저 robots 안내).
 */
export const SEARCH_BOTS = ["Googlebot", "Bingbot", "Yeti"] as const

/**
 * AI 봇 이름(각 회사 문서, 2026-09-30 확인). training = 모델 학습(Google-Extended 는 Gemini 학습과 답변 근거 쓰임을 함께 정하는
 * 토큰이고 검색 색인에는 영향이 없다, Applebot-Extended 는 Apple 학습 제외 토큰, CCBot 은 Common Crawl). search = AI 검색 인용용 색인.
 * user = 사용자가 시킨 단발 조회 — OpenAI·Perplexity 는 이 봇에 robots.txt 가 적용되지 않을 수 있다고 적는다.
 */
export const AI_BOTS = {
  training: ["GPTBot", "ClaudeBot", "Applebot-Extended", "CCBot", "Google-Extended"],
  search: ["OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"],
  user: ["ChatGPT-User", "Claude-User", "Perplexity-User"],
} as const

const bytes = (s: string) => new TextEncoder().encode(s).length
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
// 마크다운 링크 목적지: 괄호·공백·꺾쇠는 퍼센트 인코딩(목적지가 일찍 끝나지 않게).
const mdDest = (u: string) => u.replace(/[()<> ]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))
const mdText = (s: string) => oneLine(s).replace(/([\\[\]])/g, "\\$1")

function absolute(url: string, base: string): string {
  const u = new URL(url, base)
  if (!/^https?:$/.test(u.protocol)) throw new Error(`seoFiles: http(s) 주소가 아닙니다 — ${url}`)
  return u.href
}

function robotsTxt(input: SeoInput, opts: SeoOptions): string {
  const ai = { training: true, search: true, user: true, ...opts.ai }
  const disallow = (opts.disallow ?? []).map((p) => {
    if (!p.startsWith("/") || /[\r\n]/.test(p)) throw new Error(`seoFiles: disallow 경로는 /로 시작하는 한 줄이어야 합니다 — ${JSON.stringify(p)}`)
    return p
  })
  const rules = ["Allow: /", ...disallow.map((p) => `Disallow: ${p}`)]
  const group = (agents: readonly string[], lines: string[]) => [...agents.map((a) => `User-agent: ${a}`), ...lines].join("\n")
  const groups = [
    // 네이버(Yeti)·다음(Daum) 검색 로봇은 이름을 적어 허용한다 — 이름 그룹은 * 그룹을 대신하므로 막을 경로도 함께 적는다.
    group(["*"], rules),
    group(SEARCH_BOTS, rules),
    group(["Daum", "Daumoa"], rules),
    group(AI_BOTS.search, ai.search ? rules : ["Disallow: /"]),
    group(AI_BOTS.user, ai.user ? rules : ["Disallow: /"]),
    group(AI_BOTS.training, ai.training ? rules : ["Disallow: /"]),
  ]
  const head: string[] = []
  if (opts.daumPin !== undefined) {
    if (!/^[\w:.-]+$/.test(opts.daumPin)) throw new Error(`seoFiles: daumPin 은 영문·숫자·콜론·점·하이픈·밑줄만 씁니다 — ${JSON.stringify(opts.daumPin)}`)
    head.push(`#DaumWebMasterTool:${opts.daumPin}`)
  }
  return [...head, ...groups, `Sitemap: ${absolute("/sitemap.xml", input.siteUrl)}`].join("\n\n") + "\n"
}

// 실제로 있는 날짜인가(2026-13-45·2026-02-30 거절).
const realDate = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}

// 이미지 사이트맵 이름공간(Google 이미지 사이트맵 문서).
const IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1"

function sitemapXml(pages: SeoPage[], base: string): string {
  const seen = new Set<string>()
  const rows: string[] = []
  const origin = new URL(base).origin
  for (const p of pages) {
    const loc = absolute(p.url, base)
    if (new URL(loc).origin !== origin) throw new Error(`seoFiles: 사이트맵에는 같은 사이트(${origin}) 주소만 넣습니다 — ${p.url}`)
    if (seen.has(loc)) continue
    seen.add(loc)
    if (p.lastModified && !realDate(p.lastModified)) throw new Error(`seoFiles: lastModified 는 실제 날짜(YYYY-MM-DD)여야 합니다 — ${p.lastModified}`)
    const images = (p.images ?? []).map((src) => `<image:image><image:loc>${xml(absolute(src, base))}</image:loc></image:image>`).join("")
    rows.push(`  <url><loc>${xml(loc)}</loc>${p.lastModified ? `<lastmod>${p.lastModified}</lastmod>` : ""}${images}</url>`)
  }
  const ns = pages.some((p) => p.images?.length) ? ` xmlns:image="${IMAGE_NS}"` : ""
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${ns}>\n${rows.join("\n")}\n</urlset>\n`
}

/**
 * llms.txt(H1 제목 + 요약 인용문 + H2 아래 링크 목록). 상한을 넘으면 입력 순서대로 링크 줄을 통째로 담다가 멈추고,
 * 마지막에 「나머지 N개는 sitemap.xml」 줄을 단다 — 같은 입력이면 늘 같은 결과이고 줄 중간에서 자르지 않는다.
 */
function llmsTxt(input: SeoInput, max: number): string {
  const sitemapUrl = absolute("/sitemap.xml", input.siteUrl)
  const clip = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n - 1).join("") + "…" : s)
  const head = `# ${mdText(clip(input.name, 200))}\n\n> ${mdText(clip(input.summary, 500))}\n`
  const sections = new Map<string, string[]>()
  for (const p of input.pages) {
    const line = `- [${mdText(p.title)}](${mdDest(absolute(p.url, input.siteUrl))})${p.description ? `: ${mdText(clip(p.description, 300))}` : ""}`
    const key = oneLine(p.section ?? "페이지")
    sections.set(key, [...(sections.get(key) ?? []), line])
  }
  const total = input.pages.length
  const tail = (left: number) => (left ? `\n## 나머지\n\n- [사이트맵](${sitemapUrl}): 나머지 ${left}개 페이지는 사이트맵에 있습니다\n` : "")
  const reserve = bytes(tail(total))
  let out = head
  let used = 0
  outer: for (const [name, lines] of sections) {
    const h2 = `\n## ${mdText(name)}\n\n`
    if (bytes(out + h2) + reserve > max) break
    let block = h2
    let added = 0
    for (const line of lines) {
      if (bytes(out + block + line + "\n") + reserve > max) {
        if (added) { out += block; used += added }
        break outer
      }
      block += line + "\n"
      added++
    }
    out += block
    used += added
  }
  return out + tail(total - used)
}

/**
 * robots.txt · sitemap.xml · llms.txt 를 한 입력에서 만든다. Next 라우트(app/robots.txt/route.ts 등)에서 문자열로 돌려준다.
 * robots: 모든 봇 허용 + 검색 로봇(Googlebot·Bingbot·네이버 Yeti)·다음 Daum(Daumoa) 을 이름으로 허용, AI 봇은 종류별 정책(기본 학습·검색·
 * 사용자 요청 모두 허용 — 학습만 막으려면 options.ai = { training: false }), `daumPin` 을 주면 다음 인증 줄, 끝에 Sitemap.
 * sitemap 은 같은 사이트 주소·실제 날짜만 받고, 페이지에 images 가 있으면 이미지 사이트맵 줄을 단다.
 * llms.txt 는 기본 끔(options.llms = true 로 켠다, C-7), 켜면 100KB 이하로 자른다(결정적).
 */
export function seoFiles(input: SeoInput, options: SeoOptions = {}): SeoFiles {
  absolute(input.siteUrl, input.siteUrl)
  const max = Math.min(options.llmsMaxBytes ?? LLMS_MAX_BYTES, LLMS_MAX_BYTES)
  return {
    robots: robotsTxt(input, options),
    sitemap: (urls) => sitemapXml(urls ?? input.pages, input.siteUrl),
    llmsTxt: options.llms ? llmsTxt(input, max) : null,
  }
}
