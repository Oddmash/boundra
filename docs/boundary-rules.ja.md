# 境界ルール

`<discovered-domain-root>` は再帰的に検出されたドメインマニフェストの親ディレクトリを意味します。`paths.domains` 配下のネストされた場所にも存在できます。

## 1. ルールセット（厳格な制約）

### BR-001: クライアントからサーバーへの import 禁止
- ルール：検出されたドメインの `client/**` から同じドメインまたは別の検出されたドメインの `server/**` を import することを禁止
- 理由：デプロイ境界・実行環境の分離

### BR-002: サーバーからクライアントへの import 禁止
- ルール：検出されたドメインの `server/**` から同じドメインまたは別の検出されたドメインの `client/**` を import することを禁止
- 理由：レイヤーの逆転を防止

### BR-003: 共有レイヤーの純粋性
- ルール：`<discovered-domain-root>/shared/**` は共有レイヤーのポリシーで拒否される capability に依存できない
- デフォルトで拒否される capability：`ui`、`database`、`runtime`
- デフォルトの分類は既存の React/Next、Prisma、Node ランタイム、`packages/ui`、`packages/db`、`packages/infra`、アプリパスの挙動を維持します。
- `checkBoundaries.capabilities` で依存関係を capability に分類し、`checkBoundaries.policy.shared.denyCapabilities` で拒否ポリシーを設定します。
- 許可：capability が拒否されていない純粋な契約・スキーマへの依存
- 理由：契約レイヤーの純粋性をプロジェクトごとのスタックに合わせて強制

### BR-004: ドメイン間アクセスポリシー
- ルール：ドメイン間で内部パスを直接 import することを禁止
- 許可：`<other-discovered-domain-root>/shared/public` または明示された公開 API のみ
- 理由：内部実装を隠蔽し、変更の安全性を確保

### BR-005: アプリからドメインへの公開 API ポリシー
- ルール：`apps/**` から `<discovered-domain-root>/**` を import するときは対象ドメインのマニフェストで宣言された公開 API のみ許可
- 許可：`<discovered-domain-root>/client/public`、`server/public`、`shared/public` またはマニフェストで明示された公開 API
- 理由：composition root となるアプリがドメインの内部実装に結合するのを防止

### BR-006: 宣言されたドメイン依存ポリシー
- ルール：別のドメインの公開 API を import するには、対象ドメインをソースマニフェストの `dependsOn` に宣言している必要がある
- 許可：`dependsOn` に宣言されたドメインのマニフェスト公開 API
- 理由：実際のコード依存関係とドメイングラフを一致させ、隠れた結合を防止

### BR-007: 宣言的なドメイン制約

`checkBoundaries.denyDomainDependencies` に指定された対象ドメインへ解決される import を禁止します。宣言済みの公開 API にも適用され、BR-001 から BR-006 は維持されます。既定値は空のマップです。

## 2. 許可リスト

- `client -> shared`
- `server -> shared`
- `domain -> other-domain public API`
- `domain -> declared dependency public API`
- `app -> domain public API`

### コンパクトな単一レイヤー構成

マニフェストの公開 API カテゴリのうち、空でないものがちょうど1つの場合、そのドメインルート直下のファイルはカテゴリに対応するレイヤーとして分析されます。これは構成上の省略記法にすぎず、既存のレイヤールールと公開 API ルールはすべて引き続き適用されます。ADR 0009 を参照してください。

### ネストされたドメインルート

ドメインルートは、`paths.domains` 配下の任意の深さで、設定されたマニフェストファイル名から検出されます。BR-001 から BR-006 は `paths.domains/<name>` を仮定するのではなく検出されたルートを使用します。グループディレクトリは境界の識別子を持ちません。ADR 0011 を参照してください。

## 3. 違反出力形式

CLI は違反がある場合、次の構造を出力する必要があります。

```txt
[BOUNDARY_VIOLATION] BR-001
file: domains/order/client/use-order.ts
import: domains/order/server/order-service
line: 12
message: client layer cannot import server layer.
suggestion: move contract/type to shared or call via public API.
```

## 4. 終了コード

- `0`: 違反なし
- `1`: 違反あり
- `2`: 設定・マニフェスト解析エラー
- `3`: 内部実行エラー

## 5. 違反例

### 例 A
- ソース：`domains/product/client/list.ts`
- import：`domains/product/server/repository.ts`
- 結果：BR-001

### 例 B
- ソース：`domains/auth/shared/types.ts`
- import：`packages/ui/button`
- 結果：BR-003

### 例 C
- ソース：`domains/order/server/checkout.ts`
- import：`domains/product/server/internal/stock.ts`
- 結果：BR-004

### 例 D
- ソース：`apps/web/src/checkout.ts`
- import：`domains/order/server/internal/checkout.ts`
- 結果：BR-005

### 例 E
- ソース：`domains/order/server/checkout.ts`
- import：`domains/billing/server/public.ts`
- マニフェスト：`order.dependsOn` に `billing` が含まれていない
- 結果：BR-006
