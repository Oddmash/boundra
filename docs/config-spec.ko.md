<a id="boundra-config-spec"></a>

# Boundra 설정 명세

<a id="1-file-location"></a>

## 1. 파일 위치

루트 파일:

```txt
boundra.config.json
```

파일은 선택 사항입니다. 파일이 없으면 Boundra는 내장 기본값을 사용합니다.

<a id="2-purpose"></a>

## 2. 목적

`boundra.config.json`은 CLI에서 사용하는 프로젝트 모델을 정의합니다.

- 워크스페이스 및 패키지 루트
- 도메인 루트 및 매니페스트 파일명
- 새 도메인의 기본 공개 API 경로
- 경계 검사 시 스캐너의 확장자 및 무시 경로
- 의존성 capability 분류 및 공유 계층 정책

<a id="3-supported-fields"></a>

## 3. 지원하는 필드

### `project`

```json
{
  "project": {
    "workspaceRoot": "."
  }
}
```

지원 항목:

- `workspaceRoot`: 워크스페이스 루트의 상대 경로

### `paths`

```json
{
  "paths": {
    "apps": "apps",
    "domains": "domains",
    "packages": "packages",
    "crates": "crates"
  }
}
```

지원 항목:

- `apps`
- `domains`
- `packages`
- `crates`

모든 경로는 상대 경로여야 합니다.

### `domain`

```json
{
  "domain": {
    "manifestFile": "domain.json",
    "publicApi": {
      "client": ["./client/public.ts"],
      "server": ["./server/public.ts"],
      "shared": ["./shared/public.ts"]
    }
  }
}
```

지원 항목:

- `manifestFile`: 경로가 아닌 파일명만 허용
- `publicApi.client`
- `publicApi.server`
- `publicApi.shared`

`create-domain`에서 이러한 기본값을 사용합니다.

### `checkBoundaries`

```json
{
  "checkBoundaries": {
    "includeExtensions": ["ts", "tsx", "js", "jsx", "svelte"],
    "ignore": [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.claude/worktrees/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/target/**"
    ],
    "capabilities": {
      "external": {
        "react": ["ui"],
        "@prisma/client": ["database"],
        "node:*": ["runtime"]
      },
      "packages": {
        "ui": ["ui"],
        "db": ["database"],
        "infra": ["runtime"]
      },
      "apps": ["runtime"]
    },
    "policy": {
      "shared": {
        "denyCapabilities": ["ui", "database", "runtime"]
      }
    }
  }
}
```

지원 항목:

- `includeExtensions`: 파서에서 스캔할 파일 확장자
- `ignore`: 단순한 워크스페이스 기준 상대 경로 무시 패턴
- `capabilities.external`: 외부 import 매처를 capability 목록에 매핑
- `capabilities.packages`: `paths.packages`의 직접 하위 디렉터리를 capability 목록에 매핑
- `capabilities.apps`: `paths.apps` 내부로 해석되는 import에 부여하는 capability
- `policy.shared.denyCapabilities`: `shared`에서 BR-003을 발생시키는 capability
- `denyDomainDependencies`: 발견된 소스 도메인별 금지 대상 도메인 목록. 예: `{"billing": ["shipping"]}`. BR-007을 추가하며 기존 규칙을 변경하지 않습니다. 알 수 없는 이름, 자기 자신, 중복 대상은 설정 오류입니다.

외부 매처는 정확한 패키지 및 해당 패키지의 하위 경로와 일치합니다. `node:*`와 같은 접두사 계열에 대해 끝의 단일 `*`를 지원합니다.

설정한 `external` 및 `packages` 항목은 내장 기본값 위에 적용됩니다. 빈 목록을 지정하면 해당 소스의 기본 분류가 비활성화됩니다. `apps` 및 `policy.shared.denyCapabilities`는 각각의 기본값을 대체합니다.

<a id="4-defaults"></a>

## 4. 기본값

설정 파일이 없으면 Boundra는 다음 설정이 존재하는 것처럼 동작합니다.

```json
{
  "project": {
    "workspaceRoot": "."
  },
  "paths": {
    "apps": "apps",
    "domains": "domains",
    "packages": "packages",
    "crates": "crates"
  },
  "domain": {
    "manifestFile": "domain.json",
    "publicApi": {
      "client": ["./client/public.ts"],
      "server": ["./server/public.ts"],
      "shared": ["./shared/public.ts"]
    }
  },
  "checkBoundaries": {
    "includeExtensions": ["ts", "tsx", "js", "jsx", "svelte"],
    "ignore": [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.claude/worktrees/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/target/**"
    ],
    "capabilities": {
      "external": {
        "react": ["ui"],
        "react-dom": ["ui"],
        "next": ["ui", "runtime"],
        "@prisma/client": ["database"],
        "fs": ["runtime"],
        "path": ["runtime"],
        "crypto": ["runtime"],
        "child_process": ["runtime"],
        "stream": ["runtime"],
        "http": ["runtime"],
        "https": ["runtime"],
        "os": ["runtime"],
        "process": ["runtime"],
        "node:*": ["runtime"]
      },
      "packages": {
        "ui": ["ui"],
        "db": ["database"],
        "infra": ["runtime"]
      },
      "apps": ["runtime"]
    },
    "policy": {
      "shared": {
        "denyCapabilities": ["ui", "database", "runtime"]
      }
    }
  }
}
```

