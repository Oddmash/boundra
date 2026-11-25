# Boundra 使用指南

<a id="boundra-user-guide"></a>

[English](user-guide.md) · [한국어](user-guide.ko.md) · [日本語](user-guide.ja.md)

Boundra 将 Rust 源代码架构检查器与不依赖特定框架的 TypeScript 契约运行时结合起来。本指南基于公开版本 v0.7.0 的行为，不要求使用新的框架、托管服务或自动生成的 API 服务器。

<a id="1-install-and-verify"></a>
<a id="1-安装"></a>

## 1. 安装与验证

使用 Node.js 20 或更新版本以及兼容的包管理器。在现有的 TypeScript 项目中：

```sh
pnpm add boundra zod
pnpm exec boundra --version
```

如果使用 npm，请执行 `npm install boundra zod` 和 `npx boundra --version`。CLI 启动器会在首次调用时下载与发布版本匹配的二进制文件并验证校验和。已发布的目标平台包括 Linux x64、macOS Intel/Apple Silicon 和 Windows x64。对于离线构建，请预先准备二进制文件，并将 `BOUNDRA_CLI_PATH` 设置为该文件的路径。请参阅 [CLI 安装](cli-install.md)。

<a id="2-adopt-one-slice-first"></a>

## 2. 从小范围开始

确保工作树干净，并保留现有的类型检查、测试和框架构建。从项目根目录执行：

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

`init` 会保留现有目录，并在已有配置文件时拒绝执行。`create-domain` 会生成各分层目录、公开入口和 manifest；所属分组目录不会改变 manifest 中的领域名称。文件生成后即由应用开发者负责编辑，重新执行生成命令并不会更新已有文件。

预期的依赖方向是 billing → order。order 不能反向依赖 billing。依赖图描述已声明的依赖关系，而不是每一次运行时调用。

| 目录 | 职责 |
| --- | --- |
| apps/ | 应用入口和组合 |
| domains/order/client/ | 客户端查询、变更和 UI 编排 |
| domains/order/server/ | 服务端处理器和业务逻辑 |
| domains/order/shared/ | 纯契约和 Schema |
| domains/commerce/billing/ | 拥有独立 manifest 的嵌套领域 |
| packages/ | 可复用的工作区包 |

<a id="3-declare-public-interfaces"></a>
<a id="3-边界规则"></a>

## 3. 声明公开接口

CLI 负责首次生成脚手架。每个领域的 manifest 声明 `name`、公开 API 的相对路径和 `dependsOn`。对于 billing，`dependsOn: ["order"]` 代表允许的依赖关系。跨领域 import 仍然需要通过公开入口并遵守分层规则。建议从 `shared/public`、`client/public` 或 `server/public` 导入，而不要绕过接口直接访问内部实现。

| 规则 | 报告该规则时应如何修改 |
| --- | --- |
| BR-001 | 将 Schema 和类型移到 shared；通过适配器调用服务端行为 |
| BR-002 | 将纯逻辑从 client 代码中移出 |
| BR-003 | 移除 shared 中的运行时、UI 或数据库依赖 |
| BR-004 | 使用目标领域已声明的公开 API |
| BR-005 | 让应用使用领域已声明的入口 |
| BR-006 | 声明有意采用的依赖关系，或移除耦合 |

只有文档中描述的 manifest 字段会被强制检查；元数据和策略占位字段不属于授权控制。请参阅 [manifest 规范](domain-manifest-spec.md) 和 [边界规则](boundary-rules.md)。

<a id="4-implement-a-real-contract"></a>
<a id="4-实现契约"></a>

## 4. 实现真实契约

编辑生成的 `domains/order/shared/contracts/get-order.ts`：

```ts
import { defineQuery, type InferSchema } from "boundra";
import { z } from "zod";

export const getOrderInputSchema = z.object({
  orderId: z.string().min(1),
});

export const getOrderResultSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["pending", "submitted"]),
});

export type GetOrderQueryInput = InferSchema<typeof getOrderInputSchema>;
export type GetOrderQueryResult = InferSchema<typeof getOrderResultSchema>;

export const getOrderQuery = defineQuery({
  name: "get-order",
  input: getOrderInputSchema,
  result: getOrderResultSchema,
});
```

生成的查询适配器会调用 `client.query(getOrderQuery, input)`，并从客户端公开入口导出。若要在不使用网络或后端的情况下体验这一行为，请在项目中使用 TypeScript 运行工具和本地类型化传输：

```ts
import { createBoundraClient, type BoundraTransport } from "boundra";
import { getOrder } from "./domains/order/client/public";

const transport: BoundraTransport = async (request) => {
  if (request.name !== "get-order") throw new Error("Unknown contract");
  const input = request.input as { orderId: string };
  return { orderId: input.orderId, status: "pending" };
};

const client = createBoundraClient(transport);
const order = await getOrder(client, { orderId: "order-001" });
console.log(order);
```

