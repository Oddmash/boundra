# Boundra

**아키텍처가 무너지기 전에 도메인 경계를 지킵니다.**

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

[![npm](https://img.shields.io/npm/v/boundra)](https://www.npmjs.com/package/boundra) [![CI](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml/badge.svg)](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml) [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Boundra는 도메인 중심 애플리케이션을 위한 스키마 기반 TypeScript 계약 런타임과 Rust 정적 분석 CLI입니다. 기존 Next.js, Vite 및 서버 스택과 함께 사용합니다.

애플리케이션이 커지면서 무분별한 import는 의도하지 않은 도메인 결합을 만듭니다. Boundra는 클라이언트/서버 경계 위반, 미선언 도메인 의존성, 내부 구현 직접 참조를 배포 전에 발견합니다. 런타임은 계약의 입력과 출력도 검증합니다.

## 빠른 시작

Node.js 20 이상이 필요합니다. 최초 실행 시 대응하는 네이티브 바이너리를 다운로드하고 체크섬을 검증합니다.

```bash
pnpm add boundra zod
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain tasks
pnpm exec boundra generate resource tasks/task
pnpm exec boundra check-boundaries
```

## 검사 규칙

| 규칙 | 차단하는 의존성 |
| --- | --- |
| BR-001 | 클라이언트 → 서버 |
| BR-002 | 서버 → 클라이언트 |
| BR-003 | 공유 → 정책상 금지된 기능 |
| BR-004 | 도메인 → 다른 도메인 내부 |
| BR-005 | 앱 → 도메인 내부 |
| BR-006 | 도메인 → 미선언 공개 API |

## 계약 정의

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

## 개발 워크플로

CI에서는 `check-boundaries --format json`을 사용하고 `graph-domains --format mermaid`로 의존성을 시각화할 수 있습니다. 선택적 `boundra/vite` 플러그인은 프로덕션 오류 처리에 개입하지 않고 개발 진단을 표시합니다.

## 문서

- [Quick Start](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Boundary Rules](docs/boundary-rules.md)
- [CLI Installation](docs/cli-install.md)
- [CLI Specification](docs/cli-spec-v1.md)
- [Vite Integration](docs/vite-integration.md)
- [Performance](docs/performance.md)
- [Documentation Index](docs/readme.md)
- [Contributing](CONTRIBUTING.md)

현재 공개 프리뷰입니다. CLI와 JSON 계약은 가능한 한 추가적인 변경으로 발전하며 호환성이 깨지는 아키텍처 결정은 ADR에 기록합니다.
