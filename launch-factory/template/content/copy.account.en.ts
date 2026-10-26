// 영어 계정 화면 문구(LFACCT) — 제품이 콘텐츠로 바꾼다. 화면 글은 존재하는 기능만 약속한다(factory-rules.md §23 U8):
// 여기 적힌 메일·기간·되돌리는 길은 모두 코드가 실제로 하는 일이다(근거는 docs/qa/ux-audit/apply-lfacct.md 의 항목 표).
import type { AccountCredentialsCopy } from "@/components/blocks/account/credentials"
import type { AccountDeleteAccountCopy } from "@/components/blocks/account/delete-account"
import type { AccountNotificationConsentsCopy } from "@/components/blocks/account/notification-consents"
import type { AccountProfileSettingsCopy } from "@/components/blocks/account/profile-settings"
import type { AccountSecurityCopy } from "@/components/blocks/account/security"
import { HUMAN_HINT, submitNotices } from "@/content/copy.en"
import { go } from "../lib/launch/enabled.ts"

/** 탈퇴 유예 일수 — 어댑터의 graceDays 와 같은 값이다(@launch-factory/account-lifecycle ACCOUNT_DELETION_DEFAULTS.graceDays) */
export const GRACE_DAYS = 7

const empty = (what: string) => ({ title: `Sign in to ${what}`, body: "You need to be signed in to use this page.", label: "Sign in", href: "/sign-in" })

export const accountNav = {
  label: "Account sections",
  items: [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "billing", label: "Billing" },
    { id: "notifications", label: "Notifications" },
    { id: "my-data", label: "My data" },
    { id: "delete-account", label: "Delete account" },
  ],
}

export const accountPageCopy = {
  title: "Account",
  lead: "Manage your profile, sign-in details, billing, messages and data in one place.",
  billing: {
    title: "Billing",
    body: "See your plan, change it, update your payment method or cancel.",
    cta: "Manage billing",
    href: "/account/billing",
  },
  myData: {
    title: "My data",
    body: "You can download everything we hold about you as a file. The download and the delete button are together in the last section, so you can save your data before you delete the account.",
    cta: "Go to download",
    href: "#delete-account",
  },
}

export const profileCopy: AccountProfileSettingsCopy = {
  title: "Profile",
  lead: "The name and email we use for your account.",
  rows: { name: "Name", email: "Email", password: "Password", twoFactor: "Two-step verification" },
  values: { noName: "Not set yet", passwordSet: "Set", twoFactorOn: "On", twoFactorOff: "Off" },
  actions: {
    name: { label: "Change name", href: "#name" },
    email: { label: "Change email", href: "#credentials-email-form" },
    password: { label: "Change password", href: "#credentials-password-form" },
    // 2단계 인증은 이 제품에서 꺼져 있다(AUTH_FEATURES.twoFactor) — 줄은 화면에서 숨긴다(account-blocks.tsx)
    twoFactor: { labelOn: "Manage", labelOff: "Turn on", href: "#security" },
  },
  signOut: {
    label: "Sign out",
    question: "Sign out of this device?",
    cancel: "Cancel",
    confirm: "Sign out",
    pending: "Signing out",
    errorTitle: "We couldn't sign you out. Please try again.",
    done: { title: "You're signed out", body: "Other devices stay signed in. You can sign them out under Security.", label: "Sign in again", href: "/sign-in" },
  },
  notices: submitNotices,
  remove: {
    label: "Delete account",
    href: "#delete-account",
    note: `You can download your data first. After you ask, you have ${GRACE_DAYS} days to change your mind.`,
  },
  empty: empty("see your account"),
  loading: "Loading your account",
  error: "We couldn't load your account",
  retry: "Try again",
}

export const nameFormCopy = {
  title: "Name",
  label: "Your name",
  marker: "(optional)",
  hint: "Shown on your receipts and in emails we send you. You can leave it empty.",
  submit: "Save name",
  pending: "Saving",
  done: "Your name is saved.",
  failed: "We couldn't save your name. What you typed is still here.",
  tooLong: "Use 80 characters or fewer.",
}

