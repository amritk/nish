---
name: Road to 1.0 — module identity, reserve integer, freeze
overview: Settle module and package identity by real path (#198, WP21 S3), reserve the name integer so that ranged integers can land in 1.1 without breaking anything, teach the release script to cut 1.0.0, then bring the master plan up to date and freeze docs/LANGUAGE.md. Everything ships in 0.10.0 (Release PR 192 is left alone), and 1.0.0 is a later Release-As commit a human makes.
stages:
  - id: module-identity
    title: fix(compilation)!  module and package identity is the real path (#198, WP21 S3)
    goal: A file reached through symbolic links is one module, a symlinked package is one package, and a package name found at two real directories is refused in words
    verification: npm run check && npm test (skip count unchanged) && node scripts/gen-diagnostic-codes.mjs --check
    todos:
      - id: identity-realpath
        content: Key Compilation.identityOf on realpathSync of the resolved path, keeping the first spelling as the module name — see Stage 1
        status: pending
      - id: identity-output-collision
        content: Refuse, or name apart, two distinct modules that would write one output file, never silently skip or overwrite — see Stage 1
        status: pending
      - id: identity-package-realdir
        content: Resolve a bare specifier's package directory through realpathSync in self/compilation.ts and drop the TODO(WP21 S3) — see Stage 1
        status: pending
      - id: identity-diamond-code
        content: Add an NL30xx refusal for one package name at two real directories, naming both and their versions — see Stage 1
        status: pending
      - id: identity-tests
        content: Flip tests/link/package_symlink to a compiling case and add the #198 reproducers and the diamond case — see Stage 1
        status: pending
      - id: identity-docs
        content: Record the decision in docs/wp21-packages.md §7 §8 §10d and the rule in docs/LANGUAGE.md under export and import — see Stage 1
        status: pending
  - id: reserve-integer
    title: feat(checker)!  reserve the type name integer for ranged integers (WP31)
    goal: Everything WP31 W1 would break is broken now, before the freeze, so W1 to W4 can land in 1.1 as a purely additive feature
    verification: npm run check && npm test (skip count unchanged) && node scripts/gen-diagnostic-codes.mjs --check
    todos:
      - id: reserve-name-rule
        content: Refuse an alias, enum, class, interface or function named integer the way type Result is refused — see Stage 2
        status: pending
      - id: reserve-use-rule
        content: Refuse integer and integer<…> used as a type with a code whose message says it is reserved for ranged integers — see Stage 2
        status: pending
      - id: reserve-tests
        content: Add tests/cases/reject_integer_* goldens and a tests/wordings program per new code — see Stage 2
        status: pending
      - id: reserve-docs
        content: Add the rule to docs/LANGUAGE.md Types and docs/AI.md, and mark W1 non-breaking and 1.1 scope in docs/wp31-ranged-integers.md — see Stage 2
        status: pending
  - id: release-as
    title: build(release)  a Release-As trailer chooses the next version, and 1.0 ends pre-1.0 semver
    goal: One trailer on a merged commit makes the Release PR propose 1.0.0, and from 1.0 on a breaking change moves the major
    verification: node --test scripts/ (or the runner the repo uses for scripts/*.test.mjs) && npm run lint
    todos:
      - id: release-as-trailer
        content: Read a Release-As trailer in scripts/changelog-gen.mjs nextVersion, refusing a version that is not above the last tag — see Stage 3
        status: pending
      - id: release-as-test
        content: Add scripts/changelog-gen.test.mjs covering the trailer, the refusal, and the post-1.0 major bump — see Stage 3
        status: pending
      - id: release-as-docs
        content: Document the trailer in docs/wp12-release.md — see Stage 3
        status: pending
  - id: freeze-docs
    title: docs(plan)  M4 — the reference is frozen and 1.0 is next
    goal: The master plan says what 1.0 is and what 1.1 starts with, and docs/LANGUAGE.md states the freeze
    verification: npm run check && npm test && node docs/check-links.mjs
    todos:
      - id: freeze-what-remains
        content: Rewrite docs/MASTER_PLAN.md What remains and the M4 row from the merged state of stages 1 to 3 — see Stage 4
        status: pending
      - id: freeze-language
        content: Add the freeze statement to the head of docs/LANGUAGE.md — see Stage 4
        status: pending
      - id: freeze-semver-lines
        content: Update the pre-1.0 semver lines in CLAUDE.md and AGENTS.md — see Stage 4
        status: pending
      - id: freeze-release-as
        content: Cancelled at sign-off — no Release-As trailer in this run, the work ships as 0.10.0 — see Stage 4
        status: cancelled
---

# Road to 1.0

## Context

M4 is the only open milestone: a frozen `docs/LANGUAGE.md` and a tag. Two questions stood in front of it — whether ranged integers (`integer<0, 255>`, [wp31](../../docs/wp31-ranged-integers.md)) go in before the freeze, and what a module's identity is when symbolic links are involved ([#198](https://github.com/amritk/nish/issues/198)), which is the same question WP21 S3 leaves open for packages ([wp21 §10d](../../docs/wp21-packages.md)).

## Approach — the two decisions

**Ranged integers: reserve the name in 1.0, build the feature in 1.1.** wp31 §3 makes W1 `feat(checker)!` for one reason: it takes the name `integer` from any program that declares something called that. That break is cheap now (pre-1.0 moves the minor) and expensive after the freeze (it would move the major). The feature itself is additive, and wp31 §10 predicts ~1.00x on a closed program and nothing for `self/`'s seventeen surviving checks, so it does not earn a delay to 1.0. Reserving the name now moves the only breaking part before the freeze and turns W1–W4 into a 1.1 feature that breaks nothing.

**Module identity: the real path, as Node and `tsc` do by default.** A module is the file `realpathSync` names. A package is its real directory. Node's resolver and TypeScript (`preserveSymlinks: false`) both do this, and a Nish program has to be legal TypeScript. The rule is chosen so that every later refinement only turns a refusal into an acceptance, which keeps it additive after 1.0:

| Case | Lexical (today) | Real path (this plan) | Later, additively |
| --- | --- | --- | --- |
| symlinked cwd, `$PWD/types.ts` (#198 case 1) | two modules, NL3028 | one module | — |
| `far/../types.ts` through a link (#198 case 2) | root skipped | the file the OS opens, own module, no silent output clash | — |
| pnpm / `package_symlink` | refused, clash | **one package, compiles** | — |
| same name, two real dirs (npm copies, diamond) | refused by accident (clash on a symbol) | **refused in words** (new NL30xx naming both dirs and versions) | manifest identity (`name@version`) may merge copies; §7's diamond may link both |

Identity by manifest was the alternative. It would merge npm's duplicate copies too, but it commits now to treating two directories as one file set on the strength of a version string, and it answers §7's diamond by accident, which is what wp21 §10d warns against. Real path now, with a refusal where the two differ, leaves that decision open without breaking anyone later.

## Stage 1 — module-identity

**Owns:** `self/compilation.ts`, `self/packages.ts`, `self/paths.ts`, `self/compile.ts`, `self/codes.ts`*, `self/diagnostics.ts`*, `tests/link/**`, `tests/nish/cli.ts`, `tests/cases/*identity*/**`, `docs/wp21-packages.md`, `docs/LANGUAGE.md`* (the `export` and `import` section only), `docs/wp19-stage0-retirement.md`

- [`identityOf`](../../self/compilation.ts) resolves lexically today (line ~307). Make it `realpathSync(resolvePath(workingDir, path))`, falling back to the lexical key when the file does not exist (the load then fails as it does now). The first spelling that loads stays the module's path and name.
- #198 case 2 exposes a second bug: two distinct modules both named `types` write one `out/types.ll`. Refuse it with a code of its own naming both files, or name the outputs apart — whichever `self/compile.ts`'s output planning already has a convention for. Never silent.
- In `resolveSpecifier`'s package path (~line 613), take the package directory through `realpathSync`. Remove the `TODO(WP21 S3)` comment block and rewrite it to state the rule.
- Keep a map from package name to real directory. A second real directory for a name already seen is the new refusal: `` Package `hash` is at two places: <dir1> (1.0.0) and <dir2> (2.0.0). Nish compiles one copy of a package per program `` (wording to the worker, voice of the S3 codes). Next free number in the NL30xx band; `scripts/gen-diagnostic-codes.mjs --check` must pass.
- `tests/link/package_symlink`: its `expected.err` goes; it becomes a compiling case with expected stdout. Add `tests/link/identity_symlink_cwd`, `identity_symlink_dotdot` (the two #198 reproducers from #197's round-3 review), and `package_two_dirs` (the refusal). `tests/nish/cli.ts` holds the new code's `--json`.
- `realpathSync` is in the seed (0.6.0+), so `self/` may call it under the rolling freeze.
- The commit closes #198 (`Closes #198` in the PR body) and is `!` because a program that compiled only because two links were two modules no longer does.

## Stage 2 — reserve-integer

**Owns:** `self/annotations.ts`, `self/declarations.ts`, `self/checker.ts`, `self/types.ts`, `self/codes.ts`*, `self/diagnostics.ts`*, `tests/cases/reject_integer_*/**`, `tests/wordings/**`, `docs/LANGUAGE.md`* (the Types section only), `docs/AI.md`, `docs/wp31-ranged-integers.md`

- Add `integer` to `builtinTypeName` (wp31 §3) so that `type integer = …` and `enum integer` are refused as `type Result = …` is. Refuse a class, interface or function named `integer` too.
- `integer` or `integer<…>` in a type position: refused with its own code, message along the lines of `` `integer<Lo, Hi>` is reserved for ranged integers, which are not built yet ``. Do **not** add `N_TYPE_LITERAL` or the `runtime/nish.d.ts` line; that is W1.
- Cases: `reject_integer_alias`, `reject_integer_class`, `reject_integer_function`, `reject_integer_use` (each `.ts` + `.err`), and a `tests/wordings/` program per new code.
- wp31: §1 row 8 and §3's last paragraph say the name was reserved in 1.0, so W1 is `feat(checker)`, not `!`, and is 1.1 scope. §10's stages table changes to match.
- `feat(checker)!` with a `BREAKING CHANGE:` trailer.

\* **Shared with stage 1, by section.** `self/codes.ts`, `self/diagnostics.ts` and `docs/LANGUAGE.md` are edited by both stages in different bands and sections. Both develop in parallel; **stage 2 merges after stage 1** and merges `main` in first.

## Stage 3 — release-as

**Owns:** `scripts/changelog-gen.mjs`, `scripts/changelog-gen.test.mjs`, `docs/wp12-release.md`, `.github/workflows/release-pr.yml` (only if the trailer has to be read there)

- `nextVersion` (~line 304) takes the highest `Release-As: X.Y.Z` trailer among the entries in the range. It must be above the computed floor for the range (never a downgrade, never a patch where a `feat` asks for the minor), and otherwise the script fails with a message naming the trailer and the commit.
- From 1.0 on, the existing branch already moves the major on a break; the comment at ~line 304 that says "Reconsider at 1.0" is answered.
- A test file mirroring `scripts/check-pr-body.test.mjs` and wired the same way. Cases: no trailer; `Release-As: 1.0.0` over 0.9.0; a trailer below the floor refused; a breaking change after 1.0.0 → 2.0.0.

## Stage 4 — freeze-docs

**Owns:** `docs/MASTER_PLAN.md`, `docs/LANGUAGE.md` (the head only, after stages 1 and 2 have merged), `docs/README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/wp20-threads.md`, `docs/wp29-thread-surface.md`

Starts after stages 1–3 merge, because it records what they did.

- **What remains** (~line 757): M4 row becomes "the reference is frozen; the tag is the Release PR". Say that the WP15 list is closed for 1.0. Record the ranged-integer decision: name reserved in 1.0, W1–W4 are 1.1. Record #198 and WP21 S3's identity half as closed, with the two S3 items still open (a builtin with no runtime on the target, and errors attributed to a dependency) as post-1.0 and additive. Name **1.1's first item as the data-parallel call** (wp29, 3.96x on four cores), followed by WP31 W1–W4.
- **The freeze statement** at the head of `docs/LANGUAGE.md`: from 1.0, a change may add a rule, or turn a refusal into an acceptance, in a minor release. Withdrawing or narrowing an accepted construct, or changing what one means, is a major. Refusal wordings may change; codes may not.
- `CLAUDE.md` / `AGENTS.md`: "Before 1.0 that moves the minor" becomes the post-1.0 rule.
- **No `Release-As` trailer in this run** (decided at sign-off): everything here ships in 0.10.0 through the Release PR already open (#192), which the lead never touches. The M4 row says how 1.0.0 is cut: a human lands a commit carrying `Release-As: 1.0.0` (stage 3), then merges the Release PR.

## Out of scope

- Building WP31 W1–W4 (1.1). The data-parallel call and anything else from wp20/wp29 (1.1).
- Package identity by manifest, diamond linking, S4 cache, the two remaining S3 diagnostics.
- Touching the Release PR (#192, 0.10.0) in any way, and cutting 1.0.0.

## Tests

Goldens per `.claude/testing.md`: `.ts` + `.err` for refusals, `.ts` + `.ll` + `.out` for compiling cases, `tests/link/*` for multi-file and symlink cases. No new construct emits IR, so no new `.ll` is expected except where a compiling link case needs one.

## Verification

`npm run check` and an undegraded `npm test` (the skip count read, not just the exit code). `node scripts/gen-diagnostic-codes.mjs --check` for stages 1–2, the scripts test runner and `npm run lint` for stage 3, and `node docs/check-links.mjs` for stage 4. The repo has no line-coverage tool; its golden harness plus these commands are the coverage gate.
