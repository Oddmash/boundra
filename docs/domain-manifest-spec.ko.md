<a id="domain-manifest-spec"></a>

# 도메인 매니페스트 명세

<a id="1-file-location"></a>

## 1. 파일 위치

```txt
<configured-domains-path>/[<group>/]<domain>/<configured-manifest-file>
```

Boundra는 `paths.domains` 아래에서 설정된 매니페스트 파일명을 재귀적으로 탐색합니다. 매니페스트의 상위 디렉터리는 물리적인 도메인 루트가 되고, `name`은 안정적인 논리적 식별자가 됩니다.

<a id="2-purpose"></a>

## 2. 목적

`domain.json`은 도메인의 공개 API와 선언된 도메인 의존성의 기준 정보입니다.

다음에서 사용됩니다.

- `check-boundaries`
- `graph-domains`
- `generate route|query|mutation`
- `add-dependency`
- BR-004 공개 API 검증
- BR-006 선언된 의존성 검증

<a id="3-schema-shape"></a>

## 3. 스키마 구조

```json
{
  "$schema": "https://boundra.dev/schemas/domain-manifest.v1.json",
  "name": "billing",
  "version": "0.1.0",
  "publicApi": {
    "client": ["./client/public.ts"],
    "server": ["./server/public.ts"],
    "shared": [
      "./shared/public.ts",
      "./shared/contracts/create-invoice.ts"
    ]
  },
  "dependsOn": ["order"],
  "policies": {
    "allowCrossDomainServerImport": false,
    "allowMcpWrite": false
  }
}
```

<a id="4-currently-loaded-fields"></a>

## 4. 현재 로드하는 필드

현재 CLI는 다음 필드를 로드하고 검증합니다.

- `name`
- `publicApi.client`
- `publicApi.server`
- `publicApi.shared`
- `dependsOn`

다른 필드도 존재할 수 있으며 가능한 한 보존하지만 아직 강제하지는 않습니다.

<a id="5-validation-rules"></a>

## 5. 검증 규칙

- `name`은 도메인 폴더명과 일치해야 합니다.
- 서로 다른 루트에서 `name` 값이 중복되면 유효하지 않습니다.
- `dependsOn` 항목은 기존 도메인을 참조해야 합니다.
- `dependsOn`은 비순환 그래프를 형성해야 합니다.
- 공개 API 경로는 상대 경로여야 합니다.
- 공개 API 경로는 기존 파일을 가리켜야 합니다.
- 공개 API 경로에 `internal` 경로가 노출되어서는 안 됩니다.
- 설정된 매니페스트 파일이 없는 디렉터리는 정리 목적으로만 사용되며 도메인으로 로드되지 않습니다.

<a id="6-code-generation-behavior"></a>

## 6. 코드 생성 동작

`generate route|query|mutation <domain>/<name>`은 공유 계약 파일을 생성합니다.

```txt
domains/<domain>/shared/contracts/<name>.ts
```

생성 후 CLI는 해당 계약을 다음 위치에 추가합니다.

```json
{
  "publicApi": {
    "shared": ["./shared/contracts/<name>.ts"]
  }
}
```

기존 `publicApi.shared` 항목은 보존되며 중복된 항목은 추가되지 않습니다.

생성 과정에서는 `shared/public.ts`에도 멱등적인 export를 추가합니다.

<a id="7-compact-single-layer-domains"></a>

## 7. 간결한 단일 계층 도메인

비어 있지 않은 공개 API 분류가 정확히 하나인 도메인은 구현 파일을 도메인 루트에 직접 둘 수 있습니다.

```txt
domains/comparison/
├── domain.json
├── public.ts
├── storage.ts
└── tests/
    └── storage.spec.ts
```

```json
{
  "publicApi": {
    "client": ["./public.ts"],
    "server": [],
    "shared": []
  }
}
```

루트에 직접 존재하는 파일은 경계 검증에서 해당 단일 계층을 상속합니다. 명시적인 계층 디렉터리는 기존 의미를 유지하며, 루트에 중첩된 디렉터리는 간결한 구조의 계층을 상속하지 않습니다. 두 개 이상의 공개 API 분류를 노출하는 도메인은 명시적인 계층 디렉터리를 사용해야 합니다.

<a id="8-dependency-update-behavior"></a>

## 8. 의존성 업데이트 동작

`add-dependency <domain>/<dependency>`는 `dependsOn`에 의존성을 추가합니다. 두 도메인이 존재해야 하며, 자기 자신에 대한 의존성은 거부되고 반복 호출 시 중복 항목을 추가하지 않습니다. 의존성 순환을 생성할 수 있는 간선은 매니페스트를 변경하지 않고 거부됩니다.

<a id="9-versioning"></a>

## 9. 버전 관리

초기 스키마 버전:

```txt
v1
```

스키마 변경은 추가적인 변경을 우선해야 합니다. 호환성을 깨뜨리는 변경에는 ADR이 필요합니다.
