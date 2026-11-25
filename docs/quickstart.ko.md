<a id="boundra-public-quickstart"></a>

# Boundra 공개 빠른 시작 가이드

<a id="prerequisites"></a>

## 사전 요구 사항

- TypeScript 애플리케이션의 경우 Node.js 20 이상
- pnpm, npm 또는 기타 패키지 매니저

<a id="install-the-runtime"></a>

## 런타임 설치

```bash
pnpm add boundra zod
```

npm 패키지에는 네이티브 CLI 실행기가 포함되어 있습니다. 워크스페이스를 초기화합니다.

```bash
pnpm exec boundra init --name my-app
```

<a id="create-a-project-flow"></a>

## 프로젝트 생성 흐름

```bash
pnpm exec boundra create-domain order
pnpm exec boundra create-domain billing
pnpm exec boundra add-dependency billing/order
pnpm exec boundra generate query order/get-order
pnpm exec boundra generate mutation order/submit-order
pnpm exec boundra generate route billing/create-invoice
pnpm exec boundra check-boundaries --format json
pnpm exec boundra graph-domains --format mermaid
```

생성된 계약은 안전한 빈 Zod 객체로 시작합니다. 객체의 필드를 도메인의 입력 및 결과 스키마로 교체한 다음, 생성된 클라이언트 또는 서버 어댑터를 구현합니다. Boundra는 기존 생성 파일을 덮어쓰지 않습니다.

<a id="ci-gate"></a>

## CI 검증

```bash
pnpm exec boundra check-boundaries --root . --format json
```

계약의 소유권은 `docs/contract-schema-spec.md`, 네이티브 CLI 설치는 `docs/cli-install.md`를 참조하세요.
