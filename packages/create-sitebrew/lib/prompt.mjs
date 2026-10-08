// One shared line reader on stdin. End of input (or no input for 15 s when stdin is not a terminal) counts as "no answer".
import readline from 'node:readline'

let rl = null
const lines = []
const waiting = []
let closed = false

function start() {
  if (rl) return
  rl = readline.createInterface({ input: process.stdin })
  rl.on('line', (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)))
  rl.on('close', () => {
    closed = true
    while (waiting.length) waiting.shift()(null)
  })
}

/** Print the question, return the typed line, or null when there is no answer. */
export function ask(question) {
  process.stdout.write(`${question} `)
  start()
  const next = lines.length
    ? Promise.resolve(lines.shift())
    : closed
      ? Promise.resolve(null)
      : new Promise((resolve) => {
          waiting.push(resolve)
          if (!process.stdin.isTTY) setTimeout(() => resolve(null), 15_000).unref()
        })
  return next.then((a) => {
    if (a === null) process.stdout.write('\n')
    else if (!process.stdin.isTTY) process.stdout.write(`${a}\n`)
    return a
  })
}

/** Close stdin reading so the process can exit. */
export function endPrompt() {
  rl?.close()
}

/** Y/n question: Enter or y/yes = true. No answer = false. */
export async function confirm(question) {
  const a = await ask(question)
  if (a === null) return { yes: false, noInput: true }
  return { yes: /^(y|yes|예|네|ㅇ)?$/i.test(a.trim()), noInput: false }
}
