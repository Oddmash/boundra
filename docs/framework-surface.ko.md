<a id="framework-surface"></a>

# 프레임워크 인터페이스

<a id="1-purpose"></a>

## 1. 목적

Boundra는 경계 검사기에 머무르지 않아야 합니다. 다음 계층은 Next.js, 번들러, ORM, UI 프레임워크 또는 테스트 러너를 대체하지 않으면서 실제 애플리케이션이 Boundra에서 생성한 계약을 사용할 수 있게 하는 작은 TypeScript 인터페이스입니다.

이 문서는 다음 단계의 언어별 역할 분담을 정의합니다.

<a id="2-language-responsibilities"></a>

## 2. 언어별 역할

<a id="rust-engine"></a>

### Rust 엔진

Rust는 결정적인 도구 동작을 계속 담당합니다.

- 프로젝트 및 도메인 매니페스트 로드
- import 스캔 및 경계 분석
- 규칙 진단
- 의존성 그래프 생성
- CLI 오케스트레이션
- 코드 생성 시 파일 쓰기

Rust는 엄격하고 빠르며 예측 가능해야 합니다.

<a id="typescript-surface"></a>

### TypeScript 인터페이스

TypeScript는 애플리케이션에서 사용하는 API를 소유해야 합니다.

- 생성된 계약 타입
- route/query/mutation 어댑터
- 클라이언트/서버 헬퍼 함수
- 앱의 프레임워크 통합 헬퍼
- 프레임워크 중립적인 개발자 진단 렌더링
- 개발자용 패키지 진입점

애플리케이션 코드에서 직접 import하는 모든 것은 TypeScript 계층이 적합합니다.

<a id="extension-dsl"></a>

### 확장 DSL

확장 DSL은 나중에 도입할 수 있지만 실제 도그푸딩보다 먼저 도입해서는 안 됩니다.

권장 순서:

1. TypeScript 프레임워크 인터페이스
2. 스키마 기반 코드 생성 템플릿
3. 도그푸딩 프로젝트 피드백
4. Starlark 정책/코드 생성 훅
5. 선택적 Lua 로컬 자동화 훅

<a id="3-starlark-vs-lua-decision"></a>

## 3. Starlark와 Lua 선택

Boundra는 코어 확장성 측면에서 Lua보다 Starlark를 우선해야 합니다.

이유:

- Starlark는 결정적이며 정책 중심입니다.
- 무제한 스크립팅보다 규칙/설정/코드 생성 사용자 지정에 적합합니다.
- Boundra의 "자유보다 안전한 제약" 원칙에 부합합니다.
- 프로젝트 정책이 너무 이른 시점에 임의의 로컬 스크립트로 변질되는 일을 방지합니다.

Lua는 이후 로컬 자동화 또는 AI/MCP 스크립팅을 위한 선택지로 남지만 코어 정책에는 사용하지 않습니다.

<a id="4-first-typescript-package"></a>

## 4. 첫 TypeScript 패키지

첫 TypeScript용 패키지는 의도적으로 작아야 합니다.

후보 패키지:

```txt
packages/
  runtime/
    src/
      types.ts
      index.ts
```

초기 책임:

- 생성된 계약을 위한 스키마 기반 헬퍼 타입 노출
- route/query/mutation 계약 및 구현 구조 정의
- 계약 입력 및 결과 값 검증
- 프레임워크 중립적인 클라이언트/전송 경계 제공
- 프레임워크별 런타임 동작을 피함
- React, Next.js, 데이터베이스 클라이언트 또는 서버 런타임에 의존하지 않음

브라우저 오류 뷰도 동일한 규칙을 따릅니다. DOM 렌더링은 `packages/ui`가 소유하고, 오류 캡처와 생명 주기 통합은 Vite 및 호스트 애플리케이션이 소유합니다. 두 번째 npm 패키지가 아닌 `boundra/ui`로 배포합니다.

목표에 포함되지 않는 항목:

- HTTP 서버 없음
- 라우터 대체 없음
- 아직 내장 fetch 전송 계층 없음
- 아직 React 훅 런타임 없음
- ORM 통합 없음

<a id="5-generated-code-direction"></a>

## 5. 생성 코드 방향

생성된 파일은 런타임 기반 스키마 구조를 사용합니다.

예제 방향:

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

Zod는 스키마를 작성하며 런타임은 구조적인 `parse` 계약에만 의존합니다. `docs/contract-schema-spec.md` 및 ADR 0002를 참조하세요.

<a id="6-dogfooding-rule"></a>

## 6. 도그푸딩 규칙

Boundra를 실제 내부 프로젝트 흐름에서 적어도 한 번 사용하기 전에는 Starlark, Lua 또는 WASM 플러그인 런타임을 추가하지 마세요.

첫 검증 목표는 완료되었습니다.

- 적어도 두 개의 도메인 생성
- 적어도 하나의 route, query 및 mutation 생성
- 생성된 계약을 앱 패키지 또는 앱 폴더에 연결
- 일반적인 개발 과정에서 `check-boundaries` 및 `graph-domains` 실행
- 확장 스크립팅을 추가하기 전에 누락된 API를 기록

커밋된 `examples/order-billing` 흐름은 현재 위 항목을 포함하며 `pnpm verify-example`을 통해 검증합니다. 이 과정에서 임시 계약 타입, 수동 의존성 선언 및 누락된 공개 export 생성이 다음 설계에 필요한 사항으로 드러났습니다.

이 사항은 ADR 0002, 스키마 기반 생성 계약, 프레임워크 중립적인 클라이언트/서버 런타임, `add-dependency` 및 생성된 공유 공개 export로 해결되었습니다.

<a id="7-first-implementation-slice"></a>

## 7. 첫 구현 단계

상태: 완료.

첫 코드 단계는 다음과 같습니다.

1. `packages/runtime` 추가
2. 순수 TypeScript 헬퍼 타입 정의
3. 생성되는 route/query/mutation 템플릿이 해당 헬퍼 타입을 import하도록 업데이트
4. 생성된 파일이 런타임 인터페이스를 사용하는지 확인하는 작은 픽스처 테스트 추가

이렇게 하면 플러그인 언어를 성급히 추가하지 않고도 다음 단계를 실용적으로 진행할 수 있습니다.
