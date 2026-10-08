// factory/scripts/stamp-media.test.mjs — P3-3 Task 8 미디어(05-media).
// 실사 필수 칸은 스톡으로 대신하지 않는다 · Pexels 녹화 응답으로 manifest·credits(public/media 와 같은 모양) · 키가 없으면 doctor 문장 그대로.
// 네트워크는 부르지 않는다(녹화 응답 + 가짜 fetch). sharp 는 합성 그림 하나로 실제로 돈다. 영상 인코딩(ffmpeg)은 buildVideo 주입으로 대신한다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { existsSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { mediaPlan, fetchMedia, pickPhoto, aspectRatio, PLACEHOLDER_LABEL, REQUEST_FILE } from "../stamp/media.mjs"
import { runDoctor } from "../doctor.mjs"
import { overBudget, OUT_DIR } from "../media/build-media.mjs"
import { SRC_DIR, LICENSE_URL } from "../media/fetch-pexels.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"))
const sharp = createRequire(join(ROOT, "package.json"))("sharp")
const SEARCH = readJson("factory/scripts/fixtures/stamp-media/pexels-search.json")
const SOURCES = readJson("factory/media/media-sources.json")
const KEY = "test-pexels-key-Zq81"

// 원형 조각(Task 1 모양 — imageSlots.source 는 real-required·stock-ok·generated-ok·none).
const arch = {
  id: "local",
  pages: [
    { id: "home", route: "/", sections: [
      { kind: "hero", imageSlots: [{ id: "hero", aspect: "16:9", source: "real-required" }] },
      { kind: "gallery", imageSlots: [{ id: "space", aspect: "16:9", source: "stock-ok" }, { id: "icon", aspect: "1:1", source: "none" }] },
      { kind: "story", imageSlots: [{ id: "mood", aspect: "16:9", source: "generated-ok" }] },
    ] },
    { id: "about", route: "/about", sections: [{ kind: "team", imageSlots: [{ id: "portrait", aspect: "4:5", source: "real-required" }] }] },
  ],
}
const cand = { id: "a", slot: "safe", source: "library", recipe: "r5-celadon" }

// 가짜 fetch: 검색 주소 → 녹화 응답, 사진 주소 → 합성 JPEG. 부른 주소를 모두 남긴다.
async function fakePexels() {
  const jpeg = await sharp({ create: { width: 2400, height: 1350, channels: 3, background: "#7a6a58" } }).jpeg({ quality: 80 }).toBuffer()
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), auth: init.headers?.Authorization ?? null })
    if (String(url).startsWith("https://api.pexels.com/v1/search")) return new Response(JSON.stringify(SEARCH), { status: 200, headers: { "content-type": "application/json" } })
    if (String(url).startsWith("https://images.pexels.com/")) return new Response(jpeg, { status: 200 })
    return new Response("not found", { status: 404 })
  }
  return { fetch, calls }
}

test("plan: real-required without an owner file becomes a placeholder, never stock; none is skipped", () => {
  const plan = mediaPlan(arch, { locale: "ko" }, cand)
  const by = Object.fromEntries(plan.map((r) => [r.slot, r]))
  assert.deepEqual(plan.map((r) => r.slot), ["home/hero/hero", "home/gallery/space", "home/story/mood", "about/team/portrait"])
  for (const k of ["home/hero/hero", "about/team/portrait"]) {
    assert.equal(by[k].source, "placeholder", k)
    assert.equal(by[k].label, "실제 사진 필요")
    assert.equal(by[k].query, undefined, `${k} must not carry a stock query`)
  }
  assert.equal(by["home/gallery/space"].source, "pexels")
  assert.ok(by["home/gallery/space"].query)
  assert.equal(by["home/story/mood"].source, "higgsfield")
  assert.equal(by["home/hero/hero"].aspect, "16:9")
  assert.equal(mediaPlan(arch, { locale: "en" }, cand)[0].label, PLACEHOLDER_LABEL.en)
  // 콘텐츠가 검색어를 적어도 실사 필수 칸은 스톡이 되지 않는다.
  assert.equal(mediaPlan(arch, { media: { "home/hero/hero": { query: "cozy shop front" } } }, cand)[0].source, "placeholder")
})

