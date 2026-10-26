[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

**回答几个问题，得到三个完成的网站，留下你喜欢的那一个。**

Sitebrew 是 Claude Code 和 Codex 的插件。你用平常的话描述想要的网站，它会做出三个不同的候选。你选一个，在对话中修改，然后把代码放进自己的文件夹。不需要会写代码，开始时也不需要 API 密钥。

当前版本 `v0.2.3` · MIT 许可证 · Windows 10 和 11

## 为什么用 Sitebrew

- **三个真实的选项，而不是一次猜测。** 不必一遍遍改写同一个提示，而是把三个完成的候选并排比较。
- **属于你的代码。** 结果是放在你文件夹里的 Next.js 和 shadcn/ui 项目。没有托管的搭建器，也不会被绑定。
- **不编造内容。** 你没有提供的事实（例如电话号码）会留作有标记的空白。法律页面在检查之前一直带有标记。
- **没有密钥也能用。** 没有密钥时，网站以预览模式生成。可选的密钥会加入真实照片、经过检查的法律页面和预览链接。
- **10 种网站。** 品牌、本地商家、网店、商品详情、活动或候补页面、作品集、公共机构、SaaS、移动应用（PWA）和管理后台，可用韩语或英语。
- **动效和 3D。** 首屏可以带动效，3D 物体首屏从一张图片开始（图片 → 3D 模型）。没有相应工具时，先退回 2.5D 图片，再退回海报。
- **需要时还有后端。** 同一仓库中的 launch-factory 套件提供注册、支付、邮件和分析。

## 工作原理

1. **提问。** `/sitebrew:new` 询问名称、受众、联系方式和氛围。不知道的可以跳过。
2. **生成。** 工厂把经过测试的部件（区块、样式轴、配方和原型）组合成三个候选。每个候选都要通过布局、无障碍和文案的质量关卡。
3. **挑选。** 看板把三个候选并排展示，由你选一个。
4. **修改。** `/sitebrew:revise` 修改一个区块、颜色、字体、动效或一段文案。
5. **交付。** `/sitebrew:deliver` 把选中的网站复制到你的文件夹，并附上发布前要填写的清单。

## 安装

### 需要什么

| 项目 | 版本 | 必需 | 在 Windows 上安装 |
|---|---|---|---|
| Claude Code 或 Codex | 最新 | 二选一 | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | 是 | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | 是 | 随 Node 一起安装 |
| Git | 最新 | 是 | `winget install Git.Git` |
| Chrome | 最新 | 否 | `winget install Google.Chrome` |

下面每种安装方式都会找出缺少的东西并告诉你。安装任何东西之前都会先问你。请以普通用户身份打开 PowerShell，不要用管理员身份。

### 五种方式任选其一

| 方式 | 适用情况 |
|---|---|
| 1. npm | 已经有 Node |
| 2. npx | 已经有 Node，并且习惯用 npx |
| 3. PowerShell | 想用一行命令，同时检查 Node 和 Git |
| 4. 插件 | 只想把插件加到 Claude Code 或 Codex |
| 5. AI 代理 | 想让 Claude Code 或 Codex 替你安装 |

五种方式的结果相同：Sitebrew 放在 `sitebrew` 文件夹中，插件装进你的代理。

#### 1. npm

```powershell
npm create sitebrew@0.2.3 sitebrew
```

#### 2. npx

```powershell
npx create-sitebrew@0.2.3 sitebrew
```

两者的选项相同：`--dry-run` 只显示计划，不做任何改动；`--yes` 对所有问题回答“是”；`--tool` 从 `claude`、`codex`、`both` 中选择。

#### 3. PowerShell

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.3/get.ps1 | iex
```

不安装任何东西、只看会做什么：

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.3/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

#### 4. 插件

在 Claude Code 中：

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.2.3
/plugin install sitebrew@sitebrew
```

在 Codex 中：

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.2.3
codex plugin add sitebrew@sitebrew
```

#### 5. AI 代理

把下面的文字粘贴到 Claude Code 或 Codex。代理会按照为代理编写的分步指南 [AGENT_INSTALL.md](AGENT_INSTALL.md) 进行安装。

```text
Install Sitebrew for me. Read https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/main/AGENT_INSTALL.md and follow it step by step. Ask me before you install any program, and ask me which agent to use. At the end, show me the last lines of the installer output.
```

如果安装中途停止，退出码和处理方法在 [AGENT_INSTALL.md](AGENT_INSTALL.md) 中。

## 做第一个网站

在一个空文件夹中打开 Claude Code，然后运行：

```text
/sitebrew:doctor
/sitebrew:new
```

`/sitebrew:doctor` 列出缺少的东西，每项附一行修复方法。在 Codex 中，说“用 sitebrew new 技能做一个网站”。可选密钥和完整的技能列表在[插件说明](plugins/sitebrew/README.md)中。

## 面向开发者

仓库分为三部分：根目录的网站工厂（web-factory）、`launch-factory/` 中的后端套件，以及 `plugins/sitebrew/` 中的插件。

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

合并前的检查是 `npm run ci:verify`。给代理的指南是 [docs/agents/agent-guide.md](docs/agents/agent-guide.md)，发布套件的说明在 [launch-factory/README.md](launch-factory/README.md)。

也可以只把部件加到另一个 Next.js 项目中。地址里一定要带上标签：

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-default#v0.2.3 -y -o
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-base#v0.2.3 -y -o
```

## 参与贡献

欢迎贡献：错误报告、想法、新的配方或区块，以及翻译。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，它很短。

## 许可证

MIT。见 [LICENSE](LICENSE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 发布记录

| 标签 | 日期 | 变更 | 记录 |
|---|---|---|---|
| `v0.2.3` | 2026-10-26 | 补丁版本：重做插件的八个技能，分流说明与退出码表更清晰 · 每条规则只放在一处 · 安装技能增加缺少 Node.js 时的处理路径 · 安装指南加入精确的发布标签检查和适用于 Windows 的 npm 用法 · 浏览器检查与套件读取的位置一致 · new 的交接更安全 · deliver 增加更多跳过原因 · web-factory v0.0.16 + launch-factory v0.2.2（内部版本）| — |
| `v0.2.2` | 2026-10-25 | 技能审查修复：doctor 技能不再自行安装，改为交给安装技能 · deliver 区分 Vercel 预览链接与临时公开地址 · revise 增加统一的退出码表，runbook 按章节读取章节文件，new 把构建时间标为单次测量 · 插件指南列出安装技能与运行手册技能 · QA 页面不再显示真人姓名 · web-factory v0.0.16 + launch-factory v0.2.2（内部版本） | — |
| `v0.2.1` | 2026-10-25 | 补丁版本：shadcn 4.22.1 集中在一处精确固定（消除嵌套 zod 公告）· 广告落地页默认 noindex · 商品列表输出 ItemList、活动落地页输出 Event 结构化数据 · 分享图显示品牌标志 · 活动落地页简报会询问日期和地点 · 添加配方的检查直接遵循指南文档 · web-factory v0.0.16 + launch-factory v0.2.2（内部版本）| — |
| `v0.2.0` | 2026-10-24 | 无需密钥即可在 mock 模式下运行的后端模块（商店与韩国支付、预约、通知与推送、评价、搜索、存储、通讯、我的请求、管理端） · 通过 Cloudflare 临时隧道生成的可分享预览链接 · 决定使用站点之后才会出现的站点主人指南与运行手册 · 技能现在能判断自己处于聊天机器人还是代理环境，并新增可补装缺失工具的安装技能 · web-factory v0.0.14 + launch-factory v0.2.0（内部版本） | — |
| `v0.1.2` | 2026-10-16 | 应对插件目录审核：doctor 从 compat.json 读取克隆地址、插件 README 列出网络调用、发布指南加入 GitHub 发布步骤、launch 工具包 lucide-react 1.53.0 | — |
| `v0.1.1` | 2026-10-15 | 为 Claude 插件目录做好准备：换行规则不再作用于 `plugins/sitebrew`、插件图标、更清楚的 doctor 提示、五种安装方式、AGENT_INSTALL.md 和 CONTRIBUTING.md | — |
| `v0.1.0` | 2026-10-15 | 首次公开发布 · web-factory v0.0.13 + launch-factory v0.1.2（内部版本） | — |
