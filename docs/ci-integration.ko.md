<a id="ci-integration"></a>

# CI 통합

<a id="add-boundra-to-your-application"></a>

## 애플리케이션에 Boundra 추가

프로젝트 패키지 매니저를 사용하여 `boundra`와 `zod`를 설치하고 프로젝트를 초기화한 뒤 설정 및 도메인 매니페스트를 커밋합니다. 기존 타입 검사, 테스트, 빌드와 함께 경계 검사를 실행합니다. 다음은 배포된 CLI를 사용하는 pnpm 애플리케이션에 적용할 수 있는 최소한의 GitHub Actions 예제입니다.

```yaml
name: Check boundaries

on:
  pull_request:
  push:
    branches: [main]

jobs:
  boundaries:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec boundra check-boundaries --root . --format json
```

npm 프로젝트에서는 마지막 두 명령을 `npm ci` 및 `npx boundra check-boundaries --root . --format json`으로 교체하세요. 네이티브 실행기는 처음 사용할 때 대응하는 릴리스 CLI를 가져옵니다. 오프라인 또는 지원되지 않는 플랫폼의 요구 사항은 [설치](cli-install.md)를 참조하세요. 배포된 v0.6.0에서는 빈 스캔이 경고와 함께 통과할 수 있습니다. JSON 스캔 범위 수치를 확인하고 프로젝트에 최소 도메인 수가 필요한 경우 [사용 가이드](user-guide.md)의 스캔 범위 검사를 사용하세요.

<a id="boundra-repository-verification"></a>

## Boundra 저장소 검증

커밋된 예제 흐름을 필수 CI 검증으로 사용합니다. TypeScript 인터페이스의 타입을 검사하고 런타임 및 예제 흐름을 실행하며 Rust 테스트를 실행하고 경계를 확인한 뒤 도메인 그래프를 렌더링합니다.

```yaml
name: Boundra

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  verify-example:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - uses: dtolnay/rust-toolchain@stable
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify-example
      - run: pnpm verify-clean-room
      - run: cargo clippy --workspace --all-targets -- -D warnings
```

<a id="local-verification"></a>

## 로컬 검증

동일한 통합 검증을 로컬에서 실행합니다.

```bash
pnpm verify-example
```

개별 경계 검사 명령은 Boundra의 분석기만 도입하는 저장소에도 적합합니다. 아직 릴리스되지 않은 CLI에서는 성숙한 워크스페이스가 예상하는 최소 스캔 도메인 수를 요구할 수 있어, 잘못 설정된 빈 스캔이 경고도 없이 통과하는 상황을 방지할 수 있습니다.

```bash
boundra check-boundaries --format json --min-domains 2
```

도입 영역에 예상되는 도메인 수로 임계값을 설정하세요. 옵션이 없으면 CLI는 빈 스캔에 경고만 출력하는 기존 동작을 유지합니다.

<a id="exit-codes"></a>

## 종료 코드

- `0`: 경계 위반 없음
- `1`: 경계 위반 발견
- `2`: 설정, 매니페스트 또는 CLI 사용 오류
- `3`: 런타임 스캔 또는 파일 시스템 오류

<a id="json-output"></a>

## JSON 출력

CI 및 에이전트 연동에는 JSON 출력을 우선 사용해야 합니다.

```bash
cargo run -p boundra-cli -- check-boundaries --root examples/order-billing --format json
```

예제:

```json
{
  "status": "failed",
  "violations": [
    {
      "rule": "BR-001",
      "file": "domains/order/client/use-order.ts",
      "line": 3,
      "import": "../server/order-service",
      "message": "client layer cannot import server layer",
      "suggestion": "move shared contract to shared layer or call through an API boundary"
    }
  ],
  "meta": {
    "command": "check-boundaries",
    "violation_count": 1
  }
}
```
