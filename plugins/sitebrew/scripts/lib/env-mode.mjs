// Where does a skill run? One question with a safe default: unless a documented agent signal is there, answer chatbot.
// The signals are data (env-signals.json). This module only reads that table; the process environment and the file check are arguments.
// A sandbox that can run code (claude.ai chat) is not the user's computer, so a sandbox signal wins over an agent signal.
// The one exception is a Claude Code cloud session (CLAUDE_CODE_REMOTE): it is agent mode with remote:true, whatever folders its container has.
import { existsSync, readFileSync } from 'node:fs'

const SIGNALS = JSON.parse(readFileSync(new URL('./env-signals.json', import.meta.url), 'utf8'))

const on = (v) => typeof v === 'string' && v.trim() !== '' && !['0', 'false'].includes(v.trim().toLowerCase())
const seen = (row, env, exists) => (row.kind === 'env' ? on(env[row.name]) : exists(row.name))
const note = (row) => ({ name: row.name, verified: row.verified })

/**
 * @returns {{ mode: 'agent'|'chatbot', host: string, remote: boolean, unsure: boolean, evidence: { name: string, verified: boolean }[] }}
 * evidence lists signal names that were seen, never their values.
 */
export function detectMode({ env = process.env, exists = existsSync, signals = SIGNALS } = {}) {
  const sandbox = signals.sandbox.filter((r) => seen(r, env, exists))
  const agent = signals.agent.filter((r) => seen(r, env, exists))
  const remote = signals.remote.filter((r) => seen(r, env, exists))
  const evidence = [...sandbox, ...agent, ...remote].map(note)
  // a Claude Code cloud session is a known place (its container also has the folders of the sandbox rows): the tool runs commands, but not on the user's computer
  if (remote.length) return { mode: 'agent', host: remote[0].host, remote: true, unsure: false, evidence }
  if (sandbox.length) return { mode: 'chatbot', host: sandbox[0].host, remote: false, unsure: false, evidence }
  if (agent.length) return { mode: 'agent', host: agent[0].host, remote: false, unsure: false, evidence }
  return { mode: 'chatbot', host: 'unknown', remote: false, unsure: true, evidence }
}

/**
 * The user's own word (--as agent|chatbot) on top of detection. chatbot is always allowed. agent is accepted only when detection was unsure:
 * a sure sandbox answer is not overruled, because commands there never reach the user's computer.
 */
export function applyOverride(mode, as) {
  if (as === 'chatbot') return { ...mode, mode: 'chatbot', unsure: false, overridden: mode.mode !== 'chatbot' }
  if (as === 'agent' && mode.mode === 'chatbot' && mode.unsure) return { ...mode, mode: 'agent', host: 'user-said', unsure: false, overridden: true }
  return { ...mode, overridden: false }
}
