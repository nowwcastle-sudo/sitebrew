"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot, ModelSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { kineticType, rise, scrubTimeline } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { useReducedMotion } from "@/registry/factory/motion/use-reduced-motion"
import { Button } from "@/registry/factory/ui/button"

import { LoopPause, useLoopPause } from "../_shared/loop-pause"
import { MediaImage, MediaPreviewBadge } from "../_shared/hero-media"
import { useEdgeGround } from "../_shared/edge-ground"
import { HeroTexture, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"

// 히어로 — 3D 오브젝트 궤도(FV1 Task 5.7 → 3D-GEN 개정). 큰 제목 아래 왼쪽에 문단·버튼, 오른쪽에 무대 하나.
// **3D 는 이미지에서 시작한다**: 고품질 원본 이미지(판매 대상은 실제 사진, 상징·분위기 오브젝트는 생성 이미지) → 이미지-3D 변환 GLB(`model`) → 이 블록은 three.js 로 **표시만** 한다.
// 라이브러리 기본 도형(매듭·다면체 …)으로 장면을 채우지 않는다 — 허접해 보이고, 대체도 아니다. 자료가 모자랄 때의 대체 순서(위가 좋은 쪽):
//   ① model(GLB + 포스터)   : 포스터가 첫 칠(LCP), 등장이 끝난 뒤 브라우저가 한가할 때 three·GLTFLoader 를 동적으로 내려받아 그 위에 올린다. PBR 재질 그대로 · RoomEnvironment 반사광 · ACES 톤 · 접지 그림자(ShadowMaterial) ·
//                             천천히 도는 턴테이블 · 고운 포인터(마우스)의 약한 기울임. 화면 밖·탭 숨김·정지 단추에서는 그리지 않는다(켜 둔 채 5초 넘게 도는 것이라 정지 단추가 상시 — WCAG 2.2.2).
//   ② media(원본 이미지 한 장): 2.5D — three 없이 CSS 로. 포인터가 움직이면 그림이 약하게 기울고 반사광이 반대로 밀린다. 스크롤에는 무대가 가라앉으며 살짝 커진다.
//   ③ 둘 다 없음            : 포스터 자리(muted 무대)만.
//   무대 바탕(세 갈래 공통): 포스터 그림이 있으면 가장자리 띠의 평균색을 한가할 때 읽어 무대의 --o3-ground 로 둔다(_shared/edge-ground) — 3D 가 올라와 포스터가 걷힐 때 바탕색이 튀지 않는다. 읽기가 실패하면(다른 출처 그림 등) 변수 없이 레시피 테마색(muted)이고, 바탕색 전환이 튐을 줄인다. 03 은 이 히어로를 고르지 않는다(모델도 이미지도 만들 수 없는 사용자는 다른 히어로).
//   동작 줄이기·M0(장면이 안 서는 갈래) : three 를 내려받지 않고, 2.5D 도 움직이지 않는다 — 포스터(또는 원본 이미지) 정지, 글은 그대로. WebGL 이 없거나 모델 내려받기가 실패하면 포스터가 남는다.
//   터치: 기울임·끌기 없음(무대는 세로 스크롤을 그대로 통과시킨다 — touch-action: pan-y). 턴테이블은 터치에서도 돈다(정지 단추로 멈춘다).
// 모션: 등장 제목 낱말이 올라온다(키네틱) → 문단·버튼 → (3D 가 올라오면) 모델이 한 번 돌아 앉는다(1.4초). 스크롤 무대가 가라앉는다.
export type HeroObject3dOrbitCopy = {
  label: string
  title: string
  lede: string
  primaryCta: Cta
  secondaryCta?: Cta
  stageLabel: string // 무대 그림의 이름(읽기 도구) — 모델이 있으면 model.alt 가 앞선다
  pauseLabel?: string // 턴테이블 정지 단추의 이름 — 모델이 올라왔을 때만 단추가 생긴다
  emptyLabel?: string // 포스터도 모델도 없을 때 빈 무대 안에 보이는 안내(「실제 사진 필요」) — 안내 없는 회색 빈칸을 그리지 않는다
}
export type HeroObject3dOrbitProps = BlockBase<HeroObject3dOrbitCopy> & HeroCommon & HeroDisplay & { media?: ImageSlot; model?: ModelSlot }

const DEFAULT_TECHNIQUES = ["kinetic-type", "scrub-timeline"]
const SPIN = 0.22 // 턴테이블 rad/s — 한 바퀴 약 28초
const TILT = { yaw: 0.35, pitch: 0.1 } // 고운 포인터 기울임의 최대 라디안

// ── three 의 모양 ─────────────────────────────────────────────────────────────────────────────────
// three 는 자체 타입이 없다(@types/three 는 소비자에 없을 수 있다). 이 블록은 이 파일 안에서만 three 를 부르고 모양은 느슨하게 받는다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Three = any

async function loadThree() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- three 자체에 타입이 없다(소비자에 @types/three 가 없어도 빌드되게).
  const THREE: Three = await import("three")
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- 위와 같다.
  const { GLTFLoader }: Three = await import("three/examples/jsm/loaders/GLTFLoader.js")
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- 위와 같다.
  const { DRACOLoader }: Three = await import("three/examples/jsm/loaders/DRACOLoader.js")
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- 위와 같다.
  const { RoomEnvironment }: Three = await import("three/examples/jsm/environments/RoomEnvironment.js")
  return { THREE, GLTFLoader, DRACOLoader, RoomEnvironment }
}

