// 브리프 사실 → hyperframes rows.json(GUIDE 6절 4번). 순수 — 렌더 전에 글자 길이 초과·빈 사실을 걸러 내고 이유를 돌려준다.
//   rowsFromBriefs(briefs, spec, variables, { extra }) → { rows, flagged }
//     briefs     [{ id, facts }] — id 는 출력 파일 이름(slug), facts 는 brief.mjs 의 facts(사실 이름 → 글).
//     spec       { map: { <변수 id>: '<사실>' | '<사실>+<사실>' } } — 사실 이름은 factory/stamp/briefs 의 facts 키 그대로. 「+」는 ' · ' 로 이어 붙인다.
//     variables  템플릿 index.html 의 data-composition-variables 선언([{ id, type, maxLength, … }]) — parseVariables(html).
//   걸러내는 것: 빈 사실(trim 후 비었다) → 그 행은 만들지 않는다 — 템플릿 기본값(예시 가게 이름)이 렌더에 새면 거짓이라 기본값으로 채우지 않는다.
//               maxLength 초과 → 잘라서 쓰지 않고 행을 뺀다(문구를 줄이거나 다른 템플릿을 고른다). flagged 에 { id, variable, fact, reason: 'empty'|'overflow', length?, max? }.
//   행마다 name(출력 이름)이 들어간다 — --strict-variables 는 name 도 선언돼 있어야 통과한다(GUIDE S3).
// 지어내지 않는다: spec 에 없는 변수는 행에 넣지 않는다(extra 로 명시한 색 같은 것만 더한다).

/** 템플릿 html 의 data-composition-variables 속성(JSON)을 읽는다. 없으면 []. */
export function parseVariables(html) {
  const m = /data-composition-variables\s*=\s*(?:'([^']*)'|"([^"]*)")/.exec(html)
  if (!m) return []
  return JSON.parse((m[1] ?? m[2]).replace(/&quot;/g, '"').replace(/&#39;/g, "'"))
}

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** 템플릿별 사실 지도. 키 = templates.json id. 값의 사실 이름은 브리프 facts 키(시험이 실제 브리프에 있는 이름인지 본다). */
export const TEMPLATE_SPECS = {
  'kinetic-name-poster-loop': { map: { store_name: 'name', tagline: 'claim', detail: 'address+hours' } },
}

/** 사실 이름(+로 이은 것) → 값. 빈 조각이 하나라도 있으면 null. */
export function factValue(facts, expr) {
  const parts = expr.split('+').map((k) => clean(facts?.[k]))
  return parts.every(Boolean) ? parts.join(' · ') : null
}

export function rowsFromBriefs(briefs, spec, variables, { extra = {} } = {}) {
  const decl = new Map(variables.map((v) => [v.id, v]))
  for (const id of Object.keys(spec.map)) if (!decl.has(id)) throw new Error(`템플릿에 선언되지 않은 변수: ${id}`)
  for (const id of Object.keys(extra)) if (!decl.has(id)) throw new Error(`템플릿에 선언되지 않은 변수(extra): ${id}`)
  if (!decl.has('name')) throw new Error('템플릿에 name 변수(출력 파일 이름)가 선언돼 있지 않다 — --strict-variables 가 거절한다')
  const rows = [], flagged = []
  for (const b of briefs) {
    const row = { name: b.id, ...extra }
    let ok = true
    for (const [id, expr] of Object.entries(spec.map)) {
      const value = factValue(b.facts, expr)
      if (value == null) { flagged.push({ id: b.id, variable: id, fact: expr, reason: 'empty' }); ok = false; continue }
      const max = decl.get(id).maxLength
      const length = [...value].length
      if (max != null && length > max) { flagged.push({ id: b.id, variable: id, fact: expr, reason: 'overflow', length, max }); ok = false; continue }
      row[id] = value
    }
    if (ok) rows.push(row)
  }
  return { rows, flagged }
}
