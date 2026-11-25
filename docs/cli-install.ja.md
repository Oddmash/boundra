# Boundra CLI のインストール

## npm パッケージ（推奨）

`boundra` パッケージには対応するネイティブ CLI のクロスプラットフォームランチャーが含まれます。初回の実行時に GitHub Release のアーカイブをダウンロードし、SHA-256 チェックサムを検証してバイナリをキャッシュします。

```bash
pnpm add boundra zod
pnpm exec boundra --version
```

管理された環境やオフライン環境では、`BOUNDRA_CLI_PATH` を既存のバイナリに設定してください。

## ネイティブリリース

対応する GitHub Release からプラットフォーム用のアーカイブをダウンロードし、`checksums-sha256.txt` と照合して検証した後、`boundra` を `PATH` に配置します。

対応するプレビューアーカイブ：

- Linux x64: `x86_64-unknown-linux-gnu`
- macOS Intel: `x86_64-apple-darwin`
- macOS Apple Silicon: `aarch64-apple-darwin`
- Windows x64: `x86_64-pc-windows-msvc`

インストールを確認します。

```bash
boundra --version
boundra --help
```

## ソースからのインストール（代替手段）

安定版 Rust ツールチェーンを使用する場合：

```bash
cargo install --git https://github.com/Oddmash/boundra boundra-cli
```

Rust ツールチェーンが不要なため、ネイティブリリースの利用を推奨します。
