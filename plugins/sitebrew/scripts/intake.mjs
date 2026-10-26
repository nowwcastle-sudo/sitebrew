#!/usr/bin/env node
// The kit's intake (factory/intake/) is a set of functions, not a command. This script calls them so a skill can run them the same way in any shell.
//   node intake.mjs archetypes                         -> JSON list of archetype ids the intake accepts
//   node intake.mjs questions <archetype>              -> JSON list of { id, ask, hint? } to ask the user (Korean; translate when the user writes another language)
//   node intake.mjs brief --input <answers.json> --out <brief.json>
//        input: { "topic": "...", "archetype": "...", "locale": "ko"|"en", "answers": { "<question id>": "..." } }
//        out:   the brief for `npm run stamp -- --brief`; stdout is { brief, previewOnly, missing[], unread[{ id, answer, why }] } (unread: ask the user again)
//   node intake.mjs features <archetype>               -> JSON list of { id, ko, en }: yes/no questions about what the site must do ([] when there is nothing to ask); an unknown archetype is an error
//   node intake.mjs features-write --archetype <archetype> --input <answers.json> --run <run folder>
//        input: { "<question id>": true|false } with ids from `features <archetype>` only; anything else is an error naming the input file.
//        Writes <run folder>/features.json (the stamp reads it); stdout is { features: <path>, outcomes: [{ id, say: { ko, en } }] } - the chosen outcomes after `requires` closed them.
//        A kit without feature questions: one line, nothing written.
//   Both feature commands also take --lf <launch-factory folder> (tried first, then LF_DIR and the folders beside the kit).
// Add --kit <folder> (or set SITEBREW_DIR) when the Sitebrew clone is not in ./sitebrew. Node built-ins only. Nothing here reads or prints a key.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findKit, kitRange } from './lib/kit.mjs'

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const USAGE = 'usage: node intake.mjs archetypes | questions <archetype> | brief --input <answers.json> --out <brief.json> | features <archetype> | features-write --archetype <archetype> --input <answers.json> --run <folder>   [--kit <folder>] [--lf <folder>]'

function parse(argv) {
  const o = { positional: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (['--kit', '--input', '--out', '--run', '--archetype', '--lf'].includes(a)) {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
      o[a.slice(2)] = v
    } else if (a.startsWith('--')) throw new Error(`unknown argument: ${a}`)
    else o.positional.push(a)
  }
  return o
}

/** Feature questions need three things: a kit that has features.mjs, the launch-factory outcome table beside it, and (to write) an answers file. Missing either of the first two is not an error. */
async function features({ cmd, archetype, o, kit, load }) {
  const nothing = () => console.log(cmd === 'features' ? '[]' : 'features: no feature questions in this Sitebrew (or launch-factory was not found) - nothing written')
  if (!existsSync(join(kit.dir, 'factory', 'intake', 'features.mjs'))) return nothing()
  const { resolveLf } = await load('resolve-lf.mjs')
  const lf = resolveLf({ arg: o.lf, wfRoot: kit.dir })
  if (!lf) return nothing()
  const { INTAKE_ARCHETYPES } = await load('questions.mjs')
  const { loadOutcomes, featureQuestionsFor, toFeatures, writeFeatures } = await load('features.mjs')
  const table = loadOutcomes(lf)
  const { featureQuestionLimit } = JSON.parse(readFileSync(join(kit.dir, 'factory', 'intake', 'config.json'), 'utf8'))
  const asked = cmd === 'features' ? archetype : o.archetype
  if (!asked) throw new Error(USAGE)
  if (!INTAKE_ARCHETYPES.includes(asked)) throw new Error(`unknown archetype: ${asked} (one of ${INTAKE_ARCHETYPES.join(', ')})`)
  const questions = featureQuestionsFor(asked, table, { limit: featureQuestionLimit })
  if (cmd === 'features') return console.log(JSON.stringify(questions, null, 2))
  if (!o.input || !o.run) throw new Error(USAGE)
  const input = resolve(o.input)
  let answers
  try { answers = JSON.parse(readFileSync(input, 'utf8')) } catch (e) { throw new Error(`${input}: cannot read the answers (${e.message})`, { cause: e }) }
  const ids = questions.map((q) => q.id)
  const wrong = answers === null || typeof answers !== 'object' || Array.isArray(answers)
    ? 'it must be an object like { "<id>": true }'
    : Object.entries(answers).filter(([k, v]) => typeof v !== 'boolean' || !ids.includes(k)).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
  if (wrong) throw new Error(`${input}: wrong answers - ${wrong} (every value true or false; ids to use: ${ids.join(', ')})`)
  const chosen = toFeatures(answers, table)
  const run = resolve(o.run)
  writeFeatures(run, chosen)
  console.log(JSON.stringify({ features: join(run, 'features.json'), outcomes: table.outcomes.filter((x) => chosen.outcomes.includes(x.id)).map(({ id, say }) => ({ id, say })) }))
}

async function main(argv) {
  const o = parse(argv)
  const [cmd, archetype] = o.positional
  if (!['archetypes', 'questions', 'brief', 'features', 'features-write'].includes(cmd)) throw new Error(USAGE)
  const kit = findKit({ arg: o.kit, pluginRoot: PLUGIN_ROOT, range: kitRange(PLUGIN_ROOT) })
  if (kit.missing) throw new Error('Sitebrew clone not found - pass --kit <folder> or set SITEBREW_DIR (run doctor.mjs for the fix)')
  const load = (file) => import(pathToFileURL(join(kit.dir, 'factory', 'intake', file)).href)
  if (cmd.startsWith('features')) return features({ cmd, archetype, o, kit, load })
  const { INTAKE_ARCHETYPES, questionsFor } = await load('questions.mjs')
  if (cmd === 'archetypes') return console.log(JSON.stringify(INTAKE_ARCHETYPES))
  if (cmd === 'questions') {
    if (!archetype) throw new Error(USAGE)
    return console.log(JSON.stringify(questionsFor(archetype).map(({ id, ask, hint }) => ({ id, ask, ...(hint ? { hint } : {}) })), null, 2))
  }
  if (!o.input || !o.out) throw new Error(USAGE)
  const { toBrief, missingFacts, toBriefReport } = await load('to-brief.mjs')
  const input = JSON.parse(readFileSync(resolve(o.input), 'utf8'))
  // toBriefReport also returns the answers the kit could not take (a colour name instead of a code); a kit without it has no brand questions, so nothing is unread there
  const { brief, unread } = toBriefReport ? toBriefReport(input) : { brief: toBrief(input), unread: [] }
  const out = resolve(o.out)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(brief, null, 2) + '\n')
  console.log(JSON.stringify({ brief: out, previewOnly: brief.previewOnly === true, missing: missingFacts(brief), unread }))
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(String(e?.message ?? e).split(/\r?\n/).slice(0, 6).join('\n'))
    process.exitCode = 1
  })
}
