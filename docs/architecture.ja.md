# アーキテクチャ

## 1. ワークスペース構成

```txt
apps/
  web/
  admin/

examples/
  order-billing/
    domains/
    src/

domains/
  [<group>/...]
    <domain>/
      domain.json
      client/
      server/
      shared/
      mcp/
      tests/

packages/
  runtime/
  ui/
  infra/
  config/
  tooling/

crates/
  core/
  parser/
  rules/
  cli/
```

`apps/` にはリポジトリが所有する、デプロイ可能な製品エントリーポイントを配置します。`examples/` には独立した学習用およびフレームワーク検証用プロジェクトを配置します。各サンプルは独自の Boundra 設定、TypeScript 設定、ドメインを保持する必要があります。これにより、フレームワークリポジトリ自体をアプリケーションとして扱わず、明示的な `--root` でチェックできます。

ドメインマニフェストは `paths.domains` の配下から再帰的に検出されます。任意のグループディレクトリはファイルシステムの整理に使用されますが、ドメインの識別子には含まれません。マニフェストの `name` が安定した識別子となります。ADR 0011 を参照してください。

## 2. ドメインのレイヤー

- `client/`: UI、フック、ブラウザー側のオーケストレーション
- `server/`: API ハンドラー、ビジネスルール、データのオーケストレーション
- `shared/`: スキーマ、DTO、契約、純粋なユーティリティ
- `mcp/`: AI アダプターレイヤー（tool/resource/prompt）
- `tests/`: ドメインテスト（unit/integration）

## 3. 依存関係の方向

許可：
- `client -> shared`
- `server -> shared`
- `domain -> other-domain public API`
- `domain -> declared dependency public API`

禁止：
- `client -> server`
- `server -> client`
- `shared -> policy-denied capability`（デフォルトは `ui`、`database`、`runtime`）
- `domain -> other-domain internal path`
- `domain -> undeclared domain public API`
- 循環するドメイン依存グラフ

## 4. ランタイムとツール

- ユーザーレベル：TypeScript
- コアエンジン：Rust
- ブリッジ：NAPI-RS（将来の候補）
- ビルド・分析：まず Rust アナライザー CLI、TypeScript ビルド連携は後から追加
- モノレポ：pnpm（初期）、Nx は任意の導入
- フレームワークの公開範囲：`docs/framework-surface.md` に従います。

## 5. コアクレートの責務

- `core`: プロジェクト設定、ドメインマニフェスト、共有の診断・ドメイン型
- `parser`: ワークスペースのファイル走査と import の抽出
- `rules`: 境界検証
- `cli`: コマンド解析、実行、グラフ出力、コード生成

## 6. パッケージの責務

- `packages/runtime`: 生成された契約で使用する純粋な TypeScript ヘルパー型
- `packages/ui`: 正規化された Boundra 診断をフレームワークに依存せずブラウザーに表示する機能。単一の npm サブパス `boundra/ui` で公開
- `packages/config`: 現在対応する Boundra プロジェクト設定の TypeScript 作成用型。`boundra/config` で公開しますが、ネイティブ設定の検出対象は引き続き `boundra.config.json` です。

## 7. 拡張戦略

MCP は v3 以降に `domains/<domain>/mcp` で拡張し、コアロジックから分離します。

拡張 DSL は実際に自ら利用した後に検討します。コア拡張では Lua より Starlark を優先候補とします。
