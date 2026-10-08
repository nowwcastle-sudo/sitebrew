// CI 도구 자체의 시험(P3-8): 시험 가름 가드·경고 래칫·커버리지 래칫·건너뜀 래칫·워크플로 고정 규칙.
// 순수 함수만 부른다(Chrome·서버 없음 — 가벼운 시험).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseList, splitProblems, loadSplit, chromeToolPaths, CHROME_USE, ROOT } from './lib/split.mjs'
import { lcovTotals, judgeCoverage, judgeSkipped } from './test-light.mjs'
import { judgeWarnings, eslintCounts, STEPS, osvStep } from './verify.mjs'
import { TOOLS, currentTarget } from './tools.mjs'

const CHROME_LINE = `import { ${'start' + 'Chrome'} } from '../qa/cdp.mjs'`

test('parseList: # 뒤 주석·빈 줄을 버린다', () => {
  assert.deepEqual(parseList('# 머리\n\na.test.mjs  # 까닭\n  b.test.mjs\n'), ['a.test.mjs', 'b.test.mjs'])
})

test('가름 가드: 목록에 없는 시험이 Chrome 을 부르면 문제로 잡힌다(양성 대조)', () => {
  const read = (f) => (f === 'x/chrome.test.mjs' ? CHROME_LINE : "import test from 'node:test'")
  const bad = splitProblems(['x/chrome.test.mjs', 'x/pure.test.mjs'], [], read)
  assert.equal(bad.length, 1)
  assert.match(bad[0], /x\/chrome\.test\.mjs.*Chrome/)
  // 목록에 적으면 통과한다.
  assert.deepEqual(splitProblems(['x/chrome.test.mjs', 'x/pure.test.mjs'], ['x/chrome.test.mjs'], read), [])
})

// 도구 이름을 글자로 이어 쓴다 — 이 파일 자신이 이름을 통째로 담으면 가드가 이 시험을 Chrome 시험으로 오인한다.
const TOOL_PATH = 'factory/qa/agent-' + 'boundary.mjs'
test('가름 가드: Chrome 을 띄우는 도구를 자식으로 부르는 시험도 Chrome 시험이다', () => {
  const read = (f) => (f === 'x/a.test.mjs' ? `runTool(join(QA, 'agent-` + `boundary.mjs'), ['--out', d])` : "import test from 'node:test'")
  const bad = splitProblems(['x/a.test.mjs', 'x/b.test.mjs'], [], read, { chromeTools: [TOOL_PATH] })
  assert.equal(bad.length, 1)
  assert.match(bad[0], /x\/a\.test\.mjs/)
  // 무거운 목록에 적으면 통과하고, 면제 표에 까닭과 함께 적어도 통과한다.
  assert.deepEqual(splitProblems(['x/a.test.mjs', 'x/b.test.mjs'], ['x/a.test.mjs'], read, { chromeTools: [TOOL_PATH] }), [])
  assert.deepEqual(splitProblems(['x/a.test.mjs', 'x/b.test.mjs'], [], read, { chromeTools: [TOOL_PATH], exempt: { 'x/a.test.mjs': '순수 도우미만 쓴다' } }), [])
})

test('가름 가드: 도구 이름이 다른 낱말의 일부면 걸리지 않는다', () => {
  const read = () => `import x from './my-agent-` + `boundary.mjs.bak'`
  assert.deepEqual(splitProblems(['x/a.test.mjs'], [], read, { chromeTools: [TOOL_PATH] }), [])
})

test('chromeToolPaths: Chrome 을 띄우는 비시험 .mjs 만 모으고 cdp.mjs 는 뺀다', () => {
  const paths = chromeToolPaths(ROOT)
  assert.ok(paths.includes(TOOL_PATH), paths.join(','))
  assert.ok(paths.every((p) => p.endsWith('.mjs') && !p.endsWith('.test.mjs') && p !== 'factory/qa/cdp.mjs'))
})

test('가름 가드: 목록에 적힌 파일이 없으면 문제다(오래된 줄)', () => {
  const bad = splitProblems(['a.test.mjs'], ['gone.test.mjs'], () => '')
  assert.equal(bad.length, 1)
  assert.match(bad[0], /gone\.test\.mjs/)
})

test('CHROME_USE 가 이 파일 자신의 문자열에 걸리지 않는다(자기 가드에 안 걸림)', () => {
  assert.equal(CHROME_USE.test(readFileSync(join(ROOT, 'ci', 'ci.test.mjs'), 'utf8')), false)
  assert.equal(CHROME_USE.test(CHROME_LINE), true)
})

test('실제 저장소: 가름에 문제 0 · 가벼운 시험이 100개 넘게 남는다 · 무거운 목록은 시험 파일만 가리킨다', () => {
  const s = loadSplit()
  assert.deepEqual(s.problems, [])
  assert.ok(s.light.length > 100, `가벼운 시험 ${s.light.length}`)
  assert.equal(s.light.length + s.heavy.length, s.files.length)
  assert.ok(s.heavy.every((f) => f.endsWith('.test.mjs')))
})

