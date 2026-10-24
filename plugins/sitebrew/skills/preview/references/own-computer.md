# 내 컴퓨터에서 임시 공개 주소 만들기 · Open a temporary public address on your own computer

## 목차 · Contents

- [한국어](#한국어)
- [English](#english)

## 한국어

이 안내는 명령을 실행할 수 없는 대화 창에서 쓰는 방법이에요. 내 컴퓨터에서 직접 하고, 계정·키·비용은 필요 없어요. 먼저 네 가지를 알아 두세요.

- 주소를 아는 사람은 누구나 사이트를 열 수 있어요.
- 컴퓨터를 끄거나 아래 창을 닫으면 주소가 닫혀요.
- 다시 열면 주소가 바뀌어요.
- 가짜 내용만 있는 사이트에서 써요. 실제 고객 정보나 결제는 올리지 않아요.

**1. 한 번만 설치해요**

- Windows (PowerShell): `winget install --id Cloudflare.cloudflared -e`
- macOS (터미널): `brew install cloudflared`
- 그 밖의 시스템: developers.cloudflare.com 에서 cloudflared 설치 안내를 찾아 따라 해요.

설치한 뒤에는 터미널(PowerShell)을 닫았다 다시 열어요.

**2. 사이트를 만들고 켜요.** 받은 사이트 폴더에서 (공백이나 한글이 있으면 따옴표로 감싸요):

```bash
cd "<사이트 폴더>"
npm install
npm run build
npm start
```

`npm start` 는 `http://localhost:3000` 에서 사이트를 켜 두고, 이 창은 그대로 열어 둬요. 처음 `npm install` 과 `npm run build` 는 몇 분 걸려요.

**3. 다른 창을 하나 더 열고 주소를 만들어요.**

```bash
cloudflared tunnel --url http://localhost:3000
```

성공하면 `https://…trycloudflare.com` 모양의 주소가 나와요. 몇십 초 걸릴 수 있어요. 그 주소를 다른 사람에게 보내면 돼요.

**4. 로그인·결제가 있는 제품형 사이트라면**, 2번의 `npm run build` 와 `npm start` 를 하기 전에 같은 창에서 가짜 로그인 설정을 먼저 켜야 해요. 같은 주소로 들어온 사람은 같은 가짜 로그인 상태를 같이 써요. `<쓸 수 있는 파일 경로>` 는 가짜 메일이 쌓일 파일이에요.

PowerShell:

```powershell
$env:LF_MODE = "mock"
$env:LF_ALLOW_MOCK_PROD = "1"
$env:LF_MOCK_SUB = "none"
$env:LF_MOCK_OUTBOX = "<쓸 수 있는 파일 경로>"
```

bash (macOS·Linux):

```bash
export LF_MODE=mock
export LF_ALLOW_MOCK_PROD=1
export LF_MOCK_SUB=none
export LF_MOCK_OUTBOX="<쓸 수 있는 파일 경로>"
```

**5. 닫을 때는** 두 창 모두에서 Ctrl+C 를 눌러요. 그러면 주소가 바로 닫혀요.

오래 가는 주소가 필요하면 이 방법이 아니라 호스팅을 따로 써야 해요. 런북의 호스팅 장에 있어요. 「이제 진짜 주소는?」이라고 물어보세요.

## English

Use this guide in a chat window that cannot run commands. You do it on your own computer, and it needs no account, no key and no cost. Know four things first.

- Anyone who has the address can open the site.
- The address closes when you turn the computer off or close the windows below.
- The address is different each time you open it.
- Use it for a site with fake content only. Do not put real customer data or real payments on it.

**1. Install the tool once**

- Windows (PowerShell): `winget install --id Cloudflare.cloudflared -e`
- macOS (Terminal): `brew install cloudflared`
- Other systems: find the cloudflared install guide at developers.cloudflare.com and follow it.

After installing, close the terminal (PowerShell) and open it again.

**2. Build the site and start it.** In the site folder you were given (keep the quotes if the path has spaces or non-ASCII characters):

```bash
cd "<site folder>"
npm install
npm run build
npm start
```

`npm start` serves the site at `http://localhost:3000`. Leave this window open. The first `npm install` and `npm run build` take a few minutes.

**3. Open a second window and make the address.**

```bash
cloudflared tunnel --url http://localhost:3000
```

When it works, an address like `https://…trycloudflare.com` is printed. It can take some tens of seconds. Send that address to the person who should see the site.

**4. For a product site with sign-in or payments**, turn the fake sign-in settings on in the same window before `npm run build` and `npm start` of step 2. People who open the same address share the same fake sign-in state. `<a file path you can write to>` is the file where the fake emails are collected.

PowerShell:

```powershell
$env:LF_MODE = "mock"
$env:LF_ALLOW_MOCK_PROD = "1"
$env:LF_MOCK_SUB = "none"
$env:LF_MOCK_OUTBOX = "<a file path you can write to>"
```

bash (macOS, Linux):

```bash
export LF_MODE=mock
export LF_ALLOW_MOCK_PROD=1
export LF_MOCK_SUB=none
export LF_MOCK_OUTBOX="<a file path you can write to>"
```

**5. To close it**, press Ctrl+C in both windows. The address stops working right away.

If you need an address that lasts, use hosting instead of this method. The hosting chapter of the runbook covers it; ask "what is the real address?".
