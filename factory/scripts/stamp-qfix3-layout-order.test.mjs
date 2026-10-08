// QFIX3-LAYOUT — 첫 화면 구획 순서(Task 6.3 4차). 정적 시험(브라우저 없음).
//   ① dashboard: 데이터가 없어 빈 상태로 그려지는 패널(경고 목록·KPI)은 데이터가 있는 구획 뒤로 보낸다 — 빈 안내 카드 둘이 첫 화면을 차지해 숫자 지표·표가 두 화면째로 밀렸다.
//   ② pwa: 빈 상태 안내(첫 행동)는 주 화면 목록·로딩 뼈대보다 앞이다 — 주 행동이 1.4~1.7화면째에 있었다.
//   ③ local: 영업시간·위치(hours-table)는 메뉴·가격(menu-price)보다 앞이다 — 영업시간이 2.1화면째에 있었다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sinkEmptyPanels } from '../stamp/gen-pages.mjs'
import { readFileSync } from 'node:fs'

const leaf = (key, block) => ({ key, block })
const sections = (map) => Object.fromEntries(Object.entries(map).map(([k, status]) => [k, { props: status ? { state: { status } } : { copy: {} } }]))

test('① 빈 패널은 데이터 있는 구획 뒤로(안정 정렬) — 다른 원형·빈 패널이 없으면 그대로', () => {
  const list = [leaf('home/page-header', 'block-content-facts'), leaf('home/filter-bar', 'block-filter-bar-toolbar'), leaf('home/action-list', 'block-dashboard-panel-action-list'), leaf('home/kpi-row', 'block-dashboard-panel-kpi-first'), leaf('home/trend-charts', 'block-dashboard-panel-trend-plus-table')]
  const s = sections({ 'home/page-header': null, 'home/filter-bar': null, 'home/action-list': 'empty', 'home/kpi-row': 'empty', 'home/trend-charts': 'ready' })
  assert.deepEqual(sinkEmptyPanels(list, s).map((l) => l.key), ['home/page-header', 'home/filter-bar', 'home/trend-charts', 'home/action-list', 'home/kpi-row'])
  const ready = sections({ 'home/page-header': null, 'home/filter-bar': null, 'home/action-list': 'ready', 'home/kpi-row': 'ready', 'home/trend-charts': 'ready' })
  assert.deepEqual(sinkEmptyPanels(list, ready).map((l) => l.key), list.map((l) => l.key))
  // 대시보드 패널이 아닌 블록의 empty 는 건드리지 않는다
  const other = [leaf('home/a', 'block-state-screen-empty-guide'), leaf('home/b', 'block-dashboard-panel-kpi-first')]
  assert.deepEqual(sinkEmptyPanels(other, sections({ 'home/a': 'empty', 'home/b': 'ready' })).map((l) => l.key), ['home/a', 'home/b'])
})

const archetype = (id) => JSON.parse(readFileSync(new URL('../../registry/factory/archetypes/' + id + '.json', import.meta.url), 'utf8'))
const kinds = (id, pageId) => archetype(id).pages.find((p) => p.id === pageId).sections.map((s) => s.kind)
test('② pwa 홈: 앱 막대 → 빈 상태 안내 → 주 화면 → 로딩 뼈대', () => {
  const k = kinds('pwa', 'home')
  assert.deepEqual(k.slice(0, 4), ['app-bar', 'empty-state', 'primary-content', 'skeleton'])
})

test('③ local 홈: 영업시간·위치 표가 메뉴·가격보다 앞, 첫 구획·공지는 그대로', () => {
  const k = kinds('local', 'home')
  assert.deepEqual(k.slice(0, 3), ['hero-visit-info', 'notice', 'hours-table'])
  assert.ok(k.indexOf('hours-table') < k.indexOf('menu-price'))
})
