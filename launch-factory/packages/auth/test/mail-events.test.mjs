// LFMAIL: 계정 메일 이벤트 — G05 환영 메일(확인 뒤 한 번) · C06 새 기기 로그인 알림 · A13 가입 안 했어요 · A12 링크 유효 시간 설정.
// DB 는 PGlite 메모리, 메일은 호출을 모으는 가짜 전송기. 기기 구분은 User-Agent, 위치는 호스팅 요청 머리(x-vercel-ip-*)로 흉내 낸다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { db, subscriptions, user as userTable, knownDevices, mailLedger } from "@launch-factory/db"
import { DEFAULT_LINK_VALID_MINUTES } from "@launch-factory/email"
import { authAdapter, createAuth, deviceFingerprint, LINK_EXPIRES_SECONDS, notMeToken, removeUnverifiedByToken, roughLocation } from "../src/index.ts"

const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"
const CONSENT_VERSIONS = { terms: "terms-2026-09-30", privacy: "privacy-2026-09-30" }
const consents = { terms: true, privacy: true, ageOver14: true }
const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const FIREFOX_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0"
const SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

let seq = 0
function memoryIO(ua, extra = {}) {
  const jar = new Map()
  const ip = `192.0.2.${++seq}`
  return {
    headers() {
      const h = new Headers({ "x-forwarded-for": ip, "user-agent": ua, ...extra })
      if (jar.size) h.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "))
      return h
    },
    setCookies(list) {
      for (const line of list) {
        const [pair, ...attrs] = line.split(";")
        const i = pair.indexOf("=")
        const name = pair.slice(0, i).trim()
        const value = pair.slice(i + 1).trim()
        if (attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "") jar.delete(name)
        else jar.set(name, value)
      }
    },
  }
}
async function follow(auth, io, url) {
  const res = await auth.handler(new Request(new URL(url), { method: "GET", headers: io.headers() }))
  io.setCookies(res.headers.getSetCookie())
  return res
}

function setup() {
  const welcomes = []
  const devices = []
  const verifyLinks = []
  const errors = []
  const background = []
  const mailer = {
    passwordReset: async () => {},
    verifyEmail: async (to, url, who) => void verifyLinks.push({ to, url, who }),
    changeEmailConfirm: async () => {},
    emailChanged: async () => {},
    passwordChanged: async () => {},
    welcome: async (to, who) => void welcomes.push({ to, who }),
    newDeviceSignIn: async (to, input, who) => void devices.push({ to, input, who }),
  }
  const auth = createAuth({
    db: d,
    secret: SECRET,
    baseURL: BASE_URL,
    consentVersions: CONSENT_VERSIONS,
    mailer,
    onError: (e) => errors.push(e),
    runInBackground: (task) => void background.push(task),
  })
  const flush = () => Promise.all(background.splice(0))
  const port = (io) => authAdapter(auth, io, { onError: () => {}, errorCallbackURL: "/sign-in", locale: "en" })
  return { auth, welcomes, devices, verifyLinks, errors, flush, port }
}

const email = (tag) => `mailevents-${tag}-${++seq}@example.com`

test("G05: 환영 메일은 이메일을 확인한 뒤 한 번만 간다 — 확인 전·같은 링크 재방문·이메일 변경 확인에는 가지 않는다", async () => {
  const { auth, welcomes, verifyLinks, flush, port } = setup()
  const io = memoryIO(CHROME_WIN)
  const p = port(io)
  const addr = email("welcome")
  assert.ok((await p.signUp({ method: "password", email: addr, password: PASSWORD, consents })).ok)
  await flush()
  assert.equal(welcomes.length, 0, "확인 전에는 보내지 않는다")
  assert.equal(verifyLinks.length, 1)
  assert.equal(verifyLinks[0].who.id.length > 0, true, "서명 링크를 만들 수 있게 사용자 id 가 전달된다")

  await follow(auth, io, verifyLinks[0].url)
  await flush()
  assert.equal(welcomes.length, 1)
  assert.equal(welcomes[0].to, addr)

  // 같은 링크를 다시 열어도(이미 확인됨) 두 번째 환영 메일은 없다
  await follow(auth, io, verifyLinks[0].url)
  await flush()
  assert.equal(welcomes.length, 1)
})

