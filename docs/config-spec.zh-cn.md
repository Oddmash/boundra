# Boundra 配置规范

## 1. 文件位置

根目录文件：

```txt
boundra.config.json
```

此文件可选。缺失时，Boundra 使用内置默认值。

## 2. 用途

`boundra.config.json` 定义 CLI 使用的项目模型：

- 工作区和 package 根目录
- 领域根目录与 manifest 文件名
- 新领域默认的公开 API 路径
- 边界检查的扫描扩展名和忽略路径
- 依赖 capability 分类与共享层策略

## 3. 支持的字段

### `project`

```json
{
  "project": {
    "workspaceRoot": "."
  }
}
```

支持：

- `workspaceRoot`：相对工作区根目录路径

### `paths`

```json
{
  "paths": {
    "apps": "apps",
    "domains": "domains",
    "packages": "packages",
    "crates": "crates"
  }
}
```

支持：

- `apps`
- `domains`
- `packages`
- `crates`

所有路径必须为相对路径。

### `domain`

```json
{
  "domain": {
    "manifestFile": "domain.json",
    "publicApi": {
      "client": ["./client/public.ts"],
      "server": ["./server/public.ts"],
      "shared": ["./shared/public.ts"]
    }
  }
}
```

支持：

- `manifestFile`：仅文件名，而非路径
- `publicApi.client`
- `publicApi.server`
- `publicApi.shared`

这些默认值由 `create-domain` 使用。

### `checkBoundaries`

```json
{
  "checkBoundaries": {
    "includeExtensions": ["ts", "tsx", "js", "jsx", "svelte"],
    "ignore": [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.claude/worktrees/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/target/**"
    ],
    "capabilities": {
      "external": {
        "react": ["ui"],
        "@prisma/client": ["database"],
        "node:*": ["runtime"]
      },
      "packages": {
        "ui": ["ui"],
        "db": ["database"],
        "infra": ["runtime"]
      },
      "apps": ["runtime"]
    },
    "policy": {
      "shared": {
        "denyCapabilities": ["ui", "database", "runtime"]
      }
    }
  }
}
```

支持：

- `includeExtensions`：解析器扫描的文件扩展名
- `ignore`：简单的工作区相对忽略模式
- `capabilities.external`：外部 import 匹配器到 capability 列表的映射
- `capabilities.packages`：`paths.packages` 下直接子目录到 capability 列表的映射
- `capabilities.apps`：分配给解析至 `paths.apps` 中的 import 的 capability
- `policy.shared.denyCapabilities`：从 `shared` 触发 BR-003 的 capability

外部匹配器匹配确切的包及其子路径。支持单个末尾的 `*`，用于 `node:*` 等前缀系列。

配置的 `external` 和 `packages` 条目覆盖内置默认值。分配空列表会禁用该来源的默认分类。`apps` 与 `policy.shared.denyCapabilities` 分别替换各自的默认值。

## 4. 默认值

不存在配置文件时，Boundra 的行为等同于存在以下配置：

```json
{
  "project": {
    "workspaceRoot": "."
  },
  "paths": {
    "apps": "apps",
    "domains": "domains",
    "packages": "packages",
    "crates": "crates"
  },
  "domain": {
    "manifestFile": "domain.json",
    "publicApi": {
      "client": ["./client/public.ts"],
      "server": ["./server/public.ts"],
      "shared": ["./shared/public.ts"]
    }
  },
  "checkBoundaries": {
    "includeExtensions": ["ts", "tsx", "js", "jsx", "svelte"],
    "ignore": [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.claude/worktrees/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/target/**"
    ],
    "capabilities": {
      "external": {
        "react": ["ui"],
        "react-dom": ["ui"],
        "next": ["ui", "runtime"],
        "@prisma/client": ["database"],
        "fs": ["runtime"],
        "path": ["runtime"],
        "crypto": ["runtime"],
        "child_process": ["runtime"],
        "stream": ["runtime"],
        "http": ["runtime"],
        "https": ["runtime"],
        "os": ["runtime"],
        "process": ["runtime"],
        "node:*": ["runtime"]
      },
      "packages": {
        "ui": ["ui"],
        "db": ["database"],
        "infra": ["runtime"]
      },
      "apps": ["runtime"]
    },
    "policy": {
      "shared": {
        "denyCapabilities": ["ui", "database", "runtime"]
      }
    }
  }
}
```

## 5. 验证规则

- 配置路径必须为相对路径
- 加载项目模型时 `paths.domains` 必须存在
- `domain.manifestFile` 必须为文件名
- 公开 API 路径必须为相对路径
- 公开 API 路径不得暴露 `internal`
- `checkBoundaries.includeExtensions` 不能为空
- capability 名称不能为空
- 外部 capability 通配符必须是单个末尾的 `*`
- 工作区 capability 包键必须是 `paths.packages` 下直接子目录名

## 6. 工作区 Import 别名

根目录存在 `tsconfig.json` 时，Boundra 读取 `compilerOptions.paths` 用于边界解析。相对 `extends` 链从父级解析到子级，子级别名覆盖相同模式的别名。别名目标遵循声明它们的配置的 `baseUrl`。

根目录存在 `package.json` 时，Boundra 还会读取标准 `imports` 字段中的本地字符串映射。`"#billing": "./domains/billing/shared/public.ts"` 等精确映射，以及 `"#domain/*": "./domains/*/shared/public.ts"` 等单通配符模式，在运行 BR-001 至 BR-006 之前解析为工作区路径。目标必须以 `./` 开头，并留在工作区内。条件对象和数组留给 Node.js 运行时处理，当前静态分析器不会解析它们。

每个文件按 JSONC 进行解析，包括注释与尾随逗号，以符合常规 TypeScript 配置语法。在 Boundra 定义包解析语义之前，基于包的 `extends` 值会被忽略。

只有 `compilerOptions.paths` 会影响 Boundra 项目模型。其他 TypeScript 编译器选项仍由 TypeScript 工具链负责。

别名解析验证架构边界，而非部署产物的文件追踪。直接指向原始 TypeScript 的别名仍可能需要打包工具或平台的包含配置。服务端代码应优先使用工作区包或运行时可解析的已构建入口，并对生成的产物保留部署冒烟测试。

## 7. 尚不支持

以下是计划或未来可能实现的字段，但当前 CLI 尚未实现：

- `version`
- `naming`
- `rules`
- `codegen`
- `graph`
- 自定义退出码
- 自定义诊断消息

## 8. 一致性与漂移保护

原生 Rust 加载器与公开的 `boundra/config` TypeScript 接口必须表示相同的受支持配置契约。

仓库在 `fixtures/config-conformance/boundra.config.json` 保存一个完整且有代表性的配置测试样例。Rust 集成测试通过真正的原生配置加载器加载该样例，而 TypeScript 配置测试通过公开的配置编写辅助函数使用相同样例。

此外，`pnpm check-config-drift` 会比较 Rust `Raw*Config` 字段树与 TypeScript `BoundraConfig` 接口树。该检查比较受支持字段路径及其标准化叶节点类型（`string`、`string[]` 及 `record<string, string[]>`）。当任一方添加、删除、更名或改变受支持字段的结构且未同步更新另一方时，CI 会失败。

此检查避免公开配置编写 API 声称支持 CLI 尚未实现的内容，同时防止原生 CLI 添加 TypeScript 用户无法通过 `boundra/config` 编写的配置。
