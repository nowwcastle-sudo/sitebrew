// 레시피 교체 실험(T9-c2): 새 소비자 한 곳에 레시피 두 벌을 차례로 add 하고 빌드한다.
// 사용: node factory/scripts/recipe-swap.mjs [--work <폴더>] [--keep]   (= npm run qa:swap -- …)
//   1. 저장소 로컬 빌드: npx shadcn@4.21.0 build -o <work>/r0
//   2. 두 번째 레시피(시험용 고정물 factory/scripts/fixtures/recipes/good-swap, id t13-swap — 게시하지 않는다)를
//      <work>/fx 에 컴파일하고 따로 shadcn build(<work>/fx/registry/factory/r 에서)
//   3. 두 빌드를 <work>/localreg 로 합치며 의존 주소 nowwcastle-sudo/sitebrew/<이름>#vX 를 ../localreg/<이름>.json 으로 바꾼다
//   4. <work> 에서 init -t next -b base -p nova, consumer 에서 add r1-measure → add t13-swap → npm run build
//   5. layout.tsx 에 같은 이름의 선언이 두 번 있는지 본다. globals.css 의 --font-sans·--primary 가 두 번째 레시피 값인지 본다(secondWins). 성공하면(--keep 이 없을 때) <work> 를 지운다 — 실패하면 로그를 보도록 남긴다.
// 종료 0 = 두 add·빌드 모두 0이고 겹친 선언 0. 결과 JSON 을 표준 출력에 낸다. 네트워크(npm)가 필요하고 10분쯤 걸린다.
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { parseRecipe, buildRecipe, knownRegistryItems } from './recipe.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SHADCN = 'shadcn@4.21.0'
export const FIXTURE = join(ROOT, 'factory', 'scripts', 'fixtures', 'recipes', 'good-swap', 'DESIGN.md')
export const FIRST = 'r1-measure'
// 고정물 good-swap 의 표지 값 — r1-measure 와 다르다(본문 서체 Noto Sans KR, 라이트 primary)
export const SECOND = { fontSans: '--font-noto-sans-kr-wf', primary: 'oklch(0.3 0.08 150)' }

