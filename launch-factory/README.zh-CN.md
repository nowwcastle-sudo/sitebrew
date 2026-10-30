[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# launch-factory

这是与 web-factory（界面区块仓库）配套的上线套件，后端的认证、数据、支付、邮件、埋点和任务由本仓库负责。产品从复制 `template/` 开始，只需升级 `@launch-factory/*` 包版本，就能获得安全补丁。

当前版本 `v0.2.4` · web-factory 固定 `v0.2.4` · 区块 `19c81efc` · contract `19c81efc`（标签 v0.2.4 的提交）

- 区块不了解具体的服务商，由适配器实现 web-factory 的端口。同一套一致性测试用来检查适配器能否复现与 mock 相同的场景。
- 功能包（适配器、Server Action、Webhook 路由、schema、迁移）由 `registry.json` 中的一个条目打包。版本固定的记录见 [`docs/versions.md`](docs/versions.md)。
- 契约以 web-factory 的 `registry/factory/contract/` 为准。

## 环境要求

`npm run setup` 会检查下列全部项目，并告知缺失项以及当前操作系统的安装命令。它不会安装系统软件。

| 项目 | 版本 | 是否必需 | Windows | macOS | Linux |
|---|---|---|---|---|---|
| Node | >=24.13.0 | 必需 | `winget install OpenJS.NodeJS.LTS --version 24.13.0` | `nvm install 24.13.0` | `nvm install 24.13.0` |
| npm | >=11.6.2 | 必需 | 随 Node 一起安装 | 随 Node 一起安装 | 随 Node 一起安装 |
| git | 最新 | 必需 | `winget install Git.Git` | `brew install git` | `sudo apt install git` |
| web-factory 检出副本 | 标签 `v0.0.16` | 可选 | `git clone` 后把路径填入 `LF_WF_REPO` | `git clone` 后把路径填入 `LF_WF_REPO` | `git clone` 后把路径填入 `LF_WF_REPO` |
| Chrome | 最新 | 可选 | `winget install Google.Chrome` | `brew install --cask google-chrome` | `sudo apt install chromium` |
| gh | 最新 | 可选 | `winget install GitHub.cli` | `brew install gh` | `sudo apt install gh` |
| vercel | 最新 | 可选 | `npm i -g vercel` | `npm i -g vercel` | `npm i -g vercel` |
| gitleaks | CI 固定 8.30.1 | 可选 | `winget install Gitleaks.Gitleaks` | `brew install gitleaks` | [发布文件](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) |
| actionlint | CI 固定 1.7.12 | 可选 | `winget install rhysd.actionlint` | `brew install actionlint` | [发布文件](https://github.com/rhysd/actionlint/releases/tag/v1.7.12) |
| zizmor | CI 固定 1.30.1 | 可选 | `winget install zizmor.zizmor` | `brew install zizmor` | `pipx install zizmor` |
| osv-scanner | CI 固定 2.6.0 | 可选 | `winget install Google.OSVScanner` | `brew install osv-scanner` | [发布文件](https://github.com/google/osv-scanner/releases/tag/v2.6.0) |

缺少可选项目时，下面这些事做不了。

- web-factory 检出副本：没有它，一致性测试会标记为 SKIP。有的话，会读取 `LF_WF_REPO` 指向的位置，那里必须有 `v0.0.16` 提交。没有设置环境变量时使用代码里的默认路径，所以在其他电脑上一定要指定 `LF_WF_REPO`。
- Chrome：`npm run template:screens` 无法运行。如果安装位置不是默认路径，把可执行文件的路径填入 `CHROME_PATH`。
- 四个安全工具：`npm run ci:verify` 会把对应步骤标记为 SKIP。CI 会下载并使用 `scripts/ci/tools.json` 中固定的版本。想在本地也把缺失算作失败，请设置 `LF_CI_REQUIRE_TOOLS=1`。
- gitleaks：提交前的机密值扫描钩子只给出提示，然后放行。
- gh：用于克隆和推送私有仓库，以及登录 GitHub（`gh auth login`）。
- vercel：预览部署和 `npm run env:check -- --vercel` 需要它。

其他要求：

- 内存：构建和页面门禁需要约 3GB 空闲内存。不足时 `template:screens` 会等待（`LF_SCREENS_MIN_FREE_GB`）。
- 行尾：`.gitattributes` 把行尾固定为 LF，所以与 `core.autocrlf` 的设置无关。
- Shell：脚本全部用 Node 编写，所以 PowerShell 和 bash 的效果相同。`template:screens` 的 `--only /pricing` 这类参数，Git Bash 会把它当作路径转换，所以请在 PowerShell 中传入。
- 数据库：测试使用内存中的 PGlite，不需要安装任何东西。live 连接使用 Supabase 的 `DATABASE_URL`。

### 环境变量

值不放进仓库。名称列表以 [`.env.example`](.env.example) 为准。

| 状态 | 所需内容 |
|---|---|
| mock（默认开发） | 只需 `LF_MODE=mock`。没有服务商密钥也能启动。 |
| live | `LF_MODE=live`，加上服务商密钥和 `DATABASE_URL`。缺少的名称会由 `npm run env:check`（离线）和 `npm run doctor -- --stage sandbox` 告知。 |
| 可选 | `INQUIRY_OWNER_EMAIL`、`POSTHOG_*`、`SENTRY_DSN`。缺少时只会关闭对应的功能。 |
| 商店（可选） | `NEXT_PUBLIC_PORTONE_STORE_ID`、`NEXT_PUBLIC_PORTONE_CHANNEL_KEY`、`PORTONE_API_SECRET`、`PORTONE_WEBHOOK_SECRET`。live 模式需要四个全部具备，缺少任何一个只会关闭商店。mock 模式无需密钥，使用模拟支付确认步骤。 |
| 路径 | `LF_WF_REPO`（一致性测试读取的 web-factory 检出副本）、`WF_HOME`（`template:screens` 读取的 web-factory 检出副本）、`CHROME_PATH` |

## 开始使用

如果仓库是私有的，克隆前需要先登录 GitHub。

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew/launch-factory
npm run setup
npm run ci:verify
```

- `npm run setup`：检查环境，并把 `.githooks` 设为 `core.hooksPath`。`node_modules` 缺失或过旧时会运行 `npm ci`。必需项缺失时退出码为 1，最后一行是 `setup: FAIL`。
- `npm run ci:verify`：一套与 CI 相同的检查。每个步骤用表格显示 PASS、FAIL、SKIP，只要有一个 FAIL，退出码就是 1。

以 mock 模式启动模板。

```bash
LF_MODE=mock npm run dev -w template
```

```powershell
$env:LF_MODE = "mock"; npm run dev -w template
```

在 http://localhost:3000 查看。

## 常用操作

| 想做的事 | 命令 |
|---|---|
| 单元测试 | `npm test` |
| 运行前检查（密钥是否可用） | `npm run doctor -- --stage dev`（也有 `sandbox`、`preview`） |
| 重新生成并检查注册表 | `npm run registry:build` · `npm run registry:check` |
| 模板页面门禁（构建约 4 分钟） | `npm run template:screens` |
| README 是否与现状一致 | `npm run readme:check` |

### 升级 web-factory 固定版本

web-factory 发布新标签 `vX.Y.Z` 后，按下面的顺序升级。

```bash
npm run contract:sync -- --from <web-factory-path> --ref vX.Y.Z
node scripts/template-sync.mjs blocks --from <web-factory-path> --ref vX.Y.Z
git diff template/package.json
```

1. 如果 `git diff template/package.json` 中出现 sync 升高了的依赖，就把它还原。
2. 把 `scripts/lib/wf-conformance.mjs` 中的 `WF_CONFORMANCE_COMMIT` 改成新标签的提交哈希。
3. 把 `docs/versions.md` 中 web-factory 那一行，以及本 README 里的“web-factory 固定”，改成新标签。
4. 确认 `npm run ci:verify` 的结果是 0。

### 发布新版本

按 [`docs/RELEASING.md`](docs/RELEASING.md) 的顺序操作。更新 README 和运行 `npm run readme:check -- --tag vX.Y.Z`，是打标签前的必需步骤。

## 遇到问题时

| 现象 | 原因 | 解决办法 |
|---|---|---|
| `setup: FAIL — 필수 누락 …` | 缺少必需工具，或版本过低 | 执行每行带 `→` 的命令，然后重新运行 `npm run setup`。 |
| `web-factory 체크아웃 없음` · `web-factory 커밋 … 을 찾지 못함` | `LF_WF_REPO` 的路径不存在，或没有 `v0.0.16` 提交 | 克隆 web-factory，执行 `git -C <path> fetch --tags`，再把该路径填入 `LF_WF_REPO`。 |
| `SKIP(도구 없음)` | 缺少可选的安全工具 | 这不是失败。安装之后该步骤就会运行。 |
| `[pre-commit] gitleaks 가 설치돼 있지 않아 … 건너뛴다` | 钩子已经启用，但没有安装 gitleaks | 执行“环境要求”表中 gitleaks 的命令。 |
| `--only /pricing` 找不到任何页面 | Git Bash 会把 `/pricing` 当作路径转换 | 在 PowerShell 中运行。 |

## 发布记录

| 标签 | 日期 | 内容 | 记录 |
|---|---|---|---|
| `v0.2.4` | 2026-10-26 | launch-factory v0.2.2 (internal version) · 补丁版本：仅更新依赖包 · drizzle-orm 0.45.4 · posthog-js 1.438.12 与 posthog-node 5.55.2 · resend 6.32.1 · react-day-picker 10.0.2 · 开发用 eslint 10.13.0 与 typescript-eslint 8.71.2 · web-factory 固定为 `v0.2.4` | — |
| `v0.2.3` | 2026-10-25 | launch-factory v0.2.2 (internal version) · 补丁版本：shadcn 4.22.1 精确固定为一个版本（消除嵌套 zod 公告及其 OSV 例外）· web-factory 固定为 `v0.2.3` | — |
