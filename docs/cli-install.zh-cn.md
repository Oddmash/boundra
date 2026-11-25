# 安装 Boundra CLI

## npm 包（推荐）

`boundra` 包包含对应原生 CLI 的跨平台启动器。首次调用会下载 GitHub Release 压缩包、验证其 SHA-256 校验和并缓存二进制文件。

```bash
pnpm add boundra zod
pnpm exec boundra --version
```

在受控或离线环境中，将 `BOUNDRA_CLI_PATH` 设置为已有二进制文件的路径。

## 原生发行版

从对应 GitHub Release 下载适用于目标平台的压缩包，使用 `checksums-sha256.txt` 验证其校验和，然后将 `boundra` 放在 `PATH` 中。

支持的预览版压缩包：

- Linux x64: `x86_64-unknown-linux-gnu`
- macOS Intel: `x86_64-apple-darwin`
- macOS Apple Silicon: `aarch64-apple-darwin`
- Windows x64: `x86_64-pc-windows-msvc`

验证安装：

```bash
boundra --version
boundra --help
```

## 从源码安装（备用方式）

使用稳定版 Rust 工具链：

```bash
cargo install --git https://github.com/Oddmash/boundra boundra-cli
```

建议优先使用原生发行版，因为它不需要 Rust 工具链。
