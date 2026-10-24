// record.mjs — .sitebrew/* 의 유일한 읽기·쓰기(계획 5 Task 11). 임시 폴더에서만 돈다.
// 사례마다 다른 오류를 잡는다: 왕복 · 키별 합치기(새 at 이 이김, done → doing 되돌림) · 되풀이 불변 · 사본 수렴 · 사본 폴더가 없으면 만들지 않음 ·
// 깨진 JSON → 기본값 · 반쪽 파일 없음 · 허용 밖 키 · 키·전화 모양 값 거절 · 기록할 자리 없음(saved: false) · delivered.json 왕복·사본·.gitignore.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { createRecord, RecordError } from './record.mjs'

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/runbook.generated.json', import.meta.url), 'utf8'))
const record = createRecord({ secretShapes: FIXTURE.secretShapes })
const T1 = '2026-10-22T01:00:00.000Z'
const T2 = '2026-10-22T02:00:00.000Z'
const T3 = '2026-10-22T03:00:00.000Z'

const tmp = mkdtempSync(join(tmpdir(), 'wf-record-'))
after(() => rmSync(tmp, { recursive: true, force: true }))
let n = 0
/** 새 실행 폴더 하나(+ 선택: 이미 .sitebrew 가 있는 사용자 폴더) */
const place = ({ site = false, siteRecord = false } = {}) => {
  const base = join(tmp, `case-${n++}`)
  const run = join(base, 'run')
  mkdirSync(run, { recursive: true })
  const dest = join(base, 'site')
  if (site || siteRecord) mkdirSync(dest, { recursive: true })
  if (siteRecord) mkdirSync(join(dest, '.sitebrew'))
  return { run, site: dest }
}
const stateFile = (dir) => join(dir, '.sitebrew', 'runbook.json')
const text = (f) => readFileSync(f, 'utf8')
const DELIVERED = { version: 1, applied: ['signup', 'payments'], unapplied: [], completion: 'composed', locale: 'ko', tableHash: 'd4d0c274c1b0', deliveredAt: T1 }

test('왕복: 쓴 문·수준·언어·기능·장 진행·물어본 대안 역할을 그대로 읽는다', () => {
  const { run } = place()
  const r = record.writeState({ run }, { door: 'use', level: 'beginner', lang: 'en', features: { table: 'd4d0c274c1b0', outcomes: ['payments', 'signup'] }, chapters: { 'G-hosting': 'doing' }, alternatives: ['hosting'] }, T1)
  assert.equal(r.saved, true)
  assert.deepEqual(record.readState({ run }), {
    door: 'use', level: 'beginner', lang: 'en',
    features: { table: 'd4d0c274c1b0', outcomes: ['payments', 'signup'] },
    chapters: { 'G-hosting': { status: 'doing', at: T1 } },
    alternatives: ['hosting'],
  })
})

test('키별 합치기: 같은 키는 새 at 이 이기고, 다른 키는 지우지 않는다 · done → doing 되돌림도 새 at 이면 받는다', () => {
  const { run } = place()
  record.writeState({ run }, { door: 'use', chapters: { 'G-hosting': 'done', 'G-domain': 'doing' } }, T2)
  record.writeState({ run }, { door: 'skip', level: 'expert' }, T1) // 더 옛 시각의 문 답은 진다
  record.writeState({ run }, { chapters: { 'G-hosting': 'doing' } }, T3) // 되돌림
  const s = record.readState({ run })
  assert.equal(s.door, 'use')
  assert.equal(s.level, 'expert', '다른 키는 그대로 합쳐진다')
  assert.deepEqual(s.chapters, { 'G-domain': { status: 'doing', at: T2 }, 'G-hosting': { status: 'doing', at: T3 } })
})

test('같은 쓰기를 되풀이해도 파일이 바뀌지 않는다', () => {
  const { run } = place()
  const w = { door: 'use', chapters: { 'G-hosting': 'done' }, alternatives: ['hosting'] }
  record.writeState({ run }, w, T1)
  const once = text(stateFile(run))
  record.writeState({ run }, w, T1)
  assert.equal(text(stateFile(run)), once)
})

test('사본: 사용자 폴더의 .sitebrew 가 있으면 함께 쓰고, 따로 쓰인 두 기록은 다음 쓰기에서 같은 글로 수렴한다', () => {
  const { run, site } = place({ siteRecord: true })
  record.writeState({ run }, { door: 'use' }, T1) // 실행 폴더만
  record.writeState({ site }, { chapters: { 'G-hosting': 'done' } }, T2) // 사용자 폴더만(다른 기계에서 이어 한 것)
  assert.deepEqual(record.readState({ run, site }).chapters, { 'G-hosting': { status: 'done', at: T2 } }, '읽기는 두 기록을 합친다')
  record.writeState({ run, site }, { level: 'expert' }, T3)
  assert.equal(text(stateFile(run)), text(stateFile(site)))
  assert.equal(record.readState({ site }).door, 'use')
})

test('사본 폴더(.sitebrew)가 없는 사용자 폴더에는 만들지 않는다 — 실행 폴더에만 쓴다', () => {
  const { run, site } = place({ site: true })
  const r = record.writeState({ run, site }, { door: 'skip' }, T1)
  assert.equal(r.saved, true)
  assert.equal(existsSync(join(site, '.sitebrew')), false)
  assert.equal(text(join(run, '.sitebrew', '.gitignore')), '*\n', '새로 만든 .sitebrew 는 git 에 올라가지 않는다')
})

