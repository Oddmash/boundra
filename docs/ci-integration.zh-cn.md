# CI 集成

## 将 Boundra 添加到应用

使用项目包管理器安装 `boundra` 和 `zod`，初始化项目后提交配置及领域 manifest。将边界检查与已有类型检查、测试和构建一起执行。以下是使用已发布 CLI 的 pnpm 应用的最小 GitHub Actions 示例：

```yaml
name: Check boundaries

on:
  pull_request:
  push:
    branches: [main]

jobs:
  boundaries:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec boundra check-boundaries --root . --format json
```

对于 npm 项目，将最后两条命令分别替换为 `npm ci` 与 `npx boundra check-boundaries --root . --format json`。原生启动器在首次使用时获取匹配的已发布 CLI。离线或不受支持平台的要求，请参阅[安装](cli-install.md)。在已发布的 v0.6.0 中，空扫描可能在发出警告的同时通过；请检查 JSON 覆盖率计数。如果项目要求最低领域数量，请使用[使用指南](user-guide.md)中的覆盖率检查。

## Boundra 仓库验证

使用已提交的示例流程作为必要的 CI 验收门槛。该流程对 TypeScript 接口进行类型检查、执行运行时和示例流程、运行 Rust 测试、检查边界并渲染领域依赖图：

```yaml
name: Boundra

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  verify-example:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - uses: dtolnay/rust-toolchain@stable
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify-example
      - run: pnpm verify-clean-room
      - run: cargo clippy --workspace --all-targets -- -D warnings
```

## 本地验证

在本地运行相同的聚合验收流程：

```bash
pnpm verify-example
```

单独的边界命令仍适用于仅采用 Boundra 分析器的仓库。在尚未发布的 CLI 中，成熟工作区可以要求预期扫描领域的最小数量，使配置错误导致的空扫描无法静默通过：

```bash
boundra check-boundaries --format json --min-domains 2
```

将阈值设为当前采用范围内的预期数量。不使用此选项时，CLI 保留对空扫描仅发出警告的现有行为。

## 退出码

- `0`：无边界违规
- `1`：检测到边界违规
- `2`：配置、manifest 或 CLI 用法错误
- `3`：运行时扫描或文件系统错误

## JSON 输出

CI 和代理集成应优先使用 JSON 输出：

```bash
cargo run -p boundra-cli -- check-boundaries --root examples/order-billing --format json
```

示例：

```json
{
  "status": "failed",
  "violations": [
    {
      "rule": "BR-001",
      "file": "domains/order/client/use-order.ts",
      "line": 3,
      "import": "../server/order-service",
      "message": "client layer cannot import server layer",
      "suggestion": "move shared contract to shared layer or call through an API boundary"
    }
  ],
  "meta": {
    "command": "check-boundaries",
    "violation_count": 1
  }
}
```
