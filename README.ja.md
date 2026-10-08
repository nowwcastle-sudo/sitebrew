[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

Sitebrew は、いくつかの質問に答えるとウェブサイトの候補を三つ作るツールです。三つを並べて比べ、一つを選びます。調整したあと、自分のフォルダーに受け取ります。Claude Code または Codex の中でプラグインとして使い、コードの知識はいりません。

現在のバージョン `v0.1.0`。

- 作れるサイトは 10 種類です：ブランド、地域の店舗、オンラインショップ、商品詳細、イベント・ウェイトリストのランディングページ、ポートフォリオ、公共機関、SaaS、モバイルアプリ（PWA）、管理画面。
- 韓国語のサイトと英語のサイトを作ります。地域の店舗と公共機関は韓国語のみです。
- 会員登録や決済が必要なサービスは、同じリポジトリの launch-factory キットにつなぎます。
- Windows 10・11 で作り、テストしています。

## 必要なもの

| 項目 | バージョン | 必須 | Windows でのインストール |
|---|---|---|---|
| Claude Code または Codex | 最新 | どちらか一つ | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | はい | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | はい | Node と一緒に入ります |
| Git | 最新 | はい | `winget install Git.Git` |
| Chrome | 最新 | いいえ | `winget install Google.Chrome` |

- 下のインストーラーが足りないものを見つけて知らせます。何かをインストールする前に必ず聞き、答えるまで何もインストールしません。
- Claude Code と Codex は、それぞれのサービスのアカウントでログインして使います。
- Chrome がなくても、画面チェックの一部を飛ばすだけです。サイトはそのまま作られます。
- PowerShell の開き方：スタートメニューで「PowerShell」を検索して開きます。管理者として開かないでください。管理者ウィンドウではインストーラーが止まります。

## インストール

### 一行インストール（おすすめ）

下の一行を PowerShell に貼り付けます。インストーラーは今のフォルダーの下の `sitebrew` フォルダーに Sitebrew を取得し、選んだエージェントにプラグインをインストールします。

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
```

何もインストールせずに、何をするかだけ見るには次のように実行します。

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

エージェントやフォルダーを自分で決めるには、オプションを付ける形を使います。`-Tool` は `claude`、`codex`、`both` のどれかです。`-Yes` はすべての質問に「はい」と答えます。`-WhatIf` はプレビューだけです。

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/install.ps1).TrimStart([char]0xFEFF))) -Tool claude -Folder "$HOME\sitebrew"
```

### npx でインストール

Node がすでにあれば、この方法も使えます。リポジトリを取得したあと、プラグインのインストールコマンド二行を表示し、「はい」と答えるとすぐに実行します。

```powershell
npx create-sitebrew@0.1.0 sitebrew
```

### プラグインだけインストール

Claude Code の中で：

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.1.0
/plugin install sitebrew@sitebrew
```

Codex で：

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.1.0
codex plugin add sitebrew@sitebrew
```

インストールを確かめるには `claude plugin list` を実行します。

## 最初のサイトを作る

1. サイトのファイルを置く空のフォルダーで Claude Code を開きます。
2. `/sitebrew:doctor` で足りないものを確かめます。足りない項目ごとに直し方が一行ずつ出ます。
3. `/sitebrew:new` を実行して質問に答えます。名前、対象の顧客、連絡先、雰囲気などを聞きます。わからないことは空けておいてかまいません。
4. 三つの候補を比べて一つを選びます。
5. 変えたいところがあれば、`/sitebrew:revise` で一つの区画、色・書体・動き、または一つの文言を変えます。
6. `/sitebrew:deliver` で選んだサイトを自分のフォルダーに受け取ります。一緒に届く案内ファイルに、公開前に埋めることが書いてあります。

```text
/sitebrew:doctor
/sitebrew:new
```

Codex では「sitebrew の new スキルでサイトを作って」と言います。英語のサイトが欲しいときは、最初に「英語のサイト」と言います。

## プレビューモードと空欄

キーがなくても始められます。キーがないと、サイトはプレビューモードで作られ、「公開不可」の印が付きます。理由ごとに何が足りないかが一行で出ます。

- 「要確認」：質問で空けた事実（電話番号、事業者情報など）です。作り話はせず空欄のままにします。自分で埋めます。
- 「実際の写真が必要」：店舗や製品の画面のように、本物の写真しか使えない場所です。自分の写真を入れます。
- 「法務確認が未完了」：利用規約とプライバシーポリシーの下書きが、まだ法律の条文と照らし合わされていません。

下の値はすべて任意です。プラグインを有効にするとき Claude Code が聞きます。コマンドラインでインストールした場合は聞かないので、`/plugin configure sitebrew@sitebrew` で入れます。キーの値をチャットに貼り付けないでください。

| 名前 | 入れると増えるもの |
|---|---|
| `PEXELS_API_KEY` | 空の写真の場所の代わりに本物のストック写真 |
| `LAW_API_OC` | 韓国語の法定ページを現行の法律条文と照合 |
| `VERCEL_TOKEN` | オンラインのプレビューリンク |
| `HIGGSFIELD_DIR` | 自分で作った画像と 3D モデルのフォルダー |

```text
/plugin configure sitebrew@sitebrew
```

3D オブジェクトのファーストビュー（`object-3d-orbit`）は画像から始まります。画像 → GLB（3D モデル）→ 画面に表示、の順です。ツールがなければ 2.5D の画像、次にポスターへ下がります。画像がまったくなければ、このファーストビューは選ばれません。

## ここで使う言葉

| 言葉 | 意味 |
|---|---|
| 候補 | 同じ答えから作った、サイトの案の一つ。一度に三つ |
| ボード | 候補を並べて選ぶ画面 |
| スタンプ | 答えからサイトを作る工程（`npm run stamp`） |
| プレビューモード | キーや事実が足りないまま作ったサイト。選ぶには十分だが、公開してはいけない |
| 公開不可 | 公開前に埋めるものが残っているという印。理由も一緒に出る |
| ドクター | パソコンに足りないものと直し方を教えるチェック |
| 検品台 | 部品とブロックを一つずつ表示する開発者向けの画面（`npm run dev`） |

## インストールが止まったとき

インストーラーは結果を `$LASTEXITCODE` に残します。ターミナル以外で実行すると、すべての質問に「いいえ」と答えたものとみなします。

| コード | 意味 | すること |
|---|---|---|
| 0 | 完了、またはプレビュー | 最後の行に出る次の手順に従います |
| 1 | ダウンロード・クローン・プラグインのコマンドが失敗 | インターネット接続を確かめ、同じ行をもう一度実行します |
| 2 | オプションかフォルダーが間違っている | `-Folder` のパスを確かめます。Windows や Program Files の下は使えません |
| 3 | 足りないものがあるか、答えが必要 | 画面に出たインストールコマンドを実行するか、`-Yes` を付けて実行し直します |
| 4 | 開始を拒否 | 管理者ウィンドウなら、通常の PowerShell ウィンドウで実行し直します |

`-Yes` で実行すると、Sitebrew フォルダーの場所をユーザー環境変数 `SITEBREW_DIR` に保存することにも「はい」と答えます。

## 開発者向け

リポジトリは三つの部分でできています。`factory/` と `registry/` はサイト工場（web-factory）で、`launch-factory/` は会員登録・決済・メール・分析のキットです。`plugins/sitebrew/` はプラグイン、`packages/create-sitebrew/` は npx インストーラーです。

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

- `npm run setup` は環境を点検し、必要なら依存関係をインストールします。`npm run dev` は検品台を開きます。
- マージ前のチェックは一行です：`npm run ci:verify`。
- エージェント向けの全体の案内は [docs/agents/agent-guide.md](docs/agents/agent-guide.md) です。
- レシピやブロックを追加する方法は [docs/guides/add-recipe.md](docs/guides/add-recipe.md) にあります。
- launch-factory の使い方は [launch-factory/README.md](launch-factory/README.md) にあります。
- リリース手順は [docs/RELEASING.md](docs/RELEASING.md) です。書体のライセンスは [docs/qa/font-licenses.md](docs/qa/font-licenses.md) にあります。

部品だけを別の Next.js プロジェクトにインストールすることもできます。アドレスには必ずタグを付けます。

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-default#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-base#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/alert-dialog#v0.1.0 -y -o
```

## ライセンス

MIT です。[LICENSE](LICENSE) と [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を見てください。

## リリース履歴

| タグ | 日付 | 変更点 | 記録 |
|---|---|---|---|
| `v0.1.0` | 2026-10-15 | 最初の公開リリース · web-factory v0.0.13 + launch-factory v0.1.2（内部バージョン） | — |
