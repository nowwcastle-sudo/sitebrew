생성 파일 — 손으로 고치지 않는다 / Generated file - do not edit by hand

# 초보자용 글 규칙과 점검표 · Beginner-chapter rules and checklist

## 목차 · Contents

- 쓰는 규칙 · Rules for writing
- 고정 문장 · Fixed sentences
- 일반 낱말 · General words
- 점검표 · Checklist
- 문제 문장 · Problem sentences
- 키 모양 표 · Key shapes

## 쓰는 규칙 · Rules for writing

### 한국어 · Korean

1. 처음 나오는 낱말은 한 문장으로 풀어 줘요. 예: 환경 변수는 사이트가 읽는 비밀 메모예요.
2. 단계 하나에 동작 하나만 써요. 각 단계는 어느 서비스의 어떤 화면에서, 무엇을 하고, 무엇이 보이면 됐는지 순서로 써요.
3. 버튼 이름을 단정하지 않아요. 새 프로젝트나 만들기처럼 보이는 버튼이라고 모양으로 말해요. 장마다 도움 문장을 한 번 넣어요.
4. 주소는 서비스 홈 도메인만 써요. 경로를 지어내지 않아요.
5. 값(키·비밀번호·번호)을 채팅에 붙이라고 하지 않아요. 이름과 넣을 곳만 말해요. 사용자가 값을 붙여도 되풀이하지 않고, 노출됐으니 다시 발급하라고 말해요.
6. 장 글에 있는 사실(기다리는 날수·고칠 수 없다는 경고·순서)을 빼지 않아요. 장 글에 없는 사실은 여기서는 확인하지 않았다고 말하고 물어볼 곳을 알려 줘요.
7. 비용은 카드의 종류로 말해요. 금액은 사용자가 물을 때만, 공식 가격 쪽에서 확인한 값에 날짜를 붙여서 말해요.
8. 한 번에 한 장만 보여 줘요. 끝에 다 했어요 또는 막혔어요를 물어요.
9. 해요체로 써요. 비유와 관용구는 쓰지 않아요.

### English · 영어

1. Explain each new word in one sentence. Example: an environment variable is a secret note the site reads.
2. One action per step. Say which screen of which service, what to do there, and what you should see when it worked.
3. Do not state exact button names. Describe the button by its look, for example a button that looks like New project or Create. Add the help sentence once per chapter.
4. Use only the home domain of a service. Do not invent paths.
5. Never ask the user to paste a value (key, password, number) in chat. Give only the name and where to put it. If the user pastes a value, do not repeat it; say it is exposed and must be issued again.
6. Keep every fact in the chapter text (waiting days, warnings that cannot be fixed, order). For facts not in the chapter, say it was not checked here and say where to ask.
7. Say cost by the card's kind. Give an amount only when the user asks, from the official price page checked at that time, with the date.
8. Show one chapter at a time. End by asking: done, or stuck?
9. Use plain, easy English. No metaphors or idioms.

## 고정 문장 · Fixed sentences

**도움 문장 (장마다 글자 그대로 한 번) · Help sentence (once per chapter, verbatim)**
- ko: 버튼 이름이 다르거나 못 찾겠으면 지금 보이는 화면을 말해 주세요. 같이 찾아요.
- en: If a button has a different name or you cannot find it, tell me what you see on the screen now. We will find it together.

**오래됨 문장 (오래된 장에서 글자 그대로) · Old-chapter sentence (verbatim in an old chapter)**
- ko: 이 장은 확인한 지 오래돼서 화면이 바뀌었을 수 있어요.
- en: This chapter was checked a long time ago, so the screens may have changed.

**끝에 묻는 말 · Closing question**
- ko: 다 했어요 / 막혔어요
- en: Done / Stuck

## 일반 낱말 · General words

이 낱말은 장 글에 없어도 써도 돼요. / These words may be used even when the chapter text does not have them.

- ko: 버튼, 새 프로젝트, 만들기, 새로 만들기, 추가, 시작하기, 저장, 확인, 다음, 다 했어요, 막혔어요, 계정, 로그인, 가입, 설정, 메뉴, 대시보드
- en: button, New project, Create, Add, Get started, Save, Continue, Next, Done, Stuck, Account, Log in, Sign up, Settings, Menu, Dashboard

## 점검표 · Checklist

