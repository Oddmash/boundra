# CI 連携

## アプリケーションに Boundra を追加する

プロジェクトのパッケージマネージャーで `boundra` と `zod` をインストールし、プロジェクトを初期化して設定とドメインマニフェストをコミットします。既存の型チェック、テスト、ビルドと一緒に境界チェックを実行してください。公開 CLI を使用する pnpm アプリケーションの最小 GitHub Actions サンプルを示します。

```yaml
name: Check boundaries

on:
  pull_request:
  push:
    branches: [main]

jobs:
  boundaries:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec boundra check-boundaries --root . --format json
```

npm プロジェクトでは最後の2つのコマンドを `npm ci` と `npx boundra check-boundaries --root . --format json` に置き換えてください。ネイティブランチャーは初回使用時に対応するリリース済み CLI を取得します。オフラインや未対応プラットフォームの要件については [インストール](cli-install.md) を参照してください。公開版 v0.6.0 では空のスキャンも警告付きで成功することがあります。JSON のカバレッジ数を確認し、プロジェクトでドメインの最小数が必要なら [ユーザーガイド](user-guide.md) のカバレッジチェックを使用してください。

## Boundra リポジトリの検証

コミット済みのサンプルフローを必須 CI ゲートとして使用してください。TypeScript の公開インターフェースを型チェックし、ランタイムとサンプルフローを実行し、Rust テストを行い、境界を検査し、ドメイングラフをレンダリングします。

```yaml
name: Boundra

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  verify-example:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - uses: dtolnay/rust-toolchain@stable
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify-example
      - run: pnpm verify-clean-room
      - run: cargo clippy --workspace --all-targets -- -D warnings
```

## ローカル検証

同じ集約ゲートをローカルで実行します。

```bash
pnpm verify-example
```

個別の境界コマンドは、Boundra のアナライザーのみを導入するリポジトリでも利用できます。未リリース CLI では、成熟したワークスペースが想定する走査ドメインの最小数を要求できるため、誤設定された空のスキャンが黙って成功することを防げます。

```bash
boundra check-boundaries --format json --min-domains 2
```

導入対象の範囲で期待される数にしきい値を設定してください。オプションを指定しない場合、CLI は既存の警告だけを出す空スキャンの挙動を保持します。

## 終了コード

- `0`: 境界違反なし
- `1`: 境界違反を検出
- `2`: 設定、マニフェスト、CLI の使用方法のエラー
- `3`: ランタイムスキャンまたはファイルシステムのエラー

## JSON 出力

CI およびエージェント連携では JSON 出力を優先してください。

```bash
cargo run -p boundra-cli -- check-boundaries --root examples/order-billing --format json
```

例：

```json
{
  "status": "failed",
  "violations": [
    {
      "rule": "BR-001",
      "file": "domains/order/client/use-order.ts",
      "line": 3,
      "import": "../server/order-service",
      "message": "client layer cannot import server layer",
      "suggestion": "move shared contract to shared layer or call through an API boundary"
    }
  ],
  "meta": {
    "command": "check-boundaries",
    "violation_count": 1
  }
}
```
