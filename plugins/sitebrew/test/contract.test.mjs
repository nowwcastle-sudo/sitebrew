// Contract between the skills of this plugin and the Sitebrew kit they call. Run it from the Sitebrew repository (the CI of the public repository does):
//   node --test plugins/sitebrew/test/
// The kit is the repository root two folders above the plugin; set SITEBREW_KIT to test against another checkout. Without a kit the kit tests are skipped
// and their names say so. Node built-ins only.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const kitCandidates = [process.env.SITEBREW_KIT, resolve(PLUGIN, '..', '..')].filter(Boolean)
const KIT = kitCandidates.find((d) => existsSync(join(d, 'factory', 'doctor.mjs')))
const SKIP_KIT = KIT ? false : `skipped: no Sitebrew kit found (looked at ${kitCandidates.join(', ') || 'nothing'}; set SITEBREW_KIT)`
const read = (...p) => readFileSync(join(...p), 'utf8')
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
const skillFiles = () => walk(join(PLUGIN, 'skills')).filter((f) => f.endsWith('.md'))
const skillMain = () => skillFiles().filter((f) => f.endsWith('SKILL.md'))
const exportsOf = (src) => new Set([
  ...[...src.matchAll(/^export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]),
  ...[...src.matchAll(/^export\s*\{([^}]*)\}/gm)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)),
])

describe('skills call only what the kit has', () => {
  it(`every "npm run <script>" in the skills is a script of the root, of launch-factory or of its template, and the ones the new skill needs are root scripts (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const root = JSON.parse(read(KIT, 'package.json')).scripts
    const names = new Set(Object.keys(root))
    for (const p of [['launch-factory', 'package.json'], ['launch-factory', 'template', 'package.json']]) {
      if (existsSync(join(KIT, ...p))) for (const s of Object.keys(JSON.parse(read(KIT, ...p)).scripts ?? {})) names.add(s)
    }
    const found = []
    for (const f of skillFiles().filter((x) => !x.endsWith('keys.md'))) for (const m of read(f).matchAll(/npm run ([A-Za-z0-9:_.-]+)/g)) found.push([f, m[1]])
    assert.ok(found.length >= 6, `the scan found only ${found.length} npm scripts - it is not reading the skills`) // positive control
    const missing = found.filter(([, s]) => !names.has(s)).map(([f, s]) => `${f.slice(PLUGIN.length + 1)}: npm run ${s}`)
    assert.deepEqual(missing, [])
    for (const s of ['setup', 'stamp', 'board:direction']) {
      assert.ok(found.some(([, x]) => x === s), `the skills no longer call npm run ${s}`)
      assert.ok(root[s], `the kit has no root script ${s}`)
    }
  })

  it(`every factory/... file named in a SKILL.md exists in the kit (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const found = new Set()
    for (const f of skillMain()) for (const m of read(f).matchAll(/(?<![\w/.-])(factory\/[A-Za-z0-9_./-]+?\.(?:mjs|md|json))/g)) found.add(m[1])
    for (const must of ['factory/stamp/COPY.md', 'factory/legal/AGENT.md', 'factory/stamp/deliver.mjs', 'factory/doctor.mjs']) assert.ok(found.has(must), `the scan does not see ${must} in the skills`) // positive control
    const missing = [...found].filter((p) => !existsSync(join(KIT, p)))
    assert.deepEqual(missing, [])
  })

  it(`the names intake.mjs imports from the kit are exported there (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const src = read(PLUGIN, 'scripts', 'intake.mjs')
    const wanted = [...src.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+load\('([^']+)'\)/g)].map((m) => [m[2], m[1].split(',').map((s) => s.trim()).filter(Boolean)])
    assert.ok(wanted.length >= 2 && wanted.flatMap(([, n]) => n).length >= 4, 'the scan does not see the imports of intake.mjs') // positive control
    for (const [file, names] of wanted) {
      const have = exportsOf(read(KIT, 'factory', 'intake', file))
      for (const n of names) assert.ok(have.has(n), `factory/intake/${file} does not export ${n}`)
    }
  })

  it(`the browser list of the doctor is the list of factory/qa/cdp.mjs (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, async () => {
    const { KIT_BROWSER_PATHS } = await import(pathToFileURL(join(PLUGIN, 'scripts', 'doctor.mjs')).href)
    const src = read(KIT, 'factory', 'qa', 'cdp.mjs')
    const list = /process\.env\.CHROME_PATH,([^\]]*)\]/.exec(src)?.[1]
    assert.ok(list, 'cdp.mjs no longer has the candidate list in the form this test reads')
    const inKit = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])
    assert.ok(inKit.length >= 4)
    assert.deepEqual([...KIT_BROWSER_PATHS].sort(), [...inKit].sort())
  })
})

describe('the guides say what is true', () => {
  it('the revise skill does not call a scope "not implemented" (the kit applies section, axis and copy choices)', () => {
    assert.doesNotMatch(read(PLUGIN, 'skills', 'revise', 'SKILL.md'), /not implemented/i)
  })

  it('the versions the guide names are the ones in compat.json (a built plugin; the source form with {{...}} is skipped)', (t) => {
    const compat = JSON.parse(read(PLUGIN, 'compat.json'))
    if (JSON.stringify(compat).includes('{{')) return t.skip('compat.json still has {{...}} placeholders (the source form, not a built plugin)')
    const guide = read(PLUGIN, 'skills', 'guide', 'SKILL.md')
    assert.ok(guide.includes(`Node \`${compat.engines.node}\``) && guide.includes(`npm \`${compat.engines.npm}\``), 'the guide names other Node/npm minimums than compat.json')
    // only this plugin version's row: the rows of older plugin versions stay in the table (ci/bump-version.mjs) and name older tags
    const version = JSON.parse(read(PLUGIN, '.claude-plugin', 'plugin.json')).version
    assert.ok(compat.guides[version], `compat.json has no row for plugin version ${version}`)
    assert.ok(guide.includes(compat.guides[version].sitebrew.tag), `the guide does not name ${compat.guides[version].sitebrew.tag}`)
    const shadcn = new Set(walk(PLUGIN).filter((f) => /\.md$/.test(f)).flatMap((f) => [...read(f).matchAll(/shadcn@(\d+\.\d+\.\d+)/g)].map((m) => m[1])))
    assert.ok(shadcn.size === 1, `the guides name more than one shadcn version: ${[...shadcn].join(', ')}`)
  })

  it('the Claude hook file is not at the path Codex loads by itself, and the Claude manifest names it', () => {
    assert.ok(!existsSync(join(PLUGIN, 'hooks', 'hooks.json')))
    const manifest = JSON.parse(read(PLUGIN, '.claude-plugin', 'plugin.json'))
    assert.ok(existsSync(join(PLUGIN, manifest.hooks)))
  })
})
