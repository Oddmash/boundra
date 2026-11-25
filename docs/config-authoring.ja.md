# 設定の作成

Boundra は現在対応する設定契約を npm サブパス `boundra/config` で公開しています。

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

`defineConfig()` は意図的に恒等ヘルパーとして実装されています。リテラル推論を保持し、公開 TypeScript 契約に対してオブジェクトをチェックしますが、相対パス、ドメインルートの存在、公開 API パス、capability マッチャールールなど、ファイルシステムを考慮した検証は引き続きネイティブ CLI が担当します。

## 正規の設定ファイル

ネイティブ CLI が検出するのは引き続き次のファイルだけです。

```txt
boundra.config.json
```

この段階では `boundra.config.ts` はプロジェクトのエントリーポイントとしてサポートされていません。設定を読み込むためだけに Rust CLI で JavaScript や TypeScript を実行することはありません。ネイティブ CLI の動作が追加のランタイムに依存することになるためです。

`boundra/config` のインターフェースはフレームワークアダプター、エディターツール、設定ジェネレーター、テスト、その他スキーマを複製せずに Boundra 設定値を構築・共有する必要がある TypeScript コード向けです。

## 対応する TypeScript フィールド

公開型のインターフェースは現在 Rust プロジェクトモデルが使用するフィールドを反映しています。

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

計画中の設定フィールドは、CLI が使用するようになるまで意図的に `BoundraConfig` から除外されています。これにより、Boundra が黙って無視する設定を TypeScript が受け入れることを防ぎます。

デフォルト値とネイティブ検証ルールについては `docs/config-spec.md` を参照してください。
