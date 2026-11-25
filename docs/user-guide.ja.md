# Boundra ユーザーガイド

[English](user-guide.md) · [한국어](user-guide.ko.md) · [简体中文](user-guide.zh-cn.md)

Boundra は Rust によるソースアーキテクチャのチェッカーと、フレームワークに依存しない TypeScript の契約ランタイムを組み合わせたツールです。このガイドは公開版 v0.6.0 の挙動を対象としています。新たなフレームワーク、ホスティングサービス、自動 API サーバーを前提とするものではありません。

## 1. インストール

Node.js 20 以上と互換性のあるパッケージマネージャーを使用してください。既存の TypeScript プロジェクトで次を実行します。

```sh
pnpm add boundra zod
pnpm exec boundra --version
```

npm の場合は `npm install boundra zod` と `npx boundra --version` を使用します。CLI ランチャーは初回実行時に対応するリリースバイナリをダウンロードし、チェックサムを検証します。公開されている対象プラットフォームは Linux x64、macOS Intel/Apple Silicon、Windows x64 です。オフラインビルドではバイナリをあらかじめ用意し、`BOUNDRA_CLI_PATH` にそのパスを設定してください。[CLI のインストール](cli-install.md) を参照してください。

## 2. 小さな範囲から導入

変更のないクリーンな作業ツリーから始め、既存の型チェック、テスト、フレームワークのビルドを維持してください。プロジェクトルートから実行します。

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

`init` は既存ディレクトリを保持し、既存の設定ファイルがある場合は実行を拒否します。`create-domain` はレイヤーディレクトリ、公開エントリーポイント、マニフェストの雛形を作成します。グループディレクトリによってマニフェストの名前が変わることはありません。生成後のファイルはアプリケーション側で自由に編集できます。生成コマンドの再実行は更新操作ではありません。

意図する依存関係は billing → order です。order から billing への逆向きの依存関係を持たせてはいけません。グラフは宣言された依存関係を表し、すべてのランタイム呼び出しを表すわけではありません。

| ディレクトリ | 責務 |
| --- | --- |
| apps/ | アプリのエントリーポイントと構成 |
| domains/order/client/ | クライアントのクエリ、ミューテーション、UI オーケストレーション |
| domains/order/server/ | サーバーハンドラーとビジネスロジック |
| domains/order/shared/ | 純粋な契約とスキーマ |
| domains/commerce/billing/ | 独自のマニフェストを持つネストされたドメイン |
| packages/ | 再利用可能なワークスペースパッケージ |

## 3. 境界を守る

CLI は初期の雛形作成を担当します。各ドメインのマニフェストは `name` と公開 API の相対パス、`dependsOn` を宣言します。billing の場合、`dependsOn: ["order"]` が許可された関係です。ドメイン間の import でも公開エントリーポイントを通す必要があり、レイヤーの境界を守らなければなりません。インターフェースを越えて内部実装にアクセスするのではなく、`shared/public`、`client/public`、`server/public` からの import を優先してください。

| ルール | 報告されたときに変更する内容 |
| --- | --- |
| BR-001 | スキーマ・型を shared に移動し、アダプター経由でサーバーの処理を呼び出す |
| BR-002 | 純粋なロジックをクライアントコードから切り出す |
| BR-003 | shared からランタイム・UI・データベースへの依存を取り除く |
| BR-004 | 対象ドメインで宣言された公開 API を使用する |
| BR-005 | アプリケーションでは宣言されたドメインエントリーポイントを使用する |
| BR-006 | 意図的な依存関係を宣言するか、結合を取り除く |

文書化されたマニフェストフィールドだけが強制されます。メタデータやポリシーのプレースホルダーは認可制御ではありません。[マニフェスト仕様](domain-manifest-spec.md) と [境界ルール](boundary-rules.md) を参照してください。

## 4. 契約と動作

生成された `domains/order/shared/contracts/get-order.ts` を編集します。

```ts
import { defineQuery, type InferSchema } from "boundra";
import { z } from "zod";

export const getOrderInputSchema = z.object({
  orderId: z.string().min(1),
});

export const getOrderResultSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["pending", "submitted"]),
});

export type GetOrderQueryInput = InferSchema<typeof getOrderInputSchema>;
export type GetOrderQueryResult = InferSchema<typeof getOrderResultSchema>;

export const getOrderQuery = defineQuery({
  name: "get-order",
  input: getOrderInputSchema,
  result: getOrderResultSchema,
});
```

生成されたクエリアダプターは `client.query(getOrderQuery, input)` を呼び出し、クライアントの公開エントリーポイントから export されます。ネットワークやバックエンドなしで挙動を試すには、プロジェクト内の TypeScript ランナーとローカルの型付きトランスポートを使用します。

```ts
import { createBoundraClient, type BoundraTransport } from "boundra";
import { getOrder } from "./domains/order/client/public";

const transport: BoundraTransport = async (request) => {
  if (request.name !== "get-order") throw new Error("Unknown contract");
  const input = request.input as { orderId: string };
  return { orderId: input.orderId, status: "pending" };
};

const client = createBoundraClient(transport);
const order = await getOrder(client, { orderId: "order-001" });
console.log(order);
```

