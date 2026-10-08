// 리퍼러 분류 표(표 날짜 REFERRER_TABLE_DATE). 표를 고치면 이 표도 고친다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { referrerKind, utmSourceOf, REFERRER_TABLE_DATE } from "../src/referrer.ts"

const SELF = "shop.example.com"
// [리퍼러, utm_source, 기대]
const TABLE = [
  // AI 답변 엔진
  ["", "chatgpt.com", "ai"], // ChatGPT 검색은 utm_source=chatgpt.com 을 붙인다(OpenAI Publishers FAQ)
  ["https://chatgpt.com/", null, "ai"],
  ["https://chat.openai.com/c/abc", null, "ai"],
  ["https://www.perplexity.ai/search?q=x", null, "ai"],
  ["https://claude.ai/", null, "ai"],
  ["https://gemini.google.com/app", null, "ai"], // google 인데 검색이 아니다
  ["https://copilot.microsoft.com/", null, "ai"],
  ["https://chat.deepseek.com/", null, "ai"],
  ["https://chat.mistral.ai/chat", null, "ai"],
  ["https://grok.com/", null, "ai"],
  ["https://www.meta.ai/", null, "ai"],
  ["", "perplexity", "ai"],
  ["https://www.google.com/", "chatgpt.com", "ai"], // utm 이 먼저다
  // 검색
  ["https://www.google.com/", null, "search"],
  ["https://www.google.co.kr/", null, "search"],
  ["https://google.de/", null, "search"],
  ["https://search.naver.com/search.naver?query=x", null, "search"],
  ["https://m.search.naver.com/", null, "search"],
  ["https://search.daum.net/search?q=x", null, "search"],
  ["https://www.bing.com/", null, "search"],
  ["https://duckduckgo.com/", null, "search"],
  ["https://search.yahoo.co.jp/", null, "search"],
  ["https://search.brave.com/", null, "search"],
  ["", "naver", "search"],
  // 소셜
  ["https://l.facebook.com/l.php?u=x", null, "social"],
  ["https://www.instagram.com/", null, "social"],
  ["https://t.co/abc", null, "social"],
  ["https://x.com/someone", null, "social"],
  ["https://www.linkedin.com/feed/", null, "social"],
  ["https://www.reddit.com/r/x", null, "social"],
  ["https://m.youtube.com/watch?v=1", null, "social"],
  ["https://blog.naver.com/abc", null, "social"], // 네이버 블로그는 검색이 아니다
  ["https://cafe.naver.com/abc", null, "social"],
  ["https://www.threads.net/", null, "social"],
  ["https://news.ycombinator.com/item?id=1", null, "social"],
  ["", "kakaotalk", "social"],
  ["", "https://instagram.com/x", "social"],
  // 직접
  ["", null, "direct"],
  [null, undefined, "direct"],
  ["https://shop.example.com/pricing", null, "direct"], // 같은 사이트 안 이동
  ["not a url", null, "direct"],
  // 기타
  ["https://mail.google.com/mail/u/0", null, "other"], // google 하위 서비스지만 검색이 아니다
  ["https://docs.google.com/document/d/1", null, "other"],
  ["https://example.org/blog/post", null, "other"],
  ["https://notgoogle.com/", null, "other"],
  ["https://fakechatgpt.com/", null, "other"], // 끝이 같아도 하위 도메인이 아니면 아니다
  ["", "newsletter", "other"], // 캠페인이지만 표에 없다
  ["https://shop.example.com/a", "newsletter", "other"],
]

test(`리퍼러 분류 표(${REFERRER_TABLE_DATE}) — ${TABLE.length}행`, () => {
  const wrong = TABLE.filter(([referrer, utmSource, want]) => referrerKind({ referrer, utmSource, selfHost: SELF }) !== want).map(
    ([r, u, want]) => `${r} / ${u}: ${referrerKind({ referrer: r, utmSource: u, selfHost: SELF })} ≠ ${want}`,
  )
  assert.deepEqual(wrong, [])
  const kinds = new Set(TABLE.map((row) => row[2]))
  assert.deepEqual([...kinds].sort(), ["ai", "direct", "other", "search", "social"])
})

test("utmSourceOf", () => {
  assert.equal(utmSourceOf("https://a.com/?utm_source=chatgpt.com&x=1"), "chatgpt.com")
  assert.equal(utmSourceOf("https://a.com/"), undefined)
  assert.equal(utmSourceOf("https://a.com/?utm_source="), undefined)
  assert.equal(utmSourceOf("nope"), undefined)
  assert.equal(utmSourceOf(undefined), undefined)
})