test('기록할 자리가 없으면(옛 폴더·폴더 없음) 쓰지 않고 saved: false', () => {
  const { site } = place({ site: true })
  assert.deepEqual(record.writeState({ site }, { door: 'use' }, T1), { saved: false })
  assert.deepEqual(readdirSync(site), [])
  assert.deepEqual(record.writeState({ run: join(tmp, 'no-such-run') }, { door: 'use' }, T1), { saved: false })
  assert.deepEqual(record.writeState({}, { door: 'use' }, T1), { saved: false })
})

test('깨진 JSON → 기본값으로 읽고, 다음 쓰기가 바른 파일로 바꾼다', () => {
  const { run } = place()
  mkdirSync(join(run, '.sitebrew'))
  writeFileSync(stateFile(run), '{"door": {"value": "use", "at"')
  assert.deepEqual(record.readState({ run }), { door: null, level: null, lang: null, features: null, chapters: {}, alternatives: [] })
  record.writeState({ run }, { lang: 'ko' }, T1)
  assert.equal(JSON.parse(text(stateFile(run))).lang.value, 'ko')
})

test('반쪽 파일 없음: 바꿔 넣기가 실패하면 던지고 임시 파일을 남기지 않는다', () => {
  const { run } = place()
  mkdirSync(stateFile(run), { recursive: true }) // runbook.json 자리에 폴더가 있어 rename 이 실패한다
  assert.throws(() => record.writeState({ run }, { door: 'use' }, T1))
  assert.deepEqual(readdirSync(join(run, '.sitebrew')).sort(), ['.gitignore', 'runbook.json'])
})

test('허용 밖 키는 쓰지 않는다(던진다) · 파일에 있는 모르는 키는 읽을 때 버린다', () => {
  const { run } = place()
  assert.throws(() => record.writeState({ run }, { note: 'hello' }, T1), RecordError)
  assert.throws(() => record.writeState({ run }, { chapters: { 'G-hosting': 'finished' } }, T1), RecordError, '모르는 상태')
  assert.throws(() => record.writeState({ run }, { door: 'use' }, 'yesterday'), RecordError, '시각 모양')
  assert.equal(existsSync(join(run, '.sitebrew')), false, '거절된 쓰기는 폴더도 만들지 않는다')
  mkdirSync(join(run, '.sitebrew'))
  writeFileSync(stateFile(run), JSON.stringify({ version: 1, door: { value: 'use', at: T1 }, email: { value: 'x', at: T1 } }))
  record.writeState({ run }, { level: 'expert' }, T2)
  assert.deepEqual(Object.keys(JSON.parse(text(stateFile(run)))).sort(), ['alternatives', 'chapters', 'door', 'level', 'version'])
})

test('비밀 방어: 키 모양(표)·전화 모양 값은 패턴을 지나도 거절하고 아무것도 쓰지 않는다', () => {
  const { run } = place()
  const hexKey = 'ab12'.repeat(10) // 키 표 long-hex 에 걸린다(아이디 글자만 써서 아이디 패턴은 지난다)
  assert.throws(() => record.writeState({ run }, { features: { table: 'd4d0c274c1b0', outcomes: [hexKey] } }, T1), /secret|long-hex/)
  assert.throws(() => record.writeState({ run }, { alternatives: ['010' + '1234' + '5678'] }, T1), /phone/)
  assert.throws(() => record.recordDelivery({ run }, { ...DELIVERED, unapplied: [hexKey] }), /long-hex/)
  assert.equal(existsSync(join(run, '.sitebrew')), false)
  // 키 표를 주지 않으면 그 모양은 못 잡는다 — 표가 실제로 쓰이는지 보는 음성 대조
  assert.equal(createRecord().writeState({ run }, { alternatives: [hexKey] }, T1).saved, true)
})

test('delivered.json: 실행 폴더와 사용자 폴더에 쓰고 .gitignore(*) 를 둔다 · 읽기는 사용자 폴더 것이 먼저 · 깨지면 null', () => {
  const { run, site } = place({ site: true })
  const r = record.recordDelivery({ run, dest: site }, DELIVERED)
  assert.equal(r.saved, true)
  for (const d of [run, site]) {
    assert.deepEqual(JSON.parse(text(join(d, '.sitebrew', 'delivered.json'))), DELIVERED)
    assert.equal(text(join(d, '.sitebrew', '.gitignore')), '*\n')
  }
  record.recordDelivery({ run, dest: join(site, '..', 'other') }, { ...DELIVERED, applied: null, completion: 'site' }) // 같은 실행에서 다른 폴더로 다시 받음(폴더 없음 → 실행 폴더만)
  assert.deepEqual(record.readDelivered({ run, site }), DELIVERED, '그 폴더에 넘겨진 것')
  assert.equal(record.readDelivered({ run }).applied, null, '실행 폴더는 마지막 전달')
  writeFileSync(join(site, '.sitebrew', 'delivered.json'), '{')
  assert.equal(record.readDelivered({ site }), null)
  assert.equal(record.readDelivered({ site: join(tmp, 'nowhere') }), null)
  assert.throws(() => record.recordDelivery({ run }, { ...DELIVERED, completion: 'product' }), RecordError)
  assert.throws(() => record.recordDelivery({ run }, { ...DELIVERED, extra: 1 }), RecordError)
})
