<a id="error-view"></a>

# 오류 뷰

Boundra는 `boundra/ui`에서 프레임워크 중립적인 브라우저 오류 뷰를 제공합니다. 정규화된 진단만 렌더링하며 계약 입력, 결과, 스키마 제공자 오류 또는 cause를 읽지 않습니다.

## Vite

Vite 애플리케이션에는 일반적으로 플러그인만 필요합니다.

```ts
import { boundra } from "boundra/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [boundra()],
});
```

`vite serve` 중 Boundra는 뷰를 설치하고 처리되지 않은 `BoundraRuntimeError` 값을 캡처하며 CLI의 경계 진단을 공개합니다. 프로덕션 빌드에는 삽입되지 않습니다.

<a id="nextjs-and-other-browser-hosts"></a>

## Next.js 및 기타 브라우저 호스트

Next.js는 Vite 플러그인을 실행하지 않습니다. 클라이언트 컴포넌트에서 뷰를 설치하고 정규화된 Boundra 오류를 명시적으로 전달합니다.

```tsx
"use client";

import { useEffect } from "react";
import { createBoundraErrorView } from "boundra/ui";
import type { BoundraRuntimeErrorJson } from "boundra";

export const BoundraErrorView = ({
  error,
}: {
  error?: BoundraRuntimeErrorJson;
}) => {
  useEffect(() => {
    if (!error || process.env.NODE_ENV === "production") return;

    const view = createBoundraErrorView();
    view.reportRuntime(error);
    return () => view.dispose();
  }, [error]);

  return null;
};
```

서버/클라이언트 경계를 넘기 전에 `error.toJSON()`을 사용합니다. 원래 오류, cause, 요청, 응답, 입력 또는 결과를 브라우저로 보내지 마세요.

<a id="handled-browser-errors"></a>

## 처리된 브라우저 오류

처리되지 않은 브라우저 오류는 Vite 어댑터에서만 자동으로 캡처됩니다. 처리된 오류의 경우 뷰 인스턴스를 하나 유지하고 직접 보고합니다.

```ts
import { BoundraRuntimeError } from "boundra";
import { createBoundraErrorView } from "boundra/ui";

const view = createBoundraErrorView();

try {
  await loadProjects();
} catch (error) {
  if (error instanceof BoundraRuntimeError) {
    view.reportRuntime(error.toJSON());
  }
}
```

반환된 컨트롤러는 다음을 지원합니다.

- `reportRuntime(error)`: 런타임 진단 교체
- `reportBoundary(payload)`: 경계 진단 교체
- `clear("runtime" | "boundary")`: 한 종류의 진단 지우기
- `dispose()`: 뷰 제거 및 이벤트 핸들러 해제

경계 진단에서 편집기로 이동하는 기능은 선택 사항입니다. Vite가 자동으로 설정하며 다른 호스트는 뷰 생성 시 `openInEditor(location)`을 전달할 수 있습니다.
