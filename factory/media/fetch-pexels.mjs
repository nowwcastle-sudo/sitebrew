// Pexels 원본 가져오기(Task 12 — 미디어 채우기): 히어로의 사진·영상 칸을 채울 원본을 찾아 받는다.
//   node factory/media/fetch-pexels.mjs search --kind photos|videos --query "<검색어>" [--orientation landscape|portrait|square] [--size large|medium|small] [--n 10] [--min-duration <초 — 영상만, 짧은 후보는 뺀다>]
//     → 후보 목록(id · 크기 · 설명 · 작가 · 페이지 주소)을 찍는다. 사람이 보이는 후보는 뒤로 민다(설명에 사람 낱말 — PEOPLE).
//   node factory/media/fetch-pexels.mjs get --kind photos|videos --id <pexels id> --recipe <레시피 id> --slot <칸 이름> [--min-duration <초>] [--max-width <px — 영상, 기본 1920: 4K 원본은 받지 않는다>] [--width <px — 사진, 줄여 받는다(05 미디어와 같은 compress 주소). 기본은 원본>] [--out <폴더> — 기본 .tmp/media-src]
//     → 원본을 .tmp/media-src/<recipe>/<slot>.<jpg|mp4>(gitignore)에 받고, 옆에 출처 기록 <slot>.json 을 쓴다(build-media.mjs 가 credits.json 으로 옮긴다).
// 키: 환경 변수 PEXELS_API_KEY. 없을 때 Windows 사용자 환경 대체 읽기는 FACTORY_USER_ENV=1 일 때만 한다(공개판 기본 꺼짐).
//   키는 어디에도 찍지 않는다 — 로그·오류·기록 파일 어디에도(오류 문장은 redact 를 거친다). 인증 머리는 키 그대로(Pexels API 규약).
// 라이선스: Pexels License(https://www.pexels.com/license/) — 상업 무료·출처 표기 의무 없음. 그래도 출처를 credits.json 에 남긴다.
//   사람이 알아볼 수 있게 나오는 사진은 피하고(PEOPLE), 추천·보증으로 읽히게 쓰지 않는다.
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { readSecret } from '../lib/secret-env.mjs'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SRC_DIR = join(ROOT, '.tmp', 'media-src')
export const API = 'https://api.pexels.com'
export const LICENSE = 'Pexels License'
export const LICENSE_URL = 'https://www.pexels.com/license/'
// 설명(alt)에 이 낱말이 있으면 사람이 나오는 사진으로 보고 뒤로 민다(빼지는 않는다 — 후보가 모자랄 때 사람이 고른다).
export const PEOPLE = /\b(man|men|woman|women|person|people|girl|boy|child|children|kid|kids|lady|guy|couple|family|portrait|model|hands?|face|worker|crowd|tourists?|selfie|welders?|workers?|artists?)\b/i

// 검색 주소(순수).
export function searchUrl({ kind = 'photos', query, orientation, size, perPage = 15, page = 1, locale }) {
  if (!query) throw new Error('query 가 비었다')
  if (!['photos', 'videos'].includes(kind)) throw new Error(`kind 는 photos|videos: ${kind}`)
  const p = new URLSearchParams({ query, per_page: String(perPage), page: String(page) })
  if (orientation) p.set('orientation', orientation)
  if (size) p.set('size', size)
  if (locale) p.set('locale', locale) // ko-KR 등 — Pexels 검색 API 의 locale 매개변수(한국어 주제어를 그대로 검색)
  return `${API}${kind === 'photos' ? '/v1/search' : '/videos/search'}?${p}`
}
export const itemUrl = (kind, id) => `${API}${kind === 'photos' ? '/v1/photos' : '/videos/videos'}/${Number(id)}`

// 사진 받을 주소(순수): width 가 0 이면 원본, 아니면 Pexels 가 줄여 주는 compress 주소(05 미디어 fetchMedia 와 같은 쿼리).
export const photoLink = (item, width = 0) => (width ? `${item.src?.original}?auto=compress&cs=tinysrgb&w=${Number(width)}` : item.src?.original)

