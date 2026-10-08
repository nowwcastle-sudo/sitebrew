// gen-ai: ai/ 생성물 9+1개의 모양(zod 4), 원천 ↔ docs/agents/agent-guide.md §5 ↔ ai/gotchas.json 한 몸(factory-rules.md §20-1), 레시피 후보를 지어내지 않는 것.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARCHETYPES } from './recipe.mjs'
import { ARCHETYPE_PATH } from './archetypes.mjs'
import { buildAll, claudeBlock, applyRegion, loadGotchas, loadRecipes, taskFile, recipeNote, decisionDate, DECISIONS_FILE, BEGIN, END, AI_DIR, CLAUDE_MD } from './gen-ai.mjs'
import { TaskFile, GotchasFile, GotchasSource } from '../ai/schemas.mjs'
import * as blocksLib from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const pkg = readJson(join(root, 'package.json'))
const ref = `v${pkg.version}`

test('ai/tasks: 원형마다 하나씩 10개, 모두 TaskFile 스키마, ref 는 package.json 버전', () => {
  const files = readdirSync(join(AI_DIR, 'tasks')).sort()
  assert.equal(ARCHETYPES.length, 10)
  assert.deepEqual(files, ARCHETYPES.map((a) => `${a}.json`))
  for (const f of files) {
    const t = TaskFile.parse(readJson(join(AI_DIR, 'tasks', f)))
    assert.equal(t.ref, ref, f)
    const src = readJson(join(ARCHETYPE_PATH, f))
    assert.equal(t.coreTask, src.coreTask, f)
    // 필수 섹션 = 원형 JSON 의 required:true 섹션 그대로(페이지별)
    for (const p of src.pages) {
      const got = t.pages.find((x) => x.id === p.id)
      assert.deepEqual(got.required.map((s) => s.kind), p.sections.filter((s) => s.required === true).map((s) => s.kind), `${f} ${p.id}`)
    }
    assert.ok(t.pages.some((p) => p.required.length > 0), `${f}: 필수 섹션 0`)
  }
})

test('ai/gotchas.json: 스키마, 원천과 같은 목록', () => {
  const file = GotchasFile.parse(readJson(join(AI_DIR, 'gotchas.json')))
  assert.deepEqual(file.gotchas, loadGotchas())
})

test('커밋된 ai/ 는 지금 원천으로 다시 만든 것과 같다(check:regen 과 같은 뜻, 여기서 먼저 잡는다)', () => {
  const { gotchas, tasks } = buildAll(ref)
  assert.deepEqual(readJson(join(AI_DIR, 'gotchas.json')), gotchas)
  for (const t of tasks) assert.deepEqual(readJson(join(AI_DIR, 'tasks', `${t.id}.json`)), t, t.id)
})

test('docs/agents/agent-guide.md §5 생성 구역 = 원천의 rule 한 줄씩(드리프트 0), §5 안에 있다', () => {
  const md = readFileSync(CLAUDE_MD, 'utf8').replace(/\r\n/g, '\n')
  const b = md.indexOf(BEGIN), e = md.indexOf(END)
  assert.ok(b > md.indexOf('## 5.') && e < md.indexOf('## 6.'), '생성 구역이 §5 밖에 있다')
  assert.equal(md.slice(b, e + END.length), claudeBlock(loadGotchas()))
})

test('이월 gotcha(장부 판정)가 원천에 모두 있다', () => {
  const ids = loadGotchas().map((g) => g.id)
  for (const id of ['blocks-data-numeric', 'touch-exception-consumer-trigger', 'touch-exception-resizable-handle', 'recipe-switch-font-loader',
    'mock-port-not-serializable', 'kakao-channel-no-prefill', 'shadcn-strips-head-comments', 'font-var-wf',
    // 13b 리뷰 I1·I2
    'init-geist-loader', 'recipe-part-overwrite',
    // 계획 1 의 §5 여섯 줄
    'dialog-cancel-initial-focus', 'toast-dom-removal', 'hit-area-pseudo', 'focus-ring-opaque', 'factory-base-dependency', 'install-pinned-tag',
    // P3-2 Task 9: 블록 설치 순서·제목 단계
    'blocks-need-recipe-base', 'block-heading-levels']) {
    assert.ok(ids.includes(id), id)
  }
  assert.match(loadGotchas().find((g) => g.id === 'font-var-wf').rule, /p2-migration\.md/)
})

