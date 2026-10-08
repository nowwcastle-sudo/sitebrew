[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

回答几个问题，Sitebrew 就为你做出三个网站候选。你把三个候选并排比较，选出一个。修改之后，把它放进你自己的文件夹。它以插件形式在 Claude Code 或 Codex 中运行，不需要会写代码。

当前版本 `v0.1.0`。

- 可以做 10 种网站：品牌、本地店铺、网店、商品详情、活动或候补名单落地页、作品集、公共机构、SaaS、移动应用（PWA）和管理后台。
- 可以做韩语网站和英语网站。本地店铺和公共机构只支持韩语。
- 需要注册和付款的服务，接到同一仓库里的 launch-factory 工具包。
- 在 Windows 10 和 11 上开发和测试。

## 需要准备的东西

| 项目 | 版本 | 必需 | 在 Windows 上安装 |
|---|---|---|---|
| Claude Code 或 Codex | 最新 | 二选一 | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | 是 | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | 是 | 随 Node 一起安装 |
| Git | 最新 | 是 | `winget install Git.Git` |
| Chrome | 最新 | 否 | `winget install Google.Chrome` |

- 下面的安装程序会找出缺少的东西并告诉你。它在安装任何东西之前都会先问你，你回答之前什么都不装。
- Claude Code 和 Codex 需要用各自服务的账号登录。
- 没有 Chrome 时，只会跳过部分画面检查。网站照样能做出来。
- 打开 PowerShell 的方法：在开始菜单里搜索 "PowerShell" 并打开。不要以管理员身份打开，安装程序在管理员窗口中会停止。

## 安装

### 一行安装（推荐）

把下面这一行粘贴到 PowerShell。安装程序会把 Sitebrew 放进当前文件夹下的 `sitebrew` 文件夹，并把插件装进你选择的代理。

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
```

如果只想看它会做什么、不安装任何东西，这样运行：

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

要自己选代理或文件夹，用带选项的写法。`-Tool` 是 `claude`、`codex` 或 `both` 之一。`-Yes` 对所有问题回答"是"。`-WhatIf` 只做预览。

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/install.ps1).TrimStart([char]0xFEFF))) -Tool claude -Folder "$HOME\sitebrew"
```

### 用 npx 安装

如果已经装了 Node，也可以用这个方法。它取得仓库后显示两条插件安装命令，你回答"是"就会立即运行。

```powershell
npx create-sitebrew@0.1.0 sitebrew
```

### 只安装插件

在 Claude Code 中：

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.1.0
/plugin install sitebrew@sitebrew
```

在 Codex 中：

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.1.0
codex plugin add sitebrew@sitebrew
```

要确认安装，运行 `claude plugin list`。

## 做第一个网站

1. 在一个用来放网站文件的空文件夹里打开 Claude Code。
2. 运行 `/sitebrew:doctor` 查看缺少什么。每个缺少的项目都附有一行修复方法。
3. 运行 `/sitebrew:new` 并回答问题：名称、目标客户、联系方式、风格等。不知道的可以留空。
4. 比较三个候选并选出一个。
5. 想修改时，用 `/sitebrew:revise` 改一个区块、颜色、字体或动效，或一段文字。
6. 用 `/sitebrew:deliver` 把选中的网站放进你自己的文件夹。随附的说明文件列出了发布前要补上的内容。

```text
/sitebrew:doctor
/sitebrew:new
```

在 Codex 中，说"用 sitebrew 的 new 技能做一个网站"。想要英语网站，一开始就说"英语网站"。

## 预览模式和空白项

没有任何密钥也能开始。没有密钥时，网站以预览模式做出，并标上"不可发布"。每个原因都有一行说明缺少什么。

- "待确认"：你在问题中留空的事实（电话号码、商家信息等）。它保持空白，绝不编造。由你来填。
- "需要真实照片"：只能放真实照片的位置，例如店铺或产品画面。放入你的照片。
- "法律审核未完成"：条款和隐私政策草稿还没有和法律条文核对。

下面的值都是可选的。启用插件时 Claude Code 会询问。如果是从命令行安装的，它不会询问，请用 `/plugin configure sitebrew@sitebrew` 填入。不要把密钥粘贴到聊天里。

| 名称 | 填上后增加的功能 |
|---|---|
| `PEXELS_API_KEY` | 用真实图库照片代替空的照片位置 |
| `LAW_API_OC` | 韩语法律页面与现行法律条文核对 |
| `VERCEL_TOKEN` | 在线预览链接 |
| `HIGGSFIELD_DIR` | 存放你自己的图片和 3D 模型的文件夹 |

```text
/plugin configure sitebrew@sitebrew
```

3D 物体首屏（`object-3d-orbit`）从一张图片开始：图片 → GLB（3D 模型）→ 显示在画面上。没有相应工具时，退回 2.5D 图片，再退回海报。完全没有图片时，不会选用这个首屏。

## 本文用词

| 词 | 含义 |
|---|---|
| 候选 | 用同一组回答做出的一种网站方案。一次三个 |
| 看板 | 把候选并排放在一起、从中挑选的画面 |
| 生成 | 根据你的回答做出网站的过程（`npm run stamp`） |
| 预览模式 | 在缺少密钥或事实时做出的网站。适合挑选，不适合发布 |
| 不可发布 | 表示发布前还有内容要补。会同时给出原因 |
| 诊断 | 告诉你电脑上缺少什么、怎么修复的检查 |
| 检查台 | 逐个展示部件和区块的开发者画面（`npm run dev`） |

## 安装中途停止时

安装程序把结果留在 `$LASTEXITCODE` 中。在非终端环境中运行时，所有问题都按"否"处理。

| 代码 | 含义 | 该做什么 |
|---|---|---|
| 0 | 完成，或预览 | 按最后一行提示的下一步操作 |
| 1 | 下载、克隆或插件命令失败 | 检查网络连接后再运行同一行 |
| 2 | 选项或文件夹有误 | 检查 `-Folder` 路径。Windows 或 Program Files 下的文件夹会被拒绝 |
| 3 | 缺少东西或需要你回答 | 运行画面上显示的安装命令，或加 `-Yes` 重新运行 |
| 4 | 拒绝启动 | 如果是管理员窗口，请在普通 PowerShell 窗口中重新运行 |

加 `-Yes` 运行时，把 Sitebrew 文件夹保存到用户环境变量 `SITEBREW_DIR` 这一步也会回答"是"。

## 开发者须知

仓库由三部分组成。`factory/` 和 `registry/` 是网站工厂（web-factory），`launch-factory/` 是注册、付款、邮件和分析工具包。`plugins/sitebrew/` 是插件，`packages/create-sitebrew/` 是 npx 安装程序。

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

- `npm run setup` 检查环境，需要时安装依赖。`npm run dev` 打开检查台。
- 合并前的检查只有一行：`npm run ci:verify`。
- 给代理的完整指南是 [docs/agents/agent-guide.md](docs/agents/agent-guide.md)。
- 添加配方或区块的方法见 [docs/guides/add-recipe.md](docs/guides/add-recipe.md)。
- launch-factory 的用法见 [launch-factory/README.md](launch-factory/README.md)。
- 发布步骤见 [docs/RELEASING.md](docs/RELEASING.md)。字体许可见 [docs/qa/font-licenses.md](docs/qa/font-licenses.md)。

也可以只把部件安装到另一个 Next.js 项目中。地址后面一定要加标签。

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-default#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-base#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/alert-dialog#v0.1.0 -y -o
```

## 许可证

MIT。见 [LICENSE](LICENSE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 发布记录

| 标签 | 日期 | 变更 | 记录 |
|---|---|---|---|
| `v0.1.0` | 2026-10-15 | 首个公开发布 · web-factory v0.0.13 + launch-factory v0.1.2（内部版本） | — |
