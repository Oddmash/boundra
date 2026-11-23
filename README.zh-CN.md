# Boundra

**在架构失控之前守住领域边界。**

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

[![npm](https://img.shields.io/npm/v/boundra)](https://www.npmjs.com/package/boundra) [![CI](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml/badge.svg)](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml) [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Boundra 是面向领域优先应用的基于 Schema 的 TypeScript 契约运行时，以及使用 Rust 编写的静态分析 CLI。可与现有 Next.js、Vite 和服务端技术栈配合使用。

随着应用增长，随意导入可能造成意外的领域耦合。Boundra 在进入生产环境之前检测客户端与服务端边界违规、未声明的领域依赖及对内部实现的直接导入。运行时还验证契约的输入与输出。

## 快速开始

需要 Node.js 20 或更高版本。首次运行时，启动器下载对应的原生二进制文件并验证校验和。

```bash
pnpm add boundra zod
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain tasks
pnpm exec boundra generate resource tasks/task
pnpm exec boundra check-boundaries
```

## 检查规则

| 规则 | 禁止的依赖 |
| --- | --- |
| BR-001 | 客户端 → 服务端 |
| BR-002 | 服务端 → 客户端 |
| BR-003 | 共享层 → 策略禁止的能力 |
| BR-004 | 领域 → 其他领域内部实现 |
| BR-005 | 应用 → 领域内部实现 |
| BR-006 | 领域 → 未声明的公开 API |

## 定义契约

```ts
import { defineQuery, createBoundraClient, createHttpTransport } from "boundra";
import { z } from "zod";

const getTask = defineQuery({
  name: "get-task",
  input: z.object({ id: z.string().min(1) }),
  result: z.object({ id: z.string(), title: z.string(), done: z.boolean() }),
});

const client = createBoundraClient(
  createHttpTransport({ baseUrl: "/api/boundra" }),
);
const task = await client.query(getTask, { id: "task-001" });
```

## 开发工作流

在 CI 中使用 `check-boundaries --format json`，并通过 `graph-domains --format mermaid` 可视化依赖图。可选的 `boundra/vite` 插件显示开发诊断，不改变生产环境的错误处理。

## 文档

- [Quick Start](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Boundary Rules](docs/boundary-rules.md)
- [CLI Installation](docs/cli-install.md)
- [CLI Specification](docs/cli-spec-v1.md)
- [Vite Integration](docs/vite-integration.md)
- [Performance](docs/performance.md)
- [Documentation Index](docs/readme.md)
- [Contributing](CONTRIBUTING.md)

目前处于公开预览阶段。CLI 和 JSON 契约尽可能保持增量兼容，破坏兼容性的架构决策记录在 ADR 中。
