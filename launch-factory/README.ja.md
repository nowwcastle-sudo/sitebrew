[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# launch-factory

web-factory(画面ブロックのリポジトリ)と対になるリリースキットです。認証・データ・決済・メール・計測・ジョブといったバックエンド側を、このリポジトリが担います。プロダクトは `template/` を複製して始め、`@launch-factory/*` パッケージのバージョンだけを上げてセキュリティパッチを受け取ります。

現在のバージョン `v0.2.5` · web-factory 固定 `v0.2.5` · ブロック `19c81efc` · contract `19c81efc`（タグ v0.2.5 のコミット）

- ブロックはプロバイダーを知らず、アダプターが web-factory のポートを実装します。同じ適合性スイートで、アダプターが mock と同じシナリオを再現するかを検査します。
- 機能バンドル(アダプター・サーバーアクション・Webhook ルート・スキーマ・マイグレーション)は、`registry.json` のエントリ1つにまとめられています。バージョンを固定した内訳は [`docs/versions.md`](docs/versions.md) にあります。
- 契約の正本は web-factory の `registry/factory/contract/` です。

## 必要環境

`npm run setup` が以下をすべて点検し、不足しているものと、この OS 向けのインストールコマンドを知らせます。システムソフトウェアはインストールしません。

| 項目 | バージョン | 必須 | Windows | macOS | Linux |
|---|---|---|---|---|---|
| Node | >=24.13.0 | 必須 | `winget install OpenJS.NodeJS.LTS --version 24.13.0` | `nvm install 24.13.0` | `nvm install 24.13.0` |
| npm | >=11.6.2 | 必須 | Node と一緒にインストールされます | Node と一緒にインストールされます | Node と一緒にインストールされます |
| git | 最新 | 必須 | `winget install Git.Git` | `brew install git` | `sudo apt install git` |
| web-factory のチェックアウト | タグ `v0.0.16` | 任意 | `git clone` の後、`LF_WF_REPO` にパスを設定 | `git clone` の後、`LF_WF_REPO` にパスを設定 | `git clone` の後、`LF_WF_REPO` にパスを設定 |
| Chrome | 最新 | 任意 | `winget install Google.Chrome` | `brew install --cask google-chrome` | `sudo apt install chromium` |
| gh | 最新 | 任意 | `winget install GitHub.cli` | `brew install gh` | `sudo apt install gh` |
| vercel | 最新 | 任意 | `npm i -g vercel` | `npm i -g vercel` | `npm i -g vercel` |
| gitleaks | CI 固定 8.30.1 | 任意 | `winget install Gitleaks.Gitleaks` | `brew install gitleaks` | [リリースファイル](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) |
| actionlint | CI 固定 1.7.12 | 任意 | `winget install rhysd.actionlint` | `brew install actionlint` | [リリースファイル](https://github.com/rhysd/actionlint/releases/tag/v1.7.12) |
| zizmor | CI 固定 1.30.1 | 任意 | `winget install zizmor.zizmor` | `brew install zizmor` | `pipx install zizmor` |
| osv-scanner | CI 固定 2.6.0 | 任意 | `winget install Google.OSVScanner` | `brew install osv-scanner` | [リリースファイル](https://github.com/google/osv-scanner/releases/tag/v2.6.0) |

任意の項目が入っていない場合は、次のようになります。

- web-factory のチェックアウト: ない場合、適合性テストは SKIP と表示されます。ある場合は `LF_WF_REPO` が指す場所を読むので、そこに `v0.0.16` のコミットが必要です。環境変数がなければコード内の既定パスを使うため、別の PC では必ず `LF_WF_REPO` を指定してください。
- Chrome: `npm run template:screens` が動きません。インストール先が既定のパスでない場合は、`CHROME_PATH` に実行ファイルのパスを入れます。
- セキュリティツール4つ: `npm run ci:verify` が該当ステップを SKIP と表示します。CI は `scripts/ci/tools.json` の固定バージョンを取得して使います。ローカルでも、ない場合を失敗として数えるには `LF_CI_REQUIRE_TOOLS=1` を指定します。
- gitleaks: コミット前のシークレット検査フックは、案内を出すだけで通過します。
- gh: 非公開リポジトリの clone・push と、GitHub へのログイン(`gh auth login`)に使います。
- vercel: プレビューデプロイと `npm run env:check -- --vercel` に必要です。

そのほかの基準は次のとおりです。

- メモリ: ビルドと画面ゲートには、空きメモリが約 3GB 必要です。足りない場合は `template:screens` が待機します(`LF_SCREENS_MIN_FREE_GB`)。
- 改行コード: `.gitattributes` が LF に固定するため、`core.autocrlf` の設定とは無関係です。
- シェル: スクリプトはすべて Node なので、PowerShell と bash で同じです。`template:screens` の `--only /pricing` のような引数は Git Bash がパスに変換してしまうため、PowerShell で指定します。
- DB: テストはメモリ上の PGlite を使うため、インストールするものはありません。live 接続は Supabase の `DATABASE_URL` です。

### 環境変数

値はリポジトリに置きません。名前の一覧は [`.env.example`](.env.example) が正本です。

| 状態 | 必要なもの |
|---|---|
| mock(既定の開発) | `LF_MODE=mock` だけです。プロバイダーのキーがなくても起動します。 |
| live | `LF_MODE=live` と、プロバイダーのキー・`DATABASE_URL`。不足している名前は `npm run env:check`(オフライン)と `npm run doctor -- --stage sandbox` が知らせます。 |
| 任意 | `INQUIRY_OWNER_EMAIL`・`POSTHOG_*`・`SENTRY_DSN`。ない場合は、その機能だけがオフになります。 |
| ショップ（任意） | `NEXT_PUBLIC_PORTONE_STORE_ID`・`NEXT_PUBLIC_PORTONE_CHANNEL_KEY`・`PORTONE_API_SECRET`・`PORTONE_WEBHOOK_SECRET`。live では 4 つすべてが必要で、1 つでもないとショップだけがオフになります。mock ではキーなしで、模擬決済の確認ステップ付きで動きます。 |
| パス | `LF_WF_REPO`(適合性テストが読む web-factory のチェックアウト) · `WF_HOME`(`template:screens` が読む web-factory のチェックアウト) · `CHROME_PATH` |

## はじめに

リポジトリが非公開の場合は、clone の前に GitHub へのログインが必要です。

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew/launch-factory
npm run setup
npm run ci:verify
```

- `npm run setup`: 環境を点検し、`.githooks` を `core.hooksPath` に設定します。`node_modules` がない、または古い場合は `npm ci` を実行します。必須のものが不足していると終了コードは 1 になり、最終行が `setup: FAIL` になります。
- `npm run ci:verify`: CI と同じ検査一式です。ステップごとに PASS・FAIL・SKIP を表で示し、FAIL が1つでもあれば終了コードは 1 です。

テンプレートを mock モードで起動します。

```bash
LF_MODE=mock npm run dev -w template
```

```powershell
$env:LF_MODE = "mock"; npm run dev -w template
```

http://localhost:3000 で確認します。

## よくある作業

| やりたいこと | コマンド |
|---|---|
| 単体テスト | `npm test` |
| 実行前の点検(キーが有効か) | `npm run doctor -- --stage dev` (`sandbox`・`preview` もあります) |
| レジストリの再生成・検査 | `npm run registry:build` · `npm run registry:check` |
| テンプレートの画面ゲート(ビルドに約4分) | `npm run template:screens` |
| README が現状と合っているか | `npm run readme:check` |

### web-factory の固定バージョンを更新する

web-factory に新しいタグ `vX.Y.Z` が出たら、次の順で更新します。

```bash
npm run contract:sync -- --from <web-factory-path> --ref vX.Y.Z
node scripts/template-sync.mjs blocks --from <web-factory-path> --ref vX.Y.Z
git diff template/package.json
```

1. `git diff template/package.json` に、sync が引き上げて書き込んだ依存が見えたら、元に戻します。
2. `scripts/lib/wf-conformance.mjs` の `WF_CONFORMANCE_COMMIT` を、新しいタグのコミットハッシュに書き換えます。
3. `docs/versions.md` の web-factory の行と、この README の「web-factory 固定」を、新しいタグに書き換えます。
4. `npm run ci:verify` が 0 で終わることを確認します。

### 新しいバージョンを出す

[`docs/RELEASING.md`](docs/RELEASING.md) の手順に従います。README の更新と `npm run readme:check -- --tag vX.Y.Z` は、タグを打つ前の必須ステップです。

## 困ったとき

| 表示される内容 | 原因 | 解決方法 |
|---|---|---|
| `setup: FAIL — 필수 누락 …` | 必須ツールがない、またはバージョンが低いです | 行ごとに付いている `→` のコマンドを実行し、`npm run setup` をもう一度実行します。 |
| `web-factory 체크아웃 없음` · `web-factory 커밋 … 을 찾지 못함` | `LF_WF_REPO` のパスが存在しないか、`v0.0.16` のコミットがありません | web-factory を clone し、`git -C <path> fetch --tags` を実行してから、`LF_WF_REPO` にそのパスを設定します。 |
| `SKIP(도구 없음)` | 任意のセキュリティツールがありません | 失敗ではありません。インストールすればステップが動きます。 |
| `[pre-commit] gitleaks 가 설치돼 있지 않아 … 건너뛴다` | フックは設定されていますが、gitleaks がありません | 「必要環境」の表にある gitleaks のコマンドを実行します。 |
| `--only /pricing` がどのページも見つけられない | Git Bash が `/pricing` をパスに変換します | PowerShell で実行します。 |

## リリース履歴

| タグ | 日付 | 内容 | 記録 |
|---|---|---|---|
| `v0.2.5` | 2026-10-30 | launch-factory v0.2.2 (internal version) · パッチ版：管理画面の表が画面の言語とタイムゾーンに従う（テンプレートのブロック複製を更新） · この README の web-factory 要求バージョンの記載を修正 · systeminformation 5.33.16 · web-factory を `v0.2.5` に固定 | — |
| `v0.2.4` | 2026-10-26 | launch-factory v0.2.2 (internal version) · パッチ版：依存パッケージの更新のみ · drizzle-orm 0.45.4 · posthog-js 1.438.12 と posthog-node 5.55.2 · resend 6.32.1 · react-day-picker 10.0.2 · 開発用の eslint 10.13.0 と typescript-eslint 8.71.2 · web-factory を `v0.2.4` に固定 | — |
| `v0.2.3` | 2026-10-25 | launch-factory v0.2.2 (internal version) · パッチ版：shadcn 4.22.1 を厳密な1つの版に固定（入れ子の zod 公告とその OSV 例外を解消）· web-factory を `v0.2.3` に固定 | — |
