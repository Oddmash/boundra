# 产品定位与采用决策

## 建议

Boundra 是适用于领域优先 TypeScript 代码库的可选架构契约工具，并非应用框架的替代品。它的核心价值是共用领域 manifest，通过它驱动脚手架、import 策略及关系可视化，并结合经过验证的输入/结果契约。CLI 和运行时可以分别采用。

## 谁应采用它？

- 拥有多个业务领域、共享 package，并反复面临边界偏移问题的团队。
- 维护多个入口或使用 AI 辅助代码生成，需要明确且可审查的依赖策略的团队。
- 已希望采用领域优先结构，需要一致的 Schema 和适配器而非另一个框架的团队。

不要仅因仓库庞大就采用它。小型站点或已经通过 Nx 或自定义 ESLint 规则成功管理的应用可能获益不大。使用 tRPC 进行类型化远程调用的项目可以保留 tRPC，仅评估 Boundra CLI。

## 替代方案比较

| 工具 | 实际优势 | 相对于 Boundra 的取舍 |
| --- | --- | --- |
| ESLint no-restricted-imports | 可在已有 lint 流程中使用熟悉且可自定义的静态 import 限制 | 必须由团队维护路径规则；规则本身不负责领域 manifest、依赖图或契约生成器 |
| Nx enforce-module-boundaries | 与 Nx 及其项目模型集成的基于项目/标签的约束 | 对已有 Nx 工作区是优秀选择；Boundra 的领域 manifest 与 Schema 契约是不同且更聚焦的工作流 |
| dependency-cruiser | 可配置的模块依赖规则与图可视化，包括可达性和循环 | 更通用的图分析；不规定 Boundra 的 client/server/shared 契约布局 |
| tRPC | 推断端到端 TypeScript API 类型，并拥有专门的 RPC 生态系统 | 当 RPC 是核心问题时的优秀选择；Boundra 处理源码架构并由宿主负责传输 |
| Next.js 服务端/客户端边界 | 感知运行时和框架的组件组合与环境约束 | Boundra 检查指定的源码层；不能替代 Next.js 构建/运行时语义 |

主要来源：[ESLint](https://eslint.org/docs/latest/rules/no-restricted-imports)、[Nx](https://nx.dev/docs/kb/enforce-module-boundaries)、[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)、[tRPC](https://trpc.io/docs)、[Next.js](https://nextjs.org/docs/app/getting-started/server-and-client-components)。

这些是功能比较，而非基准测试结果，也不意味着替代方案无法通过自定义配置表达等价架构。

## 收益与成本

| 收益 | 成本或限制 | 证据 |
| --- | --- | --- |
| 明确的依赖所有权 | 更新 manifest 和设计公开 API 成为功能开发的一部分 | BR-004 至 BR-006、graph-domains、manifest 规范 |
| 可预测的文件位置和生成契约 | 现有代码可能需要迁移；生成的存根仍需实现 | CLI 规范和干净环境验证 |
| 运行时 Schema 验证 | 增加验证工作和编写 Schema 的依赖；不实现身份认证、持久化或授权 | 契约和传输规范 |
| 机器可读诊断 | 自定义解析器/解析范围可能遗漏不支持的 import 解析；扫描通过不是完全隔离的证明 | 解析器语料库和配置规范 |
| 原生 CLI | 首次发行版下载和平台可用性；离线环境需要预先提供二进制文件 | 打包规范 |

仓库的历史合成测试耗时记录在 [performance.md](performance.md) 中。这并非直接对比。目前 CI 会验证 Node 兼容性和原生目标覆盖范围；Next.js 与 Vite 特定应用的接入仍需要代表性使用方验证。Boundra 不是安全边界，也不能替代编译器、框架、部署或应用测试。

## 以证据指导后续工作

| 优先级 | 任务 | 验收门槛 |
| --- | --- | --- |
| P0 | 可靠的接入与扫描覆盖率 | 全新安装、至少扫描到两个预期领域、干净的测试样例及可操作的诊断 |
| P1 | 真实的 Next.js App Router 和 Vite 使用方测试样例 | 编译/构建并验证别名解析、公开入口、运行时和开发集成 |
| P1 | 与参考解析器和成熟工具比较解析精度 | 相同语料库、精确的 import 元组和独立标注的结果；测量误报和漏报 |
| P2 | 评估采用开销和性能 | 相同项目和环境；记录配置时间、维护步骤、重复扫描耗时及内存 |

在核心采用证据表明确有需求之前，不要引入扩展 DSL、新路由框架或自定义打包工具。如果已有工具能够以更低维护成本满足目标工作流，应重新评估独立开发。

## 采用退出标准

只有开发者能够在不破坏已有构建的情况下配置局部范围，检查器能够扫描目标领域，诊断可操作且持续维护成本可接受时，试点才算成功。实际采用情况和相对速度尚未测量。评估期间保留已有 lint、类型检查及框架构建。
