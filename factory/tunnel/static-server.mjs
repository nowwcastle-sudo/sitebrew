// 정적 서버(모듈 T) — 정적 내보내기 사이트의 out 폴더를 127.0.0.1 의 빈 포트로 서빙한다. next start 는 output: "export" 를 서빙하지 못한다.
//   startStaticServer(root, { host, port }) → { port, pid, stop } — serveSite 가 next start 와 같은 모양으로 쓴다.
//   · 이 프로세스(터널 데몬) 안에서 돈다: pid 는 process.pid, stop 은 서버를 닫는다.
//   · 길 찾기: 경로 → 그 파일 · 경로.html · 경로/index.html. 없으면 404.html 내용으로 404.
//   · GET·HEAD 만 받고, 폴더 밖으로 나가는 경로(.. · 인코딩된 ..)는 파일을 읽기 전에 막는다.
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
}
const FALLBACK_TYPE = 'application/octet-stream'

const isFile = (p) => { try { return statSync(p).isFile() } catch { return false } }

/** URL 경로 → root 안의 실제 파일(없으면 null). 폴더 밖이면 'forbidden'. */
export function resolveFile(root, urlPath) {
  let decoded
  try { decoded = decodeURIComponent(urlPath) } catch { return 'forbidden' }
  if (decoded.includes('\0')) return 'forbidden'
  const target = normalize(join(root, decoded))
  if (target !== root && !target.startsWith(root + sep)) return 'forbidden'
  const bare = target.replace(/[\\/]+$/, '')
  return [target, `${bare}.html`, join(bare, 'index.html')].find(isFile) ?? null
}

function send(res, status, file, head) {
  res.writeHead(status, { 'content-type': TYPES[extname(file).toLowerCase()] ?? FALLBACK_TYPE, 'x-content-type-options': 'nosniff' })
  if (head) return res.end()
  createReadStream(file).on('error', () => res.destroy()).pipe(res)
}

/** root 폴더를 서빙하는 서버를 켠다. */
export function startStaticServer(root, { host = '127.0.0.1', port = 0 } = {}) {
  const base = normalize(root).replace(/[\\/]+$/, '')
  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' })
      return res.end()
    }
    const head = req.method === 'HEAD'
    const found = resolveFile(base, new URL(req.url, 'http://x').pathname)
    if (found && found !== 'forbidden') return send(res, 200, found, head)
    const notFound = join(base, '404.html')
    if (found !== 'forbidden' && isFile(notFound)) return send(res, 404, notFound, head)
    res.writeHead(found === 'forbidden' ? 403 : 404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(head ? undefined : 'Not found')
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      resolve({
        port: server.address().port,
        pid: process.pid,
        stop: () => new Promise((done) => { server.close(() => done()); server.closeAllConnections() }),
      })
    })
  })
}
