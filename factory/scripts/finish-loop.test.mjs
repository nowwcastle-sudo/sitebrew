// 마감 리뷰 루프(v0.2.6 T13) — 파일 상태가 정하는 다음 걸음, 처방 적용의 진행 기록, 한 걸음 실행. 06 을 돌리지 않는다(다시 만들기·revise 는 가짜).
//   node --test --test-force-exit --test-timeout=300000 factory/scripts/finish-loop.test.mjs
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { applyRound, nextStep, runFinishLoop } from '../stamp/finish-loop.mjs'
import { parseArgs, UsageError } from '../stamp/stamp.mjs'

const made = []
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

const review = (n, disposition, findings = []) => `# Review ${n}\ndisposition: ${disposition}\n${findings.map(([id, p]) => `\n## ${id}\nwhere: hero\nproblem: p\nprescription: ${p}\n`).join('')}`
const REVISE = (s) => `revise "${s}"`

/** 빈 실행 폴더(후보 b) — files: { '09-review/review-1.md': 글, … } */
function runWith(files = {}) {
  const run = mkdtempSync(join(tmpdir(), 'finish-loop-'))
  made.push(run)
  mkdirSync(join(run, 'b', 'site', 'content'), { recursive: true })
  writeFileSync(join(run, 'b', 'site', 'content', 'site.json'), '{}')
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(run, 'b', rel, '..'), { recursive: true })
    writeFileSync(join(run, 'b', rel), text)
  }
  return run
}
const applied = (n, status = 'applied') => JSON.stringify({ round: n, complete: true, outcomes: { F1: { status } } })
const step = (run) => { const s = nextStep(run, 'b'); return [s.action, s.round] }

describe('nextStep', () => {
  it('walks one round: no review → review, fix → apply → verdict → done', () => {
    const r1 = review(1, 'fix', [['F1', REVISE('히어로를 더 차분하게')]])
    assert.deepEqual(step(runWith()), ['review', 1])
    assert.deepEqual(step(runWith({ '09-review/review-1.md': r1 })), ['apply', 1])
    assert.deepEqual(step(runWith({ '09-review/review-1.md': r1, '09-review/applied-1.json': applied(1) })), ['verdict', 1])
    assert.deepEqual(step(runWith({ '09-review/review-1.md': r1, '09-review/applied-1.json': applied(1), '09-review/verdict-1.md': '# Verdict 1\nF1: resolved\n' })), ['done', 1])
    assert.deepEqual(step(runWith({ '09-review/review-1.md': review(1, 'ship') })), ['done', 1])
  })

  it('starts round 2 after an unresolved verdict, and asks a person after round 2', () => {
    const r = (n) => review(n, 'fix', [['F1', REVISE('히어로를 더 차분하게')]])
    const round1 = { '09-review/review-1.md': r(1), '09-review/applied-1.json': applied(1), '09-review/verdict-1.md': '# Verdict 1\nF1: partial\n' }
    assert.deepEqual(step(runWith(round1)), ['review', 2])
    const round2 = { ...round1, '09-review/review-2.md': r(2), '09-review/applied-2.json': applied(2), '09-review/verdict-2.md': '# Verdict 2\nF1: unresolved\n' }
    assert.deepEqual(step(runWith(round2)), ['ask-human', 2])
    // 풀렸어도 새 문제가 생겼으면 한 번 더 — 2라운드 안이면 다음 라운드, 상한이면 사람
    assert.deepEqual(step(runWith({ ...round1, '09-review/verdict-1.md': '# Verdict 1\nF1: resolved\nregression: 푸터가 잘린다\n' })), ['review', 2])
    assert.deepEqual(step(runWith({ ...round2, '09-review/verdict-2.md': '# Verdict 2\nF1: resolved\nregression: 푸터가 잘린다\n' })), ['ask-human', 2])
  })

  it('counts a finding missing from the verdict as unresolved', () => {
    const files = { '09-review/review-1.md': review(1, 'fix', [['F1', REVISE('a')], ['F2', REVISE('b')]]), '09-review/applied-1.json': applied(1), '09-review/verdict-1.md': '# Verdict 1\nF1: resolved\n' }
    assert.deepEqual(step(runWith(files)), ['review', 2])
  })

  it('stops for a person on a human prescription, on rebuild, and when no prescription could be applied', () => {
    assert.deepEqual(step(runWith({ '09-review/review-1.md': review(1, 'fix', [['F1', REVISE('a')], ['F2', 'human 로고 파일']]) })), ['ask-human', 1])
    assert.deepEqual(step(runWith({ '09-review/review-1.md': review(1, 'rebuild', [['F1', 'human 원형이 맞지 않는다']]) })), ['ask-human', 1])
    assert.deepEqual(step(runWith({ '09-review/review-1.md': review(1, 'fix', [['F1', REVISE('a')]]), '09-review/applied-1.json': applied(1, 'asked') })), ['ask-human', 1])
  })

  it('allows one recapture and asks a person on the second', () => {
    const files = { '09-review/review-1.md': review(1, 'recapture') }
    const s = nextStep(runWith(files), 'b')
    assert.deepEqual([s.action, s.round, s.recapture], ['review', 1, true])
    assert.deepEqual(step(runWith({ ...files, '09-review/review-1.recaptured-1.md': 'old' })), ['ask-human', 1])
  })

  it('asks for the file again, without throwing, when a review or verdict is malformed or numbered wrongly', () => {
    const bad = nextStep(runWith({ '09-review/review-1.md': 'not a review' }), 'b')
    assert.deepEqual([bad.action, bad.round], ['review', 1])
    assert.match(bad.why, /형식 오류/)
    assert.deepEqual(step(runWith({ '09-review/review-1.md': review(2, 'ship') })), ['review', 1]) // 파일 번호와 문서 번호가 다르다
    const r1 = review(1, 'fix', [['F1', REVISE('a')]])
    assert.deepEqual(step(runWith({ '09-review/review-1.md': r1, '09-review/applied-1.json': applied(1), '09-review/verdict-1.md': '# Verdict 1\nF1: maybe\n' })), ['verdict', 1])
  })
})