空の注文 ID はトランスポートを呼び出す前に RUNTIME-001 で拒否されるはずです。不正な結果は RUNTIME-002 で拒否されるはずです。コミット済みの [order-billing サンプル](../examples/order-billing) ではクエリ、ミューテーション、ルートを組み合わせて動作させます。Boundra のリポジトリでは、ワークスペースの依存関係と Rust をインストールした後に `pnpm verify-example` を実行します。

<span id="5-http-とフレームワーク"></span>

## 5. 実際のバックエンドに接続

ホストが対応する API を提供する場合は `createHttpTransport({ baseUrl: "/api/boundra" })` を使用します。デフォルトのトランスポートは `/api/boundra/contracts/<name>` に kind、name、input を含む POST リクエストを送信します。サーバーは `{ "result": ... }` を返します。ルーティング、利用者の識別、認可、永続化、安全なエラーレスポンスはホストの責任です。Boundra は契約を検証します。サーバーが所有する処理には、生成されたルート契約と `implementRoute` を使用し、ホストのアダプター内で `executeContract` を実行します。[HTTP トランスポート](http-transport.md) と [契約スキーマ](contract-schema-spec.md) を参照してください。

クエリとミューテーションは呼び出しごとの中断シグナルを受け取れます。2xx 以外のレスポンスやトランスポートエラーは、意図的なキャンセルを除いて RUNTIME-003 として公開されます。生のレスポンスボディをそのまま表示しないようにしてください。

## 6. アナライザーとフレームワークを設定

`boundra.config.json` はプロジェクトルートに置いてください。`paths.apps`、`paths.domains`、`paths.packages` を実際の構成に合わせて設定します。CLI はルートの TypeScript パスと相対パスの extends、およびルートの package imports の単純な文字列を読み込みます。条件付き imports やパッケージベースの tsconfig extends は解決されません。境界スキャンが成功しても、バンドラーの出力にエイリアスのターゲットが含まれていることを証明するものではありません。

- Vite：既存の Vite プラグインに `boundra/vite` の `boundra()` を追加します。開発用オーバーレイはランタイムと境界の診断を報告します。[Vite 連携](vite-integration.md)。
- Next.js：App Router とそのサーバー・クライアントルールを維持します。必要に応じて `boundra/ui` を使用し、開発環境専用の Client Component から正規化したエラーを明示的に報告します。自動的に適用される Next.js プラグインはありません。[エラービュー](error-view.md)。
- その他のホスト：CLI を独立して使用するか、互換性のあるトランスポートを実装します。

拡張子、無視パターン、shared の capability 分類をカスタマイズする前に、[設定](config-spec.md) をお読みください。

<span id="6-ci-とトラブルシューティング"></span>

## 7. CI とレビュー

PR ではコンパイラー、テスト、フレームワークのビルドに加えて `pnpm exec boundra check-boundaries --root . --format json` を実行します。終了コードは 0 が正常、1 が違反、2 が使用方法や設定の不正、3 が内部・I/O エラーです。JSON の `meta.scanned_file_count` と `meta.analyzed_domain_count` を確認してください。空のスキャンも警告付きで成功する場合があるため、成熟したワークスペースでは期待する最小カバレッジを別途要求してください。

```sh
pnpm exec boundra check-boundaries --format json > boundra-report.json
node --input-type=module -e 'import fs from "node:fs"; const r = JSON.parse(fs.readFileSync("boundra-report.json", "utf8")); if (r.status !== "passed" || !Number.isInteger(r.meta?.scanned_file_count) || r.meta.scanned_file_count < 1 || !Number.isInteger(r.meta?.analyzed_domain_count) || r.meta.analyzed_domain_count < 2) process.exit(1)'
```

期待するドメイン数は導入対象の範囲に合わせて調整してください。内部パスが含まれる場合、レポートをバージョン管理の対象から外してください。

## 8. トラブルシューティング

| 症状 | 次の対応 |
| --- | --- |
| CLI が見つからない、またはプラットフォームが未対応 | Node と対象プラットフォームを確認し、対応するネイティブアーカイブまたは管理されたバイナリパスを使用 |
| 再初期化できない | 既存の設定を確認し、単に init を再実行する目的で削除しない |
| 不明なドメイン | 設定されたドメインルート、マニフェストファイル名、論理名を確認 |
| スキャン結果が予期せず正常 | カバレッジカウンター、パス、無視されたファイル、対応するリゾルバーへの入力を確認 |
| 生成ファイルが存在する | 既存のアプリケーション所有コードを編集するか、別の契約名を選択 |
| HTTP 呼び出しが失敗する | ホストのエンドポイント、レスポンスのエンベロープ、トランスポートの処理を確認 |
| Next.js でオーバーレイが表示されない | 明示的なホスト連携を使用する。Vite プラグインは Next.js で実行されない |

<span id="7-導入判断"></span>

## 9. 導入判断

既存ツールと比較して導入コストと代表的な失敗を測定してください。リポジトリ全体を移行する前に1つのドメインから始めます。代替ツール、制約、エビデンスに基づく合格基準については [製品の位置づけ](product-positioning.md) をお読みください。Boundra は開発時のアーキテクチャを守るための仕組みであり、ランタイムの分離やプロダクション環境のセキュリティ制御ではありません。
