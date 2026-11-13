// 로컬 경로 신뢰 경계(보안 수정 C) — 브리프·콘텐츠·재개 산출물(manifest)·next.config 가 가리키는 경로를 읽기 전에 거는 공통 정책.
//   isNetworkOrDevicePath(p)            UNC(`\\host\share`·`//host/share`)·장치(`\\?\`·`\\.\`·`\??\`) 경로인가. 드라이브 문자(`Y:\`)·POSIX 절대 경로는 아니다.
//                                       Windows 는 이런 경로를 열기만 해도 외부 호스트에 SMB 접속(NTLM 인증)을 시도한다 — 파일 시스템 호출 전에 글자로 거른다.
//   assertNoLinkInPath(p, { stopAt })   p 가 링크(symlink·junction)면 던진다. stopAt 이 있으면 p 에서 stopAt 직전까지의 모든 상위 폴더도 본다(stopAt 자신은 신뢰 뿌리라 보지 않는다).
//                                       없는 경로는 링크가 아니다(만들기 전 검사에 쓴다). Windows 에서 junction 도 lstat().isSymbolicLink() 가 참이다.
//   realInside(root, p)                 realpath 기준으로 p 가 root 안(root 자신 제외)에 있는가. 어느 쪽이든 없으면 false.
//   statLocalInputFile(p, opts)         열어서 검사만 한다 → { size }.
//   readLocalInputFile(p, opts)         검사한 뒤 내용을 Buffer 로 돌려준다.
//     검사 순서: 네트워크·장치 경로 거절 → lstat 링크 거절 → openSync → fstat 이 lstat 과 같은 파일(dev·ino)인지(검사와 열기 사이 교체 방지) → 일반 파일 → 크기 → magic 바이트.
//     opts: { maxBytes?, magic? } — magic 은 파일 첫 바이트(문자열·Buffer). 예: GLB 는 'glTF'.
//   · 이 모듈은 「이 경로를 읽어도 되는가」만 정한다. 파일 내용의 해석(이미지 디코딩 등)은 부르는 쪽 몫이다.
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, win32 } from 'node:path'

/** 읽기 크기 기본 상한(바이트). 부르는 쪽이 더 작게 줄 수 있다. */
export const DEFAULT_MAX_BYTES = 64 * 1024 * 1024

const NETWORK_OR_DEVICE = /^(?:[\\/]{2}|[\\/]\?\?[\\/])/

/** 네트워크(UNC)·장치 경로인가. 원문 글자만 본다 — 파일 시스템을 건드리지 않는다. */
export function isNetworkOrDevicePath(p) {
  return typeof p === 'string' && NETWORK_OR_DEVICE.test(p)
}

const isLink = (st) => st.isSymbolicLink()

function lstatOrNull(p) {
  try { return lstatSync(p) } catch (e) {
    if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') return null
    throw e
  }
}

const refuse = (msg, reason) => Object.assign(new Error(msg), { reason })

/** p 와(stopAt 이 있으면) stopAt 아래 상위 폴더에 링크가 있으면 던진다. */
export function assertNoLinkInPath(p, { stopAt } = {}) {
  if (isNetworkOrDevicePath(p)) throw refuse(`네트워크·장치 경로는 쓰지 않는다: ${p}`, 'networkPath')
  let cur = resolve(p)
  if (stopAt === undefined || stopAt === null) {
    const st = lstatOrNull(cur)
    if (st && isLink(st)) throw refuse(`링크(symlink·junction)는 쓰지 않는다: ${p}`, 'link')
    return
  }
  const stop = resolve(stopAt)
  const rel = relative(stop, cur)
  if (rel === '' || rel === '..' || rel.startsWith('..' + win32.sep) || rel.startsWith('../') || isAbsolute(rel)) {
    if (rel === '') return // p 가 곧 신뢰 뿌리
    throw refuse(`경로가 신뢰 폴더 밖이다: ${p}`, 'outside')
  }
  for (;;) {
    if (cur === stop) return
    const st = lstatOrNull(cur)
    if (st && isLink(st)) throw refuse(`링크(symlink·junction)가 낀 경로는 쓰지 않는다: ${cur}`, 'link')
    const up = dirname(cur)
    if (up === cur) return
    cur = up
  }
}

/** realpath 기준으로 p 가 root 안인가(root 자신은 아니다). */
export function realInside(root, p) {
  try {
    const r = realpathSync.native(root), t = realpathSync.native(p)
    const rel = relative(r, t)
    return rel !== '' && rel !== '..' && !rel.startsWith('..' + win32.sep) && !rel.startsWith('../') && !isAbsolute(rel)
  } catch { return false }
}

const toBuffer = (m) => (Buffer.isBuffer(m) ? m : Buffer.from(String(m), 'latin1'))

/** 열어서 검사한다 → { fd, size }. 호출한 쪽이 fd 를 닫는다. 실패하면 fd 를 닫고 던진다. */
function openChecked(p, { maxBytes = DEFAULT_MAX_BYTES, magic } = {}) {
  if (typeof p !== 'string' || p === '') throw refuse('파일 경로가 비어 있다', 'empty')
  if (isNetworkOrDevicePath(p) || isNetworkOrDevicePath(resolve(p))) throw refuse(`네트워크·장치 경로는 읽지 않는다: ${p}`, 'networkPath')
  const before = lstatSync(p, { bigint: true })
  if (isLink(before)) throw refuse(`링크(symlink·junction)는 읽지 않는다: ${p}`, 'link')
  const fd = openSync(p, 'r')
  try {
    const st = fstatSync(fd, { bigint: true })
    if (st.ino !== before.ino || st.dev !== before.dev) throw refuse(`검사한 파일과 연 파일이 다르다(열기 직전에 바뀌었다): ${p}`, 'swapped')
    if (!st.isFile()) throw refuse(`일반 파일이 아니다: ${p}`, 'notFile')
    const size = Number(st.size)
    if (size > maxBytes) throw refuse(`파일이 너무 크다(${size} > ${maxBytes} 바이트): ${p}`, 'tooLarge')
    if (magic !== undefined) {
      const want = toBuffer(magic), got = Buffer.alloc(want.length)
      const n = readSync(fd, got, 0, want.length, 0)
      if (n < want.length || !got.equals(want)) throw refuse(`파일 형식이 맞지 않는다(첫 ${want.length}바이트): ${p}`, 'magic')
    }
    return { fd, size }
  } catch (e) {
    closeSync(fd)
    throw e
  }
}

/** 열어서 검사만 한다 → { size }. */
export function statLocalInputFile(p, opts = {}) {
  const { fd, size } = openChecked(p, opts)
  closeSync(fd)
  return { size }
}

/** 검사한 뒤 내용을 읽는다 → Buffer. */
export function readLocalInputFile(p, opts = {}) {
  const { fd, size } = openChecked(p, opts)
  try {
    const buf = Buffer.alloc(size)
    let off = 0
    while (off < size) {
      const n = readSync(fd, buf, off, size - off, off)
      if (n === 0) break
      off += n
    }
    return off === size ? buf : buf.subarray(0, off)
  } finally {
    closeSync(fd)
  }
}
