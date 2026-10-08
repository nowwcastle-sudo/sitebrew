// 법정 페이지 본문 그리기(P3-3 Task 9) — 초안 조항(factory/legal/drafts.mjs)의 글을 그대로 그린다: 빈 줄로 문단을, 「- 」로 목록을.
import * as React from "react"

function Block({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/)
  return (
    <>
      {paras.map((para, i) => {
        const lines = para.split("\n")
        return lines.every((l) => l.startsWith("- ")) ? (
          <ul key={i} className="list-disc ps-5">
            {lines.map((l, j) => (
              <li key={j}>{l.slice(2)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {para}
          </p>
        )
      })}
    </>
  )
}

export function LegalBody({ clauses, notice }: { clauses: { title: string; text: string }[]; notice?: string }) {
  return (
    <div className="flex flex-col gap-6">
      {notice ? <p role="note">{notice}</p> : null}
      {clauses.map((c) => (
        <section key={c.title} className="flex flex-col gap-2">
          <h2 className="font-heading">{c.title}</h2>
          <Block text={c.text} />
        </section>
      ))}
    </div>
  )
}
