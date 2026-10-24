// 영어 상점 문구(장바구니 · 주문하기 · 주문 내역 · 주문 상세 · 모의 결제 · 담기 확인) — 제품이 콘텐츠로 바꾼다.
// 화면 글은 모두 여기 있다: 블록은 copy 로 받고, 상점 조립(components/product/shop-blocks.tsx)은 이 글을 그대로 넘긴다.
// 금액은 서버의 상품표(lib/launch/catalog.ts)가 정하므로 글에 금액·무료배송 기준을 적지 않는다(상품표를 바꾸면 글이 거짓이 된다).
import type { AccountOrderDetailCopy } from "@/components/blocks/account/order-detail"
import type { AccountOrderHistoryCopy } from "@/components/blocks/account/order-history"
import type { ProductListGridCardsCopy } from "@/components/blocks/product-list/grid-cards"
import type { CartCheckoutFormCopy } from "@/components/blocks/cart/checkout-form"
import type { CartLinesTableCopy } from "@/components/blocks/cart/lines-table"
import type { CartEmptyCopy, CartLineCopy, CartTotalsCopy } from "@/components/blocks/_shared/cart-kit"
import type { OrderStatusCopy, OrderStatusNotes } from "@/components/blocks/_shared/order-kit"
import { HUMAN_HINT, submitNotices } from "@/content/copy.en"

/** 상품을 둘러보는 곳 — 상품 목록 쪽(app/(product)/products). 시안이 자기 /products 를 가져오면(url-map: winner site) 그 쪽이 이 주소를 받는다 */
const BROWSE = "/products"

/** 쪽 제목(h1, 화면 낭독기·문서 윤곽용) */
export const shopPageTitles = {
  products: "Products",
  cart: "Cart",
  checkout: "Checkout",
  checkoutReturn: "Confirming your payment",
  orders: "Your orders",
  order: "Order details",
}

const line: CartLineCopy = {
  product: "Item",
  unitPrice: "Price",
  quantity: "Quantity",
  lineTotal: "Amount",
  remove: "Remove",
  removeOf: "Remove {name} from your cart",
  decrease: "Decrease quantity of {name}",
  increase: "Increase quantity of {name}",
  quantityOf: "Quantity of {name}",
}
const totals: CartTotalsCopy = { total: "Amount to pay", subtotal: "Items", shipping: "Shipping", shippingFree: "Free", vatIncluded: "VAT included", vatExcluded: "VAT excluded" }
const empty: CartEmptyCopy = { title: "Your cart is empty", body: "Items you add will show up here.", label: "Browse items", href: BROWSE }
const alert = { field: "Please check the highlighted fields", server: "We couldn't finish that — please try again in a moment" }

/** 상품 목록(/products). 카드를 누르면 장바구니의 담기 확인 줄로 간다 — 상품 상세 쪽은 이 템플릿에 없다 */
export const productsCopy: ProductListGridCardsCopy = {
  title: "Products",
  lead: "Choose an item to add it to your cart. You'll confirm before anything is added.",
  countTemplate: "{n} items",
  hrefTemplate: "/cart?add={slug}",
  price: { discount: "{p}% off", listPrice: "List price", unitPrice: "{price} per {per}" },
  loadingLabel: "Loading products",
  empty: { title: "Nothing for sale yet", body: "Check back soon." },
  error: { title: "We couldn't load the products", retryLabel: "Try again" },
}
/** 상품표를 못 읽었을 때 오류 칸의 설명(제목은 productsCopy.error.title) */
export const productsLoadError = "Please reload the page in a moment."

export const cartCopy: CartLinesTableCopy = {
  title: "Your cart",
  lead: "Check the items and quantities, then continue to checkout.",
  caption: "Items in your cart with price, quantity and amount",
  line,
  totals,
  checkout: { label: "Check out", href: "/checkout" },
  continue: { label: "Keep shopping", href: BROWSE },
  empty,
  alert,
  notices: submitNotices,
  loading: "Loading your cart",
  error: "We couldn't load your cart",
  retry: "Try again",
}

export const checkoutCopy: CartCheckoutFormCopy = {
  humanHint: HUMAN_HINT,
  title: "Check out",
  lead: "Enter where to send it and pay to finish your order.",
  shippingTitle: "Shipping address",
  fields: {
    recipient: { label: "Recipient", placeholder: "Jane Doe" },
    phone: { label: "Phone", placeholder: "010-0000-0000" },
    postcode: { label: "Postal code", placeholder: "04524" },
    address1: { label: "Address", placeholder: "Street address" },
    address2: { label: "Address line 2", placeholder: "Unit or floor" },
    note: { label: "Delivery note", placeholder: "Leave it at the door" },
  },
  marker: { required: "(required)", optional: "(optional)" },
  errors: { recipient: "Enter the recipient's name.", phone: "Enter a phone number.", phoneFormat: "The phone number has the wrong number of digits. Example: 010-0000-0000", postcode: "Enter the postal code.", address1: "Enter the address." },
  summaryTitle: "Order summary",
  quantity: "Qty {quantity}",
  listLabel: "Items to order",
  totals,
  submit: "Pay {amount}",
  pending: "Creating your order",
  payNote: "A payment window opens when you press Pay. Your card details are not stored on this page.",
  pay: {
    waiting: "Finish paying in the payment window. If you close it, you can pay again for the same order.",
    canceledTitle: "Payment not finished",
    canceled: "You closed the payment window. Nothing was charged and your order is still here.",
    failedTitle: "We couldn't take the payment",
    failed: "The payment did not go through and nothing was charged. You can pay again for the same order.",
    retry: "Pay again",
    confirmTitle: "Payment not confirmed yet",
    confirmFailed: "The payment went through but we haven't received the order confirmation. Don't pay again — use the button below to check once more.",
    confirmRetry: "Check payment again",
  },
  done: { title: "Your order is placed", body: "Your order number is {orderId}. We emailed you a confirmation and will let you know when it ships.", orderLabel: "Order number", totalLabel: "Amount paid", link: { label: "View order", href: "/orders/{id}" }, continue: { label: "Keep shopping", href: BROWSE } },
  empty,
  alert,
  notices: submitNotices,
  loading: "Loading your order",
  error: "We couldn't load your order",
  retry: "Try again",
}

