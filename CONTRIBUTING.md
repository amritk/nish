# Contributing to Nish

This page is for people working on the compiler, the runtime or the standard
library. To write programs in Nish, start with the
[user guide](docs/guide/index.md) instead.

Coding guidelines for contributors and coding agents are in
[AGENTS.md](AGENTS.md) and [`.claude/`](.claude/) (start at
[`.claude/orientation.md`](.claude/orientation.md)); the documentation index is
[docs/README.md](docs/README.md). Report a vulnerability privately, as
[SECURITY.md](SECURITY.md) says, never in a public issue.

## Building the compiler from source

You need what [docs/INSTALL.md](docs/INSTALL.md) §1 lists: Node.js 22.18 or
newer and clang (LLVM 18) with lld.

```bash
git clone https://github.com/amritk/nish.git
cd nish
npm ci
bash scripts/fetch-seed.sh          # the last release, into build/seed/
npm run build                       # seed -> stage1 -> stage2 = build/nish
build/nish hello.ts --link hello    # build/nish stands in for nish everywhere
```

The build is a bootstrap, the way Rust and Go build themselves: the compiler
is written in Nish, so something has to compile it first, and that is the
previous release's `nish` binary, the *seed*. `scripts/fetch-seed.sh`
downloads it into `build/seed/` (run it with `--force` when the seed may be
stale); `NISH_BOOTSTRAP=<path>` names one you already have and skips the
download.

### What `npm run build` does

`src/` is the compiler, written in Nish, and it compiles itself
([docs/wp14-selfhost.md](docs/wp14-selfhost.md)). With clang on `PATH`,
`npm run build` runs `scripts/bootstrap.sh` with the seed:

```bash
npm run build                                  # build/nish
NISH_BOOTSTRAP=~/.nish/bin/nish npm run build  # the same, seeded by an installed nish
scripts/bootstrap.sh --verify                  # and assert the fixed point
```

The seed builds stage1, stage1 builds stage2, and stage2 is installed as
`build/nish`. `--verify` also builds stage3 and asserts

```
IR(stage1) == IR(stage2)     byte for byte, and stage3 == stage2
```

The seed's own IR is only reported beside them, because a codegen change since
the release is expected to move it. `--stages 1` stops one link sooner.
`npm test` re-proves both equalities on every run. Compiling the whole
compiler costs it 91 ms and 86 MB; the TypeScript compiler it replaced took
786 ms and 178 MB for the same input.

`build/nish` takes the same `-o`, `--link` and `--profile` spellings as an
installed `nish`, because it is the same program, and makes every directory in
the way of the IR, a sidecar or the binary itself. It looks for
`scripts/build.sh` and the `runtime/*.c` files one level up from wherever it
was invoked (and one level up from the file a symbolic link to it names), so
it wants a checkout or an installed package around it the way `nish` does. It
falls back to the working directory only when the compiler itself lies inside
that directory, so a checkout you merely `cd` into cannot hand it a
`scripts/build.sh` to run. Keep `bin/nish` beside `scripts/`, `runtime/` and
`std/`, and keep that directory's parent writable only by you: the package
root is the parent of the compiler's directory, so a compiler at `/tmp/x/nish`
would trust `/tmp/scripts/build.sh` (CLI-9 in
[docs/security/cli.md](docs/security/cli.md)).

### The rolling freeze

Because the seed is the last release, `src/` may only *use* in its own source
the constructs that release compiles. A new construct is implemented in `src/`
and becomes usable inside `src/` from the next release on; CI's `bootstrap`
job checks that the released seed still builds stage1, on every platform a
release ships a compiler for. Details, and the subset `src/` is written in,
are in [docs/wp14-selfhost.md](docs/wp14-selfhost.md).

Until R6 there was a second compiler, the TypeScript one, stage0, run under
Node: it seeded every bootstrap, served as the oracle each phase of `src/` was
compared against, and shipped in the npm package as the fallback for a
platform with no native binary. It was deleted once the self-hosted compiler
did everything it did ([docs/wp19-stage0-retirement.md](docs/wp19-stage0-retirement.md)),
which is why musl, FreeBSD and 32-bit platforms no longer have an `npm install`
route to a compiler.

### A platform with no released binary

The bootstrap needs one thing a checkout cannot hand you: a compiler that
already runs on the machine. The seed does not have to be built *for* the
machine, only to run *on* it. [docs/INSTALL.md](docs/INSTALL.md) §2 has the
routes a user can take: build in a glibc container and link on the musl host,
the WASI build of the compiler, or a target the project does build.

### Seeds, release assets and CI

The release workflow attaches one self-hosted compiler per supported platform,
`nish-<version>-<asset>.tar.gz`. Which release first carries each is
`attachedSince` in [`.github/seed-targets.json`](.github/seed-targets.json),
the same file the release workflow builds its matrix from and CI's `seeds` job
reads, and `node tests/run.js seed-targets` checks that the table in
[docs/INSTALL.md](docs/INSTALL.md) agrees with it.

The releases before v0.4.0 attach `x86_64-linux` only. The three newer rows
waited until a run on their own hardware had exercised them, because
`release` needs the whole matrix and one red row blocks the publish; the two
macOS rows also waited until the bootstrap's `stage3 == stage2` check held as a
raw byte comparison under `ld64`, which needed both stages linked at one
output path. `scripts/verify-binaries.sh`'s header has the measurements.

Every CI job that fetches a seed sets `NISH_REQUIRE_ATTESTATION=1`, so the
seed's build provenance attestation must verify before it is used
([docs/security/supply-chain.md](docs/security/supply-chain.md)).

