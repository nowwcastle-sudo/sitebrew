// lib/site.tsx 가 찍어낸 쪽이 부르는 이름을 모두 내보내는지 본다(v0.2.6 — T17·T18 편집이 pageTitle 등 5개를 잃어 next build 가 셋 다 떨어졌다).
// 실제 빌드는 20분이 걸려 정적 검사가 이를 못 잡았다. 여기서는 소스 글자만 읽는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const TEMPLATE = path.resolve(import.meta.dirname, '../stamp/site-template')
const SITE_SRC = fs.readFileSync(path.join(TEMPLATE, 'lib/site.tsx'), 'utf8')
const GEN_PAGES = fs.readFileSync(path.resolve(import.meta.dirname, '../stamp/gen-pages.mjs'), 'utf8')

const exported = new Set([...SITE_SRC.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm)].map((m) => m[1]))

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]))

/** 소스 글자에서 `import { a, b } from "@/lib/site"` 의 이름들을 모은다(템플릿 문자열 속 `${…}` 조각은 건너뛴다). */
const importedNames = (raw) => { const src = raw.replace(/\$\{[^}?]*\?\s*'([^']*)'\s*:\s*''\}/g, '$1'); return [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/site"/g)].flatMap((m) => m[1].split(',').map((s) => s.replace(/\$\{[^}]*\}|'[^']*'/g, '').replace(/\btype\s+/, '').trim().split(/\s+as\s+/)[0]).filter((s) => /^\w+$/.test(s))) }

test('lib/site.tsx 가 템플릿 파일이 부르는 이름을 모두 내보낸다', () => {
  const files = walk(TEMPLATE).filter((f) => /\.(tsx?|mjs)$/.test(f) && f !== path.join(TEMPLATE, 'lib/site.tsx'))
  for (const f of files) for (const n of importedNames(fs.readFileSync(f, 'utf8'))) assert.ok(exported.has(n), `${path.relative(TEMPLATE, f)} 가 부르는 ${n} 이(가) lib/site.tsx 에 없다`)
})

test('gen-pages 가 쓰는 쪽 파일 import 이름(법정 쪽 포함)이 모두 lib/site.tsx 에 있다', () => {
  const names = importedNames(GEN_PAGES)
  for (const n of ['copyVariantOf', 'legalPage', 'locale', 'pageSeo', 'pageTitle', 'sectionProps', 'seoContent', 'shellProps']) assert.ok(names.includes(n), `시험 자체 점검: gen-pages 의 import 에 ${n} 이 안 잡힌다`)
  for (const n of names) assert.ok(exported.has(n), `gen-pages 가 쓰는 ${n} 이(가) lib/site.tsx 에 없다`)
})
