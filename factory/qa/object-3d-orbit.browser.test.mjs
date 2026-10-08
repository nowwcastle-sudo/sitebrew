// 3D 히어로 object-3d-orbit 의 실제 그림 시험(FV1 3D-GEN — 판정 「3D 요소가 너무 허접함」의 고침). Chrome 을 띄우므로 실행 잠금 안에서만 돌린다.
//   네 갈래를 갤러리 쿼리 o3 로 연다(app/qa/blocks/media.ts): model(이미지에서 만든 GLB) · image(원본 이미지만 → 2.5D) · none(아무것도 없음 → 포스터 자리만) + 동작 줄이기.
//   ① 모델: three 가 올라오고(WebGL) 그림이 비지도 넘치지도 않고, 천천히 돌고, 고운 포인터에서만 기울고(터치는 안 기욺), 정지 단추를 누르면 선다 · 콘솔 오류 0.
//   ② 동작 줄이기: three·GLB 를 받지 않는다(캔버스·data-live 없음, 포스터만).
//   ③ 2.5D: three 를 받지 않고, 고운 포인터에서만 그림이 기운다. ④ 포스터만: 캔버스도 이미지도 없는 muted 무대.
// 갤러리 origin 은 환경 변수 WF_O3_GALLERY(`npm run build && npm start` 의 주소), 레시피는 WF_O3_RECIPE(기본 r1-measure). origin 이 없으면 건너뛴다(건너뜀 이유가 출력에 남는다).
//   WF_O3_GALLERY=http://127.0.0.1:3000 node --test --test-force-exit --test-timeout=300000 factory/qa/object-3d-orbit.browser.test.mjs   (Chrome 하나 — 실행 잠금 안에서만)
// WebGL 은 화면 없는 Chrome 에서 SwiftShader 로 돈다(--use-angle=swiftshader) — 그림이 실제 GPU 와 다를 수 있어 값이 아닌 「비지 않음·범위·변화」만 본다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, closeChrome } from './cdp.mjs'
import { jobPath } from '../board/block-board/jobs.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = createRequire(join(root, 'package.json'))('sharp')
const origin = process.env.WF_O3_GALLERY
const recipe = process.env.WF_O3_RECIPE || 'r1-measure'
const skip = origin ? false : 'WF_O3_GALLERY(갤러리 origin)가 없어 건너뛴다 — 3D 그림은 실제 Chrome 에서만 잰다'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const url = (o3) => `${origin.replace(/\/$/, '')}${jobPath({ block: 'block-hero-object-3d-orbit', recipe, theme: 'light' })}&o3=${o3}`
const WEBGL = ['--hide-scrollbars', '--force-color-profile=srgb', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

async function withPage(fn, { o3 = 'model', motion = 'no-preference', pointer = 'fine', width = 1440, height = 900 } = {}) {
  const chrome = await startChrome(WEBGL, { prefix: 'fv1-3dgen-o3-' })
  try {
    const errors = []
    const { ws, send, ev } = await connect(chrome.wsUrl, {
      onEvent: (d) => {
        if (d.method === 'Runtime.exceptionThrown') errors.push(String(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split('\n')[0].slice(0, 200))
        else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
      },
    })
    try {
      await send('Page.enable'); await send('Runtime.enable')
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      const fine = pointer === 'fine'
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion }, { name: 'pointer', value: pointer }, { name: 'any-pointer', value: pointer }, { name: 'hover', value: fine ? 'hover' : 'none' }, { name: 'any-hover', value: fine ? 'hover' : 'none' }] })
      await send('Emulation.setTouchEmulationEnabled', fine ? { enabled: false } : { enabled: true, maxTouchPoints: 5 })
      await send('Page.navigate', { url: url(o3) })
      for (let i = 0; i < 300 && !(await ev(`!!document.querySelector('[data-qa-ready]')`)); i++) await sleep(100)
      await ev('document.fonts.ready.then(() => 1)')
      return await fn({ send, ev, errors })
    } finally {
      ws.close()
    }
  } finally {
    await closeChrome(chrome)
  }
}

