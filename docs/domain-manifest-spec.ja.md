# ドメインマニフェスト仕様

## 1. ファイルの位置

```txt
<configured-domains-path>/[<group>/]<domain>/<configured-manifest-file>
```

Boundra は `paths.domains` 配下から設定されたマニフェストファイル名を再帰的に検出します。マニフェストの親ディレクトリが物理的なドメインルートとなり、`name` が安定した論理的な識別子となります。

## 2. 目的

`domain.json` はドメインの公開 API と宣言されたドメイン依存関係の唯一の信頼できる情報源です。

次の機能で使用されます。

- `check-boundaries`
- `graph-domains`
- `generate route|query|mutation`
- `add-dependency`
- BR-004 公開 API 検証
- BR-006 宣言された依存関係の検証

## 3. スキーマの構造

```json
{
  "$schema": "https://boundra.dev/schemas/domain-manifest.v1.json",
  "name": "billing",
  "version": "0.1.0",
  "publicApi": {
    "client": ["./client/public.ts"],
    "server": ["./server/public.ts"],
    "shared": [
      "./shared/public.ts",
      "./shared/contracts/create-invoice.ts"
    ]
  },
  "dependsOn": ["order"],
  "policies": {
    "allowCrossDomainServerImport": false,
    "allowMcpWrite": false
  }
}
```

## 4. 現在読み込まれるフィールド

現在の CLI は次のフィールドを読み込み、検証します。

- `name`
- `publicApi.client`
- `publicApi.server`
- `publicApi.shared`
- `dependsOn`

その他のフィールドが存在しても構いません。可能な限り保持されますが、まだ強制されません。

## 5. 検証ルール

- `name` はドメインのフォルダー名と一致する必要があります。
- 異なるルートで `name` が重複することは無効です。
- `dependsOn` の項目は既存のドメインを参照する必要があります。
- `dependsOn` は非循環グラフを形成する必要があります。
- 公開 API のパスは相対パスでなければなりません。
- 公開 API のパスは既存のファイルを指していなければなりません。
- 公開 API のパスで `internal` パスを公開してはいけません。
- 設定されたマニフェストファイルがないディレクトリは整理用にすぎず、ドメインとして読み込まれません。

## 6. コード生成の挙動

`generate route|query|mutation <domain>/<name>` は共有契約ファイルを作成します。

```txt
domains/<domain>/shared/contracts/<name>.ts
```

生成後、CLI は契約を次の項目に追加します。

```json
{
  "publicApi": {
    "shared": ["./shared/contracts/<name>.ts"]
  }
}
```

既存の `publicApi.shared` 項目は保持されます。重複する項目は追加されません。

生成時には `shared/public.ts` にも冪等な export を追加します。

## 7. コンパクトな単一レイヤードメイン

空でない公開 API カテゴリがちょうど1つのドメインは、実装ファイルをドメインルート直下に配置できます。

```txt
domains/comparison/
├── domain.json
├── public.ts
├── storage.ts
└── tests/
    └── storage.spec.ts
```

```json
{
  "publicApi": {
    "client": ["./public.ts"],
    "server": [],
    "shared": []
  }
}
```

ルート直下のファイルは境界検証においてその単一レイヤーを継承します。明示的なレイヤーディレクトリは通常の意味を保持し、ルート直下のネストされたディレクトリはコンパクトなレイヤーを継承しません。2つ以上の公開 API カテゴリを公開するドメインは、明示的なレイヤーディレクトリを使用する必要があります。

## 8. 依存関係の更新の挙動

`add-dependency <domain>/<dependency>` は依存関係を `dependsOn` に追加します。両方のドメインが存在する必要があり、自己依存は拒否され、繰り返し呼び出しても重複は追加されません。依存関係の循環を生じさせるエッジは、マニフェストを変更することなく拒否されます。

## 9. バージョン管理

初期スキーマバージョン：

```txt
v1
```

スキーマの変更はまず追加的な変更を優先します。破壊的変更には ADR が必要です。
