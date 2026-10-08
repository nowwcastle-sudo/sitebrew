// JSON-LD 스크립트 블록 — 값 안의 </script·<!--·U+2028/2029 를 이스케이프한다
const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
}

/** schema.org JSON-LD 값 하나(또는 목록). content-to-jsonld 의 결과를 그대로 받는다 — 이 파일은 다른 항목에 기대지 않는다. */
export type JsonLdData = Record<string, unknown> | Record<string, unknown>[]

/**
 * JSON-LD 를 `<script>` 안에 넣어도 안전한 글자로 바꾼다. `<`·`>`·`&`·U+2028·U+2029 를 \uXXXX 로 적으므로
 * 값에 `</script>`·`<!--` 가 들어 있어도 스크립트 블록을 끝내거나 HTML 주석을 열지 못한다. JSON 으로 읽으면 원래 값 그대로다.
 */
export function serializeJsonLd(data: JsonLdData): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => ESCAPES[c])
}

/**
 * schema.org JSON-LD `<script type="application/ld+json">`. 서버 컴포넌트에서 그대로 쓴다(상태·이벤트 없음).
 * data 는 화면과 같은 콘텐츠 객체에서 만든다 — `toLocalBusiness(content)` 등(content-to-jsonld).
 */
export function JsonLd({ data, id }: { data: JsonLdData; id?: string }) {
  return <script type="application/ld+json" id={id} dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