const live = (ev, ms = 25000) => ev(`(async () => { const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { if (document.querySelector('.o3-stage[data-live]')) return true; await new Promise((r) => setTimeout(r, 100)) } return false })()`)
const stageShot = async ({ send, ev }) => {
  const r = await ev(`(() => { const b = document.querySelector('.o3-stage').getBoundingClientRect(); return [b.x + scrollX, b.y + scrollY, b.width, b.height] })()`)
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1 } })
  const { data, info } = await sharp(Buffer.from(s.result.data, 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
const changedPixels = (a, b, channel = 12) => {
  let n = 0
  for (let i = 0; i < a.data.length; i += 4) if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) > channel) n++
  return n
}
// 오브젝트가 차지한 비율: 네 모서리 평균색과 채널 차 > 40 인 픽셀(그림자는 옅어 세지 않는다).
const coverage = (img) => {
  const px = (x, y) => { const p = (y * img.width + x) * 4; return [img.data[p], img.data[p + 1], img.data[p + 2]] }
  const corners = [px(4, 4), px(img.width - 5, 4), px(4, img.height - 5), px(img.width - 5, img.height - 5)]
  const bg = [0, 1, 2].map((c) => corners.reduce((s, k) => s + k[c], 0) / 4)
  let n = 0
  for (let i = 0; i < img.data.length; i += 4) if (Math.max(Math.abs(img.data[i] - bg[0]), Math.abs(img.data[i + 1] - bg[1]), Math.abs(img.data[i + 2] - bg[2])) > 40) n++
  return n / (img.width * img.height)
}
const moveMouse = (send, x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' })
const stageCenter = (ev) => ev(`(() => { const b = document.querySelector('.o3-stage').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2, b.width, b.height] })()`)
const heavyRequests = (ev) => ev(`performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /three|GLTF|\\.glb|webgl/i.test(n))`)

test('모델: 3D 가 올라와 PBR 모델이 무대의 4~60% 를 채우고 · 천천히 돌고 · 콘솔 오류 0', { skip, timeout: 240000 }, async () => {
  await withPage(async (p) => {
    assert.equal(await live(p.ev), true, '3D 가 25초 안에 올라오지 않았다(data-live)')
    await sleep(2200) // 올라와서 돌아 앉는 1.4초 뒤
    const canvas = await p.ev(`(() => { const c = document.querySelector('.o3-canvas canvas'); return c ? [c.width, c.height] : null })()`)
    assert.ok(canvas && canvas[0] > 100 && canvas[1] > 100, `캔버스 크기: ${canvas}`)
    const a = await stageShot(p)
    const cov = coverage(a)
    assert.ok(cov > 0.04 && cov < 0.6, `모델이 무대의 4~60% 를 차지해야 한다: ${(cov * 100).toFixed(1)}%`)
    await sleep(4000)
    assert.ok(changedPixels(a, await stageShot(p)) > 200, '천천히 돈다 — 4초 뒤 그림이 달라져야 한다')
    assert.ok(await p.ev(`!!document.querySelector('[data-wf-loop-pause]')`), '턴테이블이 돌고 있으니 정지 단추가 있다(WCAG 2.2.2)')
    assert.deepEqual(p.errors, [])
  })
})

test('모델: 정지 단추를 누르면 턴테이블이 서고 · 고운 포인터에서만 기울며 · 터치에서는 기울지 않는다', { skip, timeout: 240000 }, async () => {
  const measure = async (opts) => withPage(async (p) => {
    assert.equal(await live(p.ev), true)
    await sleep(2200)
    await p.ev(`document.querySelector('[data-wf-loop-pause]').click()`)
    await sleep(1200)
    const still = await stageShot(p)
    await sleep(2500)
    const idle = changedPixels(still, await stageShot(p))
    const [cx, cy, w, h] = await stageCenter(p.ev)
    await moveMouse(p.send, cx, cy)
    await sleep(1200)
    const a = await stageShot(p)
    await moveMouse(p.send, cx + w * 0.4, cy - h * 0.4)
    await sleep(1800)
    return { idle, tilt: changedPixels(a, await stageShot(p)) }
  }, opts)
  const fine = await measure({ pointer: 'fine' })
  assert.ok(fine.idle < 60, `정지한 뒤에는 그림이 가만히 있다: 바뀐 픽셀 ${fine.idle}`)
  assert.ok(fine.tilt > 300, `고운 포인터에서 기울어 그림이 바뀌어야 한다: 바뀐 픽셀 ${fine.tilt}`)
  const coarse = await measure({ pointer: 'coarse' })
  assert.ok(coarse.tilt < 60, `터치에서는 기울임이 없다: 바뀐 픽셀 ${coarse.tilt}`)
})

test('동작 줄이기: three·GLB 를 받지 않는다 — 캔버스도 data-live 도 정지 단추도 없고 포스터만 남는다', { skip, timeout: 120000 }, async () => {
  await withPage(async (p) => {
    await sleep(6000)
    assert.equal(await p.ev(`!!document.querySelector('.o3-stage[data-live]')`), false)
    assert.equal(await p.ev(`!!document.querySelector('.o3-canvas canvas')`), false)
    assert.equal(await p.ev(`!!document.querySelector('[data-wf-loop-pause]')`), false)
    assert.equal(await p.ev(`!!document.querySelector('.o3-poster img')`), true, '포스터 그림')
    assert.deepEqual(await heavyRequests(p.ev), [], 'three 나 GLB 가 받아졌다')
  }, { motion: 'reduce' })
})

test('2.5D(원본 이미지만): three 를 받지 않고 · 고운 포인터에서만 그림이 기운다', { skip, timeout: 180000 }, async () => {
  const tilted = async (opts) => withPage(async (p) => {
    await sleep(3000)
    assert.equal(await p.ev(`document.querySelector('.o3-stage').dataset.mode`), 'parallax')
    assert.equal(await p.ev(`!!document.querySelector('.o3-canvas canvas')`), false)
    assert.deepEqual(await heavyRequests(p.ev), [], '2.5D 는 three 를 받지 않는다')
    const [cx, cy, w, h] = await stageCenter(p.ev)
    await moveMouse(p.send, cx + w * 0.4, cy - h * 0.4)
    await sleep(1500)
    return p.ev(`getComputedStyle(document.querySelector('.o3-poster-fade')).transform`)
  }, { o3: 'image', ...opts })
  const fine = await tilted({ pointer: 'fine' })
  assert.notEqual(fine, 'none', '고운 포인터에서 그림이 기울어야 한다')
  assert.match(fine, /matrix3d/, '3D 기울임(원근) 행렬')
  const reduced = await tilted({ pointer: 'fine', motion: 'reduce' })
  assert.equal(reduced, 'none', '동작 줄이기는 정지')
  const coarse = await tilted({ pointer: 'coarse' })
  assert.notEqual(coarse, fine, '터치는 포인터 따라 기울지 않는다(기울면 고운 포인터와 같은 행렬이 된다)')
})

test('포스터만(모델도 이미지도 없음): 캔버스·이미지 없이 muted 무대', { skip, timeout: 120000 }, async () => {
  await withPage(async (p) => {
    await sleep(3000)
    assert.equal(await p.ev(`document.querySelector('.o3-stage').dataset.mode`), 'poster')
    assert.equal(await p.ev(`!!document.querySelector('.o3-canvas canvas')`), false)
    assert.equal(await p.ev(`!!document.querySelector('.o3-poster img')`), false)
    assert.equal(await p.ev(`!!document.querySelector('.o3-poster-fade picture')`), false)
    assert.equal(await p.ev(`document.querySelector('.o3-poster-fade').children.length`), 1, 'muted 틀 하나')
    assert.deepEqual(await heavyRequests(p.ev), [])
  }, { o3: 'none' })
})