test('경고 래칫: 오류는 0 이어야 하고, 경고는 기준선과 같아야 한다(오르면 새 경고, 내리면 기준선을 줄이라고 실패)', () => {
  assert.equal(judgeWarnings({ errors: 0, warnings: 75 }, 75).ok, true)
  const up = judgeWarnings({ errors: 0, warnings: 76 }, 75)
  assert.equal(up.ok, false); assert.match(up.note, /76.*75/)
  const down = judgeWarnings({ errors: 0, warnings: 74 }, 75)
  assert.equal(down.ok, false); assert.match(down.note, /줄인다/)
  assert.equal(judgeWarnings({ errors: 1, warnings: 0 }, 75).ok, false)
  assert.deepEqual(eslintCounts([{ errorCount: 1, fatalErrorCount: 0, warningCount: 2 }, { errorCount: 0, fatalErrorCount: 1, warningCount: 3 }]), { errors: 2, warnings: 5 })
})

test('lcovTotals: 줄·분기·함수 합과 파일 수', () => {
  const lcov = ['SF:a.mjs', 'FNF:2', 'FNH:1', 'BRF:4', 'BRH:2', 'LF:10', 'LH:9', 'end_of_record', 'SF:b.mjs', 'FNF:2', 'FNH:2', 'BRF:0', 'BRH:0', 'LF:10', 'LH:5', 'end_of_record'].join('\n')
  assert.deepEqual(lcovTotals(lcov), { lines: 70, branches: 50, functions: 75, files: 2 })
  assert.deepEqual(lcovTotals(''), { lines: 100, branches: 100, functions: 100, files: 0 })
})

test('lcovTotals: 같은 파일을 주소 꼬리표(?tag)로 여러 번 불러 기록이 겹치면 한 파일로 합친다', () => {
  // 시험이 import(`…/jobs.mjs?${tag}`)로 다시 부르면 Node 는 같은 SF 기록을 따로 낸다 — 더하면 그 파일을 여러 번 센다
  const rec = (da, brda, fnda) => ['SF:a.mjs', 'FN:1,f', 'FN:5,g', ...fnda.map(([n, c]) => `FNDA:${c},${n}`), 'FNF:2', `FNH:${fnda.filter(([, c]) => c > 0).length}`,
    ...brda.map(([k, t]) => `BRDA:${k},${t}`), `BRF:${brda.length}`, `BRH:${brda.filter(([, t]) => t !== '-' && Number(t) > 0).length}`,
    ...da.map(([l, c]) => `DA:${l},${c}`), `LF:${da.length}`, `LH:${da.filter(([, c]) => c > 0).length}`, 'end_of_record']
  // 줄·함수는 합집합, 분기는 기록마다 V8 블록 번호가 달라 분기가 가장 많은 기록 하나(full 2/3)
  const full = rec([[1, 1], [2, 1], [3, 0], [4, 1]], [['2,0,0', 1], ['2,0,1', 0], ['3,1,0', 1]], [['f', 1], ['g', 0]])
  const top = rec([[1, 1], [2, 0], [3, 1], [4, 0]], [['1,0,0', 1]], [['f', 0], ['g', 1]])
  const lcov = [...full, ...top, ...top].join('\n')
  assert.deepEqual(lcovTotals(lcov), { lines: 100, branches: 66.67, functions: 100, files: 1 })
  const other = ['SF:b.mjs', 'FNF:0', 'FNH:0', 'BRF:0', 'BRH:0', 'LF:4', 'LH:0', 'end_of_record']
  assert.deepEqual(lcovTotals([...full, ...other].join('\n')), { lines: 37.5, branches: 66.67, functions: 50, files: 2 })
})

test('커버리지 래칫: 0.5%p 넘게 내려가면 실패, 1.0%p 넘게 오르면 기준선을 올리라고 실패', () => {
  const base = { lines: 80, branches: 70, functions: 75 }
  assert.equal(judgeCoverage({ lines: 80, branches: 70, functions: 75 }, base).ok, true)
  assert.equal(judgeCoverage({ lines: 79.6, branches: 70, functions: 75 }, base).ok, true)
  const drop = judgeCoverage({ lines: 79.4, branches: 70, functions: 75 }, base)
  assert.equal(drop.ok, false); assert.ok(drop.notes.some((n) => /lines.*내려갔다/.test(n)))
  const rise = judgeCoverage({ lines: 81.2, branches: 70, functions: 75 }, base)
  assert.equal(rise.ok, false); assert.ok(rise.notes.some((n) => /기준선을 올린다/.test(n)))
})

test('건너뜀 래칫: 기준선과 같을 때만 통과', () => {
  assert.equal(judgeSkipped(3, 3).ok, true)
  assert.equal(judgeSkipped(4, 3).ok, false)
  assert.equal(judgeSkipped(2, 3).ok, false)
})

