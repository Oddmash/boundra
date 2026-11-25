# 架构

## 1. 工作区布局

```txt
apps/
  web/
  admin/

examples/
  order-billing/
    domains/
    src/

domains/
  [<group>/...]
    <domain>/
      domain.json
      client/
      server/
      shared/
      mcp/
      tests/

packages/
  runtime/
  ui/
  infra/
  config/
  tooling/

crates/
  core/
  parser/
  rules/
  cli/
```

`apps/` 包含由仓库管理的可部署产品入口。`examples/` 包含独立的学习与框架验证项目。示例必须保有自己的 Boundra 配置、TypeScript 配置和领域，以便使用显式的 `--root` 检查示例，而非将框架仓库本身视为应用。

领域 manifest 会在 `paths.domains` 下递归查找。可选的分组目录用于组织文件系统，但不构成领域身份；manifest 的 `name` 始终是稳定的身份标识。参阅 ADR 0011。

## 2. 领域分层

- `client/`：UI、Hooks、浏览器端编排
- `server/`：API 处理器、业务规则、数据编排
- `shared/`：Schema、DTO、契约、纯工具函数
- `mcp/`：AI 适配器层（tool/resource/prompt）
- `tests/`：领域测试（单元测试/集成测试）

## 3. 依赖方向

允许：
- `client -> shared`
- `server -> shared`
- `domain -> other-domain public API`
- `domain -> declared dependency public API`

禁止：
- `client -> server`
- `server -> client`
- `shared -> policy-denied capability`（默认 `ui`、`database`、`runtime`）
- `domain -> other-domain internal path`
- `domain -> undeclared domain public API`
- 循环领域依赖图

## 4. 运行时与工具

- 用户层：TypeScript
- 核心引擎：Rust
- 桥接：NAPI-RS（未来候选方案）
- 构建/分析：优先使用 Rust 分析器 CLI，后续再集成 TypeScript 构建
- Monorepo：pnpm（初期），可选择引入 Nx
- 框架接口：遵循 `docs/framework-surface.md`。

## 5. 核心 Crate 的职责

- `core`：项目配置、领域 manifest、共享诊断/领域类型
- `parser`：工作区文件扫描和 import 提取
- `rules`：边界验证
- `cli`：命令解析、执行、图生成及代码生成

## 6. Package 的职责

- `packages/runtime`：供生成契约使用的纯 TypeScript 辅助类型
- `packages/ui`：框架无关的浏览器端 Boundra 标准化诊断渲染；通过唯一的 `boundra/ui` npm 子路径发布
- `packages/config`：当前受支持的 Boundra 项目配置 TypeScript 编写类型；通过 `boundra/config` 发布，原生配置发现仍使用 `boundra.config.json`

## 7. 扩展策略

MCP 将于 v3 后在 `domains/<domain>/mcp` 中扩展，并与核心逻辑分离。

扩展 DSL 将在实际自用验证后评估。核心扩展优先考虑 Starlark 而不是 Lua。
