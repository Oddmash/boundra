# CLI 仕様 v1

## 1. コマンド

グローバル情報フラグ：

- `--help`、`-h`
- `--version`、`-V`

### 1.0 `init`

アプリケーションファイルを上書きせずに Boundra ワークスペースを初期化します。

生成対象：
- `boundra.config.json`
- 設定された `apps/`、`domains/` ディレクトリ

オプション：
- `--root <path>`（デフォルト：`.`）
- `--name <kebab-case>`（デフォルト：ルートディレクトリ名）

挙動：
- 既存の `boundra.config.json` がある場合は `PROJECT-003` で失敗
- 既存のディレクトリは保持
- 生成された設定は直ちに `check-boundaries` で受け入れられる

### 1.1 `create-domain <name>`

ドメインのスキャフォールドを作成します。

入力ルール：
- `<name>` は `kebab-case` でなければなりません。

生成対象：
- `<paths.domains>/[<parent-path>/]<name>/client/`
- `<paths.domains>/[<parent-path>/]<name>/server/`
- `<paths.domains>/[<parent-path>/]<name>/shared/`
- `<paths.domains>/[<parent-path>/]<name>/mcp/`
- `<paths.domains>/[<parent-path>/]<name>/tests/`
- `<paths.domains>/[<parent-path>/]<name>/<domain.manifestFile>`

オプション：
- `--root <path>`（デフォルト：`.`）
- `--path <parent-path>`（デフォルト：空、`paths.domains` からの相対パス）

`--path` は1つ以上の kebab-case ディレクトリセグメントを受け入れます。例：`create-domain order --path commerce/core`。絶対パス、`.` と `..` セグメント、別のルートにすでに存在するドメイン名は拒否します。

### 1.2 `check-boundaries`

import を分析し、境界ルール違反を検出します。

解決に使用する入力：

- 相対パスおよびワークスペース相対パスの import
- ルートと相対 `extends` の `tsconfig.json` の `compilerOptions.paths`
- ルートの `package.json#imports` のローカル文字列マッピング（1つの `*` パターンを含む）

パッケージの import エイリアスを解決すると、そのエイリアスを通じて既存の境界ルールを適用できます。デプロイプラットフォームがターゲットのソースファイルをサーバー成果物に含めることを保証するものではありません。

オプション：
- `--root <path>`（デフォルト：`.`）
- `--format text|json`（デフォルト：`text`）
- `--min-domains <positive integer>`（任意、`--min-domains=<n>` も受け入れる）

カバレッジの報告：
- `paths.domains` は `paths.apps` とは独立して分析されます。
- ドメインは設定されたマニフェストファイル名で再帰的に検出されます。
- JSON メタデータには `scanned_file_count` と `analyzed_domain_count` が含まれます。`analyzed_domain_count` は単にマニフェストが読み込まれた数ではなく、設定されたスキャンに含まれるソースファイルを少なくとも1つ持つ一意のドメインを数えます。
- テキスト出力はソースファイルまたはドメインが1つも分析されなかった場合に警告します。
- `--min-domains` が設定され、違反はないもののスキャンが要求されたドメイン数を下回る場合、コマンドは `COVERAGE-001` と終了コード 2 を返します。JSON は実際と期待値のカバレッジ数をコンテキストに含む既存の構造化エラー形式を使用します。違反がある場合は違反の報告が優先され、終了コードは 1 です。オプションを指定しなければ、既存の挙動と出力は変更されません。

### 1.3 `graph-domains`

ドメインマニフェストからドメイン依存関係グラフを生成します。

オプション：
- `--root <path>`（デフォルト：`.`）
- `--format mermaid|json|dot`（デフォルト：`mermaid`）
- `--output <path>`

### 1.4 `generate route <domain>/<name>`
### 1.5 `generate query <domain>/<name>`
### 1.6 `generate mutation <domain>/<name>`

契約中心のテンプレートファイルを生成します。

入力ルール：
- `<domain>` と `<name>` は `kebab-case` でなければなりません。
- `<domain>` はすでに存在している必要があります。

オプション：
- `--root <path>`（デフォルト：`.`）

副作用：
- 生成された共有契約ファイルは検出されたドメインマニフェストの `publicApi.shared` に追加されます。
- 生成された共有契約は検出されたドメインルートの `shared/public.ts` から export されます。
- 生成された query と mutation のアダプターは、検出されたドメインルートの `client/public.ts` から冪等に export されます。
- 公開 API の更新に失敗した場合は、生成ファイル、マニフェスト、公開バレルを復元するため、再試行時に不完全な出力が残りません。
- 既存の `publicApi.shared` 項目は保持し、重複は追加しません。
- 生成された契約には入力・結果スキーマと推論された型が含まれます。
- 生成された route ファイルは検証済みのサーバー実装をバインドします。
- 生成された query/mutation ファイルはフレームワークに依存しない非同期クライアント関数を公開します。

### 1.7 `add-dependency <domain>/<dependency>`

あるドメインが別のドメインに依存することを宣言します。

入力ルール：
- 両方の名前は `kebab-case` でなければなりません。
- 両方のドメインがすでに存在している必要があります。
- ドメインは自分自身に依存できません。

オプション：
- `--root <path>`（デフォルト：`.`）

副作用：
- 検出された `<domain>` マニフェストの `dependsOn` に `<dependency>` を追加
- 既存の依存関係を保持
- 重複を追加しない

### 1.8 `generate resource <domain>/<name>`

契約のみの CRUD リソーススキャフォールドを生成します。

生成対象：
- `domains/<domain>/shared/contracts/<name>.ts`
- `domains/<domain>/client/resources/<name>.ts`

共有ファイルは list/create/update/delete のスキーマと契約を所有します。クライアントファイルは型付き関数を公開し、`client/public.ts` から冪等に export されます。Boundra は永続化、HTTP ルート、UI、ORM コードを生成しません。

## 2. CLI UX の原則

- 境界診断にはルールコード、ファイル、行、import、メッセージ、提案を含めます。
- スキャフォールド作成成功時の出力には要約1行と作成されたパスを含めます。
- JSON 出力は CI と AI の解析用に安定したスキーマを維持します。
- CLI の失敗には安定したコード、コンテキスト、実行可能な提案を含めます。
- JSON が要求された場合、プロジェクト・設定の失敗は JSON として出力します。

## 3. 機械可読出力（JSON）

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

## 明示的な違反ベースライン

`boundra baseline create [--root <path>]` はバージョン付き JSON を標準出力に生成します。`boundra baseline check --baseline <path> [--root <path>] [--format text|json]` は完全検査後、新規・既存・解決済み違反を分類します。ルール、相対パス、import、出現回数を比較し、行の移動は無視します。名前変更は新規と解決として扱います。終了コード 0 は新規なし、1 は新規違反、2 は不正なベースライン、検査失敗またはドメイン範囲の減少です。通常の `check-boundaries` は自動的に適用しません。