const status: OrderStatusCopy = { pending_payment: "Awaiting payment", paid: "Paid", preparing: "Preparing", shipped: "Shipped", delivered: "Delivered", canceled: "Canceled", refunded: "Refunded" }
const notes: OrderStatusNotes = {
  pending_payment: "You placed this order on {date} and haven't paid yet.",
  paid: "Paid on {date}. We'll start preparing your items soon.",
  preparing: "Paid on {date}. We're preparing your items.",
  shipped: "Your items are on the way. Paid on {date}.",
  delivered: "Your items were delivered. Paid on {date}.",
  canceled: "Canceled on {date}. You were not charged.",
  refunded: "Canceled on {date}. Your payment is being refunded.",
}

export const ordersCopy: AccountOrderHistoryCopy = {
  title: "Your orders",
  lead: "Newest first. Open an order to see its status and shipping.",
  caption: "Orders with number, date, items, amount and status",
  columns: { order: "Order", date: "Date", items: "Items", total: "Amount", status: "Status" },
  status,
  itemsMore: "{name} and {count} more",
  vatIncluded: "VAT included",
  vatExcluded: "VAT excluded",
  detail: { label: "View", of: "View order {id}", href: "/orders/{id}" },
  empty: { title: "No orders yet", body: "When you place an order it shows up here.", label: "Browse items", href: BROWSE },
  loading: "Loading your orders",
  error: "We couldn't load your orders",
  retry: "Try again",
}

export const orderDetailCopy: AccountOrderDetailCopy = {
  title: "Order details",
  humanHint: HUMAN_HINT,
  lead: "Check the status of your order. Before it ships you can cancel it here.",
  orderLabel: "Order number",
  status,
  notes,
  tracking: { label: "Tracking number" },
  items: { title: "Items", listLabel: "Items in this order", quantity: "Qty {quantity}" },
  totals,
  shipping: { title: "Shipping to", recipient: "Name", phone: "Phone", address: "Address", note: "Delivery note" },
  cancel: {
    title: "Cancel this order",
    open: "Cancel order",
    questionUnpaid: "You haven't paid for this order yet. Close it?",
    questionPaid: "Cancel this order? What you paid will be refunded.",
    reasonLabel: "Reason",
    reasonMarker: "(optional)",
    reasonHint: "Telling us helps us improve.",
    back: "Go back",
    confirm: "Confirm cancellation",
    pending: "Canceling",
    errorTitle: "We couldn't cancel the order",
    unavailable: "Orders that have shipped can't be canceled here. Contact us once you receive them.",
  },
  notices: submitNotices,
  empty: { title: "We couldn't find that order", body: "Check the order number or pick one from your orders.", label: "View your orders", href: "/orders" },
  loading: "Loading your order",
  error: "We couldn't load your order",
  retry: "Try again",
}

/** 상점이 꺼진 상태(live 에서 PortOne 값이 빠짐) — 사이트는 켜져 있고 상점만 닫혀 있다 */
export const shopUnavailableCopy = {
  title: "The shop is closed right now",
  body: "Ordering isn't available at the moment. Everything else on the site works as usual. Please come back later.",
  home: { label: "Go to the home page", href: "/" },
  support: { label: "Contact us", href: "/contact" },
}

/** 「?add=<상품>」으로 열렸을 때의 담기 확인 줄 — 주소만으로는 아무것도 담기지 않고, 누르면 담는다 */
export const addToCartCopy = {
  title: "Add this item to your cart?",
  /** {name} · {price} */
  body: "{name} — {price}",
  confirm: "Add to cart",
  adding: "Adding",
  dismiss: "No thanks",
  /** {name} */
  added: "Added {name} to your cart.",
  error: "We couldn't add that. Please try again.",
  notFound: "That item isn't available.",
}

/** 모의 결제 화면 — LF_MODE=mock 의 결제 세션(provider mock)일 때만 뜬다. 실제로 돈이 움직이지 않는다 */
export const mockPayCopy = {
  title: "Mock payment",
  body: "This is a preview payment. No money moves and no card is needed.",
  /** {amount} */
  amount: "Amount: {amount}",
  pay: "Complete mock payment",
  paying: "Paying",
  close: "Close without paying",
  error: "The mock payment didn't go through. Please try again.",
}

/** 결제창에서 돌아오는 쪽(/checkout/return) */
export const checkoutReturnCopy = {
  confirming: "Confirming your payment",
  confirmed: { title: "Payment received", body: "Your order is confirmed. We emailed you a confirmation.", link: "View your order" },
  failed: { title: "Payment not finished", body: "The payment did not go through and nothing was charged. Your order is still saved — you can look at it or start again.", link: "View your order", again: "Back to your cart" },
  pending: { title: "We're still checking your payment", body: "The payment has not been confirmed yet. Don't pay again — check again in a moment.", retry: "Check again" },
  missing: { title: "We couldn't find that payment", body: "This page needs a payment to check. Go to your orders to see what you have.", link: "View your orders" },
}