명령을 돌릴 수 없으면 쓴 글을 아래 점검표로 직접 확인하고, 도구로 돌리지 못했고 이 점검표로 확인했다고 사용자에게 한 줄로 알려요. 하나라도 어긋나면 고쳐 쓰고 다시 확인해요. 두 번 고쳐도 남으면 숨기지 않고 말해요. / If you cannot run commands, check the text you wrote against the checklist below, and tell the user in one line that the tool could not be run and this list was used. Fix anything that fails and check again. If something is still wrong after two fixes, say so.

1. 이 장 카드의 「꼭 말할 이름」에 있는 이름이 글에 모두 있어요. / Every name in "Names to say" of this chapter's card is in the text. (`env-missing`)
2. 아래 키 모양 표에 맞는 글자가 글에 없어요. 이름만 있고 값은 없어요. / No string in the text fits the key-shape list below. Names only, no values. (`secret-shape`)
3. 도움 문장이 글자 그대로 들어 있어요. / The help sentence is in the text, letter for letter. (`help-missing`)
4. 번호 단계가 이 장 카드의 단계 수(세 개를 넘으면 세 개)만큼 이상 있고, 단계 하나가 두 문장을 넘지 않아요. / There are at least as many numbered steps as the step count on this chapter's card (at most three), and no step has more than two sentences. (`too-few-steps`)
5. 주소는 이 장 카드의 홈 도메인뿐이고 경로가 붙지 않았어요. / The only address is the home domain of this chapter's card, without a path. (`url`)
6. 대문자와 밑줄로 된 이름은 이 사이트 런북에 든 장들의 이름뿐이에요. / Every name written in capitals with underscores belongs to a chapter of this site's runbook. (`unknown-name`)
7. 오래됨 기준일이 오늘보다 앞선 장이면 오래됨 문장이 글자 그대로 들어 있어요. / If the chapter's "Old after" date is before today, the old-chapter sentence is in the text, letter for letter. (`stale-missing`)
8. 숫자와 따옴표로 묶은 이름은 장 글·카드·일반 낱말에 있는 것뿐이에요. 지어낸 버튼 이름과 숫자가 없어요. / Every number and every name in quotation marks is in the chapter text, the card or the general words. No invented button names or numbers. (`unknown-number`)
9. 글 끝에서 끝에 묻는 말(다 했어요 / 막혔어요)을 물어요. / The text ends by asking the closing question.

도구로 돌리지 못했고 점검표로 직접 확인했어요. / The tool could not be run here; I checked it myself with the checklist.

## 문제 문장 · Problem sentences

- `env-missing`: 장 글에 있는 환경 변수 이름이 빠졌어요. / An environment variable name from the chapter is missing.
- `help-missing`: 도움 문장이 그대로 들어 있지 않아요. / The help sentence is not in the text exactly.
- `secret-shape`: 키나 토큰처럼 보이는 문자열이 있어요. 지우고 이름만 써 주세요. / There is a string that looks like a key or token. Remove it and write only the name.
- `stale-missing`: 오래된 장인데 오래됨 문장이 없어요. / This chapter is old but the old-chapter sentence is missing.
- `too-few-steps`: 번호 단계가 너무 적거나, 단계 하나가 두 문장을 넘어요. / There are too few numbered steps, or one step is longer than two sentences.
- `unknown-name`: 장 글에 없는 이름이 있어요. 지어낸 버튼이나 이름은 쓰지 않아요. / There is a name that is not in the chapter. Do not invent button names or other names.
- `unknown-number`: 장 글에 없는 숫자가 있어요. 지어낸 숫자는 쓰지 않아요. / There is a number that is not in the chapter. Do not invent numbers.
- `url`: 서비스 홈 도메인이 아닌 주소가 있어요. 경로가 붙은 주소는 쓰지 않아요. / There is an address that is not the service home domain. Do not use addresses with paths.

## 키 모양 표 · Key shapes

아래 모양의 글자가 글에 있으면 지우고 이름만 써요. / If a string of one of these shapes is in the text, remove it and write only the name.

- `prefixed-live-key`: `\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{12,}\b`
- `prefixed-api-key`: `\b(?:re|ghp|gho|ghs|xoxb|xoxp)_[A-Za-z0-9]{20,}\b`
- `aws-access-key-id`: `\bAKIA[0-9A-Z]{16}\b`
- `private-key-block`: `-----BEGIN [A-Z ]*PRIVATE KEY-----`
- `long-hex`: `\b[0-9a-fA-F]{40,}\b`
- `jwt`: `\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b`