## Running the tests

```bash
npm test                 # build + goldens, llvm-as, native round trips, runtime, layout, memory, interop, bench checksums, differential
node tests/run.js locals # only the sections and cases whose name contains "locals"
npm run test:update      # write missing .ll goldens for new cases
npm run test:diff        # every whole program natively and under Node (runtime/shim.mjs), compared byte for byte
node tests/differential/fuzz.js --stage1 --count 200   # random integer programs, the released seed's IR against HEAD's; prints the seed
npm run check            # tsc --noEmit: an ambient type-check of src/, std/ and tests/nish/
npm run lint             # Biome style lint
npm run smoke            # build and run every example with a main
scripts/bootstrap.sh --verify   # the whole chain, with IR(stage1) == IR(stage2) and stage3 == stage2 asserted
node bench/run.mjs       # the benchmark suite; rewrites docs/BENCHMARKS.md (about 3 minutes)
docs/cookbook/regen.sh   # refresh docs/IR_COOKBOOK.md; node docs/check-links.mjs checks the links
```

The whole suite takes a long time on one machine; CI runs it in eight shards
on every push. Locally, run the sections a change touches.

### Tests written in Nish

The suite's own golden cases are also run by
[`tests/nish/run.ts`](tests/nish/run.ts), a test harness written in the
language it tests: `readdirSync` finds the cases, `spawnSyncTo` captures each
compile and each run, and the IR is diffed against the golden line by line.
`npm run test:nish` runs it over the whole corpus.

[`tests/nish/cli.ts`](tests/nish/cli.ts) is the other half of that idea,
pointed at the compiler's own promises rather than at its output: `--help` on
stdout with exit 0 against the same text on stderr with exit 2, one flat
`--json` object per diagnostic with a stable code, and each documented
exit-code band. It reads those objects with `std/json` and takes the version
it expects out of `package.json`, so a release cannot leave the expectation
behind (`npm run test:cli` runs it against `build/nish`).

### Programs under Node

[docs/RUN_UNDER_NODE.md](docs/RUN_UNDER_NODE.md) states where an unmodified
program runs the same under Node with the prelude. Two checks hold it to that:

- `tests/differential/unmodified.js` compiles every f64-mode program with an
  entry point, runs the binary, runs the same source under Node with the
  prelude, and compares stdout and exit status. Four programs are listed as
  divergent, each written to probe a decision on that page (`f64_libm`,
  `f64_minmax_nan`, `f64_round_negzero` and `f64_i32_mixed`), and any *other*
  difference fails the run (`node tests/differential/unmodified.js --verbose`).
- Eleven `nish/threads` programs are held to the same claim by name:
  `tests/link/par_map`, `tests/link/par_reduce`, the four
  `tests/link/thread_scope_*`, and the five lock programs
  `tests/link/thread_mutex_counter`, `thread_mutex_exit_paths`,
  `thread_mutex_histogram`, `thread_mutex_scalar` and
  `thread_mutex_using_mixed`. Each prints under Node, run with
  `--js-explicit-resource-management`, what its native binary prints
  (`node tests/run.js threads-under-node`). `tests/link/thread_mutex_or_return`
  is native only, because it releases its lock through `orReturn`, which does
  not propagate under Node.

The differential corpus under `tests/differential/` was first checked against
a JavaScript rewrite of each program made from stage0's recorded types
(`(a + b) | 0` for `i32`, `BigInt` for `i64`, a bounds-checked index helper,
byte lengths). That rewriter was deleted with stage0, so its output is frozen
in `tests/differential/goldens/rewrites.txt`; `--emit-ts` is its successor.
What still differs is listed with a reproducer in
[docs/wp13-differential.md](docs/wp13-differential.md) and
`tests/differential/known-failures.txt`.

## Conventions

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (the pipeline, side tables,
the add-a-construct checklist, ABI guard tests) and the conventions in
[docs/MASTER_PLAN.md §7](docs/MASTER_PLAN.md#7-conventions-for-every-agent):
every construct ships with a golden `.ll`, an `llvm-as` pass, a native round
trip, a negative test, and its LANGUAGE.md and cookbook entries; no attribute
without a proof; layout changes touch `src/runtime.ts` and `runtime/runtime.c`
together. CI runs the suite on Ubuntu with LLVM 18, and the bootstrap and the
CLI contract on every platform a release ships a compiler for, macOS and ARM
Linux included ([docs/wp10-ci.md](docs/wp10-ci.md)). What is built and what is
next is the [roadmap](docs/roadmap/index.md); the plan itself is
[docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).

Commit messages are the changelog: a conventional subject
(`type(scope): imperative subject`) becomes the `CHANGELOG.md` line, and the
body its prose in the release notes.

## Milestones

| Milestone | Contents | State |
|:---|:---|:---|
| M1 "Programs" | pipeline prep, validator, control flow, strings, modules, CI | done |
| M2 "Data" | classes and interfaces, arrays, runtime and intrinsics | done |
| M3 "Rust parity" | interop, memory strategy (stack allocation, arena scopes, `T \| null`), benchmarks with `--target`/`--nsw` (since removed)/PGO, differential testing against Node | done |
| M4 "1.0" | frozen language reference, tagged release | not scheduled: the project stays on 0.x |
| M5 "Self-hosting" | `src/`: the compiler, written in Nish, compiling itself | done |
| M6 "One compiler" | the TypeScript twin deleted; `src/` built by the last release, the seed | done |