describe('applyRound', () => {
  // revise.mjs 의 세 함수를 흉내 낸다 — 부른 순서를 calls 에 남긴다.
  const INDEX = { 첫째: 1, 둘째: 2 }
  const fakeApi = (script = {}) => {
    const calls = []
    return {
      calls,
      parseRevision: (text) => (script.ask?.includes(text) ? { ask: '어느 구획인가요?' } : { scope: 'section', text }),
      revise: async (_run, _pick, request, opts) => {
        calls.push(['revise', request.text, opts])
        const waiting = script.waitOnce?.delete(request.text)
        return waiting ? { index: 9, status: 'waiting-copy', waiting: { requestFile: 'copy.request.json' }, variants: [] } : { index: INDEX[request.text] ?? 1, variants: [{ id: 'v1' }] }
      },
      applyRevision: async (_run, _pick, index, id) => { calls.push(['apply', index, id]); return { applied: true } },
    }
  }
  const twoFindings = () => runWith({ '09-review/review-1.md': review(1, 'fix', [['F1', REVISE('첫째')], ['F2', REVISE('둘째')]]) })

  it('applies each prescription in order with n 1 and no install, and records the outcome', async () => {
    const run = twoFindings()
    const api = fakeApi()
    const r = await applyRound(run, 'b', 1, api)
    assert.deepEqual(api.calls.map((c) => c[0] + ':' + (c[1] ?? '')), ['revise:첫째', 'apply:1', 'revise:둘째', 'apply:2'])
    assert.deepEqual(api.calls[0][2], { n: 1, install: false })
    assert.deepEqual(Object.values(r.outcomes).map((o) => o.status), ['applied', 'applied'])
  })

  it('stops at a copy wait and, on the rerun, does not apply the finished prescription again', async () => {
    const run = twoFindings()
    const api = fakeApi({ waitOnce: new Set(['둘째']) })
    const first = await applyRound(run, 'b', 1, api)
    assert.equal(first.waiting.id, 'F2')
    assert.equal(JSON.parse(readFileSync(join(run, 'b', '09-review', 'applied-1.json'), 'utf8')).complete, false)
    api.calls.length = 0
    await applyRound(run, 'b', 1, api)
    assert.deepEqual(api.calls.map((c) => c[0] + ':' + (c[1] ?? '')), ['revise:둘째', 'apply:2'], 'F1 was not revised again')
  })

  it('records a question from the reader as asked and applies nothing for it', async () => {
    const run = twoFindings()
    const api = fakeApi({ ask: ['첫째'] })
    const r = await applyRound(run, 'b', 1, api)
    assert.equal(r.outcomes.F1.status, 'asked')
    assert.equal(r.outcomes.F2.status, 'applied')
    assert.ok(!api.calls.some((c) => c[1] === '첫째'))
  })
})

