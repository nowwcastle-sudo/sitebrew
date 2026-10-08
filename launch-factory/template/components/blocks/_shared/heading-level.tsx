"use client"

import * as React from "react"

// 쪽 제목 소유(FINAL-WF3 — 쪽 제목 두 번): 히어로가 없는 쪽은 셸이 쪽 제목 h1(작은 글)을 그리고 첫 본문 블록이 같은 제목을 h2 로 또 그렸다(요금제·전체 상품·계정 만들기).
// 그 쪽의 제목을 가진 블록의 잎(찍어낸 사이트의 components/site/<쪽>-<섹션>.tsx)이 이 조각으로 블록을 감싸면 블록 머리(BlockHeading)가 h1 이 되고,
// 셸은 `pageTitle={false}` 로 자기 h1 을 끈다 — 쪽의 h1 은 늘 하나다. 감싸지 않으면(갤러리·다른 쪽) 예전 그대로 h2 다.
export type PageHeadingLevel = 1 | 2
const Level = React.createContext<PageHeadingLevel>(2)

export function PageHeading({ level, children }: { level: PageHeadingLevel; children: React.ReactNode }) {
  return <Level.Provider value={level}>{children}</Level.Provider>
}

/** 블록 머리가 그릴 제목 단계 — 감싸는 PageHeading 이 없으면 2 */
export function usePageHeadingLevel(): PageHeadingLevel {
  return React.useContext(Level)
}
