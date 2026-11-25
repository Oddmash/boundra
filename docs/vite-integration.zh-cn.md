# Vite 集成

```ts
import react from "@vitejs/plugin-react";
import { boundra } from "boundra/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [boundra(), react()],
});
```

在开发期间，插件：

- 在浏览器覆盖层中渲染未处理的 `BoundraRuntimeError` 详情
- 显示所有标准化验证问题，包括契约、阶段、代码和字段路径
- 在启动时和源码更新后执行边界检查
- 显示所有边界违规，包括文件/行号和 import
- 复制可安全用于问题报告的文本摘要，不包含输入、结果或 cause 值
- 保持运行时状态与边界状态相互独立，以便干净的边界扫描不会隐藏仍存在的运行时错误
- 响应 TypeScript、JavaScript 和 Svelte 源码更新
- 自动清除已解决的边界诊断；运行时诊断可通过关闭按钮或 `Escape` 关闭
- 无法运行检查时，不会清除遮罩层，而是显示 CLI/项目错误，包括结构化诊断代码和恢复建议。

生产构建不会注入覆盖层。仅在受控开发环境或测试中，在无法通过 npm 启动器解析原生 CLI 时使用 `cliPath`。

渲染器本身与框架无关，位于 `boundra/ui`。关于已处理错误和 Next.js 集成，请参阅 [`error-view.md`](./error-view.md)。
