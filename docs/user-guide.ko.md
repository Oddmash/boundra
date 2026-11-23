# Boundra 사용 가이드

[English](user-guide.md) · [日本語](user-guide.ja.md) · [简体中文](user-guide.zh-cn.md)

Boundra는 TypeScript 애플리케이션의 구조와 계약을 함께 검사하는 개발 도구입니다. Rust CLI는 소스의 도메인 경계를 검사하고 TypeScript 런타임은 입력·결과 스키마를 검증합니다. 기존 프레임워크와 서버는 유지합니다. 이 문서는 v0.6.0 공개 기능 기준입니다.

## 1. 설치

Node.js 20 이상과 호환되는 패키지 매니저가 필요합니다. 기존 프로젝트 루트에서 실행합니다.

```sh
pnpm add boundra zod
pnpm exec boundra --version
```

npm을 사용하면 `npm install boundra zod` 및 `npx boundra --version`을 실행합니다. CLI는 첫 실행 때 현재 버전의 네이티브 바이너리를 내려받아 체크섬을 확인합니다. Linux x64, macOS Intel/Apple Silicon, Windows x64 릴리스가 제공됩니다. 오프라인에서는 미리 준비한 바이너리 경로를 `BOUNDRA_CLI_PATH`로 지정하세요. [설치 상세](cli-install.md).

## 2. 도메인 두 개로 시작하기

기존 프로젝트를 한꺼번에 이전하지 마세요. 현재 테스트와 빌드는 유지하고, 변경사항을 별도 브랜치에서 관리합니다.

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

초기화는 기존 파일을 덮어쓰지 않습니다. 이미 설정이 있으면 실패합니다. 생성기는 도메인 매니페스트, 레이어 디렉터리 및 공개 진입점을 만듭니다. `commerce`는 그룹이며 도메인 이름은 `billing`입니다. 생성된 파일은 이후 애플리케이션에서 직접 관리합니다.

| 위치 | 역할 |
| --- | --- |
| apps/ | 앱 진입점과 조합 |
| domains/order/client/ | UI 연결, 쿼리와 뮤테이션 |
| domains/order/server/ | 서버 핸들러와 비즈니스 로직 |
| domains/order/shared/ | 순수 계약, 스키마, 타입 |
| domains/commerce/billing/ | 별도 매니페스트를 가진 결제 도메인 |
| packages/ | 재사용 가능한 워크스페이스 패키지 |

`billing → order`는 의도적으로 선언된 의존성입니다. 반대 방향을 추가해 순환시키지 않습니다. 그래프는 매니페스트 관계이며 모든 런타임 호출을 의미하지 않습니다.

## 3. 경계 규칙

각 `domain.json`의 `name`, `publicApi`, `dependsOn`을 기준으로 소스를 검사합니다. 도메인 간 접근은 공개 진입점을 통해야 하고 레이어 규칙도 충족해야 합니다. 정책 placeholder는 인증·인가 기능이 아닙니다.

| 오류 | 해결 방법 |
| --- | --- |
| BR-001 | 클라이언트의 서버 import를 제거하고 계약과 어댑터 사용 |
| BR-002 | 클라이언트 의존 로직을 순수 계층으로 이동 |
| BR-003 | shared에서 UI/DB/runtime 의존성 제거 |
| BR-004 | 상대 도메인의 선언된 public API 사용 |
| BR-005 | 앱에서 도메인 내부 대신 공개 진입점 사용 |
| BR-006 | 의도적인 도메인 의존성을 선언하거나 결합 제거 |

[매니페스트 명세](domain-manifest-spec.md) · [경계 규칙](boundary-rules.md)

## 4. 계약 구현

생성된 `domains/order/shared/contracts/get-order.ts`의 빈 스키마를 실제 계약으로 변경합니다.

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

생성된 client 어댑터는 `getOrder(client, input)`을 공개 문서 경로로 내보냅니다. 네트워크 없이 먼저 동작을 확인할 수 있습니다. 프로젝트 루트의 TypeScript 파일을 실행 가능한 환경에서 아래와 같이 작성합니다.

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

빈 입력은 transport 호출 전에 RUNTIME-001로 거부되고, 결과 스키마가 맞지 않으면 RUNTIME-002가 발생합니다. 실제 query·mutation·route가 연결된 [order-billing 예제](../examples/order-billing)는 저장소에서 의존성과 Rust를 설치한 다음 `pnpm verify-example`로 검증할 수 있습니다.

