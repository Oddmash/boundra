# フレームワークの公開インターフェース

## 1. 目的

Boundra は境界チェッカーだけにとどまるべきではありません。次のレイヤーは小規模な TypeScript 向けフレームワークの公開インターフェースです。Next.js、バンドラー、ORM、UI フレームワーク、テストランナーを置き換えることなく、実際のアプリケーションで Boundra が生成した契約を使用できるようにします。

この文書は次の段階に向けた言語の役割分担を定義します。

## 2. 言語の責務

### Rust エンジン

Rust は引き続き決定論的なツール処理を担当します。

- プロジェクトとドメインマニフェストの読み込み
- import 走査と境界分析
- ルール診断
- 依存グラフの生成
- CLI オーケストレーション
- コード生成時のファイル書き込み

Rust は厳格で高速、そして予測可能なものに保つべきです。

### TypeScript の公開インターフェース

TypeScript はアプリケーション向け API を所有するべきです。

- 生成された契約型
- route/query/mutation アダプター
- クライアント・サーバーのヘルパー関数
- アプリ向けフレームワーク連携ヘルパー
- フレームワークに依存しない開発者向け診断の表示
- 開発者向けパッケージエントリーポイント

アプリケーションコードが直接 import するものは、TypeScript レイヤーが適しています。

### 拡張 DSL

拡張 DSL は将来導入する可能性がありますが、実際に自ら使用する前に導入するべきではありません。

推奨する順序：

1. TypeScript フレームワークの公開インターフェース
2. スキーマに裏付けられたコード生成テンプレート
3. 自ら利用したプロジェクトのフィードバック
4. Starlark のポリシー・コード生成フック
5. 任意の Lua ローカル自動化フック

## 3. Starlark と Lua の選択

Boundra のコアの拡張性には Lua より Starlark を優先するべきです。

理由：

- Starlark は決定論的でポリシー指向です。
- 無制限のスクリプティングよりもルール・設定・コード生成のカスタマイズに適しています。
- Boundra の「自由より安全な制約を優先する」という原則に沿っています。
- プロジェクトポリシーが早い段階で任意のローカルスクリプトになることを防ぎます。

Lua は将来ローカル自動化や AI/MCP スクリプティングに使用する選択肢として残りますが、コアポリシーには使用しません。

## 4. 最初の TypeScript パッケージ

最初の TypeScript 向けパッケージは意図的に小規模にするべきです。

候補パッケージ：

```txt
packages/
  runtime/
    src/
      types.ts
      index.ts
```

初期の責務：

- 生成された契約のスキーマに裏付けられたヘルパー型を公開する
- route/query/mutation の契約と実装の構造を定義する
- 契約の入力値と結果値を検証する
- フレームワークに依存しないクライアント・トランスポート境界を提供する
- フレームワーク固有のランタイム挙動を避ける
- React、Next.js、データベースクライアント、サーバーランタイムへの依存を避ける

ブラウザーエラービューも同じルールに従います。`packages/ui` が DOM への表示を所有し、Vite とホストアプリケーションがエラーの取得とライフサイクル連携を所有します。2つ目の npm パッケージではなく、`boundra/ui` として配布します。

非目標：

- HTTP サーバーなし
- ルーターの置き換えなし
- 組み込み fetch トランスポートはまだなし
- React フックのランタイムはまだなし
- ORM 連携なし

## 5. 生成コードの方向性

生成ファイルはランタイムに裏付けられたスキーマ構造を使用します。

方向性の例：

```ts
import { defineRoute, type InferSchema } from "boundra";
import { z } from "zod";

export const createInvoiceInputSchema = z.object({});
export const createInvoiceResultSchema = z.object({});

export type CreateInvoiceInput = InferSchema<typeof createInvoiceInputSchema>;
export type CreateInvoiceResult = InferSchema<typeof createInvoiceResultSchema>;

export const createInvoiceRoute = defineRoute({
  name: "create-invoice",
  input: createInvoiceInputSchema,
  result: createInvoiceResultSchema,
});
```

Zod でスキーマを作成し、ランタイムは構造的な `parse` 契約のみに依存します。`docs/contract-schema-spec.md` と ADR 0002 を参照してください。

## 6. 自ら利用するルール

Boundra が少なくとも1つの実際の社内プロジェクトフローで使用されるまで、Starlark、Lua、WASM のプラグインランタイムを追加しないでください。

最初の検証目標は達成済みです。

- 少なくとも2つのドメインを作成する
- 少なくとも1つずつ route、query、mutation を生成する
- 生成された契約をアプリパッケージまたはアプリフォルダーに接続する
- 通常の開発中に `check-boundaries` と `graph-domains` を実行する
- 拡張スクリプトを追加する前に不足している API を記録する

コミット済みの `examples/order-billing` フローは現在これらを網羅し、`pnpm verify-example` によって検証されています。このフローにより、プレースホルダーの契約型、手動の依存宣言、公開 export 生成の不足が次の設計課題として明らかになりました。

これらの課題は ADR 0002、スキーマに裏付けられた生成契約、フレームワークに依存しないクライアント・サーバーランタイム、`add-dependency`、生成された共有の公開 export によって解決されました。

## 7. 最初の実装単位

ステータス：完了。

最初の実装単位は次のとおりです。

1. `packages/runtime` を追加
2. 純粋な TypeScript ヘルパー型を定義
3. 生成される route/query/mutation テンプレートを更新し、これらのヘルパー型を import
4. 生成ファイルがランタイムの公開インターフェースを使用することを検証する小規模なフィクスチャテストを追加

プラグイン用言語を時期尚早に追加することなく、次の段階を実践的なものに保ちます。
