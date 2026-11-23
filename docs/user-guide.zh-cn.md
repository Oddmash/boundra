# Boundra 使用指南

[English](user-guide.md) · [한국어](user-guide.ko.md) · [日本語](user-guide.ja.md)

Boundra 将 Rust 静态架构检查 CLI 与 TypeScript Schema 契约运行时结合起来，不替代现有框架或服务器。本指南适用于公开版本 v0.6.0。

## 1. 安装

需要 Node.js 20 或更新版本以及兼容的包管理器。

```sh
pnpm add boundra zod
pnpm exec boundra --version
```

首次运行会下载匹配的原生二进制文件并验证校验和，支持 Linux x64、macOS Intel/Apple Silicon、Windows x64。离线环境可设置 `BOUNDRA_CLI_PATH`。[安装详情](cli-install.md)。

## 2. 从小范围开始

```sh
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain order
pnpm exec boundra create-domain billing --path commerce
pnpm exec boundra add-dependency billing/order
pnpm exec boundra generate query order/get-order
pnpm exec boundra generate route billing/create-invoice
pnpm exec boundra check-boundaries --format json
pnpm exec boundra graph-domains --format mermaid
```

初始化不会覆盖现有文件。每个领域有独立 manifest。client 负责 UI 和适配器，server 负责业务逻辑，shared 负责纯契约。billing → order 是显式声明的依赖，不允许循环依赖。

## 3. 边界规则

解析 `domain.json` 的 name、publicApi、dependsOn。BR-001/002 检查客户端与服务端直接依赖，BR-003 检查共享层禁止的能力，BR-004/005 检查内部实现引用，BR-006 检查未声明的领域依赖。使用公开 API，删除不必要的耦合。[规则详情](boundary-rules.md)。

## 4. 实现契约

编辑生成的 `domains/order/shared/contracts/get-order.ts`：

```ts
import { defineQuery } from "boundra";
import { z } from "zod";

export const getOrderInputSchema = z.object({ orderId: z.string().min(1) });
export const getOrderResultSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["pending", "submitted"]),
});
export const getOrderQuery = defineQuery({
  name: "get-order",
  input: getOrderInputSchema,
  result: getOrderResultSchema,
});
```

保留已生成的类型导出。客户端适配器调用 `client.query`，输入不符合契约时返回 RUNTIME-001，结果不符合契约时返回 RUNTIME-002。在仓库安装依赖和 Rust 后可使用 `pnpm verify-example` 验证[实际示例](../examples/order-billing)。

## 5. HTTP 与框架集成

`createHttpTransport({ baseUrl: "/api/boundra" })` 通过 POST `/api/boundra/contracts/<name>` 发送请求，服务器返回 `{ "result": ... }`。路由、认证授权、持久化由宿主应用负责。传输错误为 RUNTIME-003，主动取消保留原始异常。

Vite 使用 `boundra/vite` 插件；Next.js 保留现有 App Router，可通过 `boundra/ui` 在开发环境显式显示规范化错误。Vite 插件不会自动应用于 Next.js。

[HTTP](http-transport.md) · [Vite](vite-integration.md) · [错误界面](error-view.md) · [配置](config-spec.md)

## 6. CI 与排查

在现有类型检查、测试和构建之外运行边界检查。退出码 0 表示成功，1 表示违规，2 表示配置或用法错误，3 表示执行错误。空扫描也可能成功，因此应根据实际项目验证 JSON 中 scanned_file_count 和 analyzed_domain_count 的预期范围。

领域未找到时检查根目录与 manifest 名；空结果检查 paths 和 ignore；HTTP 错误检查端点与响应结构。当前不解析条件 package imports 或基于包的 tsconfig extends。

## 7. 是否采用

如果 ESLint 或 Nx 已充分解决当前问题，无需重复引入 Boundra。它是开发阶段的架构约束工具，不是运行时安全边界。先在小范围比较并衡量维护成本。[比较与限制](product-positioning.md) · [完整指南](user-guide.md)。