test("plan: an owner file in the content fills a real-required slot as brand; sitemap limits the slots", () => {
  const content = { locale: "ko", media: { "home/hero/hero": { file: "D:/owner/shop-front.jpg" }, "home/gallery/space": { query: "ceramic studio shelves" } } }
  const plan = mediaPlan(arch, content, cand, { sitemap: { pages: [{ id: "home", sections: [{ kind: "hero" }, { kind: "gallery" }] }] } })
  assert.deepEqual(plan.map((r) => [r.slot, r.source]), [["home/hero/hero", "brand"], ["home/gallery/space", "pexels"]])
  assert.equal(plan[0].file, "D:/owner/shop-front.jpg")
  assert.equal(plan[1].query, "ceramic studio shelves")
})

test("plan: unknown image source is an error (legacy real-preferred must be converted by the archetype step)", () => {
  const bad = { id: "x", pages: [{ id: "home", sections: [{ kind: "hero", imageSlots: [{ id: "h", aspect: "16:9", source: "real-preferred" }] }] }] }
  assert.throws(() => mediaPlan(bad, {}, cand), /real-preferred/)
})

test("fetch: recorded Pexels response → manifest and credits in the public/media shape, placeholders listed, budgets hold", { skip: "the public export ships no media files and an empty media manifest (third-party redistribution terms unconfirmed)" }, async () => {
  const out = await mkdtemp(join(tmpdir(), "media-"))
  const hf = await mkdtemp(join(tmpdir(), "hf-"))
  const { fetch, calls } = await fakePexels()
  const plan = mediaPlan(arch, { locale: "ko", media: { "home/gallery/space": { query: "ceramic studio shelves" } } }, cand)
  const { manifest, credits, requests } = await fetchMedia(plan, out, { fetch, readSecret: () => KEY, sharp, higgsfieldDir: hf, now: () => "2026-09-30T00:00:00Z" })

  // 스톡 호출은 stock-ok 칸 하나뿐 — 실사 필수 칸 둘은 Pexels 를 부르지 않는다.
  assert.equal(calls.filter((c) => c.url.includes("/v1/search")).length, 1)
  assert.equal(calls.filter((c) => c.url.startsWith("https://images.pexels.com/")).length, 1)
  assert.ok(calls.filter((c) => c.url.includes("/v1/search")).every((c) => c.auth === KEY))

  // 모양: 저장소 public/media 의 이미지 자산·출처 줄과 키가 같다.
  const pub = readJson("public/media/manifest.json").assets.find((a) => a.kind === "image")
  const pubCredit = readJson("public/media/credits.json")[0]
  assert.equal(manifest.assets.length, 1)
  const a = manifest.assets[0]
  assert.deepEqual(Object.keys(a).sort(), Object.keys(pub).sort())
  assert.deepEqual([a.recipe, a.slot, a.kind, a.source], ["r5-celadon", "home/gallery/space", "image", "pexels"])
  assert.deepEqual(a.widths, [1440, 960, 480])
  for (const f of a.files) assert.equal(statSync(join(out, f.file)).size, f.bytes, f.file)
  assert.deepEqual(overBudget(manifest.assets), [])
  assert.ok(a.files.find((f) => f.role === "still-max").bytes <= 250 * 1024)
  assert.equal(credits.length, 1)
  // 05 출처 줄은 공개 credits 모양 + 검색어(query — 사람이 사진이 주제에 맞는지 보게, FINAL-WF2 AB2)
  assert.deepEqual(Object.keys(credits[0]).sort(), [...Object.keys(pubCredit), "query"].sort())
  assert.ok(credits[0].query && typeof credits[0].query === "string")
  // 녹화 응답에서 사람 없고 16:9 에 가장 가까운 사진(3094041)을 고른다.
  assert.equal(credits[0].url, SEARCH.photos.find((p) => p.id === 3094041).url)
  assert.deepEqual([credits[0].source, credits[0].licenseUrl, credits[0].file], ["pexels", LICENSE_URL, a.files[0].file])

  // 실사 필수 칸은 「실제 사진 필요」 틀, 생성 칸은 파일이 없어 요청 파일로.
  assert.deepEqual(manifest.placeholders.map((p) => [p.slot, p.reason, p.label]), [
    ["home/hero/hero", "real-required", "실제 사진 필요"],
    ["home/story/mood", "generate-pending", PLACEHOLDER_LABEL.pending.ko],
    ["about/team/portrait", "real-required", "실제 사진 필요"],
  ])
  assert.deepEqual(requests.map((r) => r.slot), ["home/story/mood"])
  assert.deepEqual(JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")), manifest)
  assert.deepEqual(JSON.parse(readFileSync(join(out, "credits.json"), "utf8")), credits)
  assert.equal(JSON.parse(readFileSync(join(out, REQUEST_FILE), "utf8")).requests[0].slot, "home/story/mood")

  // 기본 출력 폴더는 그대로(public/media · .tmp/media-src).
  assert.equal(OUT_DIR, join(ROOT, "public", "media"))
  assert.equal(SRC_DIR, join(ROOT, ".tmp", "media-src"))
})

test("fetch: an existing Higgsfield file becomes a video asset with the owner-generated license; a named file that is missing is an error", async () => {
  const out = await mkdtemp(join(tmpdir(), "media-"))
  const hf = await mkdtemp(join(tmpdir(), "hf-"))
  await writeFile(join(hf, "r9-A-cookies.mp4"), "fake")
  await writeFile(join(hf, "credits.json"), JSON.stringify([{ file: "r9-A-cookies.mp4", job: "job-1", model: "kling", credits: 14, slot: "x", created: "2026-09-28" }]))
  const built = []
  const buildVideo = async (_sharp, src, recipe, slot, o) => {
    built.push({ src, recipe, slot, outDir: o.outDir })
    return { width: 1440, height: 810, widths: [1440], video: { mp4: `${recipe}/${slot}.mp4`, webm: `${recipe}/${slot}.webm`, width: 1920, duration: 8 }, files: [{ file: `${recipe}/${slot}.mp4`, bytes: 1000, role: "mp4" }] }
  }
  const content = { locale: "ko", media: { "home/story/mood": { higgsfield: "r9-A-cookies.mp4" } } }
  const plan = mediaPlan(arch, content, cand).filter((r) => r.source !== "pexels")
  const { manifest, credits, requests } = await fetchMedia(plan, out, { readSecret: () => null, sharp, higgsfieldDir: hf, buildVideo })
  assert.equal(built.length, 1)
  assert.equal(built[0].src, join(hf, "r9-A-cookies.mp4"))
  assert.equal(built[0].outDir, out)
  assert.deepEqual(requests, [])
  assert.equal(existsSync(join(out, REQUEST_FILE)), false)
  const v = manifest.assets[0]
  assert.deepEqual([v.kind, v.source, v.slot], ["video", "higgsfield", "home/story/mood"])
  assert.deepEqual([credits[0].source, credits[0].url, credits[0].license, credits[0].licenseUrl], ["higgsfield", "higgsfield:job/job-1", "생성물 — 운영자 계정 Higgsfield 생성(2026-09-28)", SOURCES.higgsfieldLicenseUrl])

  const missing = mediaPlan(arch, { media: { "home/story/mood": { higgsfield: "nope.mp4" } } }, cand).filter((r) => r.source === "higgsfield")
  await assert.rejects(fetchMedia(missing, out, { readSecret: () => null, sharp, higgsfieldDir: hf, buildVideo }), /nope\.mp4/)
})

test("fetch: no PEXELS_API_KEY → the doctor's message verbatim; plans without stock slots still run (control)", async () => {
  const doctor = await runDoctor("media", { readSecret: () => null, isDir: () => true })
  const expected = doctor.results.find((r) => r.id === "PEXELS_API_KEY").message
  const out = await mkdtemp(join(tmpdir(), "media-"))
  const plan = mediaPlan(arch, {}, cand)
  let fetched = 0
  await assert.rejects(fetchMedia(plan, out, { readSecret: () => null, fetch: async () => (fetched++, new Response("{}")), sharp }), (e) => e.message === expected)
  assert.equal(fetched, 0)
  const noStock = plan.filter((r) => r.source === "placeholder")
  const { manifest } = await fetchMedia(noStock, out, { readSecret: () => null, sharp })
  assert.equal(manifest.placeholders.length, 2)
})

test("fetch: Pexels failures never leak the key", async () => {
  const out = await mkdtemp(join(tmpdir(), "media-"))
  const plan = mediaPlan(arch, {}, cand).filter((r) => r.source === "pexels")
  const echo = async (url, init) => new Response(`bad key ${init.headers.Authorization}`, { status: 401, statusText: `Unauthorized ${init.headers.Authorization}` })
  await assert.rejects(fetchMedia(plan, out, { readSecret: () => KEY, fetch: echo, sharp }), (e) => !e.message.includes(KEY) && /401/.test(e.message))
  const thrower = async () => { throw new Error(`socket closed for ${KEY}`) }
  await assert.rejects(fetchMedia(plan, out, { readSecret: () => KEY, fetch: thrower, sharp }), (e) => !e.message.includes(KEY) && e.message.includes("***"))
})

test("pick: people and small photos sink; recipe hue breaks ties between equal-aspect photos; used ids are skipped", () => {
  const p = (id, avg, alt = "shelf", width = 3000, height = 2000) => ({ id, width, height, alt, avg_color: avg, photographer: "p", url: `u${id}`, src: { original: `o${id}` } })
  const photos = [p(1, "#8a8a8a", "a woman at a shelf"), p(2, "#b04a3a"), p(3, "#3a6ab0"), p(4, "#3a6ab0", "shelf", 900, 600)]
  assert.equal(pickPhoto(photos, { aspect: 1.5 }).id, 2)
  assert.equal(pickPhoto(photos, { aspect: 1.5, hue: 260 }).id, 3)
  assert.equal(pickPhoto(photos, { aspect: 1.5, exclude: new Set([2, 3]) }).id, 4)
  assert.equal(pickPhoto([], {}), null)
  assert.equal(aspectRatio("16:9").toFixed(3), "1.778")
  assert.equal(aspectRatio("860x1000-1200").toFixed(3), (860 / 1100).toFixed(3))
  assert.equal(aspectRatio(null), null)
})

test("plan: a generated candidate's recipe primary hue rides on stock rows", () => {
  const head = { color: { light: { primary: "oklch(0.55 0.2 262)" } } }
  const row = mediaPlan(arch, {}, { ...cand, recipe: { ...head, id: "gen-a" } }).find((r) => r.source === "pexels")
  assert.equal(row.hue, 262)
  assert.equal(row.recipe, "gen-a")
  assert.equal(mediaPlan(arch, {}, cand).find((r) => r.source === "pexels").hue, null)
})

// 폴더 준비 도우미가 필요 없게 fetchMedia 가 outDir 을 만든다.
test("fetch: creates the output folder", async () => {
  const out = join(await mkdtemp(join(tmpdir(), "media-")), "deep", "05-media")
  const plan = mediaPlan(arch, {}, cand).filter((r) => r.source === "placeholder")
  await fetchMedia(plan, out, { readSecret: () => null, sharp })
  assert.ok(existsSync(join(out, "manifest.json")))
})
