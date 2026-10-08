// 드리블 패턴 카드(한글 표 형식) → references/patterns/*.md (frontmatter 양식)
// 사용: node factory/scripts/import-cards.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { absentNote, designRulesPath } from '../lib/design-rules.mjs'

const SRC_DIR = designRulesPath('factory/dribbble/pattern_cards') // 선택 자료(WF_DESIGN_RULES_DIR) — 없으면 null
const OUT_DIR = 'references/patterns'

const KIND_MAP = {
  레이아웃: 'layout',
  타이포: 'type',
  색: 'color',
  모션: 'motion',
  컴포넌트: 'component',
  아이콘: 'icon',
}

const RIGHTS = '패턴만 참고, 원본 이미지·코드 미사용'

// "| 필드 | 값 |" 행만 파싱. 값에 내부 파이프(|)가 있어도 greedy 매치가 마지막 "|"에서 끊는다.
function parseCard(content) {
  const rows = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(.+?)\s*\|(.*)\|$/)
    if (!m) continue
    const field = m[1].trim()
    if (field === '필드' || /^-+$/.test(field)) continue
    rows[field] = m[2].trim()
  }
  return rows
}

function yamlStr(s) {
  return JSON.stringify(s)
}

export function buildCard(filename, content) {
  const rows = parseCard(content)
  const kindKo = rows['종류']
  const kind = KIND_MAP[kindKo]
  if (!kind) throw new Error(`알 수 없는 종류: ${kindKo} (${filename})`)

  const shortId = filename.replace(/\.md$/, '').split('_')[0].toLowerCase()
  const id = `${kind}-${shortId}`

  const sources = (rows['출처'] || '')
    .split('<br>')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)

  const freqMatch = (rows['빈도'] || '').match(/^(\d+)/)
  const weight = freqMatch ? Number(freqMatch[1]) : null

  const designMd = rows['규칙 대조'] || ''
  const summary = rows['한 줄 요약'] || ''
  const metrics = rows['관찰 수치'] || ''
  const candidate = rows['구현 후보'] || ''

  const frontmatter = [
    '---',
    `id: ${id}`,
    `kind: ${kind}`,
    `sources: [${sources.map(yamlStr).join(', ')}]`,
    `weight: ${weight}`,
    `design_md: ${yamlStr(designMd)}`,
    `used_in: []`,
    `rights: ${RIGHTS}`,
    '---',
  ].join('\n')

  const body = [
    '## 한 줄 요약',
    summary,
    '',
    '## 관찰 수치',
    metrics,
    '',
    '## 구현 후보',
    candidate,
    '',
  ].join('\n')

  return { id, text: `${frontmatter}\n${body}` }
}

function main() {
  // 원본 카드는 저장소 밖 선택 자료다(D24) — 없으면 기존 references/patterns 를 지우지 않고 한 줄만 알리고 끝낸다.
  if (!SRC_DIR || !existsSync(SRC_DIR)) {
    console.log(absentNote('드리블 패턴 카드 원본(factory/dribbble/pattern_cards)', 'dribbble pattern-card sources (factory/dribbble/pattern_cards)'))
    return
  }
  mkdirSync(OUT_DIR, { recursive: true })
  // 재실행 시 고아 카드가 남지 않도록 기존 카드를 지우고 새로 쓴다(_template.md는 유지).
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith('.md') && f !== '_template.md') unlinkSync(join(OUT_DIR, f))
  }
  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.md'))
  const seen = new Map()
  for (const f of files) {
    const content = readFileSync(join(SRC_DIR, f), 'utf8')
    const { id, text } = buildCard(f, content)
    if (seen.has(id)) throw new Error(`id 충돌: ${id} (${f} vs ${seen.get(id)})`)
    seen.set(id, f)
    writeFileSync(join(OUT_DIR, `${id}.md`), text, 'utf8')
  }
  console.log(`imported ${files.length} cards -> ${OUT_DIR}`)
}

main()
