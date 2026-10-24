"use client"
// 상점 화면의 클라이언트 잎(계획 3a D2). 서버 페이지(app/(product)/{cart,checkout,orders}/…)가 로그인·상점 켜짐을 먼저 보고, 여기서 블록에 서버 액션(app/actions/commerce.ts)을 이어 준다.
// 블록은 공급자를 모른다 — 넘기는 것은 포트 메서드(서버 액션)와 track 뿐이다. 이 파일이 더하는 것은 결제창뿐이다(onPay):
//   · 결제 세션이 portone 이면 PortOne 결제창(components/product/portone-pay.ts 가 SDK 를 동적으로 부른다)
//   · 세션이 mock(키 없이 켠 결제 중개)이면 모의 결제 확인 칸(mock-pay-panel.tsx — 서버 액션 payWithMock)
// 앱이 mock 인지는 여기서 모른다 — 서버가 돌려준 결제 세션의 provider 만 본다(블록 쪽 코드는 모드를 모른다).
// 주문하기(place-order)·주문 취소(cancel-order)는 블록이 자기 확인 단계 뒤에 `confirmed: true` 를 직접 싣는다. 서버 액션은 그 칸이 없으면 실행하지 않는다.
import * as React from "react"
import { useRouter } from "next/navigation"
import { AccountOrderDetail } from "@/components/blocks/account/order-detail"
import { AccountOrderHistory } from "@/components/blocks/account/order-history"
import { ProductListGridCards } from "@/components/blocks/product-list/grid-cards"
import { CartCheckoutForm } from "@/components/blocks/cart/checkout-form"
import { CartLinesTable } from "@/components/blocks/cart/lines-table"
import type { PayResult } from "@/components/blocks/_shared/checkout-flow"
import type { PaymentSession } from "@/components/contract/commerce"
import type { AsyncState } from "@/components/contract/block-contract"
import type { Product } from "@/components/content/schemas/commerce"
import * as shop from "@/app/actions/commerce"
import { AddToCartConfirm, type AddItem } from "@/components/product/add-to-cart-confirm"
import { useBlockTrack } from "@/components/product/analytics"
import { useDisplayPrefs } from "@/components/product/display-prefs"
import { FormKeys } from "@/components/product/form-keys"
import { MockPayPanel, type MockPayRequest } from "@/components/product/mock-pay-panel"
import { openPortOne } from "@/components/product/portone-pay"
import { addToCartCopy, cartCopy, checkoutCopy, orderDetailCopy, ordersCopy, productsCopy, shopPageTitles } from "@/content/copy.shop.en"

// 쪽 제목(h1): 블록은 제목을 h2 로 그리므로 블록만 놓인 쪽에는 h1 이 없다 — 눈에는 블록 제목이 보이니 화면 낭독기·문서 윤곽용으로 둔다(product-blocks.tsx 의 PageTitle 과 같다)
function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="sr-only">{children}</h1>
}

const RECIPE = "r1-measure"
const COPY = "en-default"
const tag = (blockId: string) => ({ blockId, recipeId: RECIPE, copyVariant: COPY })

/**
 * 상품 목록(공개 쪽). 서버 페이지가 상품표를 읽어 상태(state)로 넘긴다 — 이 목록에는 서버 액션이 없다(읽기만, 로그인 불필요).
 * 카드를 누르면 /cart?add=<상품 id> 로 가고, 담기는 그쪽의 확인 줄에서 로그인한 사람이 누를 때만 일어난다.
 */
export function ProductsPanel({ state }: { state: AsyncState<Product[]> }) {
  const prefs = useDisplayPrefs()
  return (
    <>
      <PageTitle>{shopPageTitles.products}</PageTitle>
      <ProductListGridCards copy={productsCopy} state={state} {...prefs} />
    </>
  )
}

