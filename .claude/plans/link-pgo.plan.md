---
name: PGO and --cpu native for nish --link
overview: Give `nish --link` the profile-guided build scripts/build.sh already has (--pgo-generate, --pgo-use), covering the program, the runtime and runtime/sqlite/, offer `--cpu native` if it can be made safe, document the three-step flow in the user guide, and measure both on bench/sqlite's feed workload against the noise band.
stages:
  - id: pgo-link
    title: "feat(cli): profile-guided builds with nish --link --pgo-generate and --pgo-use"
    goal: A user can train and apply a profile entirely through nish --link, with SQLite and the runtime instrumented and optimised alongside the program, and the run cache never mixes instrumented and plain objects.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js pgo && node tests/run.js cpu-level && node tests/run.js guide && node tests/run.js wasi && node tests/run.js performance && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    todos:
      - id: pgo-parse
        content: Parse --pgo-generate and --pgo-use <profdata> in src/compile.ts with the refusals in the table — see PGO flags
        status: pending
      - id: pgo-profdata-probe
        content: Probe llvm-profdata on PATH for either flag and fail naming it — see llvm-profdata
        status: pending
      - id: pgo-recipe
        content: Thread the PGO flag through linkProgram and pushRecipeFlags to scripts/build.sh, with an absolute profile path — see Reaching every unit
        status: pending
      - id: pgo-cache
        content: Make a PGO link bypass cachedRuntime, the SQLite entry and the module cache in src/compile.ts and src/run-cache.ts — see The run cache
        status: pending
      - id: pgo-help
        content: Add the two rows to src/cli-style.ts and the advertised-flag lists, regenerate docs/reference — see PGO flags
        status: pending
      - id: pgo-tests
        content: Add the tests/run.js pgo section — see Tests for pgo-link
        status: pending
      - id: pgo-guide
        content: Write the Optimizing a build section of docs/guide/using-nish/cli.md with the three-step flow — see The guide section
        status: pending
      - id: pgo-records
        content: Update docs/security/cli.md for the new spawn and cache bypass, docs/ARCHITECTURE.md and docs/wp9-optimisation.md pointers — see Records
        status: pending
  - id: cpu-native
    title: "feat(cli): --cpu native, and pin that --cpu reaches the SQLite unit"
    goal: Either nish --link --cpu native builds every unit including SQLite with -march=native under a cache key that names the resolved host CPU, or the PR records why native cannot be offered safely; in both cases a test pins that --cpu reaches runtime/sqlite/.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js cpu-level && node tests/run.js pgo && node tests/run.js guide && node tests/run.js wasi && node tests/run.js performance && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    todos:
      - id: native-sqlite-pin
        content: Add a cpu-level check that --cpu x86-64-v3 puts -march=x86-64-v3 on every SQLite unit — see Does --cpu reach SQLite
        status: pending
      - id: native-safety
        content: Decide whether native is safe to offer against CT-16 and the cache, and record the decision — see The safety decision
        status: pending
      - id: native-impl
        content: Accept --cpu native in src/compile.ts and scripts/build.sh, keyed on the resolved CPU in src/run-cache.ts — see Implementing native
        status: pending
      - id: native-tests
        content: Flip the native refusal checks in tests/run.js cpu-level to the new behaviour — see Tests for cpu-native
        status: pending
      - id: native-docs
        content: Update help text, docs/LANGUAGE.md The CPU level, the guide, docs/security/ct-verification.md and docs/security/cli.md, regenerate docs/reference — see Implementing native
        status: pending
  - id: measure
    title: "perf(bench): measure PGO and --cpu native on the SQLite feed workload"
    goal: docs/BENCHMARKS.md records PGO off vs on and -march default vs native on bench/sqlite's feed workload, each read against its own noise band, produced by a harness anyone can rerun.
    verification: node bench/sqlite/run.mjs --validate && node bench/sqlite/run.mjs --validate --variant pgo && node bench/sqlite/run.mjs --validate --variant native && node docs/check-links.mjs && npm run lint
    todos:
      - id: bench-variants
        content: Add --variant pgo and --variant native to bench/sqlite/run.mjs, with a training run on separate synthetic data — see The harness
        status: pending
      - id: bench-run
        content: Run the timed rounds for each comparison and keep the raw output — see The measurement
        status: pending
      - id: bench-record
        content: Record the tables in docs/BENCHMARKS.md and the commands in bench/README.md — see The record
        status: pending
