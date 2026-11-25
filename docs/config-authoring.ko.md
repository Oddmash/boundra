<a id="config-authoring"></a>

# 설정 작성

Boundra는 현재 지원하는 설정 계약을 npm 하위 경로 `boundra/config`를 통해 노출합니다.

```ts
import { defineConfig, type BoundraConfig } from "boundra/config";

const config = defineConfig({
  paths: {
    apps: "apps",
    domains: "domains",
    packages: "packages",
    crates: "crates",
  },
  checkBoundaries: {
    capabilities: {
      external: {
        react: ["ui"],
        "@prisma/client": ["database"],
        "node:*": ["runtime"],
      },
      packages: {
        ui: ["ui"],
        db: ["database"],
        infra: ["runtime"],
      },
      apps: ["runtime"],
    },
    policy: {
      shared: {
        denyCapabilities: ["ui", "database", "runtime"],
      },
    },
  },
});

const typedConfig: BoundraConfig = config;
```

`defineConfig()`는 의도적으로 항등 헬퍼입니다. 리터럴 추론을 보존하고 공개 TypeScript 계약에 대해 객체를 검사합니다. 상대 경로, 도메인 루트 존재 여부, 공개 API 경로, capability 매처 규칙 등 파일 시스템을 고려해야 하는 검증은 네이티브 CLI의 책임으로 남습니다.

<a id="canonical-config-file"></a>

## 표준 설정 파일

네이티브 CLI는 계속해서 아래 파일만 탐색합니다.

```txt
boundra.config.json
```

현재 단계에서 `boundra.config.ts`는 지원하는 프로젝트 진입점이 아닙니다. 설정을 로드하기 위한 목적으로 Rust CLI가 JavaScript 또는 TypeScript를 실행하도록 하지 않습니다. 그렇게 하면 네이티브 CLI의 동작이 추가 런타임에 의존하게 되기 때문입니다.

`boundra/config` 인터페이스는 프레임워크 어댑터, 편집기 도구, 설정 생성기, 테스트 및 스키마를 중복 정의하지 않고 Boundra 설정값을 구성하거나 공유해야 하는 기타 TypeScript 코드를 위한 것입니다.

<a id="supported-typescript-fields"></a>

## 지원하는 TypeScript 필드

공개 타입 인터페이스는 현재 Rust 프로젝트 모델이 사용하는 필드를 그대로 반영합니다.

- `project.workspaceRoot`
- `paths.apps`
- `paths.domains`
- `paths.packages`
- `paths.crates`
- `domain.manifestFile`
- `domain.publicApi.client`
- `domain.publicApi.server`
- `domain.publicApi.shared`
- `checkBoundaries.includeExtensions`
- `checkBoundaries.ignore`
- `checkBoundaries.capabilities.external`
- `checkBoundaries.capabilities.packages`
- `checkBoundaries.capabilities.apps`
- `checkBoundaries.policy.shared.denyCapabilities`

향후 계획된 설정 필드는 CLI에서 사용하기 전까지 의도적으로 `BoundraConfig`에 포함하지 않습니다. 이를 통해 Boundra에서 조용히 무시할 설정을 TypeScript가 허용하는 일을 방지합니다.

기본값 및 네이티브 검증 규칙은 `docs/config-spec.md`를 참조하세요.
