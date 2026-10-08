// 전달(factory v1 Task 4.5 · 합의안 D15) — 고른 안의 site/ 를 사용자 폴더로 복사하고, 실행 안내 README(ko·en)를 더하고, (켰고 토큰이 있으면) Vercel 미리보기를 배포한다.
//
//   deliver(runDir, cand, { to, deployPreview?, deployOptions?, deploy?, readSecret? }) → { dir, runCmd, copied, readme, blockers, previewUrl? | previewSkipped? | previewError? }
//   · 복사: node_modules·.next·.next-export·.vercel·.turbo·.env*·*.tsbuildinfo 는 뺀다(설치·빌드 산출물과 비밀이 될 수 있는 것). 나머지는 상대 경로 그대로. fs.cpSync 만 쓴다 — 셸을 거치지 않아
//     사용자 폴더 경로에 공백·한글이 있어도(`C:\Users\홍 길동\내 사이트`) 깨지지 않는다(Review Focus 3). 원본(실행 폴더의 site/)은 건드리지 않는다.
//   · 대상 폴더: 없거나 비어 있어야 한다 — 사용자의 파일을 덮지 않는다. 원본 사이트·실행 폴더 안으로는 복사하지 않는다.
//   · AGENTS.md: 이 폴더를 고치는 AI 도구와 사람용 — 사실 출처(content/site.json 한 곳)·고치는 규칙·하지 말 것(ko → en, deliver-guide.mjs). 원본 사이트에는 쓰지 않고 전달 때만 더한다.
//   · README.md: 한국어 → English 한 파일. 실행 방법, 폴더 안내, 공개하기 전에 해결할 것(candidate.json 의 공개 불가 사유 — 숨기지 않는다), saas·pwa(완성 방식 product)는 launch-factory 연결 안내,
//     끝에 「공개한 뒤에 할 일」 8절(검색 등록·트래픽 급락·지역 등록·AI 봇·도메인 이전·네이버 AI 브리핑·고치는 법·운영 비용 — 절마다 1차 출처 주소와 확인 날짜, deliver-guide.mjs).
//   · 미리보기 배포: deployPreview 가 켜져 있고 VERCEL_TOKEN 이 있을 때만. 토큰이 없으면 건너뛰고 이유를 previewSkipped 에 남긴다. 인자는 deploy-preview.mjs 의 assertPreviewOnly 가
//     복사하기 전에 검사한다(프로덕션 불가). 배포는 설치가 끝난 원본 사이트에서 한다(복사본에는 node_modules 가 없다). 실패해도 전달은 끝나고 previewError(토큰 가림)에 남는다.
//   명령줄: node factory/stamp/deliver.mjs --run <실행 폴더> --pick a|b|c --to <사용자 폴더> [--deploy-preview]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadArchetypes } from '../scripts/archetypes.mjs'
import { maskSecrets, readSecret as realReadSecret } from '../lib/secret-env.mjs'
import { assertPreviewOnly, deployPreview as realDeploy, previewCommands } from './deploy-preview.mjs'
import { afterPublishEn, afterPublishKo, OBJECT_HERO_NOTE, renderAgents } from './deliver-guide.mjs'
import { isNeedsCheck } from './needs-check.mjs'

const SKIP_DIRS = new Set(['node_modules', '.next', '.next-export', '.vercel', '.turbo'])
const SKIP_FILE = /^\.env(?:\.|$)|\.tsbuildinfo$/
const MAX_LISTED = 20
const NODE_MIN = '20.9'

const isInside = (child, parent) => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

/** 사이트 이름: 콘텐츠의 이름 칸(자리 표시 「확인 필요」는 건너뛴다). 없으면 대상 폴더 이름. */
function siteName(site, fallback) {
  for (const v of [site?.business?.name, site?.product?.name, site?.organization?.name, site?.agency?.name, site?.site?.name]) {
    if (typeof v === 'string' && v.trim() && !isNeedsCheck(v)) return v.trim()
  }
  return fallback
}