---

# PGO and `--cpu native` for `nish --link`

## Context

Profile-guided optimisation exists only in [scripts/build.sh](../../scripts/build.sh) (`--pgo-generate` → `-fprofile-generate`, `--pgo-use <file>` → `-fprofile-use=<file>`, lines 76–88 and 210–213). It reaches every unit: the program `.ll` on the link line, the runtime units through `compile`, and SQLite through `sqlite_objects "${compile[@]}"` (line 800). build.sh refuses `--pgo-*` in its cached modes (`--runtime-objects`/`--runtime-from`, line 281; `--sqlite-objects`/`--sqlite-from`, line 296).

`nish --link` calls build.sh. It never drives clang itself: `linkProgram` is at [src/compile.ts](../../src/compile.ts) 2457–2575 and `pushRecipeFlags` at 2590–2634. Most links take the runtime and SQLite from the run cache (`cachedRuntime` at 2692–2805, keys in [src/run-cache.ts](../../src/run-cache.ts) `profileLine` at 397–415). No `--pgo-*` reaches build.sh from nish.

`--cpu` accepts only `x86-64-v3` (`CPU_LEVEL`, src/compile.ts:149). It is pushed through `pushRecipeFlags` to the runtime entry, the SQLite entry and the final link, where build.sh turns it into `-march=x86-64-v3` on `common` (line 492). So it already reaches SQLite, but no test pins that for the SQLite units.

The twelve-dollar challenge builds every entry from source on the benchmark box. Training a profile there and `-march=native` are allowed; committed profiles are not.

## Approach

- **nish wraps build.sh, it does not reimplement it.** The flags become one more recipe flag in `pushRecipeFlags`, so the program, the runtime and SQLite all get them exactly as `scripts/build.sh --pgo-*` gives them today.
- **PGO links are never cached.** build.sh already refuses PGO in its cached modes, and a `--pgo-generate` object is worthless to anyone else. So a PGO link takes build.sh's one-command path: no runtime entry, no SQLite entry, no module objects. Nothing is written to the cache and nothing is read from it, so instrumented and plain objects cannot mix, and no key has to learn about profiles. The cost is a full runtime and SQLite compile per PGO link, which is the price of a release build, paid twice.
- **Stricter than build.sh where build.sh is silent.** build.sh lets the last `--pgo-*` win and ignores `--pgo-*` under `debug` and `wasi`. nish refuses both with exit 2, because a flag that does nothing is a lie the user discovers in a benchmark.
- **`native` is a decision, not a todo.** It is offered only if the cache key and the CT-16 promise can both be kept. Otherwise the stage lands the SQLite pin and a recorded reason.
- **Order.** `cpu-native` starts after `pgo-link` merges, and `measure` after both. The first two cannot run at once, because both edit the `--cpu` and recipe plumbing in src/compile.ts, src/run-cache.ts, src/cli-style.ts, scripts/build.sh, the tests/run.js `cpu-level` section and the guide's CLI page. `measure` needs both flags on `main` to measure them.

## Stage pgo-link

**Owns:** `src/compile.ts`, `src/run-cache.ts`, `src/cli-style.ts`, `scripts/build.sh`, `tests/run.js`, `tests/nish/cli.ts`, `docs/guide/using-nish/cli.md`, `docs/LANGUAGE.md`, `docs/ARCHITECTURE.md`, `docs/wp9-optimisation.md`, `docs/security/cli.md`, `docs/security/README.md`

### PGO flags

