# 契約スキーマ仕様

## 1. 信頼できる情報源

`domains/<domain>/shared/contracts/` 内の生成済み契約ファイルは、それぞれ2つのランタイムスキーマを所有します。

- 入力スキーマ
- 結果スキーマ

TypeScript の入力・結果の型はこれらのスキーマから推論されます。別途手書きのインターフェースは生成されません。

## 2. スキーマプロバイダー

初期ジェネレーターは Zod スキーマを出力します。`boundra` は次の構造だけを要求することで、プロバイダーに依存しません。

```ts
export type BoundraSchema<Output> = {
  parse(value: unknown): Output;
};
```

別のスキーマプロバイダーも、そのスキーマが同じ parse 契約を実装していれば利用できます。プロバイダー固有の機能は Boundra ランタイム API の一部ではありません。

## 3. 契約の構造

```ts
import { defineQuery, type InferSchema } from "boundra";
import { z } from "zod";

export const getOrderInputSchema = z.object({});
export const getOrderResultSchema = z.object({});

export type GetOrderQueryInput = InferSchema<typeof getOrderInputSchema>;
export type GetOrderQueryResult = InferSchema<typeof getOrderResultSchema>;

export const getOrderQuery = defineQuery({
  name: "get-order",
  input: getOrderInputSchema,
  result: getOrderResultSchema,
});
```

生成された空のオブジェクトは安全なスキャフォールドです。機能開発でフィールドを実際のドメインスキーマへ置き換えます。生成ファイルは作成後にアプリケーションが所有し、以後上書きされることはありません。

## 4. ランタイムの挙動

- クライアントの query/mutation 呼び出しはトランスポートの前に入力を parse します。
- トランスポートの結果をアプリケーションコードへ返す前に parse します。
- クライアントの呼び出しには `AbortSignal` を渡すことができ、そのシグナルはカスタムトランスポートと HTTP トランスポートに転送されます。
- 意図的なキャンセルは `RUNTIME-003` トランスポートエラーとして報告せず、そのまま再スローします。
- サーバーのルート実行ではハンドラーの前に入力を parse し、返す前にハンドラーの結果を parse します。
- ハンドラーの欠落とスキーマの parse 失敗は型付きランタイムエラーになります。
- スキーマの parse 失敗は、プロバイダーに依存しないフィールドの問題を `BoundraRuntimeError.issues` で公開します。
- シリアル化されたランタイムエラーは元の入力と内部の `cause` を省略します。

## 5. 公開 export

生成時、`shared/public.ts` に冪等な export を追加します。

```ts
export * from "./contracts/get-order";
```

既存マニフェストとの互換性のため、直接の契約パスは `domain.json` の `publicApi.shared` に維持されます。利用側では安定した `shared/public` エントリーポイントを優先してください。

Query、mutation、resource の生成時には、対応するアダプターも `client/public.ts` に冪等に追加されます。引用符が異なる、セミコロンがない、末尾にコメントがある場合でも、同等の既存 export は重複しません。既存のアプリケーション export は保持されます。

```ts
export * from "./queries/get-order";
```

Route の生成ではクライアント export は追加されません。

## 6. 所有権

- ジェネレーターは初回ファイル作成を所有します。
- 以後のスキーマフィールドとハンドラー実装はアプリケーションコードが所有します。
- 繰り返し生成すると、アプリケーションの変更を上書きするのではなく失敗する必要があります。
