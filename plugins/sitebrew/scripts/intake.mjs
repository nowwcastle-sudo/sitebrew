#!/usr/bin/env node
// The kit's intake (factory/intake/) is a set of functions, not a command. This script calls them so a skill can run them the same way in any shell.
//   node intake.mjs archetypes                         -> JSON list of archetype ids the intake accepts
//   node intake.mjs questions <archetype>              -> JSON list of { id, ask, hint? } to ask the user (Korean; translate when the user writes another language)
//   node intake.mjs brief --input <answers.json> --out <brief.json>
//        input: { "topic": "...", "archetype": "...", "locale": "ko"|"en", "answers": { "<question id>": "..." } }
//        out:   the brief for `npm run stamp -- --brief`; stdout is { brief, previewOnly, missing[], unread[{ id, answer, why }] } (unread: ask the user again)
// Add --kit <folder> (or set SITEBREW_DIR) when the Sitebrew clone is not in ./sitebrew. Node built-ins only. Nothing here reads or prints a key.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findKit, kitRange } from './lib/kit.mjs'

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const USAGE = 'usage: node intake.mjs archetypes | questions <archetype> | brief --input <answers.json> --out <brief.json>   [--kit <folder>]'

function parse(argv) {
  const o = { positional: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (['--kit', '--input', '--out'].includes(a)) {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
      o[a.slice(2)] = v
    } else if (a.startsWith('--')) throw new Error(`unknown argument: ${a}`)
    else o.positional.push(a)
  }
  return o
}

async function main(argv) {
  const o = parse(argv)
  const [cmd, archetype] = o.positional
  if (!['archetypes', 'questions', 'brief'].includes(cmd)) throw new Error(USAGE)
  const kit = findKit({ arg: o.kit, pluginRoot: PLUGIN_ROOT, range: kitRange(PLUGIN_ROOT) })
  if (kit.missing) throw new Error('Sitebrew clone not found - pass --kit <folder> or set SITEBREW_DIR (run doctor.mjs for the fix)')
  const load = (file) => import(pathToFileURL(join(kit.dir, 'factory', 'intake', file)).href)
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