| input | result |
|---|---|
| `--pgo-generate` | instrumented link (`-fprofile-generate` on every unit) |
| `--pgo-use <file>` | optimised link (`-fprofile-use=<abs path>` on every unit) |
| either without `--link` | exit 2, `compile: --pgo-generate needs --link` (the flags are link flags; the IR is unchanged by them) |
| both together | exit 2, one line |
| `--pgo-use` with no argument, or a file that does not exist or is not a regular file | exit 2, naming the file and the merge step |
| either with `--profile debug` or `--profile wasi`, or a non-host `--target` | exit 2: only `speed` and `size` take a profile |
| either under `nish run` | refused through `notForRun` (compile.ts:1146–1152) |

These are command-line usage errors. Like the `--cpu` messages at compile.ts:793–803, they are plain `compile: …` lines with exit 2 and not registry codes, so there is no tests/link negative. The cross-checks go after the parse loop, as `--cpu`'s do at 1099–1118, so flag order does not matter.

The help rows go in the Build group of src/cli-style.ts, inside the 80-column test. They are also added to the advertised-flag lists at tests/run.js:23591 and tests/nish/cli.ts:121. `docs/reference/command-line.md` is regenerated with `node scripts/gen-reference.mjs`.

### llvm-profdata

nish never runs `llvm-profdata merge`; the user does, between the two links. Both flags still probe `llvm-profdata` on PATH, using `programOnPath` (compile.ts:1732), before anything compiles:

- **`--pgo-generate`:** without the tool, the `.profraw` files the binary writes cannot be turned into a profile.
- **`--pgo-use`:** nish runs `llvm-profdata show <file>` once. That refuses a raw `.profraw` passed by mistake, and a profile written by a different LLVM, with the tool's own reason, instead of a clang error deep in the link.

A missing tool is a toolchain failure: exit 3 through `reportToolchainFailure`, `NL0002` under `--json`. The message says that `--pgo-*` needs `llvm-profdata` on PATH, and that Ubuntu's `llvm-18` package installs it as `llvm-profdata-18`. If the instrumented link fails for want of compiler-rt's profile runtime, the error names `libclang-rt-18-dev`, as build.sh's header does (lines 86–87).

### Reaching every unit

The flag goes through `pushRecipeFlags` as `--pgo-generate` or `--pgo-use <abs>`. The path is made absolute with `realpathSync` first, because build.sh's `sqlite_units` runs clang from `runtime/sqlite/` (line 698), where a relative path would resolve wrongly.

A test reads the clang lines build.sh runs, the same way the existing cpu-level check "puts -march=x86-64-v3 … on all nineteen runtime units" does. It proves the flag is on the program, every runtime unit, every SQLite unit and the link.

### The run cache

When a PGO flag is set:

- `cachedRuntime` returns `none`, so the runtime entry and the SQLite entry (`sqliteCacheKey`) are neither read nor written.
- The module-objects path is skipped too. It is debug-only, and debug is refused.
- `nish run` refuses the flags, so `runCacheKey` is untouched.

State the bypass in the comment where `cachedRuntime` decides. Update docs/security/cli.md CLI-11, which enumerates the key and the cache, to say that PGO links bypass the cache.

### The guide section

Add `### Optimizing a build` under "Compiling: IR and binaries" in [docs/guide/using-nish/cli.md](../../docs/guide/using-nish/cli.md), after the flag bullets. It shows the three-step flow as runnable commands:

```bash
nish app.ts -o build/app.ir/ --link build/app.instr --pgo-generate
LLVM_PROFILE_FILE=build/app-%p.profraw build/app.instr <a representative run>
llvm-profdata merge -o build/app.profdata build/app-*.profraw
nish app.ts -o build/app.ir/ --link build/app --pgo-use build/app.profdata
```

The section also says:

- the profile covers SQLite and the runtime;
- train on data shaped like production, on the machine and toolchain that will build the release;
- a profile is not portable across LLVM versions;
- do not commit profiles; rebuild them where you build.

It links the `docs/LANGUAGE.md` section that governs it. Add a short PGO paragraph beside "The CPU level" in LANGUAGE.md. No new route is needed, because it is a section of an existing page.

