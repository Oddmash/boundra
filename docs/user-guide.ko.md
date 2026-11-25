<a id="boundra-user-guide"></a>

# Boundra 사용 가이드

[English](user-guide.md) · [日本語](user-guide.ja.md) · [简体中文](user-guide.zh-cn.md)

Boundra는 Rust 기반 소스 아키텍처 검사기와 프레임워크 중립적인 TypeScript 계약 런타임을 결합합니다. 이 가이드는 공개된 v0.6.0 동작을 기준으로 합니다. 새로운 프레임워크, 호스팅 서비스 또는 자동 API 서버를 전제로 하지 않습니다.

<a id="1-install-and-verify"></a>

## 1. 설치

Node.js 20 이상과 호환되는 패키지 매니저를 사용하세요. 기존 TypeScript 프로젝트에서 실행합니다.

```sh
pnpm add boundra zod
pnpm exec boundra --version
```

npm을 사용한다면 `npm install boundra zod`와 `npx boundra --version`을 실행합니다. CLI 실행기는 처음 실행할 때 해당 릴리스 바이너리를 다운로드하고 체크섬을 검증합니다. 배포 대상은 Linux x64, macOS Intel/Apple Silicon 및 Windows x64입니다. 오프라인 빌드에서는 바이너리를 미리 준비하고 `BOUNDRA_CLI_PATH`를 그 경로로 설정합니다. [CLI 설치](cli-install.md)를 참조하세요.

<a id="2-adopt-one-slice-first"></a>

## 2. 도메인 두 개로 시작하기

작업 트리가 깨끗한 상태에서 시작하고 기존 타입 검사, 테스트 및 프레임워크 빌드를 유지하세요. 프로젝트 루트에서 실행합니다.

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

`init`은 기존 디렉터리를 보존하고 이미 설정 파일이 있는 경우에는 실패합니다. `create-domain`은 계층 디렉터리, 공개 진입점 및 매니페스트를 생성합니다. 그룹 디렉터리는 매니페스트의 이름에 영향을 주지 않습니다. 생성된 파일은 이후 애플리케이션에서 직접 수정할 수 있습니다. 생성 명령을 다시 실행해도 파일이 업데이트되지는 않습니다.

의도한 의존성 방향은 billing → order입니다. Order는 billing에 역으로 의존해서는 안 됩니다. 그래프는 선언된 의존성을 나타내며 모든 런타임 호출을 나타내는 것은 아닙니다.

| 디렉터리 | 역할 |
| --- | --- |
| apps/ | 앱 진입점 및 조합 |
| domains/order/client/ | 클라이언트 쿼리, 뮤테이션 및 UI 오케스트레이션 |
| domains/order/server/ | 서버 핸들러 및 비즈니스 로직 |
| domains/order/shared/ | 순수 계약 및 스키마 |
| domains/commerce/billing/ | 자체 매니페스트를 가진 중첩 도메인 |
| packages/ | 재사용 가능한 워크스페이스 패키지 |

<a id="3-declare-public-interfaces"></a>

## 3. 경계 규칙

CLI는 초기 스캐폴딩을 담당합니다. 각 도메인 매니페스트는 `name`, 상대 경로인 공개 API 경로 및 `dependsOn`을 선언합니다. Billing의 경우 `dependsOn: ["order"]`가 허용된 관계입니다. 도메인 간 import는 여전히 공개 진입점을 사용해야 하며 계층 규칙을 준수해야 합니다. 인터페이스를 넘어 내부 경로에 접근하기보다는 `shared/public`, `client/public`, `server/public`에서 import하는 방식을 권장합니다.

| 규칙 | 위반이 보고되었을 때 변경할 사항 |
| --- | --- |
| BR-001 | 스키마와 타입을 shared로 이동하고 어댑터를 통해 서버 동작을 호출 |
| BR-002 | 클라이언트 코드에서 순수 로직을 분리 |
| BR-003 | shared에서 런타임/UI/데이터베이스 의존성을 제거 |
| BR-004 | 대상 도메인이 선언한 공개 API를 사용 |
| BR-005 | 애플리케이션이 선언된 도메인 진입점을 사용하도록 변경 |
| BR-006 | 의도적인 의존성을 선언하거나 결합을 제거 |

문서에 명시된 매니페스트 필드만 강제됩니다. 메타데이터와 정책 자리표시자는 인가 제어 기능이 아닙니다. [매니페스트 명세](domain-manifest-spec.md) 및 [경계 규칙](boundary-rules.md)을 참조하세요.

<a id="4-implement-a-real-contract"></a>

## 4. 계약 구현

생성된 `domains/order/shared/contracts/get-order.ts`를 수정합니다.

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

생성된 쿼리 어댑터는 `client.query(getOrderQuery, input)`을 호출하며 클라이언트 공개 진입점에서 export됩니다. 네트워크나 백엔드 없이 동작을 확인하려면 프로젝트에서 TypeScript 실행기와 로컬의 타입이 지정된 전송 계층을 사용하세요.

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

빈 주문 ID는 전송 전에 RUNTIME-001로 거부되어야 합니다. 유효하지 않은 결과는 RUNTIME-002로 거부되어야 합니다. 커밋된 [order-billing 예제](../examples/order-billing)는 쿼리, 뮤테이션 및 라우트를 함께 실행합니다. 워크스페이스 의존성과 Rust를 설치한 뒤 Boundra 저장소에서 `pnpm verify-example`을 실행하세요.

<a id="5-connect-an-actual-backend"></a>

## 5. 백엔드와 연결

