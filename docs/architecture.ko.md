<a id="architecture"></a>

# 아키텍처

<a id="1-workspace-layout"></a>

## 1. 워크스페이스 구조

```txt
apps/
  web/
  admin/

examples/
  order-billing/
    domains/
    src/

domains/
  [<group>/...]
    <domain>/
      domain.json
      client/
      server/
      shared/
      mcp/
      tests/

packages/
  runtime/
  ui/
  infra/
  config/
  tooling/

crates/
  core/
  parser/
  rules/
  cli/
```

`apps/`에는 저장소에서 관리하는 배포 가능한 제품 진입점을 둡니다.
`examples/`에는 자체적으로 실행 가능한 학습 및 프레임워크 검증 프로젝트를 둡니다. 각 예제는 자체 Boundra 설정, TypeScript 설정 및 도메인을 유지해야 하며, 프레임워크 저장소 자체를 애플리케이션으로 간주하지 않고 명시적인 `--root`로 검사할 수 있어야 합니다.

도메인 매니페스트는 `paths.domains` 아래에서 재귀적으로 탐색됩니다. 선택적인 그룹 디렉터리는 파일 시스템을 정리하기 위한 것으로 도메인 식별자의 일부가 되지 않습니다. 매니페스트의 `name`이 안정적인 식별자입니다. ADR 0011을 참조하세요.

<a id="2-domain-layers"></a>

## 2. 도메인 계층

- `client/`: UI, 훅, 브라우저 측 오케스트레이션
- `server/`: API 핸들러, 비즈니스 규칙, 데이터 오케스트레이션
- `shared/`: 스키마, DTO, 계약, 순수 유틸리티
- `mcp/`: AI 어댑터 계층(도구/리소스/프롬프트)
- `tests/`: 도메인 테스트(단위/통합)

<a id="3-dependency-direction"></a>

## 3. 의존성 방향

허용:
- `client -> shared`
- `server -> shared`
- `domain -> other-domain public API`
- `domain -> declared dependency public API`

금지:
- `client -> server`
- `server -> client`
- `shared -> policy-denied capability` (기본 `ui`, `database`, `runtime`)
- `domain -> other-domain internal path`
- `domain -> undeclared domain public API`
- 순환 도메인 의존성 그래프

<a id="4-runtime-and-tooling"></a>

## 4. 런타임 및 도구

- 사용자 레벨: TypeScript
- 코어 엔진: Rust
- 브릿지: NAPI-RS (향후 후보)
- 빌드/분석: Rust 분석기 CLI를 우선 도입하고 TypeScript 빌드 통합은 이후에 진행
- 모노레포: pnpm (초기), Nx는 선택적 도입
- 프레임워크 표면: `docs/framework-surface.md`를 따른다.

<a id="5-core-crates-responsibility"></a>

## 5. 코어 크레이트의 역할

- `core`: 프로젝트 설정, 도메인 매니페스트, 공통 진단/도메인 타입
- `parser`: 워크스페이스 파일 스캔 및 import 추출
- `rules`: 경계 검증
- `cli`: 명령 파싱, 실행, 그래프 출력 및 코드 생성

<a id="6-package-responsibility"></a>

## 6. 패키지의 역할

- `packages/runtime`: 생성된 계약에서 사용하는 순수 TypeScript 헬퍼 타입
- `packages/ui`: 정규화된 Boundra 진단을 프레임워크 중립적으로 브라우저에 렌더링하며, 단일 npm 하위 경로인 `boundra/ui`로 배포
- `packages/config`: 현재 지원하는 Boundra 프로젝트 설정을 작성하기 위한 TypeScript 타입이며, `boundra/config`로 배포되지만 네이티브 설정 탐색은 계속 `boundra.config.json`을 사용

<a id="7-expansion-strategy"></a>

## 7. 확장 전략

MCP는 v3 이후 `domains/<domain>/mcp`에서 확장하며, 코어 로직과 분리한다.

확장 DSL은 실제 도그푸딩 이후 검토한다. 코어 확장은 Lua보다 Starlark를 우선 후보로 둔다.