<a id="5-validation-rules"></a>

## 5. 검증 규칙

- 설정된 경로는 상대 경로여야 함
- 프로젝트 모델 로드 시 `paths.domains`가 존재해야 함
- `domain.manifestFile`은 파일명이어야 함
- 공개 API 경로는 상대 경로여야 함
- 공개 API 경로에 `internal`이 노출되어서는 안 됨
- `checkBoundaries.includeExtensions`는 비어 있어서는 안 됨
- capability 이름은 비어 있어서는 안 됨
- 외부 capability 와일드카드는 끝의 단일 `*`여야 함
- 워크스페이스 capability의 패키지 키는 `paths.packages`의 직접 하위 이름이어야 함

<a id="6-workspace-import-aliases"></a>

## 6. 워크스페이스 Import 별칭

루트 `tsconfig.json`이 있으면 Boundra는 경계 해석을 위해 `compilerOptions.paths`를 읽습니다. 상대 경로로 연결된 `extends` 체인은 부모에서 자식 순서로 해석되며, 자식 별칭은 동일한 패턴의 별칭을 재정의합니다. 별칭 대상에는 이를 선언한 설정의 `baseUrl`이 적용됩니다.

루트 `package.json`이 있으면 Boundra는 표준 `imports` 필드의 로컬 문자열 매핑도 읽습니다. `"#billing": "./domains/billing/shared/public.ts"`와 같은 정확한 매핑 및 `"#domain/*": "./domains/*/shared/public.ts"`와 같은 단일 와일드카드 패턴은 BR-001부터 BR-006까지 실행하기 전에 워크스페이스 경로로 해석됩니다. 대상은 `./`로 시작하고 워크스페이스 내부에 있어야 합니다. 조건부 객체 및 배열은 Node.js 런타임에 맡기며 현재 정적 분석기는 해석하지 않습니다.

일반적인 TypeScript 설정 문법에 맞추어 각 파일을 주석과 후행 쉼표가 포함된 JSONC로 파싱합니다. 패키지 기반 `extends` 값은 Boundra가 패키지 해석 의미를 정의하기 전까지 무시합니다.

Boundra 프로젝트 모델에 영향을 미치는 것은 `compilerOptions.paths`뿐입니다. 다른 TypeScript 컴파일러 옵션은 TypeScript 툴체인이 계속 관리합니다.

별칭 해석은 아키텍처 경계를 검증하며 배포 산출물의 추적을 검증하지 않습니다. 원본 TypeScript를 직접 가리키는 별칭에는 번들러 또는 플랫폼의 포함 설정이 여전히 필요할 수 있습니다. 서버 코드에는 워크스페이스 패키지 또는 런타임에서 해석할 수 있는 빌드된 진입점을 우선 사용하고, 생성된 산출물에 대한 배포 스모크 테스트를 유지하세요.

<a id="7-not-yet-supported"></a>

## 7. 아직 지원하지 않는 항목

다음 필드는 향후 계획하거나 도입할 수 있지만 현재 CLI에서는 구현되지 않았습니다.

- `version`
- `naming`
- `rules`
- `codegen`
- `graph`
- 사용자 지정 종료 코드
- 사용자 지정 진단 메시지

<a id="8-conformance-and-drift-protection"></a>

## 8. 적합성 및 드리프트 방지

네이티브 Rust 로더와 공개 `boundra/config` TypeScript 인터페이스는 동일한 지원 설정 계약을 표현해야 합니다.

저장소는 `fixtures/config-conformance/boundra.config.json`에 전체를 대표하는 단일 설정 픽스처를 유지합니다. Rust 통합 테스트는 실제 네이티브 설정 로더를 통해 해당 픽스처를 로드하고 TypeScript 설정 테스트는 공개 작성 헬퍼를 통해 같은 픽스처를 사용합니다.

또한 `pnpm check-config-drift`는 Rust의 `Raw*Config` 필드 트리를 TypeScript의 `BoundraConfig` 인터페이스 트리와 비교합니다. 이 검사는 지원 필드의 경로와 정규화된 리프 종류(`string`, `string[]`, `record<string, string[]>`)를 비교합니다. 어느 한쪽에서 다른 쪽을 업데이트하지 않고 지원 필드를 추가하거나 제거하거나 이름을 바꾸거나 형태를 변경하면 CI가 실패합니다.

이 검사는 공개 작성 API가 CLI에서 구현하지 않는 지원을 주장하는 것을 방지하고, 네이티브 CLI가 TypeScript 사용자가 `boundra/config`를 통해 작성할 수 없는 설정을 추가하는 것을 방지합니다.
