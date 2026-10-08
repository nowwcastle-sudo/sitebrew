[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# sitebrew

sitebrew 是包含五个技能的 Claude Code 插件。这些技能带你使用 web-factory（shadcn 注册表和站点生成流水线）与 launch-factory（负责认证、支付、邮件和分析的后端启动套件）。它始终使用下面固定的发布标签，从不使用 `main`。每个指南版本固定了哪些套件标签，见 `compat.json`。

## 固定版本

| 部分 | 标签 |
|---|---|
| web-factory | `v0.1.0` |
| launch-factory | `v0.1.0` |

## 安装

通过本仓库的插件市场安装：

```bash
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.1.0
/plugin install sitebrew@sitebrew
```

若只想试用而不安装，可以用 `claude --plugin-dir <path>` 启动 Claude Code，路径填 Sitebrew 克隆中的 `plugins/sitebrew` 文件夹。

在 Codex 中，先添加市场，再安装插件（两条命令见 `codex plugin --help`）：

```bash
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.1.0
codex plugin add sitebrew@sitebrew
```

把插件选项复制到 shell 的会话钩子只用于 Claude Code（Codex 的安装不会加载钩子）。在 Codex 中请直接设置普通环境变量，方法见 `doctor` 技能。

## 技能

| 技能 | 用途 |
|---|---|
| `new` | 回答几个问题，得到三个站点候选方案，比较后选择一个。 |
| `revise` | 只修改已生成站点的某个版块、某个设计维度或某段文案。 |
| `deliver` | 把选定的站点复制到你自己的文件夹，并附上列出发布前待修项的 README。 |
| `doctor` | 用韩文和英文告诉你电脑上缺什么、怎么修。 |
| `guide` | 安装 web-factory 组件、启动 launch-factory 模板、说明有哪些密钥。 |

先使用这两个：

```text
/sitebrew:doctor
/sitebrew:new
```

## 密钥是可选的

开始使用不需要任何密钥。没有密钥时，套件会以预览模式生成站点：图库照片位置保留为“图片准备中”占位框，法律页面保持“未审核”，结果会标明不可发布。每个缺失项都会用一行说明它关闭了什么。

启用插件时，Claude Code 会询问四个可选值（`userConfig`）。留空即可保持预览模式。通过命令行安装（`claude plugin install`）时不会询问这些值；需要时可在 Claude Code 中用 `/plugin configure sitebrew@sitebrew` 之后再设置。

| 名称 | 敏感值 | 带来什么 |
|---|---|---|
| `PEXELS_API_KEY` | 是 | 用真实图库照片取代占位框。 |
| `LAW_API_OC` | 是 | 对照法律条文核对法律页面。 |
| `VERCEL_TOKEN` | 是 | 在线预览链接。 |
| `HIGGSFIELD_DIR` | 否（文件夹） | 你自己生成的图片。 |

三个密钥保存在 Claude Code 的安全凭据存储中，而不是设置文件里。套件读取普通环境变量，所以每次会话开始时，本插件的钩子会把你填写的选项复制到该会话的 shell 环境中（修改选项后请重启 Claude Code）。你自己设置的环境变量（例如用 `setx`）始终优先。复制内容以明文文件保存在你的 Claude 配置文件夹的 `session-env` 目录中，不会被自动删除；如果不希望这样，请改用普通环境变量。插件从不输出密钥的值：它的 doctor 只报告名称、是否已设置和长度。 该副本位于 `~/.claude/session-env/<会话 id>/`（删除该文件夹即可清除）；在 Windows 上，其访问权限遵循你用户配置文件的权限。

3D 物体主视觉（`object-3d-orbit`）从一张图片开始：图片 → GLB 模型 → 显示。没有相应工具时，会降级为 2.5D，再降级为海报；如果完全没有图片，套件就不会选择这个主视觉。

## sitebrew 的作用

- 用 `npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/<item>#v0.1.0 -y -o` 把 web-factory 的组件装进 Next.js 项目。
- 逐步带你运行 `npm run stamp`，把一份需求简述变成站点候选方案。
- 以 mock 模式启动 launch-factory 模板，再列出 live 模式所需的内容。
- 告诉你哪些密钥需要自己创建。只列出名称，从不向你索要具体值。

## 需要了解的限制

- 公开仓库不包含私有历史中的图库照片、生成视频和照片质感素材，因为其再分发条款尚未确认。
- 没有 `LAW_API_OC` 就无法对照法律核对法律页面，因此在你添加它之前，站点会一直标明不可发布。
- launch-factory 的一致性测试读取同一克隆中的 web-factory 部分，请在 Sitebrew 克隆内运行。

完整的密钥清单见 `skills/guide/references/keys.md`。

## 许可证

MIT。见 `LICENSE`。
