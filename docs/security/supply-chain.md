# Supply chain: install, launcher, seed fetch and release workflows

The security audit's record for the distribution stage (issue #363). It says
what was checked, how, what was found, and which test pins each answer. Base
is `main` at `0d362c5`; every `file:line` in the findings table refers to that
commit.

## Scope

| File | What was read |
| --- | --- |
| [`install.sh`](../../install.sh) | the whole script: `nish_asset`, `nish_write_wrapper`, `nish_abspath`, `nish_version_of`, the argument loop, `--uninstall`, the latest-version redirect, the download, the unpack, the version check, the swap and `restore_backup` |
| [`bin/nish`](../../bin/nish), [`bin/launcher.js`](../../bin/launcher.js), [`bin/packaging.js`](../../bin/packaging.js) | `nativeCompiler`, `handOver`, `refuse`, `assetFor`, `targetForAsset`, `platformPackageName`, `noCompilerMessage` |
| [`scripts/postinstall.mjs`](../../scripts/postinstall.mjs) | `swap`, `shellQuote`, the shim it writes |
| [`scripts/platform-package.mjs`](../../scripts/platform-package.mjs) | the manifest it writes |
| [`scripts/fetch-seed.sh`](../../scripts/fetch-seed.sh) | the short-circuit and the call into `install.sh` |
| [`scripts/verify-binaries.sh`](../../scripts/verify-binaries.sh), [`scripts/bootstrap.sh`](../../scripts/bootstrap.sh), [`scripts/build.sh`](../../scripts/build.sh), [`scripts/nish-compiler.sh`](../../scripts/nish-compiler.sh) | every download, temp file, `rm -rf` and `exec` |
| [`.github/workflows/`](../../.github/workflows/) | `ci.yml`, `release.yml`, `release-pr.yml`, `pr-body.yml`, `pr-title.yml`, `ct-timing.yml`: triggers, `permissions:`, every `uses:`, every `run:` script, every `secrets.` and `github.token` |
| [`.github/seed-targets.json`](../../.github/seed-targets.json) | what reads it and what it can steer |
| [`runtime/nish.mjs`](../../runtime/nish.mjs), [`runtime/shim.mjs`](../../runtime/shim.mjs) | the globals installed, the `nish/` resolve hook, `spawnImpl`, `getRandomValues`, every object used as a map |
| [`web/wasi.mjs`](../../web/wasi.mjs), [`web/worker.mjs`](../../web/worker.mjs), [`web/compile.mjs`](../../web/compile.mjs), [`web/bytes-worker.mjs`](../../web/bytes-worker.mjs) | every WASI import, how guest pointers become host memory, `MemoryFileSystem`, the worker protocol |

## Threat model

What an attacker controls, by channel:

- **The network and the release.** Downloads go over HTTPS to github.com, so a
  network attacker alone is out of scope. Release assets are not: a GitHub
  release is mutable (every release of this repository reports
  `immutable: false`), so anyone who holds write access, or a token with it,
  can delete an asset and upload another under the same name. The question is
  whether that replacement then runs on a user's machine or in CI.
- **Pull request text and forks.** Anyone can open a pull request from a fork
  with any title, body and branch name. The question is whether any of that
  reaches a shell, a secret or a write token.
- **The npm registry.** Packages are installed by `npm` against the lockfile's
  integrity hashes. The question is what an install executes.