/** 장바구니. `?add=` 로 열렸으면 위에 담기 확인 줄(주소만으로는 담기지 않는다). notFound 는 주소의 상품이 상품표에 없을 때 */
export function CartPanel({ add, addNotFound }: { add?: AddItem | null; addNotFound?: boolean }) {
  const track = useBlockTrack(tag("cart-lines-table"))
  const prefs = useDisplayPrefs()
  const router = useRouter()
  // 담은 뒤 줄 표를 다시 읽는다(블록은 처음 한 번만 읽는다) — 키를 바꿔 새로 세운다
  const [version, setVersion] = React.useState(0)
  // 확인 줄이 끝나면 주소의 ?add= 를 지운다(새로고침해도 다시 묻지 않는다). 주소가 바뀌면 add 가 사라지므로 담은 상품을 따로 쥐어 「담았어요」 안내가 곧바로 없어지지 않게 한다
  const [held, setHeld] = React.useState<AddItem | null>(null)
  const [dismissed, setDismissed] = React.useState<string | null>(null)
  const item = add ?? held
  const clearAddParam = () => router.replace("/cart")
  return (
    <>
      <PageTitle>{shopPageTitles.cart}</PageTitle>
      {addNotFound ? (
        <p role="status" data-testid="shop-add-missing" className="mx-auto w-full max-w-6xl px-4 text-base leading-[1.6] md:px-8">
          {addToCartCopy.notFound}
        </p>
      ) : null}
      {item && item.productId !== dismissed ? (
        <AddToCartConfirm
          key={item.productId}
          item={item}
          cart={shop.cart}
          setCartLine={shop.setCartLine}
          onAdded={() => {
            setHeld(item)
            setVersion((v) => v + 1)
            clearAddParam()
          }}
          onDismiss={() => {
            setDismissed(item.productId)
            clearAddParam()
          }}
        />
      ) : null}
      <CartLinesTable key={version} copy={cartCopy} track={track} {...prefs} cart={shop.cart} setCartLine={shop.setCartLine} />
    </>
  )
}

/** 주문하기(배송지 + 결제). 모의 결제 세션이면 결제창 대신 모의 결제 칸을 아래에 연다 */
export function CheckoutPanel() {
  const track = useBlockTrack(tag("cart-checkout-form"))
  const prefs = useDisplayPrefs()
  const [mockPay, setMockPay] = React.useState<MockPayRequest | null>(null)

  const onPay = React.useCallback((session: PaymentSession): Promise<PayResult> => {
    if (session.provider !== "mock") return openPortOne(session)
    return new Promise<PayResult>((resolve) => {
      setMockPay({
        session,
        settle: (result) => {
          setMockPay(null)
          resolve(result)
        },
      })
    })
  }, [])

  return (
    <FormKeys>
      <PageTitle>{shopPageTitles.checkout}</PageTitle>
      <CartCheckoutForm copy={checkoutCopy} track={track} {...prefs} cart={shop.cart} placeOrder={shop.placeOrder} confirmPayment={shop.confirmPayment} onPay={onPay} />
      {mockPay ? <MockPayPanel request={mockPay} pay={shop.payWithMock} /> : null}
    </FormKeys>
  )
}

/** 주문 내역 */
export function OrdersPanel() {
  const prefs = useDisplayPrefs()
  return (
    <>
      <PageTitle>{shopPageTitles.orders}</PageTitle>
      <AccountOrderHistory copy={ordersCopy} {...prefs} orders={shop.orders} />
    </>
  )
}

/** 주문 상세 + 취소 */
export function OrderDetailPanel({ orderId }: { orderId: string }) {
  const track = useBlockTrack(tag("account-order-detail"))
  const prefs = useDisplayPrefs()
  return (
    <FormKeys>
      <PageTitle>{shopPageTitles.order}</PageTitle>
      <AccountOrderDetail copy={orderDetailCopy} track={track} {...prefs} orderId={orderId} order={shop.order} cancelOrder={shop.cancelOrder} />
    </FormKeys>
  )
}
