<a id="install-the-boundra-cli"></a>

# Boundra CLI 설치

<a id="npm-package-recommended"></a>

## npm 패키지 (권장)

`boundra` 패키지에는 대응하는 네이티브 CLI를 위한 크로스 플랫폼 실행기가 포함되어 있습니다. 처음 실행하면 GitHub Release 아카이브를 다운로드하고 SHA-256 체크섬을 검증한 뒤 바이너리를 캐시에 저장합니다.

```bash
pnpm add boundra zod
pnpm exec boundra --version
```

통제된 환경이나 오프라인 환경에서는 `BOUNDRA_CLI_PATH`를 기존 바이너리 경로로 설정합니다.

<a id="native-release"></a>

## 네이티브 릴리스

해당 GitHub Release에서 플랫폼에 맞는 아카이브를 다운로드하고 `checksums-sha256.txt`와 대조하여 검증한 다음, `boundra`를 `PATH`에 추가합니다.

지원하는 프리뷰 아카이브:

- Linux x64: `x86_64-unknown-linux-gnu`
- macOS Intel: `x86_64-apple-darwin`
- macOS Apple Silicon: `aarch64-apple-darwin`
- Windows x64: `x86_64-pc-windows-msvc`

설치를 확인합니다.

```bash
boundra --version
boundra --help
```

<a id="source-fallback"></a>

## 소스 설치 대안

안정 버전 Rust 툴체인이 설치된 환경에서는 다음 명령을 사용할 수 있습니다.

```bash
cargo install --git https://github.com/Oddmash/boundra boundra-cli
```

네이티브 릴리스는 Rust 툴체인이 필요하지 않으므로 권장합니다.
