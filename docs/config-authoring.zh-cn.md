# 配置编写

Boundra 通过 `boundra/config` npm 子路径暴露当前支持的配置契约。

```ts
import { defineConfig, type BoundraConfig } from "boundra/config";

const config = defineConfig({
  paths: {
    apps: "apps",
    domains: "domains",
    packages: "packages",
    crates: "crates",
  },
  checkBoundaries: {
    capabilities: {
      external: {
        react: ["ui"],
        "@prisma/client": ["database"],
        "node:*": ["runtime"],
      },
      packages: {
        ui: ["ui"],
        db: ["database"],
        infra: ["runtime"],
      },
      apps: ["runtime"],
    },
    policy: {
      shared: {
        denyCapabilities: ["ui", "database", "runtime"],
      },
    },
  },
});

const typedConfig: BoundraConfig = config;
```

`defineConfig()` 刻意采用恒等辅助函数的形式。它保留字面量推断，并依据公开的 TypeScript 契约检查对象，而依赖文件系统的验证仍由原生 CLI 负责，例如相对路径、领域根目录是否存在、公开 API 路径及 capability 匹配器规则。

## 规范配置文件

原生 CLI 仍然只查找：

```txt
boundra.config.json
```

当前范围内尚不支持以 `boundra.config.ts` 作为项目入口。Boundra 不会仅为加载配置而让 Rust CLI 执行 JavaScript 或 TypeScript，因为这会使原生 CLI 的行为依赖额外的运行时。

`boundra/config` 接口面向框架适配器、编辑器工具、配置生成器、测试与其他需要构造或共享 Boundra 配置值，而不需重复定义 Schema 的 TypeScript 代码。

## 支持的 TypeScript 字段

公开类型接口与 Rust 项目模型当前使用的字段相对应：

- `project.workspaceRoot`
- `paths.apps`
- `paths.domains`
- `paths.packages`
- `paths.crates`
- `domain.manifestFile`
- `domain.publicApi.client`
- `domain.publicApi.server`
- `domain.publicApi.shared`
- `checkBoundaries.includeExtensions`
- `checkBoundaries.ignore`
- `checkBoundaries.capabilities.external`
- `checkBoundaries.capabilities.packages`
- `checkBoundaries.capabilities.apps`
- `checkBoundaries.policy.shared.denyCapabilities`

计划中的配置字段会有意从 `BoundraConfig` 排除，直到 CLI 开始使用它们。这避免 TypeScript 接受被 Boundra 静默忽略的配置。

默认值和原生验证规则请参阅 `docs/config-spec.md`。
