// 안내 문서(docs/guides/*.md)의 표지가 붙은 코드 블록을 읽고 저장소 사본에 적용한다.
// add-recipe-guide.test.mjs(시험)와 _tools 의 verify-public ext-recipe 행(내보낸 키트)이 같은 절차를 쓰도록 분리했다.
// 문서의 표지(코드 블록 첫 줄 뒤에 적는다):
//   ```<언어> file=<경로>                      새 파일을 쓴다(이미 있으면 실패 — 기존 파일을 덮지 않는다)
//   ```<언어> file=<경로> after="<줄>"         그 경로의 파일에서 글자가 <줄> 과 같은 줄(앞뒤 공백 무시) 바로 아래에 블록을 끼운다(그런 줄이 정확히 하나여야 한다)
//   ```sh run                                 줄마다 `npm run <이름>` 한 명령. 차례로 돌려 모두 0 이어야 한다
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** 문서에서 표지가 있는 코드 블록만 문서 순서대로 뽑는다. */
export function guideBlocks(md) {
  const out = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(\w*)[ \t]*(.*)$/.exec(lines[i])
    if (!open) continue
    const body = []
    let j = i + 1
    while (j < lines.length && !/^```[ \t]*$/.test(lines[j])) body.push(lines[j++])
    assert.ok(j < lines.length, `닫히지 않은 코드 블록(${i + 1}행)`)
    const attrs = {}
    for (const m of open[2].matchAll(/(\w+)(?:=(?:"([^"]*)"|(\S+)))?/g)) attrs[m[1]] = m[2] ?? m[3] ?? true
    if (attrs.file || attrs.run) out.push({ lang: open[1], attrs, text: body.join('\n') + '\n', line: i + 1 })
    i = j
  }
  return out
}

/** file= 블록 하나를 root 아래에 적용한다(새 파일을 쓰거나 after= 줄 아래에 끼운다). */
export function applyFile(root, block) {
  const target = join(root, block.attrs.file)
  if (block.attrs.after === undefined) {
    assert.ok(!existsSync(target), `${block.attrs.file}: 이미 있는 파일이다 — 안내의 예시 이름이 저장소와 겹친다(${block.line}행)`)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, block.text)
    return
  }
  assert.ok(existsSync(target), `${block.attrs.file}: 파일이 없다(${block.line}행)`)
  const lines = readFileSync(target, 'utf8').split('\n')
  const at = lines.flatMap((l, k) => (l.trim() === block.attrs.after ? [k] : []))
  assert.equal(at.length, 1, `${block.attrs.file}: 「${block.attrs.after}」 줄이 ${at.length}개 — 정확히 하나여야 한다(${block.line}행)`)
  lines.splice(at[0] + 1, 0, ...block.text.replace(/\n$/, '').split('\n'))
  writeFileSync(target, lines.join('\n'))
}