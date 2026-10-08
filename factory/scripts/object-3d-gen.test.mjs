// FV1 3D-GEN — 3D 오브젝트 히어로(object-3d-orbit): 이미지에서 시작하는 3D · 다른 사용자용 대체 순서 · 재료 도구.
//   대체 순서(위가 좋은 쪽): 모델(GLB) → 원본 이미지만(2.5D) → 포스터만 → 03 이 이 히어로를 고르지 않음. 기본 도형만으로 채우는 길은 대체가 아니다.
//   이 파일은 찍어내기 쪽(03 readiness · 05-media 오브젝트 칸 · 06 wireMedia · Codex 래퍼 · doctor 문구 · 예시 GLB 예산 · 문서)을 본다.
//   블록 렌더 네 갈래는 hero-new.test.mjs, 실제 그림은 factory/qa/object-3d-orbit.browser.test.mjs(Chrome).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/object-3d-gen.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { mediaPlan, fetchMedia, REQUEST_FILE } from '../stamp/media.mjs'
import { wireMedia, modelSlotOf } from '../stamp/site-media.mjs'
import { applyObjectReadiness, objectMediaTools, objectRequests, threadIdOf, generatedImageOf, codexImage, OBJECT_HERO_BLOCK, GLB_BUDGET } from '../stamp/object-media.mjs'
import { runDoctor, formatResult } from '../doctor.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const sharp = createRequire(join(ROOT, 'package.json'))('sharp')
const cand = { id: 'a', slot: 'safe', source: 'library', recipe: 'r5-celadon' }

const arch = (source) => ({ id: 'landing', pages: [{ id: 'home', route: '/', sections: [{ kind: 'hero', imageSlots: [{ id: 'hero-visual', aspect: '4:3', source }] }] }] })
const MEDIA = { [OBJECT_HERO_BLOCK]: ['scene3d', 'image'] }
const mediaOf = (b) => MEDIA[b] ?? []
const V = { 'home/hero': OBJECT_HERO_BLOCK }
const plan = (source, media = {}) => mediaPlan(arch(source), { locale: 'ko', media }, cand, { variants: V, mediaOf })

async function folder() {
  const dir = await mkdtemp(join(tmpdir(), 'fv1-3dgen-'))
  const hf = join(dir, 'hf'), out = join(dir, 'out')
  await mkdir(hf, { recursive: true })
  await mkdir(out, { recursive: true })
  const img = join(hf, 'obj.png')
  await sharp({ create: { width: 1024, height: 768, channels: 3, background: { r: 40, g: 80, b: 170 } } }).png().toFile(img)
  await writeFile(join(hf, 'obj.glb'), Buffer.concat([Buffer.from('glTF'), Buffer.alloc(2000, 7)])) // 예산 안의 작은 GLB(내용은 읽지 않는다)
  await writeFile(join(hf, 'credits.json'), JSON.stringify([
    { file: 'obj.png', job: 'job-img', model: 'gpt_image_2_5', credits: 0.25, slot: 'home/hero/hero-visual', created: '2026-10-11' },
    { file: 'obj.glb', job: 'job-3d', model: 'image_to_3d', credits: 30, slot: 'home/hero/hero-visual', created: '2026-10-11' },
  ]))
  return { dir, hf, out }
}

// ── 03: 재료가 없는 사용자는 이 히어로를 못 채운다 ────────────────────────────────────────────────────
test('03 readiness: 재료(Higgsfield 폴더·Codex 이미지 생성)가 하나도 없으면 3D 히어로는 「못 채움(2)」이고 다른 블록은 그대로다', async () => {
  const none = await objectMediaTools({ env: {}, exists: () => false })
  assert.deepEqual(none, { higgsfield: false, codex: false, any: false })
  const base = new Map([[OBJECT_HERO_BLOCK, 0], ['block-hero-other', 0], ['block-hero-x', 1]])
  const out = applyObjectReadiness(base, none)
  assert.equal(out.get(OBJECT_HERO_BLOCK), 2)
  assert.equal(out.get('block-hero-other'), 0)
  assert.equal(out.get('block-hero-x'), 1)
  assert.equal(base.get(OBJECT_HERO_BLOCK), 0, '받은 표는 바꾸지 않는다')
  // 양성 대조: 폴더가 있으면 그대로
  const hf = await objectMediaTools({ env: { HIGGSFIELD_DIR: 'X:/hf' }, exists: () => true })
  assert.equal(hf.higgsfield, true)
  assert.equal(applyObjectReadiness(base, hf).get(OBJECT_HERO_BLOCK), 0)
})

