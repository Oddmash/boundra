<a id="contract-schema-spec"></a>

# 계약 스키마 명세

<a id="1-source-of-truth"></a>

## 1. 기준 정보

`domains/<domain>/shared/contracts/` 아래에 생성된 각 계약 파일은 두 종류의 런타임 스키마를 소유합니다.

- 입력 스키마
- 결과 스키마

TypeScript 입력 및 결과 타입은 이러한 스키마에서 추론하며, 별도로 작성한 인터페이스는 생성하지 않습니다.

<a id="2-schema-provider"></a>

## 2. 스키마 제공자

초기 생성기는 Zod 스키마를 생성합니다. `boundra`는 다음 구조만을 요구하므로 제공자에 독립적입니다.

```ts
export type BoundraSchema<Output> = {
  parse(value: unknown): Output;
};
```

같은 parse 계약을 구현하는 스키마라면 다른 스키마 제공자를 사용할 수 있습니다. 제공자별 기능은 Boundra 런타임 API에 포함되지 않습니다.

<a id="3-contract-shape"></a>

## 3. 계약 구조

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

생성된 빈 객체는 안전한 스캐폴드입니다. 기능 개발 과정에서 필드를 실제 도메인 스키마로 교체합니다. 생성된 파일은 생성 이후 애플리케이션이 소유하며 절대로 덮어쓰지 않습니다.

<a id="4-runtime-behavior"></a>

## 4. 런타임 동작

- 클라이언트 query/mutation 호출은 전송 전에 입력을 파싱
- 전송 결과는 애플리케이션 코드에 반환하기 전에 파싱
- 클라이언트 호출은 `AbortSignal`을 전달할 수 있으며 신호는 커스텀 및 HTTP 전송 계층으로 전달됨
- 의도적인 취소는 `RUNTIME-003` 전송 실패로 보고하지 않고 그대로 다시 전달
- 서버 route 실행은 핸들러 전에 입력을 파싱하고 반환 전에 핸들러 결과를 파싱
- 누락된 핸들러 및 스키마 파싱 실패는 타입이 지정된 런타임 오류로 나타남
- 스키마 파싱 실패는 `BoundraRuntimeError.issues`를 통해 제공자 중립적인 필드 오류를 노출
- 직렬화된 런타임 오류는 원본 입력 및 내부 `cause`를 제외

<a id="5-public-exports"></a>

## 5. 공개 export

생성 과정에서는 `shared/public.ts`에 멱등적인 export를 추가합니다.

```ts
export * from "./contracts/get-order";
```

현재 매니페스트와의 호환성을 위해 계약의 직접 경로는 `domain.json`의 `publicApi.shared`에 유지됩니다. 소비자는 안정적인 `shared/public` 진입점을 우선 사용해야 합니다.

Query, mutation 및 resource 생성 과정 역시 해당 어댑터를 `client/public.ts`에 멱등적으로 추가합니다. 동일한 기존 export가 다른 인용부호를 사용하거나 세미콜론을 생략하거나 후행 주석을 포함하더라도 중복되지 않습니다. 기존 애플리케이션 export는 보존됩니다.

```ts
export * from "./queries/get-order";
```

Route 생성은 클라이언트 export를 추가하지 않습니다.

<a id="6-ownership"></a>

## 6. 소유권

- 최초 파일 생성은 생성기가 소유
- 이후 스키마 필드 및 핸들러 구현은 애플리케이션 코드가 소유
- 반복 생성 시 애플리케이션 변경사항을 덮어쓰지 않고 실패해야 함
