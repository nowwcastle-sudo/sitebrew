// 끝에서 끝 시험: 실제 launch-factory 가 만든 런북 데이터로 deliver 기록 → gate → open → chapter(전문가용·초보자용 브리프) → check → alternatives → mark.
// 스킬을 부르는 AI 부분은 자동화하지 않는다 — 초보자용 글은 브리프에서 규칙대로 기계가 만든 정상 글이다.
// 실제 LF 는 환경 변수 FACTORY_LF_SRC 또는 옆 폴더 ../launch-factory 에서 찾고, 없으면 건너뛴다(이유를 출력).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { recordDelivery } from './index.mjs'

const CLI = join(import.meta.dirname, 'runbook.mjs')
const LF = resolve(process.env.FACTORY_LF_SRC ?? join(import.meta.dirname, '..', '..', '..', 'launch-factory'))
const HAVE_LF = existsSync(join(LF, 'docs', 'runbook', 'runbook.generated.json')) && existsSync(join(LF, 'features', 'outcomes.generated.json'))
const TODAY = '2026-10-23'
const skip = HAVE_LF ? false : `real launch-factory not found (${LF}) — set FACTORY_LF_SRC`
if (skip) console.log(`# e2e skipped: ${skip}`)

const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
const TABLE = HAVE_LF ? json(join(LF, 'features', 'outcomes.generated.json')) : null
const DATA = HAVE_LF ? json(join(LF, 'docs', 'runbook', 'runbook.generated.json')) : null

/** 명령 하나 — 표준출력은 늘 JSON 문서 하나. */
function cli(args, at) {
  const r = spawnSync(process.execPath, [CLI, ...args, ...at, '--lf', LF, '--today', TODAY], { encoding: 'utf8' })
  return { code: r.status, json: JSON.parse(r.stdout), stderr: r.stderr }
}

/** 실행 폴더 + 사용자 폴더를 만들고 deliver 가 하는 대로 기록한다. */
function deliverTo(root, { applied, completion, locale }) {
  const run = join(root, 'run')
  const dest = join(root, 'site')
  mkdirSync(join(run), { recursive: true })
  mkdirSync(dest, { recursive: true })
  const r = recordDelivery({ run, dest }, { version: 1, applied, unapplied: [], completion, locale, tableHash: TABLE.hash, deliveredAt: '2026-10-22T00:00:00.000Z' })
  assert.notEqual(r.saved, false)
  return { run, dest }
}

/** 브리프에서 규칙 ①~⑧ 을 지키는 글을 기계로 만든다(번호 단계 · 이름 · 도움 문장 · 오래됨 문장 · 맺음). */
function draftFrom(brief) {
  const { chapter, helpLine } = brief
  const steps = Math.max(3, Math.min(3, chapter.check?.actions ?? 3))
  const lines = []
  if (chapter.stale && chapter.staleLine) lines.push(chapter.staleLine)
  const names = chapter.mustName
  for (let i = 1; i <= steps; i++) lines.push(`${i}. ${names[i - 1] ? `\`${names[i - 1]}\` 이름으로 넣어요.` : '다음 단계로 가요.'}`)
  for (const n of names.slice(steps)) lines.push(`- \`${n}\` 이름도 넣어요.`)
  lines.push(helpLine)
  return lines.join('\n')
}

const SCENES = [
  { name: 'intro site (local, nothing chosen)', applied: [], completion: 'site', locale: 'ko', composed: false },
  { name: 'product site (signup + payments, ko)', applied: ['signup', 'payments'], completion: 'composed', locale: 'ko', composed: true },
]

for (const scene of SCENES) {
  test(`e2e — ${scene.name}`, { skip }, (t) => {
    const root = mkdtempSync(join(tmpdir(), 'runbook-e2e-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const at = deliverTo(root, scene)
    const atRun = ['--run', at.run]

    // 문: 기록이 있으면 묻지 않고 선택이 정해지지만, 문은 사용자가 열어야 한다.
    assert.equal(cli(['gate'], atRun).json.door, 'ask')
    assert.equal(cli(['open'], atRun).code, 5)
    assert.equal(cli(['gate', '--answer', 'yes'], atRun).json.door, 'use')

    const open = cli(['open'], atRun)
    assert.equal(open.code, 0)
    const planned = open.json.plan.chapters
    assert.ok(planned.includes('G-hosting'), 'always chapters are in every plan')
    assert.equal(planned.includes('G-auth'), scene.composed, 'feature chapters only when chosen')
    assert.equal(planned.includes('G-billing'), scene.composed)
    // 순서는 데이터의 order 에서 거른 것(다시 정렬하지 않는다).
    assert.deepEqual(planned, DATA.order.filter((g) => planned.includes(g)))
    assert.match(open.json.text, /\| /)

    // 전문가용: 계획에 든 장의 본문 이름이 모두 그대로 있다.
    const all = cli(['chapter', 'all', '--level', 'expert'], atRun)
    assert.equal(all.code, 0)
    const missing = open.json.plan.missing.map((m) => m.gid)
    for (const g of planned.filter((x) => !missing.includes(x))) {
      for (const n of DATA.chapters[g].mustName) assert.ok(all.json.text.includes(n), `${g} ${n}`)
    }

    // 초보자용: 장마다 브리프 → 규칙대로 쓴 글 → check 0.
    for (const g of planned.filter((x) => !missing.includes(x))) {
      const b = cli(['chapter', g, '--level', 'beginner'], atRun)
      assert.equal(b.code, 0, g)
      const file = join(root, `${g}.md`)
      writeFileSync(file, draftFrom(b.json.brief))
      const c = cli(['check', g, '--file', file], atRun)
      assert.equal(c.code, 0, `${g}: ${JSON.stringify(c.json.problems)}`)
    }

    // 대안: 카드의 역할에 대안이 있으면 가능한 쪽과 바꾸는 비용을 붙여 돌려준다.
    const withAlt = planned.find((g) => DATA.alternatives[DATA.chapters[g]?.card.role]?.length)
    assert.ok(withAlt, 'at least one planned chapter has alternatives')
    const alt = cli(['alternatives', withAlt], atRun)
    assert.equal(alt.code, 0)
    assert.ok(JSON.stringify(alt.json).includes('switch'))

    // 진행 표시: done → doing 되돌림이 된다.
    const first = planned[0]
    assert.equal(cli(['mark', first, 'done'], atRun).code, 0)
    assert.equal(cli(['mark', first, 'doing'], atRun).code, 0)
    // 사본이 수렴한다: 두 폴더를 함께 주고 쓰면(읽기만으로는 쓰지 않는다) 사용자 폴더에도 기록이 남아, 그 폴더만 줘도 문이 열려 있다.
    assert.equal(cli(['mark', '--level', 'beginner'], ['--site', at.dest, '--run', at.run]).code, 0)
    assert.equal(cli(['gate'], ['--site', at.dest]).json.door, 'use')
  })
}
