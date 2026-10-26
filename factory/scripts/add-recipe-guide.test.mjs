// (코드 블록을 읽고 적용하는 부분은 lib/guide-blocks.mjs 로 옮겼다 — _tools 의 verify-public ext-recipe 행도 같은 모듈을 쓴다.)
// 안내 문서 docs/guides/add-recipe.md 의 코드 블록을 저장소 사본에 문서 순서대로 그대로 적용하고 `npm run gen:all` 이 0 으로 끝나는지 본다.
// 문서와 코드가 어긋나면(축 호환·서체 고유·히어로 고유·색 대비·필수 키가 바뀌면) 이 시험이 실패한다 — 안내가 낡았다는 신호다.
// 문서의 표지(코드 블록 첫 줄 뒤에 적는다):
//   ```<언어> file=<경로>                      새 파일을 쓴다(이미 있으면 실패 — 기존 파일을 덮지 않는다)
//   ```<언어> file=<경로> after="<줄>"         그 경로의 파일에서 글자가 <줄> 과 같은 줄(앞뒤 공백 무시) 바로 아래에 블록을 끼운다(그런 줄이 정확히 하나여야 한다)
//   ```sh run                                 줄마다 `npm run <이름>` 한 명령. 차례로 돌려 모두 0 이어야 한다
// 사본 자리: 환경 변수 WF_ADD_RECIPE_COPY_DIR(없으면 임시 폴더). node_modules 는 원본으로 가는 연결(junction)이라 복사하지 않는다.
// 무겁다(사본 만들기 + gen:all 약 1분) — ci/tests-heavy.txt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyFile, guideBlocks } from './lib/guide-blocks.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUIDE = join(ROOT, 'docs', 'guides', 'add-recipe.md')

function listFiles(src) {
  try {
    return execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: src, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\0').filter(Boolean)
  } catch {
    const skip = new Set(['node_modules', '.git', '.tmp', '.next', '.next-export', 'out', 'coverage', '.vercel'])
    const files = []
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (skip.has(e.name)) continue
        const p = join(d, e.name)
        if (e.isDirectory()) walk(p)
        else files.push(relative(src, p).split(sep).join('/'))
      }
    }
    walk(src)
    return files
  }
}

/** 사본을 지운다. node_modules 연결을 먼저 끊어 원본 의존성을 지우지 않는다. */
function removeCopy(dst) {
  const link = join(dst, 'node_modules')
  try { if (lstatSync(link).isSymbolicLink()) rmSync(link, { recursive: false, force: true }) } catch { /* 없다 */ }
  rmSync(dst, { recursive: true, force: true })
}

function makeCopy(src, dst) {
  removeCopy(dst)
  for (const f of listFiles(src)) {
    const from = join(src, f)
    if (!existsSync(from)) continue
    mkdirSync(dirname(join(dst, f)), { recursive: true })
    cpSync(from, join(dst, f))
  }
  symlinkSync(realpathSync(join(src, 'node_modules')), join(dst, 'node_modules'), 'junction')
}

function run(copy, command) {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  return new Promise((resolve) => {
    const child = spawn(command, { cwd: copy, shell: true, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    const timer = setTimeout(() => { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']); else child.kill('SIGKILL') }, 9 * 60 * 1000)
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out }) })
  })
}

test('안내 문서의 모양: 단계 9개가 차례로 있고 한국어 뒤에 English 가 온다', () => {
  const md = readFileSync(GUIDE, 'utf8')
  const heads = [...md.matchAll(/^## (\d+)단계\./gm)].map((m) => Number(m[1]))
  assert.deepEqual(heads, [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.ok(md.indexOf('## English') > md.indexOf('## 9단계.'), 'English 절이 한국어 뒤에 있다')
  const blocks = guideBlocks(md)
  assert.ok(blocks.some((b) => b.attrs.run), '명령 블록(run)이 있다')
  assert.ok(blocks.filter((b) => b.attrs.file).length >= 3, '파일 블록 3개 이상(레시피·히어로 표·히어로 틀)')
})

test('안내 문서의 단계대로 레시피 1벌(새 히어로 포함)을 사본에 더하면 gen:all 이 0 이다', { timeout: 15 * 60 * 1000 }, async () => {
  const blocks = guideBlocks(readFileSync(GUIDE, 'utf8'))
  const files = blocks.filter((b) => b.attrs.file)
  const commands = blocks.filter((b) => b.attrs.run).flatMap((b) => b.text.split('\n').map((l) => l.trim()).filter(Boolean))
  assert.ok(commands.length >= 5, `명령 ${commands.length}개`)
  for (const c of commands) assert.match(c, /^npm run [a-z:-]+$/, `명령 모양: ${c}`)
  for (const need of ['gen:all', 'qa:distinct', 'qa:diversity', 'blocks:check']) assert.ok(commands.includes(`npm run ${need}`), `안내가 ${need} 를 부른다`)

  const copy = process.env.WF_ADD_RECIPE_COPY_DIR || mkdtempSync(join(tmpdir(), 'wf-add-recipe-'))
  try {
    makeCopy(ROOT, copy)

    // 대조: 레시피 파일만 더하고 히어로를 등록하지 않으면 거부된다(안내가 「새 히어로가 필요하다」고 말하는 근거).
    const recipeBlock = files.find((b) => /recipes\/[^/]+\/DESIGN\.md$/.test(b.attrs.file))
    assert.ok(recipeBlock, '레시피 DESIGN.md 블록')
    applyFile(copy, recipeBlock)
    const control = await run(copy, 'node factory/scripts/recipe.mjs')
    assert.notEqual(control.code, 0, '히어로를 등록하지 않으면 거부되어야 한다')
    assert.match(control.out, /hero/, '거부 이유가 hero 를 가리킨다')

    // 안내대로: 나머지 파일 블록을 문서 순서대로, 그다음 명령을 차례로.
    for (const b of files) if (b !== recipeBlock) applyFile(copy, b)
    const done = []
    for (const c of commands) {
      const r = await run(copy, c)
      assert.equal(r.code, 0, `${c} 종료 코드 ${r.code}\n${r.out.slice(-3000)}`)
      done.push(c)
      if (c === 'npm run gen:all') {
        assert.match(r.out, /레시피 차이 검사: \d+벌, 문제 없음/)
        assert.match(r.out, /서체 고유 검사: .*위반 없음/)
        assert.match(r.out, /히어로 고유 검사: .*위반 없음/)
      }
    }
    assert.deepEqual(done, commands)

    const id = /^id: (\S+)/m.exec(recipeBlock.text)[1]
    const hero = /^hero: (\S+)/m.exec(recipeBlock.text)[1]
    assert.ok(existsSync(join(copy, 'registry', 'factory', 'r', id, 'ui', 'button.tsx')), '레시피 부품이 컴파일됐다')
    assert.ok(existsSync(join(copy, 'registry', 'factory', 'recipes', id, 'README.generated.md')), '레시피 안내가 생성됐다')
    assert.match(readFileSync(join(copy, '.tmp', 'recipes', 'heroes.ts'), 'utf8'), new RegExp(`"${hero}"`), '히어로 틀이 갤러리 목록에 이어졌다')
    assert.ok(existsSync(join(ROOT, 'node_modules')), '원본 node_modules 는 그대로다')
  } finally {
    if (!process.env.WF_ADD_RECIPE_KEEP) removeCopy(copy)
  }
  assert.ok(existsSync(join(ROOT, 'node_modules', 'zod')), '사본을 지운 뒤에도 원본 node_modules 가 있다')
})
