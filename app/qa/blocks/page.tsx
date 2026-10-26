// /qa/blocks — 블록 갤러리(P3-2). 인자가 없으면 색인(kind 별 표: 블록 이름·layout·density·원형·레시피별 링크),
// ?b=<블록 이름>&r=<레시피 id> 면 그 블록 한 벌을 그 레시피로 그린다(view.tsx — 클라이언트, 사본을 동적 import).
// 목록·사본은 factory/scripts/gen-blocks-gallery.mjs(npm run qa:blocks — prebuild·predev·pretypecheck 에서 자동)가 .tmp/blocks 에 만든다.
import type { Metadata } from "next"
import Link from "next/link"

// 레시피마다 [data-recipe] 로 가둔 색·서체 변수와 Google 밖 키트 서체(/qa/recipes 와 같은 생성물).
import "@/.tmp/recipes/recipes.css"
import "@/.tmp/recipes/kit-fonts"
import { BLOCK_META, BLOCK_RECIPES } from "@/.tmp/blocks/meta"

import { BlockView } from "./view"

export const metadata: Metadata = {
  title: "QA · 블록",
}

type Query = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function QaBlocksPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams
  const b = one(q.b)
  const r = one(q.r)
  if (b && r) {
    // o3: 3D 히어로의 재료 갈래(model·image·none — media.ts object3d). 상태 주입 쿼리(state·submit·delay)와 포트 목 쿼리(sub·auth·consent·cart·order·stock·retryAfter·unsupported·last — states.ts PORT_QUERY_KEYS)만 보기에 넘긴다 — 바뀌면 보기가 다시 주입한다.
    const query = new URLSearchParams(
      Object.entries({ state: one(q.state), submit: one(q.submit), delay: one(q.delay), sub: one(q.sub), auth: one(q.auth), consent: one(q.consent), retryAfter: one(q.retryAfter), unsupported: one(q.unsupported), last: one(q.last), initialWait: one(q.initialWait), channels: one(q.channels), cart: one(q.cart), order: one(q.order), stock: one(q.stock), o3: one(q.o3), media: one(q.media) }).filter((e): e is [string, string] => e[1] !== undefined),
    ).toString()
    // d·x(P3-2 Task 8): 히어로의 새 축 시험 값(D2·D3 · X1~X8) — 없으면 레시피 머리 값.
    return <BlockView b={b} r={r} theme={one(q.theme)} fx={one(q.fx)} query={query} frame={one(q.frame) === "1"} d={one(q.d)} x={one(q.x)} />
  }
  const rows = Object.entries(BLOCK_META)
  const kinds = [...new Set(rows.map(([, m]) => m.kind))].sort()
  return (
    <>
      <nav data-sticky-nav aria-label="블록 kind 목록" className="sticky top-0 z-40 border-b bg-background px-4 py-2">
        <ul className="flex gap-1 overflow-x-auto whitespace-nowrap">
          {kinds.map((k) => (
            <li key={k}>
              <a href={`#kind-${k}`} className="inline-flex min-h-11 items-center px-3 hover:bg-muted">
                {k}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto flex max-w-[1440px] flex-col gap-12 px-4 py-8 md:px-8">
        <header className="flex max-w-3xl flex-col gap-2">
          <h1 className="text-[1.953rem] leading-[1.2] font-bold">블록 검수대</h1>
          <p className="leading-[1.7]">
            블록 {rows.length}개 · 레시피 {BLOCK_RECIPES.length}벌. 레시피 링크를 누르면 그 레시피의 부품·색·서체로 블록 한 벌을 그립니다(예시 콘텐츠 기본·최대·최소는 주소의 fx).
          </p>
        </header>
        {rows.length === 0 && <p>블록이 없습니다. registry/factory/blocks/&lt;kind&gt;/ 아래 블록 파일 셋을 확인해 주세요.</p>}
        {kinds.map((k) => (
          <section key={k} id={`kind-${k}`} aria-labelledby={`kind-${k}-title`} className="flex flex-col gap-4">
            <h2 id={`kind-${k}-title`} className="text-[1.563rem] leading-[1.25] font-bold">
              {k}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pe-4">블록</th>
                    <th className="py-2 pe-4">layout</th>
                    <th className="py-2 pe-4">density</th>
                    <th className="py-2 pe-4">원형</th>
                    <th className="py-2">레시피</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter(([, m]) => m.kind === k)
                    .map(([name, m]) => (
                      <tr key={name} className="border-b align-top">
                        <td className="py-2 pe-4">
                          <span className="font-bold">{name}</span>
                          <br />
                          {m.title}
                        </td>
                        <td className="py-2 pe-4">{m.layout}</td>
                        <td className="py-2 pe-4">{m.density}</td>
                        <td className="py-2 pe-4">{m.archetypes.join(", ")}</td>
                        <td className="py-2">
                          <ul className="flex flex-wrap gap-x-3">
                            {BLOCK_RECIPES.map((rc) => (
                              <li key={rc.id}>
                                <Link href={`/qa/blocks?b=${name}&r=${rc.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                                  {rc.id}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </>
  )
}