test('03 readiness: Codex 는 WF_CODEX_IMAGES=1 이고 codex 가 실제로 돌 때만 재료다(스위치만으로, 설치만으로는 아니다)', async () => {
  const ok = async () => ({ code: 0, out: '' }), bad = async () => ({ code: -1, out: '' })
  assert.equal((await objectMediaTools({ env: { WF_CODEX_IMAGES: '1' }, exists: () => false, run: ok })).codex, true)
  assert.equal((await objectMediaTools({ env: {}, exists: () => false, run: ok })).codex, false, '스위치가 없으면 codex 가 있어도 쓰지 않는다')
  assert.equal((await objectMediaTools({ env: { WF_CODEX_IMAGES: '1' }, exists: () => false, run: bad })).codex, false, '스위치가 켜져도 codex 가 안 돌면 재료가 아니다')
})

// ── 05: 오브젝트 칸 계획 ───────────────────────────────────────────────────────────────────────────
test('05 plan: scene3d 를 선언한 블록의 첫 이미지 칸이 오브젝트 칸이다 — 스톡(Pexels)으로 채우지 않는다', () => {
  for (const source of ['generated-ok', 'stock-ok']) {
    const [row, ...rest] = plan(source)
    assert.equal(rest.length, 0)
    assert.equal(row.source, 'object3d', `${source} 칸도 제3자 사진에서 만든 3D 파생물을 피한다`)
    assert.equal(row.realRequired, false)
  }
  // 변형표 없음·scene3d 없는 블록은 예전 계획 그대로
  assert.equal(mediaPlan(arch('generated-ok'), { locale: 'ko' }, cand)[0].source, 'higgsfield')
  assert.equal(mediaPlan(arch('stock-ok'), { locale: 'ko' }, cand, { variants: { 'home/hero': 'block-hero-old' }, mediaOf })[0].source, 'pexels')
})

test('05 plan: 판매 대상(real-required)은 대표의 실제 사진이 있어야 한다 — 없으면 자리 표시, 있으면 그 사진에서', () => {
  assert.deepEqual(plan('real-required').map((r) => r.source), ['placeholder'])
  const row = plan('real-required', { 'home/hero/hero-visual': { file: 'photo.jpg', higgsfieldModel: 'm.glb' } })[0]
  assert.deepEqual([row.source, row.file, row.model, row.realRequired], ['object3d', 'photo.jpg', 'm.glb', true])
})

// ── 05: 받기 ───────────────────────────────────────────────────────────────────────────────────────
test('05 fetch: 이미지와 GLB 가 모두 있으면 모델 자산(kind model) — GLB 를 복사하고 출처 줄이 이미지·모델 둘, 요청 파일은 없다', async () => {
  const { hf, out } = await folder()
  const p = plan('generated-ok', { 'home/hero/hero-visual': { higgsfield: 'obj.png', higgsfieldModel: 'obj.glb' } })
  const r = await fetchMedia(p, out, { higgsfieldDir: hf, now: () => '2026-10-11T00:00:00.000Z' })
  assert.equal(r.manifest.assets.length, 1)
  const a = r.manifest.assets[0]
  assert.equal(a.kind, 'model')
  assert.equal(a.source, 'higgsfield')
  assert.equal(a.model.glb, 'r5-celadon/home.hero.hero-visual.glb')
  assert.ok(existsSync(join(out, a.model.glb)) && statSync(join(out, a.model.glb)).size === a.model.bytes)
  assert.ok(a.files.some((f) => f.role === 'glb' && f.bytes <= GLB_BUDGET))
  assert.deepEqual(r.credits.map((c) => c.file.endsWith('.glb')), [false, true])
  assert.deepEqual(r.credits.map((c) => c.url), ['higgsfield:job/job-img', 'higgsfield:job/job-3d'])
  assert.equal(r.requests.length, 0)
  assert.equal(r.manifest.placeholders.length, 0)
  assert.equal(existsSync(join(out, REQUEST_FILE)), false)
})

