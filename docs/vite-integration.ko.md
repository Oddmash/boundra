<a id="vite-integration"></a>

# Vite 통합

```ts
import react from "@vitejs/plugin-react";
import { boundra } from "boundra/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [boundra(), react()],
});
```

개발 중 플러그인은 다음과 같이 동작합니다.

- 처리되지 않은 `BoundraRuntimeError` 세부 정보를 브라우저 오버레이에 렌더링
- 계약, 단계, 코드, 필드 경로와 함께 정규화된 모든 검증 오류를 표시
- 시작 시 및 소스 업데이트 후 경계 검사를 실행
- 모든 경계 위반을 파일/줄 위치 및 import와 함께 표시
- 입력, 결과 또는 cause 값을 포함하지 않는 안전한 텍스트 요약을 이슈 보고용으로 복사
- 정상적인 경계 스캔이 활성 런타임 오류를 숨기지 않도록 런타임 및 경계 상태를 독립적으로 유지
- TypeScript, JavaScript 및 Svelte 소스 업데이트에 대응
- 해결된 경계 진단을 자동으로 지우며 런타임 진단은 닫기 버튼 또는 `Escape`로 해제 가능

프로덕션 빌드에는 오버레이를 삽입하지 않습니다. npm 실행기를 통해 네이티브 CLI가 해석되지 않는 통제된 개발 또는 테스트 환경에서만 `cliPath`를 사용하세요.

렌더러 자체는 프레임워크 중립적이며 `boundra/ui`에 있습니다. 처리된 오류 및 Next.js 통합에 대해서는 [`error-view.md`](./error-view.md)를 참조하세요.
