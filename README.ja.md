[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

**いくつかの質問に答えるだけ。完成したウェブサイトが三つできます。気に入った一つを残してください。**

Sitebrew は Claude Code と Codex で使うプラグインです。作りたいサイトをふだんの言葉で説明すると、違う候補を三つ作ります。一つを選び、会話で直して、コードを自分のフォルダーに持ち帰ります。コードの知識も、始めるときの API キーもいりません。

現在のバージョン `v0.2.5` · MIT ライセンス · Windows 10 と 11

## なぜ Sitebrew なのか

- **当て推量一つではなく、本物の選択肢が三つ。** 同じプロンプトを何度も書き直す代わりに、完成した候補三つを並べて比べます。
- **自分のものになるコード。** 結果は自分のフォルダーに入る Next.js と shadcn/ui のプロジェクトです。ホスト型のビルダーも、囲い込みもありません。
- **作り話をしません。** 電話番号など、伝えていない事実は印の付いた空欄のまま残します。法務ページは確認されるまで印が付いたままです。
- **キーがなくても動きます。** キーがなければプレビューモードで作ります。任意のキーを入れると、実写の写真、確認済みの法務ページ、プレビューリンクが加わります。
- **10 種類のサイト。** ブランド、地域のお店、オンラインショップ、商品詳細、イベントやウェイティングリストのページ、ポートフォリオ、公共機関、SaaS、モバイルアプリ（PWA）、管理ダッシュボードを、韓国語か英語で作ります。
- **動きと 3D。** ヒーローは動かせます。3D オブジェクトのヒーローは画像一枚から始まります（画像 → 3D モデル）。道具がなければ 2.5D 画像に、その次はポスターに切り替わります。
- **必要になればバックエンドも。** 同じリポジトリの launch-factory キットが、会員登録、決済、メール、分析を加えます。

## しくみ

1. **質問する。** `/sitebrew:new` が名前、対象、連絡先、雰囲気を聞きます。わからないことは飛ばせます。
2. **つくる。** 工場が検証済みの部品（ブロック、スタイル軸、レシピ、原型）を組み合わせて候補を三つ作ります。候補ごとに、レイアウト・アクセシビリティ・文章の品質ゲートを通します。
3. **選ぶ。** ボードが候補三つを並べて見せ、その中から一つを選びます。
4. **直す。** `/sitebrew:revise` で、セクション一つ、色、書体、動き、文章一つを変えます。
5. **受け取る。** `/sitebrew:deliver` が選んだサイトを自分のフォルダーへ移し、公開前に埋めるものの一覧を添えます。

## インストール

### 必要なもの

| 項目 | バージョン | 必須 | Windows でのインストール |
|---|---|---|---|
| Claude Code または Codex | 最新 | どちらか一つ | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | はい | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | はい | Node と一緒に入ります |
| Git | 最新 | はい | `winget install Git.Git` |
| Chrome | 最新 | いいえ | `winget install Google.Chrome` |

下のどのインストール方法も、足りないものを見つけて知らせます。何かをインストールする前に必ず確認します。PowerShell は管理者ではなく、ふつうのユーザーとして開いてください。

### 五つの方法から一つを選ぶ

| 方法 | こんなとき |
|---|---|
| 1. npm | Node がすでにある |
| 2. npx | Node がすでにあり、npx を使いたい |
| 3. PowerShell | Node と Git の確認も一緒に済む一行がほしい |
| 4. プラグイン | Claude Code か Codex にプラグインだけを加えたい |
| 5. AI エージェント | Claude Code か Codex に代わりにインストールしてほしい |

五つとも行き着く先は同じです。`sitebrew` フォルダーに Sitebrew が入り、エージェントにプラグインが入ります。

#### 1. npm

```powershell
npm create sitebrew@0.2.5 sitebrew
```

#### 2. npx

```powershell
npx create-sitebrew@0.2.5 sitebrew
```

どちらも同じオプションを使えます。`--dry-run` は何も変えずに計画だけを表示し、`--yes` はすべての質問に「はい」と答え、`--tool` は `claude`、`codex`、`both` から選びます。

#### 3. PowerShell

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.5/get.ps1 | iex
```

何もインストールせずに、することだけを見るには:

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.5/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

#### 4. プラグイン

Claude Code で:

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.2.5
/plugin install sitebrew@sitebrew
```

Codex で:

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.2.5
codex plugin add sitebrew@sitebrew
```

#### 5. AI エージェント

下の文を Claude Code か Codex に貼り付けてください。エージェントは、エージェント向けに書いた手順書 [AGENT_INSTALL.md](AGENT_INSTALL.md) に従ってインストールします。

```text
Install Sitebrew for me. Read https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/main/AGENT_INSTALL.md and follow it step by step. Ask me before you install any program, and ask me which agent to use. At the end, show me the last lines of the installer output.
```

インストールが途中で止まったときの終了コードと対処は [AGENT_INSTALL.md](AGENT_INSTALL.md) にあります。

## 最初のサイトをつくる

空のフォルダーで Claude Code を開いて、次を実行します。

```text
/sitebrew:doctor
/sitebrew:new
```

`/sitebrew:doctor` は足りないものを、直し方の一行と一緒に示します。Codex では「sitebrew new スキルでサイトを作って」と言ってください。任意のキーとスキルの一覧は[プラグインの案内](plugins/sitebrew/README.md)にあります。

## 開発者向け

リポジトリは三つの部分でできています。ルートのサイト工場（web-factory）、`launch-factory/` のバックエンドキット、`plugins/sitebrew/` のプラグインです。

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

マージ前のチェックは `npm run ci:verify` です。エージェント向けの案内は [docs/agents/agent-guide.md](docs/agents/agent-guide.md)、ローンチキットの説明は [launch-factory/README.md](launch-factory/README.md) にあります。

部品だけを別の Next.js プロジェクトに入れることもできます。アドレスには必ずタグを付けてください。

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-default#v0.2.5 -y -o
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-base#v0.2.5 -y -o
```

## コントリビュート

コントリビュートを歓迎します。バグ報告、アイデア、新しいレシピやブロック、翻訳、どれもうれしいです。まず [CONTRIBUTING.md](CONTRIBUTING.md) を読んでください。短い文書です。

## ライセンス

MIT。[LICENSE](LICENSE) と [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を見てください。

## リリース履歴

| タグ | 日付 | 変更点 | 記録 |
|---|---|---|---|
| `v0.2.5` | 2026-10-30 | パッチ版：管理画面の表が画面の言語とタイムゾーンに従う（`data-table` ブロックの日付・数値・並べ替え・絞り込み候補） · ローンチキットのテンプレートの複製も合わせて更新 · 依存パッケージのセキュリティ更新（@hono/node-server 2.1.3、systeminformation 5.33.16） · それ以外のキットとプラグインのスキルは変更なし · web-factory v0.0.16 + launch-factory v0.2.2（内部バージョン） | — |
| `v0.2.4` | 2026-10-26 | パッチ版：依存パッケージの更新のみ · react と react-dom 19.3.1 · @base-ui/react 1.9.0 · @tabler/icons-react 3.49.0 · react-resizable-panels 4.14.6 · drizzle-orm 0.45.4 · posthog-js 1.438.12 と posthog-node 5.55.2 · resend 6.32.1 · react-day-picker 10.0.2 · キットとプラグインのスキルは変更なし · web-factory v0.0.16 + launch-factory v0.2.2（内部バージョン） | — |
| `v0.2.3` | 2026-10-26 | パッチ版：プラグインの 8 つのスキルを見直し、分岐の案内と終了コードの表を明確に · ルールごとに置き場所を 1 つに · セットアップに Node.js がない場合の手順を追加 · インストールガイドに正確なリリースタグの確認と Windows で安全な npm の使い方 · キットが読む場所に合わせたブラウザ確認 · new の引き継ぎをより安全に · deliver のスキップ理由を追加 · web-factory v0.0.16 + launch-factory v0.2.2（内部バージョン）| — |
| `v0.2.2` | 2026-10-25 | スキル監査の反映：doctor スキルが自分でインストールせずセットアップスキルに引き継ぐ · deliver が Vercel のプレビューリンクと一時公開アドレスを区別する · revise に終了コードの表を一つ追加、runbook は章ファイルを章ごとに読む、new はビルド時間を 1 回の測定として表示 · プラグインガイドにセットアップとランブックのスキルを追加 · QA ページから実在の人名を削除 · web-factory v0.0.16 + launch-factory v0.2.2（内部バージョン） | — |
| `v0.2.1` | 2026-10-25 | パッチ版：shadcn 4.22.1 を1か所で厳密に固定（入れ子の zod 公告を解消）· 広告用ページは既定で noindex · 商品一覧に ItemList、イベントのランディングに Event の構造化データ · 共有画像にブランドロゴ · イベント用ブリーフが日時と場所を質問 · レシピ追加の検査がガイド文書どおりに進む · web-factory v0.0.16 + launch-factory v0.2.2（内部バージョン）| — |
| `v0.2.0` | 2026-10-24 | キーなしで mock モードで動くバックエンドモジュール（ショップと韓国決済、予約、通知とプッシュ、レビュー、検索、ストレージ、ニュースレター、自分の依頼、管理画面） · Cloudflare の一時トンネルで作る共有用プレビューリンク · サイトを使うと決めたあとに表示されるオーナー向けガイドとランブック · チャットボットかエージェントかを判別するスキルと、足りないものを入れる新しいセットアップスキル · web-factory v0.0.14 + launch-factory v0.2.0（内部バージョン） | — |
| `v0.1.2` | 2026-10-16 | プラグインディレクトリ審査への対応：doctor がクローンのアドレスを compat.json から読む、プラグイン README にネットワーク呼び出しの表、リリース手順に GitHub リリースの手順を追加、launch キットの lucide-react 1.53.0 | — |
| `v0.1.1` | 2026-10-15 | Claude プラグインディレクトリへの登録準備：改行ルールが `plugins/sitebrew` に及ばないように修正、プラグインアイコン、わかりやすくなった doctor の案内、5 つのインストール方法、AGENT_INSTALL.md と CONTRIBUTING.md | — |
| `v0.1.0` | 2026-10-15 | 最初の公開リリース · web-factory v0.0.13 + launch-factory v0.1.2（内部バージョン） | — |