/**
 * README.md 본문. 순수 함수 — info: { name, dir, runCmd, archetype, completion, blockers[], previewUrl?, previewSkipped?, previewError? }
 * 영어 쪽에는 한글을 싣지 않는다(공개 불가 사유는 생성기가 쓴 한국어 문장이라 한국어 쪽에만 나열한다).
 */
export function renderReadme(info) {
  const { name, dir, runCmd, completion, blockers = [], previewUrl, previewSkipped, objectHero = false } = info
  const n = blockers.length
  const listed = blockers.slice(0, MAX_LISTED).map((b) => `- ${String(b).replace(/^공개 불가 — /, '')}`)
  if (n > MAX_LISTED) listed.push(`- … 외 ${n - MAX_LISTED}건`)
  const steps = ['```', `cd "${dir}"`, 'npm install', 'npm run dev', '```'].join('\n')
  const product = completion === 'product'
  const ko = [
    '## 한국어',
    '',
    `이 폴더는 Next.js 사이트예요. 고른 디자인 그대로 내 컴퓨터에서 바로 열어 볼 수 있어요.`,
    '',
    '### 실행하기',
    '',
    `1. Node.js ${NODE_MIN} 이상을 설치해요(이 공장은 Node.js 24로 확인했어요).`,
    '2. 이 폴더에서 터미널을 열고 아래를 차례로 실행해요.',
    '',
    steps,
    '',
    `   한 줄로는 \`${runCmd}\` 예요.`,
    '3. 브라우저에서 http://localhost:3000 을 열어요.',
    '4. 올릴 때는 `npm run build` 다음에 `npm start` 로 먼저 확인해요.',
    '',
    '### 폴더 안내',
    '',
    '- `content/site.json` — 문구·사실·구획 설정이 모인 원천이에요. 글을 고칠 때는 여기를 고쳐요.',
    '- `app/` — 쪽(페이지)이에요. `components/site/` 는 구획마다 하나씩 있는 조각이에요.',
    '- `lib/` — 연락·예약·분석 같은 어댑터 자리예요.',
    '',
    ...(objectHero ? ['### 3D 오브젝트 첫 화면', '', OBJECT_HERO_NOTE.ko, ''] : []),
    '### 공개하기 전에',
    '',
    n
      ? [`공개하기 전에 해결할 것이 ${n}건 있어요. 지금은 미리보기로만 쓰세요.`, '', ...listed].join('\n')
      : '기록된 공개 불가 사유가 없어요. 그래도 법정 쪽(약관·개인정보 처리방침)은 사람이 마지막으로 읽고 확인해 주세요.',
    ...(product ? [
      '',
      '### launch-factory 연결',
      '',
      '이 사이트는 서비스의 앞면이에요. 로그인·결제·알림은 아직 가짜 어댑터(목)로 움직여요.',
      'launch-factory 에 연결하려면 `lib/ports.ts` 와 `lib/analytics.ts` 의 어댑터를 launch-factory 의 어댑터로 바꿔요. 자세한 순서는 launch-factory 안내를 따라요.',
    ] : []),
    ...(previewUrl ? ['', '### 미리보기 주소', '', `${previewUrl} (프로덕션이 아니라 미리보기 배포예요.)`] : []),
    ...(previewSkipped ? ['', `미리보기 배포는 건너뛰었어요 — ${previewSkipped}`] : []),
    '',
    ...afterPublishKo(),
  ]
  const en = [
    '## English',
    '',
    'This folder is a Next.js site. You can open the design you picked on your own computer.',
    '',
    '### Run it',
    '',
    `1. Install Node.js ${NODE_MIN} or newer (the factory is verified on Node.js 24).`,
    '2. Open a terminal in this folder and run these in order:',
    '',
    steps,
    '',
    `   In one line: \`${runCmd}\`.`,
    '3. Open http://localhost:3000 in your browser.',
    '4. Before you upload it, check with `npm run build` and then `npm start`.',
    '',
    '### What is where',
    '',
    '- `content/site.json` — the source of the copy, facts and section settings. Edit text here.',
    '- `app/` — the pages. `components/site/` holds one piece per section.',
    '- `lib/` — adapter slots for contact, booking and analytics.',
    '',
    ...(objectHero ? ['### 3D object hero', '', OBJECT_HERO_NOTE.en, ''] : []),
    '### Before you publish',
    '',
    n
      ? `${n} item${n === 1 ? '' : 's'} need attention before you publish. Use this as a preview only for now. The list is in the Korean section above.`
      : 'No blocking reasons are recorded. Still, have a person read the legal pages (terms, privacy policy) one last time.',
    ...(product ? [
      '',
      '### Connect to launch-factory',
      '',
      'This site is the front of a service. Sign-in, billing and notifications still run on mock adapters.',
      'To connect it to launch-factory, replace the adapters in `lib/ports.ts` and `lib/analytics.ts` with the launch-factory adapters. Follow the launch-factory guide for the steps.',
    ] : []),
    ...(previewUrl ? ['', '### Preview URL', '', `${previewUrl} (a preview deployment, not production.)`] : []),
    ...(previewSkipped ? ['', 'The preview deployment was skipped (no VERCEL_TOKEN).'] : []),
    '',
    ...afterPublishEn(),
  ]
  return [`# ${name}`, '', '한국어 설명이 먼저, 그다음에 English 가 이어져요. / Korean first, then English.', '', ...ko, '', ...en, ''].join('\n')
}