test('05 fetch: 큰 GLB 는 줄이는 도구를 거친다 · 줄여도 예산을 넘으면 던진다', async () => {
  const { hf, out } = await folder()
  await writeFile(join(hf, 'obj.glb'), Buffer.concat([Buffer.from('glTF'), Buffer.alloc(GLB_BUDGET + 10, 7)]))
  const p = plan('generated-ok', { 'home/hero/hero-visual': { higgsfield: 'obj.png', higgsfieldModel: 'obj.glb' } })
  let called = 0
  const ok = async (a, b) => { called++; await writeFile(b, Buffer.alloc(900_000, 1)) }
  const r = await fetchMedia(p, out, { higgsfieldDir: hf, optimizeGlb: ok })
  assert.equal(called, 1)
  assert.equal(r.manifest.assets[0].model.bytes, 900_000)
  const { out: out2 } = await folder()
  const huge = async (a, b) => { await writeFile(b, Buffer.alloc(GLB_BUDGET + 5, 1)) }
  await assert.rejects(() => fetchMedia(p, out2, { higgsfieldDir: hf, optimizeGlb: huge }), /예산 초과/)
})

test('05 fetch: 이미지만 있으면 2.5D 자산(kind image) + generate_3d 요청 한 줄 · 자리 표시 없음', async () => {
  const { hf, out } = await folder()
  const p = plan('generated-ok', { 'home/hero/hero-visual': { higgsfield: 'obj.png' } })
  const r = await fetchMedia(p, out, { higgsfieldDir: hf })
  assert.equal(r.manifest.assets[0].kind, 'image')
  assert.equal(r.manifest.placeholders.length, 0, '이미지가 있으니 2.5D 로 그려진다')
  assert.deepEqual(r.requests.map((x) => [x.step, x.tool]), [['generate_3d', 'generate_3d']])
  assert.equal(r.requests[0].from, 'obj.png')
  const file = JSON.parse(readFileSync(join(out, REQUEST_FILE), 'utf8'))
  assert.match(file.how, /generate_3d/)
  assert.match(file.how, /WF_CODEX_IMAGES=1/)
})

test('05 fetch: 아무것도 없으면 「이미지 생성 → generate_3d」 두 줄 요청 + 「이미지 준비 중」 틀 — 기본 도형으로 채우지 않는다', async () => {
  const { hf, out } = await folder()
  const r = await fetchMedia(plan('generated-ok'), out, { higgsfieldDir: hf, codexImages: false })
  assert.deepEqual(r.manifest.assets, [])
  assert.deepEqual(r.requests.map((x) => x.step), ['image', 'generate_3d'])
  assert.ok(r.requests[0].prompt.length > 20)
  assert.deepEqual(r.manifest.placeholders.map((x) => x.reason), ['generate-pending'])
  // 폴더 자체가 없는 사용자(키 없음)도 같다
  const r2 = await fetchMedia(plan('generated-ok'), (await folder()).out, { higgsfieldDir: null, codexImages: false })
  assert.deepEqual(r2.requests.map((x) => x.step), ['image', 'generate_3d'])
})

