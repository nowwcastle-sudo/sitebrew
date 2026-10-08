// Run web-factory's own build-media videoAsset() on a HyperFrames render. Output goes to a scratch folder.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { statSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [src, outDir, recipe, slot, vw] = process.argv.slice(2)
const sharp = createRequire('<sitebrew checkout>/package.json')('sharp')
const bm = await import(pathToFileURL('<sitebrew checkout>-v009/factory/media/build-media.mjs').href)
mkdirSync(outDir, { recursive: true })
const t0 = Date.now()
const a = await bm.videoAsset(sharp, src, recipe, slot, { widths: [1440, 960, 480], videoWidth: Number(vw), outDir, tmpDir: join(outDir, '_tmp') })
console.log('videoAsset ms', Date.now() - t0)
for (const f of a.files) console.log(f.role.padEnd(9), String(f.bytes).padStart(8), f.file, f.crf ? 'crf' + f.crf : '', f.w ? 'w' + f.w : '')
console.log('video', JSON.stringify(a.video))
console.log('overBudget', JSON.stringify(bm.overBudget([a])))
