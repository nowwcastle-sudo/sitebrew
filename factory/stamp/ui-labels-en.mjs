// 영어(en) 사이트의 화면 이름표 번역표(FV1 Task 5.14, C5 「다른 언어의 화면 문구」) — 블록 예시(fixture)는 한국어라 영어 사이트의 섹션 props 에 그 이름표가 한글 그대로 남았다.
// 블록 코드는 한국어를 직접 쓰지 않으므로(blocks-i18n.test.mjs) 이름표는 예시 모듈이 들고 있고, 06 의 bindSection 이 영어 사이트에서 이 표로 바꾼다(한 글자도 안 바뀌는 쪽은 한국어 사이트).
//   · 사업을 말하지 않는 일반 화면 이름표만 싣는다(푸터 항목 이름·상태 화면 단추·동의 항목·요일·열기/닫기 문장 …). 예시 사업의 문장(「예약 받기 설정」·「이번 주 근무표」)은 싣지 않는다 —
//     그것은 화면 문구 칸(ui-copy.mjs, 영어 사이트의 한글 잎)이나 콘텐츠가 이 사업의 말로 바꿀 몫이다. 표에 없는 한글은 그대로 남아 「다른 언어의 화면 문구」 사유가 된다.
//   · 키는 예시의 글자 그대로(완전 일치), 자리 표시({n}·{time}…)는 영어 쪽에도 같은 것을 둔다.
export const EN_UI = {
  // 첫 화면·공통
  '첫 화면': 'First screen', '제품 화면': 'Product screen', '실제 제품 화면 필요': 'Real product screen needed', '전부 보기': 'View all', '장면 고르기': 'Choose a scene', '{n}번 장면 — {name}': 'Scene {n} — {name}', '영상 속 장소': 'Places in the video', '사진 속 자리': 'Places in the photos',
  '배경 움직임 멈추기': 'Pause background motion', '컷 전환 멈추기': 'Pause cut transitions', '소리 켜기': 'Turn sound on', '자주 찾는 서비스': 'Frequently used services', '대표 안내': 'Main notice', '질문 목록': 'Question list', '작업 목록': 'Work list',
  '부가세 포함': 'VAT included', '부가세 별도': 'VAT not included',
  // 푸터
  '사이트 링크': 'Site links', '상호': 'Business name', '대표자': 'Representative', '사업자등록번호': 'Business registration number', '통신판매업 신고번호': 'Mail-order business number',
  '주소': 'Address', '전화': 'Phone', '메일': 'Email', '사업자정보 확인': 'Check business information', '이용약관': 'Terms of service', '개인정보 처리방침': 'Privacy policy',
  '약관과 정책': 'Terms and policies', '사업자 정보': 'Business information',
  // 요금·FAQ·후기·연동 머리
  '요금제': 'Pricing', '추천': 'Recommended', '/월': '/mo', '별도 문의': 'Contact us', '무료로 시작': 'Start for free', '자주 묻는 질문': 'Frequently asked questions',
  '먼저 쓴 분들의 이야기': 'What early users say', '이전 후기': 'Previous review', '다음 후기': 'Next review', '{current}번째 후기, 모두 {total}개': 'Review {current} of {total}',
  '기본 연동': 'Native integration', '웹훅': 'Webhook', '쓰던 도구와 그대로 이어집니다': 'Works with the tools you already use',
  // 공지
  '공지': 'Notice', '공지 닫기': 'Close notice', '공지 자동 넘김': 'Pause notice auto-advance',
  // 권한 화면(account/permissions) — 일반 이름표. 권한을 쓰는 까닭(why)은 이 사업의 문장이라 화면 문구 칸이 맡는다.
  '알림과 위치 권한': 'Notification and location permissions', '권한': 'Permissions', '허락한 것만 써요. 언제든 브라우저 설정에서 바꿀 수 있어요.': 'We only use what you allow. You can change it any time in your browser settings.',
  '알림': 'Notifications', '위치': 'Location', '카메라': 'Camera', '마이크': 'Microphone', '알림 켜기': 'Turn on notifications', '위치 켜기': 'Turn on location', '카메라 켜기': 'Turn on the camera', '마이크 켜기': 'Turn on the microphone',
  '허용됨': 'Allowed', '차단됨': 'Blocked', '아직 묻지 않음': 'Not asked yet', '알 수 없음': 'Unknown', '권한을 바꾸려면': 'To change a permission', '다시 확인': 'Check again',
  '브라우저 주소 창 왼쪽의 자물쇠(또는 설정) 아이콘을 눌러요.': 'Select the lock (or settings) icon on the left of the browser address bar.', '「사이트 설정」에서 알림이나 위치를 골라요.': 'Choose notifications or location in Site settings.',
  '허용 또는 차단을 바꾼 뒤 이 화면으로 돌아와 「다시 확인」을 눌러요.': 'After changing Allow or Block, come back to this screen and select Check again.', '브라우저 설정의 사이트 권한에서 바꿔요.': "Change it in your browser's site permissions.",
  // 메뉴
  '오늘의 메뉴': "Today's menu", '품절': 'Sold out', '메뉴': 'Menu', '메뉴 분류': 'Menu categories', '대표 메뉴': 'Signature menu',
  // 상품 목록
  '{n}개 상품': '{n} products', '정가': 'List price', '{per}당 {price}': '{price} per {per}', '상품을 불러오는 중이에요': 'Loading products', '상품을 불러오지 못했어요': 'Could not load products',
  '오늘은 모두 팔렸어요': 'Everything is sold out for today',
  // 대시보드
  '다시 시도': 'Try again', '긴급': 'Urgent', '주의': 'Warning', '긴급 {critical} · 주의 {warning}': 'Urgent {critical} · Warning {warning}', '담당': 'Owner', '기한': 'Due',
  '할 일을 불러오는 중입니다': 'Loading tasks', '대시보드를 불러오지 못했어요': 'Could not load the dashboard', '지금 먼저': 'First up', '목표 {v}': 'Target {v}', '정상 {a}~{b}': 'Normal {a}–{b}',
  '{p} 대비': 'vs {p}', '{v} 늘었어요': 'Up {v}', '{v} 줄었어요': 'Down {v}', '변화 없음': 'No change', '대시보드를 불러오는 중이에요': 'Loading the dashboard', '아직 데이터가 없어요': 'There is no data yet',
  '차트 지표': 'Chart metrics', '목표': 'Target', '차트 값': 'Chart values', '{n}건': '{n} items', '기준': 'As of',
  // QFIX [4] — 골든 2차 dashboard-2(추세 + 표 로딩 문구)·landing-2(신청 폼 승인 안내·필수 표시·형식 오류)에 한글로 남던 일반 이름표. 사업을 말하지 않는다(대시보드 로딩 문구는 예약 사업 낱말이 들어 있어 표가 아니라 binder 가 생성기 이름표로 바꾼다).
  '주제별 자주 묻는 질문': 'Frequently asked questions by topic',
  '직접 확인하고 눌러 주세요': "You'll confirm this yourself", '(필수)': '(Required)',
  '이메일 형식이 맞지 않아요. @와 도메인을 확인해 주세요.': "That email address doesn't look right. Check the @ and the domain.", '입력한 내용을 확인해 주세요': 'Please check what you entered',
  // 상태 화면
  '처음 화면으로': 'Go to the home page', '도움이 필요하면': 'Need help?', '자세히(문의할 때 알려 주세요)': 'Details (share them when you contact us)', '오류 번호': 'Error code', '시각': 'Time',
  '다시 불러오는 중이에요': 'Reloading', '연결 없이 볼 수 있는 내용': 'Available offline', '오프라인이에요': 'You are offline', '다시 연결됐어요': 'You are back online', '마지막 저장': 'Last saved',
  '연결 다시 확인': 'Check the connection again', '새로 고침': 'Refresh', '저장된 내용': 'Saved content', '찾는 쪽이 없어요': 'We could not find that page', '응답이 늦어요': 'Taking longer than expected',
  '다시 불러오기': 'Reload', '고객센터에 문의': 'Contact support', '고객센터에 문의하기': 'Contact support',
  // 동의
  '방문 기록을 모아도 될까요?': 'May we collect visit records?', '항목별로 고르기': 'Choose by category', '쿠키를 항목별로 골라요': 'Choose cookies by category', '필수': 'Required',
  '로그인·장바구니처럼 사이트가 돌아가는 데 꼭 필요해요.': 'These are needed for the site to work, such as sign-in and the cart.', '늘 켜져 있어요': 'Always on', '방문 분석': 'Visit analytics',
  '마케팅': 'Marketing', '(선택)': '(Optional)', '선택한 대로 저장하기': 'Save my choices', '모두 거부하기': 'Reject all', '모두 허용하기': 'Allow all', '쿠키 설정을 저장했어요.': 'Your cookie settings are saved.',
  '쿠키 설정': 'Cookie settings', '허용': 'Allow', '거부': 'Reject', '아직 정하지 않았어요(꺼짐)': 'Not decided yet (off)', '마지막으로 정한 날: {date}': 'Last decided on {date}', '쿠키 설정 바꾸기': 'Change cookie settings',
  '필수 쿠키 말고는 모두 선택이에요. 꺼도 사이트의 모든 내용을 볼 수 있어요.': 'Everything except required cookies is optional. You can see all of the site with them off.',
  // 요금 기능표
  '요금제별 기능': 'Features by plan', '기능': 'Feature', '포함': 'Included', '없음': 'Not included', '시작하기': 'Get started',
  // 영업시간·위치
  '지금 가도 될까요?': 'Can I go now?', '영업 중': 'Open now', '쉬는 시간': 'On break', '지금은 닫았어요': 'Closed right now',
  '오늘 휴무': 'Closed today', '오늘은 {label}이라 쉬어요': 'Closed today for {label}', '{time}에 닫아요': 'Closes at {time}', '익일 {time}에 닫아요': 'Closes at {time} the next day', '{time}에 다시 열어요': 'Reopens at {time}',
  '오늘 {time}에 열어요': 'Opens today at {time}', '내일 {time}에 열어요': 'Opens tomorrow at {time}', '{day}요일 {time}에 열어요': 'Opens {day} at {time}', '오늘': 'Today', '휴무': 'Closed',
  '이번 주 영업시간': "This week's hours", '전화 걸기': 'Call', '네이버 지도로 길찾기': 'Directions on Naver Map', '영업시간과 오시는 길': 'Hours and directions', '요일별 영업시간': 'Opening hours by day',
  '요일': 'Day', '영업시간': 'Opening hours', '주소 복사': 'Copy address', '주소를 복사했어요': 'Address copied', '복사가 막혔어요. 주소를 눌러 직접 복사해 주세요': 'Copying was blocked. Select the address to copy it yourself.',
  '대중교통': 'Public transit', '주차': 'Parking', '쉬는 날·다른 시간': 'Days off and special hours', '쉬어요': 'Closed', '지도 앱으로 길찾기': 'Directions in a map app', '네이버 지도': 'Naver Map', '카카오맵': 'Kakao Map',
  // 문의 폼
  '편한 방법으로 물어보세요': 'Ask in the way that suits you', '상담 채널': 'Contact channels', '창이 열리지 않으면 여기를 눌러 주세요': 'If the window does not open, press here', '또는 메일로 남기기': 'Or leave a message by email',
  '이름(선택)': 'Name (optional)', '답장 받을 메일 주소': 'Email address for the reply', '문의 내용': 'Your message', '이 칸을 채워 주세요.': 'Please fill in this field.', '메일 앱 열기': 'Open mail app', '여는 중': 'Opening',
  '보내지 못했어요 — 적은 내용은 그대로 있어요': 'Could not send — what you wrote is still here', '확인이 필요한 칸이 있어요': 'Some fields need checking', '{seconds}초 뒤에 다시 보낼 수 있어요': 'You can send again in {seconds} seconds',
  '서버가 아직 답하지 않아요. 적은 내용은 그대로 있으니 다시 시도해 주세요.': 'The server has not answered yet. What you wrote is still here, so please try again.', '다시 시도하기': 'Try again',
  '여기서는 바꿀 수 없어요': 'This cannot be changed here', '직접 관리하는 곳으로 가기': 'Go to where you manage it', '직접 확인해 주세요': 'Please confirm this yourself', '요청한 변경을 받았어요.': 'We received the change you asked for.',
  '아직 아무것도 바뀌지 않았어요.': 'Nothing has changed yet.', '이 변경은 사람이 내용을 확인하고 직접 눌러야 해요.': 'A person has to review this change and press the button.', '화면의 확인 버튼을 직접 눌러 주세요.': 'Please press the confirm button on the screen yourself.',
  '메일 앱을 열었어요': 'We opened your mail app', '메일 앱 다시 열기': 'Open the mail app again', '다시 쓰기': 'Write again', '짧게 물어보세요': 'Ask in a few words', '이름': 'Name', '연락처': 'Phone',
  '개인정보 수집·이용에 동의해요(필수)': 'I agree to the collection and use of my personal information (required)', '문의 보내기': 'Send message', '보내는 중': 'Sending', '문의를 받았어요': 'We got your message', '접수 번호': 'Reference number', '새 문의 쓰기': 'Write a new message',
  // 하단 바
  '전화와 예약': 'Call and booking', '전화하기': 'Call', '예약하기': 'Book',
  // 제품 화면 공통(자주 쓰는 짧은 이름표)
  '닫기': 'Close', '취소': 'Cancel', '확인': 'Confirm', '저장': 'Save', '저장하기': 'Save', '다음': 'Next', '이전': 'Back', '완료': 'Done', '로그인': 'Sign in', '가입하기': 'Sign up', '이메일': 'Email', '비밀번호': 'Password',
}

