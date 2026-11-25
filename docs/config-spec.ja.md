# Boundra 設定仕様

## 1. ファイルの位置

ルートファイル：

```txt
boundra.config.json
```

ファイルは任意です。存在しない場合、Boundra は組み込みのデフォルト値を使用します。

## 2. 目的

`boundra.config.json` は CLI が使用するプロジェクトモデルを定義します。

- ワークスペースおよびパッケージのルート
- ドメインルートおよびマニフェストファイル名
- 新規ドメインのデフォルト公開 API パス
- 境界チェックのスキャン対象拡張子と無視するパス
- 依存関係の capability 分類と共有レイヤーのポリシー

## 3. 対応フィールド

### `project`

```json
{
  "project": {
    "workspaceRoot": "."
  }
}
```

対応項目：

- `workspaceRoot`: 相対ワークスペースルートパス

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

対応項目：

- `apps`
- `domains`
- `packages`
- `crates`

すべてのパスは相対パスでなければなりません。

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

対応項目：

- `manifestFile`: パスではなくファイル名のみ
- `publicApi.client`
- `publicApi.server`
- `publicApi.shared`

これらのデフォルト値は `create-domain` で使用されます。

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

対応項目：

- `includeExtensions`: パーサーが走査するファイル拡張子
- `ignore`: 単純なワークスペース相対の無視パターン
- `capabilities.external`: 外部 import のマッチャーから capability のリストへの対応
- `capabilities.packages`: `paths.packages` 直下の名前から capability のリストへの対応
- `capabilities.apps`: `paths.apps` 内に解決される import に付与される capability
- `policy.shared.denyCapabilities`: `shared` からの依存で BR-003 を発生させる capability
- `denyDomainDependencies`: 検出されたソースドメインごとの禁止対象一覧。例：`{"billing": ["shipping"]}`。BR-007 を追加し、既存ルールは変更しません。不明な名前、自己参照、重複は設定エラーです。

外部マッチャーはパッケージの完全一致とそのサブパスに一致します。`node:*` のような接頭辞のグループでは、末尾に1つの `*` を指定できます。

設定した `external` と `packages` の項目は組み込みのデフォルト値に重ねて適用されます。空のリストを割り当てると、そのソースのデフォルト分類が無効になります。`apps` と `policy.shared.denyCapabilities` はそれぞれのデフォルト値を置き換えます。

## 4. デフォルト値

設定ファイルが存在しない場合、Boundra は次の設定が存在するものとして動作します。

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

## 5. 検証ルール

- 設定されたパスは相対パスでなければならない
- プロジェクトモデルを読み込むために `paths.domains` が存在しなければならない
- `domain.manifestFile` はファイル名でなければならない
- 公開 API パスは相対パスでなければならない
- 公開 API パスで `internal` を公開してはいけない
- `checkBoundaries.includeExtensions` は空であってはならない
- capability 名は空であってはならない
- 外部 capability のワイルドカードは末尾の1つの `*` でなければならない
- ワークスペースの capability パッケージキーは `paths.packages` 直下の名前でなければならない

## 6. ワークスペースの import エイリアス

ルートに `tsconfig.json` が存在する場合、Boundra は境界解決のために `compilerOptions.paths` を読み込みます。相対パスの `extends` チェーンは親から子へ順に解決され、子のエイリアスは同じパターンのエイリアスを上書きします。エイリアスのターゲットは宣言元の設定の `baseUrl` に従います。

ルートの `package.json` が存在する場合、Boundra は標準の `imports` フィールドのローカル文字列マッピングも読み込みます。`"#billing": "./domains/billing/shared/public.ts"` のような完全一致のマッピングと `"#domain/*": "./domains/*/shared/public.ts"` のような単一ワイルドカードパターンは、BR-001 から BR-006 の実行前にワークスペースのパスへ解決されます。ターゲットは `./` で始まり、ワークスペース内にとどまる必要があります。条件付きオブジェクトと配列は Node.js ランタイムに委ねられ、現在の静的アナライザーでは解決されません。

通常の TypeScript 設定構文に合わせ、各ファイルはコメントと末尾のカンマを含め JSONC として parse されます。Boundra がパッケージ解決セマンティクスを定義するまでは、パッケージベースの `extends` 値は無視されます。

Boundra のプロジェクトモデルに影響するのは `compilerOptions.paths` のみです。他の TypeScript コンパイラーオプションは引き続き TypeScript ツールチェーンが所有します。

エイリアス解決はアーキテクチャの境界を検証するもので、デプロイ成果物のトレースを検証するものではありません。生の TypeScript を直接指すエイリアスでも、バンドラーやプラットフォームでの include 設定が必要になる場合があります。サーバーコードではワークスペースパッケージやランタイムで解決可能なビルド済みエントリーポイントを優先し、生成した成果物のデプロイスモークテストを維持してください。

## 7. 未対応の項目

次のフィールドは計画中または将来追加される可能性がありますが、現在の CLI には実装されていません。

- `version`
- `naming`
- `rules`
- `codegen`
- `graph`
- カスタム終了コード
- カスタム診断メッセージ

## 8. 適合性とドリフト防止

ネイティブ Rust ローダーと公開された `boundra/config` TypeScript 上のインターフェースは、同じ対応設定契約を表現する必要があります。

リポジトリは代表的な完全設定フィクスチャを `fixtures/config-conformance/boundra.config.json` に保持しています。Rust 統合テストは実際のネイティブ設定ローダーを通じてそのフィクスチャを読み込み、TypeScript 設定テストは公開の作成用ヘルパーを通じて同じフィクスチャを使用します。

さらに `pnpm check-config-drift` は Rust の `Raw*Config` フィールドツリーと TypeScript の `BoundraConfig` インターフェースツリーを比較します。このチェックでは対応フィールドのパスと正規化された末端の型（`string`、`string[]`、`record<string, string[]>`）を比較します。いずれかの側が対応フィールドを追加、削除、改名したりその形状を変更したりしてもう一方を更新しない場合、CI は失敗します。

このチェックは公開の作成用 API が CLI の未実装機能をサポートすると誤って表明する事態を防ぎ、ネイティブ CLI が TypeScript 利用者が `boundra/config` で作成できない設定を追加する事態も防ぎます。
