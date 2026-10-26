// @launch-factory/search — 사이트 검색(계획 3c Task 2). 낱말 정리·조회 명세·조각은 순수 모듈, 서비스는 그것들을 DB 와 요청 제한에 잇는다.
export { normalizeQuery, normalizeDocument, escapeLike, likePattern, isKind, MAX_QUERY_LENGTH, MAX_TERMS, MAX_BODY_LENGTH, MAX_TITLE_LENGTH, type SearchDocumentInput, type NormalizedDocument } from "./normalize.ts"
export { buildQuery, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type SearchInput, type SearchQuery } from "./query.ts"
export { makeSnippet, SNIPPET_LENGTH, SNIPPET_LEAD, type Snippet } from "./snippet.ts"
export { createSearchService, type SearchContext, type SearchItem, type SearchResult, type SearchService, type SearchServiceOptions } from "./service.ts"