test('워크플로: 모든 uses 는 40자 커밋 해시로 고정돼 있고, 체크아웃은 persist-credentials: false 다', () => {
  const read = (f) => readFileSync(join(ROOT, '.github', 'workflows', f), 'utf8').replace(/\r\n/g, '\n')
  let usesTotal = 0
  for (const f of ['ci.yml', 'security.yml']) {
    const wf = read(f)
    const uses = [...wf.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((m) => m[1])
    usesTotal += uses.length
    for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, `${f} 해시 고정 아님: ${u}`)
    const checkouts = wf.split('actions/checkout@').length - 1
    assert.equal(wf.split('persist-credentials: false').length - 1, checkouts, f)
    assert.match(wf, /^permissions:\n  contents: read$/m, f)
    assert.match(wf, /cancel-in-progress: true/, f)
    assert.equal((wf.match(/timeout-minutes:/g) ?? []).length, 1, f)
  }
  assert.ok(usesTotal >= 4, `uses ${usesTotal}`)
})

test('보안 워크플로: 모든 가지 푸시·PR 에서 돌고 paths-ignore 가 없다 — 문서만 바뀐 푸시·작업 가지 푸시도 비밀값 검사를 받는다(v0.0.12 리뷰 P1-1)', () => {
  const sec = readFileSync(join(ROOT, '.github', 'workflows', 'security.yml'), 'utf8').replace(/\r\n/g, '\n')
  assert.match(sec, /^on:\n  push:\n    branches: \['\*\*'\]$/m)
  assert.match(sec, /^  pull_request:$/m)
  assert.doesNotMatch(sec, /^\s*(?:paths-ignore|paths):/m, '트리거에 경로 거르개가 없다')
  for (const step of ['gitleaks git', 'gitleaks dir', 'osv-scanner', 'zizmor', 'actionlint']) assert.ok(sec.includes(step), step)
  const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')
  assert.doesNotMatch(ci, /gitleaks|osv-scanner/, 'ci.yml 에는 보안 job 이 없다(security.yml 로 옮겼다)')
})

test('ci:verify 는 README 5개 언어 대조(readme:check)를 버전 검사 바로 뒤에 돈다 — 릴리스마다 README 갱신(큐 22·23)', () => {
  const names = STEPS.map(([n]) => n)
  assert.ok(names.includes('readme:check'), names.join(','))
  assert.equal(names.indexOf('readme:check'), names.indexOf('registry:pincheck') + 1)
})

test('ci:verify 마지막 단계는 security:osv — 새 취약점 공지를 push 전에 잡는다(Task 1.2)', () => {
  const names = STEPS.map(([n]) => n)
  assert.ok(names.includes('security:osv'), names.join(','))
  assert.equal(names.at(-1), 'security:osv')
})

test('osvStep: 도구가 없으면 SKIP 이유를 찍고 0, 통과로 위장하지 않는다', () => {
  const lines = []
  const code = osvStep({ resolve: () => null, run: () => assert.fail('도구가 없는데 실행했다'), log: (m) => lines.push(m) })
  assert.equal(code, 0)
  const said = lines.join(' ')
  assert.match(said, /SKIP/)
  assert.match(said, /osv-scanner/)
  assert.match(said, /통과가 아니다/)
})

test('osvStep: 도구가 있으면 잠금 파일과 예외 설정을 넘기고 종료 코드를 그대로 돌려준다', () => {
  const calls = []
  const run = (bin, args) => (calls.push([bin, args]), 1)
  assert.equal(osvStep({ resolve: () => ({ path: 'fake-osv', source: 'pinned' }), run, log: () => {} }), 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'fake-osv')
  assert.deepEqual(calls[0][1], ['scan', 'source', '--lockfile', 'package-lock.json', '--config', 'osv-scanner.toml'])
})

test('tools.json: 도구마다 linux-x64·win32-x64 두 대상, sha256 64자리 16진, 주소는 GitHub 릴리스(launch-factory 사본)', () => {
  for (const [name, t] of Object.entries(TOOLS)) {
    for (const target of ['linux-x64', 'win32-x64']) {
      const x = t.targets?.[target]
      assert.ok(x, `${name} ${target}`)
      assert.match(x.sha256, /^[0-9a-f]{64}$/, `${name} ${target} sha256`)
      assert.match(x.url, /^https:[/][/]github[.]com[/][^/]+[/][^/]+[/]releases[/]download[/]/, `${name} ${target} url`)
    }
  }
})

test('currentTarget: 두 조합은 이름을, 그 밖은 이유와 함께 던진다', () => {
  assert.equal(currentTarget({ platform: 'win32', arch: 'x64' }), 'win32-x64')
  assert.equal(currentTarget({ platform: 'linux', arch: 'x64' }), 'linux-x64')
  assert.throws(() => currentTarget({ platform: 'darwin', arch: 'arm64' }), /darwin-arm64/)
})
