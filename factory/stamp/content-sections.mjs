// 06-pages 본문 섹션(대장 C70, 레인 CONTENT) — 원형 noBlock.mode content·part 섹션을 콘텐츠로 그린다.
//   원형 JSON 의 섹션 noBlock.render(렌더러 + 콘텐츠 자리 + 머리 이름표)를 읽어 블록 kind `content` 의 렌더러(block-content-<as>) props 를 만든다.
//   · 값은 모두 콘텐츠 $ref(사이트 content/site.json 자리) — 블록과 같은 묶기(J9). 생성기가 쓰는 글자는 UI 이름표(머리·단위·쪽 이름표)뿐이다.
//   · 사실을 지어내지 않는다(C101·C102): 자료가 없으면 props 를 만들지 않고 까닭(why)을 돌려준다 → 06 이 「자료 연결 안 됨」 blocker.
//     렌더할 자료 칸이 스키마에 없는 섹션은 noBlock.missing 에 그 사실을 적어 두었다(→ 같은 blocker, 까닭 = missing).
//   · 실사 필수 이미지 칸에 src 가 없으면 렌더러가 「실제 사진 필요」 틀을 그리고 photos 에 칸 경로를 돌려준다 → 06 이 「실제 사진 필요」 blocker.
//   · 「확인 필요」 자리 표시만 있는 자료는 자료 없음으로 본다(공개 불가 사유는 묶이지 않은 섹션 줄 하나).
// 출처(source) 문법 — 원형 JSON render.from·lead·rows[].from·links[].from·fields 값:
//   <콘텐츠 경로>            news · caseStudies.0.challenge · shipping.fee (배열 첫 칸은 숫자 마디)
//   slot:<칸>               이 섹션의 문구 칸(<쪽>/<섹션>/<칸>)
//   slot:<섹션>/<칸>        다른 쪽의 같은 이름 섹션 문구 칸(브랜드 회사소개 미션 = 홈 미션 문구)
//   images:<칸>             콘텐츠 slots.images 중 그 칸 id 의 이미지들
//   @trail · @pages · @legal-pages · @route:<쪽>[#앵커]   사이트맵 구조(경로·쪽 이름표 — 사실 아님)
// fields 값은 항목 안 경로이고 ":<서식>"(date·year·money·days·pages)을 붙일 수 있다. "." 은 항목 자체(문자열 배열).
import { isNeedsCheck } from './needs-check.mjs'
import { at, pageLabel, ref } from './site-bind.mjs'

export const CONTENT_RENDERERS = ['prose', 'list', 'cards', 'facts', 'links', 'gallery', 'timeline', 'breadcrumb', 'skeleton']
export const CONTENT_FORMATS = ['text', 'date', 'year', 'money', 'days', 'pages']
export const rendererBlock = (as) => `block-content-${as}`

