// 시험용 가짜 후보 사이트(compare.behavior.test.mjs) — 진짜 `next start` 처럼 보안 헤더 `frame-ancestors 'none'` 과 `script-src 'self'` 를 보내고, 쪽마다 제목이 다르다.
// 사용: node fake-site.mjs <이름 A|B|C> <본문 높이 px> [siteDir] — siteDir 은 명령줄에 남기려고 받기만 한다(남은 서버 정리 시험이 명령줄을 본다). 포트는 스스로 정해 `PORT <n>` 한 줄로 알린다.
// 안쪽 이동: #go 링크를 누르면 history.pushState 로 /about 으로 간다(load 이벤트 없음 — Next 클라이언트 이동 흉내).
import http from 'node:http'

const [name = 'A', height = '3000'] = process.argv.slice(2)
const LABEL = { '/': '홈', '/pricing': '요금', '/about': '소개' }
const CSP = "default-src 'self'; script-src 'self'; frame-ancestors 'none'"
const APP = `const n = document.body.dataset.name
document.getElementById('go').addEventListener('click', (e) => { e.preventDefault(); history.pushState({}, '', '/about'); document.title = '소개 · ' + n })`

http.createServer((req, res) => {
  const path = req.url.split('?')[0]
  const head = { 'content-security-policy': CSP }
  if (path === '/app.js') { res.writeHead(200, { ...head, 'content-type': 'text/javascript' }); return res.end(APP) }
  if (path === '/s.css') { res.writeHead(200, { ...head, 'content-type': 'text/css' }); return res.end(`body{margin:0}.tall{height:${height}px;background:linear-gradient(#fff,#cde)}`) }
  if (!(path in LABEL)) { res.writeHead(404, { ...head, 'content-type': 'text/plain' }); return res.end('없음') }
  const title = `${LABEL[path]} · ${name}`
  res.writeHead(200, { ...head, 'content-type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="/s.css"></head><body data-name="${name}"><h1>${title}</h1><a id="go" href="/about">소개로</a><div class="tall"></div><script src="/app.js"></script></body></html>`)
}).listen(0, '127.0.0.1', function () { console.log(`PORT ${this.address().port}`) })
