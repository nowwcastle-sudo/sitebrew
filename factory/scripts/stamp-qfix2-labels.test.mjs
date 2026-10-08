// FV1 Task 6.3 2차(QFIX2) — 영어 사이트 화면 이름표 번역표 보강.
// 골든 실측: landing-2 b·portfolio-2 c 는 한 몽타주 히어로의 「컷 전환 멈추기」 한 곳, pwa-2 는 권한 화면(account/permissions)의 일반 이름표 15곳이 한글로 남아 「다른 언어의 화면 문구」 사유가 났다.
// 일반 이름표는 번역표 몫이고(사업 문장 없음), 권한을 쓰는 까닭(why)처럼 이 사업의 문장만 화면 문구 칸 몫이다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-qfix2-labels.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blockItems, fixtureOf } from '../stamp/gen-pages.mjs'
import { localizeEnglishLabels } from '../stamp/ui-labels-en.mjs'
import { leaves } from '../stamp/site-bind.mjs'

const HANGUL = /[가-힣]/
const koLeaves = (props) => leaves(props).filter((l) => l.ref === null && HANGUL.test(String(l.value ?? ''))).map((l) => l.path)

test('몽타주 히어로: 멈춤·소리 단추 이름표가 영어로 바뀐다 — 남는 한글은 이 사업의 문장(제목·문단·단추 글)뿐', async () => {
  const props = await fixtureOf(blockItems().get('block-hero-video-montage'))
  props.copy.soundLabel = '소리 켜기'
  localizeEnglishLabels(props)
  assert.equal(props.copy.pauseLabel, 'Pause cut transitions')
  assert.equal(props.copy.soundLabel, 'Turn sound on')
  assert.equal(koLeaves(props).includes('copy.pauseLabel'), false)
})

test('권한 화면: 일반 이름표(상태·권한 이름·다시 확인·바꾸는 법)가 영어로 바뀌고 남는 한글은 권한을 쓰는 까닭(why) 둘뿐', async () => {
  const props = await fixtureOf(blockItems().get('block-account-permissions'))
  localizeEnglishLabels(props)
  const left = koLeaves(props)
  assert.deepEqual(left.sort(), ['copy.items[0].why', 'copy.items[1].why'], left.join(', '))
  assert.equal(props.copy.stateLabels.granted, 'Allowed')
  assert.equal(props.copy.recheckLabel, 'Check again')
})
