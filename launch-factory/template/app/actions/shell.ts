"use server"
// 위 띠(web-factory 블록 nav/account-bar)의 로그아웃 폼이 부르는 서버 액션(LFADA). 블록의 로그아웃은 링크가 아니라 POST 폼이다(미리 불러오기·크롤러가 로그아웃시키지 않게) —
// 폼의 action 은 결과를 돌려주지 않는 함수여야 하므로, 포트의 signOut 을 부른 뒤 시작 쪽으로 보내는 얇은 액션을 따로 둔다. 자바스크립트가 없어도 폼이 그대로 동작한다.
// B03: 로그아웃을 마치면 시작 쪽으로 가서 「You're signed out」를 한 번 보인다(주소의 표지 — welcome-notice.tsx 가 읽고 지운다). redirect 는 서버가 쪽을 새로 그리므로 위 띠가 바로 로그아웃 모양이 된다.
import { redirect } from "next/navigation"
import { signOut } from "@/app/actions/product"
import { WELCOME_HREF } from "@/lib/welcome"

export async function signOutFromHeader(): Promise<void> {
  await signOut().catch(() => undefined)
  redirect(WELCOME_HREF.signedout)
}
