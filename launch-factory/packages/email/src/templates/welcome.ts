// 가입 환영 메일.
import type { EmailMessages } from "../messages/index.ts"
import { fill } from "../format.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, throwIfProblems, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface WelcomeInput extends BaseInput<EmailMessages["email"]["welcome"]> {
  /** 로그인·시작 화면 주소 */
  appUrl: string
}

export function welcome(input: WelcomeInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  requireLink(input.appUrl, "appUrl", problems)
  throwIfProblems("welcome", problems)

  const t = copyOf(input, "welcome")
  const v = { productName: input.productName }
  const preview = fill(t.preview, v, "welcome.preview")
  return {
    subject: fill(t.subject, v, "welcome.subject"),
    element: layout(input, {
      preview,
      heading: fill(t.heading, v, "welcome.heading"),
      children: [p(fill(t.body, v, "welcome.body")), actions(input.locale, [{ href: input.appUrl, label: fill(t.cta, v, "welcome.cta") }])],
    }),
  }
}