describe('runFinishLoop', () => {
  const ok = () => { const f = async () => { f.n++; return { ok: true } }; f.n = 0; return f }
  const apiOk = { parseRevision: () => ({ scope: 'section' }), revise: async () => ({ index: 1, variants: [{ id: 'v1' }] }), applyRevision: async () => ({ applied: true }) }
  const r1 = review(1, 'fix', [['F1', REVISE('히어로를 더 차분하게')]])

  it('prints one REVIEW line first and exits 3 when the reviewer has to write a file', async () => {
    const run = runWith()
    const r = await runFinishLoop({ runDir: run, pick: 'b' }, { rebuild: ok(), say: () => {} })
    assert.equal(r.lines[0], 'REVIEW review 1')
    assert.equal(r.code, 3)
  })

  it('apply: rebuilds once, closes the round and exits 0; the next step is the verdict', async () => {
    const run = runWith({ '09-review/review-1.md': r1 })
    const rebuild = ok()
    const r = await runFinishLoop({ runDir: run, pick: 'b' }, { rebuild, api: apiOk, say: () => {} })
    assert.equal(r.lines[0], 'REVIEW apply 1')
    assert.equal(r.code, 0)
    assert.equal(rebuild.n, 1)
    assert.deepEqual(step(run), ['verdict', 1])
  })

  it('apply: a failed rebuild exits 1 and leaves the round open so the next run retries only the rebuild', async () => {
    const run = runWith({ '09-review/review-1.md': r1 })
    const r = await runFinishLoop({ runDir: run, pick: 'b' }, { rebuild: async () => ({ ok: false, message: '빌드 실패' }), api: apiOk, say: () => {} })
    assert.equal(r.code, 1)
    assert.deepEqual(step(run), ['apply', 1])
    const again = ok()
    const calls = []
    await runFinishLoop({ runDir: run, pick: 'b' }, { rebuild: again, api: { ...apiOk, revise: async () => { calls.push('revise'); return apiOk.revise() } }, say: () => {} })
    assert.deepEqual(calls, [], 'the applied prescription was not revised again')
    assert.equal(again.n, 1)
  })

  it('recapture: puts the review aside and marks 07 stale so the next stamp takes new screenshots', async () => {
    const run = runWith({ '09-review/review-1.md': review(1, 'recapture') })
    writeFileSync(join(run, 'b', '07-qa.json'), JSON.stringify({ inputHash: 'abc', data: {} }))
    const r = await runFinishLoop({ runDir: run, pick: 'b' }, { rebuild: ok(), say: () => {} })
    assert.equal(r.code, 3)
    assert.ok(!existsSync(join(run, 'b', '09-review', 'review-1.md')))
    assert.ok(existsSync(join(run, 'b', '09-review', 'review-1.recaptured-1.md')))
    assert.match(JSON.parse(readFileSync(join(run, 'b', '07-qa.json'), 'utf8')).inputHash, /^stale:/)
    assert.deepEqual(step(run), ['review', 1])
  })
})

describe('stamp.mjs --finish-review', () => {
  it('needs --run and --pick and refuses to mix with other modes', () => {
    assert.equal(parseArgs(['--run', 'out/x', '--pick', 'b', '--finish-review']).finishReview, true)
    assert.throws(() => parseArgs(['--run', 'out/x', '--finish-review']), UsageError)
    assert.throws(() => parseArgs(['--run', 'out/x', '--pick', 'b', '--finish-review', '--revise-undo']), UsageError)
    assert.throws(() => parseArgs(['--brief', 'b.json', '--run', 'out/x', '--pick', 'b', '--finish-review']), UsageError)
  })
})
