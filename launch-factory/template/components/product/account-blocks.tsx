"use client"
// 계정 화면의 클라이언트 잎(LFACCT). 서버 페이지(app/(product)/account/page.tsx)가 mode 만 넘기고, 여기서 블록에 서버 액션을 이어 준다.
// 블록은 공급자를 모른다 — 넘기는 것은 포트 메서드(서버 액션)와 track 뿐이다. 제품 조립이 더하는 것:
//   live  → 이미 있던 서버 액션(app/actions/auth.ts·account.ts·consents.ts — Better Auth 세션을 읽는다)을 그대로 쓴다
//   mock  → 로그인이 목 인증 포트의 메모리 세션이라 위 액션이 세션을 못 알아본다 — app/actions/account-mock.ts 한 입구로 목 포트를 부른다(키 없이도 화면이 끝까지 돈다)
// 사람 승인이 필요한 행동(이메일 바꾸기·모든 기기 로그아웃 아님·탈퇴·동의 변경)은 블록이 별도 확인 단계를 갖고, 그 단계를 마치면 블록이 `confirmed: true`(탈퇴는 입력한 이메일 `confirmEmail` 도)를 직접 싣는다(web-factory v0.0.11).
// 이 파일은 그 단계를 건너뛰는 일을 하지 않는다 — 서버 액션이 그 칸이 없으면 실행하지 않는다(방어 겹침).
import * as React from "react"
import { AccountCredentials } from "@/components/blocks/account/credentials"
import { AccountDeleteAccount } from "@/components/blocks/account/delete-account"
import { AccountNotificationConsents } from "@/components/blocks/account/notification-consents"
import { AccountProfileSettings } from "@/components/blocks/account/profile-settings"
import { AccountSecurity } from "@/components/blocks/account/security"
import { FormAlert, FormField, SubmitButton, usePortForm } from "@/components/blocks/_shared/port-form"
import { usePortRead } from "@/components/blocks/_shared/port-read"
import type { ActionResult } from "@/components/contract/block-contract"
import type { AuthPort, NotifyPort } from "@/components/contract/ports"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { changeEmail, changePassword, listSessions, revokeOtherSessions, revokeSession, updateProfile } from "@/app/actions/auth"
import { deleteAccount, exportMyData } from "@/app/actions/account"
import { getMarketingConsents, getMyConsentHistory, setMarketingConsents } from "@/app/actions/consents"
import { mockAccount, type MockAccountMethod } from "@/app/actions/account-mock"
import { session, signOut, subscription } from "@/app/actions/product"
import { useBlockTrack } from "@/components/product/analytics"
import { ActionScope } from "@/components/product/action-scope"
import { FormKeys } from "@/components/product/form-keys"
import { COPY_LOCALE, submitNotices } from "@/content/copy.en"
import { consentHistoryCopy, credentialsCopy, deleteCopy, GRACE_DAYS, incidentCopy, nameFormCopy, notificationsCopy, profileCopy, securityCopy } from "@/content/copy.account.en"
import { announceSessionChanged } from "@/lib/welcome"

export type AccountMode = "mock" | "live"

export type ConsentRecord = { kind: string; granted: boolean; version: string | null; source: string; locale: string | null; at: string }

/** 계정 화면이 쓰는 포트 메서드 한 벌. 블록 props 모양이다 */
interface AccountPorts {
  changeEmail: NonNullable<AuthPort["changeEmail"]>
  changePassword: NonNullable<AuthPort["changePassword"]>
  listSessions: NonNullable<AuthPort["listSessions"]>
  revokeSession: NonNullable<AuthPort["revokeSession"]>
  revokeOtherSessions: NonNullable<AuthPort["revokeOtherSessions"]>
  deleteAccount: NonNullable<AuthPort["deleteAccount"]>
  exportMyData: NonNullable<AuthPort["exportMyData"]>
  consents: NotifyPort["consents"]
  setConsents: NotifyPort["setConsents"]
  history: () => Promise<ActionResult<ConsentRecord[]>>
  updateName: (input: { name: string }) => Promise<ActionResult<{ name: string }>>
}

// 사람 승인 행동(이메일 바꾸기·탈퇴·내려받기·수신 동의 변경)은 블록이 자기 확인 단계(폼 제출·확인 단추)를 마친 뒤 `confirmed: true` 를 실어 부른다(v0.0.11 — LFAX M03 의 조립 쪽 감싸기를 걷었다).
// 서버 액션을 직접 부르는 자동화는 이 칸을 스스로 적어야 한다 — 없으면 서버가 실행하지 않는다.
const livePorts: AccountPorts = {
  changeEmail: (input) => changeEmail(input),
  changePassword: (input) => changePassword(input),
  listSessions: () => listSessions(),
  revokeSession: (input) => revokeSession(input),
  revokeOtherSessions: () => revokeOtherSessions(),
  deleteAccount: (input) => deleteAccount(input),
  exportMyData: (input) => exportMyData(input),
  consents: () => getMarketingConsents(),
  setConsents: (input) => setMarketingConsents(input),
  history: () => getMyConsentHistory() as Promise<ActionResult<ConsentRecord[]>>,
  updateName: (input) => updateProfile(input),
}