// 렌더러 이름표(UI — 콘텐츠 사실이 아니다). 단위 문장의 {n} 은 숫자 자리.
export const CONTENT_UI = {
  ko: { units: { photoNeeded: '실제 사진 필요', imagePending: '이미지 준비 중', external: '다른 사이트', days: '{n}영업일', pages: '{n}쪽' }, crumbs: '현재 위치', loading: '불러오는 중' },
  en: { units: { photoNeeded: 'Real photo needed', imagePending: 'Image in progress', external: 'external site', days: '{n} business days', pages: '{n} pages' }, crumbs: 'You are here', loading: 'Loading' },
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const usable = (v) => {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== '' && !isNeedsCheck(v)
  if (Array.isArray(v)) return v.length > 0
  return true
}
const splitField = (f) => {
  const m = /^(.*?)(?::(text|date|year|money|days|pages))?$/.exec(f)
  return { path: m[1], format: m[2] }
}
const sub = (base, path) => (path === '.' ? base : `${base}.${path}`)

/**
 * 출처 하나를 콘텐츠 자리로 푼다. 쓸 수 있는 값이 없으면 null.
 * @returns {{ type: 'path', path: string, value: unknown } | { type: 'paths', paths: string[], values: unknown[] } | { type: 'struct', name: string, arg?: string } | null}
 */
export function resolveSource(src, ctx) {
  const { content, copyIndex, key } = ctx
  if (src.startsWith('@')) {
    const [name, arg] = src.slice(1).split(':')
    return { type: 'struct', name, arg }
  }
  if (src.startsWith('slot:')) {
    const want = src.slice(5)
    let i
    if (want.includes('/')) {
      const [section, id] = want.split('/')
      for (const [k, n] of copyIndex) if (k.split('/')[1] === section && k.endsWith(`/${id}#0`)) { i = n; break }
    } else i = copyIndex.get(`${key}/${want}#0`)
    if (i === undefined) return null
    const path = `slots.copy.${i}.text`
    const value = at(content, path)
    return usable(value) ? { type: 'path', path, value } : null
  }
  if (src.startsWith('images:')) {
    const id = src.slice(7)
    const imgs = Array.isArray(content.slots?.images) ? content.slots.images : []
    const idx = imgs.map((m, i) => (m?.id === id ? i : -1)).filter((i) => i >= 0)
    return idx.length ? { type: 'paths', paths: idx.map((i) => `slots.images.${i}`), values: idx.map((i) => imgs[i]) } : null
  }
  const value = at(content, src)
  return usable(value) ? { type: 'path', path: src, value } : null
}

const firstSource = (list, ctx) => {
  for (const s of list ?? []) { const r = resolveSource(s, ctx); if (r) return r }
  return null
}

const image = (path, value, key, photos, fallbackId) => {
  if (!isObj(value)) return undefined
  if (value.source === 'real-required' && !usable(value.src)) photos.push(`${key}/${value.id ?? fallbackId}`)
  return ref(path)
}

/** 배열 출처 → 항목 자리 목록 [{ base, item }](정렬·개수 제한·빈 항목 빼기). 문자열 배열도 된다. */
function arrayItems(r, render, titleField) {
  let rows
  if (r.type === 'paths') rows = r.paths.map((base, i) => ({ base, item: r.values[i] }))
  else if (Array.isArray(r.value)) rows = r.value.map((item, i) => ({ base: `${r.path}.${i}`, item }))
  else return null
  if (titleField) rows = rows.filter(({ item }) => usable(titleField === '.' ? item : at(item, titleField)))
  if (render.sort) {
    const desc = render.sort.startsWith('-')
    const f = render.sort.replace(/^-/, '')
    rows = [...rows].sort((a, b) => { const x = String(at(a.item, f) ?? ''), y = String(at(b.item, f) ?? ''); return desc ? y.localeCompare(x, undefined, { numeric: true }) : x.localeCompare(y, undefined, { numeric: true }) })
  }
  if (render.limit) rows = rows.slice(0, render.limit)
  return rows
}

/** 항목 하나의 fields → 렌더러 항목 props. abs 면 fields 값이 출처 문법(slot: 등)이다(배열 없는 단일 항목). */
function itemProps(fields, base, item, ctx, photos, abs = false) {
  const out = {}
  const val = (f) => {
    if (abs) { const r = resolveSource(f, ctx); return r && r.type === 'path' ? { path: r.path, value: r.value } : null }
    const v = f === '.' ? item : at(item, f)
    return usable(v) || typeof v === 'boolean' ? { path: sub(base, f), value: v } : null
  }
  for (const [name, spec] of Object.entries(fields)) {
    if (name === 'href' && spec === '@case-link') {
      const cs = at(ctx.content, 'caseStudies.0.slug')
      if (cs && item?.slug === cs && ctx.routes['case-study']) out.href = ctx.routes['case-study']
      continue
    }
    if (name === 'meta') {
      const list = (Array.isArray(spec) ? spec : [spec]).map((f) => { const { path, format } = splitField(f); const v = val(path); return v ? { value: ref(v.path), ...(format ? { format } : {}), ...(format === 'money' && ctx.render.currency ? { currency: ctx.render.currency } : {}) } : null }).filter(Boolean)
      if (list.length) out.meta = list
      continue
    }
    if (name === 'image') { const v = val(spec); if (v) { const img = image(v.path, v.value, ctx.key, photos, spec); if (img) out.image = img } continue }
    const { path, format } = splitField(Array.isArray(spec) ? spec[0] : spec)
    const v = val(path)
    if (!v) continue
    if (name === 'when') out.when = { value: ref(v.path), ...(format ? { format } : {}) }
    else out[name] = ref(v.path)
  }
  return out
}

/**
 * 본문 섹션 하나 → 렌더러 블록과 props.
 * @param {{ key: string, pageId: string, render?: object, missing?: string, content: object, copyIndex: Map<string, number>, routes: Record<string,string>,
 *   locale: 'ko'|'en', sitemap: object, pageTitleOf: (pageId: string) => unknown, first?: boolean, now?: number }} ctx
 * @returns {{ block: string, props: object, photos: string[] } | { why: string, omit?: boolean }}
 */
export function bindContentSection(ctx) {
  const { render, missing, locale, key } = ctx
  if (!render) return { why: missing ?? '렌더러가 정해지지 않았다(원형 noBlock.render 없음)' }
  const ui = CONTENT_UI[locale] ?? CONTENT_UI.ko
  const c = { ...ctx, render }
  const photos = []
  const id = key.split('/')[1]
  const copy = {
    title: render.heading[locale] ?? render.heading.ko,
    ...(render.hideHeading ? { hideTitle: true } : {}),
    units: ui.units,
  }
  const lead = firstSource(render.lead, c)
  if (lead?.type === 'path' && typeof lead.value === 'string') copy.lead = ref(lead.path)
  const base = { id, locale, ...(ctx.first ? { first: true } : {}), copy } // locale: 날짜·금액 서식(블록은 레시피·사이트 로캘을 모른다)
  const done = (props) => ({ block: rendererBlock(render.as), props, photos })
  const none = (why) => ({ why })

  switch (render.as) {
    case 'prose': {
      const r = firstSource(render.from, c)
      if (!r || r.type !== 'path') return none('본문 글(문구 칸·사례 본문)이 콘텐츠에 없다')
      const paragraphs = Array.isArray(r.value) ? r.value.map((v, i) => (usable(v) ? ref(`${r.path}.${i}`) : null)).filter(Boolean) : [ref(r.path)]
      return paragraphs.length ? done({ ...base, paragraphs }) : none('본문 글이 비었다')
    }
    case 'list':
    case 'cards':
    case 'timeline': {
      const titleField = render.as === 'timeline' ? splitField(render.fields.text).path : splitField(render.fields.title).path
      if (!render.from) {
        // 배열 없는 단일 항목 — fields 값이 출처 문법(문구 칸)이다
        const it = itemProps(render.fields, '', null, c, photos, true)
        return it.title ? done({ ...base, items: [it] }) : none('항목 제목(문구 칸)이 콘텐츠에 없다')
      }
      const r = firstSource(render.from, c)
      if (!r) return none(`목록 자료가 콘텐츠에 없다(${render.from.join(' · ')})`)
      const rows = arrayItems(r, render, titleField)
      if (!rows?.length) return none(`목록 자료가 비었다(${render.from.join(' · ')})`)
      if (render.maxAgeDays && render.sort) {
        const newest = at(rows[0].item, render.sort.replace(/^-/, ''))
        const age = ((ctx.now ?? Date.now()) - Date.parse(`${newest}T00:00:00Z`)) / 86400000
        if (Number.isFinite(age) && age > render.maxAgeDays) return { why: `최신 항목이 ${render.maxAgeDays}일을 넘었다 — 섹션을 뺀다(factory-rules.md §21-1)`, omit: true }
      }
      const items = rows.map(({ base: b, item }) => itemProps(render.fields, b, item, c, photos))
      return done(render.as === 'timeline' ? { ...base, entries: items.map((e) => ({ when: e.when, text: e.text })) } : { ...base, items })
    }
    case 'facts': {
      const rows = []
      if (render.rows) {
        for (const row of render.rows) {
          const r = firstSource(row.from, c)
          if (!r || r.type !== 'path') continue
          const format = row.format ?? (typeof r.value === 'number' ? 'text' : undefined)
          rows.push({ label: row.label[locale] ?? row.label.ko, value: { value: ref(r.path), ...(format && format !== 'text' ? { format } : {}), ...(row.format === 'money' ? { currency: render.currency ?? 'KRW' } : {}) } })
        }
      } else if (render.from) {
        const r = firstSource(render.from, c)
        const { path: lp } = splitField(render.fields.label)
        const { path: vp, format } = splitField(render.fields.value)
        for (const { base: b, item } of (r && arrayItems(r, render, lp)) ?? []) {
          if (!usable(at(item, vp))) continue
          rows.push({ label: ref(sub(b, lp)), value: { value: ref(sub(b, vp)), ...(format ? { format } : {}) } })
        }
      }
      return rows.length ? done({ ...base, rows }) : none('값 목록 자료가 콘텐츠에 없다')
    }
    case 'links': {
      let links = []
      if (render.links) {
        for (const l of render.links) {
          const r = firstSource(l.from, c)
          const href = !r ? null : r.type === 'path' ? ref(r.path) : r.type === 'struct' && r.name === 'route' ? routeHref(r.arg, ctx.routes) : null
          // labelFrom(QFIX [3]): 링크 이름이 정해진 이름표가 아니라 04 문구 칸(주 행동 「새로 만들기」)일 때 — 이름 칸이 비면 이름 없는 링크를 그리지 않는다
          const lab = l.labelFrom ? firstSource(l.labelFrom, c) : null
          const label = l.labelFrom ? (lab?.type === 'path' ? ref(lab.path) : null) : l.label[locale] ?? l.label.ko
          if (href && label) links.push({ label, href })
        }
      } else if (render.from) {
        const r = firstSource(render.from, c)
        if (r?.type === 'struct') links = structLinks(r.name, ctx)
        else if (r) for (const { base: b, item } of arrayItems(r, render, splitField(render.fields.label).path) ?? []) {
          if (!usable(at(item, render.fields.href))) continue
          links.push({ label: ref(sub(b, render.fields.label)), href: ref(sub(b, render.fields.href)) })
        }
      }
      return links.length ? done({ ...base, links, ...(render.mode ? { mode: render.mode } : {}) }) : none('링크 자료가 콘텐츠·사이트맵에 없다')
    }
    case 'gallery': {
      const r = firstSource(render.from, c)
      if (!r) return none(`사진 자료가 콘텐츠에 없다(${render.from.join(' · ')})`)
      const rows = arrayItems(r, render, null) ?? []
      const images = rows.map(({ base: b, item }) => {
        if (!render.fields) return image(b, item, key, photos, id)
        // 상세 조각처럼 칸 모양이 ImageSlot 이 아닌 것 — 칸마다 $ref 로 이미지 모양을 짓는다
        const o = {}
        for (const [name, f] of Object.entries(render.fields)) if (usable(at(item, f))) o[name] = ref(sub(b, f))
        if (render.imageSource) o.source = render.imageSource
        if (render.imageSource === 'real-required' && !usable(at(item, render.fields.src ?? 'src'))) photos.push(`${key}/${id}`)
        return o
      }).filter(Boolean)
      if (!images.length) return none('사진 자료가 비었다')
      const cap = firstSource(render.caption, c)
      return done({ ...base, images, ...(render.mode ? { mode: render.mode } : {}), ...(cap?.type === 'path' ? { caption: ref(cap.path) } : {}) })
    }
    case 'breadcrumb': {
      const trail = [{ label: pageLabel('home', locale), href: '/' }, { label: ctx.pageTitleOf(ctx.pageId) }]
      return { block: rendererBlock('breadcrumb'), props: { id, copy: { label: ui.crumbs }, trail }, photos }
    }
    case 'skeleton':
      return { block: rendererBlock('skeleton'), props: { id, copy: { label: ui.loading }, lines: 4 }, photos }
    default:
      return none(`모르는 렌더러: ${render.as}`)
  }
}

function routeHref(arg, routes) {
  const [page, anchor] = String(arg).split('#')
  const r = routes[page]
  return r ? `${r}${anchor ? `#${anchor}` : ''}` : null
}

/** 사이트맵 구조 링크: @pages(법정 쪽 뺀 쪽 — 지금 쪽 aria-current) · @legal-pages(법정 쪽). 이름은 쪽 이름표·쪽 제목 문구. */
function structLinks(name, ctx) {
  const pages = ctx.sitemap.pages
  if (name === 'legal-pages') return pages.filter((p) => p.legal).map((p) => ({ label: pageLabel(p.id, ctx.locale), href: p.route }))
  if (name === 'pages') return pages.filter((p) => !p.legal).map((p) => ({ label: p.route === '/' ? pageLabel('home', ctx.locale) : ctx.pageTitleOf(p.id), href: p.route, ...(p.id === ctx.pageId ? { current: true } : {}) }))
  return []
}