// 요일 이름표는 `days` 칸 아래 키(mo~su)에서만 바꾼다 — 「일」이 날(day) 단위로도 쓰여 완전 일치로는 구분할 수 없다.
const WEEKDAY_EN = { 월: 'Mon', 화: 'Tue', 수: 'Wed', 목: 'Thu', 금: 'Fri', 토: 'Sat', 일: 'Sun' }
const HANGUL = /[가-힣]/
const isRef = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.$ref === 'string'

/**
 * props 의 literal 글자 중 표에 있는 한글 이름표를 영어로 바꾼다(제자리). 바뀐 글자 수를 돌려준다.
 * 표에 없는 한글은 건드리지 않는다 — 06 의 foreignTextIssue 가 사유로 낸다.
 */
export function localizeEnglishLabels(props) {
  let n = 0
  const swap = (text, parentKey) => {
    if (!HANGUL.test(text)) return undefined
    if (parentKey === 'days' && WEEKDAY_EN[text] !== undefined) return WEEKDAY_EN[text]
    return EN_UI[text]
  }
  const walk = (v, parentKey) => {
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { if (typeof v[i] === 'string') { const t = swap(v[i], parentKey); if (t !== undefined) { v[i] = t; n++ } } else walk(v[i], parentKey) } return }
    if (v !== null && typeof v === 'object' && !isRef(v)) for (const k of Object.keys(v)) { if (typeof v[k] === 'string') { const t = swap(v[k], parentKey === 'days' || k === 'days' ? 'days' : parentKey); if (t !== undefined) { v[k] = t; n++ } } else walk(v[k], k) }
  }
  walk(props)
  return n
}
