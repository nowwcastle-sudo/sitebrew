// 빈틈 표(레퍼런스 쪽)의 패턴 정규화 표 검사 — factory v1 Task 2.3.
//   카드의 자유 서술(한국어)을 키워드 표로 패턴 id 로 바꾼다. 표 자체의 무결성(id·키워드·근거 토큰·제안)과
//   추출의 결정성·양성/음성 대조를 본다. 원자료 폴더가 필요 없다(고정 입력만).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COLOR_LOGIC_LABEL } from './recipe.mjs'
import {
  COVER_NAMESPACES, DIMS, FIELDS, PATTERNS, PROPOSAL_KINDS, cardView, extractPatterns, isMisfit, normalizeText, patternById,
} from './lib/gap-patterns.mjs'

const card = (over = {}) => ({
  id: 'x', archetype: 'brand',
  structure: { hero: '', sections: [] },
  colorLogic: 'K1',
  motion: { entrance: null, scroll: null, hover: null, transition: null },
  interaction: [],
  cta: { pattern: '' },
  fit: { archetypes: ['brand'], score: 0.9 },
  boldness: 'balanced',
  ...over,
})

test('표 무결성: id 는 <차원>:<이름> 꼴로 겹치지 않고, 칸·키워드·근거 토큰·제안이 모양을 지킨다', () => {
  assert.ok(PATTERNS.length >= 60, `패턴 ${PATTERNS.length}개`)
  const ids = new Set()
  for (const p of PATTERNS) {
    assert.match(p.id, /^[a-z]+:[a-z0-9-]+$/, p.id)
    assert.ok(!ids.has(p.id), `중복 ${p.id}`)
    ids.add(p.id)
    assert.ok(DIMS.includes(p.id.split(':')[0]), `${p.id} 차원`)
    assert.ok(p.fields.length > 0 && p.fields.every((f) => FIELDS.includes(f)), `${p.id} 칸`)
    assert.ok(p.label.length >= 2, `${p.id} 이름표`)
    assert.ok(PROPOSAL_KINDS.includes(p.proposal.kind), `${p.id} 제안 종류`)
    assert.ok(p.proposal.summary.length >= 8 && p.proposal.summary.length <= 240, `${p.id} 제안 문장 길이`)
    for (const t of [...p.covers, ...p.near]) {
      assert.ok(COVER_NAMESPACES.includes(t.split(':')[0]), `${p.id} 근거 토큰 ${t}`)
      assert.equal(t, t.toLowerCase(), `${p.id} 근거 토큰은 소문자 ${t}`)
    }
    const m = p.match
    if (p.dim !== 'color') {
      assert.ok(m.any.length + m.all.length > 0, `${p.id} 키워드 없음`)
      for (const k of [...m.any, ...m.all.flat(), ...m.none]) {
        assert.ok(k.length >= 2 || /^[a-z0-9]+$/.test(k), `${p.id} 키워드 너무 짧음: ${k}`)
        assert.equal(normalizeText(k), k, `${p.id} 키워드가 정규화 꼴이 아님: ${k}`)
      }
    }
  }
})

test('모든 패턴은 자기 예문을 알아본다(양성 대조) — 예문은 우리 말로 쓴 짧은 문장', () => {
  for (const p of PATTERNS) {
    assert.ok(p.example && p.example.length > 0, `${p.id} 예문 없음`)
    const c = card()
    if (p.dim === 'color') c.colorLogic = p.example
    else for (const f of p.fields) {
      if (f === 'hero') c.structure.hero = p.example
      else if (f === 'sections') c.structure.sections = [p.example]
      else if (f === 'interaction') c.interaction = [p.example]
      else if (f === 'cta') c.cta.pattern = p.example
      else c.motion[f] = p.example
    }
    assert.ok(extractPatterns(c).includes(p.id), `${p.id} 가 자기 예문 「${p.example}」 을 못 알아본다`)
  }
})

test('normalizeText: 소문자·공백 접기·NFC·빈 값', () => {
  assert.equal(normalizeText('  전면   영상\n위 3D  '), '전면 영상 위 3d')
  assert.equal(normalizeText(null), '')
  assert.equal(normalizeText(undefined), '')
  assert.equal(normalizeText(['가', '나']), '가 나')
  assert.equal(normalizeText('가​나'), '가나') // 폭 0 글자 제거
  assert.equal(normalizeText('한'), '한') // 조합형 → 완성형
})

test('cardView: 칸별 정규화 문자열(없는 칸은 빈 문자열)', () => {
  const v = cardView(card({ structure: { hero: 'A  B', sections: ['가', '나'] }, interaction: ['다', '라'], cta: { pattern: 'Skip Intro' } }))
  assert.equal(v.hero, 'a b')
  assert.equal(v.sections, '가 나')
  assert.equal(v.interaction, '다 라')
  assert.equal(v.cta, 'skip intro')
  assert.equal(v.entrance, '')
  const bare = cardView({ id: 'y' })
  assert.deepEqual(Object.keys(bare).sort(), [...FIELDS].sort())
  for (const f of FIELDS) assert.equal(bare[f], '', f)
})

