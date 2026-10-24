# 챗봇 창에서 사이트 만들기 · Making a site from a chat window

## 목차 · Contents

- [한국어](#한국어): [할 수 있는 일](#ko-scope) · [순서](#ko-steps) · [넘기는 말](#ko-handover)
- [English](#english): [What it can do](#en-scope) · [Steps](#en-steps) · [Handover](#en-handover)

## 한국어

<a id="ko-scope"></a>

### 할 수 있는 일

이 창은 내 컴퓨터에서 명령을 실행하지 못해요. 그래서 이 창에서는 질문과 안내까지만 해요. 사이트를 만드는 빌드는 내 컴퓨터에서 해요.

- 이 창이 해요: 설치 안내, 질문하기, 답을 `answers.json` 글로 정리하기.
- 내 컴퓨터가 해요: 설치, 사이트 후보 세 개 만들기, 보드 보기, 고른 안 마무리.
- 사이트 빌드는 한 시간쯤 걸려요. 메모리도 3 GB쯤 써요.

이 창은 아무것도 실행하지 않았어요. 실행한 것처럼 말하지 않아요.

<a id="ko-steps"></a>

### 순서

1. **설치 안내.** `setup` 스킬의 설치 안내를 따라요. 내 운영체제 절의 명령을 터미널에 붙여 넣어요. 끝나면 터미널을 닫았다 다시 열어요. 계정·키·비용은 필요 없어요.
2. **질문.** `new` 스킬의 질문 목록을 순서대로 물어요. 공통 질문을 먼저 하고, 고른 사이트 종류의 질문을 이어서 해요. 모르는 질문은 비워 둬요. 없는 사실을 지어내지 않아요.
3. **답 정리.** 질문 목록 맨 끝 「마지막에 넘길 것」의 모양대로 `answers.json` 글을 보여 줘요. 기능 질문이 있었으면 `features.json` 글도 보여 줘요.
4. **저장.** 내 컴퓨터의 `sitebrew` 폴더 안에 `out` 폴더를 만들어요. 글을 `out/answers.json` (과 `out/features.json`) 으로 저장해요.
5. **넘기기.** 명령을 실행하는 도구(Claude Code 나 Codex)를 `sitebrew` 폴더에서 열어요. 아래 「넘기는 말」을 붙여 넣어요.

<a id="ko-handover"></a>

### 넘기는 말

> `out/answers.json` (과 있으면 `out/features.json`) 에 사이트 질문 답이 있어요. sitebrew 의 new 스킬로 이어서 만들어 줘요. 질문은 다시 하지 말아요. `out/features.json` 이 있으면 `features-write` 로 실행 폴더에 먼저 기록하고, 그다음 브리프를 만든 뒤 후보 세 개를 만들어 줘요.

명령 도구가 없으면 여기서 멈춰요. 이 창의 답 정리까지가 이 창이 할 수 있는 일이에요.

## English

<a id="en-scope"></a>

### What it can do

This window cannot run commands on your computer. It only asks and guides. The site build runs on your own computer.

- This window does: install guide, the questions, writing the answers as `answers.json` text.
- Your computer does: the installs, the three site candidates, the board, finishing the chosen one.
- The site build takes about an hour. It also uses about 3 GB of memory.

This window ran nothing. It does not say that it did.

<a id="en-steps"></a>

### Steps

1. **Install guide.** Follow the install guide of the `setup` skill. Paste the commands of the section for your system into a terminal. When they finish, close the terminal and open it again. It needs no account, no key and no cost.
2. **Questions.** Ask the questions of the `new` skill's question list in order: the common questions first, then the questions of the chosen site type. A question the user cannot answer stays empty. Never invent a fact.
3. **Write the answers.** Show the `answers.json` text in the shape of "What to hand over" at the end of that question list. If there were feature questions, show the `features.json` text too.
4. **Save.** Make an `out` folder inside the `sitebrew` folder on your computer. Save the text as `out/answers.json` (and `out/features.json`).
5. **Hand over.** Open a tool that runs commands (Claude Code or Codex) in the `sitebrew` folder. Paste the "Handover" text below.

<a id="en-handover"></a>

### Handover

> `out/answers.json` (and `out/features.json` if present) hold the answers to the site questions. Continue with the Sitebrew `new` skill. Do not ask the questions again. If `out/features.json` is there, first write it into the run folder with `features-write`, then make the brief and build the three candidates.

With no command tool, stop here. Writing down the answers is all this window can do.
