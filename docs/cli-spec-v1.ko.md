<a id="cli-spec-v1"></a>

# CLI 명세 v1

<a id="1-commands"></a>

## 1. 명령

전역 정보 플래그:

- `--help`, `-h`
- `--version`, `-V`

### 1.0 `init`

애플리케이션 파일을 덮어쓰지 않고 Boundra 워크스페이스를 초기화합니다.

생성 대상:
- `boundra.config.json`
- 설정된 `apps/` 및 `domains/` 디렉터리

옵션:
- `--root <path>` (기본값: `.`)
- `--name <kebab-case>` (기본값: 루트 디렉터리명)

동작:
- 기존 `boundra.config.json`이 있으면 `PROJECT-003`으로 실패
- 기존 디렉터리 보존
- 생성된 설정은 즉시 `check-boundaries`에서 허용

### 1.1 `create-domain <name>`

도메인 스캐폴드를 생성합니다.

입력 규칙:
- `<name>`은 `kebab-case`여야 합니다.

생성 대상:
- `<paths.domains>/[<parent-path>/]<name>/client/`
- `<paths.domains>/[<parent-path>/]<name>/server/`
- `<paths.domains>/[<parent-path>/]<name>/shared/`
- `<paths.domains>/[<parent-path>/]<name>/mcp/`
- `<paths.domains>/[<parent-path>/]<name>/tests/`
- `<paths.domains>/[<parent-path>/]<name>/<domain.manifestFile>`

옵션:
- `--root <path>` (기본값: `.`)
- `--path <parent-path>` (기본값: 빈 값, `paths.domains`를 기준으로 상대 경로)

`--path`는 하나 이상의 kebab-case 디렉터리 세그먼트를 허용합니다. 예: `create-domain order --path commerce/core`. 절대 경로, `.` 및 `..` 세그먼트, 다른 루트에 이미 존재하는 도메인명은 거부합니다.

### 1.2 `check-boundaries`

Import를 분석하고 경계 규칙 위반을 감지합니다.

해석에 사용하는 입력:

- 상대 경로 및 워크스페이스 기준 상대 경로 import
- 루트/상대 경로 extends `tsconfig.json`의 `compilerOptions.paths`
- 루트 `package.json#imports`의 로컬 문자열 매핑(하나의 `*` 패턴 포함)

패키지 import 별칭을 해석하면 해당 별칭을 통한 기존 경계 규칙도 확인할 수 있습니다. 배포 플랫폼이 서버 산출물에 대상 소스 파일을 포함한다는 보장은 아닙니다.

옵션:
- `--root <path>` (기본값: `.`)
- `--format text|json` (기본값: `text`)
- `--min-domains <positive integer>` (선택 사항, `--min-domains=<n>`도 허용)

스캔 범위 보고:
- `paths.domains`는 `paths.apps`와 독립적으로 분석됩니다.
- 도메인은 설정된 매니페스트 파일명을 기준으로 재귀적으로 탐색됩니다.
- JSON 메타데이터에는 `scanned_file_count` 및 `analyzed_domain_count`가 포함됩니다. `analyzed_domain_count`는 매니페스트만 로드된 도메인이 아니라 설정된 스캔에 포함된 소스 파일이 하나 이상 존재하는 고유 도메인의 개수를 셉니다.
- 텍스트 출력은 분석된 소스 파일 또는 도메인이 없는 경우 경고합니다.
- `--min-domains`가 설정되어 있고 스캔에 위반사항이 없으나 요청한 도메인 수보다 적으면 명령은 `COVERAGE-001`과 종료 코드 2를 반환합니다. JSON은 기존의 구조화된 오류 형식을 사용하며 컨텍스트에 실제 및 예상 스캔 범위의 수치를 포함합니다. 위반사항이 있으면 위반사항의 우선순위가 유지되고 종료 코드는 1입니다. 옵션이 없으면 기존 동작 및 출력이 유지됩니다.

### 1.3 `graph-domains`

도메인 매니페스트에서 도메인 의존성 그래프를 생성합니다.

