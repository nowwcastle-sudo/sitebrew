// 파비콘 세트 굽기(Task 13). 표지 SVG 하나 + 레시피 색 → 소비자 프로젝트의 Next 파일 규약 자리(app/icon.svg·app/favicon.ico·
// app/apple-icon.png·public/icon-192·512·maskable-512.png). 계획은 registry/factory/ax/favicon-kit.ts 의 faviconSet, 래스터는 sharp.
// 실행: node factory/scripts/gen-favicons.mjs --svg mark.svg --color "oklch(…)" --dark-color "#…" [--background "#fff"] --out <소비자 폴더>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(root, 'registry', 'factory')

// TS/TSX → .tmp/<tag>/<경로>.mjs, @/registry/factory/… import 는 변환한 파일 주소로(재귀). 테스트(seo.test.mjs)도 이것을 쓴다.
export function tsLoader(tag) {
  const OUT = join(root, '.tmp', tag)
  const done = new Map()
  const transpile = (abs) => {
    if (done.has(abs)) return done.get(abs)
    const out = join(OUT, relative(FACTORY, abs).replace(/\.tsx?$/, '.mjs'))
    done.set(abs, out)
    let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    })
    outputText = outputText
      .replace(/(from\s+|import\s+)(["'])@\/registry\/factory\/([^"']+)\2/g, (_, kw, q, p) => {
        const src = ['.ts', '.tsx'].map((e) => join(FACTORY, p) + e).find(existsSync)
        if (!src) throw new Error(`import 대상 없음: ${p}`)
        return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
      })
      .replace(/(from\s+)(["'])next\/og\2/g, '$1$2next/og.js$2') // 노드 ESM 은 확장자 없는 next/og 를 못 찾는다
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, outputText)
    return out
  }
  return (p) => import(pathToFileURL(transpile(join(FACTORY, p))).href)
}

// PNG 여러 장 → ICO(Windows Vista 이후 PNG 항목을 담는다). 머리 6바이트 + 항목 16바이트씩 + PNG 본문.
export function packIco(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1)
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...pngs.map((p) => p.data)])
}

const raster = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()

/** 표지 SVG·색 → out 폴더에 파일을 쓰고 [{ path, bytes }] 를 돌려준다. */
export async function genFavicons({ svg, color, darkColor, background, out }) {
  const { faviconSet } = await tsLoader('gen-favicons')('ax/favicon-kit.ts')
  const written = []
  for (const f of faviconSet(svg, { color, darkColor, background })) {
    const data =
      f.kind === 'svg' ? Buffer.from(f.svg)
      : f.kind === 'ico' ? packIco(await Promise.all(f.sizes.map(async (size) => ({ size, data: await raster(f.svg, size) }))))
      : await raster(f.svg, f.sizes[0])
    const dest = join(out, f.path)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, data)
    written.push({ path: f.path, bytes: data.length })
  }
  return written
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined }
  const [svgPath, color, darkColor, out] = [arg('svg'), arg('color'), arg('dark-color'), arg('out')]
  if (!svgPath || !color || !darkColor || !out) {
    console.error('사용법: node factory/scripts/gen-favicons.mjs --svg <표지.svg> --color <색> --dark-color <다크 색> [--background <바탕>] --out <소비자 폴더>')
    process.exit(1)
  }
  for (const w of await genFavicons({ svg: readFileSync(svgPath, 'utf8'), color, darkColor, background: arg('background'), out })) console.log(w.path, w.bytes)
}
