# HTTP 传输

`createHttpTransport` 将 `BoundraClient` 连接到由框架管理的 HTTP 端点，不规定路由器或服务端框架。

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

对于契约 `get-order`，传输会发送：

```http
POST /api/boundra/contracts/get-order
content-type: application/json

{"kind":"query","name":"get-order","input":{"orderId":"order-001"}}
```

端点返回 `{ "result": ... }`。HTTP、网络和无效 JSON 的失败会由客户端包装为 `RUNTIME-003`。

## 结构化 HTTP 错误

非 2xx 响应使用 `BoundraHttpError`。错误保留状态码、状态文本、选定的响应头、安全限制大小的响应体以及响应体是否被截断。JSON 内容类型会解析为 JSON；其他内容及无效 JSON 响应体仍保留为文本。响应体绝不会包含在错误消息中。

仅暴露以下不区分大小写的响应头：

- `content-type`
- `retry-after`
- `etag`
- `x-request-id`
- `x-correlation-id`

Cookie、身份认证及其他响应头不会被复制到错误中，即使底层 fetch 实现公开了这些响应头。

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

`maxErrorBodyBytes` 控制捕获的响应体上限，默认为 64 KiB。将其设置为 `0` 可丢弃错误响应体，同时保留状态码和响应头。应用必须将服务端提供的响应体字段视为不可信，仅显示 API 契约标记为安全的消息。

## 自定义传输

`BoundraCallOptions` 也会作为第二个参数传给自定义传输。因此应用可以将 multipart 编码、端点选择以及特定框架的错误响应体保留在领域适配器中，同时接收相同的每次调用取消信号：

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

当传入的信号已取消时，Boundra 会重新抛出传输的原始取消错误。主动取消不会作为 `RUNTIME-003` 报告。
