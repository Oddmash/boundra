# Boundary Performance

Boundra performance claims use a reproducible synthetic workspace rather than
informal observations from small examples.

## Run

```bash
cargo build --release -p boundra-cli
pnpm benchmark:boundaries
pnpm benchmark:boundaries:large
```

The benchmark creates a temporary app with 1,000 or 10,000 TypeScript source
files. Every file imports a declared domain public API, so the run measures
project loading, import scanning, alias resolution, and boundary evaluation
without producing violations.

Reported values:

- first-run wall time (`cold_ms`)
- median subsequent wall time (`warm_median_ms`)
- maximum observed resident set size (`max_rss_mb`) where `/usr/bin/time`
  exposes it
- operating system, architecture, Node version, file count, and iterations

## Regression Gate

CI runs a 1,000-file smoke benchmark with deliberately broad ceilings. The
gate is intended to catch catastrophic regressions, not normal runner variance.
Release decisions should compare repeated results on the same environment.

## Incremental scan experiment (2026-11-25)

Run `cargo test --release -p boundra-cli --test incremental-experiment -- --nocapture`.
The experiment retains exact source contents and extracted imports in memory,
re-enumerates included files each time, and re-evaluates rules against the
current project model. It compares complete import records, coverage and
violations after source edits, file addition/deletion, alias/manifest updates,
and ignore configuration changes in a 1,000-file two-domain synthetic workspace.

Four local release-mode samples (`darwin-arm64`) gave full/cached warm times
of approximately 16.7–19.0 ms / 16.5–20.0 ms and one-edit times of
16.3–20.6 ms / 16.5–21.7 ms. These measurements exclude project loading and
startup. The candidate did not demonstrate a consistent improvement, so the
cache remains test-only and is not enabled in the published CLI. Future
evaluation should measure a real workspace and memory impact before any rollout.

## Current Baseline

Local baseline captured on 2026-07-03 (`darwin-arm64`, Node 24.14.0):

| Files | Cold | Warm median | Peak RSS |
| ---: | ---: | ---: | ---: |
| 1,000 | 20.74 ms | 18.92 ms | 2.55 MB |
| 10,000 | 163.32 ms | 164.20 ms | unavailable in sandbox |

Run the benchmark again on each release candidate and record materially changed
results in the matching release note. Do not compare different hardware as if
the results were equivalent. Linux CI reports peak RSS through `/usr/bin/time`.
