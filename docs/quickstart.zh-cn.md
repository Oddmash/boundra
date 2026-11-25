# Boundra 公共快速入门

## 前提条件

- TypeScript 应用需要 Node.js 20 或更新版本
- pnpm、npm 或其他包管理器

## 安装运行时

```bash
pnpm add boundra zod
```

npm 包包含原生 CLI 启动器。初始化工作区：

```bash
pnpm exec boundra init --name my-app
```

## 创建项目流程

```bash
pnpm exec boundra create-domain order
pnpm exec boundra create-domain billing
pnpm exec boundra add-dependency billing/order
pnpm exec boundra generate query order/get-order
pnpm exec boundra generate mutation order/submit-order
pnpm exec boundra generate route billing/create-invoice
pnpm exec boundra check-boundaries --format json
pnpm exec boundra graph-domains --format mermaid
```

生成的契约以安全的空 Zod 对象为起点。将其中的字段替换为领域输入/结果 Schema，然后实现生成的客户端或服务端适配器。Boundra 不会覆盖已有的生成文件。

## CI 检查

```bash
pnpm exec boundra check-boundaries --root . --format json
```

契约所有权请参阅 `docs/contract-schema-spec.md`，原生 CLI 的安装请参阅 `docs/cli-install.md`。