// 빌드된 항목 json 들을 한 폴더로 모으며 원격 의존 주소(#vX 가 있든 없든)를 로컬 경로로 바꾼다. { files, rewritten, remaining }
export function localRegistry(srcDirs, dest) {
  mkdirSync(dest, { recursive: true })
  let files = 0, rewritten = 0, remaining = 0
  for (const dir of srcDirs) for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const text = readFileSync(join(dir, f), 'utf8').replace(/nowwcastle-sudo\/sitebrew\/([a-z0-9-]+)(?:#v[0-9.]+)?/g, (_, name) => { rewritten++; return `../localreg/${name}.json` })
    remaining += (text.match(/nowwcastle-sudo\/sitebrew\//g) ?? []).length
    writeFileSync(join(dest, f), text)
    files++
  }
  return { files, rewritten, remaining }
}

// 최상위 const 선언 가운데 이름이 두 번 이상 나오는 것(「defined multiple times」 빌드 오류의 원인).
export function layoutDuplicates(text) {
  const count = new Map()
  for (const m of text.matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=/gm)) count.set(m[1], (count.get(m[1]) ?? 0) + 1)
  return [...count].filter(([, n]) => n > 1).map(([name]) => name)
}

// 소비자 globals.css 에서: @theme 의 --font-sans 가 처음 읽는 변수, :root 의 --primary 값.
export function secondWins(css) {
  const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''
  return {
    fontSans: css.match(/--font-sans:\s*var\((--[\w-]+)/)?.[1] ?? null,
    primary: root.match(/--primary:\s*([^;]+);/)?.[1].trim() ?? null,
  }
}

// 셸 명령 한 줄을 비동기로 돌려 출력은 로그 파일에 쓴다(Windows 의 npx.cmd 때문에 shell).
export const sh = (cmd, cwd, log) => new Promise((res) => {
  const out = createWriteStream(log)
  const p = spawn(cmd, { cwd, shell: true })
  p.stdout.pipe(out); p.stderr.pipe(out)
  p.on('close', (code) => out.end(() => res(code)))
})

export async function runSwap({ work = join(tmpdir(), `wf-swap-${process.pid}`), keep = false, log = console.error } = {}) {
  const q = (p) => `"${p}"`
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  const res = { work, steps: {} }
  const step = async (name, cmd, cwd) => {
    log(`recipe-swap: ${name} …`)
    const code = await sh(cmd, cwd, join(work, `${name}.log`))
    res.steps[name] = code
    if (code !== 0) log(`recipe-swap: ${name} 종료 ${code} — ${join(work, `${name}.log`)}`)
    return code
  }
  try {
    if (await step('build-repo', `npx -y ${SHADCN} build -o ${q(join(work, 'r0'))}`, ROOT)) return res
    const fx = join(work, 'fx')
    const { items } = await buildRecipe(parseRecipe(readFileSync(FIXTURE, 'utf8')), { outRoot: fx, knownItems: knownRegistryItems(), ref: `v${JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version}` })
    // 항목의 파일 경로(<id>/ui/…)는 그 항목을 적은 registry.json 기준이다 — 저장소의 r 층과 같은 자리에 둔다.
    const fxReg = join(fx, 'registry', 'factory', 'r')
    writeFileSync(join(fxReg, 'registry.json'), JSON.stringify({ $schema: 'https://ui.shadcn.com/schema/registry.json', name: 'web-factory', homepage: 'https://github.com/nowwcastle-sudo/sitebrew', items }, null, 2))
    res.second = JSON.parse(readFileSync(join(fxReg, 'registry.json'), 'utf8')).items.find((i) => i.type === 'registry:base')?.name
    if (await step('build-fixture', `npx -y ${SHADCN} build -o ${q(join(fx, 'r'))}`, fxReg)) return res
    res.localreg = localRegistry([join(work, 'r0'), join(fx, 'r')], join(work, 'localreg'))
    if (await step('init', `npx -y ${SHADCN} init -t next -b base -p nova -n consumer -y --no-monorepo`, work)) return res
    const consumer = join(work, 'consumer')
    if (await step('add-1', `npx -y ${SHADCN} add ../localreg/${FIRST}.json -y -o`, consumer)) return res
    if (await step('add-2', `npx -y ${SHADCN} add ../localreg/${res.second}.json -y -o`, consumer)) return res
    const layout = readFileSync(join(consumer, 'app', 'layout.tsx'), 'utf8')
    res.duplicates = layoutDuplicates(layout)
    res.fontDecls = [...layout.matchAll(/^const\s+(\w+)\s*=\s*(\w+)\(/gm)].map((m) => `${m[1]}=${m[2]}`)
    res.layoutVariables = [...layout.matchAll(/(\w+)\.variable/g)].map((m) => m[1])
    // 두 번째 레시피가 이겼는가(리뷰 M6): 역할 서체 변수와 색이 두 번째 레시피 값이다
    Object.assign(res, secondWins(readFileSync(join(consumer, 'app', 'globals.css'), 'utf8')))
    await step('build', 'npm run build', consumer)
    return res
  } finally {
    res.ok = ['build-repo', 'build-fixture', 'init', 'add-1', 'add-2', 'build'].every((k) => res.steps[k] === 0) && res.duplicates?.length === 0 && res.fontSans === SECOND.fontSans && res.primary === SECOND.primary
    // 실패하면 로그를 보도록 남긴다(성공했을 때만 지운다).
    if (!keep && res.ok && existsSync(work)) { rmSync(work, { recursive: true, force: true }); res.deleted = !existsSync(work) }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const wi = argv.indexOf('--work')
  if (wi !== -1 && (!argv[wi + 1] || argv[wi + 1].startsWith('--'))) { console.error('사용: recipe-swap.mjs [--work <폴더>] [--keep]'); process.exit(2) }
  const res = await runSwap({ ...(wi !== -1 ? { work: argv[wi + 1] } : {}), keep: argv.includes('--keep') })
  console.log(JSON.stringify(res, null, 2))
  process.exit(res.ok ? 0 : 1)
}
