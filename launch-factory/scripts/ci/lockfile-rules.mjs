// 잠금 파일 규칙(공급망 기본기) — scripts/test/lockfile-rules.test.mjs 가 쓴다. 새 의존을 더하는 변경이 아래를 깨면 실패한다.
//   1. lockfileVersion 3
//   2. node_modules 아래 모든 패키지: resolved 가 https://registry.npmjs.org/ 이고 integrity(sha512)가 있다
//   3. git·URL·파일 의존이 없다(잠금 파일의 resolved 와 package.json 의 의존 명세 둘 다)
// npm 작업공간 자신(node_modules 가 아닌 폴더 키, link 항목)은 resolved 가 없는 것이 정상이다.
export const ALLOWED_HOST = "registry.npmjs.org"
const DEP_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
/** package.json 의 의존 명세가 레지스트리 버전이 아닌 것(git·URL·파일·깃허브 약식) */
const NON_REGISTRY_SPEC = /^(?:git(?:\+[a-z]+)?:|github:|gitlab:|bitbucket:|gist:|https?:|file:|link:|ssh:|[\w.-]+\/[\w.-]+(?:#.*)?$)/i

export function checkLockfile(lock, label = "package-lock.json") {
  const v = []
  if (lock.lockfileVersion !== 3) v.push(`${label}: lockfileVersion ${lock.lockfileVersion} — 3 이어야 한다`)
  for (const [key, p] of Object.entries(lock.packages ?? {})) {
    if (key === "" || p.link) continue
    if (!key.includes("node_modules/")) continue // 작업공간 폴더
    if (!p.resolved) {
      v.push(`${label}: ${key} — resolved 가 없다`)
      continue
    }
    let u
    try {
      u = new URL(p.resolved)
    } catch {
      v.push(`${label}: ${key} — resolved 가 주소가 아니다(${p.resolved})`)
      continue
    }
    if (u.protocol !== "https:") v.push(`${label}: ${key} — https 가 아니다(${u.protocol})`)
    else if (u.host !== ALLOWED_HOST) v.push(`${label}: ${key} — ${ALLOWED_HOST} 밖 출처(${u.host})`)
    if (!p.integrity) v.push(`${label}: ${key} — integrity 가 없다`)
    else if (!/^sha512-/.test(p.integrity)) v.push(`${label}: ${key} — integrity 가 sha512 가 아니다(${p.integrity.split("-")[0]})`)
  }
  return v
}

export function checkManifest(pkg, label) {
  const v = []
  for (const sec of DEP_SECTIONS) {
    for (const [name, spec] of Object.entries(pkg[sec] ?? {})) {
      if (typeof spec === "string" && NON_REGISTRY_SPEC.test(spec)) v.push(`${label}: ${sec}.${name} = ${spec} — 레지스트리 판이 아닌 의존(git·URL·파일)`)
    }
  }
  return v
}