export const credentialsCopy: AccountCredentialsCopy = {
  humanHint: HUMAN_HINT,
  title: "Security",
  lead: "Change your email or your password. You need your current password for both.",
  email: {
    title: "Change email",
    current: "Current email",
    newEmail: {
      label: "New email",
      marker: "(required)",
      hint: "We first email your current address to approve the change. Then we email the new address. The email changes only after you use both links. If you lose access to this email, we can’t recover the account.",
      required: "Enter the new email address.",
      format: "That email address doesn't look right. Example: name@example.com",
    },
    password: { label: "Current password", marker: "(required)", required: "Enter your current password." },
    submit: "Send approval email",
    pending: "Sending",
    done: {
      title: "Check your email",
      body: "We sent an approval link to your current address. After you approve, we send a confirmation link to {email}. Until then you keep signing in with your current email. We also tell your old address when the change is done.",
    },
  },
  password: {
    title: "Change password",
    current: { label: "Current password", marker: "(required)", required: "Enter your current password." },
    next: { label: "New password", marker: "(required)", hint: "Use at least 8 characters.", required: "Enter a new password.", short: "Use at least 8 characters for the new password." },
    revokeOthers: {
      label: "Also sign out of my other devices",
      marker: "(optional)",
      hint: "Turn this on if you think someone else knows your password. This device stays signed in. We email you when your password changes.",
    },
    submit: "Change password",
    pending: "Changing",
    done: { title: "Your password is changed", body: "Use the new password the next time you sign in. We sent you an email about this change.", others: "Your other devices are signed out." },
  },
  alert: { field: "Some fields need your attention", server: "We couldn't change it. What you typed is still here." },
  notices: submitNotices,
  empty: empty("change your sign-in details"),
  loading: "Loading your sign-in details",
  error: "We couldn't load your sign-in details",
  retry: "Try again",
}

// 2단계 인증(twoFactor)은 이 제품에서 꺼져 있어 props 를 주지 않는다 — 블록이 그 구역을 그리지 않는다. 문구 형식을 채우려고 둔다
const twoFactorOff: AccountSecurityCopy["twoFactor"] = {
  title: "Two-step verification",
  on: "On",
  off: "Off",
  bodyOn: "",
  bodyOff: "",
  enable: "Turn on",
  disable: "Turn off",
  password: { label: "Password", marker: "(required)", hint: "", required: "Enter your password." },
  cancel: "Cancel",
  continueEnable: "Next",
  continueDisable: "Turn off",
  pending: "Checking",
  setupTitle: "",
  setupBody: "",
  keyLabel: "Setup key",
  openApp: "Open in authenticator app",
  backupTitle: "Backup codes",
  backupBody: "",
  code: { label: "6-digit code", marker: "(required)", hint: "", required: "Enter the 6-digit code.", format: "Use 6 digits. Example: 123456" },
  verify: "Verify and turn on",
  verifying: "Checking",
  enabled: "Two-step verification is on",
  disabled: "Two-step verification is off",
  errorTitle: "We couldn't change two-step verification",
}

export const securityCopy: AccountSecurityCopy = {
  humanHint: HUMAN_HINT,
  title: "Devices",
  lead: "These devices are signed in to your account.",
  sessions: {
    title: "Signed-in devices",
    body: "If you see a device you don't know, sign it out and change your password.",
    current: "This device",
    lastActive: "Last used {date}",
    signedIn: "Signed in {date}",
    revoke: "Sign out",
    revokeLabel: "Sign out {device}",
    revokeOthers: "Sign out all other devices",
    pending: "Signing out",
    revokedOne: "Signed out {device}.",
    revokedOthers: "Other devices signed out: {n}.",
    empty: "No devices are signed in.",
    errorTitle: "We couldn't sign out. The list is unchanged.",
  },
  twoFactor: twoFactorOff,
  notices: submitNotices,
  empty: empty("see your devices"),
  loading: "Loading your devices",
  error: "We couldn't load your devices",
  retry: "Try again",
}

/** 보안 사고 안내(D13) — 한 곳에서 세 길로: 모든 기기 로그아웃 · 비밀번호 바꾸기 · 계정 지우기 */
export const incidentCopy = {
  title: "If you think your account was taken over",
  steps: [
    { label: "Sign out every other device", href: "#devices-title", note: "Use “Sign out all other devices” in the list above." },
    { label: "Change your password", href: "#credentials-password-form", note: "You can also sign out your other devices in the same step." },
    { label: "Delete the account", href: "#delete-account", note: `If you don't want the account any more. You have ${GRACE_DAYS} days to change your mind.` },
  ],
}

export const notificationsCopy: AccountNotificationConsentsCopy = {
  humanHint: HUMAN_HINT,
  title: "Notifications",
  lead: "Choose where we may send you news and offers. Everything here is optional.",
  marker: "(optional)",
  channels: {
    email: { label: "Email", body: "News about new features and offers." },
    sms: { label: "Text message", body: "Offers and event news by SMS." },
    kakao: { label: "KakaoTalk", body: "News and offers as KakaoTalk messages." },
    push: { label: "App notifications", body: "News and offers as app notifications." },
  },
  saved: "On {date} you set {channel} to “{state}”.",
  on: "Receive",
  off: "Don't receive",
  lastUpdated: "Last changed: {date}",
  failed: "We couldn't save the {channel} setting. The switch went back. Please try again in a moment.",
  required: "We always send messages that are part of your service, such as receipts, security notices and price changes. This setting does not change that.",
  loading: "Loading your notification settings",
  error: "We couldn't load your notification settings",
  retry: "Try again",
}

