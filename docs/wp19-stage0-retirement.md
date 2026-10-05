# WP19 — Retiring stage0

**Status: complete.** R6 deleted stage0 in #150 (`f3c3439`, 2026-09-22), and
0.7.0 (2026-09-23) is the first release without it. `docs/MASTER_PLAN.md`
marks M6, "One compiler", done. This file is the summary of how the
retirement was done. The full plan, the review history and every intermediate
measurement are in git history: `git log -- docs/wp19-stage0-retirement.md`,
and `git show c78e4aa0:docs/wp19-stage0-retirement.md` is the last long form.

**Names.** stage0 was the second implementation of Nish, in TypeScript,
built by `tsc` into `dist/`. It lived in `src/` while the self-hosted compiler
lived in `self/`, until #256 (0.13.0) moved the self-hosted compiler to `src/`.
Here `src/` means the compiler that is left, and "stage0's `src/`" the deleted
one.

[`.claude/selfhost.md`](../.claude/selfhost.md) and [`AGENTS.md`](../AGENTS.md)
hold the rules for the one compiler that is left.

---

## What replaced each thing stage0 did

| stage0's job | Its successor |
| --- | --- |
| The seed that builds `src/` | The last released `nish`, which `scripts/fetch-seed.sh` puts in `build/seed/`. `NISH_BOOTSTRAP=<path>` names another binary (G3). The policy is that 0.N is built by the last patch release of 0.(N−1) (G4) |
| The permanent Nish-0 freeze | The rolling freeze: a construct added in 0.N reaches `src/` in 0.(N+1). CI's `seeds` and `bootstrap` jobs check it (G3) |
| `IR(stage0, src/) == IR(stage1, src/)` in `tests/self/bootstrap.js` | `IR(stage1) == IR(stage2)` and stage3 == stage2, built from the seed. Diverse double-compiling has no successor (§6 item 1). The `ddc-*` tags record where it last held (G6) |
| `ir_oracle.js`, `interop_oracle.js` | `tests/nish-cmp.js`, the last release against HEAD over the corpus, byte for byte (G2.1). It is `ci.yml`'s `nish-cmp` job, gated by `cmpSince` in `.github/seed-targets.json`. The `tests/cases/*.ll` goldens also cover this |
| `types_oracle.js`, `diagnostics_oracle.js`, `symbols_oracle.js`, `checked_oracle.js` | Checked-in goldens in `tests/self/goldens/`, written while both compilers agreed and compared by `tests/self/goldens.js` (G2.4) |
| The stage0 half of `support-oracle.js` | `tests/self/goldens/support.txt` |
| `fuzz.js --stage1` (stage0 against stage1) | `fuzz.js --stage1` (the seed release against HEAD, G2.2) |
| The WP13 rewriter's reference JavaScript | Frozen in `tests/differential/goldens/rewrites.txt`, with `unfrozen.txt` naming the programs that have no frozen rewrite (§6 item 6) |
| The compiler behind `tests/run.js` | A stage1 that the seed builds at the start of `npm test` |
| The generated diagnostic-code registry | `src/codes.ts`, kept by hand. `scripts/gen-diagnostic-codes.mjs --check` validates its format and uniqueness |
| Diagnostic wordings proved by agreement | `tests/wordings/` and `tests/diagnostic-coverage.js --require-coverage`. `stage0_only.txt` was folded into `unreachable.txt` |
| `--parity` and its workflows, and the stage1-only register (§1a) | Nothing: both need two compilers |
| The `dist/` fallback in the npm package | The launcher refuses on a platform with no binary and exits 3 (§6 item 5) |
| The provenance property | The `ddc-0.4.0`, `ddc-0.5.0` and `ddc-0.6.0` tags and the procedure in G6. `.github/ddc-tag.sh` and the `ddc` job were deleted with stage0 |
| Ported guards (runtime declarations against `nish.h`, the allocating builtins, the seed targets, the exit-70 path through `NISH_SIMULATE_ICE`) | The same checks, run against stage1 |
| `typescript` as a runtime dependency | It is a devDependency now, used by `npm run check` and by the lexer and parser oracles |

---

## 1. The shape we are moving to, and whose it is

