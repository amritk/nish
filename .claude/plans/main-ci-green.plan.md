---
name: Get main's CI green again
overview: Since the 0.27.0 release commit, CI's test shard 1/4 fails seven WP12 package checks on main, because main now pins its platform packages one release behind its own version (#1039) and the package section installs the main tarball with those stale pins. Pack the main package the way release.yml publishes it, pins stamped to its own version, so the section tests the product again and the release can go out.
stages:
  - id: pinned-pack
    title: "fix(cli): install the main package with its pins stamped, as release.yml publishes it"
    goal: The WP12 package section in tests/run.js installs a main package whose optionalDependencies pin its own version, so the staged platform package satisfies it and npm fetches nothing from the registry
    verification: node tests/run.js package reports 0 failed, and npm run check and npm run lint exit 0
    todos:
      - id: stamp-pins-before-install
        content: Stamp the packed main package's pins to info.version with scripts/pin-platform-packages.mjs --dir on an extracted copy before the installs in the WP12 package section of tests/run.js — see Pinned pack
        status: pending
      - id: assert-no-nested-platform
        content: Add a check that no platform package is installed nested under node_modules/nish/node_modules — see Pinned pack
        status: pending
      - id: verify-package-section
        content: Run node tests/run.js package, npm run check and npm run lint, and record the before and after FAIL lines in the PR body — see Verification
        status: pending
---

## Context

CI on `main` is red at `1391cf8` and at `540e989` (the `chore(release): 0.27.0` commit): `test (ubuntu-latest, shard 1/4)` fails seven checks in the WP12 package section of [tests/run.js](../../tests/run.js), from `installed nish --version works from an unrelated cwd` through `the swapped bin execs the binary inside its own platform package`. The installed `nish` prints `nish 0.26.0`, and `--help` names `prefix/node_modules/nish/node_modules/@amritk/nish-x86_64-linux/docs/AI.md`.

The cause: #1039 (`5db6f0b`) made the release commit bump only `version`, leaving `optionalDependencies` one release behind until the post-publish lockfile PR lands ([scripts/pin-platform-packages.mjs](../../scripts/pin-platform-packages.mjs) header). So `nish@0.27.0` pins `@amritk/nish-x86_64-linux@0.26.0`. The section packs the main package from the checkout as-is, then stages a platform package from `build/nish` with [scripts/platform-package.mjs](../../scripts/platform-package.mjs), which versions it `0.27.0`. The top-level `0.27.0` does not satisfy the `0.26.0` pin, so `npm install` fetches the published `0.26.0` nested under `node_modules/nish/node_modules/`, the launcher resolves that one, and every check that expects the staged binary or the stub fails.

The failure also blocks the release: `release.yml` runs CI at the tag, shard 1/4 failed there (run 41008039599), so `release`, `binary`, `publish to npm` and `regenerate package-lock.json` were all skipped. 0.27.0 is tagged but never published, and no lockfile PR exists to move the pins. Without this fix the window never closes.

## Approach

Mirror the product, not the checkout. The published main package has its pins stamped to its own version by the `release` job just before `npm pack` (`pin-platform-packages.mjs`, first bullet of its header). The section exists to test what users install, so it stamps the same way. The alternative, `platform-package.mjs --version <pinned version>`, would stage a platform package versioned behind the compiler it carries, which no release ever ships. The checkout's own `package.json` is never edited: shards share the tree.

## Pinned pack

**Owns:** `tests/run.js`

In the WP12 package section (`tests/run.js`, the `npm pack` near line 22897 and the installs that follow it):

- Extract the packed tarball into a directory under `pkgDir`, run `node scripts/pin-platform-packages.mjs <info.version> --dir <extracted>/package`, and `npm pack` that directory into the tarball both installs use (the `--omit=optional` refusal install and the platform round trip). Whether to repack or install the directory is the worker's call; repacking keeps `files` load-bearing, which the section's comments insist on.
- The checks that read the checkout's pins (the `package-lock.json pins the same platform packages` check near line 23207 and its neighbours) stay as they are: they test the checkout, which legitimately lags.
- Add one check after the platform install: nothing exists at `prefix/node_modules/nish/node_modules/@amritk`. A nested platform package is exactly this regression, and today it is only visible through seven downstream symptoms.
- Comment the stamping step with why: main's pins lag its version between a release commit and its lockfile PR (#1039), and the published package never does.

## Out of scope

- `release.yml`, `release-pr.yml`, `pin-platform-packages.mjs` and the pins in `package.json` / `package-lock.json`. The lag is intended.
- Re-running or re-tagging the 0.27.0 release, and the open Release PR #1066. Releasing is a human's call.
- The one-off `crypto-bench: portableRounds fails an OpenSSL mask that clears nothing X25519 uses (AVX only)` failure in shard 2/4 at `a3a4dec`. It has not recurred on main's two later runs.

## Tests

The section is its own test. The new nested-install check must fail on today's main (pins `0.26.0`, version `0.27.0`) without the stamping and pass with it; the PR body says so with the output of both.

## Verification

```
node tests/run.js package     # 0 failed; read the summary's skip count
npm run check
npm run lint
```

The full suite is CI's: every `test (…, shard N/4)` row green on the PR head.
