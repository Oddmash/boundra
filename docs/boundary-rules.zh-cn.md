# 边界规则

`<discovered-domain-root>` 指递归查找到的领域 manifest 的父目录。它可以嵌套在 `paths.domains` 下。

## 1. 规则集（硬性约束）

### BR-001：禁止客户端引用服务端
- 规则：禁止已发现领域的 `client/**` import 同一或其他已发现领域的 `server/**`
- 原因：隔离部署边界和执行环境

### BR-002：禁止服务端引用客户端
- 规则：禁止已发现领域的 `server/**` import 同一或其他已发现领域的 `client/**`
- 原因：防止层级依赖倒置

### BR-003：共享层纯净性
- 规则：`<discovered-domain-root>/shared/**` 禁止依赖共享层策略拒绝的 capability
- 默认禁止的 capability：`ui`、`database`、`runtime`
- 默认分类保留对 React/Next、Prisma、Node runtime、`packages/ui`、`packages/db`、`packages/infra` 和 app 路径的既有行为
- 在 `checkBoundaries.capabilities` 中将依赖分类为 capability，并在 `checkBoundaries.policy.shared.denyCapabilities` 中设置拒绝策略。
- 允许：capability 未被拒绝的纯契约/Schema 依赖
- 原因：根据项目技术栈约束契约层的纯净性

### BR-004：跨领域访问策略
- 规则：禁止直接 import 跨领域内部路径
- 允许：仅允许 `<other-discovered-domain-root>/shared/public` 或明确声明的公开 API
- 原因：隐藏内部实现，确保变更安全性

### BR-005：应用到领域的公开 API 策略
- 规则：`apps/**` import `<discovered-domain-root>/**` 时，仅允许使用该领域 manifest 声明的公开 API
- 允许：`<discovered-domain-root>/client/public`、`server/public`、`shared/public` 或 manifest 明确声明的公开 API
- 原因：防止作为 composition root 的应用与领域内部实现耦合

### BR-006：领域依赖声明策略
- 规则：import 其他领域的公开 API 时，目标领域必须在源 manifest 的 `dependsOn` 中声明
- 允许：`dependsOn` 中声明的领域的 manifest 公开 API
- 原因：使实际代码依赖与领域关系图一致，防止隐式耦合

### BR-007：声明式领域限制

禁止解析到 `checkBoundaries.denyDomainDependencies` 所指定目标领域的 import。即使声明了公开 API 也适用，BR-001 至 BR-006 不变。默认值为空映射。

## 2. 允许列表

- `client -> shared`
- `server -> shared`
- `domain -> other-domain public API`
- `domain -> declared dependency public API`
- `app -> domain public API`

### 紧凑单层布局

如果 manifest 中恰好一个公开 API 分类非空，该领域根目录下的直接文件就被视为属于此分类对应的层。这只是布局简化方式；所有现有分层和公开 API 规则仍然适用。参阅 ADR 0009。

### 嵌套领域根目录

基于配置的 manifest 文件名，在 `paths.domains` 下任意深度查找领域根目录。BR-001 至 BR-006 使用实际发现的根目录，而不假定为 `paths.domains/<name>`。分组目录没有边界身份。参阅 ADR 0011。

## 3. 违规输出格式

CLI 在检测到违规时必须提供以下结构。

```txt
[BOUNDARY_VIOLATION] BR-001
file: domains/order/client/use-order.ts
import: domains/order/server/order-service
line: 12
message: client layer cannot import server layer.
suggestion: move contract/type to shared or call via public API.
```

## 4. 退出码

- `0`：无违规
- `1`：存在违规
- `2`：配置/manifest 解析错误
- `3`：内部执行错误

## 5. 违规示例

### 示例 A
- 来源：`domains/product/client/list.ts`
- Import：`domains/product/server/repository.ts`
- 结果：BR-001

### 示例 B
- 来源：`domains/auth/shared/types.ts`
- Import：`packages/ui/button`
- 结果：BR-003

### 示例 C
- 来源：`domains/order/server/checkout.ts`
- Import：`domains/product/server/internal/stock.ts`
- 结果：BR-004

### 示例 D
- 来源：`apps/web/src/checkout.ts`
- Import：`domains/order/server/internal/checkout.ts`
- 结果：BR-005

### 示例 E
- 来源：`domains/order/server/checkout.ts`
- Import：`domains/billing/server/public.ts`
- Manifest：`order.dependsOn` 不包含 `billing`
- 结果：BR-006