- **A program run under the JS hosts.** The program itself is trusted (it is
  the user's own code); its inputs are not. For `web/wasi.mjs` the guest is a
  compiled module, and the host must not answer a call with less than it
  promises.

Severity follows the plan, with this stage's reading: code execution on a
user's machine or in CI through a tampered download or a workflow injection is
Critical; a secret or write token reachable from a fork is High; denial of
service is Medium; hardening and drift are Low.

## Method

- **Read.** Every file in the scope, line by line, with the questions the plan
  names: any `curl | sh`, any download that is run without a pinned checksum,
  any `${{ }}` inside `run:`, any `pull_request_target` or `workflow_run`, any
  action pinned by tag, any job with more permissions than it uses, and in the
  JS hosts any `eval`, `new Function`, `shell: true`, or object used as a map
  with keys from outside.
- **Traced every download to what runs it.** `install.sh` (the `curl | sh`
  path), `scripts/fetch-seed.sh` (the session hook, `ci.yml`'s `test`,
  `runner` and ct-timing jobs, `release.yml`'s `binaries` job,
  `scripts/bootstrap.sh` with no seed), and `ci.yml`'s `bootstrap` and
  `nish-cmp` jobs, which downloaded with `gh release download` on their own.
- **Measured the release assets.** The GitHub API's `digest` for every
  `nish-<version>-<asset>.tar.gz` from 0.1.1 to 0.15.0 (47 files) was read on
  2026-10-02, and all 47 were then downloaded and hashed locally: every one
  matched the digest now pinned in `install.sh`. No release attaches a
  checksum file.
- **Ran `install.sh` against a stand-in release.** A `curl` first on `PATH`
  serves fixture files and logs every URL; the fixture compiler records that
  it ran. That is how every `install.sh` test below observes whether an
  unverified binary was executed.
- **Linted the workflows.** `actionlint` 1.7.7 (its tarball checked against its
  own `checksums.txt`) over all six files, before and after, with and without
  its shellcheck integration: no errors either side, and the only shellcheck
  notes are info-level (SC2016 on deliberate single quotes, SC2153 on
  variables set in `env:`). `shellcheck -S warning` over every script CI lints
  is clean.
- **Exercised the WASI host directly.** `WasiHost` over a bare
  `ArrayBuffer`, with `globalThis.crypto` removed, with a request longer than
  one Web Crypto call can fill, and with a range past the end of memory.

## Findings

| Id | Severity | Where (at `0d362c5`) | Finding | Disposition |
| --- | --- | --- | --- | --- |
| SC-1 | Critical | `install.sh:228`, `:237`, `:261` | `install.sh` downloaded the release tarball, unpacked it and ran its `bin/nish --version` with no checksum at all. A replaced release asset ran on every machine that installed it through `curl \| sh`, and through `scripts/fetch-seed.sh` in the session hook, in `ci.yml`'s `test` and `runner` jobs, in ct-timing, and in `release.yml`'s `binaries` job, where the seed builds the next release. | Fixed. Nothing is unpacked or run before its SHA-256 matches: the 47 tarballs up to 0.15.0 are pinned in `install.sh` (`nish_pinned_sha256`), and a later release is checked against the `SHA256SUMS` it attaches (SC-2). No digest, no install. Tests: `install.sh refuses a release with no SHA256SUMS and no pinned digest, without running it`, `… whose SHA-256 is not the one SHA256SUMS gives …`, `… SHA256SUMS has no line for …`, `install.sh holds a pinned release to its pinned digest, over a SHA256SUMS swapped with the tarball`, `install.sh's 47 pinned digests are well formed and cover every 0.15.0 seed`. |
| SC-2 | Critical | `.github/workflows/release.yml:559` | No release published a checksum, so nothing could verify one. | Fixed. The `release` job writes `SHA256SUMS` over every attached file and attaches it. Test: `release.yml computes a SHA256SUMS over the release's files and attaches it`. |
| SC-3 | Critical | `.github/workflows/ci.yml:470`, `:584` | The `bootstrap` and `nish-cmp` jobs fetched the seed with `gh release download`, untarred it and ran it, on every push and pull request, outside the one download path. | Fixed. Both take the seed through `scripts/fetch-seed.sh`, so through SC-1's check. Test: `ci.yml takes every seed through scripts/fetch-seed.sh, never a bare download`. |
| SC-4 | Medium | `web/wasi.mjs:497` | `random_get` filled the buffer from `Math.random` and answered success when the host has no `crypto.getRandomValues`. This is the call `crypto.getRandomValues` in a program compiled for `--profile wasi` reaches, so keys and nonces would have come from a non-cryptographic generator, silently. Unreachable on the hosts this project supports (Node 22, current browsers), which is why it is not High. | Fixed. It answers `ENOSYS`; `getentropy` then fails and `nish_random_fill` (`runtime/runtime-host.c`) exits 1 with its entropy message. Test: `wasi random_get with no CSPRNG on the host answers ENOSYS and writes nothing`. |
| SC-5 | Low | `web/wasi.mjs:498` | `random_get` passed the whole request to one `getRandomValues` call, which throws `QuotaExceededError` above 65,536 bytes, out of the import and through the guest as a trap. The Nish runtime asks for at most 256 bytes a call (`getentropy`), so this reached only another guest of the same host. And it took memory with `subarray`, which clamps: a range past the end filled fewer bytes than asked and still reported success. | Fixed. Filled in 64 KiB pieces; a range outside memory is `EFAULT`. Tests: `wasi random_get fills a request longer than 65,536 bytes to its last byte`, `wasi random_get refuses a range past the end of memory with EFAULT, writing nothing`. |
| SC-6 | Low | `install.sh:284` with the trap at `:224` | Installing into a directory that exists and is not an install (`--dir ~/projects`) moved it aside as the "backup", and the exit trap deleted it once the install succeeded. | Fixed. A non-empty directory without a `bin/nish` is refused before anything is downloaded. Test: `install.sh refuses to install over a non-empty directory that is not an install, and leaves it whole`. |
| SC-7 | Low | `install.sh:170` | `--uninstall` ran `rm -rf` on whatever `--dir` or `NISH_INSTALL` named. | Fixed. It refuses a directory with no `bin/nish`. Test: `install.sh --uninstall refuses a directory with no bin/nish in it, and leaves it whole`. |
| SC-8 | Low | `install.sh:109` | The wrapper spliced the install path between single quotes unescaped, so a `'` in it ended the string and the rest ran as shell. `scripts/postinstall.mjs` already quoted the same thing correctly. | Fixed with `nish_shell_quote`. Test: `install.sh's wrapper execs a path with quotes, $() and backticks in it as that path, running none of it`. |
| SC-9 | Low | `install.sh:199` | The version, from the command line, `NISH_VERSION` or the latest-release redirect, was put into the URL unchecked; the redirect's answer when there is no tag to land on is a whole URL. | Fixed. `nish_valid_version` refuses anything but a dotted version before a request is made. Test: `install.sh refuses a version that is not one, before it requests anything`. |
| SC-10 | Low | `scripts/fetch-seed.sh:51` | The version went to `install.sh` unquoted, so `fetch-seed.sh "0.4.0 --dir /elsewhere"` became extra options. | Fixed. Test: `a version is passed to the installer as one word, never split into options`. |
| SC-11 | Low | `release.yml:310`, `:311`, `:313`, `:346`, `:347`, `:560`, `:824`; `release-pr.yml:81`, `:92`, `:196`, `:234`; `ci.yml:281`; `ct-timing.yml:97` | Expressions spliced into `run:` scripts. None carries pull request text: they are step outputs derived from a tag that the `targets` job has already matched against `package.json`, the version on `main`, a static matrix and the `github` context. But each is one edit away from carrying something that is, and the rule `pr-title.yml` and `pr-body.yml` state is the safe one. | Fixed. Every one goes through `env:`. Test: `no workflow splices a ${{ }} expression into a run: script (6 files)`. |
| SC-12 | Low | every `uses:` in `.github/workflows/` | Every action was pinned by a movable tag (`@v4`). All four are GitHub's own (`actions/checkout`, `setup-node`, `upload-artifact`, `download-artifact`), so this is hardening rather than a third-party risk. | Fixed. Each is pinned to the commit its `v4` tag named on 2026-10-02, the tag kept in a comment. Test: `every action a workflow uses is pinned to a full commit SHA`. |
| SC-13 | Low | `release.yml:419` | The `release` job holds `contents: write`, and its checkout left the token in `.git/config` while `npm ci` ran install scripts. Every dependency is pinned by integrity and only the root has an install script, so this is hardening. | Fixed. `persist-credentials: false`; the job never pushes with git. Test: `release.yml's release job checks out without persisting its write token`. |
| SC-14 | Low | `release.yml:601` | The `npm` job, which holds `id-token: write`, installed `npm@^11.5.1`: whatever 11.x the registry served on release day, able to mint a publish credential. | Fixed. Pinned to `npm@11.21.0`. Test: `release.yml publishes with an exact npm version, not a range`. |
| SC-15 | Low | `web/wasi.mjs:116`, `web/compile.mjs:37` | Plain objects used as maps: a file named `__proto__` was dropped from `toText()`, and a module named `constructor` looked already collected. No pollution (the assignment only touches the object's own prototype), but a silent loss. | Fixed with `Object.create(null)`. Test: `wasi MemoryFileSystem.toText returns a file named __proto__ as a key, not a prototype`. |
| SC-18 | Low | `release.yml:604-609`, `:679-683` | The `npm` job downloaded the packages back from the release and published them with `--provenance` under `id-token: write`, checking nothing. A package replaced on the release between the two jobs would have been published with a valid provenance statement. | Fixed. The `release` job hands its `SHA256SUMS` to the `npm` job as a job output, which no edit to the release reaches, and every package is checked against it before the first publish. Test: `release.yml's npm job checks every package against the release job's SHA256SUMS before publishing`. |
| SC-16 | Low | GitHub repository setting | Releases are mutable. For a release after 0.15.0 the check is the release's own `SHA256SUMS`, which catches corruption and an asset replaced alone, but not a tarball and its `SHA256SUMS` replaced together. | **Open**, outside this stage's files. Turn on immutable releases in the repository settings, which makes every published asset and its sums final. Signed build provenance (`actions/attest-build-provenance`, checked with `gh attestation verify`) is the stronger answer for CI, but it widens `release.yml`'s permissions (`id-token`, `attestations: write`), which this stage may only tighten. Pinning each new release's digests in `install.sh` is the stopgap that needs neither; having `release.yml`'s `lockfile` job append them to the pull request it already opens would make that automatic, and is left to the owner because it changes what that job writes. |
| SC-17 | Low | `install.sh:4` | `curl … \| sh` runs `install.sh` itself unverified. It comes over HTTPS from `raw.githubusercontent.com` at `main`, which is the repository's own branch protection, and there is nothing in front of it to check it with. | Accepted, and the reason recorded. `sh install.sh` from a checkout, or from a downloaded copy read first, is the alternative, and `install.sh --help` already documents running it that way. |

## Properties verified

| Property | Evidence |
| --- | --- |
| No workflow runs a fork's pull request with secrets or a write token: there is no `pull_request_target` or `workflow_run`, every file declares `permissions:`, and the only secret (`RELEASE_PR_TOKEN`) is read in `release-pr.yml` and `release.yml`, which run on pushes to `main`, `v*` tags and dispatch only. `ci.yml`, `pr-title.yml` and `pr-body.yml` run on `pull_request` with `contents: read`. | Test `no workflow runs on pull_request_target or workflow_run, and every one declares its token's permissions`; reading every `on:` and `secrets.` |
| Pull request title and body reach a shell only through `env:`. | `pr-title.yml`, `pr-body.yml` (unchanged), and the no-splice test above, which now covers every workflow. |
| Every job's token is the narrowest it uses: `contents: read` at the top of `ci.yml`, `pr-*.yml` and `ct-timing.yml`; `release.yml`'s write scopes only on `release` (creates the release) and `lockfile` (pushes a branch, opens a pull request); `id-token: write` only on `npm`; `issues: write` only on ct-timing's `report`. | Reading every `permissions:` block. `release-pr.yml`'s `actions: write` is used by `gh workflow run release.yml`. |
| The npm channel executes nothing it downloads: npm checks every tarball against the lockfile's integrity, a platform package declares no lifecycle scripts and no `bin`, and `postinstall.mjs` imports no process or network module. | Tests `a generated platform package declares no lifecycle scripts and no bin, so installing it runs nothing` and `scripts/postinstall.mjs fetches nothing and spawns nothing`. |
| `bin/launcher.js` hands over with an argument vector, never a shell, to the binary inside the platform package Node resolves from its own package, and refuses with exit 3 when there is none; it downloads nothing. | Reading `handOver` and `nativeCompiler`; `tests/run.js`'s pack-and-install round trip drives it end to end. |
| `postinstall.mjs` quotes the path it bakes into the shim correctly for POSIX `sh`, and never fails an install. | Reading `shellQuote`; the postinstall checks in `tests/run.js`. |
| `scripts/verify-binaries.sh`, `build.sh`, `bootstrap.sh` and `nish-compiler.sh` download nothing; `bootstrap.sh` reaches the network only through `scripts/fetch-seed.sh`, and so through SC-1's check. `verify-binaries.sh` announces its one override (`NISH_UNAME_S`) on stderr. | Reading each; `grep` for `curl`, `wget`, `gh `, `mktemp` and `eval` finds nothing else. |
| `release.yml` cannot publish from a ref that is not a `v*` tag equal to `package.json`'s version, so a crafted tag name never reaches the steps that use it. | Reading the `targets` and `release` jobs' first step. |
| The JS hosts evaluate no strings: no `eval`, `new Function` or `shell: true` in `runtime/*.mjs` or `web/*.mjs`, and `spawnSync` takes an argument vector. | `grep` over the four files; reading `spawnImpl`. |
| The WASI host's other memory accesses (`fd_read`, `fd_write`, `fd_pread`, path arguments) cannot over-report: an iovec past the end of memory is clamped by `subarray`, and the count each call writes back is the clamped length, so the guest sees a short read or write, which POSIX and WASI both allow. Only `random_get` reports success without a count, which is why it alone needed `EFAULT`. | Reading `#iovs`, `#writeStream`, `#writeFile` and `#readInto`. |
| `runtime/nish.mjs`'s `nish/` resolve hook maps a specifier to `std/<name>.ts` beside itself; the specifier comes from the program's own source, which this threat model trusts. | Reading the hook. |

## Doc corrections for the security-policy stage

None in `std/README.md`. For `SECURITY.md`'s threat model: the installers now
refuse any download without a published or pinned SHA-256, and SC-16 is the
repository setting that makes that check as strong for future releases as it
is for the pinned ones.
