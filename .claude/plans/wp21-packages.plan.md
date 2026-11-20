---
name: WP21 — packages
overview: Source packages resolve and are attributed, but every build recompiles every dependency. What is left is the content-addressed build cache (S4) and, only if someone asks for it by name, prebuilt distribution (S5, deferred).
spec: docs/wp21-packages.md
priority: 30
labels: [ready]
issue: 1911
stages:
  - id: s4-build-cache
    title: WP21 S4 — the build cache, keyed by package version, number mode, target, profile and compiler
    goal: A dependency compiled once is reused by a later build with the same package version, number mode, target, profile and compiler version, invisibly to the package author, and any key change misses.
    verification: node tests/run.js link && node tests/run.js packages && npm run check && npm run lint
    status: pending
    issue: 1937
    todos:
      - id: s4-key
        content: Define the cache key (package version, number mode, target, profile, compiler version) and its content-addressed store in src/ and the CLI — see WP21 S4 — the build cache
        status: pending
      - id: s4-reuse
        content: Reuse a cached package build in the link step so an unchanged dependency is not recompiled — see WP21 S4 — the build cache
        status: pending
      - id: s4-invalidate
        content: Add tests that change each key component and assert a miss, plus a hit run with identical output to a cold build — see WP21 S4 — the build cache
        status: pending
      - id: s4-docs
        content: Update the packages guide page under docs/guide/ and docs/wp21-packages.md §8 with what the cache does — see WP21 S4 — the build cache
        status: pending
  - id: s5-prebuilt
    title: WP21 S5 — prebuilt distribution
    goal: A closed-source package can ship a signatures-plus-proven-attributes sidecar the importer links against, if anyone asks for it by name.
    verification: node tests/run.js link && npm run check
    status: pending
    labels: [deferred]
    issue: 1942
    todos:
      - id: s5-sidecar
        content: Design the .d.nish.json sidecar of signatures and proven attributes in docs/wp21-packages.md §7 — see WP21 S5 — prebuilt distribution
        status: pending
---

# WP21 — packages

## Context
S1 to S3 have landed: package-scoped symbols, bare specifiers and the `nish` export condition, resolution diagnostics and package identity, the hostless-builtin refusal and dependency attribution. See [the design note](../../docs/wp21-packages.md). Spec: [design note](../../docs/wp21-packages.md). Diamond dependencies and a separate resolver tool are not planned.

## WP21 S4 — the build cache, keyed by package version, number mode, target, profile and compiler
Spec: [§8 Stages](../../docs/wp21-packages.md#8-stages).
Content-addressed by (package version, number mode, target, profile, compiler version) and invisible to the package author. It answers the cost §3 states honestly (source packages are recompiled). `nish run`'s cache is not this: it keeps the linked binary of a whole program and recompiles every run. Whole-program facts are the performance thesis (§3a), so the cache must not change the output of a build.
Likely files: `src/` link and package resolution, the CLI, `tests/link/`.

## WP21 S5 — prebuilt distribution
Deferred, possibly permanently ([§7](../../docs/wp21-packages.md#7-what-this-note-does-not-decide)). If ever needed the shape is a `.d.nish.json` sidecar of signatures plus proven attributes so the importer's `declare` keeps its facts. It costs generics and pins the mode and target. Do not build it until somebody asks for it by name.
