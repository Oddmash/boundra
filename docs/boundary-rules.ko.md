<a id="boundary-rules"></a>

# 경계 규칙

`<discovered-domain-root>`는 재귀적으로 탐색된 도메인 매니페스트의 상위 디렉터리를 뜻합니다. `paths.domains` 아래에 중첩될 수 있습니다.

<a id="1-rule-set-hard-constraints"></a>

## 1. 규칙 집합 (필수 제약)

<a id="br-001-client-to-server-import-ban"></a>

### BR-001: 클라이언트에서 서버로의 import 금지
- 규칙: 탐색된 도메인의 `client/**`에서 같은 도메인 또는 다른 탐색된 도메인의 `server/**` import 금지
- 이유: 배포 경계 및 실행 환경 분리

<a id="br-002-server-to-client-import-ban"></a>

### BR-002: 서버에서 클라이언트로의 import 금지
- 규칙: 탐색된 도메인의 `server/**`에서 같은 도메인 또는 다른 탐색된 도메인의 `client/**` import 금지
- 이유: 계층 역전 방지

<a id="br-003-shared-purity"></a>

### BR-003: 공유 계층의 순수성
- 규칙: `<discovered-domain-root>/shared/**`는 공유 계층 정책에서 거부된 capability에 의존할 수 없음
- 기본 거부 capability: `ui`, `database`, `runtime`
- 기본 분류는 기존 React/Next, Prisma, Node 런타임, `packages/ui`, `packages/db`, `packages/infra` 및 앱 경로 동작을 유지
- `checkBoundaries.capabilities`에서 의존성을 capability로 분류하고 `checkBoundaries.policy.shared.denyCapabilities`에서 거부 정책을 설정
- 허용: capability가 거부되지 않은 순수 계약/스키마 의존성
- 이유: 계약 계층의 순수성을 프로젝트별 스택에 맞게 강제

<a id="br-004-cross-domain-access-policy"></a>

### BR-004: 도메인 간 접근 정책
- 규칙: 도메인 간 직접 내부 경로 import 금지
- 허용: `<other-discovered-domain-root>/shared/public` 또는 명시된 공개 API만 허용
- 이유: 내부 구현 은닉과 변경 안전성 확보

<a id="br-005-app-to-domain-public-api-policy"></a>

### BR-005: 앱에서 도메인으로의 공개 API 접근 정책
- 규칙: `apps/**`에서 `<discovered-domain-root>/**`를 import할 때 해당 도메인의 매니페스트에 선언된 공개 API만 허용
- 허용: `<discovered-domain-root>/client/public`, `server/public`, `shared/public` 또는 매니페스트에 명시된 공개 API
- 이유: 컴포지션 루트인 앱이 도메인 내부 구현에 결합되는 것을 방지

<a id="br-006-declared-domain-dependency-policy"></a>

### BR-006: 선언된 도메인 의존성 정책
- 규칙: 다른 도메인의 공개 API를 import하려면 대상 도메인이 소스 매니페스트의 `dependsOn`에 선언되어야 함
- 허용: `dependsOn`에 선언된 도메인의 매니페스트 공개 API
- 이유: 실제 코드 의존성과 도메인 그래프를 일치시켜 숨은 결합을 방지

<a id="2-allow-list"></a>

## 2. 허용 목록

- `client -> shared`
- `server -> shared`
- `domain -> other-domain public API`
- `domain -> declared dependency public API`
- `app -> domain public API`

<a id="compact-single-layer-layout"></a>

### 간결한 단일 계층 구조

매니페스트의 공개 API 분류 중 정확히 하나가 비어 있지 않으면 해당 도메인 루트 바로 아래의 파일은 그 분류의 계층으로 분석됩니다. 이는 구조를 간소화하기 위한 기능일 뿐이며, 기존의 모든 계층 및 공개 API 규칙은 그대로 적용됩니다. ADR 0009를 참조하세요.

<a id="nested-domain-roots"></a>

### 중첩된 도메인 루트

도메인 루트는 `paths.domains` 아래의 모든 깊이에서 설정된 매니페스트 파일명을 기준으로 탐색됩니다. BR-001부터 BR-006까지는 `paths.domains/<name>`을 가정하는 대신 탐색된 루트를 사용합니다. 그룹 디렉터리에는 경계 식별자가 없습니다. ADR 0011을 참조하세요.

<a id="3-violation-output-format"></a>

## 3. 위반 출력 형식

CLI는 위반 시 아래 구조를 제공해야 합니다.

```txt
[BOUNDARY_VIOLATION] BR-001
file: domains/order/client/use-order.ts
import: domains/order/server/order-service
line: 12
message: client layer cannot import server layer.
suggestion: move contract/type to shared or call via public API.
```

<a id="4-exit-codes"></a>

## 4. 종료 코드

- `0`: 위반 없음
- `1`: 위반 존재
- `2`: 설정/매니페스트 파싱 오류
- `3`: 내부 실행 오류

<a id="5-example-violations"></a>

## 5. 위반 예제

<a id="example-a"></a>

### 예제 A
- 소스: `domains/product/client/list.ts`
- Import: `domains/product/server/repository.ts`
- 결과: BR-001

<a id="example-b"></a>

### 예제 B
- 소스: `domains/auth/shared/types.ts`
- Import: `packages/ui/button`
- 결과: BR-003

<a id="example-c"></a>

### 예제 C
- 소스: `domains/order/server/checkout.ts`
- Import: `domains/product/server/internal/stock.ts`
- 결과: BR-004

<a id="example-d"></a>

### 예제 D
- 소스: `apps/web/src/checkout.ts`
- Import: `domains/order/server/internal/checkout.ts`
- 결과: BR-005

<a id="example-e"></a>

### 예제 E
- 소스: `domains/order/server/checkout.ts`
- Import: `domains/billing/server/public.ts`
- 매니페스트: `order.dependsOn`에 `billing`이 포함되어 있지 않음
- 결과: BR-006
