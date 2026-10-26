# 운영 런북(전문가용) — 도메인

*Expert runbook: domain. English follows the Korean part.*

- 확인일: 2026-10-22. 외부 서비스 화면은 바뀐다. 90일이 지나면 다시 확인한다.
- 대상: 사이트에 내 이름의 주소를 붙이려는 운영자. 모든 사이트가 읽는다. 호스팅 장(`G-hosting`)을 먼저 끝낸다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다. 화면 이름·주소·경로는 깊이 적지 않는다(버전마다 다르다).
- 장 id: `G-domain` (`need: always`, 먼저 `G-hosting`).
- 값(키·비밀·번호)은 채팅·저장소·로그에 쓰지 않는다.

## G-domain — 도메인 연결

- 왜: 호스팅이 준 주소 대신 **내 이름의 주소**를 쓰기 위해서다. 연결은 도메인을 사는 일, 주소록(DNS)을 호스팅에 맞추는 일, 앱이 아는 주소를 바꾸는 일의 세 가지다.
- 준비물: 호스팅 장에서 올린 프로젝트, 도메인 비용을 낼 결제 수단.
- 등록 1 — 도메인을 파는 곳(등록기관)에서 원하는 이름이 비어 있는지 찾아 산다. 도메인은 기간이 정해져 있고 기간이 끝나기 전에 갱신해야 한다. 갱신 방법과 기간은 파는 곳의 안내를 따른다.
- 설정: 호스팅(Vercel) 프로젝트의 도메인 화면에서 산 도메인을 추가한다. 루트 도메인(예: 이름 바로 뒤에 `.com`)과 하위 도메인(예: `www` 를 붙인 것)을 둘 다 쓸지 정한다.
- 설정: 주소록(DNS)을 호스팅에 맞춘다. 두 방법 중 하나를 고른다. (가) 도메인을 산 곳의 DNS 화면에서 레코드를 추가한다 — 루트 도메인은 A 레코드, 하위 도메인은 CNAME 레코드. 넣을 값은 Vercel 이 프로젝트의 도메인 화면에서 알려 주는 값을 그대로 쓴다. (나) 도메인의 네임서버를 Vercel 이 알려 주는 것으로 바꾼다 — 그러면 DNS 를 Vercel 에서 관리한다. 바꾸기 전에 지금 있는 레코드(메일용 MX, 인증용 TXT 등)를 Vercel 쪽에 먼저 똑같이 옮겨 둔다. 안 옮기면 메일이 끊길 수 있다(Vercel 안내).
- 설정: 환경 변수 `NEXT_PUBLIC_APP_URL` 을 새 주소(`https://` 로 시작, 경로 없이)로 바꾸고 **다시 배포**한다. 환경 변수는 바꾼 뒤 새로 만든 배포부터 적용된다.
- 설정: 옛 주소를 적어 둔 다른 서비스를 새 주소로 고친다 — 로그인 공급자에 등록한 콜백 주소, 결제·메일 서비스의 웹훅 주소처럼 주소를 직접 적어 둔 곳. 해당 장에서 같은 이름의 항목을 찾아 고친다.
- 확인: Vercel 도메인 화면이 연결 정상을 보인다. 새 주소를 열면 사이트가 보이고 주소창에 보안 표시(HTTPS)가 있다. 인증서는 Vercel 이 자동으로 발급한다.
- 막힘 1 — 바꿨는데 안 열린다: DNS 변경은 퍼지는 데 시간이 걸린다. 네임서버 변경은 하루에서 이틀까지 걸릴 수 있다. 기다리는 수밖에 없다(고칠 수 없다). 그 사이 Vercel 화면은 아직 연결 안 됨으로 보일 수 있다.
- 막힘 2 — 연결은 됐는데 보안 경고가 뜬다: 인증서는 DNS 가 맞게 퍼진 뒤에 발급된다. 조금 기다린다. 도메인에 CAA 레코드가 있으면 인증서 발급 기관(Let's Encrypt)을 허용하도록 고쳐야 한다.
- 막힘 3 — Vercel 이 값이 틀렸다고 한다: 레코드 종류(루트는 A, 하위는 CNAME)와 값을 Vercel 이 알려 주는 것과 글자 단위로 견준다.
- 막힘 4 — 어느 날 사이트 주소가 멈췄다: 도메인 갱신 기간이 지났는지 파는 곳에서 본다.
- 출처: Vercel 문서 — 프로젝트에 도메인 추가·DNS 설정(A·CNAME·네임서버), 도메인 문제 해결(전파 시간), 자동 SSL 인증서(CAA 레코드 포함). 이 저장소의 `.env.example`.

---

# Expert runbook — domain

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Exact screen names, URLs and paths are deliberately not recorded here (they change per version). Checked 2026-10-22; re-check after 90 days.*

- Audience: an operator who wants to put an address with their own name on the site. Every site reads it. Finish the hosting chapter (`G-hosting`) first.
- Chapter id: `G-domain` (`need: always`, after `G-hosting`).
- Never put a key, secret or number in chat, the repository or logs.

## G-domain

- Why: to use **an address with your own name** instead of the one the host gave you. Connecting has three parts: buy the domain, point its address book (DNS) at the host, and change the address the app knows.
- What you need: the project you deployed in the hosting chapter, and a way to pay for the domain.
- Register 1 — Find out at a domain seller (a registrar) whether the name you want is free, and buy it. A domain is held for a set period and must be renewed before the period ends. Follow the seller's guide for how and for how long.
- Config: In the domain screen of the host (Vercel) project, add the domain you bought. Decide whether to use both the root domain (the name right before `.com`, for example) and a subdomain (for example one starting with `www`).
- Config: Point the address book (DNS) at the host. Pick one of two ways. (a) In the DNS screen of the seller where you bought the domain, add records — an A record for the root domain, a CNAME record for a subdomain. Use exactly the values Vercel shows in the project's domain screen. (b) Change the domain's nameservers to the ones Vercel shows — then Vercel manages the DNS. Before you change them, copy the records that exist now (MX for email, verification TXT and so on) to Vercel first. If you do not, email can stop (Vercel's warning).
- Config: Change the environment variable `NEXT_PUBLIC_APP_URL` to the new address (starting with `https://`, no path) and **deploy again**. A changed environment variable applies only to deployments created after the change.
- Config: Fix the other services that hold the old address, such as the callback address registered with a sign-in provider and the webhook address in payment or email services. Find the item with the same name in the matching chapter.
- Check: the Vercel domain screen shows the connection as healthy. Opening the new address shows the site, with the secure mark (HTTPS) in the address bar. Vercel issues the certificate automatically.
- Stuck 1 — You changed it but it does not open: DNS changes take time to spread. A nameserver change can take a day or two. There is nothing to fix; you can only wait. Meanwhile the Vercel screen may still show it as not connected.
- Stuck 2 — It is connected but a security warning shows: the certificate is issued after DNS has spread correctly. Wait a little. If the domain has a CAA record, change it to allow the certificate authority (Let's Encrypt).
- Stuck 3 — Vercel says the values are wrong: compare the record type (A for the root, CNAME for a subdomain) and the value, character by character, with what Vercel shows.
- Stuck 4 — The address stopped one day: check at the seller whether the domain's renewal date has passed.
- Sources: Vercel documentation — adding a domain to a project and DNS setup (A, CNAME, nameservers), domain troubleshooting (propagation time), automatic SSL certificates (including CAA records). This repository's `.env.example`.