type Pose = { tx: number; ty: number; x: number; y: number; reveal: number } // 포인터 목표(tx, ty ∈ -1..1) · 감쇠된 값 · 등장 회전(라디안)
type Mounted = { pose: Pose; wake: () => void; dispose: () => void }

// 모델을 host 안에 올린다. WebGL 이 없거나 모델을 못 받으면 null(포스터가 그대로 남는다). isDead: 기다리는 동안 장면이 되돌려졌는가. isPaused: 지금 그리지 말아야 하는가.
async function mountModel(host: HTMLElement, model: ModelSlot, isDead: () => boolean, isPaused: () => boolean): Promise<Mounted | null> {
  const { THREE, GLTFLoader, DRACOLoader, RoomEnvironment } = await loadThree()
  if (isDead()) return null
  let renderer: Three
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" })
  } catch {
    return null
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envTarget.texture // 제품 사진 같은 반사광(PBR 재질이 이것을 받는다)
  const draco = new DRACOLoader().setDecoderPath(model.dracoPath ?? "/draco/")
  const loader = new GLTFLoader().setDRACOLoader(draco)
  const free = () => {
    draco.dispose()
    pmrem.dispose()
    envTarget.dispose()
    scene.traverse((o: Three) => {
      o.geometry?.dispose?.()
      for (const m of [o.material].flat().filter(Boolean)) {
        for (const v of Object.values(m)) if (v && (v as Three).isTexture) (v as Three).dispose()
        m.dispose?.()
      }
    })
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }
  let gltf: Three
  try {
    gltf = await loader.loadAsync(model.src)
  } catch {
    free()
    return null
  }
  if (isDead()) {
    free()
    return null
  }
  // 모델 맞춤: 발바닥이 y=0, 가운데가 x·z=0, 가장 긴 변이 2.2.
  const obj: Three = gltf.scene
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const k = 2.2 / Math.max(size.x, size.y, size.z, 1e-6)
  obj.scale.setScalar(k)
  const fitted = new THREE.Box3().setFromObject(obj)
  const center = fitted.getCenter(new THREE.Vector3())
  obj.position.set(-center.x, -fitted.min.y, -center.z)
  obj.traverse((o: Three) => {
    if (o.isMesh) o.castShadow = true
  })
  const pivot = new THREE.Group()
  pivot.add(obj)
  scene.add(pivot)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.3 })) // 접지 그림자 — 바닥은 투명하고 그림자만 그린다
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(2.8, 5.5, 3.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(512, 512)
  sun.shadow.radius = 5
  sun.shadow.bias = -0.0004
  Object.assign(sun.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 0.5, far: 14 })
  scene.add(sun)
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)
  camera.position.set(0, 1.9, 6.6)
  camera.lookAt(0, 0.95, 0)

  const pose: Pose = { tx: 0, ty: 0, x: 0, y: 0, reveal: 0 }
  let frame = 0
  let alive = true
  let spin = 0
  let last = 0
  const draw = (now: number) => {
    frame = 0
    if (!alive) return
    // 턴테이블은 멈춤 신호(화면 밖·탭 숨김·정지 단추) 동안 서고, 포인터 기울임은 사용자의 움직임이라 멈춘 동안에도 그린다. 그릴 것이 없으면 다음 프레임을 부르지 않는다 — wake() 가 다시 깨운다.
    const spinning = !isPaused()
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
    if (spinning) spin += SPIN * dt
    pose.x += (pose.tx - pose.x) * Math.min(1, (dt || 0.016) * 6)
    pose.y += (pose.ty - pose.y) * Math.min(1, (dt || 0.016) * 6)
    pivot.rotation.y = spin + pose.reveal + pose.x * TILT.yaw
    pivot.rotation.x = pose.y * TILT.pitch
    renderer.render(scene, camera)
    const settling = Math.abs(pose.tx - pose.x) > 0.002 || Math.abs(pose.ty - pose.y) > 0.002
    last = spinning || settling ? now : 0
    if (spinning || settling) frame = requestAnimationFrame(draw)
  }
  const wake = () => {
    if (alive && !frame) frame = requestAnimationFrame(draw)
  }
  const fit = () => {
    const w = host.clientWidth, hgt = host.clientHeight
    if (!w || !hgt) return
    renderer.setSize(w, hgt, false)
    camera.aspect = w / hgt
    camera.updateProjectionMatrix()
    wake()
  }
  host.appendChild(renderer.domElement)
  const ro = new ResizeObserver(fit)
  ro.observe(host)
  fit()
  const dispose = () => {
    alive = false
    if (frame) cancelAnimationFrame(frame)
    ro.disconnect()
    free()
  }
  return { pose, wake, dispose }
}

