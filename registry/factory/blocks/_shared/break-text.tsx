import * as React from "react"

// 이메일·전화번호·등록번호처럼 공백 없이 긴 글을 줄이 모자랄 때 알맞은 자리에서만 끊는다(공유 조각 block-shared-break-text — REL10B, 운영자 결정 2026-10-04).
// 기본 줄바꿈은 이런 글을 안 끊어 칸 밖으로 나가고, overflow-wrap:anywhere 만 주면 「exam|ple.co」·「ample.|com」처럼 낱말 가운데서 끊긴다.
// 그래서 끊을 수 있는 자리마다 <wbr> 를 둔다 — 이메일은 `@` 뒤와 점·밑줄·빗금 앞, 번호는 하이픈 뒤. 글자 자체는 그대로다(<wbr> 은 읽히지도 복사되지도 않는다 — tel:·mailto: 주소·접근 이름 불변).
// 그 자리로도 칸에 안 들어가는 낱말만 낱말 가운데서 끊긴다(스타일 쪽이 overflow-wrap:anywhere 를 마지막 수단으로 둔다).
export function breakable(value: string): React.ReactNode {
  const parts = value.split(/(@|[.\-_/])/)
  if (parts.length === 1) return value
  const out: React.ReactNode[] = []
  parts.forEach((p, i) => {
    if (p === "@" || p === "-") {
      out.push(p, <wbr key={i} />)
    } else if (p === "." || p === "_" || p === "/") {
      out.push(<wbr key={i} />, p)
    } else if (p) {
      out.push(p)
    }
  })
  return out.map((n, i) => (typeof n === "string" ? <React.Fragment key={`t${i}`}>{n}</React.Fragment> : n))
}
