// 이 제품에 켜진 기능과 남은 쪽 — 화면이 없는 쪽으로 가는 링크·띠를 고르는 한 곳.
// enabled.json 은 시안을 얹을 때(launch-factory scripts/compose 의 drop 블록) 쓴다: { parts: 켜진 부품, urls: 남은 쪽·API 주소 }.
// 템플릿 그대로(값이 null)면 전부 켜짐이라 화면은 이 파일이 없던 때와 같다.
// node 시험이 별칭(@/)을 못 풀기 때문에 이 파일은 별칭 없이 쓴다.
import raw from "./enabled.json" with { type: "json" }

export type Enabled = { parts: readonly string[] | null; urls: readonly string[] | null }

const trimmed = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path)

/** 켜짐 목록 하나로 판정 함수를 만든다. 값이 null 이면 전부 켜짐 */
export function makeEnabled({ parts, urls }: Enabled) {
  /** 부품이 켜져 있는가 */
  const hasPart = (part: string) => !parts || parts.includes(part)
  /**
   * 이 주소(경로만 본다 — ?쿼리·#앵커·끝 슬래시는 뗀다)의 쪽이 남아 있는가. 같은 사이트 경로(/…)가 아니면 늘 참이다.
   * 한계: urls 와 글자가 똑같아야 맞는다. 동적 구간(`/blog/[slug]`·`[...all]`)은 목록에 그 모양 그대로 있어서, 실제 주소(`/blog/hello`)는 맞지 않아 거짓이 된다.
   * 이 함수는 정해진 주소(`/pricing` 같은 고정 링크)에만 쓴다 — 동적 주소로 가는 링크를 거르는 데 쓰지 않는다.
   */
  const hasUrl = (href: string) => {
    if (!urls || !href.startsWith("/") || href.startsWith("//")) return true
    return urls.includes(trimmed(href.split(/[?#]/)[0]))
  }
  /** 남은 쪽으로 가는 링크만 */
  const linksOn = <T extends { href: string }>(links: readonly T[]): T[] => links.filter((l) => hasUrl(l.href))
  /** 쪽이 남아 있으면 그 주소, 지워졌으면 대신 갈 주소 */
  const go = (href: string, fallback: string) => (hasUrl(href) ? href : fallback)
  return { hasPart, hasUrl, linksOn, go }
}

export const { hasPart, hasUrl, linksOn, go } = makeEnabled(raw as Enabled)
