# Public Preview Release Checklist

## Code and Contracts

- [x] BR-001 through BR-006 are implemented and tested
- [x] schema-backed generated contracts are runtime validated
- [x] CLI diagnostics include stable codes and recovery suggestions
- [x] manifest, diagnostic, contract, and packaging specs are documented
- [x] generated-code breaking decisions are recorded in ADR 0002
- [x] packaging direction is recorded in ADR 0004

## Artifact Verification

- [x] runtime builds to ESM JavaScript and declarations
- [x] runtime tarball contains only public package files
- [x] release CLI reports `--version`
- [x] offline clean-room installation passes outside the repository
- [x] `cargo install --git` source fallback passes with registry access
- [x] online clean-room installation passes in GitHub Actions
- [x] Node.js 20, 22, and 24 runtime jobs pass
- [x] Linux, macOS Intel/arm64, and Windows CLI jobs pass
- [x] release workflow dry-run produces all four CLI archives and runtime tarball

## Repository Readiness

- [x] MIT `LICENSE`
- [x] `SECURITY.md`
- [x] `CHANGELOG.md`
- [x] versioned `v0.1.0` through `v0.5.0` release notes
- [x] PR and tag workflows validate the release-note format
- [x] public quickstart and CLI install guide
- [x] Node and native target support matrix
- [x] npm trusted-publishing workflow with provenance is configured
- [x] merge the framework and release-packaging pull requests
- [x] enable GitHub private vulnerability reporting

## Registry and Release

- [x] deprecate the accidental repository snapshot published as `boundra@0.1.0`
- [x] configure npm trusted publishing for `boundra`
- [x] publish `boundra@0.1.1`
- [x] verify the public npm package in a fresh project
- [x] create and push the `v0.1.1` tag
- [x] verify GitHub Release checksums and installation instructions
- [x] publish and verify `boundra@0.1.2`
- [x] create and push the `v0.1.2` tag
- [x] publish and verify `boundra@0.2.0`
- [x] create and push the `v0.2.0` tag
- [x] publish and verify `boundra@0.2.1`
- [x] create and push the `v0.2.1` tag
- [x] publish and verify `boundra@0.2.2`
- [x] create and push the `v0.2.2` tag
- [x] publish and verify `boundra@0.3.0`
- [x] create and push the `v0.3.0` tag
- [x] publish and verify `boundra@0.4.0`
- [x] create and push the `v0.4.0` tag
- [x] publish and verify `boundra@0.5.0`
- [x] create and push the `v0.5.0` tag

## Oddmash Ownership Migration

- [x] Verify the npm trusted publisher points to `Oddmash/boundra` and `release.yml` before publishing the next version (configuration present; npm validation requires the next publish).
- [x] Verify old published CLI versions can still download their matching archived releases through GitHub redirects (v0.6.0 verified in the Oddmash release dry-run).
- [x] Run the release workflow dry-run from Oddmash and verify all artifacts ([v0.7.0 dry-run](https://github.com/Oddmash/boundra/actions/runs/45559355221)).

## Release Trigger

After the release preparation commit is merged into `main`, run the Release
workflow on `main` with the exact version and `publish` enabled. By default,
manual runs only verify and build artifacts. An explicit publish run verifies
the main commit, builds all artifacts, creates the matching immutable tag, and
publishes npm and the GitHub Release in the same run.

Alternatively, push a version tag pointing to a commit on `main` to trigger
publication. Never move an existing version tag or create the GitHub Release
manually before the tag exists.

If a Release for the tag already exists, the workflow updates its title and
notes and uploads the generated assets with replacement enabled. This makes the
GitHub Release step safe to retry after a partial publication.

No public release should be announced while any unchecked item in Artifact
Verification, Repository Readiness, or Registry and Release remains.
