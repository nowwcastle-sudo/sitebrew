// 새 기기 로그인 알림 메일(C06). 처음 보는 기기(브라우저·운영체제 조합)로 로그인한 순간 한 번 보낸다.
// 담는 것: 어떤 기기인지 · 받는 사람의 시간대로 본 시각 · 대략적인 위치(알 때만 — 제3자 조회 없이 호스팅이 요청 머리로 주는 값만) · 「직접 한 일이면 아무것도 안 해도 된다」 · 계정 보호하기 링크.
// 링크는 만료되지 않는 우리 앱 화면(비밀번호 재설정 시작)이라 유효 시간 줄이 없다. 광고 문구는 없다.
import type { IsoDate } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface NewDeviceSignInInput extends BaseInput<EmailMessages["email"]["newDeviceSignIn"]> {
  /** 기기 이름(예: 「Chrome on Windows」). 사용자 언어로 만든 값을 그대로 싣는다 */
  device: string
  signedInAt: IsoDate
  /** 대략적인 위치(예: 「Seoul, KR」). 모르면 없다 — 줄 자체를 싣지 않는다 */
  location?: string
  /** 「계정 보호하기」 링크(비밀번호 재설정 화면). 없으면 단추를 싣지 않는다 */
  securityUrl?: string
}

export function newDeviceSignIn(input: NewDeviceSignInInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (typeof input.device !== "string" || input.device.trim() === "") problems.push("device is required")
  if (!isValidDate(input.signedInAt)) problems.push("signedInAt must be an ISO date")
  if (input.location !== undefined && input.location.trim() === "") problems.push("location must not be empty (leave it out when unknown)")
  if (input.securityUrl !== undefined) requireLink(input.securityUrl, "securityUrl", problems)
  throwIfProblems("newDeviceSignIn", problems)

  const t = copyOf(input, "newDeviceSignIn")
  const v = {
    productName: input.productName,
    device: input.device,
    time: formatDate(input.signedInAt, input.locale, timeZoneOf(input), true),
    location: input.location,
  }
  const children = [
    p(fill(t.body, v, "newDeviceSignIn.body")),
    p(fill(t.deviceLine, v, "newDeviceSignIn.deviceLine"), true),
    p(fill(t.timeLine, v, "newDeviceSignIn.timeLine"), true),
    ...(input.location ? [p(fill(t.locationLine, v, "newDeviceSignIn.locationLine"), true)] : []),
    p(t.ifYou),
    p(t.ifNotYou),
  ]
  if (input.securityUrl) children.push(actions(input.locale, [{ href: input.securityUrl, label: t.cta, secondary: true }]))
  return {
    subject: fill(t.subject, v, "newDeviceSignIn.subject"),
    element: layout(input, { preview: fill(t.preview, v, "newDeviceSignIn.preview"), heading: t.heading, children }),
  }
}
