// launch-factory: 사이트 검색 조립. 색인 원천은 content/search-index.json(문서 배열 — 없으면 빈 목록)이고, 색인은 종류별로 통째로 바꾼다.
// 질의는 요청 제한(경로 search)을 지난 뒤 DB 의 search_documents 를 ILIKE 로 찾는다. 사용자 개인정보는 색인에 넣지 않는다.
// mock 은 서비스를 처음 만들 때 표가 비어 있으면 같은 파일로 색인한다(키 없이 검색이 바로 보인다). live 는 Cron(/api/cron/search)이 채운다.
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { hitRateLimit } from "@launch-factory/db"
import { createSearchService, normalizeDocument, type SearchDocumentInput, type SearchService } from "@launch-factory/search"
import { createRateLimiter, ipAddressFromEnv, warnNoIpOnce } from "@launch-factory/security/rate-limit"
import { database } from "@/lib/launch/db"
import { env } from "@/lib/launch/env"

let cached: Promise<SearchService> | undefined

export function search(): Promise<SearchService> {
  return (cached ??= build())
}

/** content/search-index.json 을 읽는다. 파일이 없으면 [], 배열이 아니거나 JSON 이 깨졌으면 던진다(조용히 빈 색인으로 바꾸지 않는다) */
export async function loadSearchIndex(): Promise<SearchDocumentInput[]> {
  let text: string
  try {
    text = await readFile(join(process.cwd(), "content", "search-index.json"), "utf8")
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return []
    throw e
  }
  const docs: unknown = JSON.parse(text)
  if (!Array.isArray(docs)) throw new Error("content/search-index.json must be an array of documents")
  return docs as SearchDocumentInput[]
}

/**
 * 색인 파일의 문서로 종류별 색인을 새로 만든다. 파일에 든 종류만 바꾸므로 코드가 따로 색인한 종류(상품·후기 등)는 그대로다.
 * 문서를 모두 먼저 검사해서, 잘못된 문서가 하나라도 있으면 아무것도 바꾸지 않는다. 색인한 문서 수를 돌려준다.
 */
export async function reindex(service?: SearchService): Promise<number> {
  const svc = service ?? (await search())
  const docs = await loadSearchIndex()
  docs.forEach(normalizeDocument)
  const byKind = new Map<string, SearchDocumentInput[]>()
  for (const d of docs) byKind.set(d.kind, [...(byKind.get(d.kind) ?? []), d])
  let n = 0
  for (const [kind, group] of byKind) n += await svc.replaceKind(kind, group)
  return n
}

async function build(): Promise<SearchService> {
  const db = await database()
  const service = createSearchService({
    db,
    // 믿을 IP 머리는 환경이 정한다(대장 D205). 인증·문의 항목과 같은 함수라 같은 사람을 같은 IP 로 센다
    limiter: createRateLimiter({ store: { hit: (key, windowMs, now) => hitRateLimit(db, key, windowMs, now) }, ipAddress: ipAddressFromEnv(process.env), onNoIp: warnNoIpOnce() }),
  })
  if (env().LF_MODE === "mock" && (await service.count()) === 0) await reindex(service)
  return service
}