// 후보 한 줄(순수): Pexels 응답 항목 → 고르기에 필요한 것만.
export function candidate(kind, x) {
  if (kind === 'photos') return { id: x.id, width: x.width, height: x.height, alt: x.alt ?? '', author: x.photographer, authorUrl: x.photographer_url, url: x.url, avg: x.avg_color ?? null, people: PEOPLE.test(x.alt ?? '') }
  const desc = (x.url ?? '').split('/').filter(Boolean).at(-1)?.replace(/-\d+$/, '').replace(/-/g, ' ') ?? ''
  return { id: x.id, width: x.width, height: x.height, duration: x.duration, alt: desc, author: x.user?.name, authorUrl: x.user?.url, url: x.url, people: PEOPLE.test(desc) }
}

// 영상 길이가 최소보다 짧은가(순수) — 길이를 모르는 후보(사진)는 짧다고 보지 않는다.
export const tooShort = (c, minDuration) => Boolean(minDuration) && c.duration != null && c.duration < minDuration

// 영상 후보 거르기(순수): 최소 길이보다 짧은 것을 뺀다(8초 히어로 영상의 원본은 8초 이상이어야 한다).
export const filterMinDuration = (list, minDuration) => (minDuration ? list.filter((c) => !tooShort(c, minDuration)) : list)

// 후보 정렬(순수): 사람 없는 것 먼저 → (minDuration 을 주면) 짧은 것 뒤로 → 최소 폭을 넘는 것 먼저 → 원하는 가로:세로 비에 가까운 순.
export function rankCandidates(list, { minWidth = 1440, aspect = null, minDuration = 0 } = {}) {
  const off = (c) => (aspect ? Math.abs(Math.log(c.width / c.height / aspect)) : 0)
  return [...list].sort((a, b) => Number(a.people) - Number(b.people) || Number(tooShort(a, minDuration)) - Number(tooShort(b, minDuration)) || Number(a.width < minWidth) - Number(b.width < minWidth) || off(a) - off(b))
}

// 영상 파일 고르기(순수): mp4 가운데 maxWidth(기본 제한 없음 — 옛 호출 그대로) 이하만 보고, 목표 폭 이상에서 가장 작은 것, 없으면 가장 큰 것.
// 전부 maxWidth 보다 크면(4K 만 있는 영상) 가장 작은 것 — 가능하면 언제나 maxWidth 이하를 받는다.
export function pickVideoFile(files, { minWidth = 1920, maxWidth = Infinity } = {}) {
  const mp4 = (files ?? []).filter((f) => f.file_type === 'video/mp4' && f.width && f.link)
  if (!mp4.length) return null
  const capped = mp4.filter((f) => f.width <= maxWidth)
  if (!capped.length) return [...mp4].sort((a, b) => a.width - b.width)[0]
  const big = capped.filter((f) => f.width >= minWidth).sort((a, b) => a.width - b.width)
  return big[0] ?? [...capped].sort((a, b) => b.width - a.width)[0]
}

/** 영상 한 건에서 받을 파일(순수): 길이가 모자라면 던진다, 폭은 VIDEO_MAX_WIDTH 이하. 05 미디어와 get 명령이 같이 쓴다. */
export const VIDEO_MAX_WIDTH = 1920
export function pickVideoDownload(item, { minDuration = 0, maxWidth = VIDEO_MAX_WIDTH } = {}) {
  if (tooShort({ duration: item.duration }, minDuration)) throw new Error(`영상이 ${minDuration}초보다 짧다(${item.duration}초) — 영상 ${item.id}`)
  const f = pickVideoFile(item.video_files, { minWidth: maxWidth, maxWidth })
  if (!f) throw new Error(`받을 mp4 가 없다 — 영상 ${item.id}`)
  return f
}