export const consentHistoryCopy = {
  title: "Consent history",
  lead: "Every time you agreed to or withdrew something, we kept a dated record. This is the list.",
  caption: "Your consent records, oldest first",
  columns: { what: "What", answer: "Answer", date: "Date", version: "Version", where: "Where" },
  kinds: {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    age_over_14: "Age 14 or older",
    marketing_email: "Marketing email",
    marketing_sms: "Marketing text message",
    marketing_kakao: "Marketing KakaoTalk",
    marketing_push: "Marketing app notification",
    withdrawal_limit: "Refund-right notice at checkout",
  } as Record<string, string>,
  answers: { granted: "Agreed", withdrawn: "Withdrawn" },
  sources: { sign_up: "Sign-up", settings: "Settings", checkout: "Checkout" } as Record<string, string>,
  empty: "There are no consent records yet.",
  loading: "Loading your consent history",
  error: "We couldn't load your consent history.",
  retry: "Try again",
  signIn: "Sign in to see your consent history.",
}

export const deleteCopy: AccountDeleteAccountCopy = {
  humanHint: HUMAN_HINT,
  title: "Download your data or delete your account",
  lead: "Save your data first if you want a copy. Then read what is deleted and what we must keep.",
  export: {
    title: "Download your data",
    body: "A file (JSON) with your profile, sign-in methods, devices, subscription, consent history and marketing choices. We never put your password or session keys in it. You can't download it after the account is deleted.",
    label: "Download my data (JSON)",
    pending: "Preparing the file",
    done: "You downloaded “{file}”. Open it from your downloads folder.",
    file: "my-data.json",
    errorTitle: "We couldn't prepare your data. Please try again in a moment.",
  },
  deleted: {
    title: "What is deleted",
    items: [
      "Your profile (name and email) and your sign-in details",
      "Signed-in devices and sessions",
      "Your notification choices and consent history",
      "Your usage analytics (person and events)",
    ],
  },
  retained: {
    title: "What we must keep by law",
    body: "We keep payment and transaction records for the period the law sets. These records carry no name or email. They carry only a masked ID. When the period ends, we delete them. After you delete the account, our payment provider Paddle keeps its own record of your payments for up to 5 years. You can ask Paddle to delete it on Paddle's own form.",
    items: [
      { what: "Records about advertising and labelling", period: "6 months" },
      { what: "Records about contracts and withdrawal of contracts", period: "5 years" },
      { what: "Records about payment and supply of goods", period: "5 years" },
      { what: "Records about complaints and disputes", period: "3 years" },
    ],
    basis: "Basis: Korean Act on Consumer Protection in Electronic Commerce, Article 6 and its Enforcement Decree, Article 6.",
  },
  subscription: {
    title: "Your subscription",
    live: "You have an active subscription. When you delete the account, it ends on {date}. You are not charged again after that.",
    scheduled: "Your cancellation is already scheduled. You can use the service until {date}. You are not charged again after that.",
    link: { label: "Only want to cancel the subscription? Go to billing.", href: go("/account/billing", "/account") },
  },
  grace: {
    title: "You have time to change your mind",
    body: "After you press “Delete account”, we wait {days} days. If you sign in again in that time, the deletion is cancelled. When the {days} days end, we delete the account for good. You can then sign up again with the same email address. The new account is empty: your old data does not come back, and the records we must keep by law are not linked to it.",
  },
  decision: {
    question: "Do you want to delete your account?",
    cancel: "Cancel",
    confirm: "Delete account",
    pending: "Sending your request",
    errorTitle: "We couldn't take your request. Nothing was deleted.",
    // 이메일 주소 입력 확인(DESIGN §7-B) — 블록이 입력값을 맞춰 보고 confirmEmail 로 싣는다(v0.0.11). {email} 자리에 로그인한 주소가 들어간다. 주소가 없는 계정(소셜 가입)은 칸이 없다
    typed: {
      label: "Type your email address to confirm",
      marker: "(required)",
      hint: "Your email address: {email}. Type it exactly as shown, then use the “Delete account” button below. This keeps you from deleting the account by accident.",
      mismatch: "That doesn't match your email address. Type it exactly as shown above.",
    },
  },
  cancelled: { title: "Your account is not deleted", body: "Nothing changed. Your account is as it was.", label: "Back to your account", href: "/account" },
  done: {
    title: "We received your request",
    body: "You can cancel until {date} by signing in again. After that date we delete the account.",
    note: "You are signed out of every device now. We sent a confirmation email to your address.",
  },
  notices: submitNotices,
  empty: empty("delete your account"),
  loading: "Loading your account",
  error: "We couldn't load your account",
  retry: "Try again",
}
