// 소개형 전달(sitebrew v0.2.0 계획 3 Task 9) — 사이트는 지금처럼 복사하고(deliver.mjs), 「문의 받기」를 골랐고 시안에 문의 폼·신청(lead) 블록이 있으면
// 가짜 문의 접수를 더한다: app/api/inquiry/route.ts 를 넣고 lib/contact.ts 를 contact.mock.ts 로 바꾼다(전화·카카오 갈래와 makeContactPorts·makeLeadPorts 이름은 그대로, 보내기만 /api/inquiry).
// 자산은 deliver-assets/inquiry/ — stamp 가 사이트에 복사하는 폴더 밖이라 찍어낸 사이트(골든)는 달라지지 않는다. expect.json 은 접수 한 번 뒤 가짜 메일 기록의 template 별 줄 수다.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const INQUIRY_ASSETS = join(dirname(fileURLToPath(import.meta.url)), 'deliver-assets', 'inquiry')
export const INQUIRY_EXPECT = JSON.parse(readFileSync(join(INQUIRY_ASSETS, 'expect.json'), 'utf8'))
/** 완성 확인이 보내는 시험용 문의(보낸 사람 정보) — 가짜 메일 기록에 이 값이 새지 않는지 본다. 사용자 문장이 아니라 시험 자료라 데이터 파일(sample.json)에 둔다. */
export const INQUIRY_SAMPLE = JSON.parse(readFileSync(join(INQUIRY_ASSETS, 'sample.json'), 'utf8'))
/** 소개형 전달물 안에서 자산이 들어가는 자리 */
export const INQUIRY_TARGETS = { route: join('app', 'api', 'inquiry', 'route.ts'), contact: join('lib', 'contact.ts'), copy: join('lib', 'inquiry-copy.json') }

/** 시안(site.json)의 섹션 블록 중 문의 폼(contact 특성)이나 신청 폼(lead 특성)이 있는가. gen-pages 의 blockTraits 가 정한다. */
export async function hasInquiryForm(site) {
  const { blockItems, blockTraits } = await import('./gen-pages.mjs')
  const items = blockItems()
  return Object.values(site.sections ?? {}).some((s) => {
    const item = items.get(s?.block)
    if (!item) return false
    const t = blockTraits(item)
    return t.contact || t.lead
  })
}

/** 문의 접수를 붙일 것인가: 기능에 inquiry 가 있고 시안에 문의 폼·신청 블록이 있다. */
export async function wantsInquiry(features, site) {
  return features.outcomes.includes('inquiry') && (await hasInquiryForm(site))
}

/**
 * 가짜 문의 접수를 dest 에 더한다. 복사된 lib/contact.ts 가 없으면 던진다(사이트 모양이 바뀌었다는 뜻이라 조용히 넘기지 않는다).
 * runtimeCopy = deliver-copy.json 의 inquiryRuntime — 접수 코드가 읽는 문장이라 lib/inquiry-copy.json 으로 써 준다(자산 코드에는 사용자 문장이 없다).
 */
export function addInquiryMock(dest, runtimeCopy) {
  if (!existsSync(join(dest, INQUIRY_TARGETS.contact))) throw new Error(`lib/contact.ts 가 없다: ${dest} — 사이트 모양이 바뀌었는지 본다`)
  const route = join(dest, INQUIRY_TARGETS.route)
  mkdirSync(dirname(route), { recursive: true })
  copyFileSync(join(INQUIRY_ASSETS, 'route.ts'), route)
  copyFileSync(join(INQUIRY_ASSETS, 'contact.mock.ts'), join(dest, INQUIRY_TARGETS.contact))
  writeFileSync(join(dest, INQUIRY_TARGETS.copy), JSON.stringify(runtimeCopy, null, 2) + '\n')
  return [INQUIRY_TARGETS.route, INQUIRY_TARGETS.contact, INQUIRY_TARGETS.copy].map((p) => p.split('\\').join('/'))
}

/**
 * 고른 기능 중 소개형 전달물에 반영되지 않은 것 — README 가 한 줄씩 알린다. 소개형은 문의 접수만 더할 수 있다:
 * 문의는 시안에 문의 폼·신청 블록이 있을 때만(없으면 why = 'form'), 그 밖의 기능(방문자 수·마케팅 동의 …)은 넣을 곳이 없다(why = 'type').
 * @returns {Array<{ id: string, why: 'form'|'type' }>}
 */
export const unappliedFeatures = (features, inquiryApplied) =>
  features.outcomes.filter((id) => !(id === 'inquiry' && inquiryApplied)).map((id) => ({ id, why: id === 'inquiry' ? 'form' : 'type' }))

/** 소개형 전달: 사이트는 이미 dest 에 복사돼 있다. → { inquiry: boolean, added: string[] } */
export async function deliverIntro({ dest, features, site, runtimeCopy }) {
  if (!(await wantsInquiry(features, site))) return { inquiry: false, added: [] }
  return { inquiry: true, added: addInquiryMock(dest, runtimeCopy) }
}