const viaMock =
  <T,>(method: MockAccountMethod) =>
  (input?: unknown) =>
    mockAccount(method, input) as Promise<ActionResult<T>>

const mockPorts: AccountPorts = {
  changeEmail: viaMock("changeEmail"),
  changePassword: viaMock("changePassword"),
  listSessions: viaMock("listSessions"),
  revokeSession: viaMock("revokeSession"),
  revokeOtherSessions: viaMock("revokeOtherSessions"),
  deleteAccount: viaMock("deleteAccount"),
  exportMyData: viaMock("exportMyData"),
  consents: viaMock("consents"),
  setConsents: viaMock("setConsents"),
  history: viaMock("history"),
  updateName: viaMock("updateProfile"),
}

const portsFor = (mode: AccountMode): AccountPorts => (mode === "live" ? livePorts : mockPorts)

// 레시피(설치한 r1-measure)와 문구 판을 계측 태그로 싣는다. 문구를 바꾸면 copyVariant 를 올린다
const tag = (blockId: string) => ({ blockId, recipeId: "r1-measure", copyVariant: "en-default" })

/** 프로필 구획: 줄 목록(이름·이메일·비밀번호) + 로그아웃 + 이름 바꾸기 폼. 2단계 인증은 이 제품에서 꺼져 있어 그 줄을 숨긴다 */
export function ProfileSection({ mode }: { mode: AccountMode }) {
  const track = useBlockTrack(tag("account-profile-settings"))
  const ports = portsFor(mode)
  const [saved, setSaved] = React.useState(0)
  const out = React.useCallback<AuthPort["signOut"]>(async () => {
    const r = await signOut()
    if (r.ok) announceSessionChanged()
    return r
  }, [])
  return (
    <ActionScope name="profile">
      {(watch) => (
        <div className="space-y-8">
          {/* 줄 목록의 「2단계 인증」 줄: 이 제품은 2단계 인증을 켜지 않았다(AUTH_FEATURES.twoFactor) — 켤 곳이 없는 줄은 보이지 않게 한다(U8) */}
          <div key={saved} className="[&_[data-row=two-factor]]:hidden">
            <FormKeys>
              <AccountProfileSettings copy={profileCopy} session={session} signOut={watch(out)} track={track} id="account-profile" />
            </FormKeys>
          </div>
          <NameForm ports={{ ...ports, updateName: watch(ports.updateName) }} onSaved={() => setSaved((n) => n + 1)} />
        </div>
      )}
    </ActionScope>
  )
}

function NameForm({ ports, onSaved }: { ports: AccountPorts; onSaved: () => void }) {
  const read = usePortRead(session)
  const form = usePortForm({ id: "account-name", notices: submitNotices, validators: { name: (v) => (v.length > 80 ? nameFormCopy.tooLong : null) } })
  const [done, setDone] = React.useState(false)
  const me = read.state.status === "ready" ? read.state.data : null
  if (!me) return null
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate(["name"])
    if (!v) return
    setDone(false)
    const r = await form.run(() => ports.updateName({ name: v.name }))
    if (r) {
      setDone(true)
      announceSessionChanged()
      onSaved()
    }
  }
  return (
    <div id="name" className="max-w-xl scroll-mt-24 space-y-3">
      <h3 className="font-heading text-lg">{nameFormCopy.title}</h3>
      <form id={form.formId} noValidate aria-busy={form.pending || undefined} onSubmit={submit} className="space-y-4">
        <FormAlert form={form} fieldTitle={nameFormCopy.failed} serverTitle={nameFormCopy.failed} />
        <FormField form={form} name="name" label={nameFormCopy.label} marker={nameFormCopy.marker} autoComplete="name" hint={nameFormCopy.hint} maxLength={80} defaultValue={me.name ?? ""} />
        <SubmitButton form={form} label={nameFormCopy.submit} pendingLabel={nameFormCopy.pending} />
        <p role="status" className="text-base">
          {done ? nameFormCopy.done : ""}
        </p>
      </form>
    </div>
  )
}

