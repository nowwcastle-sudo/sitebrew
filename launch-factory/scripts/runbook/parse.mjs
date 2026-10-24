// 런북 장 글(docs/runbook/*.md) 파서 — 순수 함수. 파일을 읽지 않는다(sources.mjs 가 읽어 넘긴다).
// 규약(docs/runbook/README.md): 한국어 부분 → 줄 전체가 `---` 인 줄(코드 블록 밖) → English 부분.
// `## G-xxx — 제목` 이 장이고(영어 제목의 「— 제목」은 생략 가능), `G-` 로 시작하지 않는 `##` 절은 그 파일의 공유 절이다.
// 첫 `##` 앞의 머리말은 장도 공유 절도 아니다.

export const GID = /^G-[a-z]+(?:-[a-z]+)*$/
const CHAPTER_HEADING = /^## (G-[a-z]+(?:-[a-z]+)*)(?:\s+—\s+(\S.*?))?\s*$/
const SECTION_HEADING = /^## (?!#)/
const RULE = /^---\s*$/
const FENCE = /^\s*(```|~~~)/
const ENV_NAME = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/
const ENV_WORD = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g
const CODE_SPAN = /`([^`\n]+)`/g

// 행동 줄: 「등록」·「설정」 칸. 이 낱말들은 장 글 규약의 칸 이름이다(사용자 문장이 아니다 — README 가 정한다).
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/
const ACTION_ITEM = /^(?:등록|설정|Register|Config(?:ure)?|Set ?up)(?:\s*\d+)?\s*(?::|—|–)\s*(.*)$/i
const ACTION_HEADING = /^#{3,6}\s+(?:등록|설정|Register|Config(?:ure)?|Set ?up)\s*$/i
const NONE = /^(?:없음|nothing|none)(?![A-Za-z])/i
const HEADING = /^#{1,6}\s/

const fail = (code, file, line, message) => Object.assign(new Error(`${file}:${line}: ${message}`), { code })

/** 코드 블록 밖에 있는 줄인지 표시한 줄 목록 */
function markLines(text) {
  let fence = null
  return text.split(/\r?\n/).map((line) => {
    const open = line.match(FENCE)?.[1]
    if (fence === null && open) {
      fence = open
      return { line, code: true }
    }
    if (fence !== null) {
      if (open === fence) fence = null
      return { line, code: true }
    }
    return { line, code: false }
  })
}

const trimBlank = (lines) => {
  let a = 0
  let b = lines.length
  while (a < b && lines[a].trim() === "") a++
  while (b > a && lines[b - 1].trim() === "") b--
  return lines.slice(a, b).join("\n")
}

/** 한 언어 부분을 절로 나눈다. offset = 이 부분 첫 줄의 0 기준 번호 */
function parsePart(marked, offset, file) {
  const sections = []
  marked.forEach(({ line, code }, i) => {
    if (!code && SECTION_HEADING.test(line)) {
      const at = offset + i + 1
      if (line.startsWith("## G-")) {
        const m = line.match(CHAPTER_HEADING)
        if (!m) throw fail("badHeading", file, at, `chapter heading must be "## G-xxx — title" (got ${JSON.stringify(line)})`)
        sections.push({ gid: m[1], title: m[2] ?? "", at, heading: line, lines: [] })
      } else sections.push({ gid: null, at, heading: line, lines: [] })
    } else sections.at(-1)?.lines.push(line)
  })
  const chapters = new Map()
  const shared = []
  for (const s of sections) {
    if (s.gid === null) {
      shared.push(trimBlank([s.heading, "", ...s.lines]))
      continue
    }
    if (chapters.has(s.gid)) throw fail("dupGid", file, s.at, `chapter ${s.gid} appears twice in one language part`)
    chapters.set(s.gid, { title: s.title, body: trimBlank(s.lines) })
  }
  return { chapters, shared: shared.length ? shared.join("\n\n") : undefined }
}

/**
 * @param {string} md 장 글 파일 내용
 * @param {string} file 오류 메시지에 쓸 파일 이름
 * @returns {{ shared: { ko?: string, en?: string }, chapters: { gid: string, title: { ko?: string, en?: string }, body: { ko?: string, en?: string } }[] }}
 */
export function parseChapterFile(md, file) {
  const marked = markLines(md)
  const rule = marked.findIndex(({ line, code }) => !code && RULE.test(line))
  if (rule === -1) throw fail("noRule", file, marked.length, `no line "---" separating the Korean part from the English part`)
  const parts = { ko: parsePart(marked.slice(0, rule), 0, file), en: parsePart(marked.slice(rule + 1), rule + 1, file) }
  const gids = [...new Set([...parts.ko.chapters.keys(), ...parts.en.chapters.keys()])]
  const chapters = gids.map((gid) => {
    const title = {}
    const body = {}
    for (const lang of ["ko", "en"]) {
      const c = parts[lang].chapters.get(gid)
      if (c) [title[lang], body[lang]] = [c.title, c.body]
    }
    return { gid, title, body }
  })
  const shared = {}
  for (const lang of ["ko", "en"]) if (parts[lang].shared !== undefined) shared[lang] = parts[lang].shared
  return { shared, chapters }
}

/** 백틱 안 UPPER_SNAKE 이름(코드 블록 안은 낱말 단위로도), 정렬·중복 제거 */
export function envTokens(text) {
  const names = new Set()
  for (const { line, code } of markLines(text ?? "")) {
    if (code) for (const [w] of line.matchAll(ENV_WORD)) names.add(w)
    else for (const [, span] of line.matchAll(CODE_SPAN)) if (ENV_NAME.test(span.trim())) names.add(span.trim())
  }
  return [...names].sort()
}

/**
 * 「등록」·「설정」 칸의 행동 줄 수. 두 모양을 센다:
 *  - 칸 이름 목록 줄(`- 등록 1 — …`, `- 설정: …`)은 하나 — 내용이 「없음」이면 세지 않고, 비어 있으면 그 아래 들여쓴 목록 줄을 센다.
 *  - `### 등록`·`### 설정` 제목 아래 목록 줄은 다음 제목까지 하나씩.
 */
export function actions(text) {
  let count = 0
  let heading = false // `### 등록` 아래인가
  let nestedUnder = null // 비어 있는 칸 이름 줄의 들여쓰기 — 그보다 깊은 목록 줄을 센다
  for (const { line, code } of markLines(text ?? "")) {
    if (code) continue
    if (HEADING.test(line)) {
      heading = ACTION_HEADING.test(line.trim())
      nestedUnder = null
      continue
    }
    const item = line.match(LIST_ITEM)
    if (!item) continue
    const [, indent, rest] = item
    if (nestedUnder !== null) {
      if (indent.length > nestedUnder) {
        count++
        continue
      }
      nestedUnder = null
    }
    const label = rest.match(ACTION_ITEM)
    if (label) {
      const content = label[1].trim()
      if (content === "") nestedUnder = indent.length
      else if (!NONE.test(content)) count++
    } else if (heading) count++
  }
  return count
}
