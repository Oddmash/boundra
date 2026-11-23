<div align="center">

<img src="docs/assets/boundra-mark.svg" alt="Boundra" width="120" />

# Boundra

**アーキテクチャが崩れる前に、ドメイン境界を守る。**

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

</div>

**[ユーザーガイド](docs/user-guide.ja.md)** · [導入判断と制約](docs/product-positioning.md)

[![npm](https://img.shields.io/npm/v/boundra?color=ea580c)](https://www.npmjs.com/package/boundra) [![CI](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml/badge.svg)](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml) [![License](https://img.shields.io/badge/license-MIT-ea580c)](LICENSE)

Boundra は、ドメイン中心のアプリケーション向けのスキーマベース TypeScript 契約ランタイムと Rust 製の静的解析 CLI です。既存の Next.js、Vite、サーバー構成と併用できます。

アプリケーションが成長すると、意図しない import によってドメインが結合されることがあります。Boundra はクライアントとサーバーの境界違反、未宣言の依存関係、内部実装への直接参照を本番前に検出します。ランタイムは契約の入力と出力も検証します。

## クイックスタート

Node.js 20 以上が必要です。初回実行時に対応するネイティブバイナリをダウンロードし、チェックサムを検証します。

```bash
pnpm add boundra zod
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain tasks
pnpm exec boundra generate resource tasks/task
pnpm exec boundra check-boundaries
```

## 検査対象

| ルール | 禁止する依存関係 |
| --- | --- |
| BR-001 | クライアント → サーバー |
| BR-002 | サーバー → クライアント |
| BR-003 | 共有 → ポリシーで禁止された機能 |
| BR-004 | ドメイン → 他ドメインの内部 |
| BR-005 | アプリ → ドメインの内部 |
| BR-006 | ドメイン → 未宣言の公開 API |

## 契約の定義

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

## 開発ワークフロー

CI では `check-boundaries --format json` を使用し、依存関係は `graph-domains --format mermaid` で可視化できます。任意の `boundra/vite` プラグインは本番のエラー処理を変更せず、開発時の診断を表示します。

## ドキュメント

- [Quick Start](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Boundary Rules](docs/boundary-rules.md)
- [CLI Installation](docs/cli-install.md)
- [CLI Specification](docs/cli-spec-v1.md)
- [Vite Integration](docs/vite-integration.md)
- [Performance](docs/performance.md)
- [Documentation Index](docs/readme.md)
- [Contributing](CONTRIBUTING.md)

現在は公開プレビューです。CLI と JSON 契約は可能な限り追加的に進化させ、互換性を破るアーキテクチャの決定は ADR に記録します。