test('05 fetch: Codex 이미지 생성은 켠 사용자(codexImages)에게만, 실사 필수 칸에는 쓰지 않는다 · 출처 줄에 약관 확인 필요', async () => {
  const { hf, out } = await folder()
  const made = []
  const codexImage = async ({ prompt, workDir }) => { made.push({ prompt, workDir }); return { file: join(hf, 'obj.png'), threadId: 't1' } }
  const on = await fetchMedia(plan('generated-ok'), out, { higgsfieldDir: null, codexImages: true, codexImage })
  assert.equal(made.length, 1)
  assert.equal(on.manifest.assets[0].source, 'codex')
  assert.equal(on.credits[0].source, 'codex')
  assert.match(on.credits[0].license, /약관 확인 필요/)
  assert.deepEqual(on.requests.map((x) => x.step), ['generate_3d'], '이미지는 생겼고 모델은 요청으로 남는다 — 그 칸은 2.5D')
  const off = await fetchMedia(plan('generated-ok'), (await folder()).out, { higgsfieldDir: null, codexImages: false, codexImage })
  assert.equal(made.length, 1, '스위치가 없으면 부르지 않는다')
  assert.deepEqual(off.requests.map((x) => x.step), ['image', 'generate_3d'])
  // real-required 칸: 계획 단계에서 자리 표시라 Codex 가 불릴 길이 없다
  const real = await fetchMedia(plan('real-required'), (await folder()).out, { higgsfieldDir: null, codexImages: true, codexImage })
  assert.equal(made.length, 1)
  assert.deepEqual(real.manifest.placeholders.map((x) => x.reason), ['real-required'])
})

test('요청 줄 모양: 이미지가 있으면 generate_3d 한 줄, 없으면 이미지 → generate_3d 두 줄', () => {
  assert.deepEqual(objectRequests({ slot: 's', recipe: 'r', aspect: '4:3', prompt: 'p', haveImage: false }).map((x) => x.step), ['image', 'generate_3d'])
  assert.deepEqual(objectRequests({ slot: 's', recipe: 'r', aspect: '4:3', prompt: 'p', haveImage: true, imageFile: 'a.png' }).map((x) => [x.step, x.from]), [['generate_3d', 'a.png']])
})

// ── 06: 잇기 ───────────────────────────────────────────────────────────────────────────────────────
const modelAsset = { recipe: 'r5-celadon', slot: 'home/hero/hero-visual', kind: 'model', source: 'higgsfield', width: 960, height: 720, widths: [960, 480], model: { glb: 'r5-celadon/h.glb', bytes: 800_000 }, files: [{ file: 'r5-celadon/h-960.webp', w: 960, role: 'still-max' }, { file: 'r5-celadon/h-480.webp', w: 480 }, { file: 'r5-celadon/h.glb', role: 'glb' }] }
const wire = (asset, flags) => {
  const props = { copy: {} }
  const got = wireMedia({ props, sectionKey: 'home/hero', imageSlots: [{ id: 'hero-visual' }], assets: [asset], recipeId: 'r5-celadon', ...flags })
  return { props, got }
}

test('06 wireMedia: 모델 자산은 model(ModelSlot)로, 이미지만 있는 자산은 media(2.5D)로 잇는다 · model 칸이 없는 블록은 원본 이미지를 media 로', () => {
  const m = wire(modelAsset, { hasMediaProp: true, hasModelProp: true })
  assert.equal(m.props.model.src, '/media/r5-celadon/h.glb')
  assert.equal(m.props.model.source, 'generated-ok')
  assert.equal(m.props.model.poster.kind, 'image')
  assert.match(m.props.model.poster.src, /h-960\.webp$/)
  assert.equal('media' in m.props, false)
  const imgOnly = wire({ ...modelAsset, kind: 'image', model: undefined, files: modelAsset.files.slice(0, 2) }, { hasMediaProp: true, hasModelProp: true })
  assert.equal('model' in imgOnly.props, false)
  assert.match(imgOnly.props.media.src, /h-960\.webp$/)
  const noModelProp = wire(modelAsset, { hasMediaProp: true, hasModelProp: false })
  assert.match(noModelProp.props.media.src, /h-960\.webp$/)
  assert.equal(modelSlotOf({ ...modelAsset, source: 'brand' }).source, 'real-required', '대표 사진에서 만든 모델')
  assert.equal(wire(modelAsset, { hasMediaProp: false, hasModelProp: false }).got, null)
})