test("G05: 환영 메일 보내기가 실패하면 기록을 돌려놓고(다음 확인 때 다시 시도 가능) onError 로만 알린다 · 가입·확인은 영향 없다", async () => {
  const errors = []
  const background = []
  const links = []
  const auth = createAuth({
    db: d,
    secret: SECRET,
    baseURL: BASE_URL,
    consentVersions: CONSENT_VERSIONS,
    onError: (e) => errors.push(e),
    runInBackground: (task) => void background.push(task),
    mailer: {
      passwordReset: async () => {},
      verifyEmail: async (to, url) => void links.push(url),
      welcome: async () => {
        throw new Error("provider down")
      },
    },
  })
  const io = memoryIO(CHROME_WIN)
  const addr = email("welcome-fail")
  assert.ok((await authAdapter(auth, io, { onError: () => {}, errorCallbackURL: "/sign-in", locale: "en" }).signUp({ method: "password", email: addr, password: PASSWORD, consents })).ok)
  const res = await follow(auth, io, links[0])
  assert.equal(res.status, 302, "확인은 성공")
  await Promise.all(background.splice(0))
  assert.equal(errors.length, 1)
  const [u] = await d.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, addr))
  assert.equal((await d.select().from(mailLedger).where(eq(mailLedger.userId, u.id))).length, 0, "실패했으니 자리를 돌려놓았다")
})

test("C06: 처음 보는 기기로 로그인하면 알림 한 통(기기 이름·시각·위치) — 첫 기기·같은 기기 재로그인·이미 아는 기기에서는 없다", async () => {
  const { devices, flush, port } = setup()
  const addr = email("device")
  // 가입(첫 기기: Chrome on Windows) — 조용히 기록만
  const ioA = memoryIO(CHROME_WIN)
  assert.ok((await port(ioA).signUp({ method: "password", email: addr, password: PASSWORD, consents })).ok)
  await flush()
  assert.equal(devices.length, 0, "첫 기기는 알리지 않는다")

  // 같은 기기에서 다시 로그인: 알림 없음
  const ioA2 = memoryIO(CHROME_WIN)
  assert.ok((await port(ioA2).signIn({ method: "password", email: addr, password: PASSWORD })).ok)
  await flush()
  assert.equal(devices.length, 0)

  // 다른 기기(Firefox on macOS) + 호스팅이 준 위치 머리
  const ioB = memoryIO(FIREFOX_MAC, { "x-vercel-ip-city": encodeURIComponent("Seoul"), "x-vercel-ip-country": "KR", "accept-language": "ko-KR,ko;q=0.9" })
  assert.ok((await port(ioB).signIn({ method: "password", email: addr, password: PASSWORD })).ok)
  await flush()
  assert.equal(devices.length, 1)
  const [mail] = devices
  assert.equal(mail.to, addr)
  assert.equal(mail.input.device, "macOS · Firefox", "사용자 언어(ko — accept-language)의 기기 이름 형식")
  assert.equal(mail.input.location, "Seoul, KR")
  assert.ok(Date.now() - mail.input.at.getTime() < 60_000, "방금 시각")

  // 같은 새 기기로 또 로그인: 이미 아는 기기라 없다(기기당 한 번)
  assert.ok((await port(memoryIO(FIREFOX_MAC)).signIn({ method: "password", email: addr, password: PASSWORD })).ok)
  await flush()
  assert.equal(devices.length, 1)

  // 위치 머리가 없으면 위치를 싣지 않는다(제3자 조회를 하지 않는다)
  assert.ok((await port(memoryIO(SAFARI_IOS)).signIn({ method: "password", email: addr, password: PASSWORD })).ok)
  await flush()
  assert.equal(devices.length, 2)
  assert.equal(devices[1].input.device, "Safari on iOS")
  assert.equal("location" in devices[1].input, false)

  // 기록에는 원문 UA 가 없다 — 지문(해시)과 이름뿐
  const [row] = await d.select().from(knownDevices).where(eq(knownDevices.label, "Safari on iOS"))
  assert.match(row.fingerprint, /^[0-9a-f]{32}$/)
  assert.ok(!JSON.stringify(row).includes("iPhone"))
})

test("C06 음성 대조: 틀린 비밀번호 로그인·세션 조회는 기기를 기록하지도 알리지도 않는다", async () => {
  const { devices, flush, port } = setup()
  const addr = email("device-neg")
  assert.ok((await port(memoryIO(CHROME_WIN)).signUp({ method: "password", email: addr, password: PASSWORD, consents })).ok)
  await flush()
  const io = memoryIO(FIREFOX_MAC)
  const bad = await port(io).signIn({ method: "password", email: addr, password: "wrong-password-123" })
  assert.equal(bad.ok, false)
  await port(io).session()
  await flush()
  assert.equal(devices.length, 0)
  const [u] = await d.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, addr))
  const rows = await d.select().from(knownDevices).where(eq(knownDevices.userId, u.id))
  assert.equal(rows.length, 1, "첫 기기 한 칸뿐")
})