test('레시피 후보는 레시피 DESIGN.md 의 archetypes 에서만 온다 — 운영자 승인 뒤 완전(RECIPES_COMPLETE), 원형마다 1벌 이상', () => {
  const recipes = loadRecipes()
  const tasks = ARCHETYPES.map((a) => readJson(join(AI_DIR, 'tasks', `${a}.json`)))
  for (const t of tasks) {
    const expected = recipes.filter((r) => r.archetypes.includes(t.id)).map((r) => r.id)
    assert.deepEqual(t.recipes.candidates.map((c) => c.id), expected, t.id)
    assert.ok(expected.length >= 1, `${t.id}: 승인 레시피가 없다`)
    assert.equal(t.recipes.complete, true)
    // 결정 날짜는 박지 않고 결정 파일에서 읽는다(Task 9 fix 1 — 리뷰 M9).
    assert.ok(t.recipes.note.includes(`운영자가 레시피 보드(${decisionDate()})에서 승인한`), t.id)
    assert.ok(t.recipes.note.includes('factory/board/recipe-decisions.json'), t.id)
    // M9(Task 5 리뷰): 낡은 안내문이 나가지 않는다.
    assert.doesNotMatch(t.recipes.note, /P3′|7벌|레시피 보드\(Task 8\)/, t.id)
    for (const c of t.recipes.candidates) assert.equal(c.install, `npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/${c.id}#${ref} -y -o`)
  }
  // 양성 대조: 후보가 있는 원형 = 레시피들이 적은 원형의 합집합 = 원형 9개 전부. r1-measure 는 dashboard·saas 를 적었다 → 둘에 r1 이 있다
  const covered = [...new Set(recipes.flatMap((r) => r.archetypes))].sort()
  assert.deepEqual(covered, [...ARCHETYPES].sort())
  assert.deepEqual(tasks.filter((t) => t.recipes.candidates.length).map((t) => t.id), covered)
  for (const a of ['dashboard', 'saas']) assert.ok(tasks.find((t) => t.id === a).recipes.candidates.some((c) => c.id === 'r1-measure'), a)
  // 완전하지 않을 때의 안내(레시피를 빼 RECIPES_COMPLETE 를 되돌릴 때)는 그대로 남는다.
  assert.equal(recipeNote([], recipes, false).includes('지어내지'), true)
  // decisionDate: 결정 파일의 가장 늦은 decidedAt 날짜 — 파일이 없으면 null 이고 안내문에서 날짜 괄호가 빠진다.
  const latest = readJson(DECISIONS_FILE).decisions.map((d) => d.decidedAt.slice(0, 10)).sort().at(-1)
  assert.equal(decisionDate(), latest)
  assert.equal(decisionDate(join(root, 'no-such-decisions.json')), null)
  assert.ok(recipeNote([], recipes, true, null).startsWith('운영자가 레시피 보드에서 승인한'))
  assert.ok(recipeNote([], recipes, true, '2030-01-02').startsWith('운영자가 레시피 보드(2030-01-02)에서 승인한'))
  assert.throws(() => taskFile(readJson(join(ARCHETYPE_PATH, 'saas.json')), [], ref, ['content-saas']), /RECIPES_COMPLETE 인데/)
  // M4: note 는 지금 있는 레시피에서 만든다(박아 둔 이름이 아니다)
  for (const t of tasks) assert.ok(t.recipes.note.includes(`${recipes.length}벌(${recipes.map((r) => r.id).join('·')})`), t.id)
  // Task 7 fix 1(리뷰 I5): 레시피 archetypeConditions 가 그 원형 후보의 condition 으로 실린다 — 적지 않은 원형·레시피에는 없다.
  for (const t of tasks) for (const c of t.recipes.candidates) {
    const want = recipes.find((r) => r.id === c.id).conditions?.[t.id]
    assert.equal(c.condition, want, `${t.id}/${c.id}`)
  }
  const brandR8 = tasks.find((t) => t.id === 'brand').recipes.candidates.find((c) => c.id === 'r8-dusk')
  assert.match(brandR8.condition, /헤리티지/)
  assert.equal(tasks.find((t) => t.id === 'saas').recipes.candidates.find((c) => c.id === 'r1-measure').condition, undefined)
  const more = [...recipes, { id: 'r9-example', name: '예시', archetypes: ['brand'] }]
  assert.ok(recipeNote([], more).includes(`${more.length}벌(${more.map((r) => r.id).join('·')})`))
})