test('06 wireMedia: 미리보기 전용 자산은 보드 모드가 아니면 model 로도 잇지 않는다', () => {
  const pv = { ...modelAsset, previewOnly: true }
  assert.equal('model' in wire(pv, { hasMediaProp: true, hasModelProp: true }).props, false)
})

// ── Codex 래퍼 ─────────────────────────────────────────────────────────────────────────────────────
test('Codex 래퍼: thread_id 를 JSONL 첫 줄에서 읽고, generated_images/<thread>/ 의 가장 새 이미지를 돌려준다', async () => {
  assert.equal(threadIdOf('noise\n{"type":"thread.started","thread_id":"abc-1"}\n{"type":"turn.started"}'), 'abc-1')
  assert.equal(threadIdOf('not json\n{"type":"turn.started"}'), null)
  const home = await mkdtemp(join(tmpdir(), 'fv1-3dgen-cx-'))
  await mkdir(join(home, 'generated_images', 'abc-1'), { recursive: true })
  assert.equal(generatedImageOf('abc-1', { codexHome: home }), null)
  await writeFile(join(home, 'generated_images', 'abc-1', 'exec-1.png'), 'x')
  assert.match(generatedImageOf('abc-1', { codexHome: home }), /exec-1\.png$/)
})

test('Codex 래퍼: 실측한 비대화형 호출 모양 — 설정 무시·임시 세션·읽기 전용 샌드박스, 프롬프트는 인자가 아니라 표준 입력', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fv1-3dgen-cx-'))
  await mkdir(join(home, 'generated_images', 't9'), { recursive: true })
  await writeFile(join(home, 'generated_images', 't9', 'exec-9.png'), 'x')
  let seen
  const run = async (cmd, args, opts) => { seen = { cmd, args, opts }; return { code: 0, out: '{"type":"thread.started","thread_id":"t9"}\n' } }
  const r = await codexImage({ prompt: 'a "quoted" brief with spaces', workDir: join(home, 'w'), run, codexHome: home })
  assert.match(r.file, /exec-9\.png$/)
  assert.equal(seen.cmd, 'codex')
  for (const flag of ['exec', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--json']) assert.ok(seen.args.includes(flag), flag)
  assert.equal(seen.args[seen.args.indexOf('--sandbox') + 1], 'read-only')
  assert.equal(seen.args.at(-1), '-', '프롬프트는 표준 입력')
  assert.ok(!seen.args.some((a) => a.includes('quoted')), '프롬프트가 인자에 없다(Windows 셸 따옴표)')
  assert.match(seen.opts.input, /a "quoted" brief with spaces/)
  await assert.rejects(() => codexImage({ prompt: 'x', workDir: join(home, 'w2'), run: async () => ({ code: 1, out: '' }), codexHome: home }), /thread_id/)
  await assert.rejects(() => codexImage({ prompt: 'x', workDir: join(home, 'w3'), run: async () => ({ code: 0, out: '{"type":"thread.started","thread_id":"empty"}' }), codexHome: home }), /이미지를 만들지 않았다/)
  await assert.rejects(() => codexImage({ prompt: 'x', workDir: join(home, 'w4'), run: async () => ({ code: -2, out: '' }), codexHome: home, timeoutMs: 1000 }), /1초 안에/)
})

// ── doctor ─────────────────────────────────────────────────────────────────────────────────────────
test('doctor: 재료가 없으면 ko·en 한 줄씩 알리고 통과(note) — 엄격 모드에서도 이 항목은 실패가 아니다', async () => {
  const deps = { env: {}, readSecret: () => null, isDir: () => false, exec: async () => ({ code: -1 }), fetch: async () => { throw new Error('no net') } }
  for (const strict of [false, true]) {
    const { results } = await runDoctor('stamp', { ...deps, strict })
    const r = results.find((x) => x.id === '3D_OBJECT_HERO')
    assert.ok(r, '3D_OBJECT_HERO 점검이 stamp 단계에 있다')
    assert.equal(r.ok, true)
    assert.equal(r.note, true)
    const lines = formatResult(r)
    assert.equal(lines.length, 2)
    assert.match(lines[0], /모델 대신 2\.5D\/포스터, 이미지도 없으면 이 히어로를 고르지 않는다/)
    assert.match(lines[1], /2\.5D\/poster instead of a model; with no image at all this hero is not chosen/)
  }
})

test('doctor: Higgsfield 폴더가 있거나 Codex 이미지 생성이 켜져 돌면 note 가 없다', async () => {
  const base = { readSecret: () => null, fetch: async () => { throw new Error('no net') }, strict: false }
  const hf = await runDoctor('media', { ...base, env: { HIGGSFIELD_DIR: 'X:/hf' }, isDir: () => true, exec: async () => ({ code: -1 }) })
  assert.equal(hf.results.find((x) => x.id === '3D_OBJECT_HERO').note, undefined)
  const cx = await runDoctor('media', { ...base, env: { WF_CODEX_IMAGES: '1' }, isDir: () => false, exec: async () => ({ code: 0 }) })
  const r = cx.results.find((x) => x.id === '3D_OBJECT_HERO')
  assert.equal(r.note, undefined)
  assert.match(r.message, /Codex CLI/)
  const cxBad = await runDoctor('media', { ...base, env: { WF_CODEX_IMAGES: '1' }, isDir: () => false, exec: async () => ({ code: -1 }) })
  assert.equal(cxBad.results.find((x) => x.id === '3D_OBJECT_HERO').note, true, '스위치만 켜고 codex 가 안 돌면 알린다')
})

// ── 예시 자산 · 문서 ───────────────────────────────────────────────────────────────────────────────
test('음성 대조: 블록과 예시에 라이브러리 기본 도형 장면 코드·문구가 없다', () => {
  const src = read('registry/factory/blocks/hero/object-3d-orbit.tsx') + read('registry/factory/blocks/hero/object-3d-orbit.fixture.ts')
  assert.doesNotMatch(src, /TorusKnotGeometry|IcosahedronGeometry|TorusGeometry|OctahedronGeometry|BoxGeometry|SphereGeometry|flatShading|copy\.objects|objects\?:/)
  assert.doesNotMatch(src, /유리/, '예시 문구가 유리 소품이 아니라 도자 오브제에 맞는다')
  assert.match(src, /GLTFLoader/)
  assert.match(src, /RoomEnvironment/)
  assert.match(src, /ACESFilmicToneMapping/)
  assert.match(src, /ShadowMaterial/)
  // 양성 대조: 이 검사가 도형 코드를 실제로 잡는다
  assert.match('new THREE.TorusKnotGeometry(0.9, 0.3, 160, 24)', /TorusKnotGeometry/)
})

test('문서: 공개 규칙·약관 확인 항목·갈래 안내가 같은 사실을 말한다', () => {
  const rules = read('docs/rules/factory-rules.md')
  assert.match(rules, /3D 오브젝트는 이미지에서 시작/)
  assert.match(rules, /모델 없음 → 원본 이미지 \+ 깊이 시차\(2\.5D\) → 포스터만 → 이 히어로를 고르지 않음/)
  // (public export: docs/qa/factory-v1/asset-licenses.md, the maintainers' licence review, is not shipped, so its three assertions are left out)
  const claude = read('docs/agents/agent-guide.md')
  assert.match(claude, /이미지에서 시작한다/)
  for (const f of ['README.md', 'README.ko.md']) assert.match(read(f), /3D/, `${f} 에 3D 오브젝트 히어로 안내`)
})
