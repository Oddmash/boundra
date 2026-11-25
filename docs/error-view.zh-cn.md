# 错误界面

Boundra 通过 `boundra/ui` 提供一个与框架无关的浏览器错误界面。它仅渲染标准化诊断，绝不读取契约输入、结果、Schema 提供者错误或 cause。

## Vite

Vite 应用通常只需要插件：

```ts
import { boundra } from "boundra/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [boundra()],
});
```

在 `vite serve` 期间，Boundra 安装界面、捕获未处理的 `BoundraRuntimeError` 值，并发布来自 CLI 的边界诊断。生产构建不会注入它。

## Next.js 和其他浏览器宿主

Next.js 不会运行 Vite 插件。请通过 Client Component 安装界面，并显式转发标准化的 Boundra 错误：

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

跨越服务端/客户端边界前使用 `error.toJSON()`。不要向浏览器发送原始错误、cause、请求、响应、输入或结果。

## 已处理的浏览器错误

仅 Vite 适配器会自动捕获未处理的浏览器错误。对于已处理的错误，请保留一个界面实例并直接报告该错误：

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

返回的控制器支持：

- `reportRuntime(error)`：替换运行时诊断
- `reportBoundary(payload)`：替换边界诊断
- `clear("runtime" | "boundary")`：清除一个来源
- `dispose()`：移除界面并释放事件处理器

边界编辑器导航为可选功能。Vite 自动配置此功能；其他宿主可以在创建界面时传入 `openInEditor(location)`。
