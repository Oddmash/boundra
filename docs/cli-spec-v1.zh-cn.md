# CLI 规范 v1

## 1. 命令

全局信息参数：

- `--help`, `-h`
- `--version`, `-V`

### 1.0 `init`

初始化 Boundra 工作区，不覆盖应用文件。

生成目标：
- `boundra.config.json`
- 配置的 `apps/` 和 `domains/` 目录

选项：
- `--root <path>`（默认：`.`）
- `--name <kebab-case>`（默认：根目录名）

行为：
- 如果已有 `boundra.config.json`，则以 `PROJECT-003` 失败
- 保留现有目录
- 生成的配置立即可被 `check-boundaries` 接受

### 1.1 `create-domain <name>`

创建领域脚手架。

输入规则：
- `<name>` 必须为 `kebab-case`。

生成目标：
- `<paths.domains>/[<parent-path>/]<name>/client/`
- `<paths.domains>/[<parent-path>/]<name>/server/`
- `<paths.domains>/[<parent-path>/]<name>/shared/`
- `<paths.domains>/[<parent-path>/]<name>/mcp/`
- `<paths.domains>/[<parent-path>/]<name>/tests/`
- `<paths.domains>/[<parent-path>/]<name>/<domain.manifestFile>`

选项：
- `--root <path>`（默认：`.`）
- `--path <parent-path>`（默认：空，相对于 `paths.domains`）

`--path` 接受一个或多个 kebab-case 目录段，例如 `create-domain order --path commerce/core`。它拒绝绝对路径、`.` 和 `..` 段，以及已经在其他根目录存在的领域名。

### 1.2 `check-boundaries`

分析 import 并检测边界规则违规。

解析输入：

- 相对 import 和工作区相对 import
- 根目录/相对 extends 的 `tsconfig.json` 中的 `compilerOptions.paths`
- 根目录 `package.json#imports` 本地字符串映射，包括一个 `*` 模式

解析包的 import 别名将使既有边界规则在该别名下也得以生效。这不保证部署平台会将目标源码文件包含在服务端产物中。

选项：
- `--root <path>`（默认：`.`）
- `--format text|json`（默认：`text`）
- `--min-domains <positive integer>`（可选，也接受 `--min-domains=<n>`）

覆盖范围报告：
- 独立于 `paths.apps` 分析 `paths.domains`。
- 依据配置的 manifest 文件名递归查找领域。
- JSON 元数据包括 `scanned_file_count` 和 `analyzed_domain_count`。`analyzed_domain_count` 统计至少包含一个已被配置扫描纳入的源文件的唯一领域，而非仅加载 manifest 的领域。
- 未分析任何源文件或领域时，文本输出会发出警告。
- 如果设置了 `--min-domains`，扫描无违规但覆盖领域数少于要求的数量时，命令返回 `COVERAGE-001` 和退出码 2。JSON 使用现有的结构化错误格式，在 context 中包含实际及预期覆盖数量。如果存在违规，违规仍具有优先级且退出码为 1。不使用此选项时，现有行为和输出保持不变。

### 1.3 `graph-domains`

根据领域 manifest 生成领域依赖图。

选项：
- `--root <path>`（默认：`.`）
- `--format mermaid|json|dot`（默认：`mermaid`）
- `--output <path>`

### 1.4 `generate route <domain>/<name>`
### 1.5 `generate query <domain>/<name>`
### 1.6 `generate mutation <domain>/<name>`

生成以契约为中心的模板文件。

输入规则：
- `<domain>` 和 `<name>` 必须为 `kebab-case`。
- `<domain>` 必须已经存在。

选项：
- `--root <path>`（默认：`.`）

副作用：
- 生成的共享契约文件会追加到所发现领域 manifest 的 `publicApi.shared` 中。
- 生成的共享契约通过所发现领域根目录的 `shared/public.ts` 导出。
- 生成的 query 和 mutation 适配器会从所发现领域根目录的 `client/public.ts` 幂等地导出。
- 公开 API 更新失败时，生成流程会恢复生成文件、manifest 及公开 barrel 文件，因此再次尝试时不会遇到不完整的输出。
- 保留已有 `publicApi.shared` 条目，不添加重复条目。
- 生成的契约包含输入/结果 Schema 及推断类型。
- 生成的 route 文件绑定经验证的服务端实现。
- 生成的 query/mutation 文件暴露与框架无关的异步客户端函数。

### 1.7 `add-dependency <domain>/<dependency>`

声明一个领域依赖于另一个领域。

输入规则：
- 两个名称都必须为 `kebab-case`
- 两个领域都必须已经存在
- 领域不能依赖自身

选项：
- `--root <path>`（默认：`.`）

副作用：
- 将 `<dependency>` 追加到所发现 `<domain>` manifest 的 `dependsOn`
- 保留已有依赖
- 不添加重复项

### 1.8 `generate resource <domain>/<name>`

生成仅包含契约的 CRUD resource 脚手架。

生成目标：
- `domains/<domain>/shared/contracts/<name>.ts`
- `domains/<domain>/client/resources/<name>.ts`

共享文件负责 list/create/update/delete 的 Schema 和契约。客户端文件暴露类型化函数，并从 `client/public.ts` 幂等导出。Boundra 不生成持久化、HTTP 路由、UI 或 ORM 代码。

## 2. CLI 用户体验原则

- 边界诊断包含规则代码、文件、行号、import、消息及建议。
- 成功的脚手架输出包含一行摘要以及创建的路径。
- JSON 输出为 CI 和 AI 解析保持稳定的 Schema。
- CLI 失败包含稳定的代码、上下文及可操作的建议。
- 要求 JSON 时，项目/配置失败以 JSON 输出。

## 3. 机器可读输出（JSON）

```json
{
  "status": "failed",
  "violations": [
    {
      "rule": "BR-001",
      "file": "domains/order/client/use-order.ts",
      "line": 12,
      "import": "domains/order/server/order-service",
      "message": "client layer cannot import server layer",
      "suggestion": "move shared contract to shared layer or call through an API boundary"
    }
  ],
  "meta": {
    "command": "check-boundaries",
    "violation_count": 1,
    "scanned_file_count": 24,
    "analyzed_domain_count": 2
  }
}
```

## 4. 规则说明

`boundra explain BR-001 [--format text|json]` 无需加载工作区即可解释内置边界规则。支持 BR-001 至 BR-006，不区分大小写。提供原因、正确与违规示例以及解决建议，JSON 包含 `rule`、`title`、`description`、`reason`、`invalid_example`、`valid_example`、`suggestion` 和 `meta.command`。未知规则或无效选项返回退出码 2 和结构化错误。

## 5. 监视模式

`boundra watch [--root <path>] [--format text|json] [--interval-ms <n>] [--min-domains <n>] [--once]` 立即执行完整扫描，然后默认每 1,500ms（最短 250ms）重复，仅输出变化后的结果。无需缓存即可检查源码、配置、清单及别名变化。JSON 每行包含 `event`、`exit_code`、`report` 和 `meta.command`；`--once` 返回检查退出码，Ctrl+C 停止。
