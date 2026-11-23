# Boundra ユーザーガイド

[English](user-guide.md) · [한국어](user-guide.ko.md) · [简体中文](user-guide.zh-cn.md)

Boundra は Rust の静的解析 CLI と TypeScript のスキーマ契約ランタイムを組み合わせます。既存のフレームワークやサーバーを置き換えません。対象は公開版 v0.6.0 です。

## 1. インストール

Node.js 20 以上と対応するパッケージマネージャーが必要です。

```sh
pnpm add boundra zod
pnpm exec boundra --version
```

初回実行では対応するネイティブバイナリを取得し、チェックサムを検証します。Linux x64、macOS Intel/Apple Silicon、Windows x64 に対応します。オフラインでは `BOUNDRA_CLI_PATH` を設定します。[詳細](cli-install.md)。

## 2. 小さな範囲から導入

```sh
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain order
pnpm exec boundra create-domain billing --path commerce
pnpm exec boundra add-dependency billing/order
pnpm exec boundra generate query order/get-order
pnpm exec boundra generate route billing/create-invoice
pnpm exec boundra check-boundaries --format json
pnpm exec boundra graph-domains --format mermaid
```

既存ファイルは上書きしません。ドメインは個別の manifest を持ち、client は UI とアダプター、server は業務ロジック、shared は純粋な契約を担当します。billing → order は宣言された依存関係です。循環は許可されません。

## 3. 境界を守る

`domain.json` の name、publicApi、dependsOn を利用します。BR-001/002 は client/server の直接依存、BR-003 は shared の禁止 capability、BR-004/005 は内部実装への直接参照、BR-006 は未宣言のドメイン依存を検査します。公開 API を利用し、不要な結合を取り除きます。[詳細](boundary-rules.md)。

## 4. 契約と動作

生成された `domains/order/shared/contracts/get-order.ts` のスキーマを具体化します。

```ts
import { defineQuery } from "boundra";
import { z } from "zod";

export const getOrderInputSchema = z.object({ orderId: z.string().min(1) });
export const getOrderResultSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["pending", "submitted"]),
});
export const getOrderQuery = defineQuery({
  name: "get-order",
  input: getOrderInputSchema,
  result: getOrderResultSchema,
});
```

生成済みの型エクスポートは維持してください。client アダプターは `client.query` を呼び出します。入力不正は RUNTIME-001、結果不正は RUNTIME-002 になります。[実行可能なサンプル](../examples/order-billing) を使い、リポジトリで `pnpm verify-example` を実行できます。

## 5. HTTP とフレームワーク

`createHttpTransport({ baseUrl: "/api/boundra" })` は POST `/api/boundra/contracts/<name>` を使用し、サーバーは `{ "result": ... }` を返します。ルーティング、認証・認可、永続化はホストの責任です。通信エラーは RUNTIME-003、意図的な中断は元の例外を維持します。

Vite では `boundra/vite` のプラグインを使用し、Next.js では既存の App Router を維持します。必要に応じて `boundra/ui` で開発時のエラーを明示的に表示します。Next.js に Vite プラグインは自動適用されません。

[HTTP](http-transport.md) · [Vite](vite-integration.md) · [エラー表示](error-view.md) · [設定](config-spec.md)

## 6. CI とトラブルシューティング

既存の型チェック、テスト、ビルドと併用します。終了コード 0 は成功、1 は違反、2 は設定/使用エラー、3 は実行エラーです。空のスキャンでも成功する可能性があるため、JSON の scanned_file_count と analyzed_domain_count が期待する範囲を満たすか確認してください。

未知のドメインは設定ルートと manifest 名、空の結果はパス・除外設定、HTTP エラーはエンドポイントと応答形式を確認します。条件付き package imports や package-based tsconfig extends は現在解析対象外です。

## 7. 導入判断

ESLint や Nx で十分なら重複導入は不要です。Boundra はアーキテクチャ上の開発支援であり、ランタイムのセキュリティ境界ではありません。小さな範囲から評価し、既存ツールと比較してください。[比較・制約](product-positioning.md) · [詳細ガイド](user-guide.md)。
