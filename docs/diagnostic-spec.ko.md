<a id="diagnostic-spec"></a>

# 진단 명세

<a id="1-goal"></a>

## 1. 목표

모든 CLI 실패는 다음 네 가지 질문에 답할 수 있어야 합니다.

1. 무엇이 실패했나요?
2. 어느 위치 또는 리소스에서 실패했나요?
3. 왜 실패했나요?
4. 사용자는 다음에 무엇을 해야 하나요?

<a id="2-text-shape"></a>

## 2. 텍스트 구조

```txt
[ERROR] DOMAIN-001
message: unknown domain 'payment'
domain: payment
available: billing, order
suggestion: run 'boundra create-domain payment' or choose an existing domain
```

필드:

- 안정적인 진단 코드
- 간결한 메시지
- 0개 이상의 컨텍스트 필드
- 실행 가능한 제안

경계 위반은 기존 `BR-*` 텍스트 구조를 유지하며 추가로 같은 메시지/컨텍스트/제안 원칙을 따릅니다.

<a id="3-json-shape"></a>

## 3. JSON 구조

JSON 출력을 요청한 경우 실패도 기계 판독이 가능해야 합니다.

```json
{
  "status": "error",
  "errors": [
    {
      "code": "DOMAIN-001",
      "message": "unknown domain 'payment'",
      "context": {
        "domain": "payment",
        "available": "billing, order"
      },
      "suggestion": "run 'boundra create-domain payment' or choose an existing domain"
    }
  ],
  "meta": {
    "command": "generate"
  }
}
```

성공한 `check-boundaries` JSON 및 위반 필드는 이전 버전과 호환됩니다. `meta` 객체 역시 `scanned_file_count` 및 `analyzed_domain_count`를 보고하므로 CI가 정상 스캔과 빈 스캔을 구별할 수 있습니다. 도메인 수에는 `paths.domains` 아래에 스캔된 소스 파일이 하나 이상 존재하는 고유 도메인만 포함됩니다. 무시되었거나 존재하지 않는 도메인 소스는 집계하지 않습니다. 텍스트 출력은 두 수치 중 하나가 0일 때 경고를 출력합니다. 수치가 0이라는 이유만으로 명령 종료 코드가 변경되지는 않습니다.

<a id="4-code-families"></a>

## 4. 코드 분류

- `CLI-*`: 명령 문법 및 옵션 오류
- `PROJECT-*`: 설정, 매니페스트 및 프로젝트 로드 오류
- `DOMAIN-*`: 도메인 생성 및 조회 오류
- `DEPENDENCY-*`: 도메인 의존성 워크플로우 오류
- `GEN-*`: 생성 산출물 및 공개 API 업데이트 오류
- `RUNTIME-*`: TypeScript 계약 실행 오류
- `COVERAGE-001`: 설정된 `--min-domains` 임계값을 충족하지 못했으며, 컨텍스트에는 `minimum_domain_count`, `analyzed_domain_count`, `scanned_file_count`가 포함됨

<a id="5-runtime-validation-issues"></a>

## 5. 런타임 검증 오류

`BoundraRuntimeError`는 프레임워크 어댑터와 개발 오버레이가 특정 스키마 제공자에 의존하지 않도록 정규화된 `issues`를 제공합니다.

```json
{
  "name": "BoundraRuntimeError",
  "code": "RUNTIME-001",
  "contract": "create-task",
  "phase": "input",
  "message": "contract 'create-task' rejected input at 'title': 제목은 두 글자 이상 입력해 주세요.",
  "suggestion": "fix input field 'title': 제목은 두 글자 이상 입력해 주세요.",
  "issues": [
    {
      "code": "too_small",
      "path": ["title"],
      "message": "제목은 두 글자 이상 입력해 주세요."
    }
  ]
}
```

규칙:

- `issues`는 항상 배열이며 검증 오류가 없으면 빈 배열입니다.
- 오류 항목은 `code`, `path`, `message`만 안정적으로 노출합니다.
- 입력 원문이나 스키마 제공자의 전체 오류 객체는 직렬화하지 않습니다.
- `toJSON()`은 위 구조를 반환하고 내부 `cause`를 제외합니다.
- 런타임 패키지는 Zod에 직접 의존하지 않고 구조적으로 호환되는 오류 항목을 정규화합니다.

<a id="5-exit-codes"></a>

## 5. 종료 코드

- `0`: 성공
- `1`: 경계 위반
- `2`: 사용법, 설정, 매니페스트 또는 리소스 검증 오류
- `3`: 예상하지 못한 I/O 또는 내부 실행 오류
