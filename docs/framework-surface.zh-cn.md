# 框架接口

## 1. 目的

Boundra 不应只停留在边界检查器。下一层是面向 TypeScript 的小型框架接口，让真实应用能够使用 Boundra 生成的契约，而不替换 Next.js、打包工具、ORM、UI 框架或测试运行器。

本文定义下一阶段的语言职责划分。

## 2. 语言职责

### Rust 引擎

Rust 继续负责确定性的工具工作：

- 加载项目与领域 manifest
- import 扫描与边界分析
- 规则诊断
- 依赖图生成
- CLI 编排
- 代码生成文件写入

Rust 应保持严格、高速、可预期。

### TypeScript 接口

TypeScript 应负责面向应用的 API：

- 生成契约类型
- route/query/mutation 适配器
- client/server 辅助函数
- 面向应用的框架集成辅助函数
- 与框架无关的开发者诊断渲染
- 面向开发者的 package 入口

应用代码直接 import 的任何内容都应位于 TypeScript 层。

### 扩展 DSL

以后可以引入扩展 DSL，但不应在真实项目自用验证之前引入。

优先顺序：

1. TypeScript 框架接口
2. 基于 Schema 的代码生成模板
3. 自用项目反馈
4. Starlark 策略/代码生成 hooks
5. 可选的 Lua 本地自动化 hooks

## 3. Starlark 与 Lua 的决策

Boundra 的核心可扩展性应优先选择 Starlark 而非 Lua。

原因：

- Starlark 具有确定性，并面向策略。
- 相比不受限的脚本，它更适合规则/配置/代码生成自定义。
- 它符合 Boundra 的“安全约束优先于自由”原则。
- 避免过早将项目策略变成任意本地脚本。

Lua 仍可作为以后本地自动化或 AI/MCP 脚本的候选，但不用于核心策略。

## 4. 首个 TypeScript Package

首个面向 TypeScript 的 package 应有意保持小巧。

候选 package：

```txt
packages/
  runtime/
    src/
      types.ts
      index.ts
```

初始职责：

- 为生成契约暴露基于 Schema 的辅助类型
- 定义 route/query/mutation 契约与实现结构
- 验证契约输入和结果值
- 提供与框架无关的客户端/传输边界
- 避免特定框架的运行时行为
- 避免依赖 React、Next.js、数据库客户端或服务端运行时

浏览器错误界面遵循相同规则：`packages/ui` 负责 DOM 渲染，Vite 与宿主应用负责错误捕获和生命周期集成。它通过 `boundra/ui` 分发，而非第二个 npm 包。

非目标：

- 无 HTTP 服务端
- 不替代路由器
- 尚无内置 fetch 传输
- 尚无 React Hooks 运行时
- 无 ORM 集成

## 5. 生成代码方向

生成文件使用由运行时支持的 Schema 结构。

示例方向：

```ts
import { defineRoute, type InferSchema } from "boundra";
import { z } from "zod";

export const createInvoiceInputSchema = z.object({});
export const createInvoiceResultSchema = z.object({});

export type CreateInvoiceInput = InferSchema<typeof createInvoiceInputSchema>;
export type CreateInvoiceResult = InferSchema<typeof createInvoiceResultSchema>;

export const createInvoiceRoute = defineRoute({
  name: "create-invoice",
  input: createInvoiceInputSchema,
  result: createInvoiceResultSchema,
});
```

Zod 用于编写 Schema，运行时只依赖结构化的 `parse` 契约。参阅 `docs/contract-schema-spec.md` 和 ADR 0002。

## 6. 自用验证规则

在 Boundra 至少用于一个真实内部项目流程之前，不添加 Starlark、Lua 或 WASM 插件运行时。

首个验证目标已完成：

- 创建至少两个领域
- 生成至少一个 route、query 和 mutation
- 将生成的契约连接到应用 package 或应用目录
- 在日常开发中运行 `check-boundaries` 与 `graph-domains`
- 在添加扩展脚本之前记录缺失的 API

已提交的 `examples/order-billing` 流程现已涵盖这些要点，并由 `pnpm verify-example` 验证。它暴露了占位契约类型、手动依赖声明以及缺少公开 export 生成等下一步设计输入。

这些输入由 ADR 0002、基于 Schema 的生成契约、与框架无关的 client/server 运行时、`add-dependency` 和生成共享公开 export 解决。

## 7. 首个实现范围

状态：完成。

首个代码实现范围为：

1. 添加 `packages/runtime`
2. 定义纯 TypeScript 辅助类型
3. 更新生成的 route/query/mutation 模板，使其 import 这些辅助类型
4. 添加小型测试样例，验证生成文件使用运行时接口

这样可以让下一步保持务实，而不提前引入插件语言。
