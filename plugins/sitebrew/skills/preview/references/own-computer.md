# 내 컴퓨터에서 임시 공개 주소 만들기 · Open a temporary public address on your own computer

## 목차 · Contents

- [한국어](#한국어)
- [English](#english)

## 한국어

이 안내는 주소를 대신 열 수 없을 때 쓰는 방법이에요. 내 컴퓨터에서 직접 하고, 계정·키·비용은 필요 없어요. 먼저 네 가지를 알아 두세요.

- 주소를 아는 사람은 누구나 사이트를 열 수 있어요.
- 컴퓨터를 끄거나 아래 창을 닫으면 주소가 닫혀요.
- 다시 열면 주소가 바뀌어요.
- 가짜 내용만 있는 사이트에서 써요. 실제 고객 정보나 결제는 올리지 않아요.

**1. 한 번만 설치해요**

- Windows (PowerShell): `winget install --id Cloudflare.cloudflared -e`. winget 이 없다고 나오면(오래된 Windows) 아래 "그 밖의 시스템" 안내를 따라요.
- macOS (터미널): `brew install cloudflared`. brew 가 없다고 나오면(Homebrew 가 없는 맥) 아래 "그 밖의 시스템" 안내를 따라요.
- Linux (Debian·Ubuntu 터미널): 아래 네 줄을 차례로 입력해요. 관리자 비밀번호를 물을 수 있어요.
- 그 밖의 시스템: developers.cloudflare.com 에서 cloudflared 설치 안내를 찾아 따라 해요.

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

설치한 뒤에는 터미널(PowerShell)을 닫았다 다시 열어요.

**2. 로그인·결제가 있는 제품형 사이트만 해요 (소개용 사이트는 3번으로 가요).** 3번의 `npm run build` 와 `npm start` 를 하기 전에, 그 명령을 칠 창에서 가짜 로그인 설정을 먼저 켜야 해요. 같은 주소로 들어온 사람은 같은 가짜 로그인 상태를 같이 써요. `LF_MOCK_OUTBOX` 는 가짜 메일이 쌓일 파일이에요. 아래 예시 경로를 그대로 써도 돼요.

PowerShell:

```powershell
$env:LF_MODE = "mock"
$env:LF_ALLOW_MOCK_PROD = "1"
$env:LF_MOCK_SUB = "none"
$env:LF_MOCK_OUTBOX = "$env:TEMP\sitebrew-outbox.txt"
```

bash (macOS·Linux):

```bash
export LF_MODE=mock
export LF_ALLOW_MOCK_PROD=1
export LF_MOCK_SUB=none
export LF_MOCK_OUTBOX="$HOME/sitebrew-outbox.txt"
```

이 설정은 이 창에서만 켜져 있어요. 다 쓰면 이 창을 닫아요. 그래야 나중에 진짜 사이트를 만들 때 가짜 설정으로 돌지 않아요.

**3. 사이트를 만들고 켜요.** 받은 사이트 폴더에서 (공백이나 한글이 있으면 따옴표로 감싸요). PowerShell 은 `npm` 대신 `npm.cmd` 를 써요(기본 설정에서는 `npm` 이 막혀 있어요):

PowerShell:

```powershell
cd "<사이트 폴더>"
npm.cmd install
npm.cmd run build
npm.cmd start
```

bash (macOS·Linux):

```bash
cd "<사이트 폴더>"
npm install
npm run build
npm start
```

`npm start` 는 `http://localhost:3000` 에서 사이트를 켜 두고, 이 창은 그대로 열어 둬요. 처음 `npm install` 과 `npm run build` 는 몇 분 걸려요. 3000 이 이미 쓰이고 있다는 오류가 나면 먼저 `package.json` 의 `start` 항목을 열어 봐요. `next start` 이면 `npm start -- -p 3001` (PowerShell 은 `npm.cmd start -- -p 3001`)로 켜고, 4번의 주소도 `http://localhost:3001` 로 바꿔요. 다른 명령이면 사이트 폴더의 README 에 적힌 방법을 따라요.

**4. 다른 창을 하나 더 열고 주소를 만들어요.**

```bash
cloudflared tunnel --url http://localhost:3000
```

성공하면 `https://…trycloudflare.com` 모양의 주소가 나와요. 몇십 초 걸릴 수 있어요. 그 주소를 다른 사람에게 보내면 돼요. 1분이 지나도 `trycloudflare.com` 주소가 안 나오면 Ctrl+C 로 멈추고 같은 줄을 다시 입력해요. 인터넷에 연결돼 있어야 해요. 주소는 나오는데 오류 화면이 보이면, 3번 창에서 사이트가 아직 켜져 있는지 확인해요.

**5. 닫을 때는** 두 창 모두에서 Ctrl+C 를 눌러요. 그러면 주소가 바로 닫혀요. 그다음 두 창을 닫아요.

오래 가는 주소가 필요하면 이 방법이 아니라 호스팅을 따로 써야 해요. 런북의 호스팅 장에 있어요. 「이제 진짜 주소는?」이라고 물어보세요.

## English

Use this guide when the address cannot be opened for you. You do it on your own computer, and it needs no account, no key and no cost. Know four things first.

- Anyone who has the address can open the site.
- The address closes when you turn the computer off or close the windows below.
- The address is different each time you open it.
- Use it for a site with fake content only. Do not put real customer data or real payments on it.

**1. Install the tool once**

- Windows (PowerShell): `winget install --id Cloudflare.cloudflared -e`. If it says winget is not found (older Windows), use the "Other systems" guide below.
- macOS (Terminal): `brew install cloudflared`. If it says brew is not found (a Mac without Homebrew), use the "Other systems" guide below.
- Linux (Debian, Ubuntu terminal): type the four lines below in order. It may ask for your administrator password.
- Other systems: find the cloudflared install guide at developers.cloudflare.com and follow it.

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

After installing, close the terminal (PowerShell) and open it again.

**2. Only for a product site with sign-in or payments (an intro site goes to step 3).** Before `npm run build` and `npm start` of step 3, turn the fake sign-in settings on in the window where you type those commands. People who open the same address share the same fake sign-in state. `LF_MOCK_OUTBOX` is the file where the fake emails are collected. You can use the example path below as it is.

PowerShell:

```powershell
$env:LF_MODE = "mock"
$env:LF_ALLOW_MOCK_PROD = "1"
$env:LF_MOCK_SUB = "none"
$env:LF_MOCK_OUTBOX = "$env:TEMP\sitebrew-outbox.txt"
```

bash (macOS, Linux):

```bash
export LF_MODE=mock
export LF_ALLOW_MOCK_PROD=1
export LF_MOCK_SUB=none
export LF_MOCK_OUTBOX="$HOME/sitebrew-outbox.txt"
```

These settings stay on only in this window. Close the window when you are done, so that a later real build does not run with the fake settings.

**3. Build the site and start it.** In the site folder you were given (keep the quotes if the path has spaces or non-ASCII characters). In PowerShell use `npm.cmd` instead of `npm` (the default settings block `npm` there):

PowerShell:

```powershell
cd "<site folder>"
npm.cmd install
npm.cmd run build
npm.cmd start
```

bash (macOS, Linux):

```bash
cd "<site folder>"
npm install
npm run build
npm start
```

`npm start` serves the site at `http://localhost:3000`. Leave this window open. The first `npm install` and `npm run build` take a few minutes. If it says port 3000 is already in use, first open the `start` entry of `package.json`. If it is `next start`, start with `npm start -- -p 3001` (in PowerShell `npm.cmd start -- -p 3001`) and use `http://localhost:3001` in step 4. For any other command, follow the README in the site folder.

**4. Open a second window and make the address.**

```bash
cloudflared tunnel --url http://localhost:3000
```

When it works, an address like `https://…trycloudflare.com` is printed. It can take some tens of seconds. Send that address to the person who should see the site. If no `trycloudflare.com` address appears within a minute, press Ctrl+C and type the same line again; you must be online. If the address appears but opens an error page, check that the site of step 3 is still running in its window.

**5. To close it**, press Ctrl+C in both windows. The address stops working right away. Then close both windows.

If you need an address that lasts, use hosting instead of this method. The hosting chapter of the runbook covers it; ask "what is the real address?".