rustc and Go are seeded by their previous release, GCC by any C++ compiler,
and Zig and OCaml by a checked-in blob. Nish had a fifth arrangement: a second,
independent implementation compared against `src/` at every phase. That bought
`IR(stage0, src/) == IR(stage1, src/)`, the second half of Wheeler's diverse
double-compiling, at the price of writing every construct twice.

**The target was Rust's and Go's shape**: `src/` is the compiler and the seed
is the previous released `nish`. Two things retirement was never meant to be:

- **Node leaving the repository.** `tests/run.js`, the oracles,
  `tests/differential/` and `bench/` stay Node programs. A compiler is
  self-hosted when it compiles itself.
- **Nish-0 dissolving.** The subset stays. Its reference point moved from
  stage0 to the last release. That turned the permanent freeze into a rolling
  one, and that change is the real gain.

### 1a. The doubling ends before R6

The gates did not require writing every construct twice, which had cost
125, 354 and 371 lines of stage0 for the last three. Only the harness did:
`tests/run.js` compiled goldens with stage0, and the oracles skipped what
stage0 refused. From then on `tests/self/stage1_only.txt` named cases that
were `src/`'s alone, compiled by a stage1 and counted by name, with the
`stage1_probe` fixture keeping the path exercised. R6 deleted the register.

---

## 2. What stage0 owned

Four kinds of thing: compiler behaviour (A), the oracles (B), distribution (C)
and provenance (D).

### A. Compiler behaviour stage1 did not have

Seven gaps, all of them closed before R6:

| Gap | How it closed |
| --- | --- |
| `--emit-ast` | stage1 dumps its own tree through `src/ast-text.ts`, pinned by `tests/self/dump-ast.golden`. It does not mirror `ts.SyntaxKind` (R1) |
| `--target host` | The `process.platform` and `process.arch` builtins (`tests/cases/io_host`) |
| exit 70 on an internal error | `process.exit(internalError(...))` at each site, with the report in `src/ice.ts`. No second `panic` builtin was added |
| `-o <dir>` without a trailing slash | The `isDirectorySync` builtin |
| `--no-warn-performance` and the WP15 §8 warnings | Found by diffing the two compilers' flag sets. stage1 had the analysis but its driver never printed the warnings |
| `--out-dir` | Removed. It was stage1's own spelling, and the oracles pass `-o <dir>/` to both compilers |
| `--emit-checked`'s later-phase lines | Ported into `src/dump.ts`, and the oracle's filter was deleted |

### A2. What `--parity` found on its first run

172 programs under 14 flag variations (2,408 runs) gave 206 undeclared
differences from five causes, invisible to every oracle because an oracle
compiles a program only with the flags it already carries. One was a miscompile
in the shipped compiler, a stack array sized from an IR operand
(`arr_stack_f64`). Most of the rest were one design difference: stage1
threads a contextual type down, and stage0 walked up through enumerated
positions (`reject_struct_field_*`, `reject_res_ok_f64`).

### A3. What `--parity` says over the whole corpus

