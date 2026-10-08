import type { AccountPermissionsCopy, AccountPermissionsProps } from "./permissions"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 러닝 기록 앱 「달림장(예시)」.
const COPY: AccountPermissionsCopy = {
  title: "알림과 위치 권한",
  lead: "허락한 것만 써요. 언제든 브라우저 설정에서 바꿀 수 있어요.",
  items: [
    { id: "notifications", label: "알림", why: "주간 목표를 채우지 못한 날 저녁에 한 번 알려 드려요.", requestLabel: "알림 켜기" },
    { id: "geolocation", label: "위치", why: "달린 경로를 지도에 그리려고 달리는 동안만 위치를 읽어요.", requestLabel: "위치 켜기" },
  ],
  stateLabels: { granted: "허용됨", denied: "차단됨", prompt: "아직 묻지 않음", unknown: "알 수 없음" },
  howTo: {
    title: "권한을 바꾸려면",
    steps: ["브라우저 주소 창 왼쪽의 자물쇠(또는 설정) 아이콘을 눌러요.", "「사이트 설정」에서 알림이나 위치를 골라요.", "허용 또는 차단을 바꾼 뒤 이 화면으로 돌아와 「다시 확인」을 눌러요."],
  },
  recheckLabel: "다시 확인",
}

// 조립하는 쪽이 onRequest 를 주면 「아직 묻지 않음」 행에 [켜기] 단추가 선다 — 예시도 그 모습을 보인다(갤러리 관문이 단추의 크기·초점을 잴 수 있게). 아무것도 하지 않는 함수다.
const noop = () => undefined
export const fixture: AccountPermissionsProps = { copy: COPY, states: { notifications: "granted", geolocation: "prompt" }, onRequest: noop }

// 최대: 네 권한 · 긴 설명 · 모든 상태가 섞여 있다.
export const fixtureMax: AccountPermissionsProps = {
  copy: {
    ...COPY,
    lead: "달림장은 필요한 때에만 권한을 써요. 아래 상태는 지금 이 브라우저가 알려 주는 값이고, 바꾸는 방법은 맨 아래에 있어요. 한 번 차단하면 앱 안에서는 다시 켤 수 없고 브라우저 설정에서만 바꿀 수 있어요(예시).",
    items: [
      ...COPY.items,
      { id: "camera", label: "카메라", why: "러닝 코스 사진을 바로 찍어 기록에 붙일 때만 써요. 사진은 내 기기 밖으로 나가지 않아요(예시).", requestLabel: "카메라 켜기" },
      { id: "microphone", label: "마이크", why: "음성 메모로 달린 느낌을 남길 때만 써요. 녹음은 저장하기 전까지 기기 안에만 있어요(예시).", requestLabel: "마이크 켜기" },
    ],
  },
  states: { notifications: "granted", geolocation: "denied", camera: "prompt", microphone: "unknown" },
  onRequest: noop,
}

// 최소: 권한 하나, 상태를 읽지 못하는 브라우저(알 수 없음).
export const fixtureMin: AccountPermissionsProps = {
  copy: {
    title: "권한",
    items: [{ id: "notifications", label: "알림", why: "알려 드릴 일이 있을 때만 써요." }],
    stateLabels: { granted: "허용됨", denied: "차단됨", prompt: "아직 묻지 않음", unknown: "알 수 없음" },
    howTo: { title: "권한을 바꾸려면", steps: ["브라우저 설정의 사이트 권한에서 바꿔요."] },
    recheckLabel: "다시 확인",
  },
}