### Records

- **docs/security/cli.md:** the new PATH spawn (`llvm-profdata show`, fixed argv, the user's file), and the cache bypass.
- **docs/security/README.md:** the record's row, if its counts move.
- **docs/ARCHITECTURE.md (753–759) and docs/wp9-optimisation.md (226–238):** point at the nish flags as well as build.sh.

### Tests for pgo-link

A new tests/run.js section named `pgo`. The instrumented link needs compiler-rt's profile runtime, which the SessionStart hook and CI install. Each check:

- **Refusals:** every row of the PGO flags table: exit code, one line, no output file.
- **Missing tool:** with `llvm-profdata` absent, run with a PATH that holds a clang shim but no llvm-profdata. Expect exit 3, a message naming the tool, and nothing linked.
- **Every unit:** each clang line build.sh runs carries `-fprofile-generate` for a program that calls SQLite: the program, the runtime units, the SQLite units and the link.
- **The round trip:** on a small SQLite-calling program, an instrumented link, a run with `LLVM_PROFILE_FILE` in a temp dir, `llvm-profdata merge`, then a `--pgo-use` link. The PGO binary prints exactly what a plain link prints. `llvm-profdata show --all-functions` on the merged profile lists a `sqlite3_` function and a runtime function, which proves the profile covers both.
- **No mixing:** with one cache dir, run a plain link, an instrumented link, then a plain link. No new cache entry is written by the instrumented link. The first and last plain binaries carry no `__llvm_profile_` symbol (`llvm-nm`) and are byte-identical. The instrumented binary carries the symbol.
- **Relative profile path:** `--pgo-use rel.profdata` from another cwd links. This pins the absolute-path fix.

## Stage cpu-native

**Owns:** `src/compile.ts`, `src/run-cache.ts`, `src/cli-style.ts`, `scripts/build.sh`, `tests/run.js`, `tests/nish/cli.ts`, `tests/ct-asm-runtime.js`, `docs/guide/using-nish/cli.md`, `docs/LANGUAGE.md`, `docs/security/ct-verification.md`, `docs/security/cli.md`, `docs/security/README.md`

Starts after `pgo-link` merges.

### Does --cpu reach SQLite

It does today: `pushRecipeFlags` pushes `--cpu` to the SQLite entry, and build.sh adds `-march` to `common`, which `sqlite_objects` uses. No test pins it. Add a cpu-level check that every SQLite unit's clang line, `sqlite3.c` and the adapter, carries `-march=x86-64-v3 -ffp-contract=off`, beside the existing nineteen-runtime-units check.

### The safety decision

`native` is offered only if all three hold. Otherwise `--cpu native` stays refused. The refusal message then gives the reason, and the PR body and LANGUAGE.md record it.

1. **Cache.** The run-cache key names the *resolved* host CPU, not the word `native`, so a cache directory shared between machines never hands one machine's objects to another. Resolve it with `$CC -march=native -### -x c /dev/null`, reading the `-target-cpu` value and the `-target-feature` list, and put that in `profileLine` for `native` only. The baseline and `x86-64-v3` keys stay byte-identical.
2. **CT-16.** docs/security/ct-verification.md promises that the assembly the CT check reads is the assembly shipped, at the baseline and `x86-64-v3`. A `native` binary is outside what CI reads, because CI's runner CPU is not the user's. That is acceptable only if the record and LANGUAGE.md say plainly that `--cpu native` binaries are not covered by the CT check, and `tests/ct-asm-runtime.js` also reads `-march=native` assembly on whatever host runs it, so at least the CI runner's native build is checked. If the CT check fails at native on the CI runner, native is not offered.
3. **Honest help.** The `--help` row says the binary runs only on the machine that built it, or one with the same CPU features. A wrong-CPU start is SIGILL, not a diagnostic.

### Implementing native

- **src/compile.ts:** accept `native` beside `CPU_LEVEL` and update its doc comment (144–148). It is refused with `wasi` and with any `--target` that is not the host, since native means this machine. `nish run --cpu native` is allowed, because the binary runs where it was built, and the key resolves the CPU.
- **scripts/build.sh:** `--cpu native` → `-march=native`. Refuse it with the wasm, wasm-host and wasi profiles.
- **src/run-cache.ts:** the resolved-CPU key term.
- **Docs:**
  - `--help` text, and the regenerated `docs/reference/`;
  - docs/LANGUAGE.md "The CPU level" (15134–15165) and the CT line at 9942–9944;
  - docs/reference/language/semantics-decisions.md, regenerated;
  - the guide's `--cpu` bullet (cli.md:173–179) and the Optimizing a build section, with native + PGO together for a benchmark-box build;
  - docs/security/ct-verification.md;
  - docs/security/cli.md CLI-11, for the key.

### Tests for cpu-native

In tests/run.js `cpu-level`, the checks that pin `native` as refused (42897, 42919, 42928) become checks of the new behaviour, or stay refusals with the recorded reason. Add these checks:

- `--cpu native` puts `-march=native` on every runtime unit, every SQLite unit, the module and the link.
- A native link of hello prints what the baseline prints.
- The cache keeps native in its own entry, and the key text contains the resolved CPU name, not the word `native`.
- `--cpu native --pgo-generate` composes.

## Stage measure

**Owns:** `bench/sqlite/**`, `bench/README.md`, `docs/BENCHMARKS.md`

Starts after `cpu-native` merges.

### The harness

[bench/sqlite/run.mjs](../../bench/sqlite/run.mjs) builds `main.ts` with a plain `--link` and times nish, a byte-identical copy and a C twin, interleaved and rotated by round. Add `--variant pgo|native|pgo-native`:

- **`pgo`:** build an instrumented binary, then train it. The training run is `feed`, `lookup` and the insert workloads, on a database built with a *different seed and row count* from the timed one, in a temp dir, so the profile is not fitted to the exact rows measured. Then `llvm-profdata merge`, then `--pgo-use`.
- **`native`:** `--cpu native`.
- **`pgo-native`:** both.

Each variant is timed against the plain build and the plain build's byte-identical copy, in the same interleaved rounds. So every comparison carries its own noise band (plain against its copy). The profile lives under `build/`, never in the repo. `--validate --variant X` checks that the variant reads the same rows and checksums as the twin.

### The measurement

Run `--rounds 12` (or more if the band is wide) for `pgo`, `native` and `pgo-native` on this container. Keep the raw output. The harness times wall ns per call in a single-threaded loop. Record that it is not per-request CPU, and state that the machine is this container's CPU (`lscpu` model and flags), not the benchmark box. Read each delta against its noise band and both IQRs, per bench/README.md 1975–1980 and .claude/testing.md "A Measured: trailer". A delta inside the band is reported as no measurable change.

### The record

A docs/BENCHMARKS.md section for the SQLite feed workload: plain vs PGO, plain vs native, plain vs PGO+native. Each row gives min, median, IQR and noise band. The section names the commit whose bench code produced it, the CPU, the LLVM version and the exact commands. It claims only the fields run.mjs prints. bench/README.md gains the `--variant` usage. The commit's `Measured:` trailer states the figures with their band.

## Out of scope

- Caching PGO objects keyed on a profile hash. The bypass is enough, and caching an instrumented build buys nothing.
- nish running `llvm-profdata merge` itself, or a one-command `--pgo-train` mode.
- Committing any profile to the repo.
- Changing scripts/build.sh's own last-wins and silent-ignore behaviour for its direct callers. nish refuses before it gets there.
- Other `--cpu` levels (`x86-64-v4`, aarch64 levels).
- Per-request CPU measurement in bench/sqlite.

## Verification

Per stage, the `verification` line above, plus `node tests/self/goldens.js --update` after any `src/` change (read the diff). CI's eight `test` shards, `bootstrap`, `nish-cmp` and `lint` must be green and not degraded on the PR head.
