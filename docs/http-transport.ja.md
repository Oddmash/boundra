# HTTP トランスポート

`createHttpTransport` はルーターやサーバーフレームワークを指定することなく、`BoundraClient` をフレームワークが所有する HTTP エンドポイントへ接続します。

```ts
const client = createBoundraClient(createHttpTransport({
  baseUrl: "/api/boundra",
}));

const controller = new AbortController();
const task = await client.query(
  getTask,
  { id: "task-001" },
  { signal: controller.signal },
);
```

契約 `get-order` の場合、トランスポートは次の内容を送信します。

```http
POST /api/boundra/contracts/get-order
content-type: application/json

{"kind":"query","name":"get-order","input":{"orderId":"order-001"}}
```

エンドポイントは `{ "result": ... }` を返します。HTTP、ネットワーク、不正な JSON の失敗は、クライアントによって `RUNTIME-003` としてラップされます。

## 構造化された HTTP エラー

2xx 以外のレスポンスは `BoundraHttpError` を使用します。エラーはステータス、ステータステキスト、選択されたレスポンスヘッダー、安全にサイズ制限されたレスポンスボディ、ボディが切り詰められたかどうかを保持します。JSON コンテンツタイプは JSON として parse され、その他のボディや不正な JSON はテキストのままです。ボディがエラーメッセージに含まれることはありません。

大小文字を区別せず、次のレスポンスヘッダーだけを公開します。

- `content-type`
- `retry-after`
- `etag`
- `x-request-id`
- `x-correlation-id`

基盤となる fetch の実装で取得できる場合でも、Cookie、認証、その他のレスポンスヘッダーはエラーにコピーされません。

```ts
try {
  await client.query(getTask, { id: "missing" });
} catch (error) {
  if (
    error instanceof BoundraRuntimeError
    && error.cause instanceof BoundraHttpError
    && error.cause.status === 404
  ) {
    // Render a not-found state.
  }
}
```

`maxErrorBodyBytes` は取得するボディの上限を制御し、デフォルトは 64 KiB です。`0` に設定すると、ステータスとヘッダーを保持したままエラーボディを破棄できます。アプリケーションはサーバーから提供されたボディのフィールドを信頼できないものとして扱い、API 契約で安全と明示されたメッセージだけを表示する必要があります。

## カスタムトランスポート

`BoundraCallOptions` はカスタムトランスポートの第2引数としても渡されます。これにより、アプリケーションは multipart エンコード、エンドポイント選択、フレームワーク固有のエラーボディをドメインアダプター内に保持しながら、呼び出しごとに同じキャンセルシグナルを受け取れます。

```ts
const transport: BoundraTransport = async (request, options) => {
  const input = request.input as { image: File };
  const form = new FormData();
  form.set("image", input.image);

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: form,
    signal: options?.signal,
  });
  return response.json();
};
```

渡されたシグナルが中断されている場合、Boundra はトランスポートの元のキャンセルエラーを再スローします。意図的なキャンセルは `RUNTIME-003` として報告されません。