호스트가 대응하는 API를 제공하는 경우 `createHttpTransport({ baseUrl: "/api/boundra" })`를 사용하세요. 기본 전송 계층은 kind, name 및 input을 포함하는 POST 요청을 `/api/boundra/contracts/<name>`에 보냅니다. 서버는 `{ "result": ... }`를 반환합니다. 호스트는 라우팅, 신원 식별, 인가, 영속성 및 안전한 오류 응답을 담당하며 Boundra는 계약을 검증합니다. 서버에서 관리하는 동작에는 생성된 route 계약과 함께 `implementRoute`를 사용하고 호스트 어댑터에서 `executeContract`를 실행합니다. [HTTP 전송 계층](http-transport.md) 및 [계약 스키마](contract-schema-spec.md)를 참조하세요.

쿼리와 뮤테이션은 호출별 중단 신호를 전달받습니다. 2xx가 아닌 응답 및 전송 오류는 의도적인 취소를 제외하고 RUNTIME-003으로 보고됩니다. 원본 응답 본문을 표시하지 마세요.

<a id="6-configure-the-analyzer-and-framework"></a>

## 6. 설정과 프레임워크 통합

프로젝트 루트에 `boundra.config.json`을 유지합니다. `paths.apps`, `paths.domains`, `paths.packages`를 실제 구조에 맞게 설정하세요. CLI는 루트 TypeScript paths 및 상대 경로 extends, 단순한 루트 package imports 문자열을 읽습니다. 조건부 imports와 패키지 기반 tsconfig extends는 해석하지 않습니다. 경계 검사가 성공했다고 해서 번들러의 산출물에 별칭 대상이 포함된다는 의미는 아닙니다.

- Vite: 기존 Vite 플러그인에 `boundra/vite`의 `boundra()`를 추가합니다. 개발 오버레이는 런타임 및 경계 진단을 보고합니다. [Vite 통합](vite-integration.md).
- Next.js: App Router와 서버/클라이언트 규칙을 유지합니다. 필요하면 개발 환경에서만 실행되는 클라이언트 컴포넌트에서 `boundra/ui`를 통해 정규화된 오류를 명시적으로 보고하세요. 자동 Next.js 플러그인은 제공하지 않습니다. [오류 뷰](error-view.md).
- 기타 호스트: CLI를 독립적으로 사용하거나 호환되는 전송 계층을 구현합니다.

확장자, 무시 패턴 또는 공유 계층의 capability 분류를 사용자 지정하기 전에 [설정](config-spec.md)을 읽으세요.

<a id="7-ci-and-review"></a>

## 7. CI

PR에서 컴파일러, 테스트 및 프레임워크 빌드와 함께 `pnpm exec boundra check-boundaries --root . --format json`을 실행하세요. 종료 코드: 0 정상, 1 위반, 2 잘못된 사용/설정, 3 내부/I/O 오류. JSON의 `meta.scanned_file_count` 및 `meta.analyzed_domain_count`를 확인하세요. 빈 스캔이 경고와 함께 성공할 수 있으므로 성숙한 워크스페이스에서는 예상되는 최소 스캔 범위를 별도로 요구해야 합니다.

```sh
pnpm exec boundra check-boundaries --format json > boundra-report.json
node --input-type=module -e 'import fs from "node:fs"; const r = JSON.parse(fs.readFileSync("boundra-report.json", "utf8")); if (r.status !== "passed" || !Number.isInteger(r.meta?.scanned_file_count) || r.meta.scanned_file_count < 1 || !Number.isInteger(r.meta?.analyzed_domain_count) || r.meta.analyzed_domain_count < 2) process.exit(1)'
```

시범 도입 영역에서 예상하는 도메인 수에 맞추어 조건을 조정합니다. 보고서에 내부 경로가 포함되어 있다면 버전 관리에서 제외하세요.

<a id="8-troubleshooting"></a>

## 8. 문제 해결

| 증상 | 다음 조치 |
| --- | --- |
| CLI를 찾을 수 없거나 지원되지 않는 플랫폼 | Node 버전 및 대상을 확인하고 대응하는 네이티브 아카이브 또는 통제된 바이너리 경로 사용 |
| 다시 초기화할 수 없음 | 기존 설정을 검사하고 init을 다시 실행하기 위해 설정을 삭제하지 않도록 주의 |
| 알 수 없는 도메인 | 설정된 도메인 루트, 매니페스트 파일명과 논리적 이름 확인 |
| 예상과 달리 정상적인 스캔 결과 | 스캔 범위 수치, 경로, 무시된 파일 및 지원하지 않는 해석 입력을 확인 |
| 생성 파일이 이미 존재함 | 애플리케이션이 소유한 기존 코드를 수정하거나 다른 계약 이름을 선택 |
| HTTP 호출 실패 | 호스트 엔드포인트, 응답 형식 및 전송 계층 처리 확인 |
| Next.js에서 오버레이가 보이지 않음 | 명시적 호스트 통합을 사용하며 Vite 플러그인은 Next.js에서 실행되지 않음을 확인 |

<a id="9-decide-whether-to-retain-boundra"></a>

## 9. 도입 판단

기존 도구와 비교하여 도입 비용 및 대표적인 실패 사례를 측정하세요. 전체 저장소를 마이그레이션하기 전에 도메인 하나부터 시작하세요. 대안, 제한 사항 및 증거에 기반한 통과 기준은 [제품 포지셔닝](product-positioning.md)을 읽어보세요. Boundra는 개발 아키텍처의 가드레일이며 런타임 격리 또는 프로덕션 보안 제어 기능은 아닙니다.
