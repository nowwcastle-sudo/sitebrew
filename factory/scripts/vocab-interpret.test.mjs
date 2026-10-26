// 해석기 interpret — 초보자의 막연한 수정 문장 → 사전이 허락한 해석(축·방향·세기·범위). LLM 은 해석하지 않는다, 사전이 정한다.
// 사전은 Task 1·2 의 실제 파일(factory/vocab/design-lexicon.yaml). 진단·여러 모호 항목은 실제 파일에 항목이 없어서 사본에 항목을 붙여 읽는다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_FILE, loadLexicon } from '../vocab/lexicon.mjs'
import { interpret } from '../vocab/interpret.mjs'

const HANGUL = /[ㄱ-ㆎ가-힣]/
/** readings 중에 partial 의 모든 키가 같은 것이 있는가 */
const has = (readings, partial) => readings.some((x) => Object.entries(partial).every(([k, v]) => x[k] === v))
const find = (readings, partial) => readings.find((x) => Object.entries(partial).every(([k, v]) => x[k] === v))

/** 실제 사전 + 시험용 항목을 붙인 사전 */
function lexWith(extraEntries) {
  const dir = mkdtempSync(join(tmpdir(), 'interpret-test-'))
  try {
    const f = join(dir, 'lex.yaml')
    writeFileSync(f, `${readFileSync(DEFAULT_FILE, 'utf8')}\n${extraEntries}\n`)
    return loadLexicon(f)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
const DIAG = `
  - id: t-old
    kind: diagnosis
    label: 낡삭함
    match: { ko: ["낡삭"] }
    ask: 어디가 가장 낡삭해 보여요?
    causes:
      - { reading: [{ axis: type-family, value: distinctive }, { axis: palette-count, direction: fewer, strength: 1 }], say: "글꼴이 흔하고 색이 많아서 그래 보일 수 있어요." }
      - { reading: [{ axis: depth, direction: flat, strength: 1 }], say: "그림자가 낡아 보일 수 있어요." }
      - { reading: [{ axis: shape, direction: sharp, strength: 1 }], say: "세 번째 후보는 쓰이지 않아요." }
  - id: t-plain
    kind: diagnosis
    label: 덤덤함
    match: { ko: ["덤덤"] }
    ask: 어느 부분이 덤덤해 보여요?
    causes:
      - { reading: [{ axis: depth, direction: lifted, strength: 1 }], say: "입체감이 없어서 그래 보일 수 있어요." }
`
const lex = loadLexicon()

test('고급스럽게 → refined 확정', () => {
  const r = interpret('고급스럽게', lex)
  assert.equal(r.result, 'confirmed')
  assert.ok(has(r.readings, { axis: 'spacing', direction: 'airy', strength: 1, scope: 'site' }))
  assert.ok(has(r.readings, { axis: 'palette-count', direction: 'fewer', strength: 1, scope: 'site' }))
  assert.ok(has(r.readings, { axis: 'type-family', value: 'serif-or-thin-sans', source: 'refined' }))
  assert.deepEqual(r.sources, ['refined'])
  assert.ok(r.readings.every((x) => x.source === 'refined' && x.scope === 'site'))
  assert.equal(r.say, lex.entries.find((e) => e.id === 'refined').say.ko)
})

test('설계 예문 — 좀 더 고급지게, 근데 너무 차갑지 않게', () => {
  const r = interpret('좀 더 고급지게, 근데 너무 차갑지 않게', lex)
  assert.equal(r.result, 'confirmed')
  assert.ok(has(r.readings, { axis: 'spacing', direction: 'airy', strength: 1 }))
  assert.ok(has(r.readings, { axis: 'palette-count', direction: 'fewer', strength: 1 }))
  assert.ok(has(r.readings, { axis: 'color-temperature', direction: 'cool', strength: 0, cap: true, source: 'cooler' }))
  assert.deepEqual(r.sources, ['refined', 'cooler'])
})

test('정규화는 조사·어미·띄어쓰기를 지운다', () => {
  for (const text of ['고급스럽게 좀', '고 급 스 럽 게', '고급스러웠으면', '  고급스럽게!!  ', '고급 스럽게']) {
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    assert.ok(r.sources.includes('refined'), text)
  }
})

test('부정은 바로 앞 낱말 묶음에만 걸린다', () => {
  const r = interpret('차갑지 않게, 고급스럽게', lex)
  assert.equal(r.result, 'confirmed')
  assert.ok(has(r.readings, { axis: 'color-temperature', cap: true, strength: 0 }))
  const refined = r.readings.filter((x) => x.source === 'refined')
  assert.ok(refined.length >= 2)
  assert.ok(refined.every((x) => x.cap === undefined && x.strength === 1), '고급스럽게에는 상한이 붙지 않는다')
  assert.equal(r.readings.filter((x) => x.cap).length, 1)
})

test('같은 축 반대 방향은 모름 — 두세 갈래를 되묻는다', () => {
  const r = interpret('밝고 어둡게', lex)
  assert.equal(r.result, 'unknown')
  assert.ok(r.choices.length >= 2 && r.choices.length <= 3, JSON.stringify(r.choices))
  assert.ok(r.ask.length < 80)
  assert.ok(r.choices.includes(lex.entries.find((e) => e.id === 'brighter').say.ko))
  assert.ok(r.choices.includes(lex.entries.find((e) => e.id === 'darker').say.ko))
})

test('같은 방향 두 번은 하나로 합친다 — 고급스럽고 깔끔하게', () => {
  const r = interpret('고급스럽고 깔끔하게', lex)
  assert.equal(r.result, 'confirmed')
  assert.equal(r.readings.filter((x) => x.axis === 'spacing' && x.direction === 'airy').length, 1)
  assert.deepEqual(r.sources, ['refined', 'neat'])
})

test('사전에 없는 말은 질문 하나', () => {
  for (const text of ['음… 그냥 좀', '', '   ', null, undefined, '다시 해줘']) {
    const r = interpret(text, lex)
    assert.equal(r.result, 'unknown', String(text))
    assert.ok(r.ask.length > 0 && r.ask.length < 80, `${text} → ${r.ask}`)
    assert.ok(HANGUL.test(r.ask) || text == null || String(text).trim() === '', '한글 입력(또는 빈 입력)이면 한국어 질문')
    assert.deepEqual(r.choices, [])
  }
})

test('영어 낱말은 단어 경계로, 한글에 붙어도', () => {
  const a = interpret('좀 더 clean하게', lex)
  assert.equal(a.result, 'confirmed')
  assert.deepEqual(a.sources, ['neat'])
  const b = interpret('unclean', lex)
  assert.equal(b.result, 'unknown')
  assert.ok(!(b.sources ?? []).includes('neat'))
  assert.equal(interpret('uncleaner look', lex).result, 'unknown')
  assert.deepEqual(interpret('Make it CLEAN', lex).sources, ['neat'], '대소문자는 같다')
})

test('입력이 영어면 설명도 질문도 영어', () => {
  const ok = interpret('make it elegant', lex)
  assert.equal(ok.result, 'confirmed')
  assert.ok(!HANGUL.test(ok.say) && ok.say.length > 0)
  const no = interpret('hmm whatever', lex)
  assert.equal(no.result, 'unknown')
  assert.ok(!HANGUL.test(no.ask) && no.ask.length < 80)
})

test('범위: 제목만', () => {
  const r = interpret('제목만 크게', lex)
  assert.equal(r.result, 'confirmed')
  assert.ok(has(r.readings, { axis: 'type-scale', direction: 'larger', scope: 'element:제목' }))
  assert.equal(r.readings.length, 1)
  assert.deepEqual(r.sources, ['larger'])
  assert.equal(interpret('크게', lex).readings[0].scope, 'site', '범위를 말하지 않으면 site')
})

test('세기: 조금은 1, 확은 2, 말하지 않으면 항목의 세기', () => {
  assert.equal(find(interpret('조금 더 둥글게', lex).readings, { axis: 'shape' }).strength, 1)
  assert.equal(find(interpret('확 둥글게', lex).readings, { axis: 'shape' }).strength, 2)
  assert.equal(find(interpret('훨씬 둥글게', lex).readings, { axis: 'shape' }).strength, 2)
  assert.equal(find(interpret('둥글게', lex).readings, { axis: 'shape' }).strength, 1)
  assert.equal(find(interpret('대담하게', lex).readings, { axis: 'contrast' }).strength, 2, '항목 자체의 세기')
  assert.ok(interpret('조금 대담하게', lex).readings.every((x) => x.strength === 1), '낱말 묶음 전체에 조금이 붙는다')
})

test('한 글자 세기 낱말 「확」은 낱말 하나로 있을 때만 — 「정확하게」에는 걸리지 않는다', () => {
  const r = interpret('정확하게 둥글게', lex)
  assert.equal(find(r.readings, { axis: 'shape' }).strength, 1)
  assert.equal(interpret('확인하고 둥글게', lex).readings[0].strength, 1)
})

test('앞으로 걸리는 세기는 뒤에 붙을 말이 없으면 버려진다', () => {
  assert.equal(interpret('제목만', lex).result, 'unknown')
  assert.equal(interpret('확', lex).result, 'unknown')
  assert.equal(interpret('않게', lex).result, 'unknown', '부정은 앞에 붙을 말이 없으면 버려진다')
})

test('confidence low 항목은 후보 둘', () => {
  const r = interpret('모던하게', lex)
  assert.equal(r.result, 'two')
  assert.equal(r.options.length, 2)
  assert.deepEqual(r.sources, ['modern'])
  const [a, b] = r.options
  assert.ok(has(a.readings, { axis: 'spacing', direction: 'airy', source: 'modern' }))
  assert.ok(has(b.readings, { axis: 'color-lightness', direction: 'dark', strength: 2, source: 'modern' }))
  assert.equal(a.say, '깔끔하고 정돈된 쪽으로 이해했어요.')
  assert.equal(b.say, '어둡고 세련된 쪽으로 이해했어요.')
  assert.equal(interpret('modern', lex).result, 'two')
})

test('확정 낱말과 모호 낱말이 함께 있으면 두 후보에 확정 쪽이 모두 들어간다', () => {
  const r = interpret('둥글게, 모던하게', lex)
  assert.equal(r.result, 'two')
  for (const o of r.options) {
    assert.ok(has(o.readings, { axis: 'shape', direction: 'round', source: 'rounder' }))
    assert.ok(o.say.startsWith(lex.entries.find((e) => e.id === 'rounder').say.ko))
  }
  assert.deepEqual(r.sources, ['rounder', 'modern'])
})

test('모호 낱말의 후보가 확정 쪽과 부딪치면 모름', () => {
  const r = interpret('밝게 모던하게', lex)
  assert.equal(r.result, 'unknown', '두 번째 후보(어둡게)가 밝게와 반대')
  assert.ok(r.choices.length >= 2 && r.ask.length < 80)
})

test('진단은 절대 확정이 되지 않는다 — 원인 둘 이상이면 앞의 둘로 후보 둘', () => {
  const dlex = lexWith(DIAG)
  const r = interpret('너무 낡삭해', dlex)
  assert.equal(r.result, 'two')
  assert.equal(r.options.length, 2, '세 번째 원인은 쓰지 않는다')
  assert.ok(has(r.options[0].readings, { axis: 'type-family', value: 'distinctive', source: 't-old' }))
  assert.ok(has(r.options[1].readings, { axis: 'depth', direction: 'flat' }))
  assert.equal(r.options[1].say, '그림자가 낡아 보일 수 있어요.')
  assert.deepEqual(r.sources, ['t-old'])
})

test('진단의 원인이 하나뿐이면 항목의 질문과 원인 문장을 선택지로 묻는다', () => {
  const dlex = lexWith(DIAG)
  const r = interpret('좀 덤덤해', dlex)
  assert.equal(r.result, 'unknown')
  assert.equal(r.ask, '어느 부분이 덤덤해 보여요?')
  assert.deepEqual(r.choices, ['입체감이 없어서 그래 보일 수 있어요.'])
  assert.ok(interpret('둥글게, 덤덤해', dlex).result !== 'confirmed', '다른 확정 낱말이 있어도 진단은 확정되지 않는다')
})

test('모호 항목이 둘 이상이면 한 번에 하나씩 묻는다', () => {
  const dlex = lexWith(DIAG)
  const r = interpret('모던하고 낡삭해', dlex)
  assert.equal(r.result, 'unknown')
  assert.ok(r.ask.length < 80 && r.choices.length === 2)
})

test('앞 갈래가 쓴 낱말 구간은 뒤 갈래가 다시 쓰지 않는다', () => {
  const big = `
  - id: big-mood
    kind: impression
    label: 큼직한 느낌
    match: { ko: ["크게보이"] }
    reading:
      - { axis: depth, direction: lifted, strength: 1 }
    say: { ko: "떠 보이는 느낌으로 이해했어요.", en: "I read this as more depth." }
    confidence: high
`
  const blex = lexWith(big)
  const r = interpret('크게보이게', blex)
  assert.deepEqual(r.sources, ['big-mood'], '인상 낱말이 먼저 구간을 쓰므로 축 낱말 「크게」는 다시 못 쓴다')
  assert.equal(r.readings.length, 1)
  assert.deepEqual(interpret('크게', blex).sources, ['larger'])
})

test('not 낱말이 맞춘 자리를 덮으면 그 맞춤은 버린다', () => {
  const x = `
  - id: firm
    kind: impression
    label: 단단함
    match: { ko: ["단단"] }
    not: ["단단히"]
    reading:
      - { axis: depth, direction: flat, strength: 1 }
    say: { ko: "납작하게 이해했어요.", en: "Flatter." }
    confidence: high
`
  const xlex = lexWith(x)
  assert.deepEqual(interpret('단단하게', xlex).sources, ['firm'])
  assert.equal(interpret('단단히 해줘', xlex).result, 'unknown')
})

test('인자 모양: 사전 생략 가능, ctx 는 받아도 결과를 바꾸지 않는다', () => {
  const a = interpret('고급스럽게')
  const b = interpret('고급스럽게', lex, { sections: ['home/hero'], candidates: ['1', '2'] })
  assert.deepEqual(a, b)
})

test('세기·부정은 바로 맞닿은 낱말 묶음에만 붙는다 — 사이에 다른 낱말이 끼면 버린다', () => {
  const uncapped = (text, id) => {
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    const own = r.readings.filter((x) => x.source === id)
    assert.ok(own.length >= 2 && own.every((x) => x.cap === undefined && x.strength === 1), `${text} → ${JSON.stringify(own)}`)
    return r
  }
  uncapped('고급스럽게 하되 기능이 느려지지 않게', 'refined')
  uncapped('고급스럽게 해 주시고 화면이 깨지지 않게', 'refined')
  assert.equal(find(interpret('확 바꿔주고 나중에 둥글게', lex).readings, { axis: 'shape' }).strength, 1)
  const t = interpret('제목 아래 설명을 크게', lex)
  assert.equal(find(t.readings, { axis: 'type-scale' }).scope, 'site', '제목 과 크게 사이에 다른 낱말이 있다')
  // 군말(더·너무)은 사이에 껴도 된다
  assert.equal(find(interpret('확 더 둥글게', lex).readings, { axis: 'shape' }).strength, 2)
  assert.ok(has(interpret('차갑지 않게', lex).readings, { axis: 'color-temperature', cap: true }))
})

test('영어 부정은 뒤에 오는 묶음에 붙는다', () => {
  const a = interpret('not too cold', lex)
  assert.equal(a.result, 'confirmed')
  assert.deepEqual(a.readings.map(({ axis, direction, strength, cap }) => ({ axis, direction, strength, cap })), [{ axis: 'color-temperature', direction: 'cool', strength: 0, cap: true }])
  const b = interpret('make it elegant but not cold', lex)
  assert.equal(b.result, 'confirmed')
  assert.ok(b.readings.filter((x) => x.source === 'refined').every((x) => x.cap === undefined && x.strength === 1))
  assert.ok(has(b.readings, { axis: 'color-temperature', direction: 'cool', strength: 0, cap: true }))
  assert.ok(has(interpret("don't make it cold", lex).readings, { axis: 'color-temperature', strength: 0, cap: true }))
  assert.ok(has(interpret('cold', lex).readings, { axis: 'color-temperature', direction: 'cool', strength: 1 }), '부정이 없으면 그대로')
})

test('한 글자 한글 낱말은 다른 낱말의 일부로는 맞지 않는다', () => {
  assert.equal(interpret('밝기는 그대로', lex).result, 'unknown')
  const car = interpret('그 차가 크게 보여요', lex)
  assert.deepEqual(car.sources, ['larger'], '「차가」(자동차+가)는 차갑다가 아니다')
  // 어미·조사가 붙은 한 글자 낱말은 맞는다
  for (const [text, id] of [['밝게 해줘', 'brighter'], ['밝은 느낌', 'brighter'], ['밝고 싶어', 'brighter'], ['차가워 보이게', 'cooler'], ['차가운 색', 'cooler'], ['어둡게', 'darker']]) {
    assert.ok(interpret(text, lex).sources.includes(id), text)
  }
  assert.ok(interpret('밤 느낌', lex).sources.includes('dark'), '낱말 하나로 있는 「밤」')
})

test('짧은 한글 낱말(3자 이하)은 일상 낱말 속에서는 맞지 않는다', () => {
  for (const text of ['레드향 판매 페이지', '화이트보드 수업 사진', '골드키위 상품 소개', '다크서클 크림 상세페이지', '샤프란 꽃집 소개', '네온사인 간판 사진', '파스텔케이크 사진', '블루투스 스피커', '플랫폼 소개', '백그라운드 색 바꿔줘']) {
    assert.equal(interpret(text, lex).result, 'unknown', text)
  }
})

test('짧은 한글 낱말 + 조사·어미는 그대로 맞는다', () => {
  for (const [text, id] of [['레드로 가자', 'hue-red'], ['골드가 좋겠어요', 'hue-gold'], ['화이트로 해주세요', 'hue-white'], ['샤프하게 해줘', 'sharper'], ['다크가 좋아요', 'darker'], ['깔끔해요', 'neat'], ['귀여운 느낌', 'playful'], ['명조체로 해줘', 'font-serif']]) {
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    assert.ok(r.sources.includes(id), `${text}: ${r.sources}`)
  }
})

test('짧은 한글 낱말 + 디자인 붙임말(톤·색·모드…)도 맞는다', () => {
  for (const [text, id] of [['레드톤으로 해줘', 'hue-red'], ['골드색으로 해줘', 'hue-gold'], ['화이트톤이 좋아요', 'hue-white'], ['핑크계열로 가자', 'hue-pink'], ['복고풍으로 해줘', 'retro'], ['입체감 있게', 'lifted'], ['다크모드로 해줘', 'dark-mode']]) {
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    assert.ok(r.sources.includes(id), `${text}: ${r.sources}`)
  }
})

test('띄어쓰기가 든 짧은 낱말(두 낱말에 걸친 뜻)은 낱말 경계 규칙을 받지 않는다', () => {
  assert.ok(interpret('색 줄여줘', lex).sources.includes('fewer-colors'))
  assert.ok(interpret('글씨가좀더크면좋겠어요', lex).sources.includes('larger'))
})

test('짧은 한글 낱말 + 풀이 조각(하·해·했·한·할 …) + 어미는 맞는다 — 「깔끔하게요」「따뜻했음」「차분할」', () => {
  for (const [text, id] of [['심플하게요', 'neat'], ['깔끔하게만', 'neat'], ['깔끔하게끔', 'neat'], ['깔끔하길', 'neat'], ['깔끔할', 'neat'], ['깔끔해야', 'neat'], ['깔끔해졌으면', 'neat'], ['깔끔한데요', 'neat'], ['깔끔한가요', 'neat'], ['깔끔한걸로', 'neat'], ['깔끔하거나', 'neat'], ['따뜻했음', 'warm'], ['따뜻해지면', 'warm'], ['어둡게만', 'darker'], ['어둡길', 'darker'], ['어두웠음', 'dark'], ['차분할 것 같아', 'calm'], ['화사하게요', 'brighter']]) {
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    assert.ok(r.sources.includes(id), `${text}: ${r.sources}`)
  }
})

test('풀이 조각 뒤가 어미가 아니면(명사 이름) 짧은 낱말도 맞지 않는다', () => {
  for (const text of ['레드하우스', '화이트한강', '블루하늘', '레드해적', '골드하나', '블랙요일', '레드향', '화이트보드', '골드키위', '다크서클', '샤프란']) {
    assert.equal(interpret(text, lex).result, 'unknown', text)
  }
})

test('실제 사전의 진단(7c): AI 티 → 글꼴·색 후보 둘, 진단은 확정이 되지 않는다', () => {
  const r = interpret('아직도 AI 티가 많이 나', lex)
  assert.equal(r.result, 'two')
  assert.ok(has(r.options[0].readings, { axis: 'type-family', value: 'distinctive' }))
  assert.ok(has(r.options[1].readings, { axis: 'color-hue', value: 'away-from-indigo-violet' }))
  for (const text of ['답답해', '산만해', '너무 밋밋해요', '너무 촌스러워', '싸 보여요', '믿음이 안 가요', '다 똑같아 보여요', '엉망이에요']) {
    assert.notEqual(interpret(text, lex).result, 'confirmed', text)
  }
})

test('진단 말이 내용·이름에 든 문장과 부정형(상한이 거꾸로 붙는 말)은 반응하지 않는다', () => {
  for (const text of ['AI 티켓 예매 서비스', '답답한 마음을 달래 드리는 상담실', '기계가 만든 커피 말고 핸드드립', '산만한 아이들 집중력 클래스', '복잡한 신청 서류 안내', '눈부신 아침 햇살', '밋밋해 보이지 않게 해줘', '답답한 느낌이 아니었으면 좋겠어요']) {
    assert.equal(interpret(text, lex).result, 'unknown', text)
  }
})

test('참조 카드(7d): 이름 + 참조 신호만 맞는다 — 이름만 나오는 내용 말은 반응하지 않는다', () => {
  for (const [text, id] of [['토스처럼 해주세요', 'ref-toss'], ['스포티파이 느낌이면 좋겠다', 'ref-spotify'], ['gruvbox 테마의 색감을 기준으로', 'ref-gruvbox'], ['make it like notion', 'ref-notion'], ['linear-style dashboard feel', 'ref-linear']]) {
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    assert.deepEqual(r.sources, [id], text)
  }
  for (const text of ['인스타그램 링크를 푸터에 넣어줘', '유튜브 영상을 히어로에 넣어줘', '토스로 결제할 수 있게 해주세요', '토스트 세트 메뉴 추가해줘', 'Slack 연동 로고를 보여줘', '당근 케이크가 시그니처 메뉴예요', '터미널 근처 카페예요']) {
    assert.equal(interpret(text, lex).result, 'unknown', text)
  }
})

test('참조 카드: 이름 둘에 신호 하나가 걸린 말은 한쪽만 적용하지 않고 묻는다', () => {
  for (const text of ['Notion이나 Slack의 UI/UX를 참고해서', '토스랑 애플처럼 해줘', '네이버, 카카오 느낌으로 해주세요']) {
    assert.equal(interpret(text, lex).result, 'unknown', text)
  }
})

test('참조 카드: 카드마다 reading 축은 3개 이하이고 모두 사전 규칙을 통과한다', () => {
  const cards = lex.entries.filter((e) => e.kind === 'reference')
  assert.ok(cards.length >= 30, `${cards.length}`)
  for (const c of cards) assert.ok(new Set(c.reading.map((x) => x.axis)).size <= 3, c.id)
})

test('범위(7e): 요소·구획·쪽 이름이 바로 앞에 오면 범위가 붙고, 사이에 다른 말이 끼면 사이트 전체다', () => {
  const sc = (text) => interpret(text, lex).readings.map((x) => x.scope)
  assert.deepEqual(sc('버튼 둥글게'), ['element:버튼'])
  assert.deepEqual(sc('버튼 색을 파랑으로'), ['element:버튼'])
  assert.deepEqual(sc('본문 글씨 크게'), ['element:본문'])
  assert.deepEqual(sc('푸터 부분은 좀 더 밝게'), ['section:footer'])
  assert.deepEqual(sc('FAQ 쪽만 차분하게'), ['section:faq', 'section:faq', 'section:faq'])
  assert.deepEqual(sc('메인 페이지는 시원하게'), ['page:home'])
  assert.deepEqual(sc('푸터 링크를 추가하고 전체적으로 깔끔하게'), ['site', 'site', 'site'])
  assert.deepEqual(sc('홈페이지를 고급스럽게 만들어줘'), ['site', 'site', 'site'], '홈페이지는 사이트 전체를 뜻한다(쪽 이름이 아니다)')
})

test('사진·아이콘 크기는 12축에 없다 — 글자 크기로 읽지 않고 묻는다', () => {
  for (const text of ['사진 크게', '사진 크기 키워줘', '아이콘 작게']) assert.equal(interpret(text, lex).result, 'unknown', text)
  assert.equal(interpret('사진만 밝게', lex).readings[0].scope, 'element:사진')
  assert.equal(interpret('사진 밝게', lex).readings[0].scope, 'site', '이름만 앞에 있는 사진은 범위가 아니다(「브랜드 이미지가」「사진이 심플하더라고요」)')
  assert.equal(interpret('브랜드 이미지가 고급스럽게 보였으면', lex).readings[0].scope, 'site')
})

test('세기(7e): 확·훨씬·정말은 2, 조금·살짝은 1, 둘이 겹치면 가까운 쪽', () => {
  const st = (text) => interpret(text, lex).readings[0].strength
  assert.equal(st('확 크게'), 2)
  assert.equal(st('정말 고급스럽게'), 2)
  assert.equal(st('살짝만 따뜻하게'), 1)
  assert.equal(st('아주 조금 둥글게'), 1)
  assert.equal(st('완전 동그랗게'), 2, '「완전 동그랗」은 모서리 낱말이다(세기 낱말이 먹지 않는다)')
})

test('부정(7e): 싫어요·말고·하지 마세요·영어 never/without 도 앞(영어는 뒤) 낱말 묶음의 상한이 된다', () => {
  for (const [text, axis] of [['차가운 느낌은 싫어요', 'color-temperature'], ['너무 밝은 것도 싫어요', 'color-lightness'], ['어둡게 하지 마세요', 'color-lightness'], ["don't make it too cold", 'color-temperature'], ['never use red', 'color-hue'], ['without any shadows', 'depth']]) {
    const r = interpret(text, lex)
    assert.ok(r.readings.some((x) => x.axis === axis && x.cap && x.strength === 0), text)
  }
  const m = interpret('빨강 말고 파랑으로', lex)
  assert.ok(has(m.readings, { axis: 'color-hue', value: 'red', cap: true }) && has(m.readings, { axis: 'color-hue', value: 'blue', strength: 1 }))
})

test('덜·줄여(7e): 반대쪽 낱말이 있으면 반대쪽으로, 없으면 같은 방향으로 읽지 않고 묻는다', () => {
  assert.equal(interpret('덜 화려하게', lex).sources[0], 'calm')
  assert.equal(interpret('덜 어둡게 해줘', lex).sources[0], 'brighter')
  assert.equal(interpret('어두운 거 줄여줘', lex).sources[0], 'brighter')
  for (const text of ['덜 귀엽게 해줘', '깔끔한 건 좀 줄여줘', '고급스러움 줄여줘']) assert.equal(interpret(text, lex).result, 'unknown', text)
  assert.equal(interpret('그림자 줄여줘', lex).sources[0], 'flatter', '옛 낱말 「그림자 줄여」는 그대로')
})

test('문구(글) 이야기는 디자인 인상으로 읽지 않는다 — 문구 수정은 parseRevision 이 맡는다', () => {
  for (const text of ['소개 문구를 더 따뜻하게 바꿔줘', '문구를 간결하게 줄여주세요', '말투를 좀 더 정중하게', '히어로 문구를 친근하게', '카피를 조금 더 재미있게', '캐치프레이즈를 재미있게']) {
    assert.equal(interpret(text, lex).result, 'unknown', text)
  }
  assert.equal(interpret('따뜻하게', lex).result, 'confirmed')
})

test('진단 뒤의 「싫어요」는 상한이 아니다 — 진단에 상한이 붙지 않는다', () => {
  const r = interpret('답답해 보여서 싫어요', lex)
  assert.equal(r.result, 'two')
  assert.ok(r.options.every((o) => o.readings.every((x) => !x.cap)))
})

test('참조 카드: 이름 + 기능 말(처럼·같은)은 디자인 참조가 아니다', () => {
  for (const text of ['배민처럼 주문 받는 기능', '토스처럼 송금 기능', '넷플릭스 같은 구독 결제', '인스타그램처럼 사진 올리는 기능', '유튜브처럼 영상 목록', '슬랙처럼 채널 만드는 기능', '당근처럼 동네 인증', '에어비앤비처럼 예약 받기', '마켓컬리처럼 새벽배송 안내', '무신사처럼 상품 많이 보여줘', '노션처럼 페이지 나눠서 정리해줘', '디스코드 같은 커뮤니티', '카카오 같은 친구톡 알림 기능', '쿠팡처럼 빠른 배송 문구', '깃허브 스타일 잔디 그래프']) {
    assert.equal(interpret(text, lex).result, 'unknown', text)
  }
  for (const [text, id] of [['토스처럼 해주세요', 'ref-toss'], ['카카오 같은 느낌이면 좋겠어요', 'ref-kakao'], ['디스코드 같은 분위기로', 'ref-discord'], ['깃허브 스타일로 해줘', 'ref-github']]) assert.deepEqual(interpret(text, lex).sources, [id], text)
})

test('부정이 반대 방향으로 읽히지 않는다 — 안·못(앞/뒤), 빼줘, 영어 no/less 는 상한', () => {
  for (const [text, axis, dir] of [['안 밝게 해주세요', 'color-lightness', 'bright'], ['안 어둡게 해줘', 'color-lightness', 'dark'], ['안 둥글게 해줘', 'shape', 'round'], ['밝게 안 해도 돼요', 'color-lightness', 'bright'], ['둥글게 안 했으면', 'shape', 'round'], ['빨간색 빼줘', 'color-hue', 'red'], ['no shadows', 'depth', 'lifted'], ['no rounded corners', 'shape', 'round'], ['no dark mode', 'color-lightness', 'dark'], ['less colorful', 'palette-count', 'more'], ['less dark', 'color-lightness', 'dark'], ['less bright', 'color-lightness', 'bright'], ['less rounded', 'shape', 'round']]) {
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    assert.ok(r.readings.every((x) => x.cap && x.strength === 0), text)
    assert.ok(r.readings.some((x) => x.axis === axis && (x.direction === dir || x.value === dir)), text)
  }
  assert.deepEqual(interpret('덜 밝게', lex).readings.map((x) => x.direction), ['dark'])
  assert.equal(interpret('안심하고 쓸 수 있게 해주세요', lex).readings.some((x) => x.cap), false, '「안심」은 부정이 아니다')
})

test('인상 묶음의 상한은 대표 축 하나에만 걸린다', () => {
  const r = interpret('어두운 건 싫어요', lex)
  assert.deepEqual(r.readings.map((x) => x.axis), ['color-lightness'])
})

test('진단: 같은 진단 낱말이 둘이어도 후보 둘 · 진단에 붙은 부정은 상한이 아니라 같은 말', () => {
  const a = interpret('어디서 많이 본 디자인이라 뻔해', lex)
  assert.equal(a.result, 'two')
  const b = interpret('촌스럽지 않게 해주세요', lex)
  assert.equal(b.result, 'two')
  assert.ok(b.options.every((o) => o.readings.every((x) => !x.cap)))
})

test('진단 낱말은 내용 문장에 반응하지 않는다(피부·상사·업체·집 정리)', () => {
  for (const text of ['피부에 생기가 없어서 관리실 찾는 분들이 많아요', '칙칙한 피부 톤 개선 관리', '뭐가 중요한지 알려주는 수학 강의', '정이 안 가는 상사 대처법', '신뢰가 안 가는 업체 거르는 법', '어수선한 집 정리 서비스']) {
    assert.equal(interpret(text, lex).result, 'unknown', text)
  }
})

test('안(7e 보정): 낱말 전체인 부정만 상한이다 — 명사 「안에」「안쪽」과 부탁·조건·없다는 말은 그대로', () => {
  const caps = (text) => interpret(text, lex).readings.filter((x) => x.cap).length
  for (const text of ['박스 안에 글씨 크게', '박스 안 글씨 크게', '안쪽 여백을 넓게 해주세요', '카드 안의 글자는 크게 해줘', '밝게 해주면 안 될까요?', '어둡게 해주면 안 되나요', '밝게 해줘 안 그러면 너무 어두워', '따뜻한 느낌이 안 나요', '어둡게 하면 안 돼요?']) {
    assert.equal(caps(text), 0, text)
  }
  for (const text of ['안 밝게 해주세요', '밝게 안 해도 돼요', '둥글게 안 했으면', '어둡게 하면 안 돼요', '어둡게 하면 안돼요', '둥글게 하면 안됩니다', '밝은 색이 안 어울려요']) {
    assert.equal(caps(text), 1, text)
  }
  assert.ok(has(interpret('따뜻한 느낌이 안 나요', lex).readings, { axis: 'color-temperature', direction: 'warm', strength: 1 }), '없다는 불만은 그 방향으로 읽는다')
})

test('부정이 겹치면(「안 밝게 하지 마」) 묻는다', () => {
  assert.equal(interpret('안 밝게 하지 마', lex).result, 'unknown')
})

test('인상 묶음의 상한은 사전 reading 의 첫 항목에 걸린다(해석기 약속)', () => {
  for (const [text, id] of [['어두운 건 싫어요', 'dark'], ['너무 화려하지 않게', 'lively'], ['따뜻하지 않게', 'warm'], ['믿음직하지 않게', 'trust']]) {
    const first = lex.entries.find((x) => x.id === id).reading[0]
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    const capped = r.readings.filter((x) => x.source === id)
    assert.equal(capped.length, 1, `${text}: 첫 reading 하나만`)
    assert.equal(capped[0].axis, first.axis, text)
    assert.equal(capped[0].direction ?? capped[0].value, first.direction ?? first.value, text)
    assert.ok(capped[0].cap && capped[0].strength === 0, text)
  }
})

test('대략 분류: confirmed 는 kind(대표 읽기를 낸 항목의 갈래)와 lead(첫 읽기의 축 + 방향)를 돌려준다', () => {
  const lex = loadLexicon()
  const plain = interpret('글씨 크게', lex)
  assert.equal(plain.kind, 'axis')
  assert.deepEqual(plain.lead, { axis: 'type-scale', direction: 'larger' })
  const impression = interpret('고급스럽게', lex)
  assert.equal(impression.kind, 'impression')
  assert.equal(impression.lead.axis, impression.readings[0].axis)
})

test('대략 분류: 범위·세기·부정이 붙으면 문장의 갈래는 modifier, lead 는 그대로 첫 읽기', () => {
  const lex = loadLexicon()
  for (const text of ['제목만 크게', '확 크게', '차갑지 않게']) {
    const r = interpret(text, lex)
    assert.equal(r.kind, 'modifier', text)
    assert.deepEqual(r.lead, { axis: r.readings[0].axis, direction: r.readings[0].direction }, text)
  }
})

test('대략 분류: 값 읽기(색조·글꼴)의 lead 는 direction 대신 value', () => {
  const r = interpret('mono 폰트 쓰고 싶어', loadLexicon())
  assert.equal(r.result, 'confirmed')
  assert.deepEqual(r.lead, { axis: 'type-family', value: r.readings[0].value })
})

test('대략 분류: 후보 둘은 선택지마다 lead(그 선택지 읽기 묶음의 첫 읽기), 위쪽 lead·kind 는 첫 선택지와 진단의 갈래', () => {
  const r = interpret('너무 낡삭해', lexWith(DIAG))
  assert.equal(r.result, 'two')
  assert.equal(r.kind, 'diagnosis')
  assert.deepEqual(r.options.map((o) => o.lead), [{ axis: 'type-family', value: 'distinctive' }, { axis: 'depth', direction: 'flat' }])
  assert.deepEqual(r.lead, r.options[0].lead)
})

test('대략 분류: 사전 낱말이 하나도 안 맞은 모름만 unmatched, 부딪침·겹부정·원인 하나뿐인 진단 질문은 아니다', () => {
  const lex = loadLexicon()
  assert.equal(interpret('ㅋㅋㅋ', lex).unmatched, true)
  assert.equal(interpret('', lex).unmatched, true)
  assert.equal(interpret('밝고 어둡게', lex).unmatched, undefined, '부딪침')
  assert.equal(interpret('덤덤해', lexWith(DIAG)).unmatched, undefined, '원인이 하나뿐인 진단')
})


test('걸릴 곳을 못 찾은 부정은 버리지 않고 묻는다 — 버리면 「그림자 너무 세지 않게」가 그림자를 더 키우라는 반대 뜻이 된다', () => {
  const lex = loadLexicon()
  const lost = interpret('그림자 너무 세지 않게 해줘', lex)
  assert.equal(lost.result, 'unknown')
  assert.notEqual(lost.unmatched, true, '낱말은 맞았으니 예문으로 넘기지 않고 되묻는다')
  assert.match(lost.ask, /걸리는지/)
  assert.equal(interpret('그림자 너무 세지 않게 해줘', lex).readings, undefined)
  // 다른 부정이 이미 붙은 묶음은 그대로 확정: 「차가운 느낌은 싫어요 brand랑 안 맞아」
  const kept = interpret('차가운 느낌은 싫어요 brand랑 안 맞아', lex)
  assert.equal(kept.result, 'confirmed')
  assert.ok(has(kept.readings, { axis: 'color-temperature', direction: 'cool', strength: 0, cap: true }))
  // 진단에 붙으려다 못 붙은 부정은 원래대로 버린다(고쳐 달라는 말과 같다)
  assert.notEqual(interpret('우중충해서 손님이 싫어할 것 같아', lex).ask?.includes('걸리는지'), true)
})

test('반대로 읽히던 네 가지 문장은 이제 확정하지 않는다 — 요청형·원래 말은 그대로 확정', () => {
  const lex = loadLexicon()
  const notConfirmed = (text) => assert.notEqual(interpret(text, lex).result, 'confirmed', text)
  notConfirmed('푸터 여백 확 줄여줘') // 낱말 「여백」이 시원하게로 읽히던 것 — 줄이라는 말이 세기 낱말에 끊겼다
  notConfirmed('좀 차가워 보이네요') // 보이는 모습을 말한 것이지 차갑게 해 달라는 말이 아니다
  notConfirmed('색이 너무 많지 않았으면 좋겠어요') // 「너무 많」은 문제를 말한 낱말이라 부정이 붙으면 줄이지 말라는 뜻으로 뒤집혔다
  notConfirmed('여백이 너무 많지 않게')
  notConfirmed('색이 너무 적지 않게')
  const cool = interpret('차가워 보이게 해줘', lex)
  assert.equal(cool.result, 'confirmed')
  assert.ok(has(cool.readings, { axis: 'color-temperature', direction: 'cool' }))
  assert.ok(has(interpret('여백 줄여줘', lex).readings, { axis: 'spacing', direction: 'tight' }))
  assert.ok(has(interpret('색이 너무 많아요', lex).readings, { axis: 'palette-count', direction: 'fewer', strength: 1 }))
})

test('덧붙인 「너무 ~하지 않게」는 앞 묶음이 이미 서술어로 끝났으면 버리고 그대로 확정, 맨 명사 뒤에서만 묻는다', () => {
  const lex = loadLexicon()
  const hedges = [
    ['둥글게 너무 과하지 않게', { axis: 'shape', direction: 'round' }],
    ['글씨 크게 너무 튀지 않게', { axis: 'type-scale', direction: 'larger' }],
    ['배경 어둡게 너무 칙칙하지 않게', { axis: 'color-lightness', direction: 'dark' }],
    ['여백 넓게 너무 휑하지 않게', { axis: 'spacing', direction: 'airy' }],
    ['따뜻하게 너무 노랗지 않게', { axis: 'color-temperature', direction: 'warm' }],
    ['제목 크게 본문은 작지 않게', { axis: 'type-scale', direction: 'larger' }],
  ]
  for (const [text, want] of hedges) {
    const r = interpret(text, lex)
    assert.equal(r.result, 'confirmed', text)
    assert.ok(has(r.readings, { ...want, strength: 1 }), `${text} → ${JSON.stringify(r.readings)}`)
  }
  const bare = interpret('그림자 너무 세지 않게 해줘', lex)
  assert.equal(bare.result, 'unknown', '맨 명사 뒤의 부정은 걸린 곳을 몰라 묻는다')
  assert.match(bare.ask, /걸리는지/)
})

test('세기 낱말이 두 낱말 표현 사이에 끼어도(여백 {세기} 줄) 맨 낱말 「여백」이 시원하게로 읽히지 않는다 — 사전의 세기 항목마다', () => {
  const lex = loadLexicon()
  const words = lex.entries.filter((e) => e.kind === 'modifier' && e.effect?.strength !== undefined).flatMap((e) => e.match.ko ?? [])
  assert.ok(words.length >= 5, '세기 낱말이 사전에 있다')
  for (const w of words) {
    for (const verb of ['줄여줘', '좁혀줘']) {
      const r = interpret(`여백 ${w} ${verb}`, lex)
      assert.ok(r.result !== 'confirmed' || !has(r.readings, { axis: 'spacing', direction: 'airy' }), `여백 ${w} ${verb} → ${JSON.stringify(r.readings)}`)
    }
  }
  assert.ok(has(interpret('여백 줄여줘', lex).readings, { axis: 'spacing', direction: 'tight' }), '끼지 않은 원래 표현은 그대로')
  assert.ok(has(interpret('여백 넓게', lex).readings, { axis: 'spacing', direction: 'airy' }), '맨 낱말 여백이 다른 문장에서 맞는 일은 그대로')
})

test('같은 항목이 한 문장에 둘이어도 이해한 내용은 한 번만 말한다', () => {
  const lex = loadLexicon()
  const once = interpret('따뜻하게', lex).say
  assert.equal(interpret('따뜻하고 따뜻하게', lex).say, once)
  assert.equal(interpret('따뜻하고 아늑하게', lex).say, once)
  assert.ok(interpret('따뜻하고 깔끔하게', lex).say.startsWith(once), '다른 항목의 말은 따로 붙는다')
})

// ── 갈래 D: 시안 비교 말(ctx.candidates) ──────────────────────────────────────────────────────
const CANDS = { candidates: ['a', 'b', 'c'] }

test('「2번 시안처럼」 + candidates [a,b,c] → 읽기 없이 copyFrom b (갈래 reference, 대표 읽기 없음)', () => {
  const r = interpret('2번 시안처럼', loadLexicon(), CANDS)
  assert.equal(r.result, 'confirmed')
  assert.deepEqual(r.readings, [])
  assert.equal(r.copyFrom, 'b')
  assert.equal(r.kind, 'reference')
  assert.equal(r.lead, null)
  assert.deepEqual(r.sources, [])
  assert.ok(HANGUL.test(r.say))
})

test('candidates 없음 → 시안 말도 예전 그대로 모름(unmatched) — ctx 를 주지 않은 것과 한 글자도 다르지 않다', () => {
  const lex = loadLexicon()
  for (const text of ['2번 시안처럼', '아까 게 나았어', '첫 번째 안이 더 좋았어요', '따뜻하게', 'like option 2']) {
    assert.deepEqual(interpret(text, lex, {}), interpret(text, lex), text)
    assert.deepEqual(interpret(text, lex, { candidates: [] }), interpret(text, lex), `${text} (빈 목록)`)
  }
  assert.equal(interpret('2번 시안처럼', lex).result, 'unknown')
  assert.deepEqual(interpret('따뜻하게', lex, CANDS), interpret('따뜻하게', lex), '시안 말이 없는 문장은 candidates 가 있어도 같다')
})

test('「아까 게」·「아까 시안 2번」: 아까 것은 previous, 번호가 함께 있으면 번호가 이긴다 · 첫/두/세 번째 안', () => {
  const lex = loadLexicon()
  assert.equal(interpret('아까 게 나았어', lex, CANDS).copyFrom, 'previous')
  assert.equal(interpret('아까 거로 다시 해줘', lex, CANDS).copyFrom, 'previous')
  assert.equal(interpret('아까 시안 2번 같은 느낌이 나았어', lex, CANDS).copyFrom, 'b')
  assert.equal(interpret('첫 번째 안이 더 좋았어요', lex, CANDS).copyFrom, 'a')
  assert.equal(interpret('세 번째 시안으로 해 주세요', lex, CANDS).copyFrom, 'c')
})

test('영어: "like option 2" · "go back to the previous one" → 영어 이해한 내용', () => {
  const lex = loadLexicon()
  const a = interpret('make it like option 2', lex, CANDS)
  assert.equal(a.copyFrom, 'b')
  assert.ok(!HANGUL.test(a.say), a.say)
  const b = interpret('go back to the previous one', lex, CANDS)
  assert.equal(b.copyFrom, 'previous')
  assert.ok(!HANGUL.test(b.say), b.say)
})

test('없는 번호는 모름(되묻는 글에 시안 수) · 시안 말과 다른 수정이 한 문장에 있으면 되묻는다', () => {
  const lex = loadLexicon()
  const missing = interpret('5번 시안처럼', lex, CANDS)
  assert.equal(missing.result, 'unknown')
  assert.ok(missing.ask.includes('3'), missing.ask)
  assert.equal(interpret('0번 시안처럼', lex, CANDS).result, 'unknown')
  const mixed = interpret('2번 시안처럼 하되 더 밝게', lex, CANDS)
  assert.equal(mixed.result, 'unknown')
  assert.ok(!('copyFrom' in mixed))
})

test('횟수 말과 겹치는 「{n}번 안」은 비교 표지가 바로 뒤에 붙을 때만 시안 말이다 — 「두 번 안 해도 돼요」는 시안 따라 하기가 아니다', () => {
  const lex = loadLexicon()
  for (const text of ['두 번 안 해도 돼요', '2번 안 해도 돼요', '세 번 안 가요']) {
    const r = interpret(text, lex, CANDS)
    assert.ok(!('copyFrom' in r), `${text} → ${JSON.stringify(r)}`)
    assert.deepEqual(r, interpret(text, lex), `${text}: 시안 문맥이 있어도 없는 것과 같다`)
  }
  assert.equal(interpret('2번 안처럼 해 주세요', lex, CANDS).copyFrom, 'b')
  assert.equal(interpret('두 번 안으로 해줘', lex, CANDS).copyFrom, 'b')
  assert.equal(interpret('2번 안 같이 해줘', lex, CANDS).copyFrom, 'b')
  assert.equal(interpret('두 번째 안이 좋았어요', lex, CANDS).copyFrom, 'b', '번째가 있으면 표지가 필요 없다')
})
