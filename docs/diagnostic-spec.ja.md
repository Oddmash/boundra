# 診断仕様

## 1. 目標

CLI の失敗はすべて、次の4つの質問に答える必要があります。

1. 何が失敗したのか？
2. どこで、またはどのリソースで失敗したのか？
3. なぜ失敗したのか？
4. 利用者は次に何をするべきか？

## 2. テキスト形式

```txt
[ERROR] DOMAIN-001
message: unknown domain 'payment'
domain: payment
available: billing, order
suggestion: run 'boundra create-domain payment' or choose an existing domain
```

フィールド：

- 安定した診断コード
- 簡潔なメッセージ
- 0個以上のコンテキストフィールド
- 実行可能な提案

境界違反は既存の `BR-*` テキスト形式を維持し、さらに同じメッセージ・コンテキスト・提案の原則に従います。

## 3. JSON 形式

JSON 出力が要求された場合、失敗も機械可読なままでなければなりません。

```json
{
  "status": "error",
  "errors": [
    {
      "code": "DOMAIN-001",
      "message": "unknown domain 'payment'",
      "context": {
        "domain": "payment",
        "available": "billing, order"
      },
      "suggestion": "run 'boundra create-domain payment' or choose an existing domain"
    }
  ],
  "meta": {
    "command": "generate"
  }
}
```

成功時の `check-boundaries` の JSON および違反フィールドは後方互換性を維持します。`meta` オブジェクトは `scanned_file_count` と `analyzed_domain_count` も報告するので、CI は正常なスキャンと空のスキャンを区別できます。ドメイン数には `paths.domains` 配下に走査対象となったソースファイルを少なくとも1つ持つ一意のドメインだけが含まれ、無視された、または存在しないドメインソースは数えられません。いずれかの数がゼロの場合、テキスト出力は警告を発します。ゼロという値だけでコマンドの終了コードが変わることはありません。

## 4. コードの分類

- `CLI-*`: コマンド構文とオプションのエラー
- `PROJECT-*`: 設定、マニフェスト、プロジェクト読み込みエラー
- `DOMAIN-*`: ドメイン作成と検索のエラー
- `DEPENDENCY-*`: ドメイン依存関係ワークフローのエラー
- `GEN-*`: 生成成果物と公開 API 更新のエラー
- `RUNTIME-*`: TypeScript 契約実行エラー
- `COVERAGE-001`: 設定した `--min-domains` のしきい値に未達。コンテキストには `minimum_domain_count`、`analyzed_domain_count`、`scanned_file_count` が含まれます。

## 5. ランタイム検証の問題

`BoundraRuntimeError` はフレームワークアダプターと開発オーバーレイが特定のスキーマプロバイダーに依存しないように正規化された `issues` を提供します。

```json
{
  "name": "BoundraRuntimeError",
  "code": "RUNTIME-001",
  "contract": "create-task",
  "phase": "input",
  "message": "contract 'create-task' rejected input at 'title': 제목은 두 글자 이상 입력해 주세요.",
  "suggestion": "fix input field 'title': 제목은 두 글자 이상 입력해 주세요.",
  "issues": [
    {
      "code": "too_small",
      "path": ["title"],
      "message": "제목은 두 글자 이상 입력해 주세요."
    }
  ]
}
```

ルール：

- `issues` は常に配列であり、検証の問題がなければ空の配列です。
- issue は `code`、`path`、`message` のみを安定して公開します。
- 元の入力やスキーマプロバイダーのエラーオブジェクト全体はシリアル化しません。
- `toJSON()` は上記の構造を返し、内部の `cause` は含めません。
- ランタイムパッケージは Zod に直接依存せず、構造的に互換性のある issue を正規化します。

## 5. 終了コード

- `0`: 成功
- `1`: 境界違反
- `2`: 使用方法、設定、マニフェスト、リソース検証のエラー
- `3`: 予期しない I/O または内部実行エラー
