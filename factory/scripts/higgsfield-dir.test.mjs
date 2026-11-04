// HIGGSFIELD_DIR 해석(v0.2.6 T15·S8) — doctor · 05-media(object-media) · media:build 가 같은 후보·우선순위로 같은 결과를 낸다.
//   예전에는 media:build 만 「있는지」를 보지 않아, 자료 폴더 아래 기본 자리가 없는데도 폴더가 있는 줄 알고 읽다 죽었다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { higgsfieldDir } from '../lib/higgsfield-dir.mjs'
import { higgsfieldDirOf } from '../stamp/object-media.mjs'
import { runDoctor } from '../doctor.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('같은 환경이면 해석기·05-media·doctor·media:build 가 같은 폴더(또는 같은 없음)를 낸다', async () => {
  const base = mkdtempSync(join(tmpdir(), 'wf-hf-'))
  try {
    const mine = join(base, 'mine'); mkdirSync(mine)
    const rules = join(base, 'rules'); mkdirSync(join(rules, 'factory', 'media', 'higgsfield'), { recursive: true })
    const rulesHf = join(rules, 'factory', 'media', 'higgsfield')
    const clean = { PATH: process.env.PATH, WF_NO_USER_ENV: '1' }
    const cases = [
      { name: '아무것도 없음', env: {}, dir: null },
      { name: '직접 가리킨 폴더가 이긴다', env: { HIGGSFIELD_DIR: mine, WF_DESIGN_RULES_DIR: rules }, dir: mine },
      { name: '자료 폴더 아래 기본 자리', env: { WF_DESIGN_RULES_DIR: rules }, dir: rulesHf },
      { name: '직접 가리킨 폴더가 없다 → 없음(기본 자리로 되돌아가지 않는다)', env: { HIGGSFIELD_DIR: join(base, 'nope'), WF_DESIGN_RULES_DIR: rules }, dir: null },
      { name: '자료 폴더는 있고 기본 자리는 없다 → 없음', env: { WF_DESIGN_RULES_DIR: base }, dir: null },
    ]
    for (const c of cases) {
      const env = { ...clean, ...c.env }
      assert.equal(higgsfieldDir({ env }).dir, c.dir, `${c.name}: 해석기`)
      assert.equal(higgsfieldDirOf(env), c.dir, `${c.name}: 05-media`)
      const { results } = await runDoctor('stamp', { env, strict: false, readSecret: () => null, exec: async () => ({ code: -1 }), fetch: async () => { throw new Error('no network') } })
      const hf = results.find((r) => r.id === 'HIGGSFIELD_DIR')
      // 엄격하지 않은 doctor: 폴더가 있으면 ok, 직접 가리킨 경로가 틀리면 실패, 그 밖의 없음은 통과하는 note.
      assert.equal(hf.ok, c.dir !== null || !env.HIGGSFIELD_DIR, `${c.name}: doctor`)
      assert.equal(Boolean(hf.note), c.dir === null && !env.HIGGSFIELD_DIR, `${c.name}: doctor note`)
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./factory/media/build-media.mjs').then((m) => console.log(JSON.stringify(m.HIGGSFIELD_DIR)))"], { cwd: ROOT, env, encoding: 'utf8', timeout: 60_000 })
      assert.equal(r.status, 0, r.stderr)
      assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()), c.dir, `${c.name}: media:build`)
    }
  } finally { rmSync(base, { recursive: true, force: true }) }
})