593 programs and 8,302 runs gave 13,800 undeclared differences in five
classes, none of them wrong code. stage0 moved twice: a path inside the IR
(modules are named relative to the importer, needing no working directory)
and the unary `+` wording. stage1 moved twice: error recovery (`errored` in
`src/context.ts` stands in for a throw) and `--emit-ast` on a refused program.
The parser refusing a forbidden construct before Phase 0 named the rule was
declared, and WP33 R1 closed it in 0.14.0 and 0.15.0
([wp33 §5.0](wp33-round-trip.md#50-every-refusal-names-its-rule)). "stage0 is
the oracle" said who settled a disagreement, not that stage0 was right.

### A4. The gate, green

`parity: 8358 runs over 597 programs; 0 undeclared difference(s), 1523
declared`. Five declarations stood: the parser refusal (on stderr and on exit
status), the two compilers' `--emit-ast` trees, the `module <path>` header of
`--emit-checked`, and stage0's per-class report of an inheritance cycle. The
result did not stay true (§A5).

### A5. The gate reopened, and the correction §A4 needed

On `main` at 045c8f8 `--parity` was red on two stage0 `-g` defects: an
arrow-declared function placed at its parameter list (`FunctionSig.declSite`,
`dbg_arrow`), and `DILocation` columns in UTF-16 units where DWARF wants bytes
(`dbg_utf8`). Diagnostic columns stay code units, for editors
(`reject_diag_utf8`). The lessons:

1. An empty difference set is a fact about the corpus, not about the language.
2. A gate outside `npm test` records the last day somebody ran it.
3. A caveat that a comment retires against the test directory has been checked
   against a sample, not against the language.

`parity.yml` then ran the corpus half nightly and opened an issue whenever a
run was not green.

### A6. A cached binary

The mode reused a stale stage1, so it could report green against a compiler
nobody had rebuilt.

### A7. A corpus that grew under the measurement

`main` added 53 programs in a day, and the undeclared count went 37 → 0 → 18;
the 18 included a `CPtr` internal compiler error under `-g`. The 37 were
`nish/<name>` modules named by absolute path. A module's name is now its
package-relative specifier (`std/text.ts`), kept apart from its identity in
`ModuleUnit.name`.

### A8. A surface missing from `VARIATIONS`

`--json` had never been compared. It hid 180 undeclared differences, 178 of
them one defect: stage1 wrote an empty stdout for a syntax error.

### A9. A directory missing from `CORPUS_DIRS`

`tests/differential/corpus` (71 programs) had never been compiled by stage1.
Two of them found a checker bug in `-1 / z` with `z: f64`, now fixed in
`src/expressions.ts`.

The final figure, measured on merged `main` at `1e95aac` on 2026-09-22, was
`parity: 15776 runs over 986 programs (2938.5 s); 0 undeclared difference(s),
2961 declared`. Even then it was a lower bound over the corpus and the
variation list that somebody had written down.

### B. The oracles

**Survived:** `lexer-oracle.js` and `parser-oracle.js` (against the
`typescript` package), `reject-oracle.js`, the `tests/cases/*.ll` goldens,
`bootstrap.js`'s fixed point, and `support-oracle.js` less its stage0 half.
The WP13 differential harness survived only by freezing its reference, because
`rewrite.js` typed its JavaScript with stage0's `Compilation`. **Died:** the
six oracles in the table at the top, `fuzz.js --stage1` in its stage0 form, and
`bootstrap.js`'s first equality. Their successor property, seed release against
HEAD, catches regressions rather than disagreements and cannot see a bug both
versions share. With one implementation it is the only property available.

#### What each dying oracle covered, and what covers it now

| Dying oracle | Covered | Recovered as |
| --- | --- | --- |
| `checked_oracle.js` | 319 programs, 303,096 dump lines | `goldens/checked.txt` and `checked-self.txt` (the second is stored per module, and every byte is still compared) |
| `types_oracle.js` | 119 lines | `goldens/types.txt` |
| `diagnostics_oracle.js` | 570 lines | `goldens/diagnostics.txt` |
| `symbols_oracle.js` | 25 lines | `goldens/symbols.txt` |
| `rewrite.js` (WP13 reference) | 176 programs against Node | `tests/differential/goldens/rewrites.txt`. The frozen run reproduced all 176 verdicts of the live run, in order |

#### The wording gap, and what closing it turned up

Diagnostic wordings were proved by comparison and nothing else, and the
goldens did not change that. `tests/wordings/` did: one program per code with
its whole message in an `.err` file. `tests/diagnostic-coverage.js` reads the
registry from `src/codes.ts` and fails while any code is neither provoked nor
listed with a reason in `unreachable.txt`. Asked of stage1 on 2026-09-21, it
reported 264 of 410 codes provoked, 66 unreachable, and 80 reached only under
stage0 because stage1's parser refused those programs first (WP33 R1 later
moved those refusals to the phase that owns each rule). Writing the cases also
found 43 programs the compilers answered differently, the largest being §A8's
`--json` gap.

### C. Distribution

The npm package shipped `dist/`, a Node program (G5).

### D. Provenance

`IR(stage0, src/) == IR(stage1, src/)` cannot be re-established without a
second compiler, so G6 tagged it.

---

## 3. The gates

There were six gates, and each one had a check that `npm test` or CI could run.

### G1 — Parity: no program and no flag is stage0's

**Asked:** `src/` compiles everything stage0 compiles and answers every flag
stage0 answers, with identical output and exit codes. **Check:**
`node tests/run.js --parity`: the two `--help` flag sets diffed inside
`npm test`, and the corpus × `VARIATIONS` cross product nightly, failing on
any difference no narrow declaration covered. **Closed:** 0 undeclared
differences over 986 programs on 2026-09-22 (§A9). The mode went with
stage0.

### G2 — Oracle succession: the replacement runs before the original is deleted

1. **`nish-cmp`**, a required `ci.yml` job. A difference must be in
   `DECLARED`, which requires its words in `CHANGELOG.md`. First green run,
   2026-09-21, against the 0.5.0 seed: `437/437 programs agree (3582 files,
   3253862 IR lines) … 4 equal after each compiler's own root, 0 undeclared
   difference(s)`.
2. **`fuzz.js --stage1`**, repointed to the seed against HEAD.
3. **The surviving oracles** build their stage1 with the seed, through
   `tests/self/seed.js`.
4. **The dying oracles' coverage**, recovered as goldens before deletion,
   including every diagnostic wording (§2B).
5. **The WP13 reference**, frozen the same way (§6 item 6).

**Closed:** all five before R6. G2.4 was also checked with stage0's `src/`
and `dist/` moved out of the tree.

### G3 — The seed protocol exists and CI uses it

`scripts/bootstrap.sh` takes its seed from `NISH_BOOTSTRAP`, Go's
`GOROOT_BOOTSTRAP` by another name. CI builds `src/` with the last release's
binary on each platform that release carries a seed for. Nish has no
conditional compilation, so this job is the only enforcement the rolling
freeze has. The lookup is its own job, and `bootstrap` is a matrix over its
answer:

| The checks list says | It means |
| --- | --- |
| `seeds` green, a `bootstrap (<seed>)` row green | The freeze was checked on that seed's platform and held |
| `seeds` green, no row for a platform | No release carries a seed for that platform yet, so the freeze was not checked there |
| `seeds` green, `bootstrap` skipped | There is no release at all |
| `seeds` red | A seed that should exist is missing from the release |
| a `bootstrap` row red | `src/` does not build with the last release: the rolling freeze is broken |

`.github/seed-targets.json` spells each asset once. Its `attachedSince`
records the first release that carries each seed: `x86_64-linux` from 0.1.1
and the other three from 0.4.0. `.github/seed-due.sh` is the one place
versions are compared, and `.github/seed-matrix.sh` is the step body, which
`tests/run.js` drives against a stand-in for `gh`. The field is a version
rather than a boolean because a published release cannot gain an asset. The
boolean deadlocked the release that was meant to carry the asset.
`aarch64-linux` joined at 0.4.0, and the darwin pair's `attachedSince` is
0.4.0 because its rows first had to run on their own hardware. That run settled
Mach-O's `stage3 == stage2` (#114): `bootstrap.sh` had linked the two stages at
different paths, so ld64 gave them different `LC_UUID`s. The macOS `test` row
stays out for six named checks, none a compiler bug
([wp10-ci.md](wp10-ci.md#ci-matrix)).

#### What the seeded run proves, and what it does not

The seeded run proves that the seed can build `src/`, which is all the freeze
needs. It does **not** assert `IR(seed) == IR(stage1)`. With stage0 as the
seed, that equality was diverse double-compiling. With a released seed, it
would freeze codegen between releases, and it failed the first time an
optimisation landed. `--verify` asserts the fixed point and stage3 == stage2
whatever the seed, and only reports the seed's IR.

### G4 — The seed policy is written before it is needed

"`nish` 0.N is built by the last patch release of 0.(N−1)" is in
[wp12-release.md](wp12-release.md#the-bootstrap-seed). Rule 1 of
`wp14-selfhost.md` §6 survives with its subject changed: a construct enters the
language, ships in a release, and only then enters `src/`. 0.1.0 was the base
case and was built by stage0.

### G5 — Distribution does not need Node

**Asked:** release binaries for `x86_64`/`aarch64` × `linux`/`darwin`, an npm
install that keeps working, a `--version` that does not read `package.json`,
and `INSTALL.md` rewritten. **Closed:**

- `release.yml` builds each binary from the seed on its own architecture, so
  every shipped binary passed `--verify` and a smoke test on its hardware.
  v0.4.0 was the first release to attach all four.
- The package is `@amritk/nish`, the command `nish`
  ([wp12-release.md](wp12-release.md#the-npm-name)). `bin/nish` is a launcher,
  and the compiler arrives as one `@amritk/nish-<asset>` optional dependency
  per platform, so nothing is compiled on a user's machine.
  `node tests/run.js wp12` packs, installs and links through it.
- `--version` reads `VERSION` in `src/branding.ts`.

### G6 — The provenance is recorded before it is lost

From #116 until R6, `release.yml` tagged `ddc-<version>` on each release
commit, after the jobs proving `IR(stage0, src/) == IR(stage1, src/)` and the
fixed point and before `gh release create`. The tags are `ddc-0.4.0`,
`ddc-0.5.0` and `ddc-0.6.0` (the 0.6.0 release commit, `37acb707`), and they
are never moved or deleted.

**Re-verifying the property.** You need Node 22.18 or newer and an LLVM 18
`clang` on `PATH`.

1. `git checkout ddc-<version>`. At the tag, stage0 is in `src/` and the
   self-hosted compiler is in `self/`.
2. `npm ci`. This installs the `typescript` package that stage0 parses with.
3. `npm run build`. This runs `tsc` into `dist/`, which is stage0.
4. `node tests/self/bootstrap.js`. stage0 builds stage1, stage1 builds stage2,
   stage2 builds stage3, and every module is compared byte for byte. The
   script exits 0 with one summary line, or prints `FAIL` naming the first
   module and line that differ and exits 1.

A pass demonstrates diverse double-compiling again at that commit. On a
failure, check the environment first, because only the tree is fixed.

---

## 4. The language features the gates need

All of these landed in both compilers, each with the full definition of done.

| Builtin | Gate |
| --- | --- |
| `process.platform`, `process.arch` | G1, `--target host` |
| `isDirectorySync(path): boolean` | G1, `-o <dir>` |
| `getenv(name): string \| null` (R1, `tests/cases/io_getenv`) | G5, `CC` |
| No new builtin: `process.exit(internalError(msg))` | G1, exit 70 |
| `realpathSync(path): string \| null` (§5a item 4) | the symlinked install |

`readdirSync`, a monotonic clock and recursive directory removal were left out
on purpose, because only a harness needs them and the harness stays on Node.

---

## 5. Order

| | Milestone | How it closed |
| --- | --- | --- |
| **R1** | Parity | G1 green over the whole corpus, 2026-09-22, `1e95aac` (§A9) |
| **R2** | The seed protocol | `NISH_BOOTSTRAP`, the `seeds` and `bootstrap` jobs, the policy sentence, and darwin seed rows from 0.4.0 (G3, G4) |
| **R3** | Oracle succession | `nish-cmp`, the fuzzer, the goldens and the wording gap (G2). `reject-oracle.js` holds its parser bucket to `tests/self/parser-refusals.txt` in both directions |
| **R4** | Distribution | Four native binaries, the launcher and the platform packages (G5) |
| **R5** | Provenance | `ddc-*` tags cut by `release.yml` (#116, G6) |
| **R6** | The deletion | Five pull requests under #144, after v0.6.0. #146 (fetch a released seed), #145 (goldens compiled by stage1) and #147 (surviving tools off stage0) moved every consumer onto stage1 while stage0 still existed. #150 deleted stage0, and #148 then rewrote the rules and the live documents |

R1–R5 were reversible. R6 was not, so it came last and stood alone. What it
removed, and what replaced each part, is the table at the top of this file.

**Measured:** on 2026-09-23, on `main` at `ad02409`,
`bash scripts/fetch-seed.sh && npm ci && npm run check &&
NISH_BOOTSTRAP=build/seed/bin/nish node tests/run.js` ended `2106 passed, 0
failed, 1 skipped.` with no `DEGRADED:` line. The skip was the `wasi` profile,
which needs a WASI sysroot. The published package was 35 files, none of them
stage0's and none importing `typescript`. #150 removed 33,365 lines
(`git show --shortstat f3c3439`).

### 5a. What R6 is waiting on

Resolved. The sign-off of the R6 plan (#144) said go once v0.6.0 was released
and `nish-cmp` was green on `main`. The items R6 waited on:

1. **`nish-cmp` in CI.** Its first real run found that the releases from
   0.1.1 to 0.4.0 shipped without `std/`, and `tests/run.js` now checks the
   staging for it. `cmpSince` waits for a seed that can compile the corpus
   rather than allowlisting the difference. `withoutOwnRoot` strips each
   compiler's install root, and the summary line counts the files it touched.
   Twelve `nish-cmp` rows ran on `main` before R6, and none were red.
2. **The thin installer.** Done on 2026-09-20 (G5).
3. **The macOS `test` row.** Three checks were ported. Six remain red, each
   because the check reads an ELF fact from a linked binary, and they are
   listed in `ci.yml`. This never blocked R6.
4. **`packageRoot()` and `argv[0]`.** A bare `nish` found on `$PATH`, and any
   symlinked install (npm's `.bin` among them), resolved `scripts/build.sh` and
   `std/` against the wrong directory. The `$PATH` half was fixed on
   2026-09-20 and the symlink half on 2026-09-21: the `realpathSync` builtin
   landed first and the call site used it a release later, as the rolling
   freeze requires.
5. **`outputStems` under `-o <dir>/`.** Two modules whose paths differ only by
   a climb or a link shared one output stem, and one module overwrote the
   other. Since #198 (2026-09-24) the later module gets `<stem>_<n>`. Taking a
   package module's stem from its package-relative name, which would make
   stems independent of the install location, is still open.
6. **#94.** stage0's throw dropped the class members that followed a failed
   one. R6 resolved it by deleting that code. A completeness question about
   stage1's `errored` silencing a later member's error remains.

#### Which release R6 can land in, and why it is not 0.5.0

`nish-cmp` compares against the last release, and no seed before 0.5.0 could
compile the corpus. Deleting `ir_oracle.js` and `interop_oracle.js` in 0.5.0
would have removed them while their successor had no row at all. R6 landed
after 0.6.0 instead, once `nish-cmp` had run green against the 0.5.0 seed and
had rows against the 0.6.0 seed on `main`. Lowering
`cmpSince` and declaring the difference was not possible either, because
`DECLARED` needs words in `CHANGELOG.md`, and `[Unreleased]` is empty between
releases.

---

## 6. What retirement costs, stated plainly

1. **Diverse double-compiling ends.** A wrong lowering the compiler depends
   on can survive a release. G6 archives the last point where it could not.
2. **The diagnostics lose their oracle.** Goldens are weaker than agreement.
3. **The bug-finding direction reverses.** stage0 found six wrong-attribute
   bugs in S3 and S4, the class a golden `.ll` catches worst.
4. **One implementation is one bus factor.** The language is what `src/` does.
5. **musl, FreeBSD and every 32-bit platform lose their `npm install`.**
   `dist/` was their fallback. The launcher now names the four platforms with
   a binary, writes an `NL0002` object under `--json`, and exits 3.
   [INSTALL.md](INSTALL.md) lists the unsupported routes that remain.
6. **The WP13 differential oracle can no longer make its own reference.** The
   rewrite of the 176 programs is frozen, with a hash of each program's
   sources. Lost: the fuzz comparison against Node, `arrow-parity.js`, the
   store's fidelity check, and differential coverage for any corpus program
   added after R6. Porting the rewriter onto `--emit-checked` is the way back.

In return, every construct is written once, `src/` lags one release instead
of being frozen for good, and the compiler depends neither on Node nor on
another project's parser.

## 7. When not to do this

The intended trigger was a release cycle in which stage0 "found nothing,
changed nothing, and shipped nothing except itself". Measured on 2026-09-19 the
answer was *not yet*, since stage0 had just found §A8's `--json` gap. The
sign-off of #144 decided to go anyway, gated on v0.6.0 and a green `nish-cmp`,
with §6's costs accepted as stated.

## What was deliberately not done

- **No conditional compilation.** There is no `#[cfg(bootstrap)]`. The rule is
  "do not use a construct yet", and CI checks it.
- **The harness was not ported** off Node.
- **`--emit-ast` does not mirror `ts.SyntaxKind`.** Each compiler dumped its
  own tree.
- **No second `panic` builtin for exit 70.** The language did not grow for the
  compiler's own reporting policy.
- **No allowlisting in `nish-cmp`.** An absent row says no comparison
  happened, and an allowlisted green row would say one did.
- **No cross-compiled release binaries,** and no dry-run path in `release.yml`.
- **No `dist/` fallback** for platforms without a binary.
- **No assertion of `IR(seed) == IR(stage1)`** against a released seed.
- **No `ddc-*` tags after R6.**
- **The WP13 rewriter was not ported** to stage1, so its output stays frozen.
