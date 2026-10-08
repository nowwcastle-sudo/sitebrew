// 갱신일 하나(YYYY-MM-DD)에서 화면 「업데이트 …」·JSON-LD dateModified(geo-entity)·sitemap lastmod(seo-files)가 나온다(X5·J9).

const realDate = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}

/** 실제 날짜(YYYY-MM-DD)인지 보고, 아니면 한국어 오류를 던진다. */
export function assertDate(d: string): string {
  if (!realDate(d)) throw new Error(`갱신일은 실제 날짜(YYYY-MM-DD)여야 합니다 — ${d}`)
  return d
}

/**
 * 화면에 보이는 갱신일 「업데이트 2026-09-30」(영어 사이트는 「Updated」). 같은 값을 `jsonLdFor(content, { …, updatedAt })`에 넘기면
 * dateModified 가 되고, `SeoPage.lastModified`로 넘기면 sitemap lastmod 가 된다. 서버 컴포넌트(상태 없음).
 */
export function UpdatedAt({ date, locale = "ko", className }: { date: string; locale?: "ko" | "en"; className?: string }) {
  assertDate(date)
  return (
    <p className={className} data-updated-at="">
      {locale === "ko" ? "업데이트" : "Updated"} <time dateTime={date}>{date}</time>
    </p>
  )
}

/** IndexNow 받는 곳. api.indexnow.org 는 참여 검색 엔진(Bing 등)에 나눠 주고, 네이버 서치어드바이저는 자기 주소를 따로 안내한다. */
export const INDEXNOW_ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://searchadvisor.naver.com/indexnow"] as const

/**
 * 바뀐 주소를 IndexNow 로 알린다(옵션 — 발행 스크립트에서 부른다). 키는 소비자 환경 변수 `INDEXNOW_KEY`(8~128자 영문·숫자·하이픈)이고,
 * 키 파일 `https://<host>/<key>.txt`(내용 = 키)를 사이트가 먼저 내보내야 한다. 한 번에 1만 개까지, 같은 사이트 주소만.
 * 받는 곳마다 HTTP 상태를 돌려준다(200·202 = 받음). 키가 없으면 아무것도 보내지 않고 빈 목록을 돌려준다.
 */
export async function pingIndexNow(opts: {
  siteUrl: string
  urls: string[]
  key?: string
  keyLocation?: string
  endpoints?: readonly string[]
  fetchImpl?: typeof fetch
}): Promise<{ endpoint: string; status: number }[]> {
  const key = opts.key ?? process.env.INDEXNOW_KEY
  if (!key) return []
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("pingIndexNow: 키는 영문·숫자·하이픈 8~128자입니다(값은 출력하지 않습니다)")
  const host = new URL(opts.siteUrl).host
  const urlList = [...new Set(opts.urls.map((u) => new URL(u, opts.siteUrl).href))]
  if (urlList.some((u) => new URL(u).host !== host)) throw new Error(`pingIndexNow: 같은 사이트(${host}) 주소만 보낼 수 있습니다`)
  if (urlList.length > 10000) throw new Error(`pingIndexNow: 한 번에 1만 개까지입니다(지금 ${urlList.length}개)`)
  const body = JSON.stringify({ host, key, ...(opts.keyLocation ? { keyLocation: opts.keyLocation } : {}), urlList })
  const send = opts.fetchImpl ?? fetch
  return Promise.all(
    (opts.endpoints ?? INDEXNOW_ENDPOINTS).map(async (endpoint) => {
      const res = await send(endpoint, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body })
      return { endpoint, status: res.status }
    })
  )
}
