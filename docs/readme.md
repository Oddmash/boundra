<a id="docs-index"></a>

# Boundra documentation

<a id="product-and-user-documentation"></a>

Boundra combines a Rust static architecture checker with a schema-backed
TypeScript contract runtime. Start with the user guide to adopt one domain
slice, or use the references below to understand rules, contracts and tooling.

- [English website](https://oddmash.github.io/boundra/) · [한국어](https://oddmash.github.io/boundra/ko/) · [日本語](https://oddmash.github.io/boundra/ja/) · [简体中文](https://oddmash.github.io/boundra/zh-cn/)
- [English documentation](https://oddmash.github.io/boundra/docs/) · [한국어 문서](https://oddmash.github.io/boundra/docs/ko/) · [日本語ドキュメント](https://oddmash.github.io/boundra/docs/ja/) · [简体中文文档](https://oddmash.github.io/boundra/docs/zh-cn/)

## Start here

| Guide | English | 한국어 | 日本語 | 简体中文 |
| --- | --- | --- | --- | --- |
| User guide | [Read](user-guide.md) | [읽기](user-guide.ko.md) | [読む](user-guide.ja.md) | [阅读](user-guide.zh-cn.md) |
| Quick start | [Read](quickstart.md) | [읽기](quickstart.ko.md) | [読む](quickstart.ja.md) | [阅读](quickstart.zh-cn.md) |
| CLI installation | [Read](cli-install.md) | [읽기](cli-install.ko.md) | [読む](cli-install.ja.md) | [阅读](cli-install.zh-cn.md) |
| Adoption and trade-offs | [Read](product-positioning.md) | [읽기](product-positioning.ko.md) | [読む](product-positioning.ja.md) | [阅读](product-positioning.zh-cn.md) |

Try the [order and billing example](../examples/order-billing), which includes
schema-backed query, mutation and route contracts. The repository's
`pnpm verify-example` command verifies this application flow.

## Architecture

- [Architecture](architecture.md)
- [Boundary rules](boundary-rules.md)
- [Domain manifest specification](domain-manifest-spec.md)
- [Project charter](project-charter.md)
- [Naming conventions](naming-convention.md)

## Runtime and framework integration

- [Contract schema specification](contract-schema-spec.md)
- [HTTP transport](http-transport.md)
- [Framework surface](framework-surface.md)
- [Vite integration](vite-integration.md)
- [Browser development error view](error-view.md)
- [Framework consumer conformance](framework-conformance.md)

## CLI and configuration reference

- [CLI specification v1](cli-spec-v1.md)
- [Configuration specification](config-spec.md)
- [TypeScript configuration authoring](config-authoring.md)
- [Diagnostic specification](diagnostic-spec.md)
- [CI integration](ci-integration.md)
- [Boundary performance](performance.md)

## Development and contribution

These documents describe repository implementation policies and planning.

- [Contributing](https://github.com/Oddmash/boundra/blob/main/CONTRIBUTING.md)
- [Brand identity](brand.md)
- [Packaging specification](packaging-spec.md)
- [Parser correctness](parser-correctness.md)
- [Release checklist](release-checklist.md)

### Planning

- [Roadmap](roadmap.md)
- [MVP implementation plan](implementation-plan-mvp.md)
- [Dogfooding notes](dogfooding-notes.md)
- [Solo development conventions](solo-convention.md)

## Releases

- [v0.7.0](releases/v0-7-0.md)
- [v0.6.0](releases/v0-6-0.md)
- [v0.5.0](releases/v0-5-0.md)
- [v0.4.0](releases/v0-4-0.md)
- [v0.3.0](releases/v0-3-0.md)
- [v0.2.2](releases/v0-2-2.md)
- [v0.2.1](releases/v0-2-1.md)
- [v0.2.0](releases/v0-2-0.md)
- [v0.1.2](releases/v0-1-2.md)
- [v0.1.1](releases/v0-1-1.md)
- [v0.1.0](releases/v0-1-0.md)

See the [changelog](https://github.com/Oddmash/boundra/blob/main/CHANGELOG.md) for version history and [GitHub Releases](https://github.com/Oddmash/boundra/releases) for published archives.

## Vocabulary and decisions

- [Glossary](glossary.md)
- [ADR 0001: Domain-first architecture](adr/0001-domain-first-architecture.md)
- [ADR 0002: Schema contract runtime](adr/0002-schema-contract-runtime.md)
- [ADR 0003: Public packaging](adr/0003-public-packaging.md)
- [ADR 0004: Single npm package](adr/0004-single-npm-package.md)
