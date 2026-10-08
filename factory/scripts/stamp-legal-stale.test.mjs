// 법정 초안 낡음 검사(대장 C122·C114) — 06 은 `07-qa/legal/<쪽>.draft.json` 이 있으면 그것을 그대로 썼다. 골든 재실행(--pick·04 수정 뒤 재생성)에서 옛 사실의 법정 초안이 남았다.
// 이제 초안에 입력 사실 해시(`inputHash`)를 적고, 콘텐츠 사실이 바뀌어 해시가 다르면:
//   · 검토 파일이 없거나 07-qa 가 남긴 「검토 전」 자리 파일뿐이면 → 새 초안을 쓴다(자리 파일은 옛 조항 목록이라 함께 지운다 — 07-qa 가 다시 채운다)
//   · 에이전트·사람의 실제 검토 파일이 있으면 → 검토본 초안은 덮지 않고 「공개 불가 — 법정 초안이 콘텐츠와 다름」 blocker
//   · 해시가 없는 옛 파일 → 지금 사실로 만든 초안과 글이 같으면 낡지 않은 것, 다르면 위와 같다
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-legal-stale.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BLOCKER } from '../stamp/gen-pages.mjs'
import { pendingReview } from '../legal/drafts.mjs'
import { localBrief, localContent, makeRun, gen, root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-legal-stale-test')
const rj = (f) => JSON.parse(readFileSync(f, 'utf8'))
const wj = (f, o) => writeFileSync(f, JSON.stringify(o, null, 2) + '\n')
const STALE = '공개 불가 — 법정 초안이 콘텐츠와 다름: '

async function fresh() {
  const r = await makeRun(TMP, localBrief(), localContent)
  const s = await gen(r)
  const dir = join(r.runDir, 'a', '07-qa', 'legal')
  return { r, s, dir, draft: join(dir, 'privacy.draft.json'), review: join(dir, 'privacy.review.json') }
}
/** 04-content 의 사업체 이름을 바꾼다(법정 초안이 읽는 사실 — 입력 해시가 달라진다). */
function changeFact(r, name = '달빛 제과점') {
  const f = join(r.runDir, 'a', '04-content.json')
  const o = rj(f)
  o.data.business.name = name
  wj(f, o)
}
const staleLines = (s) => s.blockers.filter((b) => b.startsWith(STALE))

test('BLOCKER.legalStale 접두가 정해져 있다(OWN_PREFIXES 에 들어 이 단계가 자기 줄만 바꾼다)', () => {
  assert.equal(BLOCKER.legalStale, STALE)
})

test('초안에 입력 사실 해시(64자)가 적히고, 사실이 그대로면 다시 만들어도 같은 초안 · 낡음 blocker 없음', async () => {
  const { r, s, draft } = await fresh()
  const d1 = rj(draft)
  assert.match(d1.inputHash ?? '', /^[0-9a-f]{64}$/, '초안에 inputHash 가 없다')
  assert.equal(staleLines(s).length, 0)
  const s2 = await gen(r)
  assert.deepEqual(rj(draft), d1, '사실이 그대로인데 초안이 바뀌었다')
  assert.equal(staleLines(s2).length, 0)
})

test('사실이 바뀌고 검토 파일이 없으면 → 새 초안을 쓴다(해시도 새로), 낡음 blocker 는 없다', async () => {
  const { r, draft } = await fresh()
  const d1 = rj(draft)
  changeFact(r)
  const s2 = await gen(r)
  const d2 = rj(draft)
  assert.notEqual(d2.inputHash, d1.inputHash, '해시가 그대로다')
  assert.notEqual(d2.markdown, d1.markdown, '초안 글이 옛 사실 그대로다')
  assert.ok(d2.markdown.includes('달빛 제과점') && !d2.markdown.includes('달빛 베이커리'), '새 사실이 초안에 안 들어갔다')
  assert.equal(staleLines(s2).length, 0)
})

test('사실이 바뀌고 「검토 전」 자리 파일(07-qa 가 만든 pendingReview)뿐이면 → 새 초안을 쓰고 자리 파일은 지운다(옛 조항 목록이라 어긋난다)', async () => {
  const { r, draft, review } = await fresh()
  wj(review, pendingReview({ privacy: rj(draft) }, '법률 에이전트 검토 전 — 검토 파일(review.json)이 없다').privacy)
  changeFact(r)
  const s2 = await gen(r)
  assert.ok(rj(draft).markdown.includes('달빛 제과점'))
  assert.equal(existsSync(review), false, '옛 자리 파일이 남았다')
  assert.equal(staleLines(s2).length, 0)
})

test('사실이 바뀌고 실제 검토 파일이 있으면 → 검토본 초안은 덮지 않고 「법정 초안이 콘텐츠와 다름」 blocker', async () => {
  const { r, draft, review } = await fresh()
  const d1 = rj(draft)
  wj(review, d1.clauses.map((c) => ({ clause: c.id, verdict: 'ok', basis: [], note: '검토함' })))
  changeFact(r)
  const s2 = await gen(r)
  assert.deepEqual(rj(draft), d1, '검토본 초안을 덮어썼다')
  assert.ok(existsSync(review), '검토 파일을 지웠다')
  const lines = staleLines(s2)
  assert.equal(lines.length, 1, s2.blockers.join('\n'))
  assert.ok(lines[0].includes('privacy'), lines[0])
  // 사실을 되돌리면(해시 일치) blocker 가 사라진다
  changeFact(r, '달빛 베이커리')
  const s3 = await gen(r)
  assert.equal(staleLines(s3).length, 0)
})

test('해시가 없는 옛 파일: 지금 사실로 만든 초안과 글이 같으면 낡지 않았다(검토 파일이 있어도 blocker 없음 · 해시만 더해 둔다) · 글이 다르면 낡았다', async () => {
  const { r, draft, review } = await fresh()
  const d1 = rj(draft)
  wj(review, d1.clauses.map((c) => ({ clause: c.id, verdict: 'ok', basis: [], note: '검토함' })))
  // 옛 모양(해시 없음) · 같은 글
  const { inputHash, ...legacy } = d1
  void inputHash
  wj(draft, legacy)
  const sSame = await gen(r)
  assert.equal(staleLines(sSame).length, 0, '글이 같은 옛 파일을 낡았다고 했다')
  // 글이 같아 낡지 않은 옛 파일은 해시 한 칸만 더한다(C357) — 조항·글·검토 파일은 그대로, 해시는 지금 사실의 해시(검토본이라 덮지는 않는다)
  assert.deepEqual(rj(draft), { ...legacy, inputHash: d1.inputHash }, '옛 파일에 해시 말고 다른 것을 바꿨다')
  assert.deepEqual(rj(review), d1.clauses.map((c) => ({ clause: c.id, verdict: 'ok', basis: [], note: '검토함' })), '검토 파일을 건드렸다')
  wj(draft, legacy) // 아래 '글이 다름' 갈래는 해시 없는 옛 파일로 다시 시작한다
  // 옛 모양 · 글이 다름(옛 사실로 쓴 초안) · 검토 파일 있음 → blocker
  wj(draft, { ...legacy, markdown: legacy.markdown.replace('달빛 베이커리', '옛 이름 베이커리') })
  const sOld = await gen(r)
  assert.equal(staleLines(sOld).length, 1, sOld.blockers.join('\n'))
  // 같은 옛 파일이라도 검토 파일이 없으면 새 초안으로 바뀐다
  wj(draft, { ...legacy, markdown: legacy.markdown.replace('달빛 베이커리', '옛 이름 베이커리') })
  rmSync(review)
  const sNew = await gen(r)
  assert.equal(staleLines(sNew).length, 0)
  assert.match(rj(draft).inputHash ?? '', /^[0-9a-f]{64}$/)
  assert.ok(rj(draft).markdown.includes('달빛 베이커리') && !rj(draft).markdown.includes('옛 이름'))
})