export function HeroObject3dOrbit({ copy, locale, id = "hero", className, media, model, techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroObject3dOrbitProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const [live, setLive] = React.useState(false)
  const reduced = useReducedMotion()
  const loop = useLoopPause()
  const mode = model ? "model" : media ? "parallax" : "poster"
  const poster = model?.poster ?? media
  useEdgeGround(stageRef, poster?.src) // 포스터 가장자리 평균색 → 무대 바탕 변수(세 모드 공통 — 읽기는 한가할 때, 실패하면 레시피 테마색)
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장 ──
    kineticType(s, q(".o3-title"), { mode: "rise", by: "words", at: 0 })
    rise(s, s.q(".o3-copy > *"), { at: 0.45, y: 16, stagger: 0.08 })
    // ── 스크롤: 무대가 가라앉는다 ──
    const tl = scrubTimeline(s)
    tl.to(q(".o3-stage-s"), { yPercent: 6 * s.scale.depth }, 0)
    const surface = q(".o3-stage")
    // ── ② 2.5D: 원본 이미지 한 장 + 포인터 기울임(고운 포인터 겹에서만). 동작 줄이기·M0 는 이 build 가 불리지 않아 정지한다. ──
    if (mode === "parallax" && surface) {
      const img = q(".o3-poster-fade"), glare = q(".o3-glare")
      if (img) {
        gsap.set(img, { transformPerspective: 900, scale: 1.06 })
        tl.to(img, { scale: 1.06 + 0.06 * s.scale.depth, yPercent: -2 * s.scale.depth }, 0)
      }
      s.pointer((p) => {
        if (!img) return
        const rx = gsap.quickTo(img, "rotationX", { duration: 0.7, ease: "power3.out" }), ry = gsap.quickTo(img, "rotationY", { duration: 0.7, ease: "power3.out" })
        const gx = glare ? gsap.quickTo(glare, "xPercent", { duration: 0.6, ease: "power3.out" }) : null
        const move = (e: PointerEvent) => {
          const r = surface.getBoundingClientRect()
          const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1
          ry(nx * 6 * s.scale.depth); rx(-ny * 4 * s.scale.depth); gx?.(nx * 40)
        }
        const leave = () => { ry(0); rx(0); gx?.(0) }
        surface.addEventListener("pointermove", move)
        surface.addEventListener("pointerleave", leave)
        p.onCleanup(() => { surface.removeEventListener("pointermove", move); surface.removeEventListener("pointerleave", leave); gsap.set([img, glare].filter(Boolean), { clearProps: "transform" }) })
      })
    }
    // ── ① 3D 모델: 등장이 끝난 뒤 브라우저가 한가할 때 올린다. 장면이 안 서는 갈래(동작 줄이기·M0)는 이 build 가 불리지 않아 three 를 내려받지 않는다. ──
    if (mode !== "model" || !model) return
    let dead = false
    let mounted: Mounted | null = null
    let cancelIdle: (() => void) | null = null
    let unpause: MutationObserver | null = null
    s.onCleanup(() => {
      dead = true
      cancelIdle?.()
      unpause?.disconnect()
      mounted?.dispose()
      mounted = null
      setLive(false)
    })
    s.afterEnter(() => {
      const host = q(".o3-canvas")
      if (!host || !surface) return
      const paused = () => s.root.hasAttribute("data-wf-paused") || s.root.hasAttribute("data-wf-user-paused")
      const start = () => {
        void mountModel(host, model, () => dead, paused).then((m) => {
          if (!m || dead) { m?.dispose(); return }
          mounted = m
          // 3D 가 올라오면 모델이 한 번 돌아 앉는다(1.4초, 한 번만).
          m.pose.reveal = -1.1
          s.add(() => gsap.to(m.pose, { reveal: 0, duration: 1.4, ease: "expo.out", onUpdate: m.wake }))
          // 멈춤 신호(화면 밖·탭 숨김·정지 단추)가 풀리면 다시 그린다 — 장면 훅이 뿌리의 data-wf-paused 를 켜고 끈다.
          unpause = new MutationObserver(m.wake)
          unpause.observe(s.root, { attributes: true, attributeFilter: ["data-wf-paused", "data-wf-user-paused"] })
          m.wake()
          setLive(true)
        }, () => {})
      }
      if (window.requestIdleCallback) {
        const handle = window.requestIdleCallback(start, { timeout: 2000 })
        cancelIdle = () => window.cancelIdleCallback(handle)
      } else {
        const handle = window.setTimeout(start, 300)
        cancelIdle = () => window.clearTimeout(handle)
      }
    })
    // 고운 포인터(마우스)의 약한 기울임 — 터치는 달지 않는다(세로 스크롤을 가로채지 않는다).
    s.pointer((p) => {
      if (!surface) return
      const move = (e: PointerEvent) => {
        if (!mounted) return
        const r = surface.getBoundingClientRect()
        mounted.pose.tx = ((e.clientX - r.left) / r.width) * 2 - 1
        mounted.pose.ty = ((e.clientY - r.top) / r.height) * 2 - 1
        mounted.wake()
      }
      const leave = () => {
        if (!mounted) return
        mounted.pose.tx = mounted.pose.ty = 0
        mounted.wake()
      }
      surface.addEventListener("pointermove", move)
      surface.addEventListener("pointerleave", leave)
      p.onCleanup(() => { surface.removeEventListener("pointermove", move); surface.removeEventListener("pointerleave", leave) })
    })
  })
  const titleBody = <SplitSource label={copy.title}>{copy.title}</SplitSource>
  return (
    <div ref={ref} id={id} data-block="hero-object-3d-orbit" data-hero="object-3d-orbit" data-stage-mode={mode} {...loop.rootProps} className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="flex flex-col gap-8 px-5 py-12 md:px-10 md:py-16 hero-first">
        {Display ? (
          <Display as="h1" className="text-balance o3-title">
            {titleBody}
          </Display>
        ) : (
          <h1 className="text-[clamp(2.75rem,8vw,7.5rem)] leading-[0.95] tracking-[-0.03em] text-balance o3-title font-heading">{titleBody}</h1>
        )}
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <div data-enter="keep" className="flex flex-col gap-6 lg:col-span-5 o3-copy">
            <p className="max-w-[36rem] text-lg leading-[1.6]">{copy.lede}</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />}>
                {copy.primaryCta.label}
              </Button>
              {copy.secondaryCta ? (
                <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />}>
                  {copy.secondaryCta.label}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="relative flex flex-col gap-4 lg:col-span-7">
            <div className="relative o3-stage-s">
              {/* 무대: 포스터(모델의 포스터 또는 2.5D 원본 이미지)가 첫 칠(우선 받기) · 3D 캔버스는 칠 뒤에 .o3-canvas 안으로 들어온다. 무대 전체가 하나의 그림이다(읽기 도구는 한 줄). */}
              <div ref={stageRef} role="img" aria-label={model?.alt || copy.stageLabel} data-live={live ? "" : undefined} data-reduced={reduced ? "" : undefined} data-mode={mode} className="relative aspect-[4/3] touch-pan-y overflow-clip rounded-xl [background-color:var(--o3-ground,var(--muted))] motion-safe:[transition:background-color_var(--duration-enter)_var(--ease-standard)] shadow-(--wf-shadow-surface) md:aspect-[16/11] [&[data-live]_.o3-poster-fade]:opacity-0 [&[data-live]_.o3-canvas]:opacity-100 [&_.o3-canvas_canvas]:block [&_.o3-canvas_canvas]:size-full o3-stage">
                {/* 포스터: keep 칸(첫 칠부터 보인다) 안의 안쪽 칸이 3D 가 올라오면 흐려진다 — 등장 대상(data-enter) 자신의 불투명도는 건드리지 않는다. */}
                <div data-enter="keep" className="absolute inset-0 o3-poster">
                  <div className="size-full [transition:opacity_var(--duration-enter)_var(--ease-standard)] [&_picture]:block [&_picture]:size-full o3-poster-fade">{poster ? <MediaImage locale={locale} m={poster} sizes="(min-width: 1024px) 56vw, 100vw" priority badge={false} /> : <span className="flex size-full items-center justify-center p-4 text-center text-base leading-[1.4] text-muted-foreground [background-color:var(--o3-ground,var(--muted))]">{copy.emptyLabel ? <span className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{copy.emptyLabel}</span> : null}</span>}</div>
                  {mode === "parallax" ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_20%,var(--background),transparent)] opacity-[0.14] mix-blend-soft-light o3-glare" /> : null}
                </div>
                <div aria-hidden="true" className="absolute inset-0 opacity-0 [transition:opacity_var(--duration-enter)_var(--ease-standard)] o3-canvas" />
              </div>
              <MediaPreviewBadge m={poster} />
            </div>
            {live && copy.pauseLabel ? (
              <div className="flex items-center gap-4">
                <LoopPause paused={loop.paused} onToggle={loop.toggle} label={copy.pauseLabel} />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
