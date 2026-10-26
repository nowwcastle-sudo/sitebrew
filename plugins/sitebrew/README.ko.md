[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# sitebrew

sitebrew 는 스킬 다섯 개를 담은 Claude Code 플러그인이다. 스킬은 web-factory(shadcn 레지스트리와 사이트 찍어내기 파이프라인)와 launch-factory(인증·결제·메일·분석을 맡는 백엔드 출시 키트)를 쓰는 길을 안내한다. 항상 아래의 고정 릴리스 태그만 쓰고 `main` 은 쓰지 않는다. 안내 판마다 고정한 키트 태그는 `compat.json` 에 있다.

## 고정 버전

| 부분 | 태그 |
|---|---|
| web-factory | `v0.2.4` |
| launch-factory | `v0.2.4` |

## 설치

이 저장소의 마켓플레이스로 설치한다.

```bash
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.2.4
/plugin install sitebrew@sitebrew
```

설치 없이 써 보려면 `claude --plugin-dir <path>` 로 Claude Code 를 시작한다. 경로에는 Sitebrew 클론의 `plugins/sitebrew` 폴더를 쓴다.

Codex 에서는 마켓플레이스를 먼저 추가한 뒤 플러그인을 설치한다 (두 명령은 `codex plugin --help` 에 나온다).

```bash
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.2.4
codex plugin add sitebrew@sitebrew
```

플러그인 옵션을 셸로 복사하는 세션 훅은 Claude Code 에만 있다 (Codex 설치는 훅을 읽지 않는다). Codex 에서는 일반 환경 변수를 직접 설정한다. 방법은 `doctor` 스킬에 있다.

## 스킬

| 스킬 | 하는 일 |
|---|---|
| `new` | 질문 몇 개에 답하면 사이트 후보 세 개를 만들어 비교하고 고르게 한다. |
| `revise` | 만든 사이트의 구획 하나, 디자인 축 하나, 문구 하나만 바꾼다. |
| `deliver` | 고른 사이트를 내 폴더로 복사하고, 공개 전에 고칠 것을 적은 README 를 넣는다. |
| `doctor` | 내 컴퓨터에 빠진 것과 고치는 법을 한국어·영어로 알린다. 직접 설치하지는 않고, 설치는 `setup` 스킬이 한다. |
| `setup` | Sitebrew 에 필요한 것(Node.js, Git, 브라우저, Sitebrew 폴더)을 하나씩, 항목마다 승낙을 받은 뒤에만 설치한다. |
| `preview` | 받은 사이트를 계정·키·비용 없이 임시 공개 주소로 잠깐 열어 남에게 보여 준다. |
| `runbook` | 사이트를 실제로 쓰기로 정한 뒤, 어떤 외부 서비스에 어떤 순서로 가입하는지, 각각 어떤 종류의 비용이 드는지, 건너뛰면 무엇이 멈추는지 안내한다. |
| `guide` | web-factory 부품을 설치하고, launch-factory 템플릿을 켜고, 어떤 키가 있는지 알려 준다. |

먼저 이 둘을 쓴다.

```text
/sitebrew:doctor
/sitebrew:new
```

## 키는 선택이다

시작하는 데 키는 필요 없다. 키가 없으면 키트는 사이트를 미리보기 모드로 만든다. 스톡 사진 칸은 「이미지 준비 중」 틀로 남고, 법정 쪽은 「검토 안 됨」으로 남고, 결과에는 공개 불가 표시가 붙는다. 빠진 항목마다 무엇이 꺼지는지 한 줄로 알려 준다.

플러그인을 켜면 Claude Code 가 선택 값 네 개(`userConfig`)를 묻는다. 비워 두면 미리보기 모드로 남는다. 명령줄 설치(`claude plugin install`)는 이 값을 묻지 않는다. 필요하면 Claude Code 안에서 `/plugin configure sitebrew@sitebrew` 로 나중에 넣는다.

| 이름 | 민감 값 | 더해지는 것 |
|---|---|---|
| `PEXELS_API_KEY` | 예 | 틀 대신 실제 스톡 사진. |
| `LAW_API_OC` | 예 | 법령 조문과 대조한 법정 쪽. |
| `VERCEL_TOKEN` | 예 | 온라인 미리보기 주소. |
| `HIGGSFIELD_DIR` | 아니오(폴더) | 직접 만든 생성 이미지. |

키 세 개는 설정 파일이 아니라 Claude Code 의 보안 자격 증명 저장소에 들어간다. 키트는 일반 환경 변수를 읽으므로, 세션이 시작될 때마다 이 플러그인의 훅이 입력한 옵션을 그 세션의 셸 환경에 복사한다 (옵션을 바꾼 뒤에는 Claude Code 를 다시 시작한다). `setx` 등으로 직접 설정한 환경 변수가 항상 우선한다. 복사본은 Claude 프로필의 `session-env` 폴더에 일반 텍스트 파일로 남고 자동으로 지워지지 않는다. 원하지 않으면 일반 환경 변수를 대신 쓴다. 플러그인은 키 값을 출력하지 않는다. doctor 는 이름과 설정 여부, 길이만 알려 준다. 복사본은 `~/.claude/session-env/<세션 id>/` 에 있다 (지우려면 그 폴더를 삭제한다). Windows 에서는 파일 접근 권한이 사용자 프로필의 권한을 따른다.

3D 오브젝트 히어로(`object-3d-orbit`)는 이미지에서 시작한다. 이미지 → GLB 모델 → 화면 표시 순서다. 그 도구가 없으면 2.5D 로, 그다음은 포스터로 내려가고, 이미지가 하나도 없으면 키트는 이 히어로를 고르지 않는다.

## 네트워크 호출

플러그인은 관리자에게 아무것도 보내지 않는다. 플러그인이 부르는 킷은 해당 키를 넣었을 때만 외부 서비스를 부른다:

| 서비스 | 언제 | 보내는 것 |
|---|---|---|
| Pexels | `PEXELS_API_KEY` 를 넣었을 때 (05단계, 미디어) | 스톡 사진·영상 검색어 |
| 국가법령정보 API (law.go.kr) | `LAW_API_OC` 를 넣었을 때 (법정 쪽 검토) | 대조할 법령 이름 |
| Vercel | `VERCEL_TOKEN` 을 넣고 `--deploy-preview` 를 붙였을 때 | 빌드한 사이트 파일 |

킷을 준비할 때 GitHub 에서 저장소를, npm 레지스트리에서 패키지를 내려받는다. launch-factory 킷은 직접 서비스를 연결하기 전까지 모의(mock) 모드로 돈다.

## sitebrew 가 하는 일

- `npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/<item>#v0.2.4 -y -o` 로 web-factory 부품을 Next.js 프로젝트에 설치한다.
- 브리프를 사이트 후보로 바꾸는 `npm run stamp` 를 단계별로 안내한다.
- launch-factory 템플릿을 mock 모드로 켜고, live 모드에 필요한 것을 정리해 준다.
- 직접 만들어야 하는 키를 알려 준다. 이름만 알려 주고 값은 묻지 않는다.

## 알아 둘 한계

- 공개 저장소에는 비공개 이력에 있던 스톡 사진·생성 영상·사진 질감이 없다. 재배포 조건을 확인하지 못했기 때문이다.
- `LAW_API_OC` 가 없으면 법정 쪽을 법령과 대조할 수 없어서, 키를 넣을 때까지 사이트에 공개 불가 표시가 남는다.
- launch-factory 적합성 시험은 같은 클론 안의 web-factory 부분을 읽는다. Sitebrew 클론 안에서 돌린다.

키 목록 전체는 `skills/guide/references/keys.md` 에 있다.

## 라이선스

MIT. `LICENSE` 를 본다.
