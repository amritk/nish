# Changelog

All notable changes to `nish` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

**This file is generated.** A section is written when a release is cut, from
the commits that release contains: `scripts/changelog-gen.mjs` reads each
commit's subject for the heading and its body for the prose, and writes
`changelog/<version>.json`. That JSON is the record — it is what the website
reads — and the section below is rendered from it. To fix a wording, edit the
JSON in the release pull request and re-render; editing here is overwritten.

A section is an index rather than an account: one line per change, its title
and a link to the pull request it landed in, under the heading its type gives.
The prose each commit wrote is in the JSON and on the website, and the pull
request has the diff and the discussion, so a reader scanning a release sees
what changed and one click to the rest.

The release pull request is where a release is reviewed: every merge to `main`
refreshes it with the version bump, the JSON and this section, and merging it
creates the tag. [docs/wp12-release.md](docs/wp12-release.md) has the
procedure, and `CLAUDE.md` has the commit convention the headings come from.
Between releases `[Unreleased]` is empty, because there is nothing to write by
hand — the git log is the working account until a release turns it into one.

## [Unreleased]

## [0.3.0] - 2026-09-18

### Added

- interop: Run an N-API export on libuv's thread pool with `--emit-napi-async` ([#67](https://github.com/amritk/nish/pull/67))
- checker: Monomorphise generic classes and interfaces ([`9000434`](https://github.com/amritk/nish/commit/9000434))
- checker: Resolve a package by name through the `nish` export condition ([`4bf07f0`](https://github.com/amritk/nish/commit/4bf07f0))
- checker: Add `CPtr`, the opaque pointer a C function hands back ([`50410a5`](https://github.com/amritk/nish/commit/50410a5))
- release: Build and smoke-test a native compiler for each supported target ([`16110e2`](https://github.com/amritk/nish/commit/16110e2))
- runtime: Divide a range of work across threads ([#88](https://github.com/amritk/nish/pull/88))

### Fixed

- self: Let the checker state the member-header rules the parser was eating ([`ca7d4a5`](https://github.com/amritk/nish/commit/ca7d4a5))
- checker: Name a `nish/` module by the package, not by the importer ([`97f0f4e`](https://github.com/amritk/nish/commit/97f0f4e))

### Performance

- tests: Compile the golden cases in one process instead of one each ([`9072355`](https://github.com/amritk/nish/commit/9072355))
- tests: Link the golden cases against a runtime built once per run ([`7b8815f`](https://github.com/amritk/nish/commit/7b8815f))
- checker: Fold a proven `substring` clamp, and warn where the proof did not come off ([`19b4569`](https://github.com/amritk/nish/commit/19b4569))
- codegen: Release the arena scope ahead of a tail call ([#85](https://github.com/amritk/nish/pull/85))
- ci: Stop re-running the whole suite to widen one gate, and cache Node's module compilation ([#87](https://github.com/amritk/nish/pull/87))
- codegen: Mark a scalar-argument tail call `tail` ([#86](https://github.com/amritk/nish/pull/86))

### Changed

- self: Declare every function in the self-hosted compiler as an arrow ([`de62d60`](https://github.com/amritk/nish/commit/de62d60))

### Documentation

- checker: Close contiguous class arrays by costing the migration ([#73](https://github.com/amritk/nish/pull/73))
- codegen: Refute the invariant array header and re-scope item 1b ([#70](https://github.com/amritk/nish/pull/70))
- tests: Record four measurement traps the tooling hides ([`6aadfff`](https://github.com/amritk/nish/commit/6aadfff))

### Build

- self: Add the codemod and the byte-for-byte IR diff stage C's rewrite needs ([`15c663a`](https://github.com/amritk/nish/commit/15c663a))

### CI

- bootstrap: Skip the rolling freeze where no seed can exist, fail where one is missing ([#68](https://github.com/amritk/nish/pull/68))


## [0.2.0] - 2026-09-13

### Added

- runtime: Add readdirSync, spawnSyncTo and monotonicNanos, and the test runner they enable ([#47](https://github.com/amritk/nish/pull/47))
- runtime: Give every thread its own arena behind `--threads` ([#55](https://github.com/amritk/nish/pull/55))
- checker: Give every symbol a package scope ([#57](https://github.com/amritk/nish/pull/57))
- checker: Read a numeric `enum` as a distinct `i32` type ([#54](https://github.com/amritk/nish/pull/54))
- codegen: Add slice, a string cut that checks instead of clamping ([#53](https://github.com/amritk/nish/pull/53))
- codegen: Store an array of records contiguously ([#51](https://github.com/amritk/nish/pull/51))
- checker: Compile generic functions by monomorphisation ([#50](https://github.com/amritk/nish/pull/50))
- checker: Call a C function with `declare function` ([#62](https://github.com/amritk/nish/pull/62))
- checker: Import the runtime builtins from `nish:fs`, `nish:process` and `nish:io` ([#58](https://github.com/amritk/nish/pull/58))
- std: Add std/json, and check the CLI contract from a harness in Nish ([#65](https://github.com/amritk/nish/pull/65))
- self: Let a construct be implemented once, in `self/` ([#66](https://github.com/amritk/nish/pull/66))

### Fixed

- codegen: Measure a -g position from the declaration, and its column in bytes ([#60](https://github.com/amritk/nish/pull/60))
- self: Assert the seed equality only when the seed is stage0 ([#61](https://github.com/amritk/nish/pull/61))
- checker: Key two generic rules on words only they contain ([#64](https://github.com/amritk/nish/pull/64))

### Performance

- checker: Prove an index in range and emit no bounds check ([#56](https://github.com/amritk/nish/pull/56))

### Changed

- runtime: Split the system-call half into runtime_os.c, with a ceiling each ([#59](https://github.com/amritk/nish/pull/59))

### Documentation

- readme: Centred header, status badges and section rules ([#45](https://github.com/amritk/nish/pull/45))
- release: Fix the install links and record the npm name conflict ([#49](https://github.com/amritk/nish/pull/49))
- cli: Add a rules card the compiler's own tests keep honest ([#63](https://github.com/amritk/nish/pull/63))

### Tests

- self: Pin every diagnostic wording a program can provoke ([#52](https://github.com/amritk/nish/pull/52))


## [0.1.1] - 2026-09-12

### Fixed

- release: Start release.yml at the tag the release train pushes ([#43](https://github.com/amritk/nish/pull/43))


## [0.1.0] - 2026-09-12

### Fixed

- tests: Regenerate the stage1 goldens for the corpus WP25 left ([`0d233f4`](https://github.com/amritk/nish/commit/0d233f4))
- release: Build the notes from conventional commits only ([#37](https://github.com/amritk/nish/pull/37))
- release: Unstick the `---` rule and render the notes as an index ([#40](https://github.com/amritk/nish/pull/40))
- checker: Give a concise arrow body the context a `return` has ([#41](https://github.com/amritk/nish/pull/41))

### Performance

- checker: Add arithmetic and arena-drop performance warnings ([#38](https://github.com/amritk/nish/pull/38))
- codegen: Close the last two gaps in the benchmark suite ([#39](https://github.com/amritk/nish/pull/39))

### Documentation

- bench: Regenerate the benchmark report against Go and Rust ([#36](https://github.com/amritk/nish/pull/36))

### Build

- release: Generate releases from commits, on a release train ([`8ac1728`](https://github.com/amritk/nish/commit/8ac1728))

### CI

- release: Give the release pull request a conventional title ([#33](https://github.com/amritk/nish/pull/33))

### Internal

- release: Start at 0.0.0 and stop pinning the version in goldens ([`d17e294`](https://github.com/amritk/nish/commit/d17e294))


[Unreleased]: https://github.com/amritk/nish/commits/main
[0.1.0]: https://github.com/amritk/nish/releases/tag/v0.1.0
[0.1.1]: https://github.com/amritk/nish/releases/tag/v0.1.1
[0.2.0]: https://github.com/amritk/nish/releases/tag/v0.2.0
[0.3.0]: https://github.com/amritk/nish/releases/tag/v0.3.0
