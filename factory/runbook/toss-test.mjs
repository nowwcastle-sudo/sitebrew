// 시험 전용 경로의 런북. 생성된 일반 결제 장을 이 선택에서만 대체한다.
export const TOSS_TEST_CHECK_SKIP = {
  ko: '토스 시험 전용 앱에는 일반 완성 확인을 적용할 수 없어 건너뛰었어요. 별도의 개발 환경 시험은 전달 폴더의 docs/toss-test.md를 확인해 주세요.',
  en: 'The standard completion check does not apply to the Toss test-only app and was skipped. See docs/toss-test.md in the delivered folder for the separate development test.',
}

export function tossTestData(data) {
  const original = data.chapters['G-billing']
  if (!original) return data
  const ko = '이 경로는 토스페이먼츠 시험 전용이며 실결제를 지원하지 않아요.\n\n모의 시험은 개발 서버에서 `LF_MODE=mock`, `LF_TOSS_TEST=1`, `LF_TOSS_TEST_FAKE=1`을 사용해요. 카드 등록과 모의 청구는 유료 권한을 켜지 않아요. 설정과 제한은 전달 폴더의 `docs/toss-test.md`를 확인해요. 요금은 확인하지 않았어요.'
  const en = 'This Toss Payments path is for testing only and does not support real payments.\n\nFor a mock test use `LF_MODE=mock`, `LF_TOSS_TEST=1`, and `LF_TOSS_TEST_FAKE=1` on the development server. Card registration and mock charges do not enable paid access. See `docs/toss-test.md` in the delivered folder for setup and limitations. Fees have not been checked.'
  const chapter = {
    ...original,
    file: 'toss-test.md',
    card: { ...original.card, service: '토스페이먼츠 시험 전용 / Toss Payments test only', cost: [], home: null, devOnly: [], notEnv: [], ifSkipped: { ko: '시험을 진행할 수 없어요.', en: 'The test cannot run.' } },
    text: { ko: { title: '토스페이먼츠 시험 전용', body: ko }, en: { title: 'Toss Payments test only', body: en } },
    envNames: ['LF_MODE', 'LF_TOSS_TEST', 'LF_TOSS_TEST_FAKE'],
    mustName: [],
    actions: { ko: 1, en: 1 },
    staleAfter: '2026-11-26',
  }
  return { ...data, chapters: { ...data.chapters, 'G-billing': chapter } }
}