옵션:
- `--root <path>` (기본값: `.`)
- `--format mermaid|json|dot` (기본값: `mermaid`)
- `--output <path>`

### 1.4 `generate route <domain>/<name>`
### 1.5 `generate query <domain>/<name>`
### 1.6 `generate mutation <domain>/<name>`

계약 중심 템플릿 파일을 생성합니다.

입력 규칙:
- `<domain>` 및 `<name>`은 `kebab-case`여야 합니다.
- `<domain>`은 이미 존재해야 합니다.

옵션:
- `--root <path>` (기본값: `.`)

부수 효과:
- 생성된 공유 계약 파일은 탐색된 도메인 매니페스트의 `publicApi.shared`에 추가됩니다.
- 생성된 공유 계약은 탐색된 도메인 루트의 `shared/public.ts`에서 export됩니다.
- 생성된 query 및 mutation 어댑터는 탐색된 도메인 루트의 `client/public.ts`에서 멱등적으로 export됩니다.
- 공개 API 업데이트에 실패하면 생성 파일, 매니페스트 및 공개 배럴 파일을 복원하므로 재시도 시 부분적으로 생성된 산출물과 충돌하지 않습니다.
- 기존 `publicApi.shared` 항목을 보존하며 중복된 항목은 추가하지 않습니다.
- 생성된 계약에는 입력/결과 스키마와 추론된 타입이 포함됩니다.
- 생성된 route 파일은 검증된 서버 구현을 연결합니다.
- 생성된 query/mutation 파일은 프레임워크 중립적인 비동기 클라이언트 함수를 노출합니다.

### 1.7 `add-dependency <domain>/<dependency>`

한 도메인이 다른 도메인에 의존함을 선언합니다.

입력 규칙:
- 두 이름 모두 `kebab-case`여야 함
- 두 도메인 모두 이미 존재해야 함
- 도메인은 자신에게 의존할 수 없음

옵션:
- `--root <path>` (기본값: `.`)

부수 효과:
- 탐색된 `<domain>` 매니페스트의 `dependsOn`에 `<dependency>` 추가
- 기존 의존성 보존
- 중복된 항목을 추가하지 않음

### 1.8 `generate resource <domain>/<name>`

계약만 포함하는 CRUD 리소스 스캐폴드를 생성합니다.

생성 대상:
- `domains/<domain>/shared/contracts/<name>.ts`
- `domains/<domain>/client/resources/<name>.ts`

공유 파일은 list/create/update/delete 스키마 및 계약을 소유합니다. 클라이언트 파일은 타입이 지정된 함수를 노출하고 `client/public.ts`에서 멱등적으로 export됩니다. Boundra는 영속성, HTTP 라우트, UI 또는 ORM 코드를 생성하지 않습니다.

<a id="2-cli-ux-principles"></a>

## 2. CLI UX 원칙

- 경계 진단에는 규칙 코드, 파일, 줄 번호, import, 메시지 및 제안이 포함됩니다.
- 스캐폴딩에 성공하면 요약 한 줄과 생성 경로가 출력됩니다.
- JSON 출력은 CI 및 AI 파싱을 위해 안정적인 스키마를 유지합니다.
- CLI 실패에는 안정적인 코드, 컨텍스트 및 실행 가능한 제안이 포함됩니다.
- JSON을 요청한 경우 프로젝트/설정 실패를 JSON으로 출력합니다.

<a id="3-machine-readable-output-json"></a>

## 3. 기계 판독 가능 출력 (JSON)

```json
{
  "status": "failed",
  "violations": [
    {
      "rule": "BR-001",
      "file": "domains/order/client/use-order.ts",
      "line": 12,
      "import": "domains/order/server/order-service",
      "message": "client layer cannot import server layer",
      "suggestion": "move shared contract to shared layer or call through an API boundary"
    }
  ],
  "meta": {
    "command": "check-boundaries",
    "violation_count": 1,
    "scanned_file_count": 24,
    "analyzed_domain_count": 2
  }
}
```
