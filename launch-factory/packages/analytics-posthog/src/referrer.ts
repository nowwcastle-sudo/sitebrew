// 유입 종류 분류(events.ts page_view.referrerKind — 마케팅 규칙 X8: AI 답변 유입을 검색·소셜과 따로 잰다).
// 판정 순서: utm_source → 리퍼러. 같은 표를 둘 다에 쓴다. 표 안에서는 ai → search → social 순서로 본다
// (gemini.google.com·copilot.microsoft.com 이 검색·기타로 먼저 걸리지 않게).
//
// 도메인 표 확인일: 2026-09-30. 표를 고치면 REFERRER_TABLE_DATE 와 테스트 표(test/referrer.test.mjs)를 함께 고친다.
// AI 답변 엔진 출처:
//   - ChatGPT: OpenAI 「Publishers and Developers - FAQ」 https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
//     — ChatGPT 검색은 인용 링크에 `utm_source=chatgpt.com` 을 붙인다(2026-09-30 검색 결과 요약으로 확인, 본문은 HTTP 403 이라 직접 읽지 못함).
//   - 나머지: 공개 목록 Swydo 「AI Referral Traffic Tracking in GA4」(2026-03-18 게시, 2026-03-24 갱신,
//     Dana DiTomaso·Analytics Playbook 정규식) https://www.swydo.com/blog/track-ai-traffic-in-ga4/
//     그 목록에서 「답변 엔진」(대화형 검색·챗봇)만 골랐다. 글쓰기 도구(quillbot·jasper·copy.ai·writesonic 등)와
//     개발 사이트(huggingface.co)는 뺐다 — 사람이 답을 읽고 눌러 들어오는 곳이 아니다. grok.com 은 목록의 grok.x.com 과 같은 서비스의 현재 주소라 더했다.

export type ReferrerKind = "search" | "ai" | "social" | "direct" | "other"

export const REFERRER_TABLE_DATE = "2026-09-30"

/** 호스트 끝이 이 값과 같거나 「.이 값」으로 끝나면 걸린다(하위 도메인 포함). utm_source 는 이 값이나 bareNames 와 같으면 걸린다 */
export const AI_DOMAINS = [
  "chatgpt.com", "chat.openai.com", "openai.com",
  "perplexity.ai", "claude.ai", "anthropic.com",
  "gemini.google.com", "bard.google.com", "copilot.microsoft.com",
  "meta.ai", "poe.com", "you.com", "phind.com", "pi.ai",
  "mistral.ai", "deepseek.com", "grok.com", "grok.x.com", "x.ai",
] as const

/** 검색 엔진. google·yahoo 는 나라 도메인이 많아 아래 SEARCH_PATTERNS 로 따로 본다 */
export const SEARCH_DOMAINS = [
  "search.naver.com", "m.search.naver.com", "search.daum.net", "m.search.daum.net", "search.zum.com",
  "bing.com", "duckduckgo.com", "search.brave.com", "ecosia.org", "baidu.com", "yandex.com", "yandex.ru", "startpage.com",
] as const
/** google.<tld>·www.google.<tld>(google.com·google.co.kr …)과 search.yahoo.<tld>. 다른 google 하위 서비스(메일·문서)는 걸리지 않는다 */
export const SEARCH_PATTERNS = [/^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/, /^(?:[a-z]{2}\.)?search\.yahoo\.[a-z]{2,3}(?:\.[a-z]{2})?$/] as const

export const SOCIAL_DOMAINS = [
  "facebook.com", "fb.com", "instagram.com", "threads.net", "threads.com",
  "t.co", "x.com", "twitter.com", "linkedin.com", "lnkd.in",
  "reddit.com", "youtube.com", "youtu.be", "tiktok.com", "pinterest.com", "pin.it",
  "blog.naver.com", "cafe.naver.com", "band.us", "story.kakao.com", "pf.kakao.com", "kakao.com",
  "news.ycombinator.com", "producthunt.com", "discord.com", "telegram.org", "t.me",
] as const

/** utm_source 에 흔히 쓰는 도메인 아닌 이름 */
const BARE_NAMES: Record<string, ReferrerKind> = {
  chatgpt: "ai", openai: "ai", perplexity: "ai", claude: "ai", gemini: "ai", copilot: "ai", deepseek: "ai", grok: "ai",
  google: "search", naver: "search", daum: "search", bing: "search", duckduckgo: "search", yahoo: "search",
  facebook: "social", fb: "social", instagram: "social", ig: "social", threads: "social", twitter: "social", x: "social",
  linkedin: "social", reddit: "social", youtube: "social", tiktok: "social", kakao: "social", kakaotalk: "social", band: "social",
}

const onDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

/** 호스트 하나의 종류. 표에 없으면 null */
export function hostKind(host: string): Exclude<ReferrerKind, "direct" | "other"> | null {
  const h = host.toLowerCase().replace(/\.$/, "")
  if (AI_DOMAINS.some((d) => onDomain(h, d))) return "ai"
  if (SEARCH_DOMAINS.some((d) => onDomain(h, d)) || SEARCH_PATTERNS.some((re) => re.test(h))) return "search"
  if (SOCIAL_DOMAINS.some((d) => onDomain(h, d))) return "social"
  return null
}

function sourceKind(utmSource: string): ReferrerKind | null {
  const s = utmSource.trim().toLowerCase()
  if (!s) return null
  const byName = BARE_NAMES[s]
  if (byName) return byName
  // "chatgpt.com"·"https://chatgpt.com/…" 모양
  let host = s
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(s)) host = new URL(s).hostname
  } catch {
    return null
  }
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? hostKind(host) : null
}

export interface ReferrerInput {
  /** document.referrer (없으면 "" 나 undefined) */
  referrer?: string | null
  /** 현재 주소의 utm_source */
  utmSource?: string | null
  /** 이 사이트의 호스트(location.hostname). 리퍼러가 같은 사이트면 새 유입이 아니므로 direct 로 본다 */
  selfHost?: string | null
}

/**
 * 유입 종류. utm_source 가 표에 있으면 그것을 따른다(ChatGPT 는 리퍼러 없이 utm 만 남는 경우가 많다).
 * 없으면 리퍼러 호스트로 판단한다. 리퍼러가 없거나 같은 사이트면 direct, 표에 없는 사이트면 other.
 * utm_source 가 있는데 표에 없는 값(예: newsletter)이고 리퍼러도 없으면 other(캠페인 유입이지 직접 방문이 아니다).
 */
export function referrerKind({ referrer, utmSource, selfHost }: ReferrerInput): ReferrerKind {
  const fromUtm = utmSource ? sourceKind(utmSource) : null
  if (fromUtm) return fromUtm
  let host = ""
  if (referrer) {
    try {
      host = new URL(referrer).hostname.toLowerCase()
    } catch {
      host = ""
    }
  }
  if (!host) return utmSource?.trim() ? "other" : "direct"
  if (selfHost && host === selfHost.toLowerCase()) return utmSource?.trim() ? "other" : "direct"
  return hostKind(host) ?? "other"
}

/** 주소에서 utm_source 를 꺼낸다(없으면 undefined) */
export function utmSourceOf(href: string | null | undefined): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href).searchParams.get("utm_source")?.trim() || undefined
  } catch {
    return undefined
  }
}