// 출처 기록(순수) — build-media.mjs 가 credits.json 한 줄로 옮긴다.
export function sourceRecord({ kind, item, recipe, slot, file, fetchedAt = new Date().toISOString() }) {
  const c = candidate(kind, item)
  return { recipe, slot, source: 'pexels', kind: kind === 'photos' ? 'image' : 'video', pexelsId: c.id, url: c.url, author: c.author, authorUrl: c.authorUrl, alt: c.alt, width: c.width, height: c.height, license: LICENSE, licenseUrl: LICENSE_URL, file, fetchedAt }
}

// 키를 문장에서 지운다(오류 문장·응답 본문이 키를 되돌려 줄 때를 막는다).
export const redact = (s, key) => (key ? String(s).split(key).join('[redacted]') : String(s))

async function api(url, key) {
  const r = await fetch(url, { headers: { Authorization: key } })
  if (!r.ok) throw new Error(redact(`Pexels ${r.status} ${r.statusText} — ${url}`, key))
  return r.json()
}

async function download(url, file) {
  mkdirSync(dirname(file), { recursive: true })
  const r = await fetch(url)
  if (!r.ok || !r.body) throw new Error(`받기 실패 ${r.status} — ${url}`)
  await pipeline(Readable.fromWeb(r.body), createWriteStream(file))
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const [cmd, ...argv] = process.argv.slice(2)
  const flag = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
  const kind = flag('--kind', 'photos')
  const outDir = flag('--out') ? resolve(flag('--out')) : SRC_DIR
  const key = readSecret('PEXELS_API_KEY')
  try {
    if (!key) throw new Error('PEXELS_API_KEY 가 없다(프로세스 환경·Windows 사용자 환경)')
    if (cmd === 'search') {
      const res = await api(searchUrl({ kind, query: flag('--query'), orientation: flag('--orientation'), size: flag('--size'), perPage: Number(flag('--n', 15)) }), key)
      const minDuration = Number(flag('--min-duration', 0))
      const list = filterMinDuration(rankCandidates((res[kind] ?? []).map((x) => candidate(kind, x)), { minWidth: Number(flag('--min-width', 1440)), aspect: flag('--aspect') ? Number(flag('--aspect')) : null, minDuration }), kind === 'videos' ? minDuration : 0)
      for (const c of list) console.log(`${c.people ? '사람? ' : ''}${c.id}\t${c.width}x${c.height}${c.duration ? `\t${c.duration}s` : ''}\t${c.author}\t${c.alt}\t${c.url}`)
      console.log(`후보 ${list.length}개(전체 ${res.total_results ?? '?'})`)
    } else if (cmd === 'get') {
      const id = flag('--id'), recipe = flag('--recipe'), slot = flag('--slot')
      if (!id || !recipe || !slot) throw new Error('get 은 --id --recipe --slot 이 필요하다')
      const item = await api(itemUrl(kind, id), key)
      const link = kind === 'photos' ? photoLink(item, Number(flag('--width', 0))) : pickVideoDownload(item, { minDuration: Number(flag('--min-duration', 0)), maxWidth: Number(flag('--max-width', VIDEO_MAX_WIDTH)) }).link
      if (!link) throw new Error(`받을 파일이 없다 — ${kind} ${id}`)
      const file = join(outDir, recipe, `${slot}.${kind === 'photos' ? 'jpg' : 'mp4'}`)
      await download(link, file)
      const rec = sourceRecord({ kind, item, recipe, slot, file: relative(ROOT, file).replace(/\\/g, '/') })
      writeFileSync(join(outDir, recipe, `${slot}.json`), JSON.stringify(rec, null, 2) + '\n')
      console.log(`받음 ${rec.file} (${rec.width}x${rec.height}, ${rec.author}) — ${rec.url}`)
    } else {
      throw new Error('명령: search | get')
    }
  } catch (e) {
    console.error(`도구 실패: ${redact(e.message, key)}`)
    process.exitCode = 1
  }
}
