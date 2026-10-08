// 문의 접수 확인 메일(보낸 사람에게, 선택 — v0 Task 15·대장 D97).
// 받는 주소는 방문자가 적은 값이라 남의 주소일 수 있다. 그래서 방문자가 쓴 글(이름·내용)을 **하나도 싣지 않는다** —
// 싣으면 폼이 남에게 임의의 글을 보내는 통로가 된다. 싣는 것은 서비스 이름과 서버가 만든 접수 번호뿐이다.
// 인사도 이름 없는 인사(greetingNoName)만 쓰고(recipientName 을 받지 않는다), 바닥글은 「직접 보낸 문의가 아니면 무시」다.
import type { EmailMessages } from "../messages/index.ts"
import { fill } from "../format.ts"
import { checkBase, copyOf, layout, p, row, throwIfProblems, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface InquiryReceiptInput extends Omit<BaseInput<EmailMessages["email"]["inquiryReceipt"]>, "recipientName"> {
  reference: string
  /** 첫 응답 약속(제품 설정 — 「1 business day」 같은 글). 주면 접수 번호 아래에 한 줄로 싣는다. 지킬 수 있는 약속만 넣는다(K06) */
  responseTime?: string
}

const REFERENCE = /^[A-Z]-[0-9A-Z]{6,16}$/

export function inquiryReceipt(input: InquiryReceiptInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (typeof input.reference !== "string" || !REFERENCE.test(input.reference)) problems.push("reference must be a server-made reference like Q-7K3M9P2A")
  if (input.responseTime !== undefined && (typeof input.responseTime !== "string" || input.responseTime.trim() === "" || input.responseTime.length > 80)) problems.push("responseTime must be a short non-empty text")
  throwIfProblems("inquiryReceipt", problems)

  const t = copyOf(input, "inquiryReceipt")
  const v = { productName: input.productName }
  const children = [p(fill(t.body, v, "inquiryReceipt.body")), row(t.referenceLabel, input.reference)]
  if (input.responseTime) children.push(p(fill(t.responseNote, { responseTime: input.responseTime.trim() }, "inquiryReceipt.responseNote")))
  return {
    subject: fill(t.subject, v, "inquiryReceipt.subject"),
    element: layout(
      { ...input, recipientName: undefined },
      {
        preview: fill(t.preview, v, "inquiryReceipt.preview"),
        heading: fill(t.heading, v, "inquiryReceipt.heading"),
        children,
        footer: `${fill(t.why, v, "inquiryReceipt.why")} ${t.notYou}`,
      },
    ),
  }
}