test("C06 지문: 같은 사용자·같은 브라우저·OS 는 같고, 사용자나 브라우저가 다르면 다르다 · 위치 머리 해석", () => {
  assert.equal(deviceFingerprint("u1", CHROME_WIN), deviceFingerprint("u1", CHROME_WIN.replace("130.0.0.0", "131.0.0.0")))
  assert.notEqual(deviceFingerprint("u1", CHROME_WIN), deviceFingerprint("u2", CHROME_WIN))
  assert.notEqual(deviceFingerprint("u1", CHROME_WIN), deviceFingerprint("u1", FIREFOX_MAC))
  const h = (o) => new Headers(o)
  assert.equal(roughLocation(h({ "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-vercel-ip-country": "BR" })), "São Paulo, BR")
  assert.equal(roughLocation(h({ "x-vercel-ip-country": "KR" })), "KR")
  assert.equal(roughLocation(h({})), undefined)
  assert.equal(roughLocation(h({ "x-vercel-ip-city": "%E0%A4%A", "x-vercel-ip-country": "KR" })), "KR", "깨진 인코딩은 버린다")
  assert.equal(roughLocation(h({ "x-vercel-ip-city": "<script>", "x-vercel-ip-country": "KR" })), "KR")
})

test("A13: 가입 안 했어요 토큰 — 확인 전 계정은 지워지고, 확인된 계정·결제 기록이 있는 계정·위조 토큰은 지워지지 않는다", async () => {
  const { auth, verifyLinks, flush, port } = setup()
  const now = new Date()
  const id = async (addr) => (await d.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, addr)))[0]?.id

  const unverified = email("notme")
  assert.ok((await port(memoryIO(CHROME_WIN)).signUp({ method: "password", email: unverified, password: PASSWORD, consents })).ok)
  const uid = await id(unverified)
  const token = notMeToken(uid, SECRET, now)
  assert.deepEqual(await removeUnverifiedByToken(d, token, { secret: SECRET, now }), { ok: true, removed: true })
  assert.equal(await id(unverified), undefined)
  assert.deepEqual(await removeUnverifiedByToken(d, token, { secret: SECRET, now }), { ok: true, removed: false, reason: "gone" })

  // 확인된 계정
  const verified = email("notme-verified")
  const io = memoryIO(CHROME_WIN)
  assert.ok((await port(io).signUp({ method: "password", email: verified, password: PASSWORD, consents })).ok)
  await follow(auth, io, verifyLinks.at(-1).url)
  await flush()
  const vid = await id(verified)
  assert.deepEqual(await removeUnverifiedByToken(d, notMeToken(vid, SECRET, now), { secret: SECRET, now }), { ok: true, removed: false, reason: "verified" })
  assert.equal(await id(verified), vid)

  // 결제 기록이 있는 미확인 계정
  const paid = email("notme-paid")
  assert.ok((await port(memoryIO(CHROME_WIN)).signUp({ method: "password", email: paid, password: PASSWORD, consents })).ok)
  const pid = await id(paid)
  await d.insert(subscriptions).values({ userId: pid, provider: "paddle", providerSubId: `sub_${pid}`, status: "active", planId: "pro", updatedFromEventAt: now })
  assert.deepEqual(await removeUnverifiedByToken(d, notMeToken(pid, SECRET, now), { secret: SECRET, now }), { ok: true, removed: false, reason: "has_subscription" })
  assert.equal(await id(paid), pid)

  // 위조·기한 지남·다른 용도·빈 값
  const other = email("notme-forged")
  assert.ok((await port(memoryIO(CHROME_WIN)).signUp({ method: "password", email: other, password: PASSWORD, consents })).ok)
  const oid = await id(other)
  const good = notMeToken(oid, SECRET, now)
  for (const bad of [`${good}x`, notMeToken(oid, "lf-other-secret-not-real-0123456789abcd", now), notMeToken(oid, SECRET, new Date(now.getTime() - 15 * 86_400_000)), "", undefined]) {
    assert.deepEqual(await removeUnverifiedByToken(d, bad, { secret: SECRET, now }), { ok: false, reason: "invalid" })
  }
  assert.equal(await id(other), oid, "계정은 그대로")
})

test("A12: 링크 유효 시간은 설정에 명시돼 있고 메일 문구의 기본값과 같다", () => {
  assert.equal(LINK_EXPIRES_SECONDS / 60, DEFAULT_LINK_VALID_MINUTES)
})
