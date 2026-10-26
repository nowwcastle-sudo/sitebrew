# 챗봇 창에서 사이트 만들기 · Making a site from a chat window

Steps and handover text are written once, in Korean. For a user who does not write Korean, translate them and keep the meaning.

## 할 수 있는 일

이 창은 내 컴퓨터에서 명령을 실행하지 못해요. 그래서 이 창에서는 질문과 안내까지만 해요. 사이트를 만드는 빌드는 내 컴퓨터에서 해요.

- 이 창이 해요: 설치 안내, 질문하기, 답을 `answers.json` 글로 정리하기.
- 내 컴퓨터가 해요: 설치, 사이트 후보 세 개 만들기, 보드 보기, 고른 안 마무리.
- 사이트 빌드는 한 시간쯤 걸려요. 메모리도 3 GB쯤 써요.

이 창은 아무것도 실행하지 않았어요. 실행한 것처럼 말하지 않아요.

## 순서

1. **설치 안내.** Node.js, Git, Sitebrew 클론 중 없을 수 있는 것이 있으면 `setup` 스킬의 설치 안내를 따라요. 항목을 하나씩, 내 운영체제 절의 명령으로 해요. 계정·키·비용은 필요 없어요.
2. **질문.** 함께 불러온 질문 파일을 따라 물어요. 빈 답이 있으면 사이트가 「공개 불가」 미리보기로 나온다고 한 번 알리고 계속할지 물어요. 아니라고 하면 사용자가 빈 답을 먼저 채워요. 이 확인은 여기서 한 번만 해요.
3. **답 정리.** 질문 파일 맨 끝 「마지막에 넘길 것」의 모양대로 `answers.json` 글을 보여 줘요. 기능 질문이 있었으면 `features.json` 글도 보여 줘요.
4. **저장.** 클론한 `sitebrew` 폴더 안, 곧 `package.json` 이 들어 있는 폴더 안에 새 `out` 폴더를 만들어요. 글을 그 `out` 폴더에 `answers.json` (과 `features.json`) 으로 저장해요. 그 폴더 밖(바깥 `Sitebrew` 폴더 같은 곳)에 저장하면 이어받는 쪽이 파일을 못 찾아요.
   - 저장 확인: 인코딩은 UTF-8 (「BOM 포함」 아님), 파일 이름은 `.json` 으로 끝나고 `.txt` 가 붙지 않아요. 메모장은 「파일 형식」을 「모든 파일」로 두고, 맥 텍스트 편집기는 「포맷 > 일반 텍스트로 만들기」 뒤에 저장해요. 그다음 그 `sitebrew` 폴더에서 터미널을 열고 Windows 는 `Get-ChildItem out`, 맥은 `ls out` 을 실행해요. `answers.json` (과 `features.json`) 이 그대로 보여야 해요.
5. **넘기기.** 명령을 실행하는 도구(Claude Code 나 Codex)를 `sitebrew` 폴더에서 열어요. 아래 「넘기는 말」을 붙여 넣어요.

## 넘기는 말

> `out/answers.json` (과 있으면 `out/features.json`) 에 사이트 질문 답이 있어요. sitebrew 의 new 스킬로 이어서 만들어 줘요. 질문은 다시 하지 말아요. 브리프를 만들 때 `unread` 로 나온 항목만 다시 물어봐요.

명령 도구가 없으면 여기서 멈춰요. 이 창의 답 정리까지가 이 창이 할 수 있는 일이에요.