## 5. 백엔드와 연결

`createHttpTransport({ baseUrl: "/api/boundra" })`를 사용하면 POST `/api/boundra/contracts/<name>`으로 kind, name, input을 전달합니다. 서버는 `{ "result": ... }` 형태로 반환합니다. 서버 라우팅, 인증·인가, 데이터베이스, 상태 코드와 오류 응답은 기존 애플리케이션의 책임입니다. 서버 계약은 생성된 route에 `implementRoute`를 연결하고 호스트에서 `executeContract`로 실행할 수 있습니다.

쿼리·뮤테이션의 AbortSignal은 transport로 전달됩니다. 일반 네트워크/HTTP 오류는 RUNTIME-003으로 처리되지만 의도적 취소는 예외입니다. 원본 응답을 그대로 UI에 표시하지 마세요.

[HTTP transport](http-transport.md) · [계약 명세](contract-schema-spec.md)

## 6. 설정과 프레임워크 통합

루트의 `boundra.config.json`에서 실제 앱·도메인·패키지 경로를 맞춥니다. 루트 tsconfig의 paths와 상대 extends, 단순 root package imports 문자열을 지원합니다. 조건부 imports와 패키지 기반 extends는 해석하지 않습니다. 검사 통과가 실제 번들러나 배포 환경의 모듈 해석까지 보장하지는 않습니다.

- Vite: 기존 플러그인에 `boundra/vite`의 `boundra()` 추가. 개발 중 경계·런타임 오류를 표시하며 프로덕션 빌드에는 주입되지 않습니다.
- Next.js: App Router와 기존 서버/클라이언트 규칙을 그대로 사용합니다. 자동 Vite 플러그인은 동작하지 않으며 필요하면 `boundra/ui`로 정규화된 오류를 개발 환경에서 직접 표시합니다.
- 기타: CLI 단독 사용 또는 호스트 transport 구현.

[설정](config-spec.md) · [Vite](vite-integration.md) · [Next.js 오류 뷰](error-view.md)

## 7. CI

타입 검사, 테스트, 프레임워크 빌드와 함께 실행하세요. 종료 코드 0은 성공, 1은 경계 위반, 2는 설정/사용 오류, 3은 실행/I/O 오류입니다. **검사된 소스나 도메인이 0개여도 현재 CLI는 경고 후 성공할 수 있습니다.** 따라서 CI에서 범위를 확인하세요.

```sh
pnpm exec boundra check-boundaries --format json > boundra-report.json
node --input-type=module -e 'import fs from "node:fs"; const r = JSON.parse(fs.readFileSync("boundra-report.json", "utf8")); if (r.status !== "passed" || !Number.isInteger(r.meta?.scanned_file_count) || r.meta.scanned_file_count < 1 || !Number.isInteger(r.meta?.analyzed_domain_count) || r.meta.analyzed_domain_count < 2) process.exit(1)'
```

예상 도메인 수에 맞춰 조건을 조정하세요. 내부 경로가 포함된 리포트를 공개 저장소에 커밋하지 않도록 주의합니다.

## 8. 문제 해결

| 증상 | 확인할 항목 |
| --- | --- |
| CLI 실행 불가 | Node 버전, 지원 플랫폼, 바이너리 경로 |
| init 재실행 실패 | 기존 설정을 확인하고 유지 |
| 도메인 미발견 | 도메인 경로, manifest 파일명, name 값 |
| 검사 결과가 비어 있음 | 검사 파일 수, ignore와 paths |
| 생성 파일 이미 존재 | 기존 소스를 수정하거나 새 이름 사용 |
| HTTP 실패 | 호스트 API와 result 응답 형식 |
| Next.js에서 오버레이 없음 | 별도 호스트 통합 사용 |

## 9. 도입 판단

ESLint나 Nx가 현재 문제를 해결하고 있다면 Boundra를 중복해서 추가할 필요가 없습니다. 여러 도메인의 공개 API, 의존성 선언, 계약 생성을 함께 관리해야 할 때 한 도메인에서 실험하세요. 정적 검사는 런타임 보안 경계가 아닙니다. [대안 비교 및 도입 기준](product-positioning.md).