test('extractPatterns: 칸마다 알맞은 패턴만 — 히어로·스크롤·상호작용·CTA 양성 + 엉뚱한 칸 음성', () => {
  const ids = extractPatterns(card({
    structure: { hero: '전면 영상 위에 큰 제목', sections: ['공지띠', '로고', '쿠키 동의 카드'] },
    motion: { entrance: null, scroll: '내리면 가로 스크롤 갤러리가 이어짐', hover: null, transition: null },
    interaction: ['다크 모드 전환'],
    cta: { pattern: '알약 버튼 하나' },
  }))
  for (const want of ['hero:fullscreen-video', 'section:announcement-bar', 'section:cookie-consent', 'scroll:horizontal-scroll']) assert.ok(ids.includes(want), want)
  // 음성: 스크롤 칸 문장이 히어로 패턴을, 히어로 칸 문장이 스크롤 패턴을 만들지 않는다
  const swapped = extractPatterns(card({ structure: { hero: '내리면 가로 스크롤 갤러리가 이어짐', sections: [] }, motion: { entrance: null, scroll: '전면 영상 위에 큰 제목', hover: null, transition: null } }))
  assert.ok(!swapped.includes('scroll:horizontal-scroll'))
  assert.ok(!swapped.includes('hero:fullscreen-video'))
})

test('extractPatterns: 결정적 — 정렬된 중복 없는 id, 같은 입력은 같은 출력, 입력은 바뀌지 않는다', () => {
  const c = card({ structure: { hero: '전면 영상 위 3D 오브젝트와 일러스트', sections: ['쿠키', '쿠키 안내', '공지띠'] }, interaction: ['쿠키 수락', '쿠키 거부'] })
  const snapshot = JSON.stringify(c)
  const a = extractPatterns(c)
  const b = extractPatterns(JSON.parse(snapshot))
  assert.deepEqual(a, b)
  assert.deepEqual(a, [...new Set(a)].sort())
  assert.equal(JSON.stringify(c), snapshot)
})

test('extractPatterns: 키워드가 없으면 빈 목록(음성 대조) · 빈 카드도 던지지 않는다', () => {
  assert.deepEqual(extractPatterns(card({ structure: { hero: '평범한 흰 바탕', sections: ['본문'] }, colorLogic: 'K0' })), [])
  assert.deepEqual(extractPatterns({}), [])
})

test('none 키워드: 걸리면 그 패턴은 빠진다 / all 은 모든 묶음에서 하나씩 있어야 한다', () => {
  const split = patternById('hero:split-columns')
  assert.ok(split.match.all.length === 2, 'split-columns 는 왼쪽·오른쪽 두 묶음')
  assert.ok(extractPatterns(card({ structure: { hero: '왼쪽 사진, 오른쪽 제목', sections: [] } })).includes('hero:split-columns'))
  assert.ok(!extractPatterns(card({ structure: { hero: '왼쪽 사진만', sections: [] } })).includes('hero:split-columns'), '한쪽만 있으면 안 된다')
  const single = patternById('cta:single-primary')
  assert.ok(single.match.none.length > 0, 'single-primary 는 「없음」류를 뺀다')
  assert.ok(extractPatterns(card({ cta: { pattern: '주 버튼 하나' } })).includes('cta:single-primary'))
  assert.ok(!extractPatterns(card({ cta: { pattern: '버튼 하나도 없음' } })).includes('cta:single-primary'))
})

test('색 논리: K1~K9 는 카드의 colorLogic 값과 같을 때만(표는 recipe.mjs 이름표와 같은 아홉)', () => {
  assert.deepEqual(Object.keys(COLOR_LOGIC_LABEL), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9'])
  for (const k of Object.keys(COLOR_LOGIC_LABEL)) {
    const p = patternById(`color:${k.toLowerCase()}`)
    assert.ok(p, k)
    assert.ok(p.label.includes(COLOR_LOGIC_LABEL[k]), `${k} 이름표가 recipe.mjs 와 같은 뜻`)
    assert.deepEqual(p.covers, [`recipe:color:${k.toLowerCase()}`])
    assert.ok(extractPatterns(card({ colorLogic: k })).includes(`color:${k.toLowerCase()}`))
  }
  assert.ok(!extractPatterns(card({ colorLogic: 'K3' })).includes('color:k1'))
  assert.ok(!extractPatterns(card({ colorLogic: 'k33' })).some((i) => i.startsWith('color:')))
})

test('isMisfit: 적합도 0.5 미만 · 자기 원형이 fit.archetypes 에 없음 · 경계값 0.5 는 맞는 카드', () => {
  assert.equal(isMisfit(card()), false)
  assert.equal(isMisfit(card({ fit: { archetypes: ['brand'], score: 0.5 } })), false)
  assert.equal(isMisfit(card({ fit: { archetypes: ['brand'], score: 0.49 } })), true)
  assert.equal(isMisfit(card({ fit: { archetypes: ['saas'], score: 0.95 } })), true)
  assert.equal(isMisfit(card({ fit: { archetypes: ['brand', 'saas'], score: 0.5 } })), false)
  assert.equal(isMisfit({ id: 'z' }), true, 'fit 없는 카드는 맞는지 알 수 없으니 거른다')
})

test('패턴 id 는 원문 한 줄(12낱말 이상 따옴표 인용)을 담지 않는다 — 표 글자 전체를 훑는다', () => {
  const strings = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [])
  const QUOTE = /“([^”]+)”|"([^"]+)"|‘([^’]+)’|「([^」]+)」|『([^』]+)』/g
  const quoted = strings(PATTERNS).flatMap((s) => [...s.matchAll(QUOTE)].map((m) => m.slice(1).find(Boolean))).filter((s) => s.trim().split(/\s+/).length >= 12)
  assert.deepEqual(quoted, [])
  // 양성 대조: 같은 검사가 12낱말 인용을 실제로 잡는다
  const long = '“' + Array.from({ length: 12 }, (_, i) => `낱말${i}`).join(' ') + '”'
  assert.equal(strings([long]).flatMap((s) => [...s.matchAll(QUOTE)].map((m) => m.slice(1).find(Boolean))).filter((s) => s.trim().split(/\s+/).length >= 12).length, 1)
})
