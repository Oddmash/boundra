# Boundra 公開版クイックスタート

## 前提条件

- TypeScript アプリケーションには Node.js 20 以降
- pnpm、npm、またはその他のパッケージマネージャー

## ランタイムのインストール

```bash
pnpm add boundra zod
```

npm パッケージにはネイティブ CLI のランチャーが含まれます。ワークスペースを初期化します。

```bash
pnpm exec boundra init --name my-app
```

## プロジェクトのフローを作成する

```bash
pnpm exec boundra create-domain order
pnpm exec boundra create-domain billing
pnpm exec boundra add-dependency billing/order
pnpm exec boundra generate query order/get-order
pnpm exec boundra generate mutation order/submit-order
pnpm exec boundra generate route billing/create-invoice
pnpm exec boundra check-boundaries --format json
pnpm exec boundra graph-domains --format mermaid
```

生成された契約は安全な空の Zod オブジェクトから始まります。そのフィールドをドメイン固有の入力・結果スキーマで置き換え、生成されたクライアントまたはサーバーのアダプターを実装します。Boundra が既存の生成ファイルを上書きすることはありません。

## CI ゲート

```bash
pnpm exec boundra check-boundaries --root . --format json
```

契約の所有権については `docs/contract-schema-spec.md` を、ネイティブ CLI のインストールについては `docs/cli-install.md` を参照してください。