/** 보안 구획: 이메일·비밀번호 바꾸기 → 로그인된 기기 → 보안 사고 안내(D13). 이메일 확인 링크는 계정 화면으로 돌아온다 */
export function SecuritySection({ mode }: { mode: AccountMode }) {
  const ports = portsFor(mode)
  const changeMail = React.useCallback<NonNullable<AuthPort["changeEmail"]>>((input) => ports.changeEmail({ ...input, redirectTo: "/account" }), [ports])
  return (
    <ActionScope name="security">
      {(watch) => (
        <div className="space-y-10">
          <FormKeys>
            <AccountCredentials copy={credentialsCopy} session={session} changeEmail={watch(changeMail)} changePassword={watch(ports.changePassword)} />
          </FormKeys>
          <FormKeys>
            <AccountSecurity
              copy={securityCopy}
              locale={COPY_LOCALE}
              session={session}
              listSessions={watch(ports.listSessions)}
              revokeSession={watch(ports.revokeSession)}
              revokeOtherSessions={watch(ports.revokeOtherSessions)}
              id="devices"
            />
          </FormKeys>
          <aside aria-labelledby="incident-title" className="space-y-3 rounded-lg border p-5">
            <h3 id="incident-title" className="font-heading text-lg">
              {incidentCopy.title}
            </h3>
            <ol className="list-decimal space-y-2 ps-5">
              {incidentCopy.steps.map((s) => (
                <li key={s.href}>
                  <a href={s.href} className="underline underline-offset-4">
                    {s.label}
                  </a>
                  <span className="block text-muted-foreground">{s.note}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </ActionScope>
  )
}

/** 알림 구획: 채널별 마케팅 수신 동의. 바꿀 때마다 결과를 화면에 적고 메일로도 알린다(정보통신망법 §50 — 서버 쪽 lib/launch/consents.ts) */
// 보내는 채널은 이메일뿐이다(A05 — 운영자 결정 2026-10-07). 문자·카카오톡·앱 알림 스위치는 그리지 않는다(web-factory v0.0.12 의 channels 속성, LFPIN12).
export function NotificationsSection({ mode }: { mode: AccountMode }) {
  const ports = portsFor(mode)
  return (
    <ActionScope name="notifications">
      {(watch) => (
        <AccountNotificationConsents copy={notificationsCopy} locale={COPY_LOCALE} consents={watch(ports.consents)} setConsents={watch(ports.setConsents)} channels={["email"]} id="notification-settings" />
      )}
    </ActionScope>
  )
}

const stamp = (iso: string) => new Intl.DateTimeFormat(COPY_LOCALE, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))

/** 내 데이터 구획의 동의 이력(D06). 블록이 없는 자리라 읽기 전용 표 하나 — 4상태(불러오는 중·빈 값·오류·표)를 그린다 */
export function ConsentHistory({ mode }: { mode: AccountMode }) {
  const ports = portsFor(mode)
  const c = consentHistoryCopy
  const read = usePortRead(ports.history)
  const s = read.state
  if (s.status === "loading") return <p role="status" aria-live="polite" className="flex items-center gap-2"><Spinner aria-hidden="true" />{c.loading}</p>
  if (s.status === "error") return <p role="alert">{c.error}</p>
  if (s.status === "empty" || (s.status === "ready" && !s.data.length)) return <p>{c.empty}</p>
  if (s.status !== "ready") return null
  return (
    <div className="overflow-x-auto" role="region" aria-label={c.caption} tabIndex={0}>
      <table className="w-full min-w-xl text-start">
        <caption className="sr-only">{c.caption}</caption>
        <thead>
          <tr className="border-b text-start">
            {[c.columns.what, c.columns.answer, c.columns.date, c.columns.version, c.columns.where].map((h) => (
              <th key={h} scope="col" className="py-2 pe-4 text-start font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.data.map((r, i) => (
            <tr key={`${r.kind}-${r.at}-${i}`} className="border-b">
              <th scope="row" className="py-2 pe-4 text-start font-normal">
                {c.kinds[r.kind] ?? r.kind}
              </th>
              <td className="py-2 pe-4">{r.granted ? c.answers.granted : c.answers.withdrawn}</td>
              <td className="py-2 pe-4">{stamp(r.at)}</td>
              <td className="py-2 pe-4">{r.version ?? "—"}</td>
              <td className="py-2">{c.sources[r.source] ?? r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * 위험 구획: 내 데이터 받기 → 지워지는 것·남는 것·유예 → [이메일 주소 입력] → [취소][계정 지우기]. 이 조립이 더하는 것은 하나 — 지운 뒤 위 띠가 로그아웃 상태를 알게 한다.
 * 이메일 주소 입력 확인(DESIGN §7-B)은 블록의 `copy.decision.typed` 가 한다(v0.0.11 — 이전에는 조립이 블록 밖에 입력 칸을 두고 화면 쪽 주소 검사를 했다).
 * 블록은 맞지 않으면 포트를 부르지 않고 그 칸 오류를 보이며, 맞으면 `deleteAccount({ confirmed: true, confirmEmail })` 로 부른다 — 서버도 같은 값을 다시 본다(LFAX M03, 방어 겹침 그대로).
 */
export function DeleteSection({ mode }: { mode: AccountMode }) {
  const ports = portsFor(mode)
  const remove = React.useCallback<NonNullable<AuthPort["deleteAccount"]>>(
    async (input) => {
      const r = await ports.deleteAccount(input)
      if (r.ok) announceSessionChanged()
      return r
    },
    [ports],
  )
  return (
    <ActionScope name="delete-account">
      {(watch) => (
        <FormKeys>
          <AccountDeleteAccount copy={deleteCopy} locale={COPY_LOCALE} session={session} subscription={subscription} exportMyData={watch(ports.exportMyData)} deleteAccount={watch(remove)} graceDays={GRACE_DAYS} id="delete-account-block" />
        </FormKeys>
      )}
    </ActionScope>
  )
}

/** 구획 머리의 돌아가기 링크 등에서 쓰는 보조 버튼(링크 모양) */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button nativeButton={false} role="link" render={<a href={href} />} variant="outline">
      {children}
    </Button>
  )
}