function listFiles(root) {
  return readdirSync(root, { recursive: true }).map(String).filter((p) => statSync(join(root, p)).isFile())
}

/**
 * @param {string} runDir  찍어내기 실행 폴더
 * @param {string|{ id: string }} cand  고른 안(a·b·c)
 * @param {{ to: string, deployPreview?: boolean, deployOptions?: { project?: string, extraArgs?: string[] }, deploy?: Function, readSecret?: Function }} opts
 */
export async function deliver(runDir, cand, opts = {}) {
  const { to, deployPreview = false, deployOptions = {}, deploy = realDeploy, readSecret = realReadSecret } = opts
  if (typeof to !== 'string' || !to.trim()) throw new Error('deliver: to(대상 폴더)가 필요하다')
  const candId = typeof cand === 'string' ? cand : cand?.id
  const candDir = join(resolve(runDir), String(candId))
  const srcSite = join(candDir, 'site')
  if (!existsSync(join(srcSite, 'package.json')) || !existsSync(join(srcSite, 'content', 'site.json'))) {
    throw new Error(`사이트(06-pages)가 없다: ${srcSite} — 먼저 \`npm run stamp -- --run ${runDir} --pick ${candId} --until 06\` 으로 06 까지 돌린다`)
  }
  const dest = resolve(to)
  if (isInside(dest, srcSite) || isInside(dest, resolve(runDir))) throw new Error(`대상 폴더가 원본 사이트 폴더 안(또는 실행 폴더 안)이다: ${dest} — 다른 곳을 고른다`)
  if (existsSync(dest)) {
    if (!statSync(dest).isDirectory()) throw new Error(`대상이 폴더가 아니라 파일이다: ${dest}`)
    if (readdirSync(dest).length) throw new Error(`대상 폴더가 비어 있지 않다: ${dest} — 사용자의 파일을 덮어쓰지 않는다. 빈 폴더나 새 폴더를 고른다`)
  }

  // 미리보기 배포 인자는 아무것도 쓰기 전에 검사한다(토큰이 없어도) — 프로덕션으로 갈 수 있는 인자는 여기서 던진다
  if (deployPreview) for (const [, ...args] of previewCommands(deployOptions)) assertPreviewOnly(args)
  const token = deployPreview ? readSecret('VERCEL_TOKEN') : null

  mkdirSync(dest, { recursive: true })
  cpSync(srcSite, dest, { recursive: true, filter: (src) => src === srcSite || !(SKIP_DIRS.has(basename(src)) || SKIP_FILE.test(basename(src))) })
  const copied = listFiles(dest).length

  const out = { dir: dest, runCmd: `cd "${dest}" && npm install && npm run dev`, copied }
  if (deployPreview) {
    if (!token) out.previewSkipped = 'VERCEL_TOKEN 이 없다 — 토큰을 사용자 환경 변수로 넣으면 미리보기를 배포한다'
    else {
      try {
        const r = await deploy(srcSite, deployOptions)
        out.previewUrl = r.url
      } catch (e) {
        out.previewError = maskSecrets(String(e?.message ?? e), [token]).split(/\r?\n/).slice(0, 4).join(' | ')
      }
    }
  }

  const site = readJson(join(dest, 'content', 'site.json'))
  const archetype = (await loadArchetypes())[site.archetype]
  const cj = join(candDir, 'candidate.json')
  const blockers = existsSync(cj) ? readJson(cj).blockers ?? [] : []
  const readme = join(dest, 'README.md')
  const name = siteName(site, basename(dest))
  writeFileSync(join(dest, 'AGENTS.md'), renderAgents({ name }))
  const objectHero = Object.values(site.sections ?? {}).some((x) => x?.block === 'block-hero-object-3d-orbit')
  writeFileSync(readme, renderReadme({ name, dir: dest, runCmd: out.runCmd, archetype: site.archetype, objectHero, completion: archetype?.completion ?? 'site', blockers, previewUrl: out.previewUrl, previewSkipped: out.previewSkipped }))
  return { ...out, readme, blockers: blockers.length }
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

const USAGE = '사용법: node factory/stamp/deliver.mjs --run <실행 폴더> --pick a|b|c --to <사용자 폴더> [--deploy-preview]'
export function parseDeliverArgs(argv) {
  const o = { run: null, pick: null, to: null, deployPreview: false }
  const take = (i, flag) => {
    const v = argv[i + 1]
    if (v === undefined || v.startsWith('--')) throw new Error(`${flag} 값이 없다\n${USAGE}`)
    return v
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--run') o.run = take(i++, a)
    else if (a === '--pick') o.pick = take(i++, a)
    else if (a === '--to') o.to = take(i++, a)
    else if (a === '--deploy-preview') o.deployPreview = true
    else throw new Error(`모르는 인자: ${a}\n${USAGE}`)
  }
  if (!o.run || !o.pick || !o.to) throw new Error(`--run · --pick · --to 가 모두 필요하다\n${USAGE}`)
  if (!['a', 'b', 'c'].includes(o.pick)) throw new Error(`--pick 은 a|b|c 중 하나다: ${JSON.stringify(o.pick)}\n${USAGE}`)
  return o
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let opts
  try { opts = parseDeliverArgs(process.argv.slice(2)) } catch (e) { console.error(e.message); process.exitCode = 2 }
  if (opts) {
    try {
      const r = await deliver(resolve(opts.run), opts.pick, { to: opts.to, deployPreview: opts.deployPreview })
      console.log(`전달 끝: ${r.dir} (파일 ${r.copied}개 + README.md)`)
      console.log(`실행: ${r.runCmd}`)
      if (r.blockers) console.log(`공개하기 전에 해결할 것 ${r.blockers}건 — README.md 에 적었다`)
      if (r.previewUrl) console.log(`미리보기: ${r.previewUrl}`)
      if (r.previewSkipped) console.log(`미리보기 배포 건너뜀: ${r.previewSkipped}`)
      if (r.previewError) { console.log(`도구 실패: 미리보기 배포 — ${r.previewError}`); process.exitCode = 1 }
    } catch (e) {
      console.error(`도구 실패: ${e.message}`)
      process.exitCode = 1
    }
  }
}