test('음성 대조: 스키마·생성기가 잘못된 입력에서 멈춘다', () => {
  const good = readJson(join(AI_DIR, 'tasks', 'saas.json'))
  assert.equal(TaskFile.safeParse({ ...good, coreTask: '' }).success, false)
  assert.equal(TaskFile.safeParse({ ...good, ref: 'main' }).success, false)
  assert.equal(TaskFile.safeParse({ ...good, extra: 1 }).success, false)
  assert.equal(TaskFile.safeParse({ ...good, content: { ...good.content, install: 'npx shadcn add x' } }).success, false)
  const src = readJson(join(root, 'factory', 'ai', 'gotchas.source.json'))
  assert.equal(GotchasSource.safeParse({ ...src, gotchas: [...src.gotchas, src.gotchas[0]] }).success, false, '겹친 id')
  assert.equal(GotchasSource.safeParse({ ...src, gotchas: [{ ...src.gotchas[0], rule: '두\n줄' }] }).success, false, '여러 줄 rule')
  assert.throws(() => applyRegion('# 표시줄 없음\n', claudeBlock(loadGotchas())), /표시줄/)
  const saas = readJson(join(ARCHETYPE_PATH, 'saas.json'))
  assert.throws(() => taskFile(saas, [], ref, ['content-core']), /content-saas/)
})

test('ai/tasks: 원형 JSON v1 을 싣는다 — allowedVariants(블록 이름)·noBlock·completion·법정 페이지·SEO 기본값(P3-3 Task 1 Step 4b·5)', () => {
  for (const f of readdirSync(join(AI_DIR, 'tasks')).sort()) {
    const t = TaskFile.parse(readJson(join(AI_DIR, 'tasks', f)))
    const src = readJson(join(ARCHETYPE_PATH, f))
    assert.equal(t.source, `registry/factory/archetypes/${f}`)
    assert.equal(t.completion, src.completion, f)
    assert.deepEqual(t.legalPages, src.legal, f)
    assert.equal(t.seo.titleTemplate, src.seo.titleTemplate, f)
    assert.match(t.seo.install.seoMetadata, /seo-meta#v/)
    assert.match(t.seo.install.jsonLdFor, /geo-entity#v/)
    assert.match(t.seo.usage, /seoMetadata\(content, page\)/)
    assert.equal(t.legal.length, src.legalRequirements.length, f)
    for (const p of src.pages) {
      const got = t.pages.find((x) => x.id === p.id)
      assert.equal(got.route, p.route, `${f} ${p.id}`)
      const rows = [...got.required, ...got.optional]
      assert.deepEqual(rows.map((s) => s.kind).sort(), p.sections.map((s) => s.kind).sort(), `${f} ${p.id}`)
      for (const s of p.sections) {
        const row = rows.find((r) => r.kind === s.kind)
        assert.deepEqual(row.allowedVariants, s.allowedVariants, `${f} ${p.id}/${s.kind}`)
        assert.deepEqual(row.noBlock, s.noBlock, `${f} ${p.id}/${s.kind}`)
      }
    }
  }
})

test('ai/tasks/<원형>.json 의 blocks — 블록 메타 archetypes 에 그 원형을 적은 블록만, 종류별로(P3-2 Task 9)', () => {
  const { loadBlocks, blockName } = blocksLib
  const all = loadBlocks().filter((b) => b.meta.success)
  assert.ok(all.length >= 121, `블록 ${all.length}개 — 읽기 실패`)
  // 양성 대조: saas 요금 칸에 three-tier-cards 가 있다(계획 Task 9 Step 1)
  const saas = readJson(join(AI_DIR, 'tasks', 'saas.json'))
  assert.ok(saas.blocks.pricing, 'saas.blocks.pricing 없음')
  const tier = saas.blocks.pricing.find((b) => b.item === 'block-pricing-three-tier-cards')
  assert.ok(tier, 'block-pricing-three-tier-cards 가 saas 요금 목록에 없다')
  assert.equal(tier.install, `npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/block-pricing-three-tier-cards#${ref} -y -o`)
  assert.deepEqual(tier.sectionKinds, ['pricing-plans', 'pricing'])
  assert.match(saas.blocksNote, /레시피/)
  for (const a of ARCHETYPES) {
    const t = readJson(join(AI_DIR, 'tasks', `${a}.json`))
    const want = all.filter((b) => b.meta.data.archetypes.includes(a)).map((b) => blockName(b.kind, b.variant)).sort()
    const got = Object.values(t.blocks).flat().map((b) => b.item).sort()
    assert.deepEqual(got, want, `${a}: blocks 가 메타 archetypes 와 다르다`)
    assert.ok(want.length >= 1, `${a}: 쓸 수 있는 블록이 0`)
    for (const [kind, list] of Object.entries(t.blocks)) for (const b of list) assert.ok(b.item.startsWith(`block-${kind}-`), `${a}/${kind}/${b.item}`)
  }
  // 음성 대조: 이 원형을 적지 않은 블록은 들어오지 않는다
  const commerce = readJson(join(AI_DIR, 'tasks', 'commerce.json'))
  assert.equal(Object.values(commerce.blocks).flat().some((b) => b.item === 'block-pricing-three-tier-cards'), false)
})