空的订单 ID 应当在调用传输之前因 RUNTIME-001 而被拒绝。无效的结果则应当因 RUNTIME-002 而被拒绝。仓库中提交的 [order-billing 示例](../examples/order-billing) 综合演示了查询、变更和路由；安装工作区依赖和 Rust 后，可在 Boundra 仓库中执行 `pnpm verify-example`。

<a id="5-connect-an-actual-backend"></a>
<a id="5-http-与框架集成"></a>

## 5. 连接真实后端

当宿主应用提供相应 API 时，请使用 `createHttpTransport({ baseUrl: "/api/boundra" })`。默认传输会向 `/api/boundra/contracts/<name>` 发送 POST 请求，携带 kind、name 和 input。服务器返回 `{ "result": ... }`。宿主应用负责路由、身份、授权、持久化和安全的错误响应；Boundra 负责校验契约。对于由服务端负责的行为，使用 `implementRoute` 与生成的路由契约组合，并在宿主适配器中使用 `executeContract`。请参阅 [HTTP 传输](http-transport.md) 和 [契约 Schema](contract-schema-spec.md)。

查询和变更支持每次调用各自的取消信号。除主动取消外，非 2xx 响应和传输错误通过 RUNTIME-003 抛出。避免直接显示原始响应主体。

<a id="6-configure-the-analyzer-and-framework"></a>

## 6. 配置分析器与框架

将 `boundra.config.json` 保留在项目根目录。将 `paths.apps`、`paths.domains` 和 `paths.packages` 设置为实际布局。CLI 会读取根级 TypeScript 路径和相对 extends，以及根级 package imports 中的简单字符串。条件 imports 和基于包的 tsconfig extends 不会被解析。边界扫描成功并不意味着打包工具的输出一定包含别名的目标。

- Vite：将来自 `boundra/vite` 的 `boundra()` 添加到现有 Vite 插件中。开发环境的覆盖层会报告运行时和边界诊断信息。[Vite 集成](vite-integration.md)。
- Next.js：保留 App Router 及其服务端和客户端规则。必要时，可以在仅用于开发环境的 Client Component 中使用 `boundra/ui` 显式报告规范化后的错误。没有自动应用的 Next.js 插件。[错误界面](error-view.md)。
- 其他宿主：独立使用 CLI，或实现兼容的传输。

在自定义文件扩展名、忽略模式或共享层能力分类之前，请阅读 [配置](config-spec.md)。

<a id="7-ci-and-review"></a>
<a id="6-ci-与排查"></a>

## 7. CI 与代码审查

在 PR 中，与编译器、测试和框架构建一起执行 `pnpm exec boundra check-boundaries --root . --format json`。退出码：0 表示无违规，1 表示违规，2 表示无效用法或配置，3 表示内部或 I/O 错误。检查 JSON 中的 `meta.scanned_file_count` 和 `meta.analyzed_domain_count`：空扫描可能返回成功并附带警告，因此成熟的工作区还需要单独验证扫描覆盖范围是否达到预期最低值。

```sh
pnpm exec boundra check-boundaries --format json > boundra-report.json
node --input-type=module -e 'import fs from "node:fs"; const r = JSON.parse(fs.readFileSync("boundra-report.json", "utf8")); if (r.status !== "passed" || !Number.isInteger(r.meta?.scanned_file_count) || r.meta.scanned_file_count < 1 || !Number.isInteger(r.meta?.analyzed_domain_count) || r.meta.analyzed_domain_count < 2) process.exit(1)'
```

根据试点范围调整预期领域数量。如果报告包含内部路径，请不要将其提交到版本控制。

<a id="8-troubleshooting"></a>

当前 CLI 可使用 `pnpm exec boundra check-boundaries --format json --min-domains 2` 直接要求至少分析两个领域。请根据项目调整阈值。

## 8. 故障排查

| 现象 | 后续操作 |
| --- | --- |
| 未找到 CLI 或平台不受支持 | 验证 Node 和目标平台；使用匹配的原生发布归档文件或受控的二进制路径 |
| 无法再次初始化 | 检查现有配置；不要仅为了重新运行 init 而删除配置 |
| 未知领域 | 检查已配置的领域根目录、manifest 文件名和逻辑名称 |
| 扫描意外显示无违规 | 检查覆盖范围计数、路径、忽略文件以及解析器支持的输入 |
| 生成的文件已经存在 | 编辑已有的应用自有代码，或改用其他契约名称 |
| HTTP 调用失败 | 检查宿主端点、响应封装格式及传输处理 |
| 在 Next.js 中看不到错误覆盖层 | 使用显式宿主集成；Vite 插件不会在 Next.js 中运行 |

<a id="9-decide-whether-to-retain-boundra"></a>
<a id="7-是否采用"></a>

## 9. 决定是否继续采用 Boundra

衡量采用成本以及具有代表性的失败场景，并与现有工具进行比较。从单个领域开始，不要立即迁移整个仓库。阅读 [产品定位](product-positioning.md)，了解替代方案、限制和证据要求。Boundra 是开发阶段的架构约束工具，而不是运行时隔离机制或生产环境的安全控制。
