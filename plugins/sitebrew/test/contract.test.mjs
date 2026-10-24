// Contract between the skills of this plugin and the Sitebrew kit they call. Run it from the Sitebrew repository (the CI of the public repository does):
//   node --test plugins/sitebrew/test/
// The kit is the repository root two folders above the plugin; set SITEBREW_KIT to test against another checkout. Without a kit the kit tests are skipped
// and their names say so. Node built-ins only.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, describe, it } from 'node:test'

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
    for (const must of ['factory/stamp/COPY.md', 'factory/legal/AGENT.md', 'factory/stamp/deliver.mjs', 'factory/doctor.mjs', 'factory/tunnel/preview-link.mjs']) assert.ok(found.has(must), `the scan does not see ${must} in the skills`) // positive control
    const missing = [...found].filter((p) => !existsSync(join(KIT, p)))
    assert.deepEqual(missing, [])
  })

  it(`the preview skill calls only commands and flags that factory/tunnel/preview-link.mjs has (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const cli = join(KIT, 'factory', 'tunnel', 'preview-link.mjs')
    assert.ok(existsSync(cli), 'the kit has no factory/tunnel/preview-link.mjs')
    // the command line is split in modules (arguments in cli-args.mjs): read the entry and its argument module together
    const src = ['preview-link.mjs', 'cli-args.mjs'].map((f) => join(KIT, 'factory', 'tunnel', f)).filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
    const lines = [...read(PLUGIN, 'skills', 'preview', 'SKILL.md').matchAll(/^node factory\/tunnel\/preview-link\.mjs (.*)$/gm)].map((m) => m[1].trim())
    assert.ok(lines.length >= 5, `the scan sees only ${lines.length} preview-link commands`) // positive control: tools, start, status, stop, notices
    const commands = new Set(lines.map((l) => l.split(/\s+/)[0]))
    for (const c of ['tools', 'start', 'status', 'stop', 'notices']) {
      assert.ok(commands.has(c), `the skill no longer calls preview-link ${c}`)
      assert.ok(src.includes(`'${c}'`) || src.includes(`"${c}"`) || src.includes(`${c}:`), `preview-link.mjs (with cli-args.mjs) has no command ${c}`)
    }
    const flags = new Set(lines.flatMap((l) => [...l.matchAll(/(?<![\w-])(--[a-z][a-z-]*)/g)].map((m) => m[1])))
    for (const f of ['--site', '--lang', '--kind']) assert.ok(flags.has(f), `the scan does not see ${f} in the skill`) // positive control
    for (const f of flags) assert.ok(src.includes(f), `preview-link.mjs has no flag ${f}`)
    // the product flag is in the text of the skill (a yes unlocks it) though no command line carries it
    assert.ok(read(PLUGIN, 'skills', 'preview', 'SKILL.md').includes('--allow-mock'))
    assert.ok(src.includes('--allow-mock'), 'preview-link.mjs has no flag --allow-mock')
  })

  it('the preview skill points at a reference file that exists, and the chatbot guide is Korean then English', () => {
    const skill = read(PLUGIN, 'skills', 'preview', 'SKILL.md')
    for (const m of skill.matchAll(/(?<![\w/.-])(references\/[A-Za-z0-9_.-]+\.md)/g)) assert.ok(existsSync(join(PLUGIN, 'skills', 'preview', m[1])), `${m[1]} is named in the skill but missing`)
    const guide = read(PLUGIN, 'skills', 'preview', 'references', 'own-computer.md')
    assert.ok(/[\uac00-\ud7a3]/.test(guide) && guide.search(/[\uac00-\ud7a3]/) < guide.indexOf('English'))
    assert.ok(guide.includes('--url http://localhost:'))
  })

  it(`the names intake.mjs imports from the kit are exported there (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const src = read(PLUGIN, 'scripts', 'intake.mjs')
    const wanted = [...src.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+load\('([^']+)'\)/g)].map((m) => [m[2], m[1].split(',').map((s) => s.trim()).filter(Boolean)])
    assert.ok(wanted.length >= 2 && wanted.flatMap(([, n]) => n).length >= 4, 'the scan does not see the imports of intake.mjs') // positive control
    for (const f of ['features.mjs', 'resolve-lf.mjs']) assert.ok(wanted.some(([file]) => file === f), `the scan does not see the import from ${f}`)
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

describe('feature questions (intake.mjs features, features-write)', () => {
  const INTAKE = join(PLUGIN, 'scripts', 'intake.mjs')
  const dirs = []
  const scratch = () => { const d = mkdtempSync(join(tmpdir(), 'sitebrew-features-')); dirs.push(d); return d }
  after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))
  const run = (args, env = {}) => {
    const r = spawnSync(process.execPath, [INTAKE, ...args], { encoding: 'utf8', env: { ...process.env, LF_DIR: '', ...env }, timeout: 60_000 })
    return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
  }
  const outcome = (id, order, ko, archetypes = ['saas']) => ({ id, order, say: { ko, en: id }, question: { ko: `${ko}?`, en: `${id}?` }, archetypes, parts: ['p'], requires: id === 'payments' ? ['signup'] : [], closure: [], needs: [], guides: [], product: true })
  const lfWith = (outcomes) => {
    const lf = scratch()
    mkdirSync(join(lf, 'features'))
    writeFileSync(join(lf, 'features', 'outcomes.generated.json'), JSON.stringify({ version: 1, hash: 'h1', outcomes, pages: [], routes: [] }))
    return lf
  }

  it('a kit without factory/intake/features.mjs: features prints [] and features-write skips with one line, both exit 0', () => {
    const kit = scratch()
    mkdirSync(join(kit, 'factory'))
    writeFileSync(join(kit, 'factory', 'doctor.mjs'), '// old kit\n')
    const q = run(['--kit', kit, 'features', 'saas'])
    assert.deepEqual([q.code, q.out], [0, '[]'])
    const runDir = join(scratch(), 'run')
    const w = run(['--kit', kit, 'features-write', '--input', join(kit, 'none.json'), '--run', runDir])
    assert.equal(w.code, 0)
    assert.match(w.out, /^[^\r\n]+$/)
    assert.ok(!existsSync(join(runDir, 'features.json')))
  })

  it(`with the table: features lists the questions and features-write writes features.json with requires closed (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const lf = lfWith([outcome('signup', 1, '가입'), outcome('payments', 2, '결제'), outcome('extra', 3, '기타', ['pwa'])]) // extra is asked of pwa only
    assert.ok(JSON.parse(read(KIT, 'factory', 'intake', 'config.json')).featureQuestionLimit >= 2, 'the test table needs room under the question limit')
    const q = run(['--kit', KIT, 'features', 'saas'], { LF_DIR: lf })
    assert.equal(q.code, 0, q.err)
    assert.deepEqual(JSON.parse(q.out), [{ id: 'signup', ko: '가입?', en: 'signup?' }, { id: 'payments', ko: '결제?', en: 'payments?' }])
    assert.deepEqual(JSON.parse(run(['--kit', KIT, 'features', 'landing'], { LF_DIR: lf }).out), []) // the table asks nothing of this archetype

    const answers = join(scratch(), 'answers.json')
    writeFileSync(answers, JSON.stringify({ payments: true, signup: false }))
    const runDir = join(scratch(), 'run')
    const write = () => run(['--kit', KIT, 'features-write', '--archetype', 'saas', '--input', answers, '--run', runDir], { LF_DIR: lf })
    const w = write()
    assert.equal(w.code, 0, w.err)
    assert.deepEqual(JSON.parse(read(runDir, 'features.json')), { version: 1, table: 'h1', outcomes: ['signup', 'payments'] })
    // stdout: the path and the outcomes after requires closed them (signup was answered false but payments needs it)
    assert.deepEqual(JSON.parse(w.out), { features: join(runDir, 'features.json'), outcomes: [{ id: 'signup', say: { ko: '가입', en: 'signup' } }, { id: 'payments', say: { ko: '결제', en: 'payments' } }] })

    // the answers file is a trust boundary: nothing is written for a wrong one, and the error names the file
    const wrong = join(scratch(), 'wrong-run')
    for (const body of ['{"signup":"true"}', 'null', '[true]', '{ not json', '{"extra":true}', '{"nonsense":true}']) {
      writeFileSync(answers, body)
      const bad = run(['--kit', KIT, 'features-write', '--archetype', 'saas', '--input', answers, '--run', wrong], { LF_DIR: lf })
      assert.notEqual(bad.code, 0, body)
      assert.ok(bad.err.includes(answers), `${body}: the error does not name the input file: ${bad.err}`)
      assert.ok(!existsSync(join(wrong, 'features.json')), body)
    }
    writeFileSync(answers, '{}')
    assert.notEqual(run(['--kit', KIT, 'features-write', '--input', answers, '--run', wrong], { LF_DIR: lf }).code, 0) // --archetype is required
  })

  it(`an archetype the intake does not know is an error, not an empty list (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const lf = lfWith([outcome('signup', 1, '가입')])
    const q = run(['--kit', KIT, 'features', 'no-such-type'], { LF_DIR: lf })
    assert.notEqual(q.code, 0)
    assert.match(q.err, /no-such-type/)
  })

  it(`--lf names the launch-factory folder for features and features-write, ahead of LF_DIR (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const lf = lfWith([outcome('signup', 1, '가입')])
    const other = lfWith([outcome('signup', 1, '다른표')])
    const q = run(['--kit', KIT, 'features', 'saas', '--lf', lf], { LF_DIR: other })
    assert.equal(q.code, 0, q.err)
    assert.deepEqual(JSON.parse(q.out), [{ id: 'signup', ko: '가입?', en: 'signup?' }]) // the --lf table, not the LF_DIR one
    const answers = join(scratch(), 'answers.json')
    writeFileSync(answers, JSON.stringify({ signup: true }))
    const runDir = join(scratch(), 'run')
    const w = run(['--kit', KIT, 'features-write', '--archetype', 'saas', '--input', answers, '--run', runDir, '--lf', lf], { LF_DIR: '' })
    assert.equal(w.code, 0, w.err)
    assert.deepEqual(JSON.parse(w.out).outcomes, [{ id: 'signup', say: { ko: '가입', en: 'signup' } }])
    assert.equal(JSON.parse(read(runDir, 'features.json')).table, 'h1')
    assert.notEqual(run(['--kit', KIT, 'features', 'saas', '--lf']).code, 0) // --lf needs a value
  })

  it(`launch-factory not found: features prints [] and exits 0 (${SKIP_KIT || 'kit found'})`, { skip: SKIP_KIT }, () => {
    const kit = scratch() // a kit that has the feature files but no launch-factory/ folder beside them
    for (const f of ['intake/features.mjs', 'intake/resolve-lf.mjs', 'intake/config.json', 'doctor.mjs']) {
      mkdirSync(dirname(join(kit, 'factory', f)), { recursive: true })
      writeFileSync(join(kit, 'factory', f), readFileSync(join(KIT, 'factory', f)))
    }
    const r = run(['--kit', kit, 'features', 'saas'], { LF_DIR: scratch() })
    assert.deepEqual([r.code, r.out], [0, '[]'])
  })

  it('the new skill asks the feature questions the bridge returns and writes them with the same --run as the stamp', () => {
    const text = read(PLUGIN, 'skills', 'new', 'SKILL.md')
    assert.match(text, /intake\.mjs" --kit \. features <archetype>/)
    assert.match(text, /intake\.mjs" --kit \. features-write --archetype <archetype> --input out\/features\.json --run out\/my-site/)
    assert.match(text, /say\.ko/)
    assert.match(text, /npm run stamp -- --brief out\/brief\.json --run out\/my-site/)
    assert.ok(text.includes('references/features.md'), 'the skill does not point at references/features.md')
  })
})

describe('environment branching (plan 6): every skill starts with the same block and has a chatbot mode', () => {
  const BLOCK = read(PLUGIN, 'scripts', 'lib', 'env-block.md').trimEnd()
  const NAMES = ['deliver', 'doctor', 'guide', 'new', 'preview', 'revise', 'runbook', 'setup']
  const frontmatterOf = (t) => Object.fromEntries(/^---\r?\n([\s\S]*?)\r?\n---/.exec(t)[1].split(/\r?\n/).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]))

  it('the skills folder holds exactly the skills this test knows (a new skill needs the block and a chatbot section)', () => {
    assert.deepEqual(readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(), NAMES)
  })

  it('the block is in every SKILL.md, once, byte for byte the file scripts/lib/env-block.md, ahead of the first command other than detect', () => {
    assert.ok(BLOCK.startsWith('<!-- env-block:start -->') && BLOCK.endsWith('<!-- env-block:end -->'))
    for (const n of NAMES) {
      const text = read(PLUGIN, 'skills', n, 'SKILL.md').replace(/\r\n/g, '\n')
      assert.equal(text.split('<!-- env-block:start -->').length - 1, 1, `${n}: the block must appear once`)
      assert.ok(text.includes(BLOCK), `${n}: the block differs from scripts/lib/env-block.md`)
      const at = text.indexOf(BLOCK)
      const firstCommand = text.search(/^```(?:bash|powershell|sh)\n/m)
      assert.ok(firstCommand === -1 || firstCommand >= at, `${n}: a command block comes before the environment block`)
      assert.ok(text.slice(0, at).split('\n').length < 20, `${n}: the block is not in the first lines`)
    }
  })

  it('the block calls only a command and flags that setup.mjs has', () => {
    const src = read(PLUGIN, 'scripts', 'setup.mjs')
    const lines = [...BLOCK.matchAll(/setup\.mjs" (.*)$/gm)].map((m) => m[1])
    assert.ok(lines.length >= 1, 'the scan does not see the setup.mjs command in the block') // positive control
    for (const l of lines) assert.ok(src.includes(`'${l.split(/\s+/)[0]}'`), `setup.mjs has no command ${l}`)
    for (const f of BLOCK.matchAll(/(?<![\w-])(--[a-z][a-z-]*)/g)) assert.ok(src.includes(f[1]), `setup.mjs has no flag ${f[1]}`)
  })

  it('every SKILL.md has a "Chatbot mode" section that says nothing ran', () => {
    for (const n of NAMES) {
      const text = read(PLUGIN, 'skills', n, 'SKILL.md')
      assert.match(text, /^## Chatbot mode$/m, `${n} has no "## Chatbot mode" section`)
      const section = text.slice(text.search(/^## Chatbot mode$/m))
      assert.match(section, /run nothing|never say|ran nothing|not say|do not (?:report|describe)|nothing/i, `${n}: the chatbot section does not forbid claiming a run`)
    }
  })

  it('the commands of the setup skill are real arguments of setup.mjs', () => {
    const src = read(PLUGIN, 'scripts', 'setup.mjs')
    const text = read(PLUGIN, 'skills', 'setup', 'SKILL.md')
    const lines = [...text.matchAll(/setup\.mjs" (.*)$/gm)].map((m) => m[1])
    const commands = new Set(lines.map((l) => l.split(/\s+/)[0]))
    for (const c of ['detect', 'plan', 'run']) assert.ok(commands.has(c), `the skill no longer calls setup.mjs ${c}`)
    for (const f of lines.join(' ').matchAll(/(?<![\w-])(--[a-z][a-z-]*)/g)) assert.ok(src.includes(f[1]), `setup.mjs has no flag ${f[1]}`)
    assert.ok(lines.some((l) => /^run <id> --yes/.test(l)), 'the run command must carry --yes')
    assert.ok(!lines.some((l) => /^run /.test(l) && !l.includes('--yes')), 'a run command without --yes')
  })

  it('references rules: linked from their own SKILL.md, one level deep, a contents list over 100 lines, forward slashes, no path to another reference', () => {
    let seen = 0
    const allRefs = NAMES.flatMap((n) => (existsSync(join(PLUGIN, 'skills', n, 'references')) ? readdirSync(join(PLUGIN, 'skills', n, 'references')) : []))
    for (const n of NAMES) {
      const dir = join(PLUGIN, 'skills', n, 'references')
      if (!existsSync(dir)) continue
      const skill = read(PLUGIN, 'skills', n, 'SKILL.md')
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        assert.ok(e.isFile(), `${n}/references/${e.name}: nesting deeper than one level`)
        seen++
        assert.ok(skill.includes(`references/${e.name}`), `${n}: SKILL.md does not link references/${e.name}`)
        const text = read(dir, e.name)
        if (text.split('\n').length > 100) assert.match(text.split('\n').slice(0, 30).join('\n'), /Contents|목차/, `${n}/references/${e.name}: over 100 lines without a contents list`)
        assert.ok(!/references\\/.test(text), `${n}/references/${e.name}: a backslash path`)
        assert.ok(!/(?:^|[^\w/.-])(?:\.\.\/)?(?:skills\/[a-z]+\/)?references\/[A-Za-z0-9_.-]+\.md/.test(text), `${n}/references/${e.name}: it names another reference file (a chain)`)
        for (const other of allRefs.filter((f) => f !== e.name)) assert.ok(!text.includes(other), `${n}/references/${e.name}: it names the file ${other} (a chain, also without a folder)`)
      }
    }
    assert.ok(seen >= 5, `the scan saw only ${seen} reference files`) // positive control
    for (const n of NAMES) assert.ok(!/\]\(\.\.\//.test(read(PLUGIN, 'skills', n, 'SKILL.md')) && !read(PLUGIN, 'skills', n, 'SKILL.md').includes('../setup/'), `${n}: a skill points at a file of another skill instead of naming the skill`)
  })

  it('each trigger phrase belongs to one skill', () => {
    const seen = new Map()
    for (const n of NAMES) {
      const d = frontmatterOf(read(PLUGIN, 'skills', n, 'SKILL.md')).description
      assert.ok(d.length >= 100 && d.length <= 1024, `${n} description length ${d.length}`)
      for (const phrase of /Trigger phrases - (.*)$/.exec(d)[1].match(/"[^"]+"/g)) {
        const p = phrase.toLowerCase()
        assert.ok(!seen.has(p), `${phrase} is a trigger of both ${seen.get(p)} and ${n}`)
        seen.set(p, n)
      }
    }
  })

  it('the generated install guide and the chatbot run guide are Korean then English', () => {
    for (const [skill, file] of [['setup', 'install-steps.md'], ['new', 'chatbot-run.md'], ['new', 'intake-questions.md']]) {
      const text = read(PLUGIN, 'skills', skill, 'references', file)
      assert.ok(/[가-힣]/.test(text) && /English|Install|Questions|Steps/.test(text), `${file}`)
    }
    const run = read(PLUGIN, 'skills', 'new', 'references', 'chatbot-run.md')
    assert.ok(run.search(/[가-힣]/) < run.indexOf('## English'), 'chatbot-run.md: Korean must come first')
    assert.ok(run.includes('out/answers.json') && run.includes('out/features.json'))
  })
})
