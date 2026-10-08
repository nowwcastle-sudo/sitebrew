// GLB 줄이기(FV1 3D-GEN): 이미지→3D 변환기가 내놓은 큰 GLB 를 히어로 예산(2 MB) 안으로 줄인다.
//   node factory/media/optimize-glb.mjs <in.glb> <out.glb> [--size 1024] [--quality 82] [--budget 2097152] [--draco]
// 하는 일: 텍스처를 --size 이하로 줄여 WebP(EXT_texture_webp)로 다시 굽고, 전부 검은 emissive 는 뗀다(변환기가 factor 1 + 검은 텍스처를 내놓는다 — 2048² 메모리만 먹는다),
//   메시는 양자화(KHR_mesh_quantization — three 가 디코더 없이 읽는다)로 줄이고, --draco 를 주면 Draco(KHR_draco_mesh_compression — 같은 출처 디코더 필요)까지 건다.
//   전·후 바이트를 출력하고 예산을 넘으면 종료 1.
// 도구는 저장소 의존성이 아니다 — 소비자·CI 에 나가지 않는 제작자용 도구라서 아래 정확한 버전으로 따로 설치한다(WF_GLTF_TOOLS, 기본 .tmp/gltf-tools):
//   npm i --prefix .tmp/gltf-tools @gltf-transform/core@4.3.0 @gltf-transform/extensions@4.3.0 @gltf-transform/functions@4.3.0 draco3dgltf@1.5.7
// 텍스처 다시 굽기는 저장소의 sharp 로 한다(@gltf-transform/cli 4.3.0 의 번들 sharp 는 이 PC 에서 `colourspace` 오류로 텍스처 단계에서 멈췄다).
import { statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const GLTF_TOOLS_VERSIONS = { core: '4.3.0', extensions: '4.3.0', functions: '4.3.0', draco3dgltf: '1.5.7' }
export const GLB_BUDGET = 2 * 1024 * 1024 // 히어로 3D 모델 예산(블록 계약과 같다)

async function tools() {
  const dir = resolve(process.env.WF_GLTF_TOOLS ?? join(HERE, '..', '..', '.tmp', 'gltf-tools'))
  const req = createRequire(join(dir, 'package.json'))
  const load = async (name) => import(pathToFileURL(req.resolve(name)).href)
  try {
    return { core: await load('@gltf-transform/core'), ext: await load('@gltf-transform/extensions'), fn: await load('@gltf-transform/functions'), draco: req('draco3dgltf'), dir }
  } catch (e) {
    throw new Error(`도구 실패: gltf-transform 이 ${dir} 에 없다(${e.code ?? e.message}) — npm i --prefix "${dir}" @gltf-transform/core@${GLTF_TOOLS_VERSIONS.core} @gltf-transform/extensions@${GLTF_TOOLS_VERSIONS.extensions} @gltf-transform/functions@${GLTF_TOOLS_VERSIONS.functions} draco3dgltf@${GLTF_TOOLS_VERSIONS.draco3dgltf}`)
  }
}

/** → { before, after, textures[{ name, from, to }], droppedEmissive } */
export async function optimizeGlb(inPath, outPath, { size = 1024, quality = 82, budget = GLB_BUDGET, draco: useDraco = false } = {}) {
  const sharp = createRequire(import.meta.url)('sharp')
  const { core, ext, fn, draco } = await tools()
  const io = new core.NodeIO().registerExtensions(ext.ALL_EXTENSIONS).registerDependencies({ 'draco3d.encoder': await draco.createEncoderModule(), 'draco3d.decoder': await draco.createDecoderModule() })
  const doc = await io.read(inPath)
  const root = doc.getRoot()
  let droppedEmissive = false
  for (const m of root.listMaterials()) {
    const t = m.getEmissiveTexture()
    if (!t) continue
    const st = await sharp(Buffer.from(t.getImage())).stats()
    if (st.channels.every((c) => c.max === 0)) { m.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]); droppedEmissive = true }
  }
  await doc.transform(fn.prune(), fn.dedup(), fn.weld())
  const textures = []
  doc.createExtension(ext.EXTTextureWebP).setRequired(true)
  for (const t of root.listTextures()) {
    const src = Buffer.from(t.getImage())
    const normal = root.listMaterials().some((m) => m.getNormalTexture() === t)
    const img = sharp(src).resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    const out = await img.webp({ quality: normal ? 92 : quality, effort: 5 }).toBuffer()
    t.setImage(new Uint8Array(out)).setMimeType('image/webp').setURI('')
    textures.push({ name: t.getName(), from: src.length, to: out.length })
  }
  if (useDraco) doc.createExtension(ext.KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: ext.KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER })
  else await doc.transform(fn.quantize())
  await io.write(outPath, doc)
  const before = statSync(inPath).size, after = statSync(outPath).size
  return { before, after, textures, droppedEmissive, withinBudget: after <= budget }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  const [inPath, outPath, ...rest] = process.argv.slice(2)
  const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? Number(rest[i + 1]) : d }
  if (!inPath || !outPath) { console.error('사용법: node factory/media/optimize-glb.mjs <in.glb> <out.glb> [--size 1024] [--quality 82] [--budget 바이트]'); process.exitCode = 2 }
  else {
    try {
      const r = await optimizeGlb(inPath, outPath, { size: opt('size', 1024), quality: opt('quality', 82), budget: opt('budget', GLB_BUDGET), draco: rest.includes('--draco') })
      console.log(`GLB ${r.before} → ${r.after} 바이트 (${(r.after / r.before * 100).toFixed(1)}%) · 예산 ${opt('budget', GLB_BUDGET)} ${r.withinBudget ? '안' : '초과'}${r.droppedEmissive ? ' · 검은 emissive 뗌' : ''}`)
      for (const t of r.textures) console.log(`  텍스처 ${t.name || '(이름 없음)'} ${t.from} → ${t.to}`)
      process.exitCode = r.withinBudget ? 0 : 1
    } catch (e) { console.error(e.message); process.exitCode = 1 }
  }
}
