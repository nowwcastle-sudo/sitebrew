"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { AlertTriangle, CheckCircle, Info } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"

// 권한 설정(pwa settings/permissions) — 알림·위치 같은 브라우저 권한이 지금 어떤 상태인지 글로 보이고, 바꾸는 길을 알려 준다.
//   · 상태는 브라우저 권한 API 의 읽기(navigator.permissions.query)만 쓴다 — 이 블록은 권한을 요청하지 않는다(알림 허용 창·위치 허용 창을 직접 띄우지 않고, 구독·위치 읽기도 하지 않는다).
//     권한이 바뀌면(브라우저 설정에서) onchange 로 따라가고 [다시 확인]으로 읽을 수도 있다. 이 브라우저가 그 권한 이름을 읽지 못하면 「알 수 없음」으로 두고 바꾸는 길을 그대로 보인다.
//   · 상태는 색이 아니라 글자 + 아이콘으로 말한다(허용됨·차단됨·아직 묻지 않음·알 수 없음). 항목마다 왜 필요한지 한 줄.
//   · 바꾸는 길: ① 차단됨·허용됨은 브라우저 사이트 설정에서만 바꿀 수 있어 단계 안내(copy.howTo) ② 아직 묻지 않음일 때 조립하는 쪽이 onRequest 를 주면 [켜기] 단추를 그린다
//     (단추가 누르면 onRequest(id) 만 부른다 — 요청 창은 조립하는 쪽 코드가 연다). onRequest 가 없으면 단추 없이 안내만.
//   · states 를 주면 그 값으로 고정한다(예시·검사 — 읽지 않는다). 제목은 h2, 항목 이름은 h3.
export type PermissionId = "notifications" | "geolocation" | "camera" | "microphone"
export type PermissionValue = "granted" | "denied" | "prompt" | "unknown"
export type AccountPermissionsCopy = {
  title: string
  lead?: string
  items: { id: PermissionId; label: string; why: string; requestLabel?: string }[]
  stateLabels: Record<PermissionValue, string>
  // 바꾸는 길 — 브라우저 설정 단계
  howTo: { title: string; steps: string[] }
  recheckLabel?: string
}
export type AccountPermissionsProps = BlockBase<AccountPermissionsCopy> & {
  states?: Partial<Record<PermissionId, PermissionValue>>
  onRequest?: (id: PermissionId) => void
}

function usePermissionValue(id: PermissionId, fixed?: PermissionValue) {
  const [read, setValue] = React.useState<PermissionValue>("unknown")
  const [tick, setTick] = React.useState(0)
  // fixed(예시·검사)가 있으면 읽지 않고 그 값 — 효과 안에서 상태를 동기로 바꾸지 않는다
  const value = fixed ?? read
  React.useEffect(() => {
    if (fixed) return
    let live = true
    let status: PermissionStatus | undefined
    const read = async () => {
      try {
        if (!navigator.permissions?.query) return
        status = await navigator.permissions.query({ name: id as PermissionName })
        if (!live) return
        setValue(status.state as PermissionValue)
        status.onchange = () => {
          if (live && status) setValue(status.state as PermissionValue)
        }
      } catch {
        // 이 브라우저는 이 권한 이름을 읽지 못한다 — 「알 수 없음」으로 둔다
      }
    }
    void read()
    return () => {
      live = false
      if (status) status.onchange = null
    }
  }, [id, fixed, tick])
  return { value, recheck: () => setTick((t) => t + 1) }
}

const ICON = { granted: CheckCircle, denied: AlertTriangle, prompt: Info, unknown: Info } as const

function PermissionRow({ item, copy, fixed, onRequest, id }: { item: AccountPermissionsCopy["items"][number]; copy: AccountPermissionsCopy; fixed?: PermissionValue; onRequest?: (id: PermissionId) => void; id: string }) {
  const { value, recheck } = usePermissionValue(item.id, fixed)
  const Icon = ICON[value]
  return (
    <li data-permission={item.id} data-state={value} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="flex max-w-xl min-w-0 flex-col gap-1">
        <h3 id={`${id}-${item.id}`} className="text-[1.25rem] leading-[1.3] font-heading">
          {item.label}
        </h3>
        <p className="text-base leading-[1.6]">{item.why}</p>
      </div>
      <div className="flex flex-col gap-2 md:items-end">
        <p className="inline-flex items-center gap-2 border px-3 py-1.5 text-base leading-[1.35] font-medium">
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span>{copy.stateLabels[value]}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {value === "prompt" && onRequest && item.requestLabel ? (
            <Button type="button" onClick={() => onRequest(item.id)}>
              {item.requestLabel}
            </Button>
          ) : null}
          {copy.recheckLabel && !fixed ? (
            <Button type="button" variant="outline" onClick={recheck}>
              {copy.recheckLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function AccountPermissions({ copy, states, onRequest, id = "permissions", className }: AccountPermissionsProps) {
  return (
    <section id={id} data-block="account-permissions" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul className="flex flex-col divide-y border-y">
        {copy.items.map((it) => (
          <PermissionRow key={it.id} item={it} copy={copy} fixed={states?.[it.id]} onRequest={onRequest} id={id} />
        ))}
      </ul>
      <div className="flex max-w-xl flex-col gap-2">
        <h3 className="text-[1.25rem] leading-[1.3] font-heading">{copy.howTo.title}</h3>
        <ol className="flex list-decimal flex-col gap-1.5 ps-6 text-base leading-[1.6]">
          {copy.howTo.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
    </section>
  )
}
