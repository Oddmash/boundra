<a id="http-transport"></a>

# HTTP 전송 계층

`createHttpTransport`는 라우터나 서버 프레임워크를 규정하지 않고 `BoundraClient`를 해당 프레임워크가 소유하는 HTTP 엔드포인트에 연결합니다.

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

`get-order` 계약에 대해 전송 계층은 다음 요청을 보냅니다.

```http
POST /api/boundra/contracts/get-order
content-type: application/json

{"kind":"query","name":"get-order","input":{"orderId":"order-001"}}
```

엔드포인트는 `{ "result": ... }`를 반환합니다. HTTP, 네트워크 및 잘못된 JSON으로 인한 실패는 클라이언트에 의해 `RUNTIME-003`으로 래핑됩니다.

<a id="structured-http-errors"></a>

## 구조화된 HTTP 오류

2xx가 아닌 응답은 `BoundraHttpError`를 사용합니다. 오류는 상태 코드, 상태 텍스트, 선택된 응답 헤더, 안전하게 크기를 제한한 응답 본문 및 본문이 잘렸는지 여부를 보존합니다. JSON 콘텐츠 타입은 JSON으로 파싱하고 그 외 또는 잘못된 JSON 본문은 텍스트로 유지합니다. 본문은 오류 메시지에 절대로 포함되지 않습니다.

대소문자를 구분하지 않는 다음 응답 헤더만 노출합니다.

- `content-type`
- `retry-after`
- `etag`
- `x-request-id`
- `x-correlation-id`

기반 fetch 구현이 노출하는 경우에도 쿠키, 인증 및 기타 응답 헤더는 오류에 복사하지 않습니다.

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

`maxErrorBodyBytes`는 수집하는 본문의 크기 제한을 제어하며 기본값은 64 KiB입니다. `0`으로 설정하면 상태와 헤더는 유지하면서 오류 본문은 폐기합니다. 애플리케이션은 서버가 제공하는 본문의 필드를 신뢰할 수 없는 것으로 간주하고 API 계약에서 안전하다고 표시한 메시지만 표시해야 합니다.

<a id="custom-transports"></a>

## 커스텀 전송 계층

`BoundraCallOptions`는 커스텀 전송 계층의 두 번째 인자로도 전달됩니다. 따라서 애플리케이션은 multipart 인코딩, 엔드포인트 선택 및 프레임워크별 오류 본문을 도메인 어댑터 내부에 유지하면서 동일한 호출별 취소 신호를 받을 수 있습니다.

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

전달된 신호가 중단되면 Boundra는 전송 계층의 원래 취소 오류를 다시 전달합니다. 의도적인 취소는 `RUNTIME-003`으로 보고하지 않습니다.
