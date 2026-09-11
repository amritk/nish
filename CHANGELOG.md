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

The release pull request is where a release is reviewed: every merge to `main`
refreshes it with the version bump, the JSON and this section, and merging it
creates the tag. [docs/wp12-release.md](docs/wp12-release.md) has the
procedure, and `CLAUDE.md` has the commit convention the headings come from.
Between releases `[Unreleased]` is empty, because there is nothing to write by
hand — the git log is the working account until a release turns it into one.

## [Unreleased]

## [0.1.0] - 2026-09-11

### Build

- **release: Generate releases from commits, on a release train**

  The account of what changed moves from a file maintained by hand to the
  commits themselves, because the commits are what a release contains and a
  hand-maintained file drifts from them.

  scripts/changelog-gen.mjs walks the log since the last tag and writes
  changelog/<version>.json: one file per release, carrying every entry's type,
  scope, breaking flag, title, prose body, measurements, refs, tests, commits,
  author and date, plus the release's range and artifacts. That JSON is the
  record and the website reads it; CHANGELOG.md and the GitHub release notes are
  rendered from it, so there is one account of a release and two views of it,
  which cannot drift.

  The subject gives the heading and the version bump, the body gives the prose.
  Subject-only generators throw the body away, which is the half worth keeping
  here -- the explanation of why a lowering is the way it is. `Measured:`,
  `Refs:` and `Tests:` trailers become structured fields, and `Release-Note:`
  replaces a body written for the reviewer rather than the reader. Co-authorship
  and session trailers are stripped from every body: they are bookkeeping, not
  what changed. A subject that is not conventional is filed under
  "Uncategorised" with its body intact and reported, because a release that
  silently omits a change is worse than one with an untidy heading.

  The train: every merge to main refreshes one open "Release <version>" pull
  request carrying the bump, the JSON and the rendered section; merging it
  creates the tag; the tag builds and publishes. The notes are reviewed in the
  pull request whose body is those notes, before anyone can read them. The bump
  touches self/branding.ts as well as package.json, because tests/run.js fails
  when the two disagree and the release PR would otherwise be red at itself.

  release.yml now publishes from the reviewed JSON rather than a fresh walk of
  the log, caps a body over 120,000 characters at a paragraph boundary, and
  fails on an empty one. That last check is not hypothetical: with CHANGELOG.md
  emptied, `changelog-section.sh 0.1.0` fell back to an empty [Unreleased] and
  exited 0, so the release would have shipped a blank body.

  pr-title.yml checks the pull request title, since squash-merge makes it the
  commit subject. It shells out to the generator's own --check-subject so CI
  enforces exactly what the generator parses, rather than a second copy of the
  rule that can drift from it; the title is passed through the environment
  rather than interpolated into the shell.

  changelog/0.1.0.json is generated from the 181 commits behind this branch.
  All 181 predate the convention and are filed as "Uncategorised" with their
  bodies intact, which is the migration working as intended rather than a gap.

  npm run check and npm test green: 1212 passed, 0 failed, 2 skipped.

### Uncategorised

- **Add zero-GC arena runtime, LLVM performance attributes, and LTO build pipeline**

  Performance and binary-size pass toward Rust-parity output:

  - runtime/runtime.c (4 KB source, 1.1 KB compiled): chunked bump/arena
    allocator with O(1) reset, plus length-prefixed immutable UTF-8 strings
    (new/concat/eq/len/print/from_i32/from_f64). No GC, no stdio on hot paths.
  - src/codegen/runtime.ts: runtime ABI declarations with noalias/nonnull/
    nocapture/allocsize attributes and an alwaysinline IR copy of the bump
    fast path that reads @sts_arena directly; only sts_arena_grow (cold,
    noinline) calls into C. Declarations are emitted only for symbols the
    module uses, or all of them with --runtime-decls.
  - src/codegen/attributes.ts: call-graph fixpoint purity analysis (readnone/
    readonly), loop detection (willreturn), and escape analysis for string
    params (nocapture). Emits nounwind, noundef, zeroext on i1, nonnull/
    noalias/readonly/align 8 on strings.
  - Emitter adds natural alignment to alloca/load/store; --plain restores
    the bare Phase 1 output.
  - IR builder gains attribute groups, param/return attributes, and module
    sections for types, globals, declarations, and raw definitions.
  - scripts/build.sh: debug/speed/size/wasm profiles with the exact clang,
    LTO (lld), gc-sections/dead_strip, and strip flags; scripts/size-report.sh
    prints the before/after table (9.5 KB debug -> 4.5 KB size, 279 B wasm).
  - examples/node-host.mjs: Node imports the wasm module (recommended interop
    direction instead of embedding a JS engine).
  - Tests: runtime.c unit test, IR/C arena layout smoke test via LTO link,
    size and wasm profile builds, plain and attributed golden IR.

- **Add master plan with parallelisable work packages**

  Consolidates the language spec, architecture (Biome for DX, dedicated
  Phase 0 AST validator, checker, emitter, runtime, build), what exists,
  open decisions, and twelve work packages with scope, dependencies,
  acceptance criteria, waves for parallel agents, conventions, and an
  agent brief template.

- **WP-P: split checker/emitter into dispatch tables, add golden case harness**

  Prepares the pipeline for parallel work on new language constructs:

  - src/checker/ is now a package: index.ts (core + dispatch), statements.ts
    and expressions.ts (handler tables keyed by ts.SyntaxKind, plus a binary
    operator table), declarations.ts, scope.ts, program.ts, context.ts
    (CheckContext extension interface).
  - src/codegen/emit/ mirrors it: statements.ts and expressions.ts handler
    tables with an EmitContext; emitter.ts keeps module assembly, function
    setup, runtime prelude, and dispatch.
  - Emitted IR is byte-identical to the previous implementation for every
    existing example and flag combination.
  - tests/cases/ golden harness: <name>.ts with .ll golden, optional .args,
    .err (must reject), .out (native stdout via <name>.c or tests/driver.c).
    tests/run.js discovers cases, supports a name filter and
    UPDATE_GOLDENS=1. Existing goldens and negative tests migrated; new
    cases for f64 mode, locals round trip, and string parameter attributes.
  - npm run check (tsc --noEmit) and npm run test:update.

- **Time the validator on a synthetic 1,000-line file in the test runner**

  Generates build/test/validator_perf.ts (200 five-line functions with
  locals, arithmetic, calls, string and boolean expressions, loops), parses
  it once, then times validateStaticTS alone. Measured about 2 ms warm and
  under 6 ms cold on 23,000 nodes; the gate is 50 ms for CI headroom.

- **Use Biome's preset field instead of the deprecated recommended flag**

  biome migrate rewrote the config; rule set is unchanged.

- **Merge wp3/strings: string literals, concat, equality, length, templates, console.log**

- **Add modules, entry point wrapper, and linkage control (WP5)**

  Programs may now span several files. `export function` marks a function
  callable from other modules; `import { f, g as h } from "./m"` (relative
  specifiers only, .ts optional) binds the exporter's signature so calls are
  type checked across modules. A new `Compilation` (src/compilation.ts)
  loads the root file(s) and their imports transitively, parsing each file
  once so cycles terminate, collects every module's signatures before any
  body is checked, rejects symbol clashes that would fail at link time, runs
  the attribute analysis over all modules, and emits one .ll per module.

  Lowering:
    - An imported function is a `declare` in the importer carrying exactly
      the parameter, return, and function attributes of the exporter's
      `define`, rendered from the same signature and program-wide facts.
    - The entry module's `export function main` is emitted as `@sts_main`
      and wrapped by `define i32 @main(i32 %argc, i8** %argv)`, which calls
      it, calls `sts_free_arena`, and returns the code (0 for void).
    - `--strict-exports` gives non-exported functions `internal` linkage;
      exported functions are always external.

  CLI: multiple inputs, `-o <dir>/` for one .ll per module, `--link <exe>`
  (scripts/build.sh + runtime.c, `--profile`), `--strict-exports`.

  Tests: goldens for export, strict linkage, and both entry wrappers;
  reject cases for import/export forms and `main` with parameters; a
  `tests/link/` harness that builds whole programs with `--link`, compares
  the exit code, checks goldens, llvm-as, opt -passes=verify, and that
  every importer `declare` matches its `define` attribute for attribute.
  Cases containing `export function main` link without tests/driver.c.

- **Clean dist before building so stale modules cannot shadow new ones**

- **Add control flow: if/else, loops, break/continue, throw, ?:, &&/||, op=, ++/--**

  Lowering (src/codegen/emit/control-flow.ts): every construct becomes named
  basic blocks laid out as clang does (if.then/if.else/if.end, while.cond/
  body/end, do.body/cond/end, for.cond/body/inc/end, cond.true/false/end,
  land.rhs/end, lor.rhs/end; `.N` suffix on reuse, reserved in source order).
  Conditions are `br i1`; the ternary and short-circuit operators merge with
  `phi`, reading the incoming label after each arm so nested arms are right.
  Mutable locals stay in entry-block allocas, so loops load/store and mem2reg
  rebuilds the SSA form; a `sum += i % 1000` loop vectorises under opt -O2.
  Blocks that cannot fall through are never appended to; `if.end` is skipped
  when both arms return, `for.end` when a `for (;;)` has no break, and the exit
  of `while (true)`-style loops ends in `unreachable`. `throw` evaluates its
  operand, calls `llvm.trap` and ends in `unreachable`.

  Checker (src/checker/control-flow.ts): conditions must be boolean (no
  truthiness); `&&`/`||` take and yield booleans; ternary arms must agree;
  compound assignment and ++/-- need a mutable numeric local; break/continue
  need an enclosing loop. Termination analysis: if/else with both arms
  terminating, infinite loops without a break, break/continue/throw. The
  unreachable-code diagnostic now names the terminator.

  Attributes: `willreturn` is now a call-graph fixpoint that requires every
  loop to be a counted loop with a wrap-free i32 induction variable, no
  `throw`, and willreturn callees; `throw` also makes a function impure.

  The new handlers register into the existing dispatch tables with one spread
  each; prefix operators moved to an operator-keyed table so ++/-- register
  the same way. IRFunction gained newBlock/placeBlock for unique labels.

- **Add member dispatch registries for property access, method calls, and new**

  checker/members.ts and codegen/emit/members.ts hold tables keyed by the
  receiver's type kind (properties, methods) or constructor name (new), plus
  namespace properties and fact collectors for attributes.ts. Strings
  register their .length entry; classes and arrays register theirs without
  touching each other's files. Emitted IR is unchanged.

- **Add interop: C header, wasm .d.ts, N-API addon profile (WP8)**

  Host-side declarations are generated from the same checked program the
  IR came from, so they describe exactly the symbols and signatures in the
  .ll modules:

  - runtime/statictsc.h: public C header for the runtime ABI (sts_str
    layout, struct sts_arena and its global, every runtime.ts function,
    STS_SYMBOL for keyword-named functions). C11/C++ clean under
    -Wall -Wextra -Werror -pedantic; a test asserts every RUNTIME_FUNCTIONS
    name has a prototype.
  - --emit-header <file.h>: prototypes for every external function
    (exported, plus non-exported without --strict-exports; the entry main
    is omitted). number -> int32_t/double, boolean -> bool, string ->
    const sts_str * in / sts_str * out. A function named after a C keyword
    (`double`) is declared as `double_` bound with an asm label.
  - --emit-dts <file.d.ts>: typings for the wasm exports (i1 results are
    typed 0 | 1, which is what wasm hands back), string functions listed as
    comments, plus `load(bytes: BufferSource): Promise<Exports>` that
    examples/node-host.mjs now implements.
  - --emit-napi <shim.c> and scripts/build.sh --profile napi: a Node-API
    shim with argument count/type checks per scalar function (string
    functions skipped with a comment, sts_reset_arena/sts_free_arena always
    exposed), built with the speed flags plus -shared -fPIC against the Node
    headers found next to `node` (NODE_INCLUDE overrides; a missing
    node_api.h is a clear error). examples/node-addon.mjs loads it.
  - bench/ffi.mjs + bench/sum.ts: per-call FFI cost versus one batched
    call (42 ns per N-API crossing, 2.8 ns per wasm crossing, 0.3 us for
    the whole batch); numbers in docs/wp8-interop.md.
  - tests/run.js "WP8: interop" block: header/runtime.ts agreement, strict
    -Werror compiles of the public and generated headers, a C driver through
    them, tsc on the .d.ts files, addon build/load/TypeError check, and
    .node versus .wasm result agreement (skipped without Node headers).

- **Add JS number formatting, i64, random, exit, and file I/O to the runtime**

  sts_str_from_f64 now prints exactly what JavaScript's String(x) prints:
  the shortest digit string that round-trips (precision 1..17 via %.*e and
  strtod) laid out per ECMA-262 (plain form for exponents in (-6, 21],
  exponent form with e+X / e-X otherwise, -0 as 0, NaN, Infinity). Checked
  against Node on the unit-test cases and 5,000 random doubles.

  sts_str_from_i64 formats 64-bit integers (from_i32 delegates to it).
  sts_random is xorshift64* seeded lazily from time and pid, returning 53
  bits in [0, 1). sts_exit wraps exit. sts_read_file / sts_write_file /
  sts_append_file are open/pread/write wrappers over one arena string; a
  failure prints "statictsc: cannot read/write <path>" and exits 1. No
  stdio on any hot path.

  Budget: 7,402 bytes of source (limit 8,192), 2,688 bytes of .text at -Oz
  (limit 4,096).

- **Add Math intrinsics, i64, numeric conversions, process.exit, and file I/O**

  Math.sqrt/floor/ceil/trunc/sin/cos/exp/log/pow/abs/min/max lower to LLVM
  intrinsics declared nounwind willreturn readnone through the runtime
  declaration table (declared only when used, never in the --runtime-decls
  prelude), so callers stay readnone. Math.round is floor + compare + select
  because JavaScript rounds half toward +infinity, which neither llvm.round
  nor floor(x + 0.5) matches. Math.PI / Math.E are constants; Math.random
  calls sts_random (write effect). f64-only functions on an i32 number are a
  checker error pointing at --number-mode f64 or toF64(x).

  i64 is a first-class type (i64, align 8) for locals, params, returns,
  arithmetic, comparisons, templates, and console.log (sts_str_from_i64).
  Numeric literals take their type from context (annotated initializer,
  return, call argument, the other operand of a binary operator,
  Math.min/max, f64-only Math functions, process.exit), so `let x: i64 = 5`
  and `x * 2` need no suffix; the rule is documented in checker/math.ts.
  toI32 / toI64 / toF64 lower to sext / trunc / sitofp and the saturating
  llvm.fptosi.sat.* intrinsics so f64-to-integer is defined for every input.

  process.exit(code) lowers to a noreturn call to sts_exit followed by
  `unreachable`; the checker treats the statement as a terminator, and a new
  callsNoReturn fact propagated by the purity fixpoint removes willreturn
  from every function that can reach it. readFileSync / writeFileSync /
  appendFileSync are plain identifier builtins over sts_read_file and
  friends, consulted only when no user function of that name exists.

  New handler modules: src/checker/{builtins,math,io}.ts and
  src/codegen/emit/{builtins,math,io}.ts, registered by spreads into the
  existing builtin and expression tables. tests/run.js links round trips
  with -lm (sin/cos/exp/log/pow become libm calls). reject_unknown_builtin
  moves from Math.sqrt (now supported) to Math.foo.

- **Add arrays: T[] / Array<T>, literals, new Array<T>(n), a[i] with bounds checks, .length, push, for...of**

  Layout (ABI, src/codegen/runtime.ts + runtime/runtime.c): an array value is a
  `%struct.sts_array*` to an arena header `{ i64 len, i64 cap, i8* data }`, one
  header type for every element type; `data` holds `cap` elements of sizeof(T),
  arena-allocated and 8-aligned. Element access bitcasts `data` to `T*`.

  Lowering (src/codegen/emit/arrays.ts): literals allocate header + data through
  the inline `sts_alloc_struct` and store each element; `new Array<T>(n)` clears
  the data with `llvm.memset` (scalar T only: a zeroed pointer element would be a
  null string/array, so `new Array<string>(n)` is rejected); `a[i]` widens the
  index to i64 (`sext` / `fptosi`), compares `icmp ult` against `len` and
  branches to a cold `bounds.fail` block that calls the noreturn
  `sts_panic_index(idx, len)` ("index out of range: <idx> >= <len>", exit 1)
  followed by `unreachable`; `--unchecked-indexing` drops the check (unsafe,
  benchmarks). `.length` is one `load i64` + `trunc`/`sitofp`; `push` grows via
  `sts_array_grow` (doubling, 4 from empty) when `len == cap`, stores at `len`
  and yields the new length; `for (const x of a)` is an index loop
  (forof.cond/body/inc/end) over an i64 alloca that re-reads `len` each
  iteration, with break/continue through the loop stack. Element assignment
  (`a[i] = v`, `a[i] op= v`) wraps the existing `=`/`op=` handlers and falls
  back to them for non-element targets, so a property-target path composes.

  Checker (src/checker/arrays.ts): one element type per literal; `[]` takes a
  contextual type (annotation, return type, assignment target, enclosing
  literal, callee parameter, push receiver) or is an error; numeric indices
  only; `.length` read-only; `push` argument must match; `for...of` needs an
  array and declares the element variable (const or let).

  Attributes (src/codegen/attributes.ts): array params are `noundef nonnull
  align 8`, plus `readonly` when never stored through or aliased and only passed
  to callees whose matching param is readonly, and `nocapture` under the same
  rule for captures (both a fixpoint over the program's call graph); no
  `noalias`. A checked `a[i]` adds the noreturn `sts_panic_index` callee so the
  function loses `willreturn`; a `for...of` whose body has no push, user call or
  throw is a counted loop. Fact collectors now receive the compiler options.

  Also: `IRFunction.emitAlloca` suffixes repeated names (`%x.addr.1`), which two
  same-named `let`s in sibling loops previously turned into invalid IR;
  `EmitContext.declareType` for module-level named types; the array header type
  is declared whenever a signature mentions an array.

  Tests: tests/cases/arr_*.ts goldens with native round trips (literal, index
  read/write, new zeroed, length, push past capacity, for...of with
  break/continue, sum, insertion sort, string[], number[][], f64 mode,
  unchecked), reject_arr_*.ts negatives, a WP4 harness block that verifies every
  module, checks the bounds panic exits 1 with the message, and asserts `opt
  -O2` vectorises the sum loop (unchecked build, and the checked build once
  inlined into main); runtime_test.c covers sts_array_grow. runtime.c is 5,461
  bytes of source and 1,496 bytes of .text at -Oz.

- **Add classes, interfaces and structs (WP2)**

  A class or interface becomes `%struct.Name = type { fields in declaration
  order }` with natural alignment, size and padding computed as clang lays out
  the same C struct. Values are `%struct.Name*` into the arena.

  Lowering:
  - `new C(args)`: `call i8* @sts_alloc_struct(i64 sizeof)`, bitcast, then
    `call void @C.constructor(%struct.C* obj, args)`. A class without a
    constructor stores its literal field initializers inline instead.
  - Constructors and methods are functions `@C.member` whose first parameter
    is `%this`; they are ordinary entries of `CheckedProgram.functions`, so
    purity facts, `--strict-exports`, cross-module declares and symbol-clash
    detection cover them unchanged. Constructors store the initializers
    before their body.
  - `p.x`: `getelementptr inbounds` + `load`; `p.x = v` / `p.x op= v`:
    `store`, dispatched through a new `assignmentTargetCheckers/Emitters`
    table keyed by the target's kind (arrays can register `a[i] = v` there).
  - Object literals typed by their context allocate and store every field;
    a class value used where an interface it implements is expected is
    recorded in `program.coercions` and lowered to one `bitcast` by the
    emitter core, so `sameType` stays a by-name comparison.
  - `export class` / `export interface` and importing them by name (no
    renaming: the type name is ABI); an importer declares the class's
    constructor and methods with the exporter's attributes and emits
    `type opaque` for struct types it only points at.

  Checker rules: typed fields with literal initializers, no inheritance,
  static, accessors, optional fields or index signatures; `readonly` fields
  assignable only as `this.f` in their constructor; definite assignment
  (every field assigned on every path before any return, no read of an
  unassigned field, no use of `this` before every field is assigned);
  `implements` requires the identical field list; `this` only in members;
  `<` on struct values rejected.

  Attributes: struct params and returns get `noundef nonnull align 8
  dereferenceable(sizeof)`; `noalias` only on a constructor's `this`;
  `readonly` when the function never stores through the pointer, never lets
  it escape and only passes it to callees whose parameter is readonly;
  `nocapture` likewise, both by a fixpoint over `pointerParams`. Escape
  analysis is now position based (`classifyUse`), which also closes the
  string holes for `return c ? a : b` and `const t = s; return t`. The
  inline allocator is treated as a willreturn writing callee.

  Tests: cls_* goldens with native round trips (including f64 mode),
  reject_cls_* negatives, tests/layout/structs.{ts,c} (sizes cross-checked
  against `_Static_assert`s built with -std=c11 -Wall -Wextra -Werror and
  every offset read back through compiled getters), and link tests for
  exported classes.

- **Document classes, interfaces and struct layout (WP2)**

  docs/wp2-classes.md: TypeScript and exact IR per construct, the layout
  table for the ten layout-test structs, the definite-assignment rule, the
  contextual typing rule for object literals and class-to-interface
  conversion, module rules, the attribute rules for struct pointers, and the
  rejected forms. README: class/interface rows in the type table and the new
  constructs under "Supported today".

- **Add --version, an exit-code contract, and toolchain detection to the CLI**

  - `-v` / `--version` prints the package version read from package.json at
    runtime (src/version.ts), so it survives `npm pack` and `npm version`.
  - Exit codes: 0 ok, 1 compile error (CompileError, driver refusals, ENOENT
    on inputs), 2 usage, 3 toolchain, 70 internal compiler error.
  - Internal errors name the input files, ask for a bug report at the issue
    tracker, and print the stack only with STATICTSC_DEBUG=1.
    STATICTSC_SIMULATE_ICE=1 is the test hook for that path.
  - `--link` probes `$CC --version` (default clang) before compiling and, when
    it is missing, prints per-platform install commands and exits 3.
  - A failing scripts/build.sh has its stderr surfaced verbatim, the .ll paths
    are named, and the exit code is 3.
  - build.sh and runtime.c are resolved from the package root (dist/..), so a
    global install works from any working directory.

- **Package hygiene, smoke test, and tag-driven release workflow**

  - package.json: `files` whitelist (dist, runtime, scripts, README.md,
    LICENSE, docs/INSTALL.md), prepublishOnly = check + build + test,
    repository/bugs/homepage at github.com/amritk/compiler, keywords,
    `npm run smoke`. The tarball drops from 583 files to 92.
  - LICENSE: MIT, "StaticTS contributors".
  - CHANGELOG.md: Unreleased section summarising every work package so far.
  - scripts/smoke.sh: builds every examples/**/*.ts with `export function
    main` using --link --profile size, runs it (expected exit from a
    `// smoke: exit <n>` comment, default 0), prints a size table, fails on
    any error. examples/hello.ts is the INSTALL.md hello world.
  - scripts/changelog-section.sh: prints one version's CHANGELOG section for
    the release notes.
  - .github/workflows/release.yml: on v* tags, calls the CI workflow
    (workflow_call added to ci.yml), checks the tag matches package.json,
    npm pack, verifies the tarball is self-contained, and attaches it to a
    GitHub release with `gh release create`. npm publish stays a commented
    step that needs NPM_TOKEN.
  - ci.yml: runs the smoke script after the tests.

- **Document installation and the release procedure; test exit codes and the tarball**

  - docs/INSTALL.md: prerequisites per OS (Ubuntu apt clang-18/lld-18, Fedora,
    macOS brew llvm@18, Windows via WSL), npm install -g, hello world through
    --link, exit-code table, troubleshooting.
  - docs/wp12-release.md: what ships, exit codes and failure modes, the smoke
    test, and the bump / changelog / tag / workflow procedure.
  - README: Setup trimmed to point at INSTALL.md; Usage lists --version and
    the exit codes.
  - tests/run.js: `WP12: exit codes` (--version, usage, ENOENT, ICE with and
    without STATICTSC_DEBUG, clang missing via an empty PATH, build.sh failure
    via a stub CC) and `WP12: package` (npm pack contents, install the tarball
    into a temp prefix, run the installed statictsc from an unrelated cwd,
    skipped without clang). 374 -> 396 checks.

- **Merge wp12/release: --version, exit-code contract, packaging, LICENSE, CHANGELOG, smoke script, release workflow**

- **Add nbody example (classes, arrays, Math in f64 mode); smoke script accepts per-example flags**

- **Add differential testing against Node: corpus, fuzzer, and a typed rewrite**

  tests/differential/run.js builds every whole program in tests/cases and
  tests/differential/corpus with statictsc --link, runs it, rewrites the same
  source to JavaScript (types from the compiler's own checker so i32/i64
  arithmetic wraps, string .length is a byte count, a[i] is bounds-checked,
  throw traps) and runs it under Node with runtime/shim.mjs, then compares
  stdout and exit status byte for byte. tests/differential/fuzz.js generates
  random integer/boolean programs; 200 programs at seed 20260906 agree.

  The corpus (50 programs) surfaced three semantic gaps, recorded in
  docs/wp13-differential.md and known-failures.txt without changing the
  compiler: Math.pow(±1, ±Infinity) returns 1 (C99) where ECMAScript says NaN,
  and INT_MIN / -1 and x / 0 are undefined (SIGFPE) where JS has an answer.

  npm test gains two checks (corpus + a 10-program fixed-seed fuzz batch);
  npm run test:diff runs the full table.

- **Nbody example: shortest round-trip literals and Math.PI (lint clean)**

- **Changelog: classes, differential testing, nbody example**

- **Consolidate the documentation: language reference, IR cookbook, architecture, FAQ, README tour**

  docs/LANGUAGE.md is the normative reference: lexical rules, the type table
  with LLVM mapping, alignment and C ABI, declarations, every statement and
  expression with its typing rule, builtins with signatures and effects, the
  semantics decisions, the complete validator forbidden list with exact
  message fragments, the checker's rejections, and a list of behaviours that
  disagree with the design notes (boolean ordering is inverted, optional
  chaining is silently accepted, -2147483648 is rejected). Every rule cites
  the test case that proves it; rules verified only by compiling a snippet
  are marked "(CLI only)".

  docs/IR_COOKBOOK.md holds, for each construct, the smallest snippet and the
  exact IR the compiler emits today. The listings are generated from
  docs/cookbook/*.ts (with .args for flags) by docs/cookbook/regen.sh, which
  rewrites the blocks between cookbook markers; --check fails when the doc is
  stale. Each attribute that appears is explained in one sentence.

  docs/ARCHITECTURE.md covers the pipeline, the side-table and dispatch-table
  design, the add-a-construct checklist, the ABI contracts with the tests
  that guard them, the runtime symbol table, the attribute soundness rules,
  the build profiles, and the test harness. docs/FAQ.md answers the design
  questions (no any, i32 default, f64 mode, no GC, calling from Node, no
  embedded engine, error format, bug reports). docs/README.md indexes every
  document and marks wp*.md as design notes. docs/check-links.mjs verifies
  every relative link and heading anchor.

  The README is now a short tour: quickstart, feature table linking into the
  reference, CLI, measured sizes, interop, milestones, contributing, license.
  Stale statements were dropped (Phase 1 wording, the -lm TODO that build.sh
  already resolves, outdated runtime sizes) and every fact moved into the
  reference documents. docs/.npmignore keeps the docs index out of the npm
  tarball, which npm would otherwise pack despite the files whitelist.
  Placeholder markers TODO(WP6)/TODO(WP9)/TODO(WP13) mark where the in-flight
  packages add their material.

- **Reject optional chaining and nullish coalescing; accept the -2147483648 literal**

  The validator now rejects ?. and ?? outright (MASTER_PLAN 3.2); the i32
  literal range check accounts for a directly negated literal so INT_MIN is
  writable. Found by the WP11 documentation audit.

- **Ordering comparisons are numeric only; refresh stale design-note text**

  `<` on booleans compiled to a signed i1 compare and reversed the JS result
  (found by the WP11 audit). Ordering now requires numeric operands; equality
  on booleans is unchanged. Design notes no longer claim -lm is missing, that
  loops are unavailable, or that export class is rejected.

- **Add --target, --nsw, and dereferenceable(24) on array pointers**

  --target <triple>|host (src/codegen/target.ts) writes `target datalayout`
  and `target triple` after `source_filename`, using the layout strings clang
  18 emits for x86_64/aarch64 Linux and macOS and wasm32, so `opt -O2` on the
  module vectorises without `-mtriple`. The default stays target-neutral.

  --nsw makes every user-level i32/i64 add/sub/mul carry `nsw` (binary
  operators, unary minus, op= on locals, fields and elements, ++/--) through
  one helper, `intOpcode` in emit/context.ts; sdiv/srem and the compiler's own
  i64 index, length and allocator arithmetic are never flagged. Signed
  overflow is then undefined as in C; the default keeps wrapping.

  Array parameters and returns gain `dereferenceable(24)`: every array value
  points at a complete `{ i64 len, i64 cap, i8* data }` header, so LLVM may
  load `len` speculatively. The eleven arr_* goldens change on their
  signature lines only.

- **Add a PGO recipe to scripts/build.sh**

  --pgo-generate adds -fprofile-generate and --pgo-use <profdata> adds
  -fprofile-use=<file> to the speed, size and napi profiles; the header
  documents the instrument / run / llvm-profdata merge / rebuild sequence and
  the compiler-rt requirement. Measured on the benchmark suite: fib(40) -19 %,
  nbody -3 % (docs/wp9-optimisation.md).

- **Add the benchmark suite, runner, and WP9 results**

  bench/: fib, nbody, spectral norm, sieve, string building and a Vec3 method
  loop, each in StaticTS, C and Rust with the same data layout and evaluation
  order (plus a naive malloc/free C string builder), every one printing a
  checksum. bench/run.mjs builds every variant (speed, --nsw, size profile,
  clang -O3, rustc -O3, rustc native), verifies the checksums agree, times
  them (min/median over 5 runs after a warm-up), measures binary size and
  peak RSS (bench/rss.c), and writes docs/BENCHMARKS.md with the CPU,
  toolchain versions and exact commands. --validate builds and compares only;
  tests/run.js runs it on fib(25) and sieve(1e5) so CI keeps the programs
  correct, and checks --target / --nsw behaviour on the new goldens.

  docs/wp9-optimisation.md records what each flag buys and diagnoses the
  three benchmarks over the 10 % target: vec3 (2.0x) and nbody (1.24x) reload
  fields because arena allocations have no provenance for alias analysis
  (an alloca or noalias experiment recovers C parity), and string building
  (1.5x) page-faults through 48 MB because the arena never frees; all three
  are WP6 territory.

- **Merge wp9/bench: benchmark suite vs C and Rust, --target, --nsw, dereferenceable(24) on arrays, PGO recipe**

  Cookbook regenerated for the new array signature attributes.

- **Add arena marks to the runtime: sts_arena_mark / release / used**

  A mark is the absolute bump address (buf + off), or 0 while the arena is
  still empty, so one i64 identifies both the chunk and the offset.
  sts_arena_release(mark) rewinds to it: within the current chunk it resets
  the offset; for a mark in an older chunk it frees every chunk pushed since
  and makes that chunk current again; mark 0 behaves like sts_reset_arena so
  a hot loop never mallocs a chunk per call; a mark in no live chunk (stale,
  undefined behaviour) is ignored rather than trusted. sts_arena_used reports
  the bytes bumped in the current chunk.

  Comments are tightened to keep runtime.c inside its 8 KB source budget
  (8187 bytes; 3351 bytes of .text at -Oz). The unit test covers all four
  release cases and a 100000-iteration mark/release loop.

- **Stack allocation, arena scopes, Arena builtins, and T | null**

  Escape-analysed stack allocation (src/codegen/escape.ts): a new C(...),
  object literal, array literal or new Array<T>(<literal>) whose value flows
  only into on-the-spot uses, non-capturing callees (the pointerParams
  fixpoint) and never-reassigned locals becomes an entry-block alloca instead
  of an arena bump; a site inside a loop is hoisted once and its slot reused,
  which is sound because nothing can name the previous iteration's object.
  Stack objects and the locals that hold them are own memory for the effect
  analysis, so object-literal and implicit-constructor functions regain
  readnone. --no-stack-alloc keeps everything in the arena.

  Automatic arena scopes: a function whose direct arena allocations (dynamic
  arrays, push growth, string temporaries, results of allocating callees) all
  flow local, with no callee leaking an allocation and no user Arena.reset /
  release in reach, marks the arena on entry and releases it before every ret.
  The facts propagate over the call graph in the existing fixpoint;
  analyzeFunctions runs it, decides, re-collects the facts with the decisions
  applied, and runs it again.

  Arena.reset / mark / release / used are dotted builtins next to console.log.

  T | null for class, interface, array and string types: the same LLVM pointer
  type, null typed by context, === null / !== null by icmp, assignability of
  T to T | null at every value sink, and narrowing to T inside if / while /
  && / || / ?: and after an early exit, dropped at any assignment to the
  variable and before a loop that assigns it. Nullable params and returns lose
  nonnull and dereferenceable; everything else is unchanged.

  Existing goldens changed only where an allocation moved to the stack or a
  function gained a scope; every native round trip is unchanged.

- **Document the memory strategy: docs/wp6-memory.md, README, changelog**

- **Checked integer division (Rust semantics) and ECMAScript-accurate Math.pow**

  Integer / and % now branch to a cold sts_panic_div block on a zero divisor
  or MIN / -1 instead of executing sdiv/srem with a poison result; the
  affected goldens gained the div.fail/div.ok blocks. Math.pow selects NaN
  for pow(x, NaN) and pow(±1, ±Infinity) around llvm.pow.f64. A directly
  negated 2147483648 is accepted in contextual i32 positions too. Both gaps
  were found by the differential harness; the panic cases are listed as
  by-design differences from Node.

- **Re-run benchmarks after WP6, changelog for WP9, tighter runtime.c comments**

  vec3 2.02x -> 0.95x of Rust, nbody 1.24x -> 1.11x with stack-allocated
  non-escaping objects; string building stays at 1.9x because returned
  temporaries escape the automatic arena scopes (noted in the analysis).
  runtime.c comments trimmed (8,293 B source, 3,498 B .text at -Oz).

- **Docs consolidation for release; fix the last audit findings**

  README back to the WP11 outline with every still-true fact moved into the
  reference; LANGUAGE.md, ARCHITECTURE.md, FAQ and the IR cookbook cover
  memory model, T | null, checked division, --nsw/--target and differential
  testing. Code: main-parameter message no longer references argv, the
  statictsc.h number-formatting comment is current, 2^53 is accepted as an
  i64 literal, and comparing T | null with T names the nullable side.

- **Accept Int32Array/Float64Array/BigInt64Array as aliases of i32[]/f64[]/i64[]**

  The typed-array names are the StaticTS spellings of the element-typed
  arrays a Node host passes. They resolve to the same StaticType as `i32[]`,
  `f64[]` and `i64[]` (`TYPED_ARRAY_ALIASES` in types.ts), so there is no
  second layout and no conversion: a `Float64Array` parameter accepts an
  `f64[]` argument, `push` works, and `sameType` holds. `new Int32Array(n)`
  and friends register `newCheckers` entries that share the `new Array<T>(n)`
  checker with `T` fixed by the name and reuse `newEmitters.Array`, so the
  lowering is byte for byte the existing header + `llvm.memset` sequence. A
  type argument on an alias is rejected in both positions.

  The differential rewrite treats `new Int32Array(n)` like `new Array<T>(n)`
  (a zero-filled plain array) so Node sees the same values.

  Goldens: arr_typed_views (aliases in every position, native output),
  reject_arr_typed_view_typearg, reject_arr_typed_view_type_annotation_arg,
  reject_arr_typed_view_mismatch. LANGUAGE.md types table and `new` section.

- **Add sts_alloc_array and a freestanding wasm runtime for arrays**

  `sts_alloc_array(elemSize, len)` is a host entry: header plus `len`
  uninitialised elements, `len == cap`, from the arena. Compiled code never
  calls it (literals and `new Array` use the inline allocator); the wasm
  loader and C hosts do, so it is declared in runtime.ts (part of the
  `--runtime-decls` prelude, hence the cookbook line) and in statictsc.h,
  and exercised by runtime_test.c. runtime.c grows from 8,293 to 8,594 bytes
  of source and from 3,498 to 3,600 bytes of .text at -Oz (budget 4 KB).

  runtime/runtime_wasm.c is the subset the wasm profile can link without
  libc: linear memory past `__heap_base` is one arena chunk grown with
  `memory.grow`, `sts_alloc_struct`/`sts_arena_grow`/mark/release/used,
  `sts_alloc_array`, `sts_array_grow` (`__builtin_memcpy`, lowered to
  memory.copy), and the panics as `unreachable` (a RuntimeError in the host).
  Field widths follow the IR contract (`i64 off`/`cap`, and `sts_arena_grow`
  takes a `uint64_t`), not size_t, because wasm32 pointers are 4 bytes and
  the inlined fast path bumps the 64-bit field directly. The wasm profile now
  passes `-mbulk-memory` so the `llvm.memset` behind `new Array<T>(n)` lowers
  to memory.fill instead of an undefined `memset`.

  statictsc.h documents the array header contract for hosts: `const
  sts_array *` for read-only parameters, a stack-built header to pass a host
  buffer, borrowed for the call only.

- **Marshal typed arrays and strings across the wasm and N-API boundaries**

  Interop generators (src/interop) now bridge arrays with i32/f64/i64
  elements, which JS sees as Int32Array/Float64Array/BigInt64Array, plus
  strings and i64 (bigint) through the addon.

  abi.ts: `externalFunctions` runs the attribute analysis once and records
  which array parameters a function stores through (the same fixpoint that
  decides `readonly` in the IR); `cType` spells those `sts_array *` and every
  other array parameter `const sts_array *`. `typedView` maps element kinds to
  the JS constructor, element size and N-API tag; `tsKeyword` prints arrays.

  header.ts: arrays get prototypes with the const rule and a comment naming
  the C element type. A -Werror C driver in tests/run.js passes a stack-built
  header over an int32_t buffer to `sumI32` and `fill` and reads a returned
  array.

  dts.ts + wasm.ts: the .d.ts declares typed-array signatures and, when a
  function uses arrays, the runtime exports; `--emit-dts x.d.ts` also writes
  x.mjs, the loader that implements `load()`. Per call it marks the arena,
  copies each typed array into `sts_alloc_array` storage through a view on
  memory.buffer (offset 16 is the data pointer on wasm32), calls the raw
  export, copies an array result out (`.slice()`, since memory.grow detaches
  views), copies written-through parameters back so wasm agrees with the
  borrowing addon, and releases the arena in a `finally` so a trap leaks
  nothing. Scalar-only exports pass through; add.wasm stays 279 bytes.

  napi.ts: a typed-array argument is borrowed, not copied: the shim checks
  the kind with napi_get_typedarray_info and builds the sts_array header on
  the C stack over the JS bytes, so writes through the parameter land in the
  caller's buffer; the callee must not retain it. Results are fresh typed
  arrays (napi_create_arraybuffer + memcpy + napi_create_typedarray). String
  arguments are measured and copied into arena sts_str values, string results
  go through napi_create_string_utf8, i64 uses the bigint getters. Every
  function that touches the arena brackets the call with sts_arena_mark /
  sts_arena_release, on the failure paths too, so hosts never reset it for
  bridged calls. Unbridgeable signatures are still listed as skipped.

  Examples: examples/arrays.ts; node-host.mjs uses the companion loader when
  <module>.mjs sits next to the .wasm and accepts `f64:1,2,3`-style typed
  arguments; node-addon.mjs demonstrates zero-copy `fill` and typed results.

  Bench: sumArray(Float64Array) rows in bench/ffi.mjs. One call with 1M
  elements runs at 0.54 ns/element through N-API (borrowed) and 1.13 through
  wasm (copied in) against 0.96 for the JS loop; docs/wp8-interop.md carries
  the measured table.

  tests/run.js: arrays header/.d.ts/.mjs checks, the C driver, wasm and
  N-API round trips that must agree value for value (fill in place, i64,
  1M-element batch, trap recovery), strings through the addon, both example
  hosts; runtime_wasm.c compiles for wasm32 under -Werror -pedantic; tsc is
  resolved through require so a worktree without node_modules finds it.

- **Add multi-error reporting, --json diagnostics, AST/checked dumps and -g debug info (WP10)**

  Multi-error reporting: the parser, the Phase 0 validator, signature
  collection, import binding, symbol-clash detection and body checking hand
  every CompileError to one DiagnosticSink (src/diagnostics.ts) instead of
  throwing on the first. Recovery is per forbidden construct (a rejected
  node's subtree is skipped), per declaration (a rejected class/interface is
  marked poisoned so its layout checks are skipped) and per statement at the
  innermost statement list (the enclosing function is marked poisoned and
  its definite-return check is skipped). Between phases the sink sorts what it
  collected by file (load order) and position and throws the first error with
  the rest attached as `additional`, so pass 2 never runs over broken
  signatures, the emitter never sees a poisoned program, and every caller
  that only knew single errors still gets the exact message it always got.
  `let x: T = <rejected>` still declares `x` as `T` so later uses do not
  cascade. The driver prints at most 20 errors, then `...and N more errors`
  and an `N errors` line; a lone error prints byte-for-byte as before.

  --json prints one {file, line, column, endLine, endColumn, severity,
  message} object per error on stdout, nothing else, same exit code.

  --emit-ast prints every module's syntax tree (SyntaxKind with real token
  names, 1-based start-end positions, identifier and literal text);
  --emit-checked prints the checker's side tables and attribute facts
  (structs with layout, functions with resolved signatures, facts,
  pointer-parameter facts, locals with types, callees). Both go to stdout
  and suppress IR; goldens compare a `.stdout` sidecar.

  -g (src/codegen/debug.ts) emits `!llvm.dbg.cu`, the module flags, a
  DICompileUnit (DW_LANG_C99) and DIFile, a DISubprogram per function
  (attached via a new IRFunction.subprogram), a DILocation on every
  instruction (IRFunction.setLocation; `emit` appends `, !dbg !N` while a
  location is active; the emitter sets it around each statement and
  expression and restores it after), llvm.dbg.value for parameters and
  llvm.dbg.declare for let/const and for-of slots, with int/long/double/
  bool/char* basic types, DICompositeTypes for classes and interfaces with
  the checker's offsets and for `T[]` headers with `data` typed `T*`.
  Without -g the IR is byte-identical (every golden unchanged). `--link -g`
  passes -g to scripts/build.sh, which compiles every input with -g and
  skips the strip step of every profile.

  Tests: reject_multi_error / reject_multi_forbidden / reject_multi_decl
  (`.err` may now list several fragments), dump_ast and dump_checked
  (`.stdout` goldens), dbg_locals (-g golden, verified and run natively), and
  a WP10 block that checks the 20-error cap, --json, opt -passes=verify on
  the -g IR, and that a `--link -g` binary (debug and speed profiles) has a
  DWARF line table naming the .ts file under llvm-dwarfdump or objdump
  (visible SKIP when neither exists).

- **Add single class inheritance via struct prefix (WP2b)**

  `class D extends B` lays %struct.D out as B's fields followed by D's own,
  at the same natural alignment (the checker copies the base FieldInfos,
  indices and offsets included, then runs the ordinary layout over the
  flattened list), so a %struct.D* is a valid %struct.B* after one bitcast.
  A derived field may reuse the base's tail padding, which the layout test's
  C twins list flattened (classes K, L, M) rather than nesting the base.

  Lowering:
    D -> B          a coercion on the expression, like class -> interface;
                    the emitter core inserts `bitcast %struct.D* to %struct.B*`
                    at every value sink (initializer, assignment, argument,
                    return, field store, ternary arm, B[] literal element,
                    xs[i] = d, xs.push(d), B | null)
    d.m()           resolved by the receiver's declared type or its nearest
                    ancestor declaring m (findMethod); `this` is bitcast to
                    that class: static dispatch, no vtable
    super.m()       `this` seen as the base type; SuperKeyword is bound to
                    the `this` local so the attribute analysis tracks the flow
    super(args)     `call @B.constructor(%struct.B* <bitcast this>, args)`
                    after storing the initializers of constructor-less
                    ancestors in between; emitted in the constructor prologue
                    when omitted (allowed only when no ancestor constructor
                    takes parameters); required as the first statement,
                    with no `this` in its arguments
    new D(args)     a class without a constructor inherits the nearest
                    ancestor's: own initializers, then the base construction

  Rules: extends names one class of the same module (not an interface, an
  import, itself or a descendant); an exported class extends an exported
  class; no redeclared fields; an override keeps the signature; readonly
  fields are assignable only in the declaring class's constructor;
  `implements` checks the flattened layout and is inherited. Definite
  assignment covers the class's own fields, the inherited ones once super()
  ran. dereferenceable(N) keeps the declared parameter type's size (a
  derived object is at least as large); the flow of `this` into the base
  constructor is recorded per derived constructor by collectFacts.

  Also fixed on the way: a `new C(...)` whose constructor captures `this`
  no longer becomes an alloca (escape.ts consults the constructor's `this`
  facts), and `new C(...)` in an interface- or base-typed position allocates
  and constructs C (intrinsicType) instead of the target type; field
  initializer constants are emitted from the literal and the field type so
  an inherited or imported initializer needs no type-table entry.

  The C header now declares every class and interface as a struct with the
  flattened fields and every method/constructor as Class_method(struct
  Class *, ...) bound with STS_SYMBOL; the layout harness static-asserts the
  header's sizes. The differential rewrite makes the implicit super() call
  explicit for Node; cls_extends_override is a known failure (static
  dispatch). runtime.c is unchanged (8,293 B).

- **Add process.argv, parseInt/parseFloat/Number, and a wasi build profile**

  process.argv is a namespace property typed string[]. The entry wrapper
  @main calls sts_argv_init(i32 %argc, i8** %argv) as its first statement
  whenever any module of the program reads it (the checker records usesArgv,
  the Compilation copies it onto the entry program), and every read lowers to
  `load %struct.sts_array*, %struct.sts_array** @sts_argv, align 8`, an
  external global declared per module. The runtime builds the array once with
  malloc (header, pointer vector, one block per string) so Arena.reset can
  never free it; index 0 is C's argv[0], the program path. It is a memory
  read (readers are at most readonly) and read-only at the language level:
  element stores, op=, ++/-- and push are rejected, and any use in a program
  without `export function main` (a wasm or N-API library) is a compile error,
  since only the wrapper has argc/argv; the Compilation tells every checker
  whether the entry has main before bodies are checked.

  parseFloat(s): f64, Number(s): f64 and parseInt(s): i32 lower to one
  runtime symbol, `double sts_parse_number(i8* s, i32 mode)` (mode 0, 1, 2);
  parseInt is followed by llvm.fptosi.sat.i32.f64, so no digits give 0 (NaN
  has no i32) and out-of-range values saturate like toI32. The runtime lets
  strtod/strtoll do the correctly rounded work after ruling out the spellings
  JavaScript rejects (inf, infinity, nan); the parameter is readonly nocapture
  but the function's effect is write (errno). Number(x) on i32/i64 is sitofp,
  on boolean uitofp, on f64 nothing, and a literal argument is typed f64.
  Documented deviations: ASCII whitespace only, parseFloat reads a 0x prefix
  as hex like strtod, no 0b/0o in Number, parseInt has no automatic hex.

  --profile wasi links runtime.c against wasi-libc for --target=wasm32-wasi
  (sysroot from WASI_SYSROOT or the usual locations; compiler-rt's wasm32
  builtins from clang's resource dir, next to the sysroot, or WASI_BUILTINS,
  since wasi-libc's strtoll needs __multi3). runtime.c compiles clean for
  wasi with -Werror: getpid, which WASI lacks, is replaced by the monotonic
  clock for the RNG seed, and a weak asm-labelled bridge defines
  __main_argc_argv (what wasi-libc's _start calls) in terms of the IR's
  @main. examples/wasi-host.mjs runs the module under Node's node:wasi;
  tests/run.js builds argv_echo for wasi and compares the output when a
  sysroot is installed, and prints `skipped: no WASI sysroot` otherwise.

  Runtime size at -Oz (`size` text column): 3,498 -> 4,093 bytes (budget
  4,096; .text section alone 2,172 -> 2,583). Tests: argv_echo (+ .argv side
  file support in tests/run.js), parse_numbers, five reject_* cases,
  link/argv_import and link/argv_no_main, runtime_test.c parsing and argv
  cases, three differential corpus programs with shim equivalents
  (process.argv -> process.argv.slice(1)), and the `// smoke: argv` hook for
  examples/argv.ts.

- **Add agent and contributor guidelines under .claude/**

  Carry the shared house rules from the mjst, mini and agent-ummo repos into
  this one: comment and JSDoc guidelines, TypeScript principles, the testing
  style, an architecture map, and root CLAUDE.md / AGENTS.md entry points,
  plus the Biome editor settings and a PR template.

  The rules are adapted rather than copied verbatim where this codebase is
  deliberately different: it is a Node + npm package rather than a Bun
  monorepo (so node.md replaces bun.md), it uses function declarations,
  interfaces and a few stateful classes throughout (typescript.md says so
  instead of contradicting every file), and its tests are golden .ll cases
  driven by tests/run.js rather than a unit-test framework (testing.md
  describes the harness and what every construct must ship with). Every
  example and prefix named in the files was checked against src/ and
  tests/cases/.

- **Make the TypeScript rules and Biome lint follow the language**

  Rewrite .claude/typescript.md around the two kinds of TypeScript in the
  repo. For StaticTS programs (examples, cookbook, bench, test cases) the
  language reference is the style guide, and the file restates its shape:
  function declarations only, annotated signatures, no casts, no unions
  beyond T | null, strict equality, boolean conditions, no ?. or ??. For
  the compiler source the rule is to write it as StaticTS would have it
  wherever that costs nothing, and to keep the dynamic parts at the
  typescript API boundary, where a SyntaxKind-keyed table is the proof for
  a cast.

  Port the sibling repos' Biome lint set and extend it with the rules that
  mirror the validator: noVar, noExplicitAny, noEnum, noNamespace, noVoid,
  noParameterAssign, useExplicitLengthCheck, useConsistentArrayType and
  useFilenamingConvention (kebab-case for the compiler, snake_case for
  StaticTS programs). useOptionalChain and useExponentiationOperator are
  turned off because they push code towards ?. and **, which the language
  rejects. The example, cookbook and benchmark programs are now linted too,
  with the unused-variable and numeric-literal rules off for them; test
  fixtures stay out of scope because a reject_* case exists to contain what
  the rules forbid. The sibling formatter settings (single quotes, no
  semicolons) are deliberately not carried over.

  Bring the tree to green under the new rules: the seven unwrapParens-style
  cursors reassign a local instead of the parameter, and the truthy .length
  checks become explicit comparisons. No behaviour changes; the full suite
  passes.

- **Bring runtime.c back inside its size budget**

  runtime/runtime.c compiled at -Oz (`size` text: code, read-only data and
  .eh_frame) goes from 4,195 to 3,714 bytes and the source from 11,432 to
  9,392 bytes, with no observable change: every prototype, symbol, message,
  exit status and output byte is the same, and tests/runtime_test.c asserts
  exactly what it did before.

  Measured step by step (text at -Oz, kept only when it paid):
  - One cold exit path: sts_die is noreturn/cold/noinline; sts_panic_index
    and sts_io_fail format with one dprintf each instead of digit loops and
    four write calls; sts_panic_div picks its literal and calls sts_die.
    4,195 -> 3,981. (A variadic vdprintf sts_die was larger: 4,072.)
  - sts_str_from_f64 indexes the %.*e buffer in place (DIG macro), uses the
    round-trip search counter as the digit count, and emits all four JS
    layouts from one digit loop plus snprintf("e%+d") for the exponent form.
    3,981 -> 3,738. Fuzzed against Node String(x) on 40,024 doubles.
  - reset/free/release share sts_free_until: 3,738 -> 3,723.
  - sts_put_file checks the descriptor before the loop: -> 3,719.
  - sts_read_file accumulates the count in a local: -> 3,714.
  Rejected after measuring: one-malloc argv table (3,775), strtod-first
  parse_number (3,761), sts_io_fail as a macro (3,755), folding sts_io_fail
  into a three-argument sts_die (3,723), cold on the exported panics (0).

  The source pass (casts on implicit conversions, one macro each for the
  out-of-memory literal and the cold attribute list, NAN/INFINITY from
  math.h, contract-only comments) leaves every function's compiled size
  identical; three rewrites that moved code generation were reverted.

  scripts/size-report.sh prints a `runtime` row (the budget number) above
  the profile rows. docs/wp9-optimisation.md gets a "Runtime budget"
  section with the before/after table and the per-step numbers.

- **Adopt type aliases and arrow functions as the house style**

  Record the sibling repos' two conventions for the compiler's own source
  and wire up the lint that enforces them:

  - useConsistentTypeDefinitions asks for `type` over `interface`, and
    useConsistentMethodSignatures for a property rather than method
    shorthand, which is also checked contravariantly.
  - Biome ships no rule for `function` declarations (useArrowFunction only
    rewrites function expressions), so biome-plugins/no-function-declaration.grit
    is a GritQL plugin asking for an arrow bound to a const.
  - useArrowFunction, useShorthandFunctionType and useConsistentArrowReturn
    are clean today and are errors.

  The three rules with a backlog are warnings, not errors: the source
  predates them, warnings do not fail biome check, and the count is the
  size of the migration that is left. Nothing is converted here.

  An override exempts StaticTS programs from all of it. The language has
  neither arrow functions nor type aliases, so `function` and `interface`
  are the only spellings available in examples, cookbook and bench.

  Correct the claim that StaticTS forbids those constructs. Phase 0 lets
  both through and rejects only generic type parameters on them; it is the
  checker's Unsupported-in-Phase-1 fallback that refuses them, which is the
  bucket a later work package empties. What is forbidden by design is the
  Function type, because an indirect call through a function pointer ends
  the whole-program purity, termination and escape analysis.

- **Re-run benchmarks and tidy the changelog for the merged wave**

  Benchmarks measured with 15 timed runs after 3 warm-ups; a 5-run batch was
  too noisy in this environment to compare against Rust. Move the memory
  strategy entry back into the Added section and the link reference to the
  end of the file, where a merge had left them out of order.

- **Use an explicit length check in the header emitter**

  The house lint rules added on main flag a truthy .length test as an error.

- **Re-roll fuzzer seeds that generate invalid TypeScript**

  The generator can emit a comparison of the shape `a < b > (c)`, which
  TypeScript parses as a type-argument list; tsc rejects those programs at the
  same positions statictsc does, so they compare nothing. Parse each generated
  program and re-roll the seed while it has a syntax error, deterministically,
  so a saved failure still reproduces from its seed.

- **Add module-level const declarations**

  A top-level `const NAME: T = <constant expression>` names a value the
  compiler already knows. It is not a global variable: the checker folds the
  initialiser and every use site carries the value, so no symbol, no
  initialiser and no relocation is emitted, and the rule that a module has no
  top-level code — and therefore no initialisation order — still holds. An
  imported constant folds the same way in the importing module, so
  `export const` costs no `declare`.

  The initialiser is an ordinary StaticTS expression restricted to literals
  and other constants: exactly the operators of docs/LANGUAGE.md, over
  literals, module constants and parentheses. A constant that could compute
  something a runtime expression cannot would be a second, larger language
  hiding inside the first, so bitwise operators are absent here for the same
  reason they are absent everywhere else.

  Folding follows the language's own arithmetic. Integer arithmetic wraps at
  the declared width, so `2147483647 + 1` is `-2147483648` as the emitted
  `add` would give; a bare literal takes the width of the constant it
  initialises, so `const BIG: i64 = 1000000000 * 10` is computed in 64 bits;
  `f64` folds in IEEE-754; `+` on two strings concatenates and interns once.
  The two failures the emitted divisor check catches at run time are refused
  at compile time instead. A value that does not fit its annotation is an
  error rather than a wrap.

  Folding is lazy and memoised on the ConstInfo, so a constant may name one
  declared later in its module or in a module checked afterwards, and a cycle
  is diagnosed rather than recursed into.

  The differential rewriter substitutes a constant's folded value for its
  initialiser when rewriting to JavaScript, which is the faithful translation
  — the value is the whole of what the constant is — and carries the wrapping,
  the i64 width and the folded concatenation across for free.

  `--emit-checked` prints each constant's folded value, and an imported one is
  named on its `import` line.

- **Start self/ with the token kinds of StaticTS-0**

  The first module of the self-hosted compiler: the token kinds the lexer, the
  parser and the diagnostics all have to agree on. They are module constants
  because the language has no `enum`, and because a magic number repeated at
  forty use sites is how a bootstrap compiler starts to rot.

  The kinds are contiguous from zero so a later dispatch can switch on them
  densely, and the keywords are grouped so `isKeyword` is one range check
  rather than a table.

  `tests/run.js` grows a WP14 section: stage0 must compile every module of
  `self/` cleanly, and `self/tokens.ts` must emit no global. The second check
  is the point of module constants — if a token kind ever became a global, every
  use would cost a load on the lexer's hot path. Today the 74 constants compile
  to no IR at all, and the module's only content is `isKeyword`.

  The section is a compile gate until stage1 exists, and it fails the moment
  `self/` reaches for something the language does not have.

- **Add the bitwise operators**

  `& | ^` lower to `and` / `or` / `xor`, `~x` to `xor x, -1` (LLVM has no
  `not`), and `<< >> >>>` to `shl` / `ashr` / `lshr`, with the compound forms
  `&= |= ^= <<= >>= >>>=` going through the same load-apply-store the `+=`
  family uses on a mutable local. Operands are two `i32` or two `i64` of the
  same type, one for `~`.

  Shift counts are masked to the operand width, which is the decision that
  shapes the lowering. LLVM makes a shift at or beyond the width poison;
  JavaScript masks the count, so `x << 33` is `x << 1`. We follow JavaScript:
  `a << b` on `i32` is `shl i32 %a, (%b and 31)` and on `i64` `shl i64 %a,
  (%b and 63)`. A constant count is masked in the emitter and written out as the
  masked literal, so `x << 3` stays one instruction and no `and` reaches the IR;
  a negative literal is masked the same way (`-1` becomes 31), and the fold is
  done on the AST so the negation never emits a dead `sub`. That makes the i32
  shifts exactly JavaScript's and removes a UB footgun from a language whose
  premise is that a program that compiles has known behaviour.

  `>>>` on `i32` diverges from JavaScript by design: JS produces an unsigned
  32-bit value inside a double, so `-1 >>> 0` is `4294967295`, while an `i32` is
  signed and the raw bits read back as `-1`. That is the same choice the language
  already makes when integer arithmetic wraps instead of promoting; the
  differential rewriter appends `| 0` to an i32 `>>>` so Node and the native
  binary agree, and routes the i64 shifts through new shim helpers because BigInt
  neither masks its counts nor has `>>>` at all.

  `f64` is refused because StaticTS never converts implicitly, with the
  `--number-mode f64` flag named in the message when that is why `number` is a
  double; `boolean` is refused with the operator that does the job instead
  (`&&`, `||`, `!==`, `!`), since JavaScript's `true & true` is the number 1 and
  there is no truthiness here to turn it back.

  None of these has a panic path, unlike `/` and `%`, so a function whose
  arithmetic is all bitwise keeps `readnone` and `willreturn`; `bit_attributes`
  pins that. Eight golden cases, five `reject_bit_*` cases, four differential
  corpus programs (including an FNV-1a hash loop), the LANGUAGE.md rules and
  semantics decisions, and two cookbook entries come with it.

- **Replace the self-hosting gap list with a measured one**

  The plan's gap list ended in "whatever the port turns up", which is the part
  most likely to bite. It is now derived from two independent sweeps that agree:
  a census of all 53 files of src/ (every library facility, every string and
  array method, with call-site counts) and a set of probe programs compiled
  against today's language to find what it actually refuses.

  Three things the guess had missed:

  f64ToBits is a blocker. LLVM only accepts decimal float literals that round
  trip exactly, so the emitter writes `double 0x400921FB54442D18` — today via
  Buffer.writeDoubleBE. StaticTS cannot see a double's bits, so without one
  bitcast the self-hosted emitter cannot emit any f64 constant at all.

  Diagnostics go to stderr. All 16 of them, and two dumps write without a
  trailing newline; console.log is stdout-and-newline only. Two five-line
  runtime functions, or every .err golden gets re-baselined.

  readFileSync exits the process on a missing file, so a compiler cannot turn
  it into its own `Cannot find module` diagnostic and carry on loading the
  other imports.

  join is promoted from convenience to requirement with a number: building
  88 KB of IR text by repeated `+` costs 180 MB of peak RSS, because every
  concatenation allocates a fresh copy and the arena never reclaims. A
  self-compile emitting a megabyte that way would need tens of gigabytes.

  Also records the five decisions the census forces — error recovery without
  try/catch being much the hardest, at 292 throw sites against six catches,
  every one of them load-bearing — and what is deliberately not being added,
  with the reason.

  Two gaps found by probing are fixed here. An empty array literal now takes
  its element type from a field assignment target, so `this.children = []` in
  a constructor works; every container class hits that on its first line. And
  the un-narrowed-nullable diagnostic now recognises a field or element
  receiver and names the binding idiom with the reader's own expression,
  instead of telling someone who just wrote a null check to write a null
  check.

  Performance is recorded as the tiebreaker for language decisions, with the
  worked examples that make the rule concrete rather than decorative —
  including one where reading the generated assembly showed a semantics choice
  was free, and the rule that says to go and read it.

- **Add the performance work package**

  Records the northern star and what follows from it: fastest binary first,
  smallest binary second, with "faster" meaning measured rather than assumed.

  The bounds-check answer is a proof pipeline, not a flag. Ranged integer
  types, length-narrowing guards that promote an array to a tuple, and
  slice iterators that lower for...of to pointer advancement, with the
  runtime panic kept as the floor for what none of them prove. An explicit
  opt-out is deferred on purpose: every check the proofs eliminate is one
  nobody needs to escape, so it is worth counting the survivors first.

  Two flags become defaults. --strict-exports wins on speed and size at
  once. --nsw is the larger change and is written down as such: it
  withdraws the documented wrapping guarantee, so --wrapping exists to
  restore it, the differential corpus that relies on wrapping runs with it,
  and every affected golden is re-pointed deliberately rather than deleted.

  Error handling is a discriminated Result<T, E> lowered to a tagged union
  in registers, which needs full monomorphised generics, unions beyond
  T | null, and narrowing on a boolean discriminant. Unsigned u8 through
  u64 come with it, and retire the signed-bits reading of >>>.

  All of it is enforced rather than documented: a performance diagnostic
  class, on by default and never affecting the exit code, that fires when
  the compiler had to take a slow path and a faster one existed. The
  obligation that comes with being on by default is that every warning must
  name a concrete rewrite, because a warning nobody can act on teaches
  people to ignore the class.

- **Add f64ToBits/bitsToF64 and fix prototype names in dispatch tables**

  f64ToBits and bitsToF64 reinterpret a double's 64 bits rather than
  converting its value: toI64(1.5) is 1, f64ToBits(1.5) is
  0x3FF8000000000000. They exist because a compiler emitting LLVM IR has no
  other way to write a float constant — LLVM accepts only decimal float
  literals that round-trip exactly, so every other double must be emitted as
  its bit pattern, which src/ does today through Buffer.writeDoubleBE. Both
  lower to one bitcast: no call, no memory, no runtime symbol, and a function
  that only reinterprets bits stays readnone. Identified as a blocker by the
  census in docs/wp14-selfhost.md (B1).

  Writing the test turned up a real bug. The validator, checker and emitter
  are each a dispatch table keyed by name, and the key comes from the program
  being compiled. A plain object literal inherits from Object.prototype, so a
  program declaring `function valueOf` found Object.prototype.valueOf sitting
  in the table and used it as a handler — which is how `error: function
  valueOf() { [native code] }` came to be a compile diagnostic. The same held
  for toString, constructor, hasOwnProperty and their siblings, as a function,
  a class, or a local, and for `new constructor()`.

  All ten user-keyed lookups now go through src/lookup.ts. It is a function
  rather than a comment at each site so a new table cannot quietly
  reintroduce the bug: the rule is that a table indexed by user text is read
  through `lookup`.

  Contextual typing of non-integer literals also reaches two more positions,
  both found by writing the differential corpus program for the bit builtins:
  an array-literal element and a field assignment target, so
  `const xs: f64[] = [0.5]` and `this.ratio = 0.25` compile in the default
  i32 number mode instead of being rejected as non-integer literals.

  The differential shim reads the bits through a DataView, which is the only
  way JavaScript can see them, so Node and the native binary agree bit for
  bit across zero, the signed zeros, pi, and the extremes of the range.

- **Add unsigned integer types u8, u16, u32 and u64**

  LLVM has no unsigned types, so u8/u16/u32/u64 lower to i8/i16/i32/i64 and
  the signedness lives entirely in the operations. Representing an unsigned
  value therefore costs nothing, and a u8 field packs a struct exactly as a
  C uint8_t does (tests/layout adds a fifth-width struct pinned against
  clang).

  The lowering, per operation:

    + - *, unary -, ++/--   add / sub / mul, unchanged (two's complement)
    / %                     udiv / urem
    < <= > >=               icmp ult / ule / ugt / uge
    >>                      lshr (ashr on a signed type)
    widening conversion     zext (sext on a signed source)
    narrowing conversion    trunc
    to / from f64           uitofp / llvm.fptoui.sat
    Math.abs                nothing: the value is its own magnitude
    Math.min / Math.max     llvm.umin / llvm.umax
    console.log, `${x}`     zext to i64, then sts_str_from_u64

  `signedOpcode` in emit/arithmetic.ts is the single place that swaps a
  signed opcode for its unsigned twin, so every construct that computes with
  integers -- binary operators, `op=` on locals, fields and elements --
  picks the right instruction without its own branch.

  Two consequences are worth calling out. The divisor check gets cheaper:
  unsigned division has no MIN / -1 case, so its check collapses from three
  compares plus an `and` and an `or` to a single `icmp eq ..., 0`
  (tests/cases/u_div_one_check pins both sequences side by side, and
  u_div_zero_panic proves the cheaper check still fires). And a conversion
  between two integers of the same width and different signedness emits no
  instruction at all, because the bits do not move.

  Overflow wraps, as it does for the signed widths. `--nsw` now takes the
  operand type: it emits `nuw` on an unsigned add/sub/mul and `nsw` on a
  signed one, since a u32 passing 2^31 has not overflowed and `nsw` there
  would poison an ordinary result.

  toU8/toU16/toU32/toU64 join the conversion builtins, and the contextual
  literal machinery gains the range check that makes `const b: u8 = -1` and
  `const b: u8 = 256` errors naming the width. While there, `contextType`
  learns four more contexts a literal can take its type from -- an array
  literal element, a class field initializer, a constructor argument, and a
  field or element assignment target -- which is what lets a u8 be written
  at all, and fixes the same gap for i64.

  Shifts `>>` and `>>>` are new. Both take two operands of one integer type.
  `>>` is ashr on a signed type and lshr on an unsigned one; `>>>` is always
  lshr, so the two are synonyms on an unsigned type and code generic over a
  width may spell either. `i32 >>> n` keeps its documented behaviour of
  yielding the raw bits read as signed (-1 >>> 0 is -1, not JavaScript's
  4294967295); with u32 that answer is now reachable, which is the wart this
  change retires. A literal shift amount at or beyond the width is a compile
  error, since LLVM makes a wider shift poison and masking it would cost an
  `and` on every shift for a case that is always a bug.

  Interop: --emit-header spells the widths uint8_t .. uint64_t and --emit-dts
  number / bigint (u64 as a bigint, following i64). The N-API shim keeps its
  own reader table and reports an unsigned signature as not bridged, as it
  already does for anything it cannot marshal.

  Runtime: one new symbol, sts_str_from_u64, sharing the signed formatter's
  digit loop through a static str_from_digits(value, negative) helper so the
  four widths need one function rather than four. .text at -Oz goes from
  3,714 to 3,765 bytes, inside the 4,096-byte budget.

  Differential testing covers all four widths against Node. JavaScript has no
  unsigned integers, so the rewriter masks each result back into its width
  (& 0xFF, & 0xFFFF, >>> 0, BigInt.asUintN(64, x)) and routes any conversion
  with an unsigned side through one shim helper that performs the whole
  sext/zext/trunc matrix through BigInt.

- **State the paradigm, and give constructor arguments literal context**

  The project's paradigm is data-oriented and procedural, and it is a
  deliberate "neither" rather than a compromise: pure OOP puts a pointer
  chase between the CPU and the data, pure FP puts an allocation between
  them, and a compiler targeting bare-metal speed and small binaries cannot
  afford either. Flat structs in contiguous memory, top-level functions LLVM
  inlines, explicit mutation, and functional idioms only where they remove
  runtime work.

  Most of that is already what StaticTS is, so wp15 §1a is written as a frame
  with an enforcement table rather than as a change: classes are already flat
  C structs with no prototypes and no vtables, functions are already top-level
  and their purity is computed rather than declared, and closures are
  forbidden outright rather than merely restricted. Inheritance chains stay
  allowed at any depth, having been considered for restriction and left
  alone — the struct-prefix layout is correct at depth and costs nothing, and
  a rule with no cost behind it is just a rule.

  The one place the language was not data-oriented is recorded as §2a:
  Point[] stores one pointer per element, so iterating it chases a pointer
  per element and scatters the fields across memory — the exact pattern the
  paradigm exists to avoid, sitting in the middle of the language. Struct
  arrays become contiguous, with the use-after-free that growth introduces
  made a compile error rather than waved away.

  Also fixes the third contextual-typing gap found by probing: a constructor
  argument now gives a non-integer literal its type, so `new Point(1.5, 2.25)`
  compiles in the default i32 number mode. The array-element and
  field-assignment cases landed in the previous commit; this completes the
  set, and the test case now covers all three.

- **Add the 32-bit float type f32**

  f32 is LLVM's `float`, and every operation is the instruction f64 already
  uses one width down: fadd/fsub/fmul/fdiv/frem, fcmp o*, fneg. Float
  division stays unchecked (the divisor check is an integer rule). A struct
  of f32 is half the footprint of one of f64 and gives twice the SIMD lane
  count, so it serves the speed and the size goal at once: the layout test
  gains `{f32, f64, f32, bool}` at 24 bytes, pinned against clang, and
  `class Vec3 { x: f32; y: f32; z: f32; hits: u32 }` is 16 bytes where three
  doubles alone would be 24.

  Most of the change is turning `kind === "f64"` into a new `isFloat`
  predicate at the dozen sites that meant "floating point" rather than "the
  double width" -- the opcode table, compound assignment on locals, fields
  and elements, ++/--, `+` and `===` in the string-aware handlers, the array
  index widening, and the DWARF basic types.

  Conversions: `toF32` joins the builtins, `fptrunc` narrows from an f64 and
  `fpext` widens back, an integer converts in with sitofp or uitofp by the
  *source's* signedness, and out through the saturating
  llvm.fpto{s,u}i.sat.<T>.f32. As with every other numeric type there is no
  implicit conversion, so `f32 + f64` is the same same-type error as
  `u32 + i32`.

  Constants are the part that would have broken silently. LLVM writes a
  `float` constant with the 64-bit hex of the double it equals and requires
  that double to be exactly representable as a float, so `f32Constant` rounds
  through `Math.fround` before encoding: 0.1 as an f32 is
  `float 0x3FB99999A0000000`, the double nearest to (float) 0.1, and not the
  f64 spelling 0x3FB999999999999A. tests/cases/f32_constant holds both side
  by side, and every f32 golden is checked with llvm-as.

  Printing widens with fpext and reuses sts_str_from_f64, so the digits are
  what JavaScript prints for the float's value -- 0.10000000149011612 for a
  0.1 that is 0.1 as an f64 -- and the runtime gains no code at all: .text at
  -Oz is unchanged at 3,765 bytes.

  Math.abs/min/max work through llvm.fabs.f32 and llvm.minnum/maxnum.f32; the
  f64-only Math functions stay f64-only and say so. Float32Array is one more
  typed-array alias for f32[], which the existing alias machinery makes a
  two-line addition: one entry in TYPED_ARRAY_ALIASES and one case in
  typedView, with the N-API and wasm loaders generic over it already.
  --emit-header spells the type `float` and --emit-dts `number`.

  The differential rewriter models f32 with Math.fround at every point an
  f32 value is produced -- arithmetic results, unary minus, ++/--, literals,
  and conversions through the same `convert` shim helper -- so Node agrees
  byte for byte on values that are not representable in a float.

- **Add `switch` / `case` / `default`**

  The first of the WP14 wave-A gaps: every phase of a compiler is a dispatch
  on a node kind, and today that is an `if` chain.

  An integer discriminant and constant labels lower to one LLVM `switch`, so
  the backend gets a jump table (`llc -O2` emits `jmpq *.LJTI0_0(,%rax,8)` for
  twelve dense labels). Labels are folded in the checker — a literal, its
  negation, or a module constant — and recorded in `caseValues`, so the emitter
  writes the table without re-deriving anything. A literal label takes the
  discriminant's width, the same way an operand takes it from the other side
  of a binary operator.

  The block layout follows clang: a clause with statements gets one block and
  an empty clause points at the next one that has some, which is the whole of
  StaticTS's fallthrough (`case 1: case 2: body`). A clause with statements
  must end in a terminator unless it is the last, so no clause silently runs
  into the one below it; and a clause cannot declare a variable without a block
  of its own, because TypeScript gives every clause one shared scope, which
  would leave the declaration visible but unassigned below it — reachable here,
  a temporal-dead-zone throw under Node.

  `break` and `switch` share a target stack: a `switch` pushes a break target
  with no continue target, so `break` leaves the switch while `continue` looks
  past it for the enclosing loop, and an infinite loop containing a `switch`
  whose clause breaks is still infinite.

- **Add the string byte methods**

  WP14 A2: `charCodeAt`, `substring`, `indexOf`, `startsWith`, `endsWith` and
  `String.fromCharCode`, the set a lexer needs. Every offset is a UTF-8 byte
  offset, like `s.length` already is; a code-point index would cost a decode
  per access, and the loop these exist for reads one byte at a time.

  They lower inline rather than to runtime functions. `charCodeAt` is the
  array bounds check against the byte length, one `getelementptr` past the
  8-byte header and a `load i8`, so a function that only reads bytes stays
  `readonly` and out of range panics with the same message `a[i]` gives.
  `substring` is JavaScript's clamp — both ends into `[0, len]` with
  `llvm.smin`/`llvm.smax`, then the pair in order — and one `sts_str_new`:
  one allocation, one memcpy. `opt -O2` folds the whole clamp of a literal
  into `max(0, min(n, len))`. `indexOf` is a scan emitted at the call site,
  which keeps the search out of `runtime.c`.

  The one new runtime symbol is `sts_str_at(s, at, sub)`, shared by
  `startsWith` (offset 0), `endsWith` (offset `len - sub.len`, negative and so
  false when the suffix is longer) and the `indexOf` scan. `runtime.c` is
  3,842 bytes of `.text` at `-Oz`, inside the 4,096-byte budget; a runtime
  search function would have cost another 171.

  The analyses had to learn two things: a string method reads its receiver
  rather than retaining it, so a string parameter keeps `nocapture readonly`,
  and `substring` and `String.fromCharCode` are allocation sites, so a result
  that outlives the function disables the caller's arena scope instead of
  being released under it.

- **Add array `pop`, `indexOf` and `join`**

  WP14 A4, the last of wave A. `join` is the one that matters: the emitter
  builds ~88 KB of IR text, and doing that with `s = s + t` in a loop copies
  everything again per part and never reclaims — 180 MB of peak arena, and
  tens of gigabytes for a self-compile. So `join` had to be the fast shape:
  one pass summing the parts' lengths, one `sts_alloc_struct`, one
  `llvm.memcpy` per part and per separator. The separator before the first
  part is skipped by selecting a length of zero rather than by branching, so
  the copy body stays a single block.

  It is `string[]` only. Converting elements would allocate one string each,
  which is the shape `join` exists to replace, and the message says so and
  points at template literals.

  `pop` stores the shortened length back and loads the element, leaving the
  capacity alone so the next `push` reuses the storage; an empty array panics
  through the same `sts_panic_index` an index does, reported as `0 >= 0`,
  because there is no `undefined` to return and no second return type to
  widen to. `indexOf` scans with the `===` of the element type: `sts_str_eq`
  for strings, `fcmp oeq` for floats so a `NaN` element is never found, and
  `icmp eq` for everything else, which is identity for class, interface and
  array pointers.

  All three lower inline. A runtime `join` measured 252 bytes of `.text` at
  `-Oz` against a 254-byte margin, which would have left nothing for B2 and
  B3; `runtime.c` is unchanged at 3,842 bytes.

  A numeric literal argument to `push` or `indexOf` now takes the element
  type, so `wide.push(3)` on an `i64[]` is an `i64` three rather than an
  i32-versus-i64 mismatch.

- **Add console.error, the newline-free writes, readFileSyncOrNull and panic**

  WP14 B2, B3 and D1 — the wave-B gaps that are not about types but about a
  compiler being a program that reports things.

  Every one of a compiler's diagnostics goes to stderr and two of its dumps
  write without a trailing newline, and `console.log` is stdout-and-newline
  only. `console.error(x)` takes exactly what `console.log` takes; `write(s)`
  and `writeError(s)` write a string as it is on fd 1 or 2. All three go
  through one runtime entry point, `sts_write(s, fd, newline)`, which
  `sts_print` now delegates to, so `console.log` keeps its symbol and no
  existing golden moved.

  `readFileSync` exits the process on a missing file, which means a compiler
  cannot turn it into its own "cannot find module" diagnostic and carry on
  loading the other imports. `readFileSyncOrNull` is the same read answering
  `null`, which subsumes an `existsSync`, has no time-of-check race, and needs
  no new type: the caller narrows it with `if (text !== null)` like any other
  nullable. In the runtime the old function is now the wrapper — the read is
  `sts_read_file_or_null` and `sts_read_file` dies when it answers null — so
  the failing message and its test are untouched.

  `panic(message)` writes the message to stderr and exits 1, the same ending
  an out-of-range index has, and it terminates control flow like
  `process.exit`, so a non-void function may end with it. `throw` traps and
  discards its value, which is right for a program with nothing to say; an
  internal invariant has something to say. It needs no runtime function of its
  own: `sts_write` carries the message and the `noreturn` `sts_exit` closes
  the block.

  runtime.c is 3,950 bytes of .text at -Oz, inside the 4,096-byte budget.

- **Mark the WP14 language gap closed**

  A5 and B1 landed earlier without their rows being updated; with A1, A2, A4,
  B2, B3 and panic in, every row of §3 is done. What is left before S5 is
  library code in `self/` and the four decisions of §3a, neither of which is
  a question about what StaticTS can express.

- **Self-hosting S1: the StaticTS-0 lexer**

  The first milestone of the staged bootstrap, and the first piece of `self/`
  that is not a table. It is new code rather than a port: `src/` has no lexer,
  because the `typescript` package is the scanner there, and 1,558 of its
  references are calls into it.

  Offsets are bytes, because `s.length` and `charCodeAt` are, which is what
  lets a diagnostic slice its line back out with one `substring`. Template
  literals are lexed without the parser's help: a backtick opens a scan that
  ends at the closing backtick or at `${`, and one brace counter per open
  substitution tells that substitution's `}` from a block's.

  The lexer has no opinions. It first refused `==` and `!=` and split `?.`,
  `??`, `...`, `**`, `@` and `#name` into pieces; both were bugs, found by the
  oracle. A lexer that says what is written leaves the refusing to the parser,
  which reads better anyway — "`??` is forbidden; narrow with `!== null`"
  rather than a complaint about a stray `?`.

  The test is `tests/lexer_oracle.js`, which is rule 3 of the work package
  applied to a lexer: stage0's scanner is the `typescript` package's, so run it
  over a file, print the token stream in `dump_tokens`' format, and diff. Over
  `tests/cases/`, `examples/`, `self/`, `docs/cookbook/`, the differential
  corpus and the new `tests/lexer/` fixtures that is 482 files and 50,968
  tokens with no disagreement, including every `reject_*` case, whose forbidden
  syntax has to tokenise cleanly, and files with multi-byte characters, where
  the scanner's UTF-16 offsets are mapped through the source's byte prefix.
  One divergence stands by design: the scanner hands back a bare `>` so a
  parser can close nested type arguments one at a time, and this one merges
  `>>` because StaticTS-0 has no such list.

  `self/dump_tokens.ts` is the other half of the proof — the lexer built by
  stage0 and run natively. Over 129 KB of the compiler's own source it reads,
  lexes 14,000 tokens and writes the dump in 5 ms.

- **Self-hosting S2: the StaticTS-0 parser**

  Recursive descent over the S1 lexer, building the one-class tree of §2.1: a
  `kind` discriminant and the union of the fields any node needs, with a fixed
  child layout per kind, `N_LIST` for the variable-length groups and `N_EMPTY`
  for the absent ones. Nothing downcasts, because there is nothing to downcast
  to — which is what that decision bought, and it reads as well as a hierarchy
  would.

  No exceptions. StaticTS `throw` traps and discards its value, so this is the
  error-value threading of §3a D1 in its first real use: a failed parse is an
  `N_ERROR` node carrying the reason, the message goes on the parser's
  diagnostics, and the caller decides where to pick up. The declaration after a
  broken one still parses, which is the property `tests/parser/recovery.ts`
  pins.

  `tests/parser_oracle.js` is the lexer oracle one level up: walk the
  `typescript` tree, print it in `dump_ast`'s format, diff. That compares the
  shape and every span, not just whether it parsed — 447 files, 53,673 nodes,
  no disagreement. The 43 files it skips are all `reject_*` cases, whose
  forbidden constructs this grammar does not read yet; stage0 rejects those in
  its validator after the `typescript` package has parsed them, so stage1 will
  have to read and refuse them itself, and the tally of which ones is now
  measured rather than guessed.

  Three bugs the oracle found, on top of S1's two, all the same shape — the
  front end having an opinion the scanner does not:

  - `super` was missing from the node model, although the language has
    inheritance; twelve corpus files needed it.
  - `readonly` (and the accessibility modifiers the language accepts and
    ignores) were not parsed on class members.
  - `from` and `of` were hard keywords when they are contextual, so a class
    with a field called `from` did not parse (`tests/cases/cls_nested.ts`).

- **Add the self-hosting support library**

  Wave C of docs/wp14-selfhost.md §3: the 598 lines of StaticTS the checker
  and the emitter will be written over, with no language change, which is the
  claim the wave was making.

  self/strings.ts is StringBuilder (a string[] and one join, because s = s + t
  in a loop is quadratic in both time and memory), compareStrings (StaticTS has
  no `<` on strings deliberately), jsonQuote, the LLVM `c"..."` escape, and
  f64Hex/f32Hex over B1's f64ToBits — the only way an emitter written in
  StaticTS can write a float constant LLVM accepts.

  self/map.ts is StringMap/StringSet, replacing the ~200 Map/Set sites in src/.
  Open addressing over a *dense entry list*: the buckets hold entry indices and
  the entries live in insertion order in parallel arrays. Iteration is therefore
  insertion order, which a golden-compared diagnostic dump needs, and "" is an
  ordinary key rather than a sentinel. No delete: scopes are popped whole, so
  the probe loop needs no tombstones.

  self/paths.ts matches node:path's POSIX behaviour, quirks included, because
  §3a D3's failure mode is a `..` normalised differently from Node's — one file
  loaded twice, cycles that stop terminating, invented duplicate symbols. The
  one deliberate divergence is basenameWithout, since path.basename(p, ext)
  answers "///" for basename("///", ".ts") and disagrees with itself about
  ".ts".

  tests/self/support_oracle.js is the test. There is no src/ phase to diff
  against here, so every line is matched with an implementation that already
  exists: stage0's own escapeBytes and f64Constant for the IR escapes, where a
  disagreement is stage1 emitting a different module; node:path's POSIX side
  for the paths; JSON.stringify, Buffer.compare and Map for the rest. Both
  sides read tests/self/cases.txt, so they cannot drift onto different inputs.
  863 lines agree.

- **Bring an imported class's reachable layouts with it**

  `import { Registry }` where `Registry.all(): Entry[]` gives a module `Entry`
  values it can call methods on and read fields of. Until now the checker
  crashed with an internal error — `structOf: no struct named `Entry`` — because
  `Entry` was in no registry in that module, and even past the checker the
  emitter would have had only `%struct.Entry = type opaque` to compute a field
  offset from and no `@Entry.label` to call.

  Binding a struct import now walks the layouts its members mention — field
  types, and the parameter and return types of its methods and constructor,
  through arrays and nullables — transitively, and registers each one. The
  emitter declares their constructors and methods exactly as it declares an
  imported class's, so a call links against the defining module.

  Only the layout travels, not the name. `program.structs` is now wider than
  what may be *written* as a type, so annotation resolution consults a separate
  set of the names this module declares or imports: `const e: Entry` in a module
  that only imported `Registry` is still `Unsupported type reference `Entry``.
  Two things are deliberately left out for the same reason — they are reached
  through a pointer the checker already holds, never by name: a base class
  named in `extends`, and a method's `this` parameter (which is that base, for
  an inherited constructor). Including either would turn the
  `%struct.Base = type opaque` that `tests/link/extends_import` pins into a
  definition.

  Found while writing `self/diagnostics.ts` for the self-hosted compiler, whose
  `DiagnosticSink.sorted()` hands back a `Diagnostic[]`.

- **Start S3: the type model and the diagnostics**

  `self/types.ts` is `src/types.ts` with one change of representation. A type is
  an interned `i32` rather than a discriminated-union object, so the checker's
  hottest question — are these the same type? — is one integer compare instead
  of a recursive `sameType` and cannot answer "different" for two spellings of
  one type; a type fits in the `i32` a `StringMap` stores, so a scope needs no
  second table; and `T[]` costs one entry rather than one per mention. It
  carries a thirteenth kind stage0 has no counterpart for: `T_ERROR`, D1's
  sentinel, assignable in both directions so one bad expression does not
  produce a diagnostic at every site it reaches.

  `self/diagnostics.ts` is the same summary line, source excerpt and `--json`
  object, over a `SourceFile` that indexes its line starts once — a scan per
  diagnostic is quadratic in a file with many errors — and a sink that orders by
  file-first-mentioned and then position. The sort is the last outstanding item
  of wave C and it is stable, bottom-up merge: two errors at one position have
  to keep the order the phases produced them in, or a multi-error golden is not
  reproducible. Columns are bytes here and UTF-16 code units in stage0; the two
  agree on every ASCII line, which is every line of every `.err` golden, and the
  divergence is written down where it lives.

  Both are checked against stage0 rather than a golden. types_oracle diffs the
  LLVM type, the alignment, the diagnostic spelling and the whole assignability
  matrix over every type either side can build; diagnostics_oracle diffs every
  byte of the messages, the line and column of *every* offset in the fixture,
  the report order, the `...and N more errors` cut and the JSON.

- **Port the scope chain and the narrowing rules**

  `self/symbols.ts` is `src/checker/scope.ts`: a chain of name tables, and the
  narrowings that make `if (p !== null) { ... }` read `p` as its non-null type
  inside the region the condition guards. Narrowings are keyed by identity, as
  they are in `src/`, and identity is what `===` on a class value already gives;
  the lists are short — one scope holds one region's narrowings — so a scan
  beats a second hash table and a `Local` keeps no field that exists only to be
  its own key.

  `declare` answers false where stage0 throws, which is D1's error-value
  threading: the caller reports against the declaration it is already looking
  at, which is the node with the right span anyway.

  This is the part of the checker a program can observe going wrong. A narrowing
  kept one statement too long compiles a load through a pointer the checker
  promised was not null, so the oracle drives both implementations through one
  script — shadowing in a nested block, a narrowing that holds through the
  chain, an inner narrowing that wins over an outer one, and an assignment that
  drops both — and compares every answer.

- **Close the reachable-struct set once the whole program is bound**

  The closure ran inside `bindImport`, using the exporting module's registry as
  it stood at that moment. That registry is only complete after *that* module
  has bound its own imports, so a struct two hops away — `main` imports `mid`'s
  class, whose method returns `leaf`'s — was found or not depending on the order
  the modules happened to be bound in.

  It is now a pass of its own, after every module is bound, against a registry
  of every struct declared anywhere in the program. A struct name is already a
  program-wide symbol (`%struct.<name>`, `@<name>.method`), so a collision is a
  broken program either way and the first declaration wins.

  Found writing the self-hosted compiler's annotation resolver, whose context
  reads a `StringSet` field of a class imported from another module.

- **Port the checker's signature pass**

  `self/checker.ts` and the modules around it are stage0's pass 1 in StaticTS:
  `program.ts` holds the side tables, `context.ts` what every pass is given,
  `annotations.ts` resolves type annotations, `declarations.ts` collects
  function signatures and imports, `structs.ts` classes and interfaces with
  their layouts, `constants.ts` folds module constants.

  206 of 206 corpus files agree with stage0 over 1,255 signature lines. The
  comparison goes through the `--emit-checked` dump both compilers write, so
  what is checked is not that a file was accepted but every struct's size and
  alignment, every field's index and byte offset, every signature and symbol,
  every folded constant, and the order they come out in. The lines later phases
  fill in are filtered out of the diff rather than left out of stage1's format,
  so they start being compared the moment those phases land.

  Three shape changes, each with a reason:

  - Side tables are arrays indexed by a dense `Node.id` the parser hands out,
    not `WeakMap`s. StaticTS has no `WeakMap`, and an array index beats hashing
    a pointer. The rule the `WeakMap`s exist for still holds: the AST carries
    syntax only and the emitter reads what the checker recorded.
  - An annotation resolves against a `typeNames` set that is narrower than the
    layout registry, which is what keeps a layout reached through an imported
    class from becoming a name this module may spell.
  - Folding needs no bigint: `i64` arithmetic in StaticTS already wraps at the
    width, where stage0 computes in bigint and wraps by hand.

  The parser now reports into the shared `Diagnostic` of `self/diagnostics.ts`
  instead of a class of its own, so a syntax error and a checker error land in
  one sorted report. Its messages gain the format they should always have had —
  `file:line:col: syntax error:` and a source excerpt, the same shape stage0
  prints — which is what `tests/parser/recovery.err` now pins.

- **Give a ternary arm the conditional's literal context**

  `const x: f64 = c ? 1.5 : 2.5` was rejected. The context walk that gives a
  numeric literal its type handles an annotated initializer, a `return`, an
  argument, an array-literal element and an assignment target, but had no clause
  for a conditional expression, so the annotation reached a literal written
  directly and not one behind a `?:`.

  Both arms are the value the context asked for, so they inherit it; the
  condition is a boolean and inherits nothing. The golden shows the two arms
  becoming `0x41E0000000000000` and `0x3FE0000000000000` in one `phi`, and an
  `i64` arm taking `5` as an `i64`.

  Found writing the self-hosted checker, where an i32/f64 limit is picked with a
  ternary.

- **Reach layouts through an imported function's signature too**

  `import { lex }` where `lex(): Token` hands this module `Token` values it
  never names, exactly as an imported class's `all(): Entry[]` does — and with
  the same consequence when the layout does not travel: the checker cannot find
  `Token`'s methods and the emitter cannot compute a field offset.

  The closure now seeds from every imported signature's parameter and return
  types as well as from imported classes, and walks on from there as before.

  Found writing the self-hosted checker's statement pass, which imports a
  `caseValue(): CaseValue` from its constant folder.

- **Port the checker's body pass and Phase 0**

  `self/expressions.ts`, `statements.ts`, `members.ts`, `arrays.ts`,
  `builtins.ts` and `validator.ts` are stage0's pass 2 and its forbidden-syntax
  sweep, written in StaticTS.

  Two shape decisions, each with its reason:

  - The dispatch is one central `switch` rather than the tables `src/` registers
    into. That is D2 of the plan, taken with its cost known — adding a construct
    now touches the switch as well as its family — because a table of function
    values needs function pointers, which StaticTS does not have, and a `switch`
    on a node kind lowers to an LLVM `switch` and a jump table.
  - The contextual type is threaded down instead of walked up, because the tree
    has no parent pointers. The one place that shows is `console.log` and the
    other `void` builtins: "this must be a statement" is answered by the
    statement checker recording the expression it is about to check, which is
    one field where stage0 follows a parent chain.

  The proof is both halves of what a checker does. On what it accepts, the
  `--emit-checked` dump is compared over the whole corpus and now includes the
  per-body locals and callees: 207 of 207 files agree over 2,079 lines — every
  variable's type, every call's resolved callee, every field offset, every
  folded constant. On what it refuses, every `reject_*` case is run through
  stage1 and required to produce the fragments its own `.err` file pins, which
  is the same assertion the suite already makes of stage0: 154 of 154 agree.

  The 11 rules still missing are named in tests/self/reject_backlog.txt rather
  than skipped, so they are counted in the suite's own output, and a backlog
  entry that starts agreeing fails the oracle until it is removed.

- **Finish milestone S3: the checker agrees with stage0**

  Definite assignment (`self/assignment.ts`), `super(...)` placement,
  `process.argv` being read-only and the rule that a narrowing does not survive
  a loop that assigns the variable were the last rules missing. With them the
  backlog file is empty and gone.

  Both halves of the milestone now hold over the whole corpus:

    what it accepts   207/207 files agree, 2,079 dump lines
    what it refuses   165/165 reject_* cases, 168 message fragments

  The accepted side compares the `--emit-checked` dump: every struct's size,
  alignment and per-field byte offsets, every signature and symbol, every folded
  constant, every body's locals and resolved callees. The refused side requires
  of stage1 exactly what the suite already requires of stage0 — that each
  `reject_*` case produce the fragments its own `.err` file pins.

  The skips are counted and named rather than waved past: 24 accept-side and 5
  refuse-side files need the S5 module driver, 6 are rejected by stage0 itself
  without the flags the harness passes, and 39 are cases the S2 parser refuses
  by name rather than by Phase 0's wording — the deliberate difference the plan
  recorded at S2.

  The last of those rules was found by the oracle rather than by reading:
  `(process.argv).push("extra")` slipped through because the parentheses hid the
  receiver.

- **Add the orientation map a new session starts from**

  `.claude/orientation.md` is the ninety-second model of the repository: the
  two compilers, the five invariants, the code map, the commands, and where
  to read next. `.claude/selfhost.md` is the same for `self/` — StaticTS-0
  and what it forces, the module-by-module correspondence with `src/`, every
  oracle and what it compares, and the milestone state.

  Both are linked from CLAUDE.md and AGENTS.md so the entry point is the
  first thing either file says.

- **Count readFileSyncOrNull as an allocation site**

  The escape analysis recognised `readFileSync` and not its `OrNull` twin,
  although both bump their result out of the arena. A function that read a
  file that way and returned the bytes therefore had no `returned` site, so
  its other local allocations still earned an automatic arena scope, and the
  `sts_arena_release` before the `ret` rewound the bump pointer past the
  string the caller was about to read.

  Both names are sites now. The new case pins the shape that made it
  visible: one template literal that really does flow locally, plus the
  returned file contents, and the golden has no mark or release in it.

  Found while porting the analysis to `self/` for milestone S4.

- **Self-hosting S4: the StaticTS emitter**

  `self/` now carries the back end: the IR builder, the runtime ABI table,
  the target layouts, the escape analysis, the whole-program attribute
  fixpoint, the six construct families, the module assembly, and a
  one-module driver. 6,761 lines of StaticTS against the 5,686 of
  `src/codegen/` they replace.

  The proof is stronger than the milestone asked for. `tests/self/
  ir_oracle.js` compares the two compilers' *entire output, byte for byte*,
  over every import-free program in the corpus — 206 of 206 files, 19,452
  lines of IR — rather than a growing whitelist. Every attribute group,
  every block label and every SSA number has to match. The 49 skips are 39
  programs that need the S5 module driver, 6 that stage0 rejects without
  the flags the harness passes, and 4 that ask for `-g` or a dump flag
  stage1 does not have.

  Three shape changes, all forced by StaticTS-0 and none visible in the
  output. The `factCollectors` array of function values becomes one
  collector class, which is what D2 said the central switch would cost;
  the paired `BuiltinCall { emit, callees }` invariant it protected now
  sits side by side in one file with the IR oracle keeping it honest.
  Parent links, which the escape analysis genuinely reads, come from a side
  table indexed by `Node.id` rather than from a field on the tree. And
  stage1 emits no debug info: `-g` stays stage0's, as `--link` does.

  A compound integer division contributed no `sts_panic_div` callee,
  because the checker resolves the target as an assignment target and
  records no type for it. Its caller therefore kept `willreturn` and
  `readnone` over a call that writes and never returns, which LLVM is
  entitled to delete. Fixed, with a case per target shape.

- **Self-hosting S5: the compiler compiles itself**

  `self/compilation.ts` is the whole-program driver: transitive module
  loading through `import`, cross-module binding, the reachable-struct
  closure once every module is bound, symbol-clash rejection, and one
  attribute fixpoint over the program rather than per module.
  `self/compile.ts --out-dir <dir>` writes one `.ll` per module. There is no
  `mkdir` in it and no working directory: a module's identity is its
  specifier resolved against the name its importer was given, which stays
  relative and needs neither, and which is why the module headers agree with
  stage0's string for string.

  `tests/self/bootstrap.js` runs the stages. All three equalities hold over
  the 41 modules and 4,095,128 bytes of IR that make up `self/`:

    IR(stage0, self/) == IR(stage1, self/)   the two implementations agree
    IR(stage1, self/) == IR(stage2, self/)   the fixed point
    stage3            == stage2              byte for byte, as files

  The first is the stronger equality §1 said was worth aiming at and not
  worth blocking on. It holds for every module, so the TypeScript
  implementation and the StaticTS one are the same compiler rather than two
  compilers that agree about the tests.

  S5 needed one addition to StaticTS-0, and the S2 parser oracle had been
  naming it as a skip for three milestones: the parenthesised type.
  `self/program.ts` writes `(Local | null)[]` and has to, because
  `Local | null[]` groups the other way. stage0 always accepted it; the
  parser now builds `N_TYPE_PAREN` and `resolveType` reads through it, with
  a golden case, a rejection, a language rule and a cookbook entry.

  The IR oracle grew with the driver: it compiles whole programs now,
  `tests/link/` included, and compares every module of each — the module set
  too. 259 of 259 programs, 848 modules, 1,074,371 lines of IR.

  D5, measured rather than guessed: compiling the whole compiler costs
  stage1 91 ms and 86 MB of peak RSS, against stage0's 786 ms and 178 MB.

- **Answer D5 where it was asked**

  The peak-memory question §3a D5 raised is answered in the S5 section, so
  the decision now points at its own measurement rather than leaving a
  reader to find it. S4's milestone row says what the proof turned out to be
  — the whole corpus, not the growing whitelist it was planned as.

- **Add Result<T, E> and remove throw**

  A function that can fail says so in its return type and hands the caller a
  `Result<T, E>`; the caller cannot reach the success value without first
  deciding what happens to the failure.

  Lowering: `Result<T, E>` is a built-in type constructor, not a user generic.
  Each distinct pair of payload types gets one monomorphised
  `%struct.sts_result.<T>.<E> = type { i1 ok, T value, E error }`, named by a
  prefix-coded mangling of the payloads and held by pointer, laid out and
  allocated exactly as a class is. The layout is derived from the type rather
  than declared, so the checker and the emitter compute the same one and an
  imported signature that mentions a `Result` brings across only its payload
  layouts. `Ok(v)` / `Err(e)` are WP6 allocation sites, so a `Result` that does
  not outlive its function becomes an entry-block alloca with no allocator call;
  `orReturn()` loads the discriminant, branches, and on the error arm builds this
  function's own `Err` and returns it, which is why it also marks the function as
  returning an allocation and disqualifies it from an automatic arena scope.
  `Result<void, E>` carries no value field at all.

  Three rules are checker errors rather than lints: a `Result` may not be dropped
  (neither as a bare expression statement nor as a local nobody reads), the
  payload is unreachable until the discriminant is tested, and `orReturn()` is
  legal only inside a function returning a compatible `Result`, so propagation is
  contagious through the signatures. The narrowing is the `T | null` engine,
  extracted into `checker/narrowing.ts` with a registry that `nullable.ts` and
  `result.ts` each add one rule to; the refinement rides on the type as `state`,
  which `sameType` ignores because the LLVM value is the same pointer either way.

  The surface is Rust's in the spelling TypeScript already has: `Ok`/`Err`,
  `isOk()`/`isErr()` (and `r.ok`, the discriminant a TypeScript reader expects),
  `value`/`error`, `orReturn()` for `?`, `unwrapOr`, `expect`. `runtime/statictsc.d.ts`
  declares it as the tagged union TypeScript would use anyway, intersected with
  the method surface, so a Result program also type-checks under plain
  `tsc --strict` and narrows there for the same reason it narrows here.

  `throw` is removed in the same change. It never unwound — it evaluated its
  operand, discarded it, and executed `llvm.trap` — so it was an abort wearing
  the syntax of error handling, and it let a program report a failure no caller
  could see. Phase 0 refuses it in both the compiler and stage1, naming both
  replacements: a `Result` for a failure a caller should handle, `panic(message)`
  for an invariant that cannot hold.

- **Implement Result<T, E> in the self-hosted compiler**

  S5 froze stage0 as the bootstrap seed and required new constructs to land in
  `self/` too, and the S4 IR oracle enforces it: it refuses to skip a program
  stage1 cannot compile, so the six `res_*` cases and the `result_import` link
  test failed against the newly landed oracle. This is the other half of the
  implementation.

  The port mirrors stage0 module for module. `self/types.ts` gains `K_RESULT`
  with the two payload arms and the `state` refinement interned alongside them,
  so a narrowed `Result` is a third id rather than a field on an object — the
  same difference the rest of the port already carries. `assignable` and
  `typeName` ignore the state, because the LLVM value is the same pointer
  whatever has been proved about it, and `isResult` answers for the -1 the side
  tables hand out for an unrecorded node.

  `self/result.ts` holds the three rules and the derived layout; `self/annotations.ts`
  resolves the type; `narrow` in `self/expressions.ts` gains the discriminant
  test; `self/emit_result.ts` is the lowering; `self/escape.ts` counts `Ok`/`Err`
  as stackable allocation sites and `orReturn()` as returning memory; and
  `self/attributes.ts` classifies the receivers and arguments and reports the
  memory facts. `noteStructNames` and the emitter's `noteStruct` descend into
  both payload arms, which is what carries an imported `Result`'s layouts across
  a module boundary.

  The oracles now hold both sides to each other: 267/267 programs emit identical
  IR (1,260,417 lines), and all 180 `reject_*` cases produce stage0's exact
  message, so `tests/self/reject_backlog.txt` is deleted rather than extended.

- **Ship the self-hosted compiler**

  S5 proved the fixed point inside the test harness: tests/self/bootstrap.js
  builds four compilers in a temporary directory, compares them and deletes the
  lot. It left no compiler behind, so `self/` was self-hosting without being
  runnable outside the suite. This adds the two pieces that close that gap.

  scripts/bootstrap.sh builds the chain from a checkout. stage0 (dist/index.js)
  builds stage1, stage1 builds stage2 — the default output, and the first binary
  no part of stage0 emitted — and stage2 builds stage3. `--verify` runs the three
  equalities of wp14 §1 with cmp rather than with the suite's reporting, so the
  recipe is self-checking outside a checkout of the tests: 43 modules identical
  for IR(stage0)==IR(stage1) and IR(stage1)==IR(stage2), and stage3 byte-identical
  to stage2, in 52 s. `--stages 1` stops at the seed's own output, two links
  sooner.

  scripts/statictsc.sh is the command line D4 said a wrapper would supply. The
  compiler emits .ll and nothing else, because a directory and a linker would
  mean mkdirSync and spawnSync builtins; the wrapper makes the directory, runs
  scripts/build.sh, and mirrors stage0's file layout exactly — `-o <file.ll>`,
  `-o <dir>/`, and `--link <exe>` writing <exe>.ll for one module and
  <exe>.modules/ for a program with imports — so either compiler can be dropped
  into a build script. The flags that are stage0's rather than missing (-g, the
  dumps, the interop sidecars) are refused by name with what to run instead: a
  flag that is silently ignored is how a build ends up not carrying the thing it
  asked for. D4's bet is settled at 139 lines of bash and no runtime growth.

  The WP14 section of the suite now checks the artifact and not only the fixed
  point: it builds a compiler with the script and uses it, through the wrapper,
  to compile, link and run examples/hello.ts (one module) and
  examples/multi/main.ts (two modules, exit 49), and asserts that -g is refused.
  One stage rather than three, because what is under test is the recipe and the
  wrapper; the bootstrap check above owns the equalities.

  stage0 stays the published package: it is the seed every bootstrap starts from,
  the oracle every self/ phase is compared against, and the only one of the two
  that emits DWARF and the interop sidecars.

  Also: docs/wp14-selfhost.md §7, a README self-hosting section, docs/INSTALL.md
  §2a, `npm run bootstrap`, and the stale README status table and "not in the
  language yet" list — switch, the string methods and process.argv have all
  landed, and generics, closures, try/catch and labelled break are refusals with
  a message rather than gaps.

- **Return a small Result in a register, and let one cross to a host**

  WP16 shipped `Result<T, E>` as a pointer to an arena struct and said the C
  ABI, not the design, was the reason. Half of that holds: clang lowers
  `struct { bool; int32_t; int32_t; }` to `{ i64, i32 }` on x86-64, `[2 x i64]`
  on aarch64 and through `sret` on wasm32, so there is no one aggregate
  signature a target-neutral module can emit. But a by-value *scalar* is
  uniform, and that is enough.

  A `Result` whose two payloads are each a scalar of at most four bytes —
  void, boolean, u8, u16, i32, u32, f32 — is now returned as one `i64`:

      bits  0..31   the discriminant, 1 for Ok and 0 for Err
      bits 32..63   the live arm's payload, zero-extended (f32 by bitcast)

  The dead arm is not represented, which is what makes the twelve-byte
  `Result<i32, i32>` fit. Eight bytes is not a tuning knob: `i64` is the only
  return width whose C-ABI lowering is the same LLVM type on all six supported
  triples (`__int128` is `{ i64, i64 }` on x86-64 and `i128` elsewhere).

  The lowering touches only the return boundary. The callee packs where it
  would have allocated (`return Ok(v)` is a shift and an `or`; `orReturn()`
  propagates without building an object); the caller unpacks the word into an
  entry-block object every existing construct already reads, so the in-memory
  layout, the narrowing and the payload accessors are unchanged. The allocation
  moves from callee to caller, so the call is now an allocation site of the
  caller in escape.ts and the allocator call is reported there in attributes.ts.
  SROA folds the alloca, the stores and the shifts once the call is inlined.

  Measured with both compilers built and the same program compiled by each
  (`--profile speed`, 2e8 iterations, x86-64): 0.50 s -> 0.143 s, same
  checksum, and `use` is 14 instructions with no frame and no call against 47
  with three. Across a call boundary the optimiser cannot inline away, the win
  is 2.09x, where `sret` reaches 1.43x.

  A `Result` also crosses the host boundary now. `--emit-header` declares
  `struct sts_result_<T>_<E>` for the arena object and a
  `sts_result_<T>_<E>_word` typedef for the packed return, with a `sizeof`
  assertion; clang lowers a function returning that typedef to exactly the
  `i64` the module defines, so a C host includes the header and calls across
  with no glue. `--emit-napi` bridges a by-value `Result` as
  `{ ok: true, value }` / `{ ok: false, error }`, and `--emit-dts` declares the
  same union with the generated loader unpacking the exported `i64`.

  And `-g` builds a `DW_TAG_structure_type` from `resultLayout` instead of an
  opaque pointer, describing a packed return slot as the packed shape the
  header declares.

  Both compilers, as WP16 did: nothing was added to StaticTS-0, and the IR
  oracle holds stage1 to stage0 byte for byte over 272 of 272 programs before
  the bootstrap reaches its fixed point.

- **Pass a small Result by value too, and benchmark the packing**

  WP17 packed a `Result` into a register on the way out and left the way in
  alone, on the grounds that a `Result` argument is rare. Making it symmetric
  turned out to be the smaller half of the work and removes the one place the
  C header needed two spellings for one type: a `Result` whose two payloads are
  each a scalar of at most four bytes is now returned *and* passed as one
  `i64`, and `int32_t describe(sts_result_i32_i32_word r)` is `i32 @describe(i64)`
  on all four native triples, exactly as the return side is.

  The callee unpacks the word once, in its prologue, into the object every
  WP16 construct already reads. Which memory that object lives in is the
  ordinary WP6 decision and it has to be, because a `Result` can be stored into
  an object literal or pushed onto an array and so outlive the frame:
  `EscapeResult.stackParams` runs the same `localOutcome` walk a local holding
  an allocation gets, so a parameter that is only read is an entry-block alloca
  and one whose pointer is kept is an arena bump. An argument feeding a
  by-value parameter cannot be captured by the callee at all, which is one more
  way a `Result` stays off the arena.

  N-API and the wasm loader carry the argument direction too, so
  `describe({ ok: true, value: 41 })` works from both, and `-g` describes a
  packed parameter as the packed shape rather than as a pointer that is not in
  the register.

  `bench/result` is the seventh benchmark: 2e8 calls of a function returning a
  `Result<number, number>` and one taking it, against a C twin using the
  two-word struct `--emit-header` declares and a Rust twin using Rust's own
  `Result<i32, i32>`. It is the regression guard for the packing, and it
  immediately named a gap the packing does not close — StaticTS 650 ms, C
  444 ms, Rust 251 ms.

  That gap is diagnosed rather than guessed. C written the way statictsc emits
  the word (`uint64_t`, `<< 32`, `|`) times at 653 ms, i.e. exactly the
  StaticTS column, so it is not a code-generation defect here. What the two
  faster columns have is the ok arm and the error arm as separate SSA values:
  instcombine then folds `odd ? n : n >> 1` into one variable shift, where a
  `select` on the combined word leaves the shift in the loop. Loop unrolling
  and the checked-division blocks were both ruled out by measurement, and
  respelling the pack as clang's two-word coercion (store the halves, load an
  i64) was implemented, measured to produce byte-identical assembly, and
  reverted. The fix that would work is a private two-scalar ABI for internal
  functions — rustc's ScalarPair — which needs `--strict-exports` to be
  load-bearing, and is recorded as such in docs/wp9-optimisation.md.

  Both compilers, as before: nothing was added to StaticTS-0, and the IR oracle
  holds stage1 to stage0 byte for byte over 274 of 274 programs before the
  bootstrap reaches its fixed point.

- **Rename the language to AmritScript and the compiler to amritc**

  The previous name collided with an unrelated project. The language is
  AmritScript, the compiler is `amritc`: the npm package and `bin` entry,
  `runtime/amritc.h`, `runtime/amritc.d.ts`, `scripts/amritc.sh`, the
  `AMRITC_DEBUG` / `AMRITC_SIMULATE_ICE` environment variables, and the
  `AMRITC_<STEM>_H` guard on a generated header.

  The name is now written out in exactly two source files, so the next
  rename is an edit to those rather than a sweep over the tree:

    src/branding.ts   LANGUAGE, CLI, and the names derived from CLI
                      (ENV_DEBUG, ENV_SIMULATE_ICE, RUNTIME_HEADER,
                      HEADER_GUARD_PREFIX)
    self/branding.ts  LANGUAGE only; stage1's driver calls itself
                      `compile`, so that is the only name it prints

  Every string either compiler prints builds its name from those
  constants: the Phase 0 messages, `--help`, the banner, include guard and
  `#include` of a generated header, the DWARF producer string, and the
  internal-error report. The two files must agree on LANGUAGE, and
  tests/self/reject_oracle.js already compares the two compilers' messages
  byte for byte, so a name changed on one side and not the other fails.

  Prose stays exempt. Comments and docs name the language where that reads
  better than a constant would, but the generic mentions in src/ and self/
  now say "the language", which is both accurate and one less thing a
  rename has to touch. Phase 0's entry point is `validateSyntax`, named
  after its job rather than after the language.

  The `sts_` prefix on the runtime's C symbols is deliberately unchanged.
  It is ABI: it is in every golden .ll, in runtime.c and amritc.h, and in
  binaries users have already linked, and it was never derived from the
  product name. docs/ARCHITECTURE.md ("Where the name lives") and the
  .claude/ guidelines now say so.

- **Emit the arrays interop sidecars before the N-API compile loop**

  The loop that syntax-checks the generated N-API shims covers add,
  strings and arrays, but compiled a stem only `if` its .napi.c already
  existed, and the arrays sidecars were not written until 270 lines later.
  So the arrays leg never ran on a clean build/ and, on a dirty one,
  compiled whatever the previous run had left behind — which is how a
  rename of the runtime header surfaced as `'statictsc.h' file not found`
  against source that no longer existed anywhere in the tree.

  Emit the arrays sidecars beside add's and strings', leaving the arrays
  assertions where they are, and make an absent .napi.c a failure rather
  than a silent skip: all three are written above, so a missing one now
  means --emit-napi failed and there is nothing to be quiet about.

- **Rename the runtime's C symbol prefix to amrit_**

  The last trace of the old product name was `sts_`, its initials, on every
  runtime C symbol. The rename that gave the language its name left the
  prefix alone on the grounds that it is ABI rather than branding, which is
  true and is why it is worth moving now rather than later: nothing has been
  released, so no binary anywhere links `sts_`, and the ~200 goldens that
  carry it are generated by `npm run test:update` rather than written.
  Neither will be true after a first release.

  The sweep is mechanical and total. Every `sts_*` symbol becomes `amrit_*`
  on both sides of the ABI at once — `runtime.c`, `runtime_wasm.c`,
  `amritc.h`, both compilers' runtime tables, the interop generators, the
  goldens, the link and layout fixtures. The `STS_*` macros become `AMRIT_*`,
  including `AMRIT_SYMBOL`, which generated headers emit. The Node shim's
  `__sts` namespace and its `StsResult` become `__amrit` and `AmritResult`,
  the benchmark variant ids `sts`/`sts-nsw`/`sts-size` become `amrit*`, and
  the master plan's never-implemented `.d.sts.json` sidecar is renamed with
  them. `grep -riE '\bsts\b|sts_|staticts'` over the tree is now empty.

  This is a C ABI break for any host that links `runtime/runtime.c` or
  includes `runtime/amritc.h`. It is deliberate, it is recorded in
  CHANGELOG.md, and it is the last one: the documentation that said the
  prefix never follows a rename now says the prefix is frozen, and says why
  this rewrite was affordable exactly once instead of leaving it as a
  precedent. src/branding.ts, self/branding.ts, docs/ARCHITECTURE.md
  ("Where the name lives"), .claude/orientation.md and .claude/architecture.md
  all agree on that.

- **Fuzz stage1 against stage0, not only the binary against Node**

  The WP13 fuzzer generated random programs, compiled them with stage0 and
  compared the binary with Node. stage1 never saw them: the only programs it
  was asked about were the checked-in corpora, which both compilers have been
  adapted to. The strongest equality available — a program neither compiler
  has ever seen, compiled by both — was not being tested.

  `tests/differential/fuzz.js --stage1` adds it. Every generated program is
  compiled by stage0 and by the self-hosted compiler and the emitted IR is
  compared byte for byte, module set included, through the `build` and
  `compare` of tests/self/ir_oracle.js rather than a second copy of them; the
  stage1 binary is linked once per run and every program reuses it. stage0 is
  the oracle, so there is no golden in this path, and a stage1 rejection of a
  program stage0 accepts is a disagreement rather than a skip. A disagreement
  saves the program as build/test/differential/fuzz-stage1-fail-<seed>.ts and
  prints the first differing line with the command that reproduces it.

  The default mode is untouched: it still compares the native binary with Node
  and knows nothing about self/. The WP14 block of tests/run.js runs 16
  programs from a fixed seed, which costs about 21 s — most of it the one link
  — and keeps the suite the length it was; 300 programs from seed 20261001
  agreed on all 141,098 lines of IR.

- **Say in the README that the name is a working title**

  The name is a placeholder and is expected to change, which a reader
  choosing whether to depend on `amritc` should learn from the README rather
  than from the next rename. The note says so, tells them to pin a commit
  instead of a name, and points at why the change is cheap on our side: the
  two branding files, and the `amrit_` prefix as the one deliberate exception
  that does not follow a rename.

  "Where the name lives" in docs/ARCHITECTURE.md now opens by saying the same
  thing, so the section that sets the rule also says why the rule is load
  bearing rather than speculative.

- **Emit DWARF from the self-hosted compiler**

  stage1 had no `-g`: no `DISubprogram`, no `DILocation`, no
  `llvm.dbg.declare`, and `self/emit.ts` said so in its header. `self/debug.ts`
  is the port of `src/codegen/debug.ts` and closes that gap.

  The lowering, which is stage0's and is now written twice:

    - the module gets a `DICompileUnit` reserved as `!0` so the `DIFile` it
      names can be `!1`, plus the `Dwarf Version` / `Debug Info Version` module
      flags LLVM needs before it will keep any of this;
    - every function gets a `distinct !DISubprogram` on its `define`, the
      function's own line as the default location, and one `llvm.dbg.value` per
      parameter; the C-ABI entry wrapper gets an artificial one at the user's
      `main`;
    - `emitStatement` and `emitExpression` set the location around the handler
      and restore the enclosing one after, so a loop's back edge points at the
      loop rather than at the last thing inside it, and `IRFunction.emit`
      appends `, !dbg !N` while one is active;
    - a `let`/`const` slot and a `for (const x of a)` element get an
      `llvm.dbg.declare` beside the alloca;
    - types map as the C ABI header names them, down to the packed
      `{ i32 ok; union { T; E; }; }` a by-value `Result` carries in a register
      (WP17) rather than the in-memory composite a local sees.

  `self/ir.ts` grew the metadata list this writes into: numbered nodes interned
  by text so identical locations share one, reserved numbers for a composite
  that must be referenced before its members exist, and the named lines printed
  ahead of them. `-g` is a flag of `self/compile.ts` and of `scripts/amritc.sh`,
  which passes it on to `scripts/build.sh` so `runtime.c` is compiled with it
  and the profile's strip step is skipped.

  Three things had to change to make the two compilers agree byte for byte.

  A `DIFile`'s directory was `process.cwd()`. stage1 has no working directory
  to ask for and D4 will not grow the runtime for one string, so both compilers
  now write `.`, which is what clang's `-fdebug-compilation-dir=.` writes and
  what makes a debug build reproducible across machines. For a relatively
  spelled entry the two now agree on the whole `DIFile`, exactly as they
  already agreed on the module header (wp14 §4).

  A class reached only through an imported class's signatures was described
  with the *importer's* `DIFile` and with its declaration offset looked up in
  the *importer's* line table, so a debugger was sent to a line in the wrong
  source. A struct is now described against the file that declares it, which is
  why a program with imports carries more than one `DIFile`.

  `IRBlock.terminated` spelled `src/`'s `^(ret|br|switch|unreachable)\b` as
  "the word, then a space or the end". With `-g` an `unreachable` is written
  `unreachable, !dbg !9`, so the test missed it and the emitter added a second
  terminator. It is a word-boundary test now.

  `tests/self/ir_oracle.js` moves `-g` from the unsupported set into
  `SHARED_FLAGS`: `dbg_locals` and `dbg_result` are compared byte for byte,
  metadata numbering included, and the skip count drops from 22 to 20 with
  278/278 programs still agreeing. The runner check that proved `-g` was
  refused by name is replaced by one that links `examples/hello.ts` through the
  wrapper with `-g` and finds `.debug_info` in the binary; `--emit-header`
  keeps the refusal for the flags that are still stage0's. A new check pins the
  imported-class fix against `tests/link/reachable_struct`, and another keeps
  `self/branding.ts`'s `VERSION` in step with package.json, since the producer
  string is compared like every other byte.

- **Compare whole programs in the stage1 oracles**

  Two oracles still skipped every file that imports with the reason "needs
  the S5 driver", which stopped being true when the driver landed, and all
  three treated a program refused for want of `--number-mode f64` as a gap
  in the port rather than as a program nobody was compiling correctly.

  `self/dump_checked.ts` now drives `self/compilation.ts` instead of one
  `Checker`: it loads the entry with everything it imports, checks the
  program as a whole, and dumps every module in load order exactly as
  `dumpChecked(compilation)` walks `compilation.modules` — so each `import`
  line names what pass 1b bound it to, and a module lists only the
  constants, structs and functions whose origin it is. The 42 modules of
  `self/` are now compared by their dump as well as by their IR.

  `tests/self/reject_oracle.js` reads the `tests/link/` negatives too,
  because a rejection that needs more than one module cannot be provoked by
  a single file, and it counts the parser refusals apart from the skips
  rather than in the same total. Two rules stage0 has and stage1 did not
  are ported to make those cases agree: a local name imported twice names
  the module it first came from, and a non-entry module that declares
  `export function main` is refused as such.

  `tests/self/corpus.js` is the one place that knows the corpus and the
  flags each program is compiled with, read from its `.args` sidecar or its
  `// smoke: args` line; `bench/*.args` are new and `bench/run.mjs` reads
  them instead of keeping its own copy of the mode.

  Two bugs fell out of comparing what had not been compared. stage0 ended
  with `process.exit`, dropping whatever was still buffered in stdout, so a
  dump larger than a pipe's 64 KB came out truncated mid-line; the status
  is set on `process.exitCode` instead. And stage1 typed a bare numeric
  literal from the type the whole expression was being checked into, where
  stage0 consults only the other operand, which mixed widths at every `+`
  of `toF64((ij * (ij + 1)) / 2 + i + 1)` in f64 mode.

    checked_oracle  225 agree, 48 skipped -> 272 agree, 1 skipped
    reject_oracle   181 agree, 44 skipped -> 194 agree, 42 parser, 1 skipped
    ir_oracle       275 agree, 22 skipped -> 280 agree, 6 skipped, 11 negatives

  What is left is named rather than counted as a hole: a parser fixture no
  checker accepts, a `--link` failure stage1 has no way to write, and the
  `-g` and dump flags.

- **Answer --emit-checked, --json, --help and --version in stage1**

  The four flags of stage0's command line that are not about linking are
  stage1's now, spelled and behaving as stage0 spells them. `--json` writes
  one flat diagnostic object per line to stdout, uncapped and in the sink's
  order, from the `Diagnostic.json()` the diagnostics oracle already compares;
  `--emit-checked` writes the checked tables of a whole program; `--help` goes
  to stderr with exit 2; `--version` prints `amritc <version>` from
  `self/branding.ts`, because stage1 cannot read `package.json`.

  The dump text moves to `self/dump.ts`. `self/compile.ts` cannot import
  `self/dump_checked.ts` — only the entry module may declare `export function
  main`, which stage1 itself now enforces — and one module for the format is
  the better shape anyway: the driver and the entry the checked oracle spawns
  print the same text because they call the same function.

  `scripts/amritc.sh` passes the four through; `--emit-checked` and
  `--version` print text rather than writing IR, so they skip the output
  planning and the link. It also stops discarding the compiler's stdout on a
  failed compile, which is where `--json` puts its diagnostics.

  `--emit-ast` stays stage0's, by design rather than by backlog: its dump
  prints the `typescript` package's node names and line:column spans, while
  stage1's tree is the flattened one `self/nodes.ts` defines and the parser
  oracle translates TypeScript into that vocabulary rather than the reverse.
  Matching it would put a mirror of `ts.SyntaxKind` inside the self-hosted
  compiler to imitate an implementation detail of the seed. The IR oracle
  therefore counts a dump-flag program as a dump rather than as a gap in the
  port: `--emit-checked` is compared by the checked oracle over the whole
  corpus, and `--emit-ast` is not stage1's to answer.

- **Give stage1 the interop sidecars**

  `--emit-header`, `--emit-dts` and `--emit-napi` now work in the self-hosted
  compiler, spelled exactly as stage0 spells them and writing the same files to
  the same paths. The five modules of `src/interop/` are ported one for one to
  `self/interop_abi.ts`, `interop_header.ts`, `interop_dts.ts`, `interop_wasm.ts`
  and `interop_napi.ts`, so the two implementations stay diffable.

  Three shapes change and no generated byte does:

    - A type is an `i32` into the `TypeTable`, so the `kindOf(t)` string switch
      is a switch over the `T_*` / `K_*` ids.
    - The empty string stands in for `undefined` (`cType`, `wasmType`,
      `cPrototype`); `typedView` and the readers answer `null`, since those are
      objects.
    - The N-API shim's readers and boxers are records of closures in `src/`,
      which the language cannot hold. Here each is a record with a kind tag and
      `napiReaderLines` / `napiBoxerCall` switch on it to write the same lines —
      the same trade D2 made for the dispatch tables.

  `externalFunctions` also runs the whole-program attribute fixpoint once per
  compile and threads the list into the generators, where `src/` re-runs it in
  each of them: stage1's arena is never released and that pass allocates most.

  D4 is untouched. A sidecar is derived from the checked program after the IR
  and written with the `writeFileSync` stage1 already had, to the path it was
  given; nothing here makes a directory or spawns a linker. `scripts/amritc.sh`
  therefore stops refusing the three flags by name, passes them through, and
  makes the sidecar's directory the way it makes the IR's; `-g` and the dumps
  are still refused.

  `tests/self/interop_oracle.js` is the oracle: both compilers over the WP8
  interop corpus, all four generated files per program (`.h`, `.d.ts`, its
  `.mjs` loader, `.napi.c`) compared byte for byte, skips counted and named and
  stage1 rejections counted apart from them. `--all` runs the same comparison
  over every whole program the IR oracle reads: 281 programs, 1,124 sidecars,
  15 MB of generated C, TypeScript and JavaScript, no difference.
  `tests/self/interop_payloads.ts` is a fixture for the narrow `Result`
  payloads — `f32`, `u8`, `u16`, `u32` — that nothing else in the corpus
  mentions, each of which has a reader and a writer of its own.

  The bootstrap fixed point still holds over the ~2,400 new lines of `self/`:
  IR(stage0) == IR(stage1) == IR(stage2), stage3 byte-identical to stage2.
  Compiling the whole compiler costs 114 MB of peak RSS and 127 ms, against
  96 MB and 107 ms before.

- **Refresh the oracle counts the ports moved**

  The milestone table and the bootstrap paragraph quoted the numbers that
  held when each milestone closed, and four landings since — DWARF, the
  interop sidecars, the whole-program oracles and the CLI flags — have moved
  every one of them. Measured on the merged tree: the lexer over 565 files,
  the parser over 528, the checked dump over 279 whole programs, the IR over
  289, and the fixed point over 51 modules and 5,963,202 bytes of IR rather
  than the 41 and 4,095,128 S5 first reached.

  The `-g`-forced sweep keeps its 278, marked as the corpus of the day: it
  records one experiment that was run once, not a property the suite holds
  to.

- **Record the measured full-corpus sidecar comparison**

  `--all` was quoted at the 281 programs it covered before the merge with
  main; on the merged tree it is 287 programs and 1,148 sidecars, 16.9 MB of
  generated text with no difference between the two compilers.

- **Answer the way stage0 answers in stage1's command line**

  Seven divergences, none of them a decision D4 or §7 records. An unknown
  `--number-mode` meant i32 silently, which compiles the program in the
  other arithmetic; it is refused now, as stage0 refuses it. Every
  positional is a root, where the last one used to win and the rest were
  compiled into nothing. `wrote <file>` moves to stderr, where stage0 puts
  it, so stdout carries the IR and the `--json` diagnostics and nothing
  else — which also lets `scripts/amritc.sh` stop capturing stdout and
  replaying it, and lets it correct only the two `wrote` lines that name
  the directory it compiled into rather than where the file ended up. A
  root that cannot be opened is reported by the driver, in stage0's two
  shapes (`error: cannot open <path>` on stderr, one flat object under
  `--json`), instead of by the loader, which could answer neither; the
  errno stays stage0's, because Node names it and `readFileSyncOrNull`
  answers null without saying why.

  In the wrapper: `--link` on a program with no `export function main` is
  refused with stage0's message and its exit 1 rather than reaching clang
  for `undefined reference to main` and exit 3; an unknown `--profile` is
  refused before the compile rather than after it; and `-o <dir>/` writes
  into the directory it was given instead of clearing it first, which for
  `-o build/` took the rest of `build/` with it. The scratch directory the
  single-file case needs is `mktemp -d` now, so nothing the caller named
  is ever removed.

  The WP14 section also prints a SKIP when clang is missing. It used to
  disappear in silence, so a run reported the 55 compile-gate passes above
  it and looked like a proof of the fixed point.

- **Say what is true today about the ports that landed**

  Four landings — DWARF in stage1, the interop sidecars, the whole-program
  oracles and the CLI flags — moved numbers and claims that four documents
  still quoted from before them.

  INSTALL.md said the native compiler does not emit `-g`. It does, and the
  wrapper hands `-g` to the link as well, so the DWARF reaches the binary;
  what is still only stage0's is the link step, the directory creation and
  the AST dump.

  wp12-release.md's `scripts/` row omitted `bootstrap.sh` and `amritc.sh`,
  which the tarball ships, and the file count was 92 against a measured
  135. Multi-error reporting and `--json` were listed as not in the work
  package and have since landed in WP10; the line says so rather than
  disappearing.

  The oracle counts are measured rather than remembered: 289 of 289
  programs, 1,305 modules and 2,048,420 lines of IR, against the 280 and
  989 the doc carried. The "skips S5 left behind" table keeps its figures
  and is relabelled as the record of that closure, which is what it is;
  the sentence beside it no longer counts `-g` among the skips, because
  stage1 emits DWARF now and the oracle compares those two programs like
  any other.

- **Link the self-hosted compiler's output from the compiler**

  `amritc self/compile.ts --link amritc` produces a compiler byte-identical
  to the one that ran it, with no shell script between them.
  scripts/amritc.sh is deleted.

  WP14 §3a D4 dropped `--link`, `--profile` and directory creation from the
  self-hosted compiler because they would mean `spawnSync` and `mkdirSync`
  builtins and runtime growth. It was right about the order of the work —
  the fixed point compares IR and never needed a linker, and 195 lines of
  bash carried the deployment path through four landings. It was wrong
  about the end state: a compiler that cannot produce an executable on its
  own is self-hosted in the IR and not in the artifact.

  Two builtins, each landed in src/ first with its golden, its native round
  trip, two negatives, its LANGUAGE.md rule and its cookbook entry.
  `mkdirSync(path)` makes one directory, not recursively, and answers
  whether a directory is there afterwards; the retry is a stat rather than
  `errno == EEXIST`, so a plain file at the path answers false, which is
  what the promise means. `spawnSync(argv)` runs argv[0] through PATH,
  waits, and answers the exit status, 128 + signal, or -1 for an empty
  vector or a program that would not start. Both answer a value where they
  could have exited, for the reason readFileSyncOrNull answers null: there
  are no exceptions, so the caller owns the diagnostic.

  `spawnSync` is the first builtin whose pointer argument the runtime
  keeps — amrit_spawn copies each element's bytes pointer into an arena
  vector that outlives the call — so classifyUse reports an escape and the
  declaration carries no `nocapture`; and the first that is not
  `willreturn`, because the child may never exit and waitpid waits.

  With them self/compile.ts plans its own output on stage0's rules, makes
  every directory in the way of the IR, a sidecar or the binary, writes
  <module>.ll beside each source when nothing is named, refuses `--link`
  on a program with no `export function main` before the emit rather than
  leaving it to the linker, and refuses `--emit-ast` by name. It finds
  scripts/build.sh and runtime.c from the path it was invoked by, falling
  back to the working directory, and names both when neither has them.
  Nothing about the host platform came in with any of it: `--link` spawns
  `bash scripts/build.sh`, which is what src/index.ts spawns and where the
  uname and the profile flag sets have always lived.

  The bill is 257 bytes of .text, 2,287 to 2,544 at -Oz, and a program
  that calls neither pays none of it: examples/hello.ts at the size
  profile is 4,696 bytes with these two functions in the runtime and 4,696
  without, because -ffunction-sections --gc-sections drops both. The
  runtime budget in MASTER_PLAN §2 is restated to measure .text rather
  than the text column of size, which counts the .eh_frame the size
  profile strips, and rather than source bytes, over budget since WP4
  because comments are not code.

- **Point the docs at the compiler instead of the wrapper**

  Five files still told a reader to run `scripts/amritc.sh`, which no
  longer exists, and listed the link step and the directory creation among
  the things only stage0 does. Both are the self-hosted compiler's now.
  What is left of that list is the `--emit-ast` dump and `--target host`,
  and the docs say so where they said the other.

  INSTALL also gains the one fact a user needs that the wrapper used to
  hide: the compiler looks for scripts/build.sh and runtime/runtime.c one
  level up from its own path and then in the working directory, so it
  wants a checkout or an installed package around it, the way the Node one
  does.

- **Give the differential harness the two new builtins**

  `io_mkdir` and `io_spawn` ran natively and failed under Node, because
  runtime/shim.mjs had no `mkdirSync` or `spawnSync` and
  tests/differential/rewrite.js did not know their names. That is the shape
  of every builtin that has ever been added and forgotten there, and it is
  what the WP13 comparison is for: 125 of 136 programs agree with Node now,
  0 unexpected failures.

  The shim's `mkdirSync` decides with `statSync` rather than with the
  exception Node throws, so it answers `false` where the runtime answers
  `false` — a plain file at the path included.

  The runtime figures the docs quote are re-measured against the tree as it
  landed: 12,707 bytes of source, not the 13,091 an intermediate draft had.
  ARCHITECTURE.md's runtime paragraph carried the pre-WP7 numbers and the
  old two-part budget; it carries `.text` now, like MASTER_PLAN §2.

  Also records the one change the new builtins forced in the checker:
  `checkArgumentType` compared type kinds, which was enough while every
  builtin wanted a scalar or a string, and an `i32[]` is not a command
  line.

- **Build every bootstrap stage with one --link**

  scripts/bootstrap.sh compiled stages 2 and 3 with --out-dir and then
  called scripts/build.sh itself, which made it a second driver with its
  own opinion about where the IR goes — the thing D4's reversal was meant
  to stop needing. Each stage is one --link by the stage before it now,
  and the equalities read the <exe>.modules/ directory --link already
  writes, so the chain that proves the fixed point is the same command a
  user runs. link_stage is gone with the two scratch directories it needed.

  Verified: --verify over the whole chain, 51 modules identical for
  IR(stage0) == IR(stage1) and again for IR(stage1) == IR(stage2), stage3
  byte-identical to stage2.

  The bootstrap's own figures are re-measured with it: 6,049,827 bytes of
  IR, against the 5,963,202 the doc carried. 51 modules rather than the 54
  files in self/ because the three dump entry points are the oracles'
  roots, not compile.ts's imports — which the doc now says, since the two
  numbers look like a discrepancy otherwise.

- **List in full what is still stage0's**

  §7a said which flags stayed behind but not the whole of it, which is how
  a gap gets rediscovered a milestone later. Four things, each with the
  reason and the measured price: `--emit-ast` and `--target host`, both
  refused by name with a message; exit 70 for an internal error, where the
  self-hosted compiler reaches `panic(msg)` and the language defines that
  as exit 1; and `-o <dir>` for an existing directory without the trailing
  slash, which stage0 answers with a `stat`.

  The price of the second is measured rather than guessed: `process.platform`
  and `process.arch` as builtins, composed into a triple the way
  src/codegen/target.ts composes one, cost 8 bytes of `.text` — not the
  ~40 first written here.

  None of the four is a program one compiler can build and the other
  cannot, which is the line §1 drew.

- **Count the tarball again now the wrapper is out of it**

  The suite measures it and says 134; the doc said 135, which was right
  before scripts/amritc.sh was deleted.

- **Design WP18: user generics by monomorphisation**

  A design note only: no compiler code, no test, and no other document
  changes. The decision it is written inside — AmritScript gets user
  generics, lowered by monomorphisation, in both compilers, with
  AmritScript-0 left alone — is taken; this note is the how.

  The load-bearing parts:

  - Inference at a call site, not type arguments. `self/parser.ts` has one
    token of lookahead and no backtracking, so `f<i32>(x)` is a comparison
    to it; the two positions where a type argument is unambiguous — an
    annotation and after `new` — are the two its parser already reads.
  - One definition per instantiation, in the module that declares the
    template, with the template's own linkage. `linkonce_odr` is rejected:
    this is a whole-program compiler, and folding would defeat the
    `internal` linkage `--strict-exports` exists for.
  - Termination is a static rule, not a depth limit. A cycle in the
    template graph is legal only when every type argument on it is a bare
    parameter; an expanding edge is refused with the chain named. A hard
    instantiation cap stays as a backstop.
  - An instantiated generic class is an ordinary struct type, `Box$i32`,
    so layout, `implements`, `extends`, DWARF and the C header need no new
    case. `# Changelog

All notable changes to `nish` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

**This file is generated.** A section is written when a release is cut, from
the commits that release contains: `scripts/changelog-gen.mjs` reads each
commit's subject for the heading and its body for the prose, and writes
`changelog/<version>.json`. That JSON is the record — it is what the website
reads — and the section below is rendered from it. To fix a wording, edit the
JSON in the release pull request and re-render; editing here is overwritten.

The release pull request is where a release is reviewed: every merge to `main`
refreshes it with the version bump, the JSON and this section, and merging it
creates the tag. [docs/wp12-release.md](docs/wp12-release.md) has the
procedure, and `CLAUDE.md` has the commit convention the headings come from.
Between releases `[Unreleased]` is empty, because there is nothing to write by
hand — the git log is the working account until a release turns it into one.

 becomes reserved in a declared name so the mangling is
    injective, and the C spelling reuses the `_` collapse plus
    AMRIT_SYMBOL that method symbols already use — `-pedantic` refuses `# Changelog

All notable changes to `nish` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

**This file is generated.** A section is written when a release is cut, from
the commits that release contains: `scripts/changelog-gen.mjs` reads each
commit's subject for the heading and its body for the prose, and writes
`changelog/<version>.json`. That JSON is the record — it is what the website
reads — and the section below is rendered from it. To fix a wording, edit the
JSON in the release pull request and re-render; editing here is overwritten.

The release pull request is where a release is reviewed: every merge to `main`
refreshes it with the version bump, the JSON and this section, and merging it
creates the tag. [docs/wp12-release.md](docs/wp12-release.md) has the
procedure, and `CLAUDE.md` has the commit convention the headings come from.
Between releases `[Unreleased]` is empty, because there is nothing to write by
hand — the git log is the working account until a release turns it into one.


    in a C identifier.
  - One AST, N type assignments: every node-keyed side table moves behind
    an accessor and each instantiation carries an overlay. That is the
    first milestone and its diff is large while its test output is empty.

  The worked IR for identity<T> and Box<T> is checked against the goldens
  it is copied from rather than invented, and per-instantiation purity is
  shown with two attribute groups that already exist in the tree.

  Result<T, E> and Array<T> stay built-in, against wp15 §5's aspiration,
  with the reason. Discriminated unions are deferred with the coupling
  that paired them to generics dissolved. Nine open questions are recorded
  as questions.

- **Bring the plan and the design notes back level with the tree**

  MASTER_PLAN.md called itself the single source of truth while describing a
  compiler from several milestones ago. §4 named `src/checker.ts` and a
  single-file checker and stopped at the WP-P era; it is now an inventory of
  what is actually here, both compilers included, with the measured numbers
  cited to the notes that hold them. §5 stopped at WP11: WP12, WP13, WP14, WP16
  and WP17 are recorded in the plan's own form and marked landed, WP15 as the
  roadmap the project is on. §6's waves and §9's milestones carry their state —
  M1/M2/M3/M5 done, M4 the open one — and §9 now carries WP15's sequencing, so
  the remaining road is in the plan and not only in the design note. The branch
  every agent was told to work on, `claude/llvm-ir-typescript-compiler-hf5pxr`,
  is `main` in all three places it appeared.

  src/checker/result.ts opened with a TODO(WP17) saying small `Result`s are not
  returned by value and that a `Result` may not cross the interop boundary. Both
  have been false since WP17: the comment now describes the packed `i64`, what
  `resultByValue` decides, what keeps the pointer, and the header, N-API and
  wasm bridges, and points at docs/wp17-result-abi.md for the measurements.

  wp17-result-abi.md ended with "the DWARF is still stage0's". `self/debug.ts`
  has landed; the sentence keeps its point about what WP17 shipped and says what
  closed it since.

  wp14-selfhost.md described `scripts/amritc.sh` in the present tense in the
  `-g` section, which is a statement about today and is now wrong — `-g` is a
  flag of `self/compile.ts`, which hands it to `scripts/build.sh` itself. §7 is
  history and keeps its wording under its "superseded by §7a" banner; only its
  copy-pasteable command line is marked.

  wp9-optimisation.md's summary table said spectral and nbody met the 1.10x
  target. BENCHMARKS.md, regenerated, says spectral 1.18x, nbody 1.14x, strbuild
  1.64x and result 2.59x — four misses. The table stays as the snapshot it is,
  and a new section records the four current misses with a pointer to where each
  is diagnosed: wp17 §4 for `result`, this file's own remaining item for
  `strbuild`, and nowhere yet for spectral and nbody, which is said plainly
  rather than guessed at.

  wp12-release.md gains the decision nobody had written down: the compiled
  native binary is what should reach a user, and stage0 exists to build it and
  to be the seed and the oracle. Today `files` ships `scripts/bootstrap.sh`
  without `self/`, so the bootstrap in the tarball exits 3 on its own guard. The
  three ways to close that are recorded with what each costs. Nothing about
  packaging changes here; `package.json` is untouched.

- **Say that the built-in Result stays built-in**

  The WP15 entry inherited wp15 §5's expectation that generics turn
  `Result<T, E>` into ordinary library code. The generics design decided the
  opposite for the two built-in type constructors: monomorphising a user generic
  is the same mechanism, but `Result` and `Array` keep their built-in
  resolution because their layouts are derived rather than declared and their
  lowering is already special at the call boundary.

- **Correct the WP18 termination rule to accept ground recursive edges**

  The rule as written refused a terminating shape. It called an edge
  non-expanding only when every type argument was a bare type parameter,
  so a recursive call that binds the parameter to a concrete type —
  `countDown(1, n - 1)` inside `countDown<T>`, where inference gives
  `T := i32` — was labelled expanding and rejected, even though its
  instantiation set is two entries and the worklist drains after one
  step. The same false rejection hit mutual recursion where a generic
  helper bottoms out at a concrete type.

  An edge is now expanding iff some type argument mentions a parameter of
  the source template without being exactly that parameter, which splits
  the arguments into three cases rather than two: a bare parameter passes
  the caller's tuple on, a ground argument names one fixed instantiation
  that re-entering the cycle asks for again, and only a constructor
  applied to a parameter builds something larger.

  The soundness argument moves with it. The bound was over the seed's own
  arguments, which is wrong now that a cycle may introduce a type the seed
  never mentioned; it is over the subterms of the type expressions the
  program mentions, a finite set fixed before monomorphisation starts
  because unification selects subterms and never builds. Nothing on a
  legal cycle constructs a type, so the reachable tuples are bounded by
  that set to the arity.

  Also in this commit:

  - Say explicitly that a self-edge is a cycle. `grow` is a path of length
    one, so a detector that only looks for paths of two or more misses
    every case the rule exists for.
  - Write `grow`'s recursive call without an explicit type argument, which
    §2a forbids anyway. Inference produces the expansion from `[x]`, which
    is the better example: the rule is about the graph the checker builds,
    not the syntax the user typed.
  - Diagnostic 5 no longer over-promises. It says the argument is under a
    constructor rather than that it is larger, and offers both accepted
    fixes — pass the parameter itself, or a type that does not mention it.
  - Pin the boundary with tests instead of prose: `gen_recursive_ground`
    joins `gen_recursive_same_type` as a positive golden, opposite
    `reject_generic_polymorphic_recursion` and
    `reject_generic_expanding_field`.

- **Point the plan at the generics design note**

- **Bridge the unsigned widths and f32 through the N-API shim**

  `--emit-napi` kept its own reader and boxer tables and they had rows for
  i32, f64, bool and i64 only, so `reader()` and `boxer()` answered undefined
  for u8, u16, u32, u64 and f32, `plan()` refused the whole signature, and the
  addon simply did not export the function. A packed `Result` over those
  payloads went the same way, since its arms go through the same tables. The C
  header and the wasm `.d.ts` had carried the widths since WP15, so a host read
  a prototype for a function the addon did not have.

  Each width now has both halves.

  Reading. `SCALAR_READERS` gains `raw`, `open` and `close`: the C type the
  getter writes, and how it becomes the parameter's own type. It differs from
  `c` exactly where N-API has no getter of that width. `napi_get_value_uint32`
  is the only unsigned getter for a JS number, so u8 and u16 are read into a
  `uint32_t` temporary and then cast; u32 needs no temporary. The rule for an
  out-of-range number is the one JavaScript itself applies storing into a typed
  array — ToUint32, then the width's modulus — so 300 reaches a u8 as 44 and -1
  reaches a u32 as 4294967295, and nothing throws. That matches the i32 reader,
  which has always applied ToInt32, and a bridge that refused 300 for a u8
  while wrapping 2^31 for an i32 would be the surprising one. f32 is read as a
  double and converted by a generated `amrit_napi_f32` rather than a bare cast,
  because C leaves a double-to-float conversion undefined out of range: the
  helper sends anything at or past 0x1.ffffffp127 — the midpoint between
  FLT_MAX and 2^128, where round-to-nearest-even stops being finite — to an
  infinity of that sign, and converts everything else, NaN and the infinities
  included, directly. u64 crosses as a bigint like i64, through
  `napi_get_value_bigint_uint64` and the same shared `lossless` local.

  Boxing. `scalarBox` gains `napi_create_uint32` for u8/u16/u32, which is what
  keeps a u32 above 2^31 positive instead of handing JS the negative twin of
  the same bits, `napi_create_bigint_uint64` for u64, and `napi_create_double`
  for f32, which widens exactly. A packed `Result` narrows each arm through its
  own temporary and assigns into the union member the discriminant selects.

  Saying so. A function the shim genuinely cannot carry was omitted under one
  fixed sentence that named neither its types nor the position that stopped it,
  which is how the gap survived. It is now `not bridged: parameter 1 (p) is
  Point` / `not bridged: it returns Result<number, IoError>`, under a heading
  listing what does cross.

  `self/interop_napi.ts` carries the same change — a `ScalarReader` there grows
  the same four fields and `napiReaderLines` writes the same lines from them —
  and `tests/self/interop_oracle.js` compares the two shims byte for byte over
  a corpus that now includes `tests/self/interop_widths.ts`. That fixture is
  also built into a real `.node` addon by the interop section of `tests/run.js`
  and called at every boundary: 0, 255, 65535, 4294967295, 300 and -1 through
  the readers, a u32 above 2^31 and a bigint u64 back out, an f32 round trip
  that must equal `Math.fround(0.1)` and not 0.1, a double past the float range
  that must be an infinity, and both arms of a `Result<f32, u8>`.

  Bare unsigned widths still do not cross the wasm loader — `--emit-dts`
  declares them but `crossesWasm` does not list them, so the companion `.mjs`
  writes no entry. That is loader work (a mask in, `>>> 0` and
  `BigInt.asUintN` out) and is now written down in docs/wp8-interop.md under
  "Not in this package" instead of being left to be discovered.

- **Plan the retirement of stage0 instead of only its freeze**

  WP14 §6 decided stage0 is frozen rather than retired: kept buildable as the
  bootstrap seed and the differential oracle, not kept up to date. That bounded
  the cost of two implementations but left no account of the end state, so the
  question "when can the Node compiler go" had no answer written down anywhere.

  docs/wp18-stage0-retirement.md is that account. It takes the arrangement rustc
  and Go both reached — the seed is the previous release of the compiler itself,
  not a second implementation — and prices it against what stage0 still owns:

    - the four flags and exit codes §7a left with it;
    - twelve oracles, six of which die with stage0 and six of which never read
      src/ and survive, plus the successor for the six (the seed release
      compared against HEAD over the corpus, byte for byte);
    - the npm package, the --version source, and wp12's "prebuilt binaries are
      a non-goal", all three of which are statements about stage0;
    - IR(stage0, self/) == IR(stage1, self/), the diverse-double-compiling
      property none of the projects in the comparison table asserts.

  Six gates, each with a check that CI can fail: parity, oracle succession
  before deletion, a seed protocol CI exercises, a published seed policy, a
  distribution path that does not need Node, and a tag recording the provenance
  before it is unrecoverable. Four builtins close the parity gate —
  process.platform/arch, isDirectorySync, getenv, panicInternal — and every one
  lands in stage0 first, because the seed has to compile the compiler that
  replaces it.

  Retirement does not dissolve AmritScript-0 and does not remove Node from the
  harness; it moves the freeze's reference point from stage0 to the last
  release, turning a permanent lag into a one-release one. That, and not the
  deleted code, is what the package buys.

  Nothing here is scheduled. The document ends with the honest trigger: a
  release cycle in which stage0 found nothing, changed nothing, and shipped
  nothing except itself.

- **Close three of the four gaps between stage0 and stage1**

  docs/wp14-selfhost.md §7a listed four things the self-hosted compiler still
  left to stage0. Three of them close here. `--emit-ast` stays refused by name,
  which is a decision rather than a to-do.

  Three constructs enter the language and src/ first, each with a golden .ll, an
  llvm-as pass, a native round trip, negatives, a LANGUAGE.md rule and a cookbook
  entry, and only then self/:

    process.platform      %v = call i8* @amrit_platform()
    process.arch          %v = call i8* @amrit_arch()
                          declare noundef nonnull align 8 i8* @amrit_platform() #n
                          attributes #n = { nounwind willreturn readnone }

    isDirectorySync(p)    %v = call zeroext i1 @amrit_is_dir(i8* %p)
                          declare zeroext i1 @amrit_is_dir(i8* noundef nonnull
                              readonly align 8 nocapture) #m
                          attributes #m = { nounwind willreturn }

  The two machine properties answer the address of a string in the runtime's own
  constant data, settled when runtime.c was compiled — a cross build compiles the
  runtime for the target, so the answer is the target's. Nothing is allocated and
  nothing is loaded, which is what makes readnone a fact rather than a hope and
  lets two reads in one function fold into one; the declarations deliberately
  carry no noalias, because every call answers the same pointer and noalias
  promises the opposite. amrit_is_dir is one stat and carries effect "write" for
  the reason amrit_parse_number is not readonly: a failed stat stores errno, and
  the file system is not memory LLVM may reason about, so a caller must not be
  hoisted across anything that could change it. amrit_mkdir is rewritten to call
  it, so the stat exists once.

  With them self/target.ts composes the host triple exactly as
  src/codegen/target.ts does, so --target host is stage1's and both compilers
  emit the same module for it; and self/compile.ts takes `-o <dir>` for a
  directory that is already there, without the trailing slash, which is the rule
  stage0's statSync has always applied.

  An internal compiler error in stage1 exits 70 (EX_SOFTWARE) with stage0's
  report, where a broken invariant used to reach panic(msg) and exit 1. This
  needed no language change, which is why it was chosen over the second panic §7a
  also costed: process.exit(n) already means "this code, now", so the status one
  program wants for its own bugs is not the language's business, and the report's
  wording is the compiler's policy rather than a builtin's. self/ice.ts holds the
  report and answers the status, so each of the 28 converted sites is the single
  statement `process.exit(internalError("..."))` — a report call followed by an
  exit could be half-written, and this cannot, because process.exit is what the
  definite-return analysis reads as a terminator. stage1 names AMRITC_DEBUG and
  says there is nothing behind it here rather than promising a stack: with no
  exceptions the report is made at the site, so there is no stack to unwind and
  no process.argv to read (that builtin needs an entry main, and the modules that
  report internal errors are compiled on their own too). Seven sites in
  self/emit_ops.ts and self/interop_napi.ts still exit 1; both files are owned
  elsewhere.

  runtime.c .text at -Oz goes from 2,544 to 2,561 bytes against the 4,096 budget:
  eight bytes each for the two machine functions, exactly as §7a costed them, and
  one byte net for the stat. examples/hello.ts at the size profile is 4,696 bytes,
  the same as before, because --gc-sections drops what is not called.
  runtime/shim.mjs, tests/differential/rewrite.js and runtime/amritc.d.ts know all
  three, the last of them also picking up mkdirSync and spawnSync, which it had
  never been told about.

- **Lower bitwise compound assignment to a field and an element**

  `this.flags |= MASK` and `xs[i] &= 0xff` were refused — `Unsupported
  assignment operator `|=`` for a field, `Only simple variables can be
  assigned` for an element — while `+= -= *= /= %=` had taken both targets
  since WP2 and WP4. Nothing but a missing row stood behind that: the
  lowering the arithmetic forms use is exactly the one the bitwise family
  needs.

  The lowering. A field is one `getelementptr` shared by the load and the
  store: GEP, `load`, one instruction, `store`, and the expression's value
  is what was stored. An element is the array, the index, one bounds check,
  one GEP, `load`, one instruction, `store` — so the target expression is
  evaluated exactly once and pays for exactly one check, which is what
  `xs[next()] |= 1` needs and what `arr_element_bitwise_assign`'s `.out`
  proves by printing once per statement rather than twice.

  To keep the three targets from drifting apart, each half is written once
  and shared. `checkBitwiseAssignOperands` is the operand rule (two
  integers of one type, a boolean refused by naming `&&`/`||`/`!==`, the
  f64 hint under `--number-mode f64`) and names the compound token that was
  written, so a local, a field and an element are refused in the same
  words. `emitBitwiseCombine` is the apply step, which is where the
  shift-count mask lives: `f.bits <<= 33` is a shift by one on a field
  exactly as on a local, a constant count folds and a variable one costs
  one `and`, and `>>` still reads the target's signedness — `ashr` on
  `i32`, `lshr` on a `u32`, where `>>>` is always `lshr`.

  Nothing about a write relaxes. `readonly` is checked before the operator
  is looked at, so an inherited `readonly` field refuses `|=` in a derived
  constructor and everywhere else; definite assignment still counts
  `this.f |= v` as a read of `f`, because it is one; and the memory-effect
  and escape facts were already keyed on `isAssignmentOperator`, so a field
  or element write through the new operators is classified as it always
  was.

  Both compilers change together, and `self/` gains one property it lacked:
  its local `&=` path went through `checkOperator` with the operator
  stripped, so it reported ``Operator `&` `` where stage0 reported
  ``Operator `&=` ``. Routing all three targets through the shared rule
  removes that divergence rather than adding a second one.

  Also fixed here because the new negative case walked straight into it:
  `installArrayAssignmentCheckers` handed `checkElementAssignment` a spread
  copy of the binary expression so the parentheses of `(a[i]) += v` were
  already peeled. A spread copy is a plain object with no `getStart`, so
  the first diagnostic reported on the expression itself died with exit 70
  instead of printing. The unwrapped target travels beside the real node
  now.

  Tests. `cls_field_bitwise_assign` and `arr_element_bitwise_assign` are
  new goldens with native round trips. The two cases that described the old
  refusal are repointed rather than deleted, to the negatives that are still
  true: `reject_cls_field_bitwise_assign` becomes
  `reject_cls_field_bitwise_readonly` (an inherited `readonly` field) and
  `reject_arr_element_bitwise_assign` becomes
  `reject_arr_element_bitwise_f64` (an `f64` element, refused by the operand
  rule). `tests/differential/corpus/bit_compound_target` puts the mask, the
  fill and the single evaluation in front of Node and they agree.
  `docs/LANGUAGE.md`, the `expr_compound_target` cookbook entry and
  `CHANGELOG.md` follow.

- **Cross the unsigned widths to wasm, and declare only what the loader implements**

  `--emit-dts` and its companion `.mjs` each decided for themselves what crosses
  the wasm boundary, and the two answers had drifted. `wasmType` spelled
  `u8`/`u16`/`u32` as `number` and `u64` as `bigint`, so the declarations carried
  such a function; `crossesWasm` had never listed those widths, so the loader
  wrote no entry for it. `load()` returned an object missing a function its own
  typings promised -- a TypeError at the call site with no diagnostic anywhere,
  reproducible today with `port(p: u16)` in tests/self/interop_payloads.ts.

  There is one predicate now. `wasmType` moves next to the loader and
  `wasmSkipReason` is built on it; `generateDts` declares a function exactly when
  `wasmBridged` keeps it, so neither file can describe a function the other
  omits. A function that cannot cross becomes a comment naming the position and
  the type that stopped it (``argument 2 (a) is `string` ``, ``the result is
  `string` ``) instead of one blanket sentence, and `main` -- which the loader
  always dropped and the declarations always kept -- is named too.

  The widths then have to be bridged for real. The wasm ABI has only
  i32/i64/f32/f64, so all four unsigned types share a value type with a signed
  one and the loader is the only place their range can be restored:

    idU8:  (x) => raw.idU8(x & 0xff) & 0xff,
    idU32: (x) => raw.idU32(x) >>> 0,
    idU64: (x) => BigInt.asUintN(64, raw.idU64(x)),

  Out, for two different reasons. A `u32` result is the full width but signed, so
  4294967295 was reaching JavaScript as -1 and a `u64` above 2^63 as a negative
  bigint. A `u8`/`u16` result is masked because the callee does not narrow it:
  `add i8` is congruent modulo 256, so the wasm backend adds in a 32-bit register
  and `addU8(200, 100)` answered 300 where the language says 44.

  In, only the narrow two, and the reason is the IR rather than the observed
  behaviour. The emitter writes the parameter as a bare `i8` with no `zeroext`
  (`define noundef i8 @idU8(i8 noundef %x)`), which leaves zero-extending it the
  caller's job under the wasm C ABI, and JavaScript is the caller. Today's
  backend, having no `zeroext` to lean on, inserts the `i32.and` itself wherever
  the narrow value is observable inside the callee -- before an `icmp ugt i8`, a
  `udiv i8`, a `zext i8 to i32` -- so an unmasked argument survives by luck, and
  it is luck the day the emitter adds that attribute would take away silently.
  The mask also makes the boundary behave the way JavaScript already does for
  these widths: `idU8(300)` is 44 and `idU8(-1)` is 255, as a Uint8Array store
  would give. The spellings are runtime/shim.mjs's, so the wasm build and the
  differential rewrite agree on what a `u32` above 2^31 is.

  `f32` needs nothing either way, checked rather than assumed: the JS-to-wasm
  call rounds an argument to f32, which is what an `f32` parameter means, and
  every f32 is exact in the double a result arrives in.

  Both compilers change together (src/interop/{wasm,dts}.ts,
  self/interop_{wasm,dts}.ts) and the interop oracle compares their sidecars byte
  for byte over a corpus that now includes tests/self/interop_unsigned.ts. The
  WP8 section of tests/run.js builds that module to wasm and calls it at every
  boundary -- 0/255/65535/4294967295/2^64-1, the truncations on the way in, and a
  `u32` above 2^31 arriving positive -- and checks that every function a `.d.ts`
  declares has an entry in its `.mjs`. Four of those checks fail on the old
  generators.

- **Renumber the retirement plan to WP19 and defer to WP18 where it lands**

  PR #13 claims WP18 for generics by monomorphisation, and it was opened first.
  It also lands three of the builtins this plan asked for — process.platform,
  process.arch and isDirectorySync — which closes two of the four rows §7a left
  with stage0: --target host and `-o <dir>` without the trailing slash.

  So the document is WP19, its §2A table marks those two rows as WP18's rather
  than counting them twice, and §4's builtin table says which side of the line
  each of the four is on. What is left here is getenv and panicInternal.

- **Comment the macOS job out of the CI matrix**

  Every CI run has been red on macOS and green on Linux, on this branch and on
  main alike, for a reason that is neither the compiler's nor the architecture's:
  scripts/build.sh runs under `set -euo pipefail`, and macOS ships bash 3.2 as
  /bin/bash, where expanding an empty array as "${arr[@]}" while `set -u` is on
  raises "unbound variable". bash 4.4 made that expansion legal, so every Linux
  runner passes it at any architecture and every macOS one dies at

    scripts/build.sh: line 96: pgo[@]: unbound variable

  pgo, elf, strip_flag and libs are all legitimately empty on the ordinary macOS
  path, so every --link at the speed, size and napi profiles fails before clang
  is reached.

  The matrix entry is commented rather than deleted, and carries the fix beside
  it: ${arr[@]+"${arr[@]}"} at the nine sites that expand those four arrays.
  docs/wp10-ci.md says what the gap costs while it is open — the ld64 / Mach-O
  half of build.sh, -dead_strip and -Wl,-x and the absence of -fuse-ld=lld and
  -fno-plt, which no Linux runner exercises at any architecture.

- **Say in the README that the project is pre-alpha**

  The README described what the compiler does and where the milestones stand,
  but never said outright that none of it is stable. Add a status note beside
  the working-title note: the version is 0.1.0, the language, the CLI flags and
  the emitted IR change without notice until 1.0, so pin a commit and read the
  changelog before upgrading. The Project status section now names M4 as the
  milestone that freezes the reference, so the table is read as a schedule
  rather than a stability claim.

- **Add the performance diagnostic class with its first two warnings**

  WP15 §8. The compiler now says something when it had to take a slow path
  and a faster one was available, in a third severity beside error and syntax
  error. A warning is the same anchored, excerpted diagnostic an error is,
  with `performance` where the word `error` would be, so nothing that greps
  `: error: ` picks one up, and `--json` carries `"severity":"performance"` —
  the field a tool filters on. Warnings are on by default, print on stderr,
  and never touch the exit code: a program that trips one still compiles and
  still exits 0. A compilation that failed prints its errors and none of its
  warnings, which is what keeps the single-error output byte-identical to
  what WP10 pinned; more than one warning is capped at 20 exactly as the
  error report is. They need no sort — the analysis meets them in module load
  order and then in source order, which is the order the sink sorts errors
  into. `--no-warn-performance` silences the class and changes nothing else,
  and deliberately never reaches CompilerOptions: the checker computes the
  warnings either way and only the driver reads the flag, so the option
  struct that --emit-checked, the interop surfaces and both compilers mirror
  is untouched, and the IR is byte-identical with the flag and without it.

  The analysis is a per-function pass in the checker after the body is
  checked (src/checker/performance.ts, and the WP15 section at the end of
  self/checker.ts). Both facts are syntax plus the types and bindings pass 2
  already wrote, so nothing is re-derived; the emitter could not host them,
  because emit/*.ts reports no user-facing diagnostics at all and an
  unexpected node there is exit 70. The walk carries a stack of the enclosing
  loop statements and a parallel record of the local each declaration
  introduced and the loop depth it was introduced at, which is what tells
  "the accumulator is reset every pass" from "the accumulator outlives the
  pass". A `for` initializer is walked outside the loop it heads, because it
  runs once; a `for...of` variable inside it, because it is a fresh binding
  every pass.

  Quadratic string building fires on `s = <rhs>` where `s` is a string local,
  the assignment sits in a loop that did not declare it, and `rhs` reaches
  `s` through `+` operands, parentheses or template holes. Every pass copies
  the whole accumulator into a fresh arena string, which §1 measures at
  180 MB of peak RSS for 88 KB of output. `s += t` is not a case: `+=`
  requires numeric operands in this language.

  Allocation in a loop is narrowed to exactly what WP6 does not already
  handle: a `new Array<T>(n)` with a non-literal `n`, which can never be an
  entry-block alloca, declared inside a loop, and whose local is only ever
  read through within that iteration. A stackable site — `new C(...)`, an
  object or array literal, `new Array<T>(<literal>)` — becomes one alloca
  whose slot is reused every pass and has nothing to hoist, and an allocation
  that is pushed, stored, returned or handed to a callee is memory the
  program asked for. Both stay silent, because a warning that fires where the
  compiler already did the right thing is the un-actionable kind §8 forbids.

  Tests: perf_str_concat_loop and perf_alloc_loop for the warnings, over
  `for`, `while`, `do` and a nested loop whose accumulator is declared one
  level out; perf_str_concat_quiet and perf_alloc_quiet for the guards, which
  are the cases that matter — loops that concatenate and allocate and must
  say nothing at all. A WP15 §8 block in tests/run.js pins the exact text and
  excerpt of both messages, the flag, the --json shape, the 20-warning cap,
  and that a failed compilation reports no warnings.

  Run over the corpus, the warnings found one real bug: self/lexer.ts builds
  the text of a string and of a template literal one character at a time with
  `text = text + ...` inside a while loop, the shape .claude/selfhost.md
  forbids in self/. It is reported here rather than fixed, since the fix is a
  change of its own.

- **Reclaim a callee's arena temporaries at the call site**

  A function that returns a string can never have an automatic arena scope:
  the string it hands back has to outlive it, so `returnsAllocation` disables
  the scope and every intermediate it built stays in the arena for the life of
  the program. That is what made bench/strbuild touch 48 MB of fresh pages to
  produce an 806 KB string, and it is the remaining item the WP6 note at the
  top of docs/wp9-optimisation.md left open.

  The lowering. A call to a user function now compiles to

      %mark = call i64 @amrit_arena_mark()
      %t    = call i8* @join(i32 %lo, i32 %hi)
      %kept = call i8* @amrit_arena_keep(i64 %mark, i8* %t)

  with %kept used everywhere %t would have been. The mark is emitted after the
  arguments, so the bracket contains what the callee bumped and nothing the
  caller did. `amrit_arena_keep` releases back to the mark while preserving the
  newest block: it moves the block down onto the mark and frees every newer
  chunk, or, when the mark sat at the end of a chunk the callee filled exactly,
  leaves the block where it is and unlinks the chunks between. Both arms are
  needed -- without the second the reclaim does nothing for strings above one
  64 KB chunk, which is where strbuild's memory is.

  The proof. The obligation is that every byte released is unreachable, and a
  call hands back exactly one value, so the only things in the window are what
  the callee returned (kept, not freed), what it dropped, and what it stored
  somewhere the caller can reach. The last is the whole question, and it needs
  a fact escape.ts did not have: `allocLeaks` merges a value stored where the
  caller can reach it with one merely assigned to a local of the frame
  (`s = s + piece(i)`, the shape of every string builder), and only the first
  is a reason not to reclaim. Every Outcome now carries an `escapes` bit
  computed in the same walk from the same `classifyUse` -- true for a store
  into a field, an element, a literal, a `push` or a capturing callee, and
  following the value into the local for an assignment -- and `allocEscapes`
  propagates it over the call graph in the same fixpoint as `allocLeaks`.
  `allocEscapes` implies `allocLeaks` and never the reverse; `flow` is
  untouched, so the stack rule and the automatic scopes decide exactly what
  they decided before. The recursion guard is pessimistic for `escapes`,
  because following `y = x` can cycle where the `const y = x` chains `flow`
  follows cannot.

  Only a plain `string` return is bracketed. A string is one flat block with no
  interior pointers, so relocating its bytes relocates the whole value; an array
  header names a separate data block and a `Result` names a payload bumped
  before it, so moving either would leave a dangling pointer. Every runtime
  guard refuses rather than moves -- a block that is not the arena's newest (a
  literal, or a pass-through of a parameter), a stale mark, a mark newer than
  the block -- which reclaims less and is always safe.

  Measured on bench/strbuild (131,072 pieces, 806 KB result, --profile speed,
  peak RSS via bench/rss.c): peak resident set 48,676 KB -> 16,420 KB, peak
  live arena 51,503,624 -> 15,196,680 bytes, same output and same bytes bumped.
  `.text` in runtime/runtime.c goes 2,561 -> 2,775 at -Oz against the 4,096
  budget.

  tests/cases/mem_reclaim_call is strbuild in miniature, mem_reclaim_argument
  passes the temporary on and holds it across a later call,
  mem_reclaim_no_stack_alloc pins that the flag moves allocations without
  moving a bracket, and mem_reclaim_guards is the negative half: four calls of
  which exactly one is bracketed, the others refused for storing into the
  caller's object, for Arena.reset, and for returning a Result<string, number>.
  tests/runtime_test.c covers both outcomes of amrit_arena_keep and its three
  refusals. Both compilers emit the bracket identically and the bootstrap still
  reaches its fixed point.

- **Scan string and template literals in runs, not a byte at a time**

  The `performance` diagnostic class warned about `self/lexer.ts` itself, and it
  was a true positive. `scanString` and `scanTemplate` both accumulated the
  literal's decoded text with `text = text + <one byte>` inside their scan loop,
  which is the shape docs/wp14-selfhost.md §2.3 forbids: every byte copied the
  whole accumulator into a fresh arena string, and the arena never reclaims, so
  the cost was quadratic in time and in arena bytes — in the loop that reads
  every file the compiler compiles.

  Both scans now keep a `chunk` cursor at the start of the run of plain bytes
  not yet taken. An escape flushes the run before it in one `substring`, and the
  terminator flushes the rest. The common case is that there is no escape at
  all, and it is now exactly one `substring` of the whole span with the builder
  untouched, which is why `literalText` tests `isEmpty()` rather than always
  joining. The escape path goes through one `StringBuilder` held by the lexer
  and reset per literal rather than allocated per literal, reached by the two
  helpers the two scans now share: `takeEscape`, which takes the pending run and
  the escape together, and `literalText`, which finishes the literal.

  Nothing the lexer produces changed. The token streams of 678 files are
  byte-identical to the old lexer's, the malformed ones the oracle cannot judge
  included, and tests/lexer_oracle.js still agrees with the `typescript` scanner
  over 588 files and 176,304 tokens. `tests/lexer/literals.ts` and
  `templates.ts` gain the cases where the new code's runs are empty: an escape
  at the very start of a literal, two escapes with nothing between them, a
  literal that is only an escape, a line continuation, and a template part whose
  escape runs into the `${` that ends it.

  Measured with stage1 over the whole of `self/`: peak RSS 131.8 MB to 128.9 MB,
  wall time about 226 ms to 214 ms on a shared machine, so the memory is the
  number to trust. On a source whose literals are long rather than short the
  quadratic shows its real size: 400 KB of literal text cost 408 MB and 392 ms
  to lex and now cost 2.4 MB and 10 ms. Both compilers now report zero
  performance warnings for the whole of `self/`, and both still report the four
  on the old source, which is a check on the warning as much as on the fix.

- **Turn on the two fast defaults: `nsw` and internal linkage**

  WP15 §3, item 1 of §9. Both flags flip, and the semantic half of the flip is
  a withdrawn guarantee rather than a tuning knob, so it is stated plainly
  everywhere the old one was promised.

  `--nsw` is on by default, with `--wrapping` to opt out. Every user-level
  signed i32/i64 add/sub/mul — binary operators, unary minus, `op=` on locals,
  fields and elements, `++`/`--` — now carries `nsw`, so signed overflow is
  undefined as it is in C and LLVM may widen induction variables and
  strength-reduce the loops around them. Measured on a strided sum: the index
  arithmetic widens to i64 instead of a per-iteration trunc/shl/sext and the
  loop vectorises to 16-wide strided loads, where the same source under
  `--wrapping` stays scalar.

  Unsigned arithmetic never carries a no-wrap flag, in either mode. `--nsw`
  used to put `nuw` on it, which was defensible while the flag was opt-in and
  is not defensible as a default: u8/u16/u32/u64 are defined as wrapping
  precisely so that hashing and bit-packing have somewhere to live. `intOpcode`
  now reads the checker's recorded signedness as the proof under the attribute
  and emits nothing for an unsigned type.

  Constant folding mirrors the emitter rather than diverging from it. By
  default an initialiser whose +/-/* or unary minus leaves its width is
  `attempt to compute with overflow in a constant`; the compiler will not hand
  back the one value the optimiser is entitled to assume cannot happen. Under
  `--wrapping` it wraps, as it always did. This is the treatment the two
  divisor failures already had. stage1 computes the fold and its overflow
  detection through u64, whose wrapping is defined, so the compiler never
  overflows a signed value of its own to describe one.

  `--strict-exports` is on by default, with `--no-strict-exports` to opt out:
  a function without `export` gets `internal` linkage and leaves the
  `--emit-header` / `--emit-dts` / `--emit-napi` surface with it. A C driver
  that calls a non-exported function needs the flag or an `export`; the test
  corpus took the second route, so `tests/driver.c`'s `test()`, `tests/cases/add.ts`,
  `tests/layout/structs.ts` and the two examples that exist to be called from C
  now say `export`.

  A duplicate function name is refused whether or not the flag is in play. The
  check used to be skipped under `--strict-exports`, on the reasoning that an
  `internal` symbol never reaches the linker; it does reach `analyzeFunctions`,
  which keys the whole-program fact fixpoint by `FunctionSig.name`, so two
  functions sharing a name shared one set of facts and each was emitted with
  the other's attributes. That is a miscompile, not a link error. Making the
  flag the default made it easy to hit, and the bootstrap did: an out-of-bounds
  inside stage1 the moment two modules of `self/` both declared a `narrow`.

  `self/` relied on wrapping in two places and both are fixed rather than
  exempted: the FNV-1a round in `self/map.ts` accumulates in u32, and
  `parseIntegerLiteral` multiplies through u64. Same instructions, same bits,
  and now the claim under them is true.

  Every test that pinned wrapping is re-pointed rather than deleted:
  `const_wrap` and `i64_basic` carry `--wrapping` in their `.args`, and so do
  the twelve differential corpus programs that overflow on purpose, so the Node
  oracle keeps comparing against something defined. `opt_nsw` is the default
  now and pins which operations carry the flag; `opt_wrapping` is the same
  source under the opt-out and the two goldens differ in exactly the flags.
  `reject_const_overflow_arith`, `export_no_strict` and
  `tests/link/duplicate_internal` are the new negatives.

- **Regenerate the goldens the two fast defaults reached**

  Fifteen goldens were written against the old defaults: seven where the
  call-site reclaim and this flip both changed the same file, and eight from
  the reclaim and the performance-diagnostic work, whose cases were authored
  before nsw and internal linkage became the default. The compilers already
  agreed — the self/ oracles and the bootstrap fixed point passed while these
  failed — so only the checked-in text was behind.

  Regenerated from the compiler rather than hand-merged, and read back to
  confirm both changes are present in the files that carry both: the
  mem_reclaim goldens keep their amrit_arena_mark/keep brackets and now also
  show define internal and nsw.

- **Say in wp9 that the nsw default has since flipped**

  wp9 measured --nsw as an opt-in flag and recorded that the default stays
  wrapping. WP15 §3 flipped it, so the note now points at the decision its own
  -8 % on sieve bought, and says its wrapping column is what --wrapping
  produces rather than what a default build does.

- **Regenerate the benchmarks and attribute what the defaults moved**

  The table is re-run on an idle machine with the same --runs 15 --warmup 3 the
  previous one used; the defaults are 5 and 1, and a table built with those is
  not comparable to one built with these.

  strbuild leaves the miss list: 1.64x to 0.90x against Rust and 0.82x against
  the naive C twin, which is the call-site reclaim rather than these flags.
  nbody links to 10,856 bytes where it linked to 12,000, which is the
  dead-stripping §3 promised.

  fib appeared to lose 4 % and did not. Both binaries were disassembled, their
  addresses normalised and their instruction streams sorted: the multisets are
  identical, so the difference is where the linker placed the function under
  internal linkage, not what the compiler emitted. --nsw alone is neutral on a
  recursive function with no induction variable, measured at 439 ms against 436.
  nbody is a real 2.6 % with 13 % fewer instructions, and is named rather than
  averaged away.

  wp9's current-standing table is re-pointed at these numbers: three programs
  outside the 1.10x target now rather than four.

- **Type the ambient terminators as `never` and declare the two missing builtins**

  `runtime/amritc.d.ts` claims one direction — a program `amritc` accepts is
  never one `tsc` refuses — and it was wrong about that in 68 places in `self/`
  alone.

  `panic` and `process.exit` were typed `void`. Both end control flow, so a
  function may end with either instead of a `return`, and the guard-then-panic
  shape `self/` writes wherever another language would assert
  (`if (x === null) { panic(...); }`) narrows below the guard. Neither is
  something `void` can say: `tsc` saw 16 functions falling off their end and
  some 40 values still possibly null. They are `never` now, which is how
  TypeScript spells a terminator, and the narrowing follows from the
  declaration rather than being asserted beside it.

  `mkdirSync` and `spawnSync` have been builtins since the self-hosted link
  step needed them (WP14 §3a D4) and were never declared at all.

  The claim survived being wrong because the WP16 block tested it on the
  `res_*` cases, and nothing in the `Result` surface panics. It now
  type-checks every case `amritc` accepts and every `self/` module, with the
  three real divergences named rather than tolerated: the typed-array aliases
  and the implicit `super()` on the case side, and `a.pop()` being `T` here
  and `T | undefined` in `lib.es5.d.ts` on the `self/` side. A fourth
  diagnostic is a hole in the declarations and fails the run.

  No IR changes: the file is consumed by `tsc` and by editors, never by the
  compiler.

- **Add `readonly T[]`: the array a callee may read and not write**

  `--emit-header` already spelled an array parameter `const amrit_array *`
  whenever the whole-program fixpoint proved nothing stored through it. That
  makes `const` a *consequence*, and a consequence can disappear without anyone
  deciding it should: a callee three levels down starts writing and the
  prototype quietly loses the qualifier the C on the other side was reading.

  `readonly T[]` — and `ReadonlyArray<T>`, the same type under the other
  spelling — makes it a promise the signature keeps. It is the same header, the
  same pointer and the same LLVM type; the cookbook entry is one function under
  both spellings and the two bodies are identical instruction for instruction,
  because the annotation is something the checker enforces and not something the
  emitter lowers. A `T[]` widens into one at any sink and never back, since
  laundering the promise away one call deeper would leave it worth nothing.
  Stores, `push` and `pop` through one are refused under their own names. It is
  shallow, as TypeScript's is, and it is a type rather than a parameter
  modifier, so a field, a return type and a `const`'s annotation all take one
  and the rule travels with them.

  The declaration and the fixpoint must agree. A `readonly` parameter the
  fixpoint says is written through means the checker let a write past it, and
  `const` on the prototype would then be a promise the code does not keep — a
  miscompile in the C that trusts it — so `writtenArrayParams` fails the build
  with exit 70 rather than writing the header.

  The spelling was not a choice. TypeScript permits `readonly` on array and
  tuple types and nothing else (TS1354), so `readonly Point`, which would have
  been the other half of this, is not TypeScript and was left out rather than
  invented; `readonly i32` names that rule instead of reading as a gap.

  Both compilers land together, as a construct must: a new `N_TYPE_READONLY`
  node in stage1's parser, the flag interned beside the array id rather than
  given a kind of its own so that all 27 sites asking `K_ARRAY` keep working,
  and `TypeOperator` taught to the parser oracle. `IR(stage0) == IR(stage1) ==
  IR(stage2)` still holds over the whole corpus and stage3 is byte-identical to
  stage2.

  `docs/IR_COOKBOOK.md` also picks up six lines of drift it was already carrying:
  non-exported functions gained `internal` linkage since it was last generated,
  and `regen.sh --check` was red before this change.

- **Provision the agent toolchain and gate the docs that agents read**

  Two surfaces an AI agent depends on had no enforcement behind them.

  A Claude Code on the web container starts without LLVM 18, and
  `tests/run.js` skips its toolchain-dependent half rather than failing when
  the tools are absent. A green `npm test` in such a session therefore proves
  far less than it looks, which is exactly the trap `.claude/orientation.md`
  and `.claude/node.md` warn about in prose. Add a SessionStart hook that
  installs the six binaries the harness probes for, using the same packages
  and the same private-bin-dir trick as CI, and that prints what the session
  actually got. It is remote-only and a no-op when the tools are present.
  Register it in a new `.claude/settings.json`, alongside an allowlist of the
  repository's standard commands so routine work does not stop for prompts.

  `docs/check-links.mjs` and `docs/cookbook/regen.sh --check` both existed and
  neither ran in CI, so the reference material could rot unnoticed -- and had:
  `docs/IR_COOKBOOK.md` still showed external linkage and plain `add` for six
  functions, predating the `--strict-exports` and `--nsw` defaults. Regenerate
  it and wire both checks in: the cookbook into the `test` job, which has the
  LLVM the regeneration needs, and the link check into `lint`, which needs no
  toolchain.

- **Run a program under Node with nothing rewritten, and pin the overlap**

  WP13's rewriter is exact because it loads a program through the compiler's own
  checker and rewrites every expression from the recorded types. That makes it a
  testing oracle, not something to hand anyone: "your program runs under Node"
  is not a useful claim if the answer is "after my compiler rewrites it".

  `runtime/amritscript.mjs` is the smaller claim beside it.

      node --experimental-strip-types --import ./runtime/amritscript.mjs prog.ts

  Nothing is rewritten. The prelude supplies only what Node lacks — the globals
  AmritScript has and `node:fs` does not, the conversions, `Ok`/`Err`, the two
  string parsers whose deviations are documented rules, `process.argv`'s
  indexing, an `Arena` that answers zero — plus `console.log`'s formatting, which
  has to be `String(x)` on a synchronous write because Node's console inspects
  and would print `-0` and a BigInt's `n`. Every one of them delegates to
  `runtime/shim.mjs`, the module the differential harness already uses, so a
  semantic fixed in one is fixed in both.

  It is honest in f64 mode, where JavaScript's `+ - * / %` on doubles are
  `fadd/fsub/fmul/fdiv/frem`, and it will never be honest in i32 mode, where
  `number` wraps at 32 bits and every arithmetic operator differs.
  `docs/RUN_UNDER_NODE.md` states the whole overlap rather than implying there
  isn't one: byte-length `.length`, unchecked `a[i]`, virtual dispatch,
  `orReturn()` (which needs the caller's control flow, so it needs the
  rewriter), `Number(s)`, and the three float decisions. Each lives in an
  operator or in the object model, where a prelude cannot reach.

  `tests/differential/unmodified.js` keeps it honest: every f64-mode program
  with an entry point, native against unmodified Node, four listed divergences
  and any other difference failing the run. Six of ten agree, and the four that
  do not are the programs written to probe exactly those decisions —
  `examples/nbody.ts` prints byte-identical output either way. The runner copies
  each program into a directory whose package.json says `"type": "module"`,
  because this repository's says commonjs and an in-tree `.ts` would otherwise
  be read as CommonJS and reject its own `export`.

  Also: `readonly` on an interface field finally has a test
  (`reject_cls_readonly_interface`). It has worked since interfaces and classes
  started sharing `collectField`, and LANGUAGE.md documented it as *(CLI only)* —
  an implemented rule with nothing pinning it, which is how the `panic` hole in
  the ambient declarations survived as long as it did.

- **Answer --help on stdout and give every diagnostic a stable code**

  Two halves of the same problem: a tool that wraps the compiler had nothing
  reliable to read.

  `--help` printed the usage text on stderr and exited 2, so a successful
  request was indistinguishable from a rejected one and `amritc --help`
  counted as a failed command. Split the text from the two ways it is printed:
  `-h`/`--help` now writes it to stdout and exits 0, the way clang, tsc and git
  answer it, while a genuine usage error -- unknown flag, missing argument, no
  inputs -- keeps stderr and exit 2. stage1 mirrored the old behaviour
  deliberately, so `self/compile.ts` moves with it and the comment saying why
  is rewritten. Neither returns through `process.exit`: the usage text is now
  the longest thing the driver writes to stdout, and exiting would truncate it
  into a pipe.

  `--json` carried a `code` field that the source described as "reserved and
  absent for now". Fill it in. `src/codes.ts` and `self/codes.ts` hold one
  registry of 332 rules, generated from the compiler's own diagnostic sites by
  scripts/gen-diagnostic-codes.mjs, so a new diagnostic that has no code is a
  failing check rather than something noticed a release later. A fragment is
  the longest literal run of a message's template, matched as a substring,
  which is also what keeps the project's name out of the table: every "... is
  forbidden in ${LANGUAGE}" contributes the run before the name, so
  `branding.ts` stays the only place it is spelled.

  The numbers are the point, so they never move: the generator preserves every
  assignment already committed and only appends, one past the highest in that
  band. Bands follow the pipeline -- AS0001 a syntax error, AS1xxx Phase 0,
  AS2xxx the checker, AS3xxx the driver, AS4xxx interop, AS9xxx a performance
  warning, AS0000 a rule that has none yet. 221 of the 229 distinct messages
  the suite exercises carry one; the eight that do not are built entirely out
  of interpolations and are pinned as a backlog that may shrink, not grow.

  Codes appear in `--json` only. The human summary line is unchanged, because
  the `.err` goldens and `tests/self/reject_oracle.js` match on it byte for
  byte -- and the stage0/stage1 `--json` comparison already in the suite now
  also proves both compilers resolve the same code for the same message.

  Also stop `node tests/run.js <sub>` reporting a spurious failure when the
  filter excludes the case whose IR the `-g` verify step reads.

- **Fix five review findings, four of them mine and one a stale claim**

  **The `readonly`/fixpoint guard was unsound, and it aborted legal programs.**
  `writesThrough` is not "stores through this pointer", it is a conservative
  *may-write*: `noteUse` sets it for every escape, on the grounds that an alias
  might be written through later. So the cross-check fired on
  `function first(xs: readonly i32[]): readonly i32[] { return xs; }` — a program
  the checker had just accepted — and exited 70, and it would have fired on
  `rows[0][0] = v` through a `readonly i32[][]`, which LANGUAGE.md documents as
  legal because readonly is shallow. There is no fact meaning "definitely
  writes", so no sound cross-check exists to write. The header now never consults
  the fixpoint for a `readonly T[]`: the checker refuses every write and refuses
  the widening back to a mutable `T[]`, which makes it exact where the fixpoint
  is conservative. `arr_readonly_escape` pins all three shapes, and the WP8 block
  checks the `const` survives the escape.

  **stage1 dropped the `process.exit` that an internal error needs.** Every other
  `internalError` site in `self/` is `process.exit(internalError(...))` — its own
  header explains why the pair cannot be half-written — and this one was a bare
  call, so stage1 would have printed the banner, emitted a non-`const` prototype
  and exited 0 where stage0 exited 70. Moot now that the guard is gone, but it is
  why the guard should never have been written twice by hand.

  **`mkdirSync` and `spawnSync` were already declared.** They landed in
  `amritc.d.ts` on main while this branch was in flight, and the rebase merged
  both copies without conflict because they sit in different parts of the file.
  TypeScript folds identical overloads, so nothing failed. The duplicates are
  gone and the changelog no longer claims they were missing — they were, when the
  commit was written, and were not by the time it landed.

  **The prelude's `Arena` was written inline** rather than delegating to
  `runtime/shim.mjs` like everything else in the file, which broke the one
  invariant its header claims: it answered `0n` where the shim answers `0`. It
  delegates now. The BigInt-shaped conversions (`toI64`, `toU64`, `f64ToBits`)
  stay as they are — a `TypeError` at the first `n + 1` is the right failure for
  a 64-bit integer under an unrewritten runtime, much better than a number that
  silently stops wrapping at 2^53 — but that boundary was undocumented, and
  `RUN_UNDER_NODE.md` now lists i64/u64 beside i32 mode.

  **A check that could pass by testing nothing.** The `self/` ambient check
  asserted only that every `error TS` line was the documented `pop` divergence,
  and a tsc that fell over before checking anything produces no such lines at
  all: `[].every(...)` is `true`. It now requires either a clean run or at least
  one diagnostic, all of them that divergence, and matches the file it comes from
  rather than any `TS2345` mentioning `| undefined`.

- **Make every failure machine-readable, count what the suite skipped**

  Three gaps left a tool -- an editor, a script, an agent -- guessing.

  `--json` covered the diagnostics with a source span and nothing else, so an
  unusable C toolchain (exit 3) and an internal compiler error (exit 70) printed
  prose on stderr and left stdout empty. A caller that asked for JSON then had
  to scrape stderr to learn why the run failed, which is the thing the flag
  exists to avoid. Both now print one flat object with the band-0 codes AS0002
  and AS0003; the human report still goes to stderr for a crash, because that is
  worth seeing twice. Driver refusals and unreadable paths gained the same
  `code` field.

  stage1 mirrors this for `--link`, and deliberately not for the internal error:
  `self/ice.ts` is a library module, so `process.argv` is out of reach there --
  it needs an `export function main` -- and the language has no mutable module
  state, so the only way in is a parameter on all 39 callers of `internalError`,
  which are broken invariants scattered through every phase. Recorded in
  docs/wp14-selfhost.md section 7 with the other deliberate differences.

  `tests/run.js` reported `N passed, M failed` and said nothing about what did
  not run. Without LLVM 18 the toolchain-dependent half of the suite skips
  rather than fails, so a run that proved almost nothing looked exactly like one
  that proved everything. Skips now go through `skip(reason)`, are counted in
  the summary, and a run missing the toolchain ends with a DEGRADED banner
  naming the tools and what stays unproven.

  The code generator had two flaws worth fixing before any of this shipped. It
  scanned its own output, whose header quotes the patterns it looks for, so each
  run grew a rule; and a rule that disappeared from the sources freed its
  number for the next new rule to reuse -- the one thing a stable code may not
  do. Retired fragments now keep their entry, and with it their number.

  Docs: the `--json` schema, the code bands and the registry in wp10-ci.md; the
  exit-code table and the `--help` contract in wp12-release.md; the flag in
  LANGUAGE.md and README.md; a "machine-readable surfaces" table and a section
  on what a green test run is worth in AGENTS.md; the same two points in
  orientation.md, node.md and testing.md. CI gains the registry check next to
  the cookbook one.

- **Move the package to ES modules and raise the Node floor to 22.18**

  `"type": "commonjs"` had been in package.json since the first commit. It was
  the tsc default of 2019, not a decision anyone made and defended, and nothing
  in docs/ ever argued for it — `.claude/typescript.md` merely recorded it as a
  fact, alongside the `.mjs` exceptions it forced.

  It had started to cost something. An in-tree `.ts` was loaded as CommonJS, so
  `export function main` was a syntax error before type stripping ever ran, and
  `node --experimental-strip-types examples/nbody.ts` failed in the directory the
  examples live in. `tests/differential/unmodified.js` had to copy every program
  into a scratch directory carrying `{"type": "module"}` to escape the package's
  own module system. A compiler that cannot run its own example programs in place
  is a poor advertisement for a language whose modules are ES modules and whose
  CommonJS support is nil.

  The conversion is mechanical and the type checker enumerated most of it.
  `module: Node16` means Node resolves what it is given, so every relative import
  in `src/` carries its `.js` extension — 294 across 55 files, each one an error
  (TS2835) until it did, which is a better worklist than a grep. `__dirname` in
  `version.ts` becomes `import.meta.dirname`. The 18 files of `tests/` and
  `scripts/` follow: `require` to `import`, `module.exports` to `export`,
  `require.main === module` to a comparison against `import.meta.url`, and the
  oracles' synchronous reads out of `dist/` to top-level `await import(...)` of a
  file URL. One `require` survives on purpose — a `createRequire` in
  `tests/run.js`, because `require.resolve("typescript/bin/tsc")` has no ESM
  spelling.

  The floor moves from 18 to 22.18: the version where Node strips types without a
  flag, which is what turns docs/RUN_UNDER_NODE.md into something to point people
  at rather than a footnote about `.mts`. CI already ran 22.

  Nothing in the repository consumed the package as a library, and the `bin` is
  unchanged, so the CLI is unaffected — the packaging tests install the tarball
  and drive the installed `amritc` from an unrelated directory, and they pass.
  `runtime/shim.mjs`, `runtime/amritscript.mjs` and `bench/` keep their `.mjs`
  extensions, which now mean "loaded by something else" rather than "the
  exception to the package".

- **Refresh the lockfile's Node floor to match package.json**

  `1e66fc4` raised `engines.node` to >=22.18.0 when the package moved to ES
  modules, but the copy of that field the lockfile keeps in its root package
  entry still read >=18. `npm install` rewrites it, so a fresh install left
  the tree dirty; this commits what it writes.

  No dependency versions change.

- **Run CI once per commit by scoping the push trigger to main**

  `on: push` carried no branch filter, so every push to a branch with an open
  pull request started the full matrix twice: once for the `push` event and
  once for `pull_request` on the same commit.

  The `concurrency` group cannot collapse the pair. It keys on `github.ref`,
  which is `refs/heads/<branch>` for the push and `refs/pull/<n>/merge` for the
  pull request, so the two runs land in different groups and neither cancels
  the other.

  Scope `push` to `main` and leave `pull_request` to cover branches. Nothing
  loses coverage: pushes to `main` still run, pull requests still run, and tags
  reach the same workflow through `workflow_call` from release.yml, which
  triggers on `v*`. The one behaviour that goes away is CI on a branch that has
  no pull request open yet.

- **Sync the lockfile's engines with the Node floor package.json raised**

  `1e66fc4` moved the package to ES modules and raised `engines.node` to
  >=22.18.0, but the mirrored `engines` block npm keeps for the root package in
  `package-lock.json` still said >=18. `npm install` rewrites it on the first
  run in a fresh checkout, so the stale line was one dirty working tree per
  container and nothing else.

  No dependency, version or integrity hash moves: the diff is the one line.

- **Sync the lockfile's Node floor with package.json**

  Raising the engine floor to >=22.18.0 in package.json left the root
  package entry in package-lock.json still claiming >=18. `npm install`
  rewrites it; commit the result so a clean checkout does not show a dirty
  lockfile.

- **Close R1's builtin and flag parity, and build the gate that measures it**

  WP19 R1 asks that no program and no flag be stage0's alone, and that a
  `--parity` mode prove it. Three pieces:

  **`getenv(name: string): string | null`** (§4's remaining builtin), in
  both compilers. `amrit_getenv` copies the value out of `environ` into the
  arena rather than handing back libc's pointer, which a later `setenv` may
  move; the declaration is `noalias` because every call answers a fresh
  string, and `readnone` on neither side because it allocates and the
  environment is not memory LLVM tracks. `null` and `""` are different
  answers on purpose: an unset `CC` means "use the default", a `CC=` means
  someone set it to nothing, and a driver acts on the difference. It is a
  call and not `process.env.CC` because member access on a runtime key is
  what Phase 0 forbids.

  Testing it needed a harness capability the suite did not have: a
  `<name>.env` sidecar, read by `tests/run.js` and by
  `tests/differential/lib.js` so both sides of a differential run see one
  environment. A case cannot pin its own answer — the language has no
  `setenv` — and a golden that read the developer's environment would not
  be a golden.

  **`--emit-ast` in stage1**, the one §2A row that was a deliverable rather
  than a lowering. The printer moves to `self/ast_text.ts`, shared by
  `self/compile.ts` and `self/dump_ast.ts`, which is the arrangement
  `self/dump.ts` already had for `--emit-checked`: the flag and the parser
  oracle print through one function and cannot drift. What the two
  compilers print still differs by design — stage0 the `typescript`
  package's node names and line:col spans, stage1 the flattened vocabulary
  of `self/nodes.ts` with byte offsets — so there is a golden per compiler
  rather than an oracle between them. `dump_ast.ts`'s own output is
  unchanged to the byte.

  **`node tests/run.js --parity`** (`tests/self/parity.js`): the corpus
  through both compilers across the fourteen flag variations the suite
  itself uses, comparing exit status, stdout, stderr's `error:` lines and
  every file written. A difference is a failure unless declared with a
  reason, and a declaration must earn itself by normalising away exactly
  the bytes allowed to differ, so it cannot swallow the next real
  divergence on the same surface.

  Building it found a fifth §2A row nobody had counted: stage0 runs the
  attribute pass before `--emit-checked` and prints `facts:`, `calls:` and
  `stackSites=`; stage1 dumps after `check()` and prints none of them.
  `checked_oracle.js` filters exactly those lines away, by design, because
  it compares the checker. It is recorded as open in §2A rather than
  declared away, so G1 is not yet green.

- **Refuse a contextual type for unwrapOr's fallback in stage1**

  `--parity`'s first full run found the two compilers disagreeing about a
  program: `tests/cases/res_unwrap.ts` under `--number-mode f64` is refused
  by stage0 and compiled by stage1.

  `self/result.ts`'s `checkUnwrapOr` threaded the success type down as the
  argument's contextual type, so the bare `-1` in `r.unwrapOr(-1)` on a
  `Result<i32, string>` typed as `i32`. stage0 checks that argument with no
  contextual type at all, so the literal takes the mode's default, `f64`,
  and does not match. `docs/LANGUAGE.md` is normative and its
  contextual-literal table is an enumerated list of positions that this is
  not one of, so stage1 was the side in the wrong; the hint is dropped.

  Nothing had ever compiled that program in f64 mode through both
  compilers. Every oracle uses the flags a program already carries and
  `res_unwrap.ts` carries none, which is the hole the cross product exists
  to cover. `reject_res_unwrap_or_f64` pins the refusal on both sides.

  Also replaces the check that asserted `--emit-ast` is refused by name,
  which the previous commit made false, with the property it was really
  pinning: a flag the compiler does not know is refused rather than
  quietly dropped, on both compilers.

- **Key parity declarations on effective flags, and report progress**

  Two things the first full `--parity` run showed about the driver itself.

  **A declaration was keyed on the variation's name**, so a program whose
  own `.args` already ask for a dump — `tests/cases/dump_ast.ts` and the two
  `dump_checked` cases — was dumping under every variation and had its one
  known difference reported as undeclared eleven times over. Thirty-three of
  the run's 228 undeclared rows were that, and none of them was a fact about
  the compilers. Declarations now match on the flags the run effectively
  carried, which is what "this difference is decided" was always about.

  **A full run is minutes and said nothing until the end.** `self/`'s
  modules are whole programs and every one is compiled under every
  variation, so the corpus is far more work than its file count suggests.
  It now writes a counter to stderr — stderr so that piping the table
  somewhere does not collect the progress with it, and only to a terminal,
  so a CI log is not a thousand lines of counter.

- **Write down what the parity gate found on its first run**

  2,408 runs over `tests/cases`, 206 undeclared differences, five root
  causes. The numbers are the argument for the gate, so §A2 records them
  rather than leaving them in a terminal:

    - `Ok(...)`'s payload and an object literal's field take a contextual
      type in stage1 where stage0 gives none, so three `res_*` programs
      compile in f64 mode that stage0 refuses. Same shape as the `unwrapOr`
      fix, at two more sites;
    - a fixed-length stack array is sized by parsing an IR operand, which
      in f64 mode is a register rather than digits. stage0 writes
      `alloca [NaN x float]` and exits 0 — IR `llvm-as` refuses — and
      stage1 writes `alloca [0 x float]`, which assembles and then stores
      two floats past the slot. Both wrong, and stage1's builds and runs,
      which is worse. It predates this package;
    - the two compilers report a different *first* diagnostic for
      `cf_switch_break` in f64 mode, and stage1 drops the `/=` spelling
      from a compound-operator message.

  None of it was reachable by an oracle: every oracle compiles a program
  with the flags that program already carries, and not one of these
  programs carries the flag that exposes it. A cross product over flags the
  suite already uses found a miscompile that eleven oracles and 1,161
  checks had not.

- **Close the flag half of WP19 G1, and give it a check that can fail**

  R1 asks that no program and no flag be stage0's alone, and G1 asks for a
  check that says so rather than a belief. Neither existed, and the reason
  the gaps had survived is that nothing in the tree asks a compiler what
  flags it has: every oracle in `tests/self/` runs the corpus through both
  compilers with each program's own flags, so a flag one side had and the
  other did not was invisible to all of them.

  Two were. `--no-warn-performance` was stage0's, and worse than the flag:
  stage1 had the whole of WP15 §8 — the analysis in `self/checker.ts`, the
  second list in the sink, the report in `self/diagnostics.ts` — and its
  driver never printed any of it, so `build/amritc` compiled a quadratic
  string loop in silence where `amritc` named it. The driver reports them
  now on stage0's streams (stderr capped at 20, JSON objects on stdout
  under `--json`, exit code untouched) and takes the flag that silences
  them. `--out-dir` ran the other way: stage1's own spelling for `-o
  <dir>/`, which stage0 has never had, kept because three oracles passed
  it. They pass `-o <dir>/` to both compilers now and the flag is gone,
  which is the parity the gate wants without the frozen compiler growing
  anything.

  `tests/self/parity.js` is G1's check. It reads the flag set out of each
  compiler's `--help`, diffs the two, then runs a matrix of every no-value
  flag and every value a valued flag takes across six programs — each with
  the flags the suite compiles it with — requiring the same exit code, the
  same stdout, the same stderr and the same IR. A difference fails the run
  unless the file names it with a reason; `--emit-ast` is the one that
  does. 24 stage0 flags, 23 stage1 flags, 100 flag/program pairs agreeing,
  0 differences.

  Both usage texts name the same six spellings now. `-o`/`--output`,
  `-v`/`--version` and `-h`/`--help` were always both accepted by both
  compilers and each side documented a different subset; since the check
  reads `--help`, what a compiler documents is what it is held to.

  The stale skips go with it. A skip prints only under `--verbose`, so a
  corpus file whose `.args` names a flag an oracle's `SHARED_FLAGS` does
  not list leaves the comparison without failing anything: `--wrapping`
  and `--no-strict-exports` had been stage1's since §7a and were never
  added, so the cases the WP15 overflow flip brought went straight into
  the skip count. The IR oracle was at seven skips and is back to the one
  documented file, comparing 318 programs where it compared 312.
  `checked_oracle.js` passed only `--number-mode`, which stopped being the
  only flag the checker reads when constant folding learned `--wrapping`;
  it passes both now and compares 308 whole programs.

  That last one uncovered a real bug. `self/dump_checked.ts` took any
  argument it did not recognise as the file name, so `--wrapping` became
  the path, the real path overwrote it, and the dump came out with the
  flag dropped — stage1 then rejected a fold stage0 accepted. It takes
  `--wrapping`, and refuses an unknown flag rather than turning it into a
  file name.

  One thing the check found and cannot fix is recorded as an open R1 row
  in wp19 §2A rather than exempted: on a program refused in a mode it was
  not written for, the two compilers report different *sets* of errors —
  stage0 poisons the declaration and cascades, stage1 recovers and reaches
  three further real errors. Every individual message agrees and both exit
  1; it is the recovery that differs, and the reject oracle compares each
  case against its own fragments rather than against stage0's list, so
  nothing here was going to see it.

  Docs carry the numbers they had drifted from: the oracle counts in
  selfhost.md and wp19 §2B, and the 53 modules and 6,559,260 bytes of IR
  the diverse-double-compiling equality holds over.

  1158 passed, 0 failed, 1 skipped (the WASI sysroot, environmental).

- **Write down the plan for true multithreading**

  The question "how does AmritScript do threads, like Go or Rust" has an
  answer the project's existing decisions force rather than leave open, so
  this records it as a design note before any code moves.

  1:1 OS threads with data races rejected at compile time, not goroutines.
  Green threads need a relocatable stack and that needs a precise GC, which
  is the budget WP6 already spent: an allocation site that does not outlive
  its function becomes an entry-block alloca, and a site in a loop reuses
  one slot, both on the argument that nothing outside the frame can name
  the object. Relocating the frame is what that argument does not survive.
  Separately, Go's posture -- a race is a bug a runtime detector finds --
  is unavailable to a compiler whose readnone/readonly/pointer-parameter
  attributes come from a fixpoint that assumes a single mutator, since a
  false attribute there is silent miscompilation, not a race report.

  The note prices the assets and the blocker. The assets are accidents of
  other decisions: no mutable global state exists in the language at all
  (top-level `let`, static fields and top-level statements are each
  rejected, and a module const emits no symbol), there are no closures so a
  thread entry can only be a named top-level function, and escape.ts plus
  the whole-program fixpoint already compute the shape of judgment a Send
  rule needs -- which is why the design reaches for a shareable-type rule
  instead of a trait system. The blocker is that the arena is one global
  and its bump is inlined into the emitted IR, a non-atomic load/add/store
  on @amrit_arena at every allocation site, so two threads allocating race
  in the IR rather than only in runtime.c.

  Five stages follow. T0, a thread-local arena and RNG behind --threads,
  has no language surface, is a prerequisite for every version of the
  design including the detached-thread ones the note defers, and is gated
  on BENCHMARKS.md rather than on argument. T3 waits for monomorphisation
  (WP15 item 8). Detached threads, wasm threads, atomics and a race
  detector are named as out of scope, with the reason for each.

  Nothing in the compiler changed.

- **Tell LLVM an array's header is not its elements**

  An array value is a `%struct.amrit_array*` to `{ i64 len, i64 cap, i8* data }`
  and `data` points somewhere else, but nothing in the IR said the two regions
  are disjoint. So LLVM had to assume `a[i] = v` might land on some array's
  `len` or `data`, and the consequence was not a missed peephole: the header was
  reloaded on *every iteration* of every loop that writes an element, because
  LICM may not hoist a load a store might clobber, and the vectoriser gave up
  behind it.

  Every load and store of a header field now carries `!alias.scope`/`!noalias`
  naming a "header" scope, and every load and store of element data the matching
  "elements" scope. On `dst[i] = src[i] * 2.0` over 8192 doubles, `--profile
  speed`, min of 7: 1227 ms -> 762 ms, a 1.61x with no language change, no flag
  and nothing observable altered.

  The proof is about bytes rather than allocations, which is what makes it hold
  for every shape at once: a header's three fields and the `cap * sizeof(T)` of
  element storage never overlap, whether they are two arena bumps, two
  entry-block allocas, the two bumps `amrit_alloc_array` makes for a host, or
  `amrit_argv_init`'s single malloc block whose elements begin after the header.
  The wasm runtime bumps the same way. Strings are deliberately left out — one
  block, length and bytes contiguous, no split to describe — and so are struct
  fields, for want of a measurement: annotating nbody's array headers moved it
  by nothing.

  Measuring this also corrected an attribution that wp9 had half-right. With the
  header hoisted, `--unchecked-indexing` on the same loop is worth 0.5%. The
  bounds checks were never what those loops paid for; they only looked expensive
  because the `len` they compare against was reloaded with everything else. That
  re-orders WP15's own sequencing, so §2b records it and §2c writes down what
  closing the remaining 2x needs (an invariant header, which wants either
  fixed-length array types or a whole-program "no push reaches this loop"
  analysis — `readonly T[]` is not enough, since another alias may still push).

  stage1 mirrors it and interns the five metadata nodes in stage0's order, so
  the bootstrap still reaches its fixed point byte for byte.

  `tests/cases/arr_alias_domains` pins the property a golden cannot express:
  after `opt -O2` no header load survives inside the loop. The check is on the
  loads rather than the GEPs, which hoist on their own — a first version that
  looked for the GEPs passed with the change stubbed out.

  1161 passed, 0 failed. 39 goldens grew the metadata; `--plain` emits none.

- **Fix the arena layout on wasm32: uint64_t, not size_t**

  `struct amrit_arena` spelled `off` and `cap` as `size_t`, which is the IR's
  `%struct.amrit_arena = type { i8*, i64, i64, i8* }` only where a pointer is
  eight bytes. Under wasm32 the C struct was 16 bytes with those fields at 4 and
  8, while the bump allocator every compiled function inlines (`inlineAllocator`
  in src/codegen/runtime.ts) bumped byte 8 and compared byte 16 — past the end of
  a global that was not that long.

  A program that allocates only strings survived, because runtime.c allocates
  those itself through its own consistent view of the struct. Anything that built
  an object or an array in compiled code got a pointer from nowhere, so the wasi
  profile trapped on the first `new` in a loop. The freestanding wasm profile was
  never affected: runtime_wasm.c had the rule right and wrote down why.

  runtime.c and amritc.h now use uint64_t for the same reason, and all three
  static-assert the offsets wherever they are compiled. `amrit_arena_grow` and
  `amrit_alloc_struct` take uint64_t too: their `size_t` parameter disagreed with
  the `i64` the IR passes on the same target, and the growth path now refuses a
  chunk larger than the host's `size_t` instead of asking malloc for its low half.

  The alloc-smoke check links for the host, so it could only ever prove the
  64-bit layout. tests/run.js compiles the header's layout assertions for the host
  and for wasm32 as well, with -fsyntax-only: no sysroot, no linker, so the guard
  runs wherever clang does.

- **Add web/: the compiler in a browser worker**

  self/ is an AmritScript program, so the compiler compiles itself to wasm like
  any other one: `--profile wasi` links it into a single 480 KB module (140 KB
  gzipped) that lexes, checks and emits LLVM IR with no server involved. web/ is
  what drives that module.

    wasi.mjs     A WASI preview1 host over an in-memory filesystem, with no
                 imports at all, so the same file runs in a page and under Node.
                 It answers the thirteen syscalls a wasi-libc build of runtime/
                 actually makes and ENOSYS for everything else, rather than
                 pretending: a compiler that silently read an empty file would be
                 worse than one that stops.
    worker.mjs   One compile per message, each in a fresh instance. The arena only
                 grows and proc_exit ends the instance that ran it, so the module
                 is compiled once and instantiated per request; a trap comes back
                 as exit 70 rather than as a dead worker.
    compile.mjs  A Node driver over node:worker_threads, so the browser path is
                 exercisable — and testable — without a browser.
    index.html   A playground: source on the left, IR or diagnostics on the right.

  tests/run.js builds the module and checks that the IR it emits for
  examples/add.ts is stage0's, byte for byte. It lives in the block that already
  skips when there is no WASI sysroot, and it doubles as the end-to-end guard on
  the arena ABI: the compiler allocates from compiled code on every node it
  parses, so a wasm32 layout that disagrees with the IR traps there before it
  prints anything.

  It stops at the IR by design. amritc emits textual LLVM IR and hands the rest to
  clang and wasm-ld, neither of which exists in a page, so --link and --profile
  report the toolchain failure WASI's spawnSync answers with, and --target host is
  refused because process.platform is `unknown` there.

- **Compute a double's shortest digits instead of searching for them**

  `String(x)` prints the fewest digits that read back as the same double, and
  the language promises that spelling. `amrit_str_from_f64` looked for the
  length by asking snprintf for k digits and strtod whether they round-trip,
  walking k up from 1. Two things were wrong with that.

  It was slow: up to seventeen format-and-parse round trips, 2,557 ns per
  number against 15 ns for the same value as an integer.

  It was also *wrong*, for about one value in twenty thousand. snprintf can
  only hand back the correctly-rounded k-digit string, and the shortest string
  that round-trips at length k need not be that one; when it was not, the
  search rejected k and moved on to k+1. So we printed
  7.1202363472230444e-307 where Node prints 7.120236347223045e-307 — and
  runtime/shim.mjs, which delegates to JavaScript's own String, disagreed with
  the native runtime it exists to twin.

  Ryu (Adams, PLDI 2018) computes the digits directly: 72 ns, a 35x speedup,
  and the shortest string by construction. Only digit generation moved; the
  ECMAScript layout around it — where the point goes, when to use e-form — is
  untouched, which kept the change to one function and its tables.

  Validated against the ECMAScript rule itself rather than against the code it
  replaces, which was just as well since that code was the buggy one: the
  digits round-trip, no shorter string round-trips, and no same-length string
  is closer. 20.9 million values — every finite exponent with boundary and
  random mantissas, the powers of ten and two, small integers and their
  reciprocals, uniform random bit patterns. Zero violations; the same harness
  finds 46 per 1.4 million in the old implementation.

  This costs binary size, and the size lands only on programs that use it.
  The two power-of-five tables are 9,888 bytes of read-only data, derived by
  scripts/gen-pow5-tables.py with exact integer arithmetic rather than
  transcribed, so they can be checked rather than trusted. runtime.c's .text
  goes 2,775 -> 3,852, still inside the 4 KB budget; its .rodata goes 32 ->
  9,920. Section GC keeps the tables out of any binary that never formats a
  double: bench/fib is unchanged at 5,600 bytes, bench/nbody goes 10,856 ->
  21,168. That is the largest size regression taken deliberately here, so
  wp15 section 7a records it and names the smaller-table variant that would
  trade a third of the speed back.

  One thing measuring this turned up on the side: scripts/size-report.sh
  reported the `text` column of `size`, which counts .rodata and the .eh_frame
  entries the size profile strips, while MASTER_PLAN section 2 defines the
  budget as the .text *section*. That row read 4,696 against a 4,096 budget
  while the section it names was at 2,775. It now reports .text against the
  budget and .rodata on a row of its own.

  1164 passed, 0 failed.

- **Add `getenv`: the environment, as a call**

  The last builtin the retirement gates named (wp19 §4), and the only shape
  the language has for the job. `process.platform`, `process.arch` and
  `process.argv` are member reads on a name fixed at compile time; an
  environment lookup is by a key that is a *value*, and member access on a
  dynamic key is exactly what Phase 0 refuses — nor is there an object type
  with arbitrary properties for `process.env` to be. So it is a function,
  named after C's rather than after Node's, because Node's spelling is the
  one that cannot exist here.

      getenv(name: string): string | null

  `string | null`, and a variable set to nothing (`FOO=`) is `""` and not
  `null`. That distinction is the whole reason the result is nullable
  rather than a string that happens to be empty when absent: `CC=` means
  something different from `CC` unset, and a driver is exactly the caller
  that has to tell them apart. The value is narrowed like any other
  nullable, so a program cannot read it without first saying what an unset
  variable means.

  The bytes are copied into the arena rather than borrowed from the
  environment, because a string here carries a length header the
  environment's does not, and because a later `setenv` from linked C may
  free what a previous `getenv` answered. That same possibility is why the
  declaration is not `readonly`: two reads of one variable in a function
  stay two calls. `noalias` (freshly allocated) but not `nonnull` (it may
  be unset), which is `amrit_read_file_or_null`'s shape.

  42 bytes of `.text` at -Oz, against the 4,096 budget. Deliberately not
  beside it: `setenv`. Reading the environment a process was given is a
  question with one answer; writing it mutates state shared with every
  library linked into the program, and nothing in the compiler needs it.

  What it closes is the *language* side of two gates rather than the
  gates. The `CC` pre-flight probe is a stage1 driver change and is still
  open. `AMRITC_DEBUG` turns out not to be closable by this builtin at
  all: a stack trace is the only thing that variable turns on, and a
  compiler with no exceptions has none to print whether it is set or not,
  so `self/ice.ts` says that once rather than branching to print two
  versions of the same "nothing here". Its note records that as a decision
  now instead of a limit.

  Two things came with it, both because a check refused to pass.

  `<name>.env` in the golden harness, beside `<name>.argv`: one entry per
  line, `KEY=value` to set (the value may be empty) and a bare `KEY` to
  unset, applied to the native run. A case that reads the environment
  cannot otherwise have a `.out` — the unset case is only reliable if the
  harness unsets it, and the empty case only exists if the harness sets
  it.

  And the argument-type message got words of its own. The suite pins how
  many distinct rejection messages carry no stable code, as a ratchet that
  may shrink and not grow, and a new builtin's argument-type message is a
  new distinct message: adding `getenv` pushed it from 8 to 9. The
  registry derives a code from the longest literal run between a message's
  interpolations, and `` `${name}` expects ${want}, got ${got} `` has none
  long enough to name a rule — that one template was eight of the nine.
  The check's own comment says the fix is to give the message words rather
  than to edit the table, so it reads `expects an argument of type string,
  got i32` now, which covers `readFileSync`, `mkdirSync`,
  `isDirectorySync`, `spawnSync`, `getenv`, `indexOf`, `f64ToBits`,
  `bitsToF64` and `Arena.release` at once. Coverage 230/239 (96.2%) ->
  238/239 (99.6%), the pin is now 1, the registry gained one rule
  (AS2268), and no existing number moved. The one still uncoded is
  `` Unknown base class `X` (...) ``, whose leading run is shorter than the
  parenthetical that states the rule.

  `io_getenv` is the round trip, `reject_getenv_arity`,
  `reject_getenv_type` and `reject_getenv_unchecked` the negatives,
  `builtin_getenv` the cookbook entry, and `runtime/shim.mjs` has it so
  WP13 runs the same program under Node — which it does, byte for byte.

  1164 passed, 0 failed, 1 skipped (the WASI sysroot, environmental).

- **Give a non-exported function a private ABI for a small Result**

  A `Result` with two small scalar payloads has travelled in one `i64` since
  WP17, because that is what a C or wasm host has to see. Between two functions
  of one module nobody is looking, and the word costs something real there:
  with the discriminant and the payload in a single register, the `select` that
  picks the live arm happens on the word, and instcombine can no longer fold
  the arithmetic around it. wp17 section 4 diagnosed this and named the fix; this
  is that fix.

  A function that gets `internal` linkage now takes and answers `{ i1, i32 }` —
  rustc's `ScalarPair`. `bench/result` goes from 650 ms to 464 ms against C's
  444, so the 1.46x behind C in that note is now 1.04x.

  The change is much smaller than the note expected, because of one
  measurement. Building the word exactly as before and splitting it at the call
  boundary measures 464 ms; a hand-written two-scalar lowering of the same
  program measures 467 ms. LLVM folds the round trip away entirely, so
  `packArm`, `packObject` and `unpackResult` stay as they are and this is a
  predicate plus a boundary conversion rather than a rewrite of the packing
  path. One packing path is worth more than the instructions the conversion
  appears to cost.

  The condition is the linkage condition — `strictExports && !exported`, the
  same test that writes `internal` — because the private shape is safe only
  while no host can name the symbol. The two must not drift, and the comment at
  each site says so. `--no-strict-exports` turns both off together. An imported
  function is exported by definition, so a cross-module call is always packed
  and two modules agree without consulting each other; `--emit-header`,
  `--emit-dts` and `--emit-napi` describe exported functions only, and
  `tests/cases/res_export` still emits `i64` for all four of its shapes.

  `dbg_result` moved too, and in the right direction: a `dbg.value` operand has
  to carry the parameter's actual type, so it now names the pair, while the
  `DILocalVariable` still describes the source-level `Result`.

  1164 passed, 0 failed; the bootstrap still reaches its fixed point, so stage1
  emits the new ABI byte for byte with stage0.

- **Search a string in the runtime instead of a probe per offset**

  `s.indexOf(sub)` was a loop over `amrit_str_at`, one probe per byte offset,
  emitted at every call site so that `runtime.c` stayed inside its size budget.
  That made the idiomatic string search a byte-at-a-time scan: 53.7 ms over 52 MB
  of haystack. WP15 section 7's rule is that the budget yields to a measured win,
  and this is one — `amrit_str_index_of` uses `memchr` to find a candidate first
  byte and `memcmp` to confirm it, both the libc's vectorised routines, for
  2.9 ms, or 3.1 ms when the needle starts with a byte the haystack is full of.
  About 17x either way.

  It also *shrinks* the caller: thirty lines of loop become one call. The
  runtime's `.text` goes from 3,852 to 4,002 bytes against the 4 KB budget of
  MASTER_PLAN section 2, which is inside it but with little left.

  `memmem` would be 2.5 ms and was written, then taken out. It is a GNU
  extension glibc hides behind `_GNU_SOURCE`, and defining that macro makes
  `<string.h>` include `<strings.h>` — which any `-I` directory holding a file
  of that name then shadows. This project generates exactly such a header from
  `examples/strings.ts`, and the interop tests caught it at once: runtime.c
  picked up the generated `strings.h`, inherited `amritc.h` through it, and
  failed with four redefinitions. A C host pointing `-I` at its own generated
  headers would hit the same. A fifth of the time is not worth making the
  runtime sensitive to its includer's include path, so there is one path and no
  second one to rot.

  The semantics are the loop's: an empty needle answers 0, a needle longer than
  the haystack -1, and the offset is in bytes. Eleven cases in runtime_test.c
  pin those edges, the repeated-first-byte shape the scan walks, and a UTF-8
  offset.

  Also regenerates docs/BENCHMARKS.md for the three changes that came before it.
  Read it within a row, not against the committed table: this machine ran faster
  throughout (C's fib 369 -> 330), so only the columns beside each other are
  comparable. `result` is 464 against C's 444, where it was 1.46x behind; the
  binary-size column shows the Ryu tables landing only on the three benchmarks
  that print a double, with fib, sieve, strbuild and result unchanged.

  And it corrects wp9's arena-provenance note. That section reports nbody -6%
  from making the allocator `noinline` so its `noalias` return survives. On
  today's compiler the same edit measures 1467 ms against 1479 — noise, and
  slightly the wrong way. WP6's stack allocation took the objects it was
  recovering and vec3 now beats C without it, so the trade buys nothing and is
  not being made. nbody's remaining gap is unexplained by any theory in either
  note, which is now what they say.

  1164 passed, 0 failed.

- **Add a Go column to the benchmark suite**

  The suite compared AmritScript against C and Rust; there was no Go twin of
  any program, so "how do we do against Go" had no answer to give. Add one
  `.go` per benchmark and a Go column to the runner, under the rules the other
  twins already follow.

  The Go versions are transliterations, not idiomatic rewrites: the same loops,
  the same temporaries, the same left-to-right evaluation. Slice indexing keeps
  its bounds checks (no `-gcflags=-B`), objects are heap allocated (`&T{...}`)
  as they are in C, Rust and the AmritScript arena, and the collector runs at
  its default GOGC. `go build` has one optimisation level, so Go gets one
  column rather than the plain/native pair Rust gets.

  Two places where Go needed care to print the same checksum:

  - Untyped Go constants fold in arbitrary precision and round once, where C,
    Rust and AmritScript round every step to f64. In nbody that put SOLAR_MASS
    one ULP out and moved the final energy of a chaotic system in the eleventh
    digit, inside the runner's 1e-9 tolerance but not the bit-for-bit agreement
    the suite is built on. nbody.go spells those constants as typed variables.
  - Go has no Result type, so result.go uses the same two-word struct as
    result.c -- the one --emit-header declares for Result<number, number> --
    which Go's register ABI passes and returns in registers, as Go's own
    (value, ok) pair of results would be.

  The runner gains --no-go, a GO override and the /usr/local/go/bin lookup,
  an `AmritScript / Go` ratio column beside the Rust one, and Go rows in the
  size and memory tables. The --help banner now ends at the first non-comment
  line instead of a hardcoded line count, which had to be edited by hand
  whenever an option was added and was wrong the first time here.

- **Regenerate the benchmark report with the Go column**

  Records the Go rows in the wall-time, size and memory tables, and the
  CHANGELOG line for the column. The run is on a 2.10 GHz Xeon, not the
  2.80 GHz machine the previous report was measured on, so only the ratios
  within this run compare to the ones within that one.

- **Record the clean benchmark run, and what the machine's noise hides**

  The previous report was timed while this session was running git commands
  against the same container, and its ratios are not reproducible: a second
  back-to-back run of the same binaries moves fib from 1.01x to 0.83x against
  Rust, nbody from 1.24x to 1.03x, spectral from 1.09x to 0.86x and vec3 from
  0.94x to 1.10x. Replace it with a run that had the machine to itself.

  The wider point belongs in the WP9 note rather than in a regenerated table,
  so record it there: on a shared virtual machine this suite resolves a gap the
  size of result's and does not resolve the difference between 0.95x and 1.15x.
  Three rows held across both runs -- sieve about 0.82x, strbuild about 0.96x,
  and result about 2.8x -- and nbody's 1.24x "miss" was noise.

  Also note what the Go column says: AmritScript is ahead of Go on six of the
  seven programs and behind on result alone, which is the same program the Rust
  column singles out.

- **Close WP19 §A2's parity differences, and the dump behind 193 of them**

  `--parity`'s first run found five ways the two compilers disagree about a
  program; four were open. All five are closed here, along with three more
  of the same family that fixing them turned up, and the `--emit-checked`
  row that accounts for 193 of the 206 reported differences.

  The miscompile first. A fixed-length stack array types its slot
  `[n x T]`, and both emitters got `n` by parsing back the IR operand they
  had just emitted for the length. Under `--number-mode f64` that operand
  is a register, because the literal has been through a conversion: stage0
  parsed it to NaN and wrote `alloca [NaN x float]`, IR that `llvm-as`
  refuses from a compile that exited 0, and stage1 parsed it to 0 and
  wrote `alloca [0 x float]`, which assembles and then stores two floats
  past a zero-element slot. Both now read the length from the literal,
  through the one `literalLength` the escape analysis already used to
  decide the site was stackable, so the two answers cannot differ; a stack
  site whose length is not a literal is an internal error rather than a
  silent zero. It lives in `emit/arrays.ts` on both sides because
  `escape.ts` already imports that module, and the reverse import closes
  an ESM cycle that surfaces as a dispatch table read before its
  initializer.

  Then five refusals stage1 did not make. They are one design difference
  seen from five directions: stage0 decides a contextual type by walking
  up from the literal through three functions with enumerated positions,
  and stage1 threads a single `want` down, because AmritScript-0 has no
  parent pointers. One channel where stage0 has three is more permissive
  by construction, and every difference is stage1 handing `want` to a
  position stage0's walk does not name — a `Result` payload, an object
  literal's property value (for a numeric literal or `[]`, never for a
  nested literal or a `null`), and a binary operator's operands. Two of
  them, `{ b: 255 }` for a `u8` field and `const b: u8 = 1 + 2`, compiled
  in the default mode with no flag involved. A compound arithmetic
  assignment was routed through the binary operator's rule as well, which
  lost the `=` from the message and let `s += "b"` through; stage0 has one
  numeric-only rule for the construct and stage1 has it now, for a local,
  a field and an element alike.

  `--emit-checked` prints the attribute pass's facts in stage1 too:
  `self/compilation.ts` grew stage0's memoised `analyze()` and
  `self/dump.ts` grew `factsText` in stage0's format, so
  `checked_oracle.js`'s `LATER_PHASES` filter is deleted and all 314
  programs agree over 297,074 dump lines with nothing filtered out. The
  new lines caught a regression on their first run: the compound
  assignment rewrite had stopped recording the target's type, which
  `collectDivisionFacts` reads to know that `x /= k` can reach
  `amrit_panic_div`, so stage1 called a trapping function `readnone` and
  `willreturn`. Wrong facts are wrong attributes, which is the class of
  bug a golden `.ll` is worst at catching.

  `Field \`code\` of \`IoError\` is i32, got f64` is now `... expects a
  value of type i32, got f64`: the message was assembled entirely out of
  interpolations and had no literal run for the code generator to key on,
  so the new cases would have grown the uncoded backlog instead of AS2269.

  Seven cases: `arr_stack_f64` pins the IR and runs it, and six
  `reject_*`s pin the refusals on both compilers.

- **Write down what --parity says over the corpus it defaults to**

  The previous commit closed §A2's rows and left one sentence standing:
  that what remains for R1 is running `--parity` to an empty difference
  set. Running it says otherwise, and the number is worth having written
  down before someone plans around the old one.

  §A2 measured `tests/cases` — 172 programs, 2,408 runs. The mode's own
  default is the whole corpus `tests/self/corpus.js` enumerates: 593
  programs, 8,302 runs, and 13,800 undeclared differences with everything
  in §A2 fixed. §A3 breaks that into five classes with counts. None is a
  wrong-code bug. Three are decided rather than broken and want a
  declaration — a path inside the IR (12,209 rows: the declaration
  `--emit-checked`'s header already carries, at `ModuleID` and `DIFile`
  too), a parser refusal that beats Phase 0 to the rule (602, by design and
  counted apart by `reject_oracle.js`), and one wording where stage1's
  message is the better of the two. Two want code: `--emit-ast` exits 0 on
  a program Phase 0 refuses because stage1 dumps without validating, and
  error recovery, which is the structural one — stage0 throws out of a
  construct and stage1 threads an error value and carries on.

  That last class is also what §A2's "the first diagnostic differs" row
  really was. The first diagnostic is the same on both sides and always
  was; stage1 reports one more after it. Reading only line 1 is what made
  that row look closed in the previous commit, and the row is corrected
  rather than deleted, because how it was misread is the useful part.

  The oracles cannot see any of this: they hand both compilers the same
  relative path and the flags each program already carries.

- **Close three of A3's five classes: paths in the IR, --emit-ast, unary `+`**

  **A path inside the IR (12,209 of the 13,800 rows).** An imported module
  carried a cwd-relative name in stage0 and the absolute path it was
  resolved to in stage1, so `ModuleID`, `source_filename` and `-g`'s
  `DIFile` disagreed on every multi-module program compiled by absolute
  path — which is how a build system compiles one.

  stage0 now names an imported module the way stage1 always has: the
  specifier resolved against **the name the importer was given**
  (`importedName`), not against `process.cwd()`. Named relatively, as
  every caller in this repository names it, the answer is unchanged and no
  golden moves. Named absolutely, the two compilers now write the same
  bytes: the whole of `self/` compiles to byte-identical IR through either
  compiler, by either spelling of the entry path.

  The rule that needed no cwd was also the only one available. stage1 has
  no working directory by design (WP14 §3a D4) and cannot grow one for
  this: `runtime.c` is 4,088 bytes of `.text` against a 4,096 budget, eight
  bytes of headroom, and `getcwd` does not fit in eight bytes. Removing the
  dependence on where the compiler was run from is the better rule anyway
  — it is what makes the IR reproducible — so this is parity bought by
  improving the frozen compiler rather than by declaring a difference away.
  `tests/run.js` pins it on `link/diamond` compiled by absolute path,
  because a golden cannot: goldens strip the module header.

  **`--emit-ast` on a program Phase 0 refuses (40 rows).** stage0 validates
  before it dumps, prints the refusal and exits 1; stage1 dumped the tree
  it had parsed and exited 0, because `load` reports a Phase 0 refusal into
  the sink and answers true anyway. A dump flag does not turn a refused
  program into a compiling one. `tests/cases/dump_ast_reject`.

  **Unary `+` (13 rows).** Two messages for one refusal: stage0's said only
  that the operator was unsupported, stage1's said why — `+x` converts, and
  this language has no conversions. The better sentence wins and stage0
  takes it, as a `PlusToken` entry in the unary dispatch table rather than
  the table's fallback. `tests/cases/reject_unary_plus` pins it on both.

  Left: the parser refusing before Phase 0 names the rule (602), and error
  recovery after the first diagnostic (~950).

- **Write down the plan for packages**

  Two questions arrived together — what an extra `exports` condition beside
  `import` and `require` would look like, and how one AmritScript package
  should depend on another — and docs/wp21-packages.md separates them.

  A foreign host (JavaScript on Node, in a browser, or C) takes a built
  artifact across the ABI, which WP8 already generates. Another AmritScript
  program takes source, compiled into its own whole program, because a
  prebuilt library cannot carry the exporter's attribute set into the
  importer's `declare` (WP5), cannot hold a generic nobody has instantiated
  yet (WP18), and would have to exist once per number mode, target and
  profile. So an artifact is a cache for an AmritScript consumer, never a
  distribution format, and an `exports` map states one condition per kind of
  consumer.

  The blocker is the flat symbol namespace: two modules defining the same
  non-exported name is already an error, deliberately not waivable by the
  linkage flag, because the whole-program fact fixpoint is keyed by symbol
  name. Two packages with a private helper() each would not compile
  together. Package-scoped symbols are stage one of five.

  Nothing here is implemented; several sections are marked as sketches.

- **Say how a package declares itself AmritScript**

  The plan named a manifest and left it at "one key in package.json". WP21
  section 6 now answers it: the `amrit` export condition is the declaration —
  its presence is the claim, its value is the entry module, and its absence is
  what turns a bare import of an ordinary npm package into "no AmritScript
  entry point" rather than a module-not-found.

  A condition maps to a path, so three things sit beside it: the number mode,
  a compiler version floor in `engines.amritc`, and the runtime capabilities
  the package needs. The mode earns its place — an f64 package compiled in i32
  mode often fails loudly on a `1.5` literal, but `a / b` compiles under both
  modes and truncates under one.

  Those three are generated rather than declared: `--emit-manifest` reports
  what the checked program requires, as a fourth interop sidecar beside
  --emit-header, --emit-dts and --emit-napi, on the same rule that governs
  attributes. Nothing here is a trust boundary — the consumer's build
  re-establishes the property from source and the compiler is the verifier —
  so the manifest is there to make a failure arrive early and legibly, which
  is also why a compile error inside a dependency must not look like one in
  your own program.

- **Close A3's last two classes: error recovery, and the parser's refusals**

  **Error recovery (~950 rows).** Both compilers recover per statement —
  `checkStatements` wraps each one in a `try` in stage0 — but its `throw`
  abandons the rest of the statement it came from, and stage1 carried on
  through it. One bad type became a paragraph of consequences where stage0
  reported the cause: over a module written for i32 mode and compiled with
  `--number-mode f64`, twenty diagnostics and twenty different ones.

  `errored` in `self/context.ts` is that throw in a language with none. It
  is set by `error`, cleared at the start of each statement, and consulted
  where the unwind would have gone: `checkStatement` and `checkExpression`
  stop, and `error` itself drops later reports, which is what makes it
  complete — a check that reports without going through either of those,
  like the `switch` clause rules, would otherwise keep talking about a
  statement stage0 had left. A list *inside* a refused statement is not
  entered (a `switch` abandoned at its discriminant does not go on to
  refuse its `case` labels); a list that runs to the end clears the flag,
  so the `else` of an `if` whose `then` failed is still checked. And a
  rejected initializer leaves its variable undeclared unless the annotation
  says what it is, which is what makes `const at = m.get(k, -1)` report
  `Unknown identifier` at each later use on both sides.

  Measuring that turned up four more contextual-type divergences of the
  same family as the ones already fixed — stage1 handing its single `want`
  to a position stage0's walk does not name — and one message:

    - a method's argument, where the table says a *function* and a
      constructor (`reject_method_arg_literal`); `super`'s too;
    - `push` and `indexOf` through a field, where stage0 reaches the
      element type by a callee name `b.xs.push` does not have
      (`reject_push_field_literal`);
    - the other operand of a binary operator when it is not a shape stage0
      can peek at, so `0xc0 | (cp >> 6)` in f64 mode is an f64 meeting an
      i32 — `peekable` in `self/expressions.ts` is that list;
    - the caret on a nullable member access, which belongs under the
      property name;
    - and an unknown dotted call is now `` Unknown builtin `foo.bar`
      (supported: …) `` on both sides, naming the callee and listing what
      there is, rather than four shorter sentences and an
      `Unknown identifier` for the receiver.

  None of those was reported by anything: a compiler that reports every
  consequence of a mistake buries the ones that are its own.

  **The parser's refusals (602 rows), declared.** `var x = 1` stops at
  stage1's parser with `` expected `;` `` where stage0 parses it with the
  `typescript` package and refuses it in Phase 0 by name. That is the habit
  `.claude/selfhost.md` states — lex and parse what is written, refuse in
  the phase that owns the rule — and closing it in code means grammar for
  43 constructs the language forbids, which is a parser rewrite rather than
  a fix. The declaration is narrow: it applies only when stage1's first
  diagnostic is a syntax error *and* stage0 refuses the same file, it
  covers stderr alone, and exit status, stdout and every file written are
  still compared byte for byte. stage0 accepting a program stage1 refuses
  is a failure, not this. `parity.js` grew two things for it — a
  declaration with no flag, which applies to every invocation, and one
  asked about both texts together, because here the *shape* is what is
  decided rather than the bytes.

- **Put the number mode in the condition and drop the manifest**

  The previous section 6 answered "how does a package say it is AmritScript"
  with a generated sidecar. It was over-built: a fact the compiler can
  recompute is not metadata, and only the number mode has to be known before
  the compiler can look, because it selects which source file resolution
  returns.

  So the mode rides in the condition by spelling — `amrit-f64`, `amrit-i32`,
  or plain `amrit` for a package correct under either — and `--number-mode
  f64` asks for ["amrit-f64", "amrit"]. A mismatch becomes a resolution
  failure at the package boundary, before a byte of the dependency is
  checked, with no new file format to keep in sync.

  The mode earns the mechanism where the other candidates do not. Measured:
  `(a + b) / 2` answers 3 for mean(3, 4) in i32 mode and 3.5 in f64, cleanly
  under both, because `/` truncates. Most f64-flavoured code fails loudly
  instead — `Math.sqrt` on a `number` in i32 mode names the fix in its own
  message, a `1.5` literal is rejected — so the silent window is division and
  what is built on it. Narrow, not empty.

  Runtime capabilities need no declaration: the compiler knows the target and
  which builtins the whole program touches, so a builtin the target cannot run
  is a whole-program diagnostic. A version floor goes in `engines.amritc`.
  That leaves --emit-manifest with nothing to carry, and S3 is now messages
  rather than an artifact.

- **Align the diagnostics themselves: spans, wordings, and two stage0 bugs**

  Closing A3's five classes took the corpus from 13,800 undeclared
  differences to 503, and what was underneath was a long tail of
  diagnostics that say the same thing differently. None of it was
  reachable before: the parser and path classes were 94% of the rows and
  buried the rest.

  **Where the caret goes.** A diagnostic about a member access belongs on
  the property name, which is the node stage0 hands to the error, and
  stage1 was pointing at the whole access — one column early on `Unknown
  field`, `Unknown property`, `Unknown method`, `join`, and every `Result`
  read. `CheckContext.errorAtProperty` is that anchor; the member's name is
  `text` on the node here rather than a node of its own, so the span is the
  tail of the access. Four more had their own answers: `process.argv` is
  read-only points *through* the parentheses, `main` cannot take parameters
  points at the first parameter, a negative literal covers its sign, and
  the two import diagnostics point at the module specifier —
  `errorAtSpecifier` recovers that span from the source, because giving the
  specifier a node of its own would change the layout `nodes.ts`
  documents, the `--emit-ast` golden and the parser oracle's translation,
  all to move a caret.

  **What the words are.** Six messages differed in their tails, in both
  directions, and each was resolved on which one is better rather than on
  which compiler said it. stage1 gained the parentheticals it was missing
  (union types have one fixed layout, a condition has no truthiness to
  fall back on, `process.argv` needs an entry point, `bigint` names the
  types to use instead) and one sentence it had truncated. It kept its own
  where it was the better one, and **stage0 took two fixes**: `` a `Result`
  is immutable once built (return a new `ok(...)` or `err(...)`) `` named
  constructors that do not exist — they are `Ok` and `Err` — and the array
  `length` rule was unreachable dead code, because `rejectLengthAssignment`
  wraps the `=` handler that the class checker has already replaced, so the
  message `docs/LANGUAGE.md` documents had never once been printed.

  **Recovery outside a statement.** `errored` is cleared per statement, and
  pass 1 has no statements: a constant or a class is a recovery point of
  its own there, as `sink.recover` makes it in stage0. Two cycles now
  report once per constant and the fold unwinds without marking anything
  folded, which is what stage0's `catch` does deliberately ("let a second
  reference report the same error rather than a stale `folding`").

  **One difference is declared rather than fixed, and the reason is
  worth reading.** stage0 reports an inheritance cycle once per class
  because its throw leaves `collected = "collecting"` behind and the next
  class finds the stale marker. Reproducing that by hand — returning early
  with `collecting` still set — makes stage1 *loop*, since `resolveBase`
  collects the base recursively and the pair re-enter each other. A caret
  is not worth an infinite loop in the compiler.

  `--emit-ast`'s refusal is narrowed to Phase 0's own diagnostics, which is
  what the flag answers from: a pass 1 error is one stage0 never reached,
  and refusing on it made stage1 exit 1 where stage0 dumps.

- **Stop Phase 0 where stage0 stops, and declare the dump's parser refusal**

  **A Phase 0 refusal ends the compilation.** stage0's validator `fail`s
  by throwing out of `load`, so one `any` is one diagnostic and pass 1
  never runs. stage1 reported it into the sink and carried on, so the
  annotation resolver refused the same `any` a second time from the same
  column. `load` answers false for a module Phase 0 refused now, which is
  also what `--emit-ast` needed: the flag's own check goes away, because a
  validated module is the only kind that reaches it.

  **An unresolved annotation is not an annotation.** `const head: Entry =
  ...` where `Entry` does not resolve leaves the variable undeclared, so
  its later uses are `Unknown identifier` — stage0 declares one only from
  an annotation it actually has, and a `T_ERROR` is not one
  (`tests/link/reachable_struct_annotation`).

  **The parser's refusal, on the surfaces a dump flag reaches.** Under
  `--emit-ast` a program stage1's grammar cannot read has no tree to print,
  so it exits 1 and says why; stage0 parses it with the `typescript`
  package, which recovers, dumps a tree and exits 0 in silence. Same
  decided difference as the stderr declaration, so the same declaration
  covers it — narrowly: the exit half only when stage1's own first
  diagnostic is that syntax error and only in the 0-to-1 direction, and the
  stderr half only when the flags say a dump is what was asked for.
  `parity.js` hands a declaration the whole run for it, because a
  difference on one surface can be decided by what happened on another.

- **Measure what the number mode costs, and use a real program in WP21**

  The FAQ has claimed `i32` is "one machine word, exact, vectorisable" since
  WP11 with no number beside it. wp9-optimisation.md now has them, measured
  the way bench/run.mjs measures — 3 warm-up, 15 timed, min and median, speed
  profile — with the commands spelled out, because bench/run.mjs has no mode
  axis and this is a one-off rather than a generated table.

  Recompiling the same program under --number-mode f64 costs 1.36x on fib,
  1.80x on sieve, 1.52x on strbuild and 3.42x on an array reduction, rising to
  14.3x when the array is cache-resident, so the gap is not memory traffic.
  Three mechanisms, each visible in the IR: every subscript pays an fptosi
  (five in sieve, none in i32), induction variables lose `nsw` and with it the
  widening and strength reduction, and a reduction cannot be reassociated — the
  i32 binary carries 13 paddd where the f64 one carries 11 addsd on a serial
  dependency chain. Binary size is a flat +12.2 KB, the shortest-digits
  formatter that console.log of a double links, which also accounts for the
  size column of BENCHMARKS.md.

  Two of the four i32 benchmarks do not survive recompilation, and that is the
  other half. result.ts does not compile (`&` needs integer operands, and says
  so). strbuild.ts compiles, runs, exits 0 and prints 2410293 where i32 prints
  806394, because `const step = (count + 31) / 32; // ceil(count / 32)` has a
  comment that holds only where `/` truncates. It replaces the invented
  example in WP21 section 6: a program already in the tree makes the case for
  a visible number mode at a package boundary better than one written for it.

- **Stop where stage0 stops: pass 1, and the imports it never loads**

  Three differences, all one shape — stage1 kept working where stage0's
  throw had ended the compilation, and said things stage0 never reached.

  **A module whose pass 1 reported anything does not load its imports.** A
  duplicate function in the entry hides everything an imported module would
  have said, because that module is never read. `tests/link/main_in_import`
  is the case that shows it: in f64 mode the entry's own `main` is the
  refusal, and stage1 went on to load `lib.ts` and report the `main` it
  declares there as a second entry point.

  **The tilde carries the same hint the binary operators do.** An `f64`
  operand under `--number-mode f64` is the mode's `number` rather than a
  deliberate annotation, and `` Operator `~` requires an integer operand ``
  now says so on both sides.

  **A missing module is named from the importer**, as `importedName` names
  one that is found. A diagnostic about a file that is not there should not
  depend on the directory the compiler was run from any more than the IR
  does; `displayName` has no callers left in `src/compilation.ts` and is
  gone.

- **Correct the pass-1 stop: resolve the imports, do not load them**

  The previous commit stopped a module's imports from loading when its
  pass 1 reported anything, and took the gate from 28 undeclared
  differences to 53. Two things were wrong with it.

  **A missing module is still reported.** stage0 resolves every specifier
  either way — that is where "cannot find module" comes from — and only
  the modules that *exist* go unloaded. `tests/link/missing_module` in f64
  mode lost its diagnostic to the earlier rule and has it back.

  **`--emit-ast` is exempt.** The flag prints the tree of every module it
  managed to read, and stage0 reaches that dump before it looks at anything
  pass 1 recorded, so a pass 1 refusal must not stop the load there. It
  cost five programs their dump and their exit status. Phase 0 still stops
  it on both sides: stage0's validator throws, and a program it refuses
  prints no tree anywhere.

  The rule that survives both is narrow and observable: a module whose
  pass 1 refused something resolves its specifiers and loads none of them,
  unless the tree is what was asked for.

- **Record R1 closed: the parity gate is green over the whole corpus**

  parity: 8358 runs over 597 programs; 0 undeclared difference(s),
              1523 declared

  Every program the suite has, through both compilers, under each of the
  fourteen flag variations. Every diagnostic, every span, every byte of IR,
  every sidecar and every exit code is identical.

  Five declarations stand and §A4 lists them with their counts: the parser
  refusing syntax the language forbids before Phase 0 names the rule (602),
  each compiler's own `--emit-ast` tree (548), the `module <path>` header
  line (349), the inheritance cycle stage0 reports once per class (13), and
  the exit status the parser refusal reaches under a dump flag (11).

  The trajectory is in §A4 too, including the step that went backwards, at
  28 undeclared, on a rule about stage0 that two experiments supported and
  a third would have refuted. The mode caught that as well, which is the
  argument for having built it.

- **Write down the casing rules, and why they are not linted**

  The style guide had a Naming Conventions section that covered suffixes and
  basic-block names but never stated the base convention, and biome.json has
  no useNamingConvention rule, so camelCase held only by habit. Say it:
  camelCase for values, PascalCase for types, CONSTANT_CASE for the frozen
  module tables, acronyms keeping their own case (IRBlock, compileToIR), and
  file names as the one exception Biome does enforce.

  Record the three classes of name that are exempt because the spelling is
  the meaning: a table key that names a JavaScript global is the identifier
  being matched (Function, Proxy, Int32Array, parseInt), a name crossing an
  ABI keeps the ABI's spelling (amrit_*, WASI's fd_write, x86_64Layout), and
  a ported benchmark keeps its source program's constants (SOLAR_MASS).

  Also record the measurement behind leaving the rule off: useNamingConvention
  flags 82 places with strictCase on and 70 with it off, and every one falls
  in those three classes, so the rule would be all false positives.

- **Regenerate the diagnostic-code registry, and fix a lint error**

  Two CI failures, both mine, and both from the same gap: the messages this
  branch changed in `src/` landed after its last full `npm test`, so the
  registry generated from those messages went stale and nothing local said
  so.

  `` a `Result` is immutable once built (return a new `Ok(...)`…) `` and
  `` Unary `+` is forbidden; it converts… `` are AS2270 and AS2271. They
  were also the two uncoded messages the coverage check counted: the
  generator derives a rule from a message's longest literal run, and both
  of those rewordings gave it one to key on, so the backlog is back to its
  pinned 1.

  The lint error is `useExplicitLengthCheck` in the declaration added for
  the inheritance cycle: `one.length >= 1` is `one.length > 0`.

- **Write down the plan for arrow functions**

  Arrow functions become how AmritScript declares a function and `function`
  becomes legacy. The note's first job is to establish that this cannot
  change the output of any program: the emitter iterates checked FunctionSigs
  and there is no isFunctionDeclaration anywhere in src/codegen, so the
  declaration form is erased before codegen begins. The golden .ll files are
  therefore the migration's oracle rather than work it creates.

  Runtime cost is nil on both sides. Under Node, 2e9 calls at a monomorphic
  call site measured 1475.6/1494.9/1495.2 ms for declarations against
  1510.1/1486.1/1486.3 ms for arrows. A first attempt said 7.6x and was wrong
  in a way worth recording: it passed both forms through one bench(f) helper,
  so the second made the call site polymorphic and deoptimised it, and the
  declaration then measured 10.5 s too. The cost in JavaScript is an indirect
  call site with more than one callee, which the Function prohibition already
  rules out.

  Two checker rules accept an arrow without admitting function values: a
  module-level const whose initializer is an arrow is a function declaration
  and takes its signature from the arrow's own annotations, and a name bound
  to a function may appear only in call position. Class methods stay methods.
  The concise body is the one new shape, and needs one desugaring at the ~40
  sites reaching sig.decl.body, since FunctionSig.decl is already a three-way
  union.

  The bootstrap forces the order: both compilers must accept arrows before
  self/ can be migrated, and self/ must be arrows before function can be
  rejected. Four stages, with the last two recommended incrementally rather
  than as a flag day: 603 declarations in self/ and 798 across the corpus.

- **Audit what removing `function` would foreclose**

  The four stages were written as if the last one were free. It is the only
  one that removes a spelling, so it is the only one that can cost something
  later, and three constructs have no arrow form at all.

  An arrow cannot be a generator: `const g = *() => {}` is a TypeScript syntax
  error, and the language has no arrow-generator syntax to reach for. That
  turns out to be safe rather than fatal, because `function*` and `yield` are
  already Phase 0 errors with a stated reason, so the stage keeps a forbid
  instead of blocking a plan, and a generator method stays reachable if a
  coroutine runtime ever arrives, since class methods survive.

  Overload signatures and `declare function` also have no arrow spelling, both
  needing the function types Phase 0 forbids. The second is the live one:
  `declare function` is refused as not supported yet rather than forbidden,
  and declaring an external C function is the first thing wanted when binding
  a library. So the stage is narrowed to reject a function definition, and
  `declare function` — which defines nothing — stays legal.

  Generic functions need no rescue, `const f = <T>(x: T): T => x` parses in a
  .ts file, but every example in the generics note is written with the keyword,
  so that surface is restated alongside the rest of the docs.

- **Declare functions with an arrow, in stage0**

  A module-level `const` whose initialiser is an arrow declares a function
  rather than a value: `const double = (n: i32): i32 => n * 2`. The signature
  comes from the arrow's own annotations, so nothing here needs the function
  type Phase 0 forbids, and the `function` keyword keeps declaring the same
  thing as the legacy spelling.

  The two spellings emit byte-identical IR. That is structural rather than
  lucky — the emitter iterates checked FunctionSigs and never looks at the
  declaration's syntax kind — and it is what makes the migration ahead
  verifiable, since a rewritten program whose golden moves by a byte is a
  wrong rewrite.

  FunctionSig gains a normalised `body`, a Block or the concise expression,
  and a `nameNode`, because an arrow has no name of its own and a diagnostic
  that names the function has to point at the const's identifier. Four places
  walk a body and now branch on ts.isBlock; the concise body shares the
  return path with `return` itself, in the checker through checkReturnValue
  and in the emitter through emitReturnValue, so the instructions cannot
  drift between the two forms.

  A function is still not a value in either spelling: the arrow form
  registers in the function table and never in program.constants, which is
  what already makes `const alias = double` an unknown identifier.

  The positive golden waits for stage B, and finding out why corrected the
  plan: every program in tests/cases is compiled by both compilers, so an
  arrow program there fails the IR oracle with `1 rejected by stage1` until
  stage1 parses arrows too. The rejection cases ship now, because stage1's
  parser refuses them and the reject oracle already tolerates that.

- **Read arrow functions in stage1 too**

  Both compilers now take `const double = (n: i32): i32 => n * 2`, so
  tests/cases/fn_arrow ships with the golden .ll, the llvm-as pass and the
  native round trip stage A could not carry: IR(stage0, p) == IR(stage1, p)
  byte for byte over it, concise body and recursion included.

  One piece of the parser was real work. A parenthesis opens a parameter list
  and a parenthesised expression alike, and self/parser.ts keeps one token of
  lookahead, so `const x = (a + b) * c` and `const f = (a: i32): i32 => a`
  cannot be told apart at the `(`. A scratch Lexer runs ahead over the same
  source from the `const`, counts to the parenthesis that closes this one and
  looks at what follows: `=>`, or the `:` of a return type. That is exact
  rather than heuristic, because nothing else can follow a parameter list and
  nothing else puts a `:` after a parenthesis at the head of an initialiser.

  Everything downstream was free, because the parser normalises to the same
  N_FUNCTION node the keyword builds: stage1's checker, emitter, attribute
  pass and escape analysis are untouched for block bodies. The parser oracle
  normalises the same way and says so, being the one place it reshapes a
  typescript tree rather than transcribing it.

  The concise body cost four branches mirroring stage0's, and the oracles
  caught the one they missed: self/dump.ts guarded its body walk on N_BLOCK,
  so a call inside a concise body never reached --emit-checked while stage0
  printed it. The callee table was never wrong -- walkBody prints it, it does
  not build it -- but the guard was, and walkBody had always taken any node.

  The harness was the other surprise. tests/run.js decided whether a case is
  a whole program by matching /\bexport\s+function\s+main\b/ against the
  source, and the two differential harnesses did the same, so an arrow entry
  point linked against tests/driver.c and failed on a duplicate main. Three
  regexes, each now taking either spelling, and a preview of what the corpus
  migration will keep finding: the tooling that reads the language with a
  regex rather than a parser.

- **Give the arrow cookbook entry its snippet**

  docs/cookbook/regen.sh compiles every docs/cookbook/<name>.ts and rewrites
  the block between that name's markers in IR_COOKBOOK.md, so a marker with
  no snippet is an error it reports rather than a block it leaves alone. The
  arrow entry was written by hand with the IR beside it and no source file,
  which `npm test` does not look at -- CI runs the check as its own step, and
  that is what caught it.

  The generated block is byte for byte what was there, so the doc does not
  move: the snippet is the only thing that was missing.

- **Add WP23, the plan of record for the loose language surface**

  A review of the corpus for the sentence "the language has no X" turned up
  eight candidates that no existing work package owns. docs/wp23-language-surface.md
  records the decision on each, with the evidence and an honest cost.

  Landing now, both pure checker work that changes no byte of IR: non-generic
  `type` aliases, where an alias is the type it names -- Int32Array already
  establishes that reading, with sameType holding across it -- and a numeric
  `enum` as a distinct type with i32 representation, stricter than TypeScript
  because "two values are compatible only when their types are identical" is
  the rule the type system is built on. self/ stands 171 module constants in
  for three enums across three files, all i32, so nothing today stops passing
  a token kind where a node kind belongs.

  Proposed and defended, not built:

    - Module-level mutable state, the one functional gap: stage1 cannot emit
      the AS0003 --json object for an internal compiler error, and orientation
      rule 7 says every failure is one of those objects. The note designs the
      narrow version -- module-private, scalar-only, literal initialiser,
      thread-local by construction -- works through what it costs the attribute
      fixpoint, escape analysis, the WP6 model and WP20's asset table, and then
      recommends against building it: an ignored boolean parameter keeps every
      attribute a function had, so threading it costs seven ugly signatures and
      zero proofs while the first writable global costs a symbol in the flat
      namespace WP21 must fix and a withdrawn row from WP20 section 2.
    - Pair<A, B> as a library interface under WP18 monomorphisation rather than
      tuple syntax: no new type constructor, and Pair<i32, i32> reuses WP17's
      packed-i64 path exactly.
    - Compile-time function parameters, marked speculative and strictly after
      WP18, with function values left forbidden.

  Declined, with the rule each one breaks written out: `for...of` over a string
  (tsc --strict types the binding as string, the type-honest version allocates
  per iteration, and JavaScript iterates code points where this language is
  byte-oriented); string `switch`, in agreement with LANGUAGE.md, with the
  length-bucketed variant recorded and refused; and `?.`, because its value in
  the null case is `undefined`, which the language does not have.

  Three claims the review made are corrected in the note rather than repeated:
  self/target.ts is not a flat pair table (it is a class and an if chain);
  self/codes.ts is generated, so its flatness costs nobody anything; and WP17
  proves a packed i64, having explicitly refused the register pair on
  portability grounds. The internalError call-site count is 38, not 39, and
  process.argv is out of reach in self/ice.ts because every self/ module is
  also compiled standalone as its own oracle case, not because it is a library.

  MASTER_PLAN section 9 and docs/README.md point at the note.

- **Accept non-generic `type` aliases in both compilers**

  `type Byte = u8;` at module level was
  `Only top-level function declarations are supported in Phase 1 (found
  TypeAliasDeclaration)`. It is a declaration now, in stage0 and stage1 alike.

  There is no lowering, and that is the point. An alias **is** the type it
  names, the way `Int32Array` is `i32[]`: no new `StaticType` kind, no new LLVM
  type, no side table the emitter reads, no line of IR. `sameType` never sees
  the alias's name because the name is gone by the time a signature is built --
  `resolveTypeNode` answers a `TypeReference` from the module's alias table and
  hands back the resolved type itself. tests/cases/type_alias_ir.ts and
  tests/cases/type_alias_expanded.ts are one program written twice, with and
  without its aliases, and their `.ll` goldens are byte-identical files; if they
  ever differ, an alias has started to mean something.

  Resolution is lazy and memoised, the shape `checker/constants.ts` already uses
  for a constant's fold, and for the same two reasons: an alias may name a class
  or an alias declared further down the file, and one that names itself has to
  be caught rather than followed. A `"resolving"` mark makes that a diagnostic --
  `` Type alias `Feet` is defined in terms of itself ``, the constant cycle's
  wording because it is the same mistake -- and a failed resolution clears the
  mark rather than memoising the error, so a second use reports the real cause.
  Every alias is resolved even when nothing names it, so a broken right-hand
  side is reported where it is written.

  Three rules refuse what an alias must not be. Generics still die in the
  validator (stage0) and at the `=` the parser expects (stage1). A built-in
  type name may not be taken: `string` is resolved from the syntax and `i32` or
  `Result` before any declared name, so `type string = i32` would otherwise sit
  there meaning nothing. And the name shares the one declaration namespace with
  functions, classes, interfaces and constants, checked in both directions.

  `export type` is refused rather than half-supported. A module's signatures are
  resolved during load, before its imports are bound, so an imported name in
  type position resolves provisionally as `%struct.<name>`; an alias has no
  layout to stand in for, and there is nothing to fix up afterwards because the
  type is already baked into the signature. Making it work means resolving every
  module's aliases before any module's signatures -- a change to the load order
  of both drivers, not part of this rule -- so the message says so and
  LANGUAGE.md records why.

  stage1 grows the grammar to match: `type` stays a contextual keyword matched
  by text where `from` and `of` are (so the lexer oracle is untouched),
  `N_TYPE_ALIAS` is node kind 58, and tests/parser_oracle.js transcribes
  `TypeAliasDeclaration` into it so the two parsers are still compared node for
  node. AmritScript-0, the subset `self/` is itself written in, is unchanged: it
  still has no `type` aliases.

- **Rename the language to Nish and the compiler to `nish`**

  The language is Nish and the compiler is `nish`: the npm package, the `bin`
  entry, `runtime/nish.h`, `runtime/nish.d.ts`, `runtime/nish.mjs`,
  `NISH_DEBUG` / `NISH_SIMULATE_ICE`, and the `NISH_<STEM>_H` guard on a
  generated header. `Nish Lang` is the longer form for places a bare name is
  ambiguous, the way Rust writes `rust-lang`; nothing the compiler prints uses
  it.

  The rename cost the two constants docs/ARCHITECTURE.md ("Where the name
  lives") promised it would -- `LANGUAGE` and `CLI` in src/branding.ts and
  self/branding.ts. Every string either compiler prints builds its name from
  those, so no diagnostic was edited to change what it says.

  Three things do not derive from those constants and moved by hand:

  The `amrit_` prefix on the runtime's C symbols is now `nish_`, along with
  `AMRIT_*` -> `NISH_*`, the `%struct.amrit_arena` / `amrit_array` / `amrit_str`
  / `amrit_result_*` layouts, and the Node shim's `__amrit` namespace. This is a
  C ABI break: a host that links runtime/runtime.c or includes runtime/nish.h
  must use the new names. Nothing has been released, so nothing linked the old
  ones. This is the second and last time that prefix moves -- it is ABI rather
  than branding, and neither reason that made it affordable (no release, and
  goldens that are generated rather than written) survives a first release.
  docs/ARCHITECTURE.md records both rewrites and why a third rename stops at
  `LANGUAGE` and `CLI`.

  Diagnostic codes are `NL####` rather than `AS####`. Every number keeps the
  rule it named -- all 344 assignments are preserved, only the two letters move
  -- because a code is a promise across releases. `NL` is a literal in
  scripts/gen-diagnostic-codes.mjs rather than a value from branding.ts, so it
  is frozen by design instead of following the name.

  The repository URLs point at amritk/nish.

  Two goldens carried the name inside a string constant, where LLVM records an
  explicit byte length: io_getenv.ll (`NISH_TEST_*`) and io_spawn.ll
  (`nish-no-such-program`) are regenerated so the lengths match the shorter
  text. The `amrit_` -> `nish_` symbol rename needs no such fixup; only string
  literals are length-prefixed.

  npm run check and npm test are green: 1211 passed, 0 failed, 1 skipped, the
  same counts as before the rename.

- **Regenerate docs/IR_COOKBOOK.md for the shorter name**

  The cookbook embeds the exact IR each construct compiles to, and one snippet
  carries the project's name inside a string constant. LLVM records an explicit
  byte length beside such a constant, so substituting the shorter name into the
  text left the counts describing the old one:

    -@.str.0 = ... { i64, [23 x i8] } { i64 22, [23 x i8] c"hello from Nish\00" }
    +@.str.0 = ... { i64, [16 x i8] } { i64 15, [16 x i8] c"hello from Nish\00" }

  Regenerated with docs/cookbook/regen.sh, which compiles the snippet rather
  than editing it, so the counts come from the compiler.

  This is the same class of breakage as tests/cases/io_getenv.ll and
  io_spawn.ll in the previous commit. A scan of every tracked file that holds
  an IR string constant -- 86 of them, goldens and Markdown alike -- now finds
  no mismatch between a declared length and its text.

- **Write down the plan for async, which is a refusal**

  WP20 section 6 deferred "how does Nish do async/await" to a note that did
  not exist. docs/wp24-async.md is that note, and it declines the feature for
  a reason that is not the expected one.

  The lowering is the cheap part, and this is measured rather than argued. A
  minimal switch-resumed coroutine written by hand in textual IR -- no clang,
  no C++, which is the shape this compiler emits -- is split by LLVM 18.1.3's
  default `opt -O2` pipeline. When the handle is consumed by its caller and the
  coroutine is internal, the frame type, the 24-byte allocation, @f.resume and
  @f.destroy are all elided and the module is the caller's straight-line code;
  store the handle into a global and every one of them comes back. That
  elision condition is the local / returned / leaks classification
  src/codegen/escape.ts already computes, and --strict-exports on by default
  puts an ordinary program on the free row. The whole spike is in section 10
  so the measurement can be re-run.

  What is missing is anything to await. Every I/O call in the language is
  synchronous, and a grep over src/, self/ and runtime/ for
  setTimeout|sleep|poll|epoll|kqueue|socket returns nothing: no timer, no
  sleep, no poller, no socket. Readiness polling does not help a regular file,
  which is why Node's own fs async is a thread pool; the one call that waits
  on something outstanding is spawnSync, and waiting on four children is four
  threads. So the first deliverable of an async package would be a poller and
  a socket type rather than a keyword -- a larger package than the syntax, for
  a workload nobody has asked for.

  The costs are written down anyway, because they fix the order if the answer
  ever changes: Promise<T> is a generic (WP15 item 8, and wp18 section 6.1
  argues against a third built-in family by hand); with no function values
  there is no callback to stop the colour, so one async leaf reaches main and
  links an event loop into a binary whose premise is a 4,696-byte hello world;
  willreturn dies at every suspend and readnone at every frame spill, which is
  a correct loss no effort recovers; a scheduler does not fit in the 244 bytes
  left of runtime.c's budget; wasm's loop belongs to the host; and Node is the
  differential oracle, so microtask ordering would become a declared
  difference for a construct users assume is identical.

  One item is recommended for building and it has no language surface: an
  asynchronous N-API export. --emit-napi writes a shim that calls the function
  on the thread N-API handed it, so an addon that runs for 200 ms blocks Node's
  event loop for 200 ms. napi_create_async_work plus napi_create_promise moves
  it to libuv's pool with the Nish function left exactly as synchronous as it
  is, and its entire prerequisite is WP20's T0 thread-local arena -- a worker
  allocating through the inlined bump allocator is a data race in the emitted
  IR, not merely in runtime.c.

  Six refusals carry the rule each one breaks, including the tempting one:
  accepting async as an erased no-op keyword would make a program mean
  something different under Node than it does here, in the one direction
  tests/differential/ exists to prevent.

  Nothing here is pre-1.0 -- LANGUAGE.md keeps the rejections it has, so M4's
  freeze waits on none of it. MASTER_PLAN section 9, docs/README.md and WP20
  section 6 point at the note.

- **Close slice iterators by measurement, and correct four stale status claims**

  WP15 item 3 proposed lowering `for (const c of s)` to pointer advancement so
  that the idiomatic loop would also be the check-free one. Measured, the loop it
  was written to beat already is that loop, and the mechanism has nothing left to
  build.

  Two programs summing a 20,000,000-element `i32[]`, one written
  `for (const x of xs)` and one as a counted loop over `xs[i]`, link to 8,008
  bytes and byte-identical binaries: §2b's alias domains let LICM hoist both the
  length and the data pointer out of the loop, leaving a body of getelementptr +
  load + add + add + icmp. A guarded byte loop is 7,008 bytes with and without
  `--unchecked-indexing`, byte-identical, because LLVM relates the index to the
  length and drops the check unaided; a call in the body does not put the header
  back, since the attribute fixpoint gives a string parameter `noalias nocapture
  readonly`. The string half of the proposal is declined on language grounds by
  WP23 §7, so both halves are closed.

  What is not free is a cursor the body advances by a variable amount, which
  `for...of` cannot express: a lexer-shaped program measures 1.40 s checked
  against 1.28 s unchecked, 1.094x and 216 bytes. That is the ceiling for
  eliminating bounds checks on real lexer code, and it is the acceptance number
  for ranged types and length narrowing (item 6) rather than for item 3 -- which
  is what `self/lexer.ts` is made of, and the measured form of the observation
  WP23 §7 makes from the language side.

  The status lists had gone stale around it, so four claims are true again:
  items 2 (the `performance` diagnostic class) and 4 (unsigned types) had both
  shipped while MASTER_PLAN §9 and WP15 §9 still listed them as remaining;
  wp20-threads §2 still said arrow functions are rejected, which WP22 stages A
  and B changed, though a function is still not a value, which is what that row's
  argument rests on; and wp22-arrow-functions still opened "Proposed, not
  implemented" above its own table recording A and B as landed.

  Documentation only: no compiler source changed, `npm run check` and `npm test`
  are green (1211 passed, 0 failed, 1 skipped for a missing WASI sysroot), and
  `docs/check-links.mjs` passes 332 links.

- **Correct WP24: Rust builds its own state machine, and generics are not a gate**

  Two corrections to the async note, both from asking what Rust actually does
  rather than assuming.

  First, vocabulary the note should have led with: a coroutine is not a strategy
  for async/await, it is what async/await is. A function that suspends has to
  put its live locals somewhere other than the frame it left, and there are three
  places -- a struct holding just the live values, a whole stack per task, or
  nowhere because you never suspend. The only real choice is who writes the state
  machine, and the note measured just one of the two answers.

  The other answer is Rust's, measured here with the rustc the benchmark suite
  already uses (1.94.1), on an async fn with two suspension points and a local
  live across both: zero llvm.coro.* intrinsics at -C opt-level=0 and 2 alike, a
  generated poll that loads a one-byte state discriminant at offset 12 of the
  future and switches into five resume points, a 20-byte future that is a plain
  value with fields at 4/8/12/16, and no heap allocation anywhere on the async
  path -- size_of_val folds to `ret i64 20`. rustc does the transform in MIR and
  hands LLVM ordinary IR.

  That is the shape to build if this is ever built, not the llvm.coro.* one the
  note spiked. A struct with a discriminant and a switch over it are constructs
  this language already has, and WP23's numeric enum makes the discriminant a
  distinct type; there is no dependence on an intrinsic family whose lowering
  lives in an optimisation pass, so the cost model stops inverting between
  --profile debug and speed; and the frame becomes an ordinary allocation site
  that escape.ts classifies with the rule it already has. Section 9's open
  question about what a debug build of a coroutine would cost is answered by not
  depending on the pass.

  Rust's hardest async problem does not arise here. Pin, Unpin and the unsafe
  around them exist because Rust puts locals in the frame and lets a program take
  a reference to one, so moving the frame invalidates it. Here escape.ts already
  decides alloca versus arena, and a value whose reference is live across a
  suspend is simply denied the alloca -- the same judgment wp20 section 3.3 needs
  for a spawn.

  Second, and this moves a gate: section 4.1 claimed Promise<T> is a generic and
  WP18 is a hard prerequisite. It is not. Rust's impl Future is anonymous -- one
  unnameable compiler-generated type per async fn -- and await here would always
  apply to a known call site, so the state machine type need never be spelled in
  a program. What generics actually buy is futures held as data: an array of
  them, join, select, storing one in a field. So WP18 stops being a prerequisite
  in front of the feature and becomes an enhancement after it. The section keeps
  the wrong claim visible rather than quietly editing it out, and section 6's
  gate table is renumbered to match: A3 is the feature and waits only on A2, A4
  is futures-as-data.

  What does not change is the conclusion. Rust demonstrates that the language
  half of async is cheap and that the language half does nothing alone: std has
  no executor, an async fn nobody polls is an inert struct, and the reactor and
  scheduler arrive as a dependency. That is section 2's finding from the other
  side.

  Both spikes are in section 10 so either measurement can be re-run.

- **Add WP24 section 9: what the refusal costs, and what survives it**

  Two questions a decision to not build something has to answer, and the note
  answered neither: does waiting foreclose anything, and which parts of the
  feature are still reachable when the trigger arrives.

  Waiting forecloses nothing in the language, and this is checked rather than
  assumed. `async` and `await` are contextual in TypeScript's grammar and this
  compiler inherits that grammar, so both are ordinary identifiers now and stay
  ordinary identifiers after. Verified against the typescript package's own
  parser and against the compiler: `export function async(n: i32): i32` compiles
  today and still parses once the modifier exists, since `async function async()
  {}` is valid TypeScript; a local named `await` is fine in a synchronous
  function and is rejected inside an async one exactly as JavaScript rejects it.
  So no keyword needs reserving before the M4 freeze and no migration note is
  owed.

  What waiting does cost is four small things, the second of which was not
  written down anywhere. WP6's automatic scopes and WP9's call-site reclaim both
  bracket a contiguous dynamic extent with arena mark/release/keep, and a suspend
  point in the middle of such a bracket is what those brackets are not built for
  -- a coroutine suspending inside a scoped function would have its memory
  released underneath it. The rule an async package needs is that a function
  which can suspend gets no automatic scope and an awaited call gets no
  call-site reclaim bracket. Cheap to state now and more expensive the more later
  optimisations assume that extent is contiguous, so whoever writes the next
  arena optimisation should know there is a future customer for the assumption.

  What survives is Rust's arrangement rather than JavaScript's, and the table
  says so row by row: async/await and sequential suspension yes, with no generics
  needed; fixed-arity awaitAll over known call sites yes for the same reason; a
  homogeneous awaitAll over an array yes after WP18; Promise.all typed as a tuple
  of mixed types no, since that wants tuples and variadic generics and wp23
  section 5 stops at Pair; and the promise as a first-class value no.

  That last row is the only entry refused by a decision the project has already
  made and already lives with rather than by work nobody has done. Result has no
  map, andThen or orElse because they need function values and the whole-program
  pass cannot prove purity, termination or escape through an unknown callee
  (wp16 section 6), and .then is andThen wearing a promise. A language that
  rejected Result.map and then accepted Promise.prototype.then would be trading
  the attribute fixpoint for a spelling.

  Open and the appendix renumber to 10 and 11.

- **Make the bootstrap seed a parameter, and build its comparison tool**

  Four of WP19's six retirement gates, and the macOS blocker that stood in
  front of the fifth. stage0 stays the seed and the oracle; nothing is deleted.

  G3, the seed protocol. `scripts/bootstrap.sh` stops assuming `dist/index.js`
  and reads `NISH_BOOTSTRAP`, the way `GOROOT_BOOTSTRAP` names the Go that
  builds Go. The seed is a released `nish` executed directly, or a `.js`/`.mjs`
  entry point run under node, chosen by extension: the executable bit describes
  the download rather than the file, and `dist/index.js` is 0644 in a fresh
  checkout. Either kind must answer `--version` before a stage runs, so a binary
  for the wrong platform fails under the variable's own name instead of three
  stages deeper. Unset, the seed is stage0 and the output is unchanged line for
  line.

  The header records that the first equality changed meaning. With stage0 as the
  seed, `IR(seed) == IR(stage1)` is WP14's claim that two independently written
  implementations agree; with a released binary it is the weaker claim that a
  release and HEAD agree.

  G2 items 1 and 2. `tests/nish-cmp.js` compares a reference compiler with a
  candidate over the whole corpus, byte for byte, and succeeds `ir_oracle.js`
  and `interop_oracle.js` in one pass: every `.ll`, the four sidecars, the file
  set, and the exit status, since a program one side refuses is a difference.
  It reuses `tests/self/corpus.js` so it compiles what every other oracle
  compiles, with the same flags. A difference must be named in `CHANGELOG.md`,
  and a declaration whose words are missing from the changelog fails as loudly
  as an undeclared difference. It agrees with the oracle it replaces on all 329
  programs and 2,332,971 IR lines, and it has been watched failing on an induced
  one-flag difference. With no release to compare against it skips, counted and
  explained rather than reported as a pass. `fuzz.js --stage1` takes the same
  pair and falls back to stage0 versus stage1.

  G4, the seed policy: nish 0.N is built by the last patch release of 0.(N-1),
  with 0.1.0 as the stated base case, built by stage0 and creating the first
  seed. Its consequence for contributors is that a construct added in 0.N cannot
  be used by `self/` until 0.(N+1), so wp14 rule 1 survives retirement with only
  its subject changed.

  G6, the provenance procedure: how to re-verify diverse double-compiling from
  the `ddc-<version>` tag years later, and what a pass and a failure each mean.
  The tag itself is cut at release time.

  The macOS blocker, which G5 needs for darwin binaries: `scripts/build.sh` runs
  under `set -u`, and bash 3.2 treats an empty `"${arr[@]}"` as an unbound
  variable. Ten sites take the `${arr[@]+"${arr[@]}"}` spelling; `common`,
  `inputs`, `gc` and `shared` are provably non-empty and are left alone. The
  emitted command lines are byte-identical on Linux at every profile.

  npm run check and npm test green: 1211 passed, 0 failed, 2 skipped — the
  WASI sysroot, and nish-cmp declining to compare against a release that does
  not exist yet.

- **Ship the self-hosted compiler with a release, and bootstrap CI from it**

  A `v*` tag now attaches nish-<version>-x86_64-linux.tar.gz beside the npm
  tarball, and ci.yml gains a `bootstrap` job that builds self/ with the last
  release as its seed. Linux only, and one binary rather than four: macOS stays
  out of the test matrix, so G3's second operating system and three of G5's four
  binaries stay open. wp19 records what each gate has and what it lacks rather
  than claiming either is closed.

  A tarball rather than a bare binary, because a bare binary is half a compiler.
  `--link` runs scripts/build.sh and compiles runtime/runtime.c, and the compiler
  looks for both in its own directory's parent and in the working directory. So
  bin/nish one level below runtime/ and scripts/ is the layout that works -- the
  shape dist/index.js already has in the npm package. Shipped flat beside
  runtime/, it links only while the working directory happens to be the unpacked
  folder, which is a trap rather than a distribution. Measured rather than
  assumed: a bare binary emits IR and then says it cannot find scripts/build.sh,
  and the flat layout passes only when run from inside itself.

  The release smoke step therefore unpacks the real tarball in one directory and
  drives it from a third, so neither the repository nor the unpack directory can
  be what makes it work. The binary is stage2 and is --verify'd before it ships,
  because it is not only a convenience: it is the seed every later release
  bootstraps from, which is also why its name and layout are a contract between
  the two workflows rather than a label.

  The bootstrap job is what enforces the rolling freeze. Using a construct before
  the seed knows it breaks there and nowhere else, since `npm test` seeds from
  stage0, which always knows every construct the working tree does. Before 0.1.0
  there is no release to seed from, and the job says so in an annotation instead
  of passing quietly.

  Verified locally end to end, in the shape CI will run it: the tarball builds
  (441 KB), unpacks, links and runs a program from an unrelated directory; used
  as NISH_BOOTSTRAP it builds self/ to IR(seed)==IR(stage1)==IR(stage2) with
  stage3 byte-identical to stage2; and nish-cmp against it agrees on 329/329
  programs and 2,332,971 IR lines. `node tests/run.js wp12` 31 passed, 0 failed;
  docs/check-links.mjs 334 links.

- **Write down the coverage that dies with stage0**

  WP19 gate G2 item 4. Four oracles -- checked, types, diagnostics, symbols --
  prove stage1 correct by holding it against stage0, and prove nothing once src/
  is deleted. They are green, so what stage1 prints is the agreed behaviour of
  both implementations; tests/self/goldens/ is that output checked in, and
  tests/self/goldens.js compares stage1's live answer against it with stage0
  nowhere in the picture. Both run while stage0 lives. This one survives it.

  1,332 KiB: the --emit-checked dump of all 319 corpus programs (303,096 lines),
  the 119-line type matrix, the 570-line diagnostic-machinery transcript, the
  25-line scope-and-narrowing script. The self/ dumps are 19.9 MB raw, because a
  self/ program is loaded whole and each of the 57 entries re-dumps every module
  it imports; the distinct content is 1.0 MB, so they are stored by module. That
  is a storage decision and not a coverage one -- the check still runs all 57
  programs and compares every one of the 19.9 MB of bytes, and a module that
  dumps differently under two entries is a hard error naming both rather than a
  silent pick.

  Verified by the property it exists for: with src/ and dist/ moved aside the new
  check passes while all four oracles fail to start. Each golden was also watched
  failing, on a perturbed byte and on perturbed stage1 source -- deleting the
  parent-scope recursion in Scope.typeOf reports the narrowing that outlives its
  scope in two readable lines.

  What this does NOT recover is the diagnostic wordings, which is the half the
  gate singles out, so the number is written down rather than assumed. Of 344
  registry codes the surviving reject_* and tests/link/ negatives exercise 148;
  196 are exercised by nothing that outlives stage0, and these goldens close none
  of that gap -- measured by matching every registry fragment against each file.
  On the 265 reject_* cases alone stage1 names 144 codes where stage0 names 182,
  that difference being the class where stage1's parser refuses the syntax before
  Phase 0 can name the rule. All six driver wordings, all six interop wordings
  and both performance warnings are exposed. wp19 §2B carries the list, and R3
  now says this is the half that matters.

  Also here: CHANGELOG.md is emptied and its policy stated. A section is written
  when a release is cut, not as development goes along, so between releases the
  file is empty and the account of what changed is the git log and the wp notes.
  And tests/link/no_main/main.ll is ignored -- the negative case writes its IR
  beside the source before reporting the missing main, so every run of the link
  section left an untracked file where `git add -A` could sweep it up.

  npm run check clean; npm test 1212 passed, 0 failed, 2 skipped (the WASI
  sysroot, and nish-cmp with no release to compare against).

- **Remove inheritance; widen `implements` to a prefix check**

  `class D extends B`, `super(...)`, `super.m()` and method overriding are gone
  from the language, and `class C implements I` now requires `I`'s fields to be
  `C`'s *first* fields rather than all of them. The two go together: the second
  keeps the only thing the first was buying.

  `extends` gave three things. A field prefix -- `%struct.D` was `B`'s fields
  followed by `D`'s own, so a `D*` was a valid `B*` after one `bitcast`. Member
  reuse. And polymorphism, which is the reason hierarchies exist and the one
  thing this language never had, because dispatch is static: `d.m()` resolves to
  the `m` of `d`'s *declared* type. Holding a `Base[]` and calling `m()` -- the
  classic use -- silently ran the base method. Inheritance without virtual
  dispatch is the syntax of a hierarchy with none of the payoff.

  The prefix keeps working, through `implements` instead:

    %struct.Shape  = type { i32, i32 }
    %struct.Square = type { i32, i32, i32 }
    %struct.Circle = type { i32, i32, i32, i1 }

  A `Square*` becomes a `Shape*` with one `bitcast`, a `Shape` operation reads
  and writes the `Square`'s own bytes at the same offsets, and two classes with
  different tails live in one `Shape[]`. No IR moved: not one golden changed
  except the ones whose programs were deleted, and tests/layout/structs.ts
  declares `K`, `L` and `M` -- the three classes that used to be derived -- as
  classes implementing an interface, still 24, 16 and 32 bytes, with the C twin's
  _Static_asserts untouched. A class's own fields reuse the prefix's tail
  padding, which a nested struct member would not.

  What the removal buys is the language's only knowing divergence from
  JavaScript. An override reached through a base-typed value ran the base method
  natively and the derived one under Node:

                            Node    native
    areaOf(sq)                 9        0
    sq.report()              100       10

  RUN_UNDER_NODE.md listed it among the four things no prelude can reach and
  known-failures.txt carried cls_extends_override as a by-design failure. Both
  entries are deleted rather than explained. Two smaller declarations went too:
  the parity oracle's inheritance-cycle entry (stage0 reported a cycle once per
  class, stage1 once, because stage0's throw left a `collecting` marker set), and
  the last `tsc` ambient divergence but one, an implicit `super()` that
  JavaScript throws on.

  Sixteen `reject_*` cases collapse into two, because sixteen rules collapse into
  two: `extends` is refused and `super` is refused, in every spelling. Both live
  in the checker rather than Phase 0 -- inheritance needed nothing Phase 0 exists
  to refuse, it compiled until now -- and both messages name the rewrite, by the
  doctrine wp22 section 6 states for a removed spelling. The registry appended
  NL2277-NL2279 and renumbered nothing.

  self/ did not change: 25,911 lines over 57 modules and not one derived class,
  because wp14 section 2.1 had already chosen a single `Node` class with a `kind`
  discriminant over a hierarchy, and Nish-0 was defined as the language minus
  "inheritance and downcasts". The largest Nish program there is had declined the
  feature years before this commit removed it.

  docs/wp24-inheritance.md is the plan of record.


## [0.1.0] - 2026-09-11

### Build

- **release: Generate releases from commits, on a release train**

  The account of what changed moves from a file maintained by hand to the
  commits themselves, because the commits are what a release contains and a
  hand-maintained file drifts from them.

  scripts/changelog-gen.mjs walks the log since the last tag and writes
  changelog/<version>.json: one file per release, carrying every entry's type,
  scope, breaking flag, title, prose body, measurements, refs, tests, commits,
  author and date, plus the release's range and artifacts. That JSON is the
  record and the website reads it; CHANGELOG.md and the GitHub release notes are
  rendered from it, so there is one account of a release and two views of it,
  which cannot drift.

  The subject gives the heading and the version bump, the body gives the prose.
  Subject-only generators throw the body away, which is the half worth keeping
  here -- the explanation of why a lowering is the way it is. `Measured:`,
  `Refs:` and `Tests:` trailers become structured fields, and `Release-Note:`
  replaces a body written for the reviewer rather than the reader. Co-authorship
  and session trailers are stripped from every body: they are bookkeeping, not
  what changed. A subject that is not conventional is filed under
  "Uncategorised" with its body intact and reported, because a release that
  silently omits a change is worse than one with an untidy heading.

  The train: every merge to main refreshes one open "Release <version>" pull
  request carrying the bump, the JSON and the rendered section; merging it
  creates the tag; the tag builds and publishes. The notes are reviewed in the
  pull request whose body is those notes, before anyone can read them. The bump
  touches self/branding.ts as well as package.json, because tests/run.js fails
  when the two disagree and the release PR would otherwise be red at itself.

  release.yml now publishes from the reviewed JSON rather than a fresh walk of
  the log, caps a body over 120,000 characters at a paragraph boundary, and
  fails on an empty one. That last check is not hypothetical: with CHANGELOG.md
  emptied, `changelog-section.sh 0.1.0` fell back to an empty [Unreleased] and
  exited 0, so the release would have shipped a blank body.

  pr-title.yml checks the pull request title, since squash-merge makes it the
  commit subject. It shells out to the generator's own --check-subject so CI
  enforces exactly what the generator parses, rather than a second copy of the
  rule that can drift from it; the title is passed through the environment
  rather than interpolated into the shell.

  changelog/0.1.0.json is generated from the 181 commits behind this branch.
  All 181 predate the convention and are filed as "Uncategorised" with their
  bodies intact, which is the migration working as intended rather than a gap.

  npm run check and npm test green: 1212 passed, 0 failed, 2 skipped.

### Uncategorised

- **Add zero-GC arena runtime, LLVM performance attributes, and LTO build pipeline**

  Performance and binary-size pass toward Rust-parity output:

  - runtime/runtime.c (4 KB source, 1.1 KB compiled): chunked bump/arena
    allocator with O(1) reset, plus length-prefixed immutable UTF-8 strings
    (new/concat/eq/len/print/from_i32/from_f64). No GC, no stdio on hot paths.
  - src/codegen/runtime.ts: runtime ABI declarations with noalias/nonnull/
    nocapture/allocsize attributes and an alwaysinline IR copy of the bump
    fast path that reads @sts_arena directly; only sts_arena_grow (cold,
    noinline) calls into C. Declarations are emitted only for symbols the
    module uses, or all of them with --runtime-decls.
  - src/codegen/attributes.ts: call-graph fixpoint purity analysis (readnone/
    readonly), loop detection (willreturn), and escape analysis for string
    params (nocapture). Emits nounwind, noundef, zeroext on i1, nonnull/
    noalias/readonly/align 8 on strings.
  - Emitter adds natural alignment to alloca/load/store; --plain restores
    the bare Phase 1 output.
  - IR builder gains attribute groups, param/return attributes, and module
    sections for types, globals, declarations, and raw definitions.
  - scripts/build.sh: debug/speed/size/wasm profiles with the exact clang,
    LTO (lld), gc-sections/dead_strip, and strip flags; scripts/size-report.sh
    prints the before/after table (9.5 KB debug -> 4.5 KB size, 279 B wasm).
  - examples/node-host.mjs: Node imports the wasm module (recommended interop
    direction instead of embedding a JS engine).
  - Tests: runtime.c unit test, IR/C arena layout smoke test via LTO link,
    size and wasm profile builds, plain and attributed golden IR.

- **Add master plan with parallelisable work packages**

  Consolidates the language spec, architecture (Biome for DX, dedicated
  Phase 0 AST validator, checker, emitter, runtime, build), what exists,
  open decisions, and twelve work packages with scope, dependencies,
  acceptance criteria, waves for parallel agents, conventions, and an
  agent brief template.

- **WP-P: split checker/emitter into dispatch tables, add golden case harness**

  Prepares the pipeline for parallel work on new language constructs:

  - src/checker/ is now a package: index.ts (core + dispatch), statements.ts
    and expressions.ts (handler tables keyed by ts.SyntaxKind, plus a binary
    operator table), declarations.ts, scope.ts, program.ts, context.ts
    (CheckContext extension interface).
  - src/codegen/emit/ mirrors it: statements.ts and expressions.ts handler
    tables with an EmitContext; emitter.ts keeps module assembly, function
    setup, runtime prelude, and dispatch.
  - Emitted IR is byte-identical to the previous implementation for every
    existing example and flag combination.
  - tests/cases/ golden harness: <name>.ts with .ll golden, optional .args,
    .err (must reject), .out (native stdout via <name>.c or tests/driver.c).
    tests/run.js discovers cases, supports a name filter and
    UPDATE_GOLDENS=1. Existing goldens and negative tests migrated; new
    cases for f64 mode, locals round trip, and string parameter attributes.
  - npm run check (tsc --noEmit) and npm run test:update.

- **Time the validator on a synthetic 1,000-line file in the test runner**

  Generates build/test/validator_perf.ts (200 five-line functions with
  locals, arithmetic, calls, string and boolean expressions, loops), parses
  it once, then times validateStaticTS alone. Measured about 2 ms warm and
  under 6 ms cold on 23,000 nodes; the gate is 50 ms for CI headroom.

- **Use Biome's preset field instead of the deprecated recommended flag**

  biome migrate rewrote the config; rule set is unchanged.

- **Merge wp3/strings: string literals, concat, equality, length, templates, console.log**

- **Add modules, entry point wrapper, and linkage control (WP5)**

  Programs may now span several files. `export function` marks a function
  callable from other modules; `import { f, g as h } from "./m"` (relative
  specifiers only, .ts optional) binds the exporter's signature so calls are
  type checked across modules. A new `Compilation` (src/compilation.ts)
  loads the root file(s) and their imports transitively, parsing each file
  once so cycles terminate, collects every module's signatures before any
  body is checked, rejects symbol clashes that would fail at link time, runs
  the attribute analysis over all modules, and emits one .ll per module.

  Lowering:
    - An imported function is a `declare` in the importer carrying exactly
      the parameter, return, and function attributes of the exporter's
      `define`, rendered from the same signature and program-wide facts.
    - The entry module's `export function main` is emitted as `@sts_main`
      and wrapped by `define i32 @main(i32 %argc, i8** %argv)`, which calls
      it, calls `sts_free_arena`, and returns the code (0 for void).
    - `--strict-exports` gives non-exported functions `internal` linkage;
      exported functions are always external.

  CLI: multiple inputs, `-o <dir>/` for one .ll per module, `--link <exe>`
  (scripts/build.sh + runtime.c, `--profile`), `--strict-exports`.

  Tests: goldens for export, strict linkage, and both entry wrappers;
  reject cases for import/export forms and `main` with parameters; a
  `tests/link/` harness that builds whole programs with `--link`, compares
  the exit code, checks goldens, llvm-as, opt -passes=verify, and that
  every importer `declare` matches its `define` attribute for attribute.
  Cases containing `export function main` link without tests/driver.c.

- **Clean dist before building so stale modules cannot shadow new ones**

- **Add control flow: if/else, loops, break/continue, throw, ?:, &&/||, op=, ++/--**

  Lowering (src/codegen/emit/control-flow.ts): every construct becomes named
  basic blocks laid out as clang does (if.then/if.else/if.end, while.cond/
  body/end, do.body/cond/end, for.cond/body/inc/end, cond.true/false/end,
  land.rhs/end, lor.rhs/end; `.N` suffix on reuse, reserved in source order).
  Conditions are `br i1`; the ternary and short-circuit operators merge with
  `phi`, reading the incoming label after each arm so nested arms are right.
  Mutable locals stay in entry-block allocas, so loops load/store and mem2reg
  rebuilds the SSA form; a `sum += i % 1000` loop vectorises under opt -O2.
  Blocks that cannot fall through are never appended to; `if.end` is skipped
  when both arms return, `for.end` when a `for (;;)` has no break, and the exit
  of `while (true)`-style loops ends in `unreachable`. `throw` evaluates its
  operand, calls `llvm.trap` and ends in `unreachable`.

  Checker (src/checker/control-flow.ts): conditions must be boolean (no
  truthiness); `&&`/`||` take and yield booleans; ternary arms must agree;
  compound assignment and ++/-- need a mutable numeric local; break/continue
  need an enclosing loop. Termination analysis: if/else with both arms
  terminating, infinite loops without a break, break/continue/throw. The
  unreachable-code diagnostic now names the terminator.

  Attributes: `willreturn` is now a call-graph fixpoint that requires every
  loop to be a counted loop with a wrap-free i32 induction variable, no
  `throw`, and willreturn callees; `throw` also makes a function impure.

  The new handlers register into the existing dispatch tables with one spread
  each; prefix operators moved to an operator-keyed table so ++/-- register
  the same way. IRFunction gained newBlock/placeBlock for unique labels.

- **Add member dispatch registries for property access, method calls, and new**

  checker/members.ts and codegen/emit/members.ts hold tables keyed by the
  receiver's type kind (properties, methods) or constructor name (new), plus
  namespace properties and fact collectors for attributes.ts. Strings
  register their .length entry; classes and arrays register theirs without
  touching each other's files. Emitted IR is unchanged.

- **Add interop: C header, wasm .d.ts, N-API addon profile (WP8)**

  Host-side declarations are generated from the same checked program the
  IR came from, so they describe exactly the symbols and signatures in the
  .ll modules:

  - runtime/statictsc.h: public C header for the runtime ABI (sts_str
    layout, struct sts_arena and its global, every runtime.ts function,
    STS_SYMBOL for keyword-named functions). C11/C++ clean under
    -Wall -Wextra -Werror -pedantic; a test asserts every RUNTIME_FUNCTIONS
    name has a prototype.
  - --emit-header <file.h>: prototypes for every external function
    (exported, plus non-exported without --strict-exports; the entry main
    is omitted). number -> int32_t/double, boolean -> bool, string ->
    const sts_str * in / sts_str * out. A function named after a C keyword
    (`double`) is declared as `double_` bound with an asm label.
  - --emit-dts <file.d.ts>: typings for the wasm exports (i1 results are
    typed 0 | 1, which is what wasm hands back), string functions listed as
    comments, plus `load(bytes: BufferSource): Promise<Exports>` that
    examples/node-host.mjs now implements.
  - --emit-napi <shim.c> and scripts/build.sh --profile napi: a Node-API
    shim with argument count/type checks per scalar function (string
    functions skipped with a comment, sts_reset_arena/sts_free_arena always
    exposed), built with the speed flags plus -shared -fPIC against the Node
    headers found next to `node` (NODE_INCLUDE overrides; a missing
    node_api.h is a clear error). examples/node-addon.mjs loads it.
  - bench/ffi.mjs + bench/sum.ts: per-call FFI cost versus one batched
    call (42 ns per N-API crossing, 2.8 ns per wasm crossing, 0.3 us for
    the whole batch); numbers in docs/wp8-interop.md.
  - tests/run.js "WP8: interop" block: header/runtime.ts agreement, strict
    -Werror compiles of the public and generated headers, a C driver through
    them, tsc on the .d.ts files, addon build/load/TypeError check, and
    .node versus .wasm result agreement (skipped without Node headers).

- **Add JS number formatting, i64, random, exit, and file I/O to the runtime**

  sts_str_from_f64 now prints exactly what JavaScript's String(x) prints:
  the shortest digit string that round-trips (precision 1..17 via %.*e and
  strtod) laid out per ECMA-262 (plain form for exponents in (-6, 21],
  exponent form with e+X / e-X otherwise, -0 as 0, NaN, Infinity). Checked
  against Node on the unit-test cases and 5,000 random doubles.

  sts_str_from_i64 formats 64-bit integers (from_i32 delegates to it).
  sts_random is xorshift64* seeded lazily from time and pid, returning 53
  bits in [0, 1). sts_exit wraps exit. sts_read_file / sts_write_file /
  sts_append_file are open/pread/write wrappers over one arena string; a
  failure prints "statictsc: cannot read/write <path>" and exits 1. No
  stdio on any hot path.

  Budget: 7,402 bytes of source (limit 8,192), 2,688 bytes of .text at -Oz
  (limit 4,096).

- **Add Math intrinsics, i64, numeric conversions, process.exit, and file I/O**

  Math.sqrt/floor/ceil/trunc/sin/cos/exp/log/pow/abs/min/max lower to LLVM
  intrinsics declared nounwind willreturn readnone through the runtime
  declaration table (declared only when used, never in the --runtime-decls
  prelude), so callers stay readnone. Math.round is floor + compare + select
  because JavaScript rounds half toward +infinity, which neither llvm.round
  nor floor(x + 0.5) matches. Math.PI / Math.E are constants; Math.random
  calls sts_random (write effect). f64-only functions on an i32 number are a
  checker error pointing at --number-mode f64 or toF64(x).

  i64 is a first-class type (i64, align 8) for locals, params, returns,
  arithmetic, comparisons, templates, and console.log (sts_str_from_i64).
  Numeric literals take their type from context (annotated initializer,
  return, call argument, the other operand of a binary operator,
  Math.min/max, f64-only Math functions, process.exit), so `let x: i64 = 5`
  and `x * 2` need no suffix; the rule is documented in checker/math.ts.
  toI32 / toI64 / toF64 lower to sext / trunc / sitofp and the saturating
  llvm.fptosi.sat.* intrinsics so f64-to-integer is defined for every input.

  process.exit(code) lowers to a noreturn call to sts_exit followed by
  `unreachable`; the checker treats the statement as a terminator, and a new
  callsNoReturn fact propagated by the purity fixpoint removes willreturn
  from every function that can reach it. readFileSync / writeFileSync /
  appendFileSync are plain identifier builtins over sts_read_file and
  friends, consulted only when no user function of that name exists.

  New handler modules: src/checker/{builtins,math,io}.ts and
  src/codegen/emit/{builtins,math,io}.ts, registered by spreads into the
  existing builtin and expression tables. tests/run.js links round trips
  with -lm (sin/cos/exp/log/pow become libm calls). reject_unknown_builtin
  moves from Math.sqrt (now supported) to Math.foo.

- **Add arrays: T[] / Array<T>, literals, new Array<T>(n), a[i] with bounds checks, .length, push, for...of**

  Layout (ABI, src/codegen/runtime.ts + runtime/runtime.c): an array value is a
  `%struct.sts_array*` to an arena header `{ i64 len, i64 cap, i8* data }`, one
  header type for every element type; `data` holds `cap` elements of sizeof(T),
  arena-allocated and 8-aligned. Element access bitcasts `data` to `T*`.

  Lowering (src/codegen/emit/arrays.ts): literals allocate header + data through
  the inline `sts_alloc_struct` and store each element; `new Array<T>(n)` clears
  the data with `llvm.memset` (scalar T only: a zeroed pointer element would be a
  null string/array, so `new Array<string>(n)` is rejected); `a[i]` widens the
  index to i64 (`sext` / `fptosi`), compares `icmp ult` against `len` and
  branches to a cold `bounds.fail` block that calls the noreturn
  `sts_panic_index(idx, len)` ("index out of range: <idx> >= <len>", exit 1)
  followed by `unreachable`; `--unchecked-indexing` drops the check (unsafe,
  benchmarks). `.length` is one `load i64` + `trunc`/`sitofp`; `push` grows via
  `sts_array_grow` (doubling, 4 from empty) when `len == cap`, stores at `len`
  and yields the new length; `for (const x of a)` is an index loop
  (forof.cond/body/inc/end) over an i64 alloca that re-reads `len` each
  iteration, with break/continue through the loop stack. Element assignment
  (`a[i] = v`, `a[i] op= v`) wraps the existing `=`/`op=` handlers and falls
  back to them for non-element targets, so a property-target path composes.

  Checker (src/checker/arrays.ts): one element type per literal; `[]` takes a
  contextual type (annotation, return type, assignment target, enclosing
  literal, callee parameter, push receiver) or is an error; numeric indices
  only; `.length` read-only; `push` argument must match; `for...of` needs an
  array and declares the element variable (const or let).

  Attributes (src/codegen/attributes.ts): array params are `noundef nonnull
  align 8`, plus `readonly` when never stored through or aliased and only passed
  to callees whose matching param is readonly, and `nocapture` under the same
  rule for captures (both a fixpoint over the program's call graph); no
  `noalias`. A checked `a[i]` adds the noreturn `sts_panic_index` callee so the
  function loses `willreturn`; a `for...of` whose body has no push, user call or
  throw is a counted loop. Fact collectors now receive the compiler options.

  Also: `IRFunction.emitAlloca` suffixes repeated names (`%x.addr.1`), which two
  same-named `let`s in sibling loops previously turned into invalid IR;
  `EmitContext.declareType` for module-level named types; the array header type
  is declared whenever a signature mentions an array.

  Tests: tests/cases/arr_*.ts goldens with native round trips (literal, index
  read/write, new zeroed, length, push past capacity, for...of with
  break/continue, sum, insertion sort, string[], number[][], f64 mode,
  unchecked), reject_arr_*.ts negatives, a WP4 harness block that verifies every
  module, checks the bounds panic exits 1 with the message, and asserts `opt
  -O2` vectorises the sum loop (unchecked build, and the checked build once
  inlined into main); runtime_test.c covers sts_array_grow. runtime.c is 5,461
  bytes of source and 1,496 bytes of .text at -Oz.

- **Add classes, interfaces and structs (WP2)**

  A class or interface becomes `%struct.Name = type { fields in declaration
  order }` with natural alignment, size and padding computed as clang lays out
  the same C struct. Values are `%struct.Name*` into the arena.

  Lowering:
  - `new C(args)`: `call i8* @sts_alloc_struct(i64 sizeof)`, bitcast, then
    `call void @C.constructor(%struct.C* obj, args)`. A class without a
    constructor stores its literal field initializers inline instead.
  - Constructors and methods are functions `@C.member` whose first parameter
    is `%this`; they are ordinary entries of `CheckedProgram.functions`, so
    purity facts, `--strict-exports`, cross-module declares and symbol-clash
    detection cover them unchanged. Constructors store the initializers
    before their body.
  - `p.x`: `getelementptr inbounds` + `load`; `p.x = v` / `p.x op= v`:
    `store`, dispatched through a new `assignmentTargetCheckers/Emitters`
    table keyed by the target's kind (arrays can register `a[i] = v` there).
  - Object literals typed by their context allocate and store every field;
    a class value used where an interface it implements is expected is
    recorded in `program.coercions` and lowered to one `bitcast` by the
    emitter core, so `sameType` stays a by-name comparison.
  - `export class` / `export interface` and importing them by name (no
    renaming: the type name is ABI); an importer declares the class's
    constructor and methods with the exporter's attributes and emits
    `type opaque` for struct types it only points at.

  Checker rules: typed fields with literal initializers, no inheritance,
  static, accessors, optional fields or index signatures; `readonly` fields
  assignable only as `this.f` in their constructor; definite assignment
  (every field assigned on every path before any return, no read of an
  unassigned field, no use of `this` before every field is assigned);
  `implements` requires the identical field list; `this` only in members;
  `<` on struct values rejected.

  Attributes: struct params and returns get `noundef nonnull align 8
  dereferenceable(sizeof)`; `noalias` only on a constructor's `this`;
  `readonly` when the function never stores through the pointer, never lets
  it escape and only passes it to callees whose parameter is readonly;
  `nocapture` likewise, both by a fixpoint over `pointerParams`. Escape
  analysis is now position based (`classifyUse`), which also closes the
  string holes for `return c ? a : b` and `const t = s; return t`. The
  inline allocator is treated as a willreturn writing callee.

  Tests: cls_* goldens with native round trips (including f64 mode),
  reject_cls_* negatives, tests/layout/structs.{ts,c} (sizes cross-checked
  against `_Static_assert`s built with -std=c11 -Wall -Wextra -Werror and
  every offset read back through compiled getters), and link tests for
  exported classes.

- **Document classes, interfaces and struct layout (WP2)**

  docs/wp2-classes.md: TypeScript and exact IR per construct, the layout
  table for the ten layout-test structs, the definite-assignment rule, the
  contextual typing rule for object literals and class-to-interface
  conversion, module rules, the attribute rules for struct pointers, and the
  rejected forms. README: class/interface rows in the type table and the new
  constructs under "Supported today".

- **Add --version, an exit-code contract, and toolchain detection to the CLI**

  - `-v` / `--version` prints the package version read from package.json at
    runtime (src/version.ts), so it survives `npm pack` and `npm version`.
  - Exit codes: 0 ok, 1 compile error (CompileError, driver refusals, ENOENT
    on inputs), 2 usage, 3 toolchain, 70 internal compiler error.
  - Internal errors name the input files, ask for a bug report at the issue
    tracker, and print the stack only with STATICTSC_DEBUG=1.
    STATICTSC_SIMULATE_ICE=1 is the test hook for that path.
  - `--link` probes `$CC --version` (default clang) before compiling and, when
    it is missing, prints per-platform install commands and exits 3.
  - A failing scripts/build.sh has its stderr surfaced verbatim, the .ll paths
    are named, and the exit code is 3.
  - build.sh and runtime.c are resolved from the package root (dist/..), so a
    global install works from any working directory.

- **Package hygiene, smoke test, and tag-driven release workflow**

  - package.json: `files` whitelist (dist, runtime, scripts, README.md,
    LICENSE, docs/INSTALL.md), prepublishOnly = check + build + test,
    repository/bugs/homepage at github.com/amritk/compiler, keywords,
    `npm run smoke`. The tarball drops from 583 files to 92.
  - LICENSE: MIT, "StaticTS contributors".
  - CHANGELOG.md: Unreleased section summarising every work package so far.
  - scripts/smoke.sh: builds every examples/**/*.ts with `export function
    main` using --link --profile size, runs it (expected exit from a
    `// smoke: exit <n>` comment, default 0), prints a size table, fails on
    any error. examples/hello.ts is the INSTALL.md hello world.
  - scripts/changelog-section.sh: prints one version's CHANGELOG section for
    the release notes.
  - .github/workflows/release.yml: on v* tags, calls the CI workflow
    (workflow_call added to ci.yml), checks the tag matches package.json,
    npm pack, verifies the tarball is self-contained, and attaches it to a
    GitHub release with `gh release create`. npm publish stays a commented
    step that needs NPM_TOKEN.
  - ci.yml: runs the smoke script after the tests.

- **Document installation and the release procedure; test exit codes and the tarball**

  - docs/INSTALL.md: prerequisites per OS (Ubuntu apt clang-18/lld-18, Fedora,
    macOS brew llvm@18, Windows via WSL), npm install -g, hello world through
    --link, exit-code table, troubleshooting.
  - docs/wp12-release.md: what ships, exit codes and failure modes, the smoke
    test, and the bump / changelog / tag / workflow procedure.
  - README: Setup trimmed to point at INSTALL.md; Usage lists --version and
    the exit codes.
  - tests/run.js: `WP12: exit codes` (--version, usage, ENOENT, ICE with and
    without STATICTSC_DEBUG, clang missing via an empty PATH, build.sh failure
    via a stub CC) and `WP12: package` (npm pack contents, install the tarball
    into a temp prefix, run the installed statictsc from an unrelated cwd,
    skipped without clang). 374 -> 396 checks.

- **Merge wp12/release: --version, exit-code contract, packaging, LICENSE, CHANGELOG, smoke script, release workflow**

- **Add nbody example (classes, arrays, Math in f64 mode); smoke script accepts per-example flags**

- **Add differential testing against Node: corpus, fuzzer, and a typed rewrite**

  tests/differential/run.js builds every whole program in tests/cases and
  tests/differential/corpus with statictsc --link, runs it, rewrites the same
  source to JavaScript (types from the compiler's own checker so i32/i64
  arithmetic wraps, string .length is a byte count, a[i] is bounds-checked,
  throw traps) and runs it under Node with runtime/shim.mjs, then compares
  stdout and exit status byte for byte. tests/differential/fuzz.js generates
  random integer/boolean programs; 200 programs at seed 20260906 agree.

  The corpus (50 programs) surfaced three semantic gaps, recorded in
  docs/wp13-differential.md and known-failures.txt without changing the
  compiler: Math.pow(±1, ±Infinity) returns 1 (C99) where ECMAScript says NaN,
  and INT_MIN / -1 and x / 0 are undefined (SIGFPE) where JS has an answer.

  npm test gains two checks (corpus + a 10-program fixed-seed fuzz batch);
  npm run test:diff runs the full table.

- **Nbody example: shortest round-trip literals and Math.PI (lint clean)**

- **Changelog: classes, differential testing, nbody example**

- **Consolidate the documentation: language reference, IR cookbook, architecture, FAQ, README tour**

  docs/LANGUAGE.md is the normative reference: lexical rules, the type table
  with LLVM mapping, alignment and C ABI, declarations, every statement and
  expression with its typing rule, builtins with signatures and effects, the
  semantics decisions, the complete validator forbidden list with exact
  message fragments, the checker's rejections, and a list of behaviours that
  disagree with the design notes (boolean ordering is inverted, optional
  chaining is silently accepted, -2147483648 is rejected). Every rule cites
  the test case that proves it; rules verified only by compiling a snippet
  are marked "(CLI only)".

  docs/IR_COOKBOOK.md holds, for each construct, the smallest snippet and the
  exact IR the compiler emits today. The listings are generated from
  docs/cookbook/*.ts (with .args for flags) by docs/cookbook/regen.sh, which
  rewrites the blocks between cookbook markers; --check fails when the doc is
  stale. Each attribute that appears is explained in one sentence.

  docs/ARCHITECTURE.md covers the pipeline, the side-table and dispatch-table
  design, the add-a-construct checklist, the ABI contracts with the tests
  that guard them, the runtime symbol table, the attribute soundness rules,
  the build profiles, and the test harness. docs/FAQ.md answers the design
  questions (no any, i32 default, f64 mode, no GC, calling from Node, no
  embedded engine, error format, bug reports). docs/README.md indexes every
  document and marks wp*.md as design notes. docs/check-links.mjs verifies
  every relative link and heading anchor.

  The README is now a short tour: quickstart, feature table linking into the
  reference, CLI, measured sizes, interop, milestones, contributing, license.
  Stale statements were dropped (Phase 1 wording, the -lm TODO that build.sh
  already resolves, outdated runtime sizes) and every fact moved into the
  reference documents. docs/.npmignore keeps the docs index out of the npm
  tarball, which npm would otherwise pack despite the files whitelist.
  Placeholder markers TODO(WP6)/TODO(WP9)/TODO(WP13) mark where the in-flight
  packages add their material.

- **Reject optional chaining and nullish coalescing; accept the -2147483648 literal**

  The validator now rejects ?. and ?? outright (MASTER_PLAN 3.2); the i32
  literal range check accounts for a directly negated literal so INT_MIN is
  writable. Found by the WP11 documentation audit.

- **Ordering comparisons are numeric only; refresh stale design-note text**

  `<` on booleans compiled to a signed i1 compare and reversed the JS result
  (found by the WP11 audit). Ordering now requires numeric operands; equality
  on booleans is unchanged. Design notes no longer claim -lm is missing, that
  loops are unavailable, or that export class is rejected.

- **Add --target, --nsw, and dereferenceable(24) on array pointers**

  --target <triple>|host (src/codegen/target.ts) writes `target datalayout`
  and `target triple` after `source_filename`, using the layout strings clang
  18 emits for x86_64/aarch64 Linux and macOS and wasm32, so `opt -O2` on the
  module vectorises without `-mtriple`. The default stays target-neutral.

  --nsw makes every user-level i32/i64 add/sub/mul carry `nsw` (binary
  operators, unary minus, op= on locals, fields and elements, ++/--) through
  one helper, `intOpcode` in emit/context.ts; sdiv/srem and the compiler's own
  i64 index, length and allocator arithmetic are never flagged. Signed
  overflow is then undefined as in C; the default keeps wrapping.

  Array parameters and returns gain `dereferenceable(24)`: every array value
  points at a complete `{ i64 len, i64 cap, i8* data }` header, so LLVM may
  load `len` speculatively. The eleven arr_* goldens change on their
  signature lines only.

- **Add a PGO recipe to scripts/build.sh**

  --pgo-generate adds -fprofile-generate and --pgo-use <profdata> adds
  -fprofile-use=<file> to the speed, size and napi profiles; the header
  documents the instrument / run / llvm-profdata merge / rebuild sequence and
  the compiler-rt requirement. Measured on the benchmark suite: fib(40) -19 %,
  nbody -3 % (docs/wp9-optimisation.md).

- **Add the benchmark suite, runner, and WP9 results**

  bench/: fib, nbody, spectral norm, sieve, string building and a Vec3 method
  loop, each in StaticTS, C and Rust with the same data layout and evaluation
  order (plus a naive malloc/free C string builder), every one printing a
  checksum. bench/run.mjs builds every variant (speed, --nsw, size profile,
  clang -O3, rustc -O3, rustc native), verifies the checksums agree, times
  them (min/median over 5 runs after a warm-up), measures binary size and
  peak RSS (bench/rss.c), and writes docs/BENCHMARKS.md with the CPU,
  toolchain versions and exact commands. --validate builds and compares only;
  tests/run.js runs it on fib(25) and sieve(1e5) so CI keeps the programs
  correct, and checks --target / --nsw behaviour on the new goldens.

  docs/wp9-optimisation.md records what each flag buys and diagnoses the
  three benchmarks over the 10 % target: vec3 (2.0x) and nbody (1.24x) reload
  fields because arena allocations have no provenance for alias analysis
  (an alloca or noalias experiment recovers C parity), and string building
  (1.5x) page-faults through 48 MB because the arena never frees; all three
  are WP6 territory.

- **Merge wp9/bench: benchmark suite vs C and Rust, --target, --nsw, dereferenceable(24) on arrays, PGO recipe**

  Cookbook regenerated for the new array signature attributes.

- **Add arena marks to the runtime: sts_arena_mark / release / used**

  A mark is the absolute bump address (buf + off), or 0 while the arena is
  still empty, so one i64 identifies both the chunk and the offset.
  sts_arena_release(mark) rewinds to it: within the current chunk it resets
  the offset; for a mark in an older chunk it frees every chunk pushed since
  and makes that chunk current again; mark 0 behaves like sts_reset_arena so
  a hot loop never mallocs a chunk per call; a mark in no live chunk (stale,
  undefined behaviour) is ignored rather than trusted. sts_arena_used reports
  the bytes bumped in the current chunk.

  Comments are tightened to keep runtime.c inside its 8 KB source budget
  (8187 bytes; 3351 bytes of .text at -Oz). The unit test covers all four
  release cases and a 100000-iteration mark/release loop.

- **Stack allocation, arena scopes, Arena builtins, and T | null**

  Escape-analysed stack allocation (src/codegen/escape.ts): a new C(...),
  object literal, array literal or new Array<T>(<literal>) whose value flows
  only into on-the-spot uses, non-capturing callees (the pointerParams
  fixpoint) and never-reassigned locals becomes an entry-block alloca instead
  of an arena bump; a site inside a loop is hoisted once and its slot reused,
  which is sound because nothing can name the previous iteration's object.
  Stack objects and the locals that hold them are own memory for the effect
  analysis, so object-literal and implicit-constructor functions regain
  readnone. --no-stack-alloc keeps everything in the arena.

  Automatic arena scopes: a function whose direct arena allocations (dynamic
  arrays, push growth, string temporaries, results of allocating callees) all
  flow local, with no callee leaking an allocation and no user Arena.reset /
  release in reach, marks the arena on entry and releases it before every ret.
  The facts propagate over the call graph in the existing fixpoint;
  analyzeFunctions runs it, decides, re-collects the facts with the decisions
  applied, and runs it again.

  Arena.reset / mark / release / used are dotted builtins next to console.log.

  T | null for class, interface, array and string types: the same LLVM pointer
  type, null typed by context, === null / !== null by icmp, assignability of
  T to T | null at every value sink, and narrowing to T inside if / while /
  && / || / ?: and after an early exit, dropped at any assignment to the
  variable and before a loop that assigns it. Nullable params and returns lose
  nonnull and dereferenceable; everything else is unchanged.

  Existing goldens changed only where an allocation moved to the stack or a
  function gained a scope; every native round trip is unchanged.

- **Document the memory strategy: docs/wp6-memory.md, README, changelog**

- **Checked integer division (Rust semantics) and ECMAScript-accurate Math.pow**

  Integer / and % now branch to a cold sts_panic_div block on a zero divisor
  or MIN / -1 instead of executing sdiv/srem with a poison result; the
  affected goldens gained the div.fail/div.ok blocks. Math.pow selects NaN
  for pow(x, NaN) and pow(±1, ±Infinity) around llvm.pow.f64. A directly
  negated 2147483648 is accepted in contextual i32 positions too. Both gaps
  were found by the differential harness; the panic cases are listed as
  by-design differences from Node.

- **Re-run benchmarks after WP6, changelog for WP9, tighter runtime.c comments**

  vec3 2.02x -> 0.95x of Rust, nbody 1.24x -> 1.11x with stack-allocated
  non-escaping objects; string building stays at 1.9x because returned
  temporaries escape the automatic arena scopes (noted in the analysis).
  runtime.c comments trimmed (8,293 B source, 3,498 B .text at -Oz).

- **Docs consolidation for release; fix the last audit findings**

  README back to the WP11 outline with every still-true fact moved into the
  reference; LANGUAGE.md, ARCHITECTURE.md, FAQ and the IR cookbook cover
  memory model, T | null, checked division, --nsw/--target and differential
  testing. Code: main-parameter message no longer references argv, the
  statictsc.h number-formatting comment is current, 2^53 is accepted as an
  i64 literal, and comparing T | null with T names the nullable side.

- **Accept Int32Array/Float64Array/BigInt64Array as aliases of i32[]/f64[]/i64[]**

  The typed-array names are the StaticTS spellings of the element-typed
  arrays a Node host passes. They resolve to the same StaticType as `i32[]`,
  `f64[]` and `i64[]` (`TYPED_ARRAY_ALIASES` in types.ts), so there is no
  second layout and no conversion: a `Float64Array` parameter accepts an
  `f64[]` argument, `push` works, and `sameType` holds. `new Int32Array(n)`
  and friends register `newCheckers` entries that share the `new Array<T>(n)`
  checker with `T` fixed by the name and reuse `newEmitters.Array`, so the
  lowering is byte for byte the existing header + `llvm.memset` sequence. A
  type argument on an alias is rejected in both positions.

  The differential rewrite treats `new Int32Array(n)` like `new Array<T>(n)`
  (a zero-filled plain array) so Node sees the same values.

  Goldens: arr_typed_views (aliases in every position, native output),
  reject_arr_typed_view_typearg, reject_arr_typed_view_type_annotation_arg,
  reject_arr_typed_view_mismatch. LANGUAGE.md types table and `new` section.

- **Add sts_alloc_array and a freestanding wasm runtime for arrays**

  `sts_alloc_array(elemSize, len)` is a host entry: header plus `len`
  uninitialised elements, `len == cap`, from the arena. Compiled code never
  calls it (literals and `new Array` use the inline allocator); the wasm
  loader and C hosts do, so it is declared in runtime.ts (part of the
  `--runtime-decls` prelude, hence the cookbook line) and in statictsc.h,
  and exercised by runtime_test.c. runtime.c grows from 8,293 to 8,594 bytes
  of source and from 3,498 to 3,600 bytes of .text at -Oz (budget 4 KB).

  runtime/runtime_wasm.c is the subset the wasm profile can link without
  libc: linear memory past `__heap_base` is one arena chunk grown with
  `memory.grow`, `sts_alloc_struct`/`sts_arena_grow`/mark/release/used,
  `sts_alloc_array`, `sts_array_grow` (`__builtin_memcpy`, lowered to
  memory.copy), and the panics as `unreachable` (a RuntimeError in the host).
  Field widths follow the IR contract (`i64 off`/`cap`, and `sts_arena_grow`
  takes a `uint64_t`), not size_t, because wasm32 pointers are 4 bytes and
  the inlined fast path bumps the 64-bit field directly. The wasm profile now
  passes `-mbulk-memory` so the `llvm.memset` behind `new Array<T>(n)` lowers
  to memory.fill instead of an undefined `memset`.

  statictsc.h documents the array header contract for hosts: `const
  sts_array *` for read-only parameters, a stack-built header to pass a host
  buffer, borrowed for the call only.

- **Marshal typed arrays and strings across the wasm and N-API boundaries**

  Interop generators (src/interop) now bridge arrays with i32/f64/i64
  elements, which JS sees as Int32Array/Float64Array/BigInt64Array, plus
  strings and i64 (bigint) through the addon.

  abi.ts: `externalFunctions` runs the attribute analysis once and records
  which array parameters a function stores through (the same fixpoint that
  decides `readonly` in the IR); `cType` spells those `sts_array *` and every
  other array parameter `const sts_array *`. `typedView` maps element kinds to
  the JS constructor, element size and N-API tag; `tsKeyword` prints arrays.

  header.ts: arrays get prototypes with the const rule and a comment naming
  the C element type. A -Werror C driver in tests/run.js passes a stack-built
  header over an int32_t buffer to `sumI32` and `fill` and reads a returned
  array.

  dts.ts + wasm.ts: the .d.ts declares typed-array signatures and, when a
  function uses arrays, the runtime exports; `--emit-dts x.d.ts` also writes
  x.mjs, the loader that implements `load()`. Per call it marks the arena,
  copies each typed array into `sts_alloc_array` storage through a view on
  memory.buffer (offset 16 is the data pointer on wasm32), calls the raw
  export, copies an array result out (`.slice()`, since memory.grow detaches
  views), copies written-through parameters back so wasm agrees with the
  borrowing addon, and releases the arena in a `finally` so a trap leaks
  nothing. Scalar-only exports pass through; add.wasm stays 279 bytes.

  napi.ts: a typed-array argument is borrowed, not copied: the shim checks
  the kind with napi_get_typedarray_info and builds the sts_array header on
  the C stack over the JS bytes, so writes through the parameter land in the
  caller's buffer; the callee must not retain it. Results are fresh typed
  arrays (napi_create_arraybuffer + memcpy + napi_create_typedarray). String
  arguments are measured and copied into arena sts_str values, string results
  go through napi_create_string_utf8, i64 uses the bigint getters. Every
  function that touches the arena brackets the call with sts_arena_mark /
  sts_arena_release, on the failure paths too, so hosts never reset it for
  bridged calls. Unbridgeable signatures are still listed as skipped.

  Examples: examples/arrays.ts; node-host.mjs uses the companion loader when
  <module>.mjs sits next to the .wasm and accepts `f64:1,2,3`-style typed
  arguments; node-addon.mjs demonstrates zero-copy `fill` and typed results.

  Bench: sumArray(Float64Array) rows in bench/ffi.mjs. One call with 1M
  elements runs at 0.54 ns/element through N-API (borrowed) and 1.13 through
  wasm (copied in) against 0.96 for the JS loop; docs/wp8-interop.md carries
  the measured table.

  tests/run.js: arrays header/.d.ts/.mjs checks, the C driver, wasm and
  N-API round trips that must agree value for value (fill in place, i64,
  1M-element batch, trap recovery), strings through the addon, both example
  hosts; runtime_wasm.c compiles for wasm32 under -Werror -pedantic; tsc is
  resolved through require so a worktree without node_modules finds it.

- **Add multi-error reporting, --json diagnostics, AST/checked dumps and -g debug info (WP10)**

  Multi-error reporting: the parser, the Phase 0 validator, signature
  collection, import binding, symbol-clash detection and body checking hand
  every CompileError to one DiagnosticSink (src/diagnostics.ts) instead of
  throwing on the first. Recovery is per forbidden construct (a rejected
  node's subtree is skipped), per declaration (a rejected class/interface is
  marked poisoned so its layout checks are skipped) and per statement at the
  innermost statement list (the enclosing function is marked poisoned and
  its definite-return check is skipped). Between phases the sink sorts what it
  collected by file (load order) and position and throws the first error with
  the rest attached as `additional`, so pass 2 never runs over broken
  signatures, the emitter never sees a poisoned program, and every caller
  that only knew single errors still gets the exact message it always got.
  `let x: T = <rejected>` still declares `x` as `T` so later uses do not
  cascade. The driver prints at most 20 errors, then `...and N more errors`
  and an `N errors` line; a lone error prints byte-for-byte as before.

  --json prints one {file, line, column, endLine, endColumn, severity,
  message} object per error on stdout, nothing else, same exit code.

  --emit-ast prints every module's syntax tree (SyntaxKind with real token
  names, 1-based start-end positions, identifier and literal text);
  --emit-checked prints the checker's side tables and attribute facts
  (structs with layout, functions with resolved signatures, facts,
  pointer-parameter facts, locals with types, callees). Both go to stdout
  and suppress IR; goldens compare a `.stdout` sidecar.

  -g (src/codegen/debug.ts) emits `!llvm.dbg.cu`, the module flags, a
  DICompileUnit (DW_LANG_C99) and DIFile, a DISubprogram per function
  (attached via a new IRFunction.subprogram), a DILocation on every
  instruction (IRFunction.setLocation; `emit` appends `, !dbg !N` while a
  location is active; the emitter sets it around each statement and
  expression and restores it after), llvm.dbg.value for parameters and
  llvm.dbg.declare for let/const and for-of slots, with int/long/double/
  bool/char* basic types, DICompositeTypes for classes and interfaces with
  the checker's offsets and for `T[]` headers with `data` typed `T*`.
  Without -g the IR is byte-identical (every golden unchanged). `--link -g`
  passes -g to scripts/build.sh, which compiles every input with -g and
  skips the strip step of every profile.

  Tests: reject_multi_error / reject_multi_forbidden / reject_multi_decl
  (`.err` may now list several fragments), dump_ast and dump_checked
  (`.stdout` goldens), dbg_locals (-g golden, verified and run natively), and
  a WP10 block that checks the 20-error cap, --json, opt -passes=verify on
  the -g IR, and that a `--link -g` binary (debug and speed profiles) has a
  DWARF line table naming the .ts file under llvm-dwarfdump or objdump
  (visible SKIP when neither exists).

- **Add single class inheritance via struct prefix (WP2b)**

  `class D extends B` lays %struct.D out as B's fields followed by D's own,
  at the same natural alignment (the checker copies the base FieldInfos,
  indices and offsets included, then runs the ordinary layout over the
  flattened list), so a %struct.D* is a valid %struct.B* after one bitcast.
  A derived field may reuse the base's tail padding, which the layout test's
  C twins list flattened (classes K, L, M) rather than nesting the base.

  Lowering:
    D -> B          a coercion on the expression, like class -> interface;
                    the emitter core inserts `bitcast %struct.D* to %struct.B*`
                    at every value sink (initializer, assignment, argument,
                    return, field store, ternary arm, B[] literal element,
                    xs[i] = d, xs.push(d), B | null)
    d.m()           resolved by the receiver's declared type or its nearest
                    ancestor declaring m (findMethod); `this` is bitcast to
                    that class: static dispatch, no vtable
    super.m()       `this` seen as the base type; SuperKeyword is bound to
                    the `this` local so the attribute analysis tracks the flow
    super(args)     `call @B.constructor(%struct.B* <bitcast this>, args)`
                    after storing the initializers of constructor-less
                    ancestors in between; emitted in the constructor prologue
                    when omitted (allowed only when no ancestor constructor
                    takes parameters); required as the first statement,
                    with no `this` in its arguments
    new D(args)     a class without a constructor inherits the nearest
                    ancestor's: own initializers, then the base construction

  Rules: extends names one class of the same module (not an interface, an
  import, itself or a descendant); an exported class extends an exported
  class; no redeclared fields; an override keeps the signature; readonly
  fields are assignable only in the declaring class's constructor;
  `implements` checks the flattened layout and is inherited. Definite
  assignment covers the class's own fields, the inherited ones once super()
  ran. dereferenceable(N) keeps the declared parameter type's size (a
  derived object is at least as large); the flow of `this` into the base
  constructor is recorded per derived constructor by collectFacts.

  Also fixed on the way: a `new C(...)` whose constructor captures `this`
  no longer becomes an alloca (escape.ts consults the constructor's `this`
  facts), and `new C(...)` in an interface- or base-typed position allocates
  and constructs C (intrinsicType) instead of the target type; field
  initializer constants are emitted from the literal and the field type so
  an inherited or imported initializer needs no type-table entry.

  The C header now declares every class and interface as a struct with the
  flattened fields and every method/constructor as Class_method(struct
  Class *, ...) bound with STS_SYMBOL; the layout harness static-asserts the
  header's sizes. The differential rewrite makes the implicit super() call
  explicit for Node; cls_extends_override is a known failure (static
  dispatch). runtime.c is unchanged (8,293 B).

- **Add process.argv, parseInt/parseFloat/Number, and a wasi build profile**

  process.argv is a namespace property typed string[]. The entry wrapper
  @main calls sts_argv_init(i32 %argc, i8** %argv) as its first statement
  whenever any module of the program reads it (the checker records usesArgv,
  the Compilation copies it onto the entry program), and every read lowers to
  `load %struct.sts_array*, %struct.sts_array** @sts_argv, align 8`, an
  external global declared per module. The runtime builds the array once with
  malloc (header, pointer vector, one block per string) so Arena.reset can
  never free it; index 0 is C's argv[0], the program path. It is a memory
  read (readers are at most readonly) and read-only at the language level:
  element stores, op=, ++/-- and push are rejected, and any use in a program
  without `export function main` (a wasm or N-API library) is a compile error,
  since only the wrapper has argc/argv; the Compilation tells every checker
  whether the entry has main before bodies are checked.

  parseFloat(s): f64, Number(s): f64 and parseInt(s): i32 lower to one
  runtime symbol, `double sts_parse_number(i8* s, i32 mode)` (mode 0, 1, 2);
  parseInt is followed by llvm.fptosi.sat.i32.f64, so no digits give 0 (NaN
  has no i32) and out-of-range values saturate like toI32. The runtime lets
  strtod/strtoll do the correctly rounded work after ruling out the spellings
  JavaScript rejects (inf, infinity, nan); the parameter is readonly nocapture
  but the function's effect is write (errno). Number(x) on i32/i64 is sitofp,
  on boolean uitofp, on f64 nothing, and a literal argument is typed f64.
  Documented deviations: ASCII whitespace only, parseFloat reads a 0x prefix
  as hex like strtod, no 0b/0o in Number, parseInt has no automatic hex.

  --profile wasi links runtime.c against wasi-libc for --target=wasm32-wasi
  (sysroot from WASI_SYSROOT or the usual locations; compiler-rt's wasm32
  builtins from clang's resource dir, next to the sysroot, or WASI_BUILTINS,
  since wasi-libc's strtoll needs __multi3). runtime.c compiles clean for
  wasi with -Werror: getpid, which WASI lacks, is replaced by the monotonic
  clock for the RNG seed, and a weak asm-labelled bridge defines
  __main_argc_argv (what wasi-libc's _start calls) in terms of the IR's
  @main. examples/wasi-host.mjs runs the module under Node's node:wasi;
  tests/run.js builds argv_echo for wasi and compares the output when a
  sysroot is installed, and prints `skipped: no WASI sysroot` otherwise.

  Runtime size at -Oz (`size` text column): 3,498 -> 4,093 bytes (budget
  4,096; .text section alone 2,172 -> 2,583). Tests: argv_echo (+ .argv side
  file support in tests/run.js), parse_numbers, five reject_* cases,
  link/argv_import and link/argv_no_main, runtime_test.c parsing and argv
  cases, three differential corpus programs with shim equivalents
  (process.argv -> process.argv.slice(1)), and the `// smoke: argv` hook for
  examples/argv.ts.

- **Add agent and contributor guidelines under .claude/**

  Carry the shared house rules from the mjst, mini and agent-ummo repos into
  this one: comment and JSDoc guidelines, TypeScript principles, the testing
  style, an architecture map, and root CLAUDE.md / AGENTS.md entry points,
  plus the Biome editor settings and a PR template.

  The rules are adapted rather than copied verbatim where this codebase is
  deliberately different: it is a Node + npm package rather than a Bun
  monorepo (so node.md replaces bun.md), it uses function declarations,
  interfaces and a few stateful classes throughout (typescript.md says so
  instead of contradicting every file), and its tests are golden .ll cases
  driven by tests/run.js rather than a unit-test framework (testing.md
  describes the harness and what every construct must ship with). Every
  example and prefix named in the files was checked against src/ and
  tests/cases/.

- **Make the TypeScript rules and Biome lint follow the language**

  Rewrite .claude/typescript.md around the two kinds of TypeScript in the
  repo. For StaticTS programs (examples, cookbook, bench, test cases) the
  language reference is the style guide, and the file restates its shape:
  function declarations only, annotated signatures, no casts, no unions
  beyond T | null, strict equality, boolean conditions, no ?. or ??. For
  the compiler source the rule is to write it as StaticTS would have it
  wherever that costs nothing, and to keep the dynamic parts at the
  typescript API boundary, where a SyntaxKind-keyed table is the proof for
  a cast.

  Port the sibling repos' Biome lint set and extend it with the rules that
  mirror the validator: noVar, noExplicitAny, noEnum, noNamespace, noVoid,
  noParameterAssign, useExplicitLengthCheck, useConsistentArrayType and
  useFilenamingConvention (kebab-case for the compiler, snake_case for
  StaticTS programs). useOptionalChain and useExponentiationOperator are
  turned off because they push code towards ?. and **, which the language
  rejects. The example, cookbook and benchmark programs are now linted too,
  with the unused-variable and numeric-literal rules off for them; test
  fixtures stay out of scope because a reject_* case exists to contain what
  the rules forbid. The sibling formatter settings (single quotes, no
  semicolons) are deliberately not carried over.

  Bring the tree to green under the new rules: the seven unwrapParens-style
  cursors reassign a local instead of the parameter, and the truthy .length
  checks become explicit comparisons. No behaviour changes; the full suite
  passes.

- **Bring runtime.c back inside its size budget**

  runtime/runtime.c compiled at -Oz (`size` text: code, read-only data and
  .eh_frame) goes from 4,195 to 3,714 bytes and the source from 11,432 to
  9,392 bytes, with no observable change: every prototype, symbol, message,
  exit status and output byte is the same, and tests/runtime_test.c asserts
  exactly what it did before.

  Measured step by step (text at -Oz, kept only when it paid):
  - One cold exit path: sts_die is noreturn/cold/noinline; sts_panic_index
    and sts_io_fail format with one dprintf each instead of digit loops and
    four write calls; sts_panic_div picks its literal and calls sts_die.
    4,195 -> 3,981. (A variadic vdprintf sts_die was larger: 4,072.)
  - sts_str_from_f64 indexes the %.*e buffer in place (DIG macro), uses the
    round-trip search counter as the digit count, and emits all four JS
    layouts from one digit loop plus snprintf("e%+d") for the exponent form.
    3,981 -> 3,738. Fuzzed against Node String(x) on 40,024 doubles.
  - reset/free/release share sts_free_until: 3,738 -> 3,723.
  - sts_put_file checks the descriptor before the loop: -> 3,719.
  - sts_read_file accumulates the count in a local: -> 3,714.
  Rejected after measuring: one-malloc argv table (3,775), strtod-first
  parse_number (3,761), sts_io_fail as a macro (3,755), folding sts_io_fail
  into a three-argument sts_die (3,723), cold on the exported panics (0).

  The source pass (casts on implicit conversions, one macro each for the
  out-of-memory literal and the cold attribute list, NAN/INFINITY from
  math.h, contract-only comments) leaves every function's compiled size
  identical; three rewrites that moved code generation were reverted.

  scripts/size-report.sh prints a `runtime` row (the budget number) above
  the profile rows. docs/wp9-optimisation.md gets a "Runtime budget"
  section with the before/after table and the per-step numbers.

- **Adopt type aliases and arrow functions as the house style**

  Record the sibling repos' two conventions for the compiler's own source
  and wire up the lint that enforces them:

  - useConsistentTypeDefinitions asks for `type` over `interface`, and
    useConsistentMethodSignatures for a property rather than method
    shorthand, which is also checked contravariantly.
  - Biome ships no rule for `function` declarations (useArrowFunction only
    rewrites function expressions), so biome-plugins/no-function-declaration.grit
    is a GritQL plugin asking for an arrow bound to a const.
  - useArrowFunction, useShorthandFunctionType and useConsistentArrowReturn
    are clean today and are errors.

  The three rules with a backlog are warnings, not errors: the source
  predates them, warnings do not fail biome check, and the count is the
  size of the migration that is left. Nothing is converted here.

  An override exempts StaticTS programs from all of it. The language has
  neither arrow functions nor type aliases, so `function` and `interface`
  are the only spellings available in examples, cookbook and bench.

  Correct the claim that StaticTS forbids those constructs. Phase 0 lets
  both through and rejects only generic type parameters on them; it is the
  checker's Unsupported-in-Phase-1 fallback that refuses them, which is the
  bucket a later work package empties. What is forbidden by design is the
  Function type, because an indirect call through a function pointer ends
  the whole-program purity, termination and escape analysis.

- **Re-run benchmarks and tidy the changelog for the merged wave**

  Benchmarks measured with 15 timed runs after 3 warm-ups; a 5-run batch was
  too noisy in this environment to compare against Rust. Move the memory
  strategy entry back into the Added section and the link reference to the
  end of the file, where a merge had left them out of order.

- **Use an explicit length check in the header emitter**

  The house lint rules added on main flag a truthy .length test as an error.

- **Re-roll fuzzer seeds that generate invalid TypeScript**

  The generator can emit a comparison of the shape `a < b > (c)`, which
  TypeScript parses as a type-argument list; tsc rejects those programs at the
  same positions statictsc does, so they compare nothing. Parse each generated
  program and re-roll the seed while it has a syntax error, deterministically,
  so a saved failure still reproduces from its seed.

- **Add module-level const declarations**

  A top-level `const NAME: T = <constant expression>` names a value the
  compiler already knows. It is not a global variable: the checker folds the
  initialiser and every use site carries the value, so no symbol, no
  initialiser and no relocation is emitted, and the rule that a module has no
  top-level code — and therefore no initialisation order — still holds. An
  imported constant folds the same way in the importing module, so
  `export const` costs no `declare`.

  The initialiser is an ordinary StaticTS expression restricted to literals
  and other constants: exactly the operators of docs/LANGUAGE.md, over
  literals, module constants and parentheses. A constant that could compute
  something a runtime expression cannot would be a second, larger language
  hiding inside the first, so bitwise operators are absent here for the same
  reason they are absent everywhere else.

  Folding follows the language's own arithmetic. Integer arithmetic wraps at
  the declared width, so `2147483647 + 1` is `-2147483648` as the emitted
  `add` would give; a bare literal takes the width of the constant it
  initialises, so `const BIG: i64 = 1000000000 * 10` is computed in 64 bits;
  `f64` folds in IEEE-754; `+` on two strings concatenates and interns once.
  The two failures the emitted divisor check catches at run time are refused
  at compile time instead. A value that does not fit its annotation is an
  error rather than a wrap.

  Folding is lazy and memoised on the ConstInfo, so a constant may name one
  declared later in its module or in a module checked afterwards, and a cycle
  is diagnosed rather than recursed into.

  The differential rewriter substitutes a constant's folded value for its
  initialiser when rewriting to JavaScript, which is the faithful translation
  — the value is the whole of what the constant is — and carries the wrapping,
  the i64 width and the folded concatenation across for free.

  `--emit-checked` prints each constant's folded value, and an imported one is
  named on its `import` line.

- **Start self/ with the token kinds of StaticTS-0**

  The first module of the self-hosted compiler: the token kinds the lexer, the
  parser and the diagnostics all have to agree on. They are module constants
  because the language has no `enum`, and because a magic number repeated at
  forty use sites is how a bootstrap compiler starts to rot.

  The kinds are contiguous from zero so a later dispatch can switch on them
  densely, and the keywords are grouped so `isKeyword` is one range check
  rather than a table.

  `tests/run.js` grows a WP14 section: stage0 must compile every module of
  `self/` cleanly, and `self/tokens.ts` must emit no global. The second check
  is the point of module constants — if a token kind ever became a global, every
  use would cost a load on the lexer's hot path. Today the 74 constants compile
  to no IR at all, and the module's only content is `isKeyword`.

  The section is a compile gate until stage1 exists, and it fails the moment
  `self/` reaches for something the language does not have.

- **Add the bitwise operators**

  `& | ^` lower to `and` / `or` / `xor`, `~x` to `xor x, -1` (LLVM has no
  `not`), and `<< >> >>>` to `shl` / `ashr` / `lshr`, with the compound forms
  `&= |= ^= <<= >>= >>>=` going through the same load-apply-store the `+=`
  family uses on a mutable local. Operands are two `i32` or two `i64` of the
  same type, one for `~`.

  Shift counts are masked to the operand width, which is the decision that
  shapes the lowering. LLVM makes a shift at or beyond the width poison;
  JavaScript masks the count, so `x << 33` is `x << 1`. We follow JavaScript:
  `a << b` on `i32` is `shl i32 %a, (%b and 31)` and on `i64` `shl i64 %a,
  (%b and 63)`. A constant count is masked in the emitter and written out as the
  masked literal, so `x << 3` stays one instruction and no `and` reaches the IR;
  a negative literal is masked the same way (`-1` becomes 31), and the fold is
  done on the AST so the negation never emits a dead `sub`. That makes the i32
  shifts exactly JavaScript's and removes a UB footgun from a language whose
  premise is that a program that compiles has known behaviour.

  `>>>` on `i32` diverges from JavaScript by design: JS produces an unsigned
  32-bit value inside a double, so `-1 >>> 0` is `4294967295`, while an `i32` is
  signed and the raw bits read back as `-1`. That is the same choice the language
  already makes when integer arithmetic wraps instead of promoting; the
  differential rewriter appends `| 0` to an i32 `>>>` so Node and the native
  binary agree, and routes the i64 shifts through new shim helpers because BigInt
  neither masks its counts nor has `>>>` at all.

  `f64` is refused because StaticTS never converts implicitly, with the
  `--number-mode f64` flag named in the message when that is why `number` is a
  double; `boolean` is refused with the operator that does the job instead
  (`&&`, `||`, `!==`, `!`), since JavaScript's `true & true` is the number 1 and
  there is no truthiness here to turn it back.

  None of these has a panic path, unlike `/` and `%`, so a function whose
  arithmetic is all bitwise keeps `readnone` and `willreturn`; `bit_attributes`
  pins that. Eight golden cases, five `reject_bit_*` cases, four differential
  corpus programs (including an FNV-1a hash loop), the LANGUAGE.md rules and
  semantics decisions, and two cookbook entries come with it.

- **Replace the self-hosting gap list with a measured one**

  The plan's gap list ended in "whatever the port turns up", which is the part
  most likely to bite. It is now derived from two independent sweeps that agree:
  a census of all 53 files of src/ (every library facility, every string and
  array method, with call-site counts) and a set of probe programs compiled
  against today's language to find what it actually refuses.

  Three things the guess had missed:

  f64ToBits is a blocker. LLVM only accepts decimal float literals that round
  trip exactly, so the emitter writes `double 0x400921FB54442D18` — today via
  Buffer.writeDoubleBE. StaticTS cannot see a double's bits, so without one
  bitcast the self-hosted emitter cannot emit any f64 constant at all.

  Diagnostics go to stderr. All 16 of them, and two dumps write without a
  trailing newline; console.log is stdout-and-newline only. Two five-line
  runtime functions, or every .err golden gets re-baselined.

  readFileSync exits the process on a missing file, so a compiler cannot turn
  it into its own `Cannot find module` diagnostic and carry on loading the
  other imports.

  join is promoted from convenience to requirement with a number: building
  88 KB of IR text by repeated `+` costs 180 MB of peak RSS, because every
  concatenation allocates a fresh copy and the arena never reclaims. A
  self-compile emitting a megabyte that way would need tens of gigabytes.

  Also records the five decisions the census forces — error recovery without
  try/catch being much the hardest, at 292 throw sites against six catches,
  every one of them load-bearing — and what is deliberately not being added,
  with the reason.

  Two gaps found by probing are fixed here. An empty array literal now takes
  its element type from a field assignment target, so `this.children = []` in
  a constructor works; every container class hits that on its first line. And
  the un-narrowed-nullable diagnostic now recognises a field or element
  receiver and names the binding idiom with the reader's own expression,
  instead of telling someone who just wrote a null check to write a null
  check.

  Performance is recorded as the tiebreaker for language decisions, with the
  worked examples that make the rule concrete rather than decorative —
  including one where reading the generated assembly showed a semantics choice
  was free, and the rule that says to go and read it.

- **Add the performance work package**

  Records the northern star and what follows from it: fastest binary first,
  smallest binary second, with "faster" meaning measured rather than assumed.

  The bounds-check answer is a proof pipeline, not a flag. Ranged integer
  types, length-narrowing guards that promote an array to a tuple, and
  slice iterators that lower for...of to pointer advancement, with the
  runtime panic kept as the floor for what none of them prove. An explicit
  opt-out is deferred on purpose: every check the proofs eliminate is one
  nobody needs to escape, so it is worth counting the survivors first.

  Two flags become defaults. --strict-exports wins on speed and size at
  once. --nsw is the larger change and is written down as such: it
  withdraws the documented wrapping guarantee, so --wrapping exists to
  restore it, the differential corpus that relies on wrapping runs with it,
  and every affected golden is re-pointed deliberately rather than deleted.

  Error handling is a discriminated Result<T, E> lowered to a tagged union
  in registers, which needs full monomorphised generics, unions beyond
  T | null, and narrowing on a boolean discriminant. Unsigned u8 through
  u64 come with it, and retire the signed-bits reading of >>>.

  All of it is enforced rather than documented: a performance diagnostic
  class, on by default and never affecting the exit code, that fires when
  the compiler had to take a slow path and a faster one existed. The
  obligation that comes with being on by default is that every warning must
  name a concrete rewrite, because a warning nobody can act on teaches
  people to ignore the class.

- **Add f64ToBits/bitsToF64 and fix prototype names in dispatch tables**

  f64ToBits and bitsToF64 reinterpret a double's 64 bits rather than
  converting its value: toI64(1.5) is 1, f64ToBits(1.5) is
  0x3FF8000000000000. They exist because a compiler emitting LLVM IR has no
  other way to write a float constant — LLVM accepts only decimal float
  literals that round-trip exactly, so every other double must be emitted as
  its bit pattern, which src/ does today through Buffer.writeDoubleBE. Both
  lower to one bitcast: no call, no memory, no runtime symbol, and a function
  that only reinterprets bits stays readnone. Identified as a blocker by the
  census in docs/wp14-selfhost.md (B1).

  Writing the test turned up a real bug. The validator, checker and emitter
  are each a dispatch table keyed by name, and the key comes from the program
  being compiled. A plain object literal inherits from Object.prototype, so a
  program declaring `function valueOf` found Object.prototype.valueOf sitting
  in the table and used it as a handler — which is how `error: function
  valueOf() { [native code] }` came to be a compile diagnostic. The same held
  for toString, constructor, hasOwnProperty and their siblings, as a function,
  a class, or a local, and for `new constructor()`.

  All ten user-keyed lookups now go through src/lookup.ts. It is a function
  rather than a comment at each site so a new table cannot quietly
  reintroduce the bug: the rule is that a table indexed by user text is read
  through `lookup`.

  Contextual typing of non-integer literals also reaches two more positions,
  both found by writing the differential corpus program for the bit builtins:
  an array-literal element and a field assignment target, so
  `const xs: f64[] = [0.5]` and `this.ratio = 0.25` compile in the default
  i32 number mode instead of being rejected as non-integer literals.

  The differential shim reads the bits through a DataView, which is the only
  way JavaScript can see them, so Node and the native binary agree bit for
  bit across zero, the signed zeros, pi, and the extremes of the range.

- **Add unsigned integer types u8, u16, u32 and u64**

  LLVM has no unsigned types, so u8/u16/u32/u64 lower to i8/i16/i32/i64 and
  the signedness lives entirely in the operations. Representing an unsigned
  value therefore costs nothing, and a u8 field packs a struct exactly as a
  C uint8_t does (tests/layout adds a fifth-width struct pinned against
  clang).

  The lowering, per operation:

    + - *, unary -, ++/--   add / sub / mul, unchanged (two's complement)
    / %                     udiv / urem
    < <= > >=               icmp ult / ule / ugt / uge
    >>                      lshr (ashr on a signed type)
    widening conversion     zext (sext on a signed source)
    narrowing conversion    trunc
    to / from f64           uitofp / llvm.fptoui.sat
    Math.abs                nothing: the value is its own magnitude
    Math.min / Math.max     llvm.umin / llvm.umax
    console.log, `${x}`     zext to i64, then sts_str_from_u64

  `signedOpcode` in emit/arithmetic.ts is the single place that swaps a
  signed opcode for its unsigned twin, so every construct that computes with
  integers -- binary operators, `op=` on locals, fields and elements --
  picks the right instruction without its own branch.

  Two consequences are worth calling out. The divisor check gets cheaper:
  unsigned division has no MIN / -1 case, so its check collapses from three
  compares plus an `and` and an `or` to a single `icmp eq ..., 0`
  (tests/cases/u_div_one_check pins both sequences side by side, and
  u_div_zero_panic proves the cheaper check still fires). And a conversion
  between two integers of the same width and different signedness emits no
  instruction at all, because the bits do not move.

  Overflow wraps, as it does for the signed widths. `--nsw` now takes the
  operand type: it emits `nuw` on an unsigned add/sub/mul and `nsw` on a
  signed one, since a u32 passing 2^31 has not overflowed and `nsw` there
  would poison an ordinary result.

  toU8/toU16/toU32/toU64 join the conversion builtins, and the contextual
  literal machinery gains the range check that makes `const b: u8 = -1` and
  `const b: u8 = 256` errors naming the width. While there, `contextType`
  learns four more contexts a literal can take its type from -- an array
  literal element, a class field initializer, a constructor argument, and a
  field or element assignment target -- which is what lets a u8 be written
  at all, and fixes the same gap for i64.

  Shifts `>>` and `>>>` are new. Both take two operands of one integer type.
  `>>` is ashr on a signed type and lshr on an unsigned one; `>>>` is always
  lshr, so the two are synonyms on an unsigned type and code generic over a
  width may spell either. `i32 >>> n` keeps its documented behaviour of
  yielding the raw bits read as signed (-1 >>> 0 is -1, not JavaScript's
  4294967295); with u32 that answer is now reachable, which is the wart this
  change retires. A literal shift amount at or beyond the width is a compile
  error, since LLVM makes a wider shift poison and masking it would cost an
  `and` on every shift for a case that is always a bug.

  Interop: --emit-header spells the widths uint8_t .. uint64_t and --emit-dts
  number / bigint (u64 as a bigint, following i64). The N-API shim keeps its
  own reader table and reports an unsigned signature as not bridged, as it
  already does for anything it cannot marshal.

  Runtime: one new symbol, sts_str_from_u64, sharing the signed formatter's
  digit loop through a static str_from_digits(value, negative) helper so the
  four widths need one function rather than four. .text at -Oz goes from
  3,714 to 3,765 bytes, inside the 4,096-byte budget.

  Differential testing covers all four widths against Node. JavaScript has no
  unsigned integers, so the rewriter masks each result back into its width
  (& 0xFF, & 0xFFFF, >>> 0, BigInt.asUintN(64, x)) and routes any conversion
  with an unsigned side through one shim helper that performs the whole
  sext/zext/trunc matrix through BigInt.

- **State the paradigm, and give constructor arguments literal context**

  The project's paradigm is data-oriented and procedural, and it is a
  deliberate "neither" rather than a compromise: pure OOP puts a pointer
  chase between the CPU and the data, pure FP puts an allocation between
  them, and a compiler targeting bare-metal speed and small binaries cannot
  afford either. Flat structs in contiguous memory, top-level functions LLVM
  inlines, explicit mutation, and functional idioms only where they remove
  runtime work.

  Most of that is already what StaticTS is, so wp15 §1a is written as a frame
  with an enforcement table rather than as a change: classes are already flat
  C structs with no prototypes and no vtables, functions are already top-level
  and their purity is computed rather than declared, and closures are
  forbidden outright rather than merely restricted. Inheritance chains stay
  allowed at any depth, having been considered for restriction and left
  alone — the struct-prefix layout is correct at depth and costs nothing, and
  a rule with no cost behind it is just a rule.

  The one place the language was not data-oriented is recorded as §2a:
  Point[] stores one pointer per element, so iterating it chases a pointer
  per element and scatters the fields across memory — the exact pattern the
  paradigm exists to avoid, sitting in the middle of the language. Struct
  arrays become contiguous, with the use-after-free that growth introduces
  made a compile error rather than waved away.

  Also fixes the third contextual-typing gap found by probing: a constructor
  argument now gives a non-integer literal its type, so `new Point(1.5, 2.25)`
  compiles in the default i32 number mode. The array-element and
  field-assignment cases landed in the previous commit; this completes the
  set, and the test case now covers all three.

- **Add the 32-bit float type f32**

  f32 is LLVM's `float`, and every operation is the instruction f64 already
  uses one width down: fadd/fsub/fmul/fdiv/frem, fcmp o*, fneg. Float
  division stays unchecked (the divisor check is an integer rule). A struct
  of f32 is half the footprint of one of f64 and gives twice the SIMD lane
  count, so it serves the speed and the size goal at once: the layout test
  gains `{f32, f64, f32, bool}` at 24 bytes, pinned against clang, and
  `class Vec3 { x: f32; y: f32; z: f32; hits: u32 }` is 16 bytes where three
  doubles alone would be 24.

  Most of the change is turning `kind === "f64"` into a new `isFloat`
  predicate at the dozen sites that meant "floating point" rather than "the
  double width" -- the opcode table, compound assignment on locals, fields
  and elements, ++/--, `+` and `===` in the string-aware handlers, the array
  index widening, and the DWARF basic types.

  Conversions: `toF32` joins the builtins, `fptrunc` narrows from an f64 and
  `fpext` widens back, an integer converts in with sitofp or uitofp by the
  *source's* signedness, and out through the saturating
  llvm.fpto{s,u}i.sat.<T>.f32. As with every other numeric type there is no
  implicit conversion, so `f32 + f64` is the same same-type error as
  `u32 + i32`.

  Constants are the part that would have broken silently. LLVM writes a
  `float` constant with the 64-bit hex of the double it equals and requires
  that double to be exactly representable as a float, so `f32Constant` rounds
  through `Math.fround` before encoding: 0.1 as an f32 is
  `float 0x3FB99999A0000000`, the double nearest to (float) 0.1, and not the
  f64 spelling 0x3FB999999999999A. tests/cases/f32_constant holds both side
  by side, and every f32 golden is checked with llvm-as.

  Printing widens with fpext and reuses sts_str_from_f64, so the digits are
  what JavaScript prints for the float's value -- 0.10000000149011612 for a
  0.1 that is 0.1 as an f64 -- and the runtime gains no code at all: .text at
  -Oz is unchanged at 3,765 bytes.

  Math.abs/min/max work through llvm.fabs.f32 and llvm.minnum/maxnum.f32; the
  f64-only Math functions stay f64-only and say so. Float32Array is one more
  typed-array alias for f32[], which the existing alias machinery makes a
  two-line addition: one entry in TYPED_ARRAY_ALIASES and one case in
  typedView, with the N-API and wasm loaders generic over it already.
  --emit-header spells the type `float` and --emit-dts `number`.

  The differential rewriter models f32 with Math.fround at every point an
  f32 value is produced -- arithmetic results, unary minus, ++/--, literals,
  and conversions through the same `convert` shim helper -- so Node agrees
  byte for byte on values that are not representable in a float.

- **Add `switch` / `case` / `default`**

  The first of the WP14 wave-A gaps: every phase of a compiler is a dispatch
  on a node kind, and today that is an `if` chain.

  An integer discriminant and constant labels lower to one LLVM `switch`, so
  the backend gets a jump table (`llc -O2` emits `jmpq *.LJTI0_0(,%rax,8)` for
  twelve dense labels). Labels are folded in the checker — a literal, its
  negation, or a module constant — and recorded in `caseValues`, so the emitter
  writes the table without re-deriving anything. A literal label takes the
  discriminant's width, the same way an operand takes it from the other side
  of a binary operator.

  The block layout follows clang: a clause with statements gets one block and
  an empty clause points at the next one that has some, which is the whole of
  StaticTS's fallthrough (`case 1: case 2: body`). A clause with statements
  must end in a terminator unless it is the last, so no clause silently runs
  into the one below it; and a clause cannot declare a variable without a block
  of its own, because TypeScript gives every clause one shared scope, which
  would leave the declaration visible but unassigned below it — reachable here,
  a temporal-dead-zone throw under Node.

  `break` and `switch` share a target stack: a `switch` pushes a break target
  with no continue target, so `break` leaves the switch while `continue` looks
  past it for the enclosing loop, and an infinite loop containing a `switch`
  whose clause breaks is still infinite.

- **Add the string byte methods**

  WP14 A2: `charCodeAt`, `substring`, `indexOf`, `startsWith`, `endsWith` and
  `String.fromCharCode`, the set a lexer needs. Every offset is a UTF-8 byte
  offset, like `s.length` already is; a code-point index would cost a decode
  per access, and the loop these exist for reads one byte at a time.

  They lower inline rather than to runtime functions. `charCodeAt` is the
  array bounds check against the byte length, one `getelementptr` past the
  8-byte header and a `load i8`, so a function that only reads bytes stays
  `readonly` and out of range panics with the same message `a[i]` gives.
  `substring` is JavaScript's clamp — both ends into `[0, len]` with
  `llvm.smin`/`llvm.smax`, then the pair in order — and one `sts_str_new`:
  one allocation, one memcpy. `opt -O2` folds the whole clamp of a literal
  into `max(0, min(n, len))`. `indexOf` is a scan emitted at the call site,
  which keeps the search out of `runtime.c`.

  The one new runtime symbol is `sts_str_at(s, at, sub)`, shared by
  `startsWith` (offset 0), `endsWith` (offset `len - sub.len`, negative and so
  false when the suffix is longer) and the `indexOf` scan. `runtime.c` is
  3,842 bytes of `.text` at `-Oz`, inside the 4,096-byte budget; a runtime
  search function would have cost another 171.

  The analyses had to learn two things: a string method reads its receiver
  rather than retaining it, so a string parameter keeps `nocapture readonly`,
  and `substring` and `String.fromCharCode` are allocation sites, so a result
  that outlives the function disables the caller's arena scope instead of
  being released under it.

- **Add array `pop`, `indexOf` and `join`**

  WP14 A4, the last of wave A. `join` is the one that matters: the emitter
  builds ~88 KB of IR text, and doing that with `s = s + t` in a loop copies
  everything again per part and never reclaims — 180 MB of peak arena, and
  tens of gigabytes for a self-compile. So `join` had to be the fast shape:
  one pass summing the parts' lengths, one `sts_alloc_struct`, one
  `llvm.memcpy` per part and per separator. The separator before the first
  part is skipped by selecting a length of zero rather than by branching, so
  the copy body stays a single block.

  It is `string[]` only. Converting elements would allocate one string each,
  which is the shape `join` exists to replace, and the message says so and
  points at template literals.

  `pop` stores the shortened length back and loads the element, leaving the
  capacity alone so the next `push` reuses the storage; an empty array panics
  through the same `sts_panic_index` an index does, reported as `0 >= 0`,
  because there is no `undefined` to return and no second return type to
  widen to. `indexOf` scans with the `===` of the element type: `sts_str_eq`
  for strings, `fcmp oeq` for floats so a `NaN` element is never found, and
  `icmp eq` for everything else, which is identity for class, interface and
  array pointers.

  All three lower inline. A runtime `join` measured 252 bytes of `.text` at
  `-Oz` against a 254-byte margin, which would have left nothing for B2 and
  B3; `runtime.c` is unchanged at 3,842 bytes.

  A numeric literal argument to `push` or `indexOf` now takes the element
  type, so `wide.push(3)` on an `i64[]` is an `i64` three rather than an
  i32-versus-i64 mismatch.

- **Add console.error, the newline-free writes, readFileSyncOrNull and panic**

  WP14 B2, B3 and D1 — the wave-B gaps that are not about types but about a
  compiler being a program that reports things.

  Every one of a compiler's diagnostics goes to stderr and two of its dumps
  write without a trailing newline, and `console.log` is stdout-and-newline
  only. `console.error(x)` takes exactly what `console.log` takes; `write(s)`
  and `writeError(s)` write a string as it is on fd 1 or 2. All three go
  through one runtime entry point, `sts_write(s, fd, newline)`, which
  `sts_print` now delegates to, so `console.log` keeps its symbol and no
  existing golden moved.

  `readFileSync` exits the process on a missing file, which means a compiler
  cannot turn it into its own "cannot find module" diagnostic and carry on
  loading the other imports. `readFileSyncOrNull` is the same read answering
  `null`, which subsumes an `existsSync`, has no time-of-check race, and needs
  no new type: the caller narrows it with `if (text !== null)` like any other
  nullable. In the runtime the old function is now the wrapper — the read is
  `sts_read_file_or_null` and `sts_read_file` dies when it answers null — so
  the failing message and its test are untouched.

  `panic(message)` writes the message to stderr and exits 1, the same ending
  an out-of-range index has, and it terminates control flow like
  `process.exit`, so a non-void function may end with it. `throw` traps and
  discards its value, which is right for a program with nothing to say; an
  internal invariant has something to say. It needs no runtime function of its
  own: `sts_write` carries the message and the `noreturn` `sts_exit` closes
  the block.

  runtime.c is 3,950 bytes of .text at -Oz, inside the 4,096-byte budget.

- **Mark the WP14 language gap closed**

  A5 and B1 landed earlier without their rows being updated; with A1, A2, A4,
  B2, B3 and panic in, every row of §3 is done. What is left before S5 is
  library code in `self/` and the four decisions of §3a, neither of which is
  a question about what StaticTS can express.

- **Self-hosting S1: the StaticTS-0 lexer**

  The first milestone of the staged bootstrap, and the first piece of `self/`
  that is not a table. It is new code rather than a port: `src/` has no lexer,
  because the `typescript` package is the scanner there, and 1,558 of its
  references are calls into it.

  Offsets are bytes, because `s.length` and `charCodeAt` are, which is what
  lets a diagnostic slice its line back out with one `substring`. Template
  literals are lexed without the parser's help: a backtick opens a scan that
  ends at the closing backtick or at `${`, and one brace counter per open
  substitution tells that substitution's `}` from a block's.

  The lexer has no opinions. It first refused `==` and `!=` and split `?.`,
  `??`, `...`, `**`, `@` and `#name` into pieces; both were bugs, found by the
  oracle. A lexer that says what is written leaves the refusing to the parser,
  which reads better anyway — "`??` is forbidden; narrow with `!== null`"
  rather than a complaint about a stray `?`.

  The test is `tests/lexer_oracle.js`, which is rule 3 of the work package
  applied to a lexer: stage0's scanner is the `typescript` package's, so run it
  over a file, print the token stream in `dump_tokens`' format, and diff. Over
  `tests/cases/`, `examples/`, `self/`, `docs/cookbook/`, the differential
  corpus and the new `tests/lexer/` fixtures that is 482 files and 50,968
  tokens with no disagreement, including every `reject_*` case, whose forbidden
  syntax has to tokenise cleanly, and files with multi-byte characters, where
  the scanner's UTF-16 offsets are mapped through the source's byte prefix.
  One divergence stands by design: the scanner hands back a bare `>` so a
  parser can close nested type arguments one at a time, and this one merges
  `>>` because StaticTS-0 has no such list.

  `self/dump_tokens.ts` is the other half of the proof — the lexer built by
  stage0 and run natively. Over 129 KB of the compiler's own source it reads,
  lexes 14,000 tokens and writes the dump in 5 ms.

- **Self-hosting S2: the StaticTS-0 parser**

  Recursive descent over the S1 lexer, building the one-class tree of §2.1: a
  `kind` discriminant and the union of the fields any node needs, with a fixed
  child layout per kind, `N_LIST` for the variable-length groups and `N_EMPTY`
  for the absent ones. Nothing downcasts, because there is nothing to downcast
  to — which is what that decision bought, and it reads as well as a hierarchy
  would.

  No exceptions. StaticTS `throw` traps and discards its value, so this is the
  error-value threading of §3a D1 in its first real use: a failed parse is an
  `N_ERROR` node carrying the reason, the message goes on the parser's
  diagnostics, and the caller decides where to pick up. The declaration after a
  broken one still parses, which is the property `tests/parser/recovery.ts`
  pins.

  `tests/parser_oracle.js` is the lexer oracle one level up: walk the
  `typescript` tree, print it in `dump_ast`'s format, diff. That compares the
  shape and every span, not just whether it parsed — 447 files, 53,673 nodes,
  no disagreement. The 43 files it skips are all `reject_*` cases, whose
  forbidden constructs this grammar does not read yet; stage0 rejects those in
  its validator after the `typescript` package has parsed them, so stage1 will
  have to read and refuse them itself, and the tally of which ones is now
  measured rather than guessed.

  Three bugs the oracle found, on top of S1's two, all the same shape — the
  front end having an opinion the scanner does not:

  - `super` was missing from the node model, although the language has
    inheritance; twelve corpus files needed it.
  - `readonly` (and the accessibility modifiers the language accepts and
    ignores) were not parsed on class members.
  - `from` and `of` were hard keywords when they are contextual, so a class
    with a field called `from` did not parse (`tests/cases/cls_nested.ts`).

- **Add the self-hosting support library**

  Wave C of docs/wp14-selfhost.md §3: the 598 lines of StaticTS the checker
  and the emitter will be written over, with no language change, which is the
  claim the wave was making.

  self/strings.ts is StringBuilder (a string[] and one join, because s = s + t
  in a loop is quadratic in both time and memory), compareStrings (StaticTS has
  no `<` on strings deliberately), jsonQuote, the LLVM `c"..."` escape, and
  f64Hex/f32Hex over B1's f64ToBits — the only way an emitter written in
  StaticTS can write a float constant LLVM accepts.

  self/map.ts is StringMap/StringSet, replacing the ~200 Map/Set sites in src/.
  Open addressing over a *dense entry list*: the buckets hold entry indices and
  the entries live in insertion order in parallel arrays. Iteration is therefore
  insertion order, which a golden-compared diagnostic dump needs, and "" is an
  ordinary key rather than a sentinel. No delete: scopes are popped whole, so
  the probe loop needs no tombstones.

  self/paths.ts matches node:path's POSIX behaviour, quirks included, because
  §3a D3's failure mode is a `..` normalised differently from Node's — one file
  loaded twice, cycles that stop terminating, invented duplicate symbols. The
  one deliberate divergence is basenameWithout, since path.basename(p, ext)
  answers "///" for basename("///", ".ts") and disagrees with itself about
  ".ts".

  tests/self/support_oracle.js is the test. There is no src/ phase to diff
  against here, so every line is matched with an implementation that already
  exists: stage0's own escapeBytes and f64Constant for the IR escapes, where a
  disagreement is stage1 emitting a different module; node:path's POSIX side
  for the paths; JSON.stringify, Buffer.compare and Map for the rest. Both
  sides read tests/self/cases.txt, so they cannot drift onto different inputs.
  863 lines agree.

- **Bring an imported class's reachable layouts with it**

  `import { Registry }` where `Registry.all(): Entry[]` gives a module `Entry`
  values it can call methods on and read fields of. Until now the checker
  crashed with an internal error — `structOf: no struct named `Entry`` — because
  `Entry` was in no registry in that module, and even past the checker the
  emitter would have had only `%struct.Entry = type opaque` to compute a field
  offset from and no `@Entry.label` to call.

  Binding a struct import now walks the layouts its members mention — field
  types, and the parameter and return types of its methods and constructor,
  through arrays and nullables — transitively, and registers each one. The
  emitter declares their constructors and methods exactly as it declares an
  imported class's, so a call links against the defining module.

  Only the layout travels, not the name. `program.structs` is now wider than
  what may be *written* as a type, so annotation resolution consults a separate
  set of the names this module declares or imports: `const e: Entry` in a module
  that only imported `Registry` is still `Unsupported type reference `Entry``.
  Two things are deliberately left out for the same reason — they are reached
  through a pointer the checker already holds, never by name: a base class
  named in `extends`, and a method's `this` parameter (which is that base, for
  an inherited constructor). Including either would turn the
  `%struct.Base = type opaque` that `tests/link/extends_import` pins into a
  definition.

  Found while writing `self/diagnostics.ts` for the self-hosted compiler, whose
  `DiagnosticSink.sorted()` hands back a `Diagnostic[]`.

- **Start S3: the type model and the diagnostics**

  `self/types.ts` is `src/types.ts` with one change of representation. A type is
  an interned `i32` rather than a discriminated-union object, so the checker's
  hottest question — are these the same type? — is one integer compare instead
  of a recursive `sameType` and cannot answer "different" for two spellings of
  one type; a type fits in the `i32` a `StringMap` stores, so a scope needs no
  second table; and `T[]` costs one entry rather than one per mention. It
  carries a thirteenth kind stage0 has no counterpart for: `T_ERROR`, D1's
  sentinel, assignable in both directions so one bad expression does not
  produce a diagnostic at every site it reaches.

  `self/diagnostics.ts` is the same summary line, source excerpt and `--json`
  object, over a `SourceFile` that indexes its line starts once — a scan per
  diagnostic is quadratic in a file with many errors — and a sink that orders by
  file-first-mentioned and then position. The sort is the last outstanding item
  of wave C and it is stable, bottom-up merge: two errors at one position have
  to keep the order the phases produced them in, or a multi-error golden is not
  reproducible. Columns are bytes here and UTF-16 code units in stage0; the two
  agree on every ASCII line, which is every line of every `.err` golden, and the
  divergence is written down where it lives.

  Both are checked against stage0 rather than a golden. types_oracle diffs the
  LLVM type, the alignment, the diagnostic spelling and the whole assignability
  matrix over every type either side can build; diagnostics_oracle diffs every
  byte of the messages, the line and column of *every* offset in the fixture,
  the report order, the `...and N more errors` cut and the JSON.

- **Port the scope chain and the narrowing rules**

  `self/symbols.ts` is `src/checker/scope.ts`: a chain of name tables, and the
  narrowings that make `if (p !== null) { ... }` read `p` as its non-null type
  inside the region the condition guards. Narrowings are keyed by identity, as
  they are in `src/`, and identity is what `===` on a class value already gives;
  the lists are short — one scope holds one region's narrowings — so a scan
  beats a second hash table and a `Local` keeps no field that exists only to be
  its own key.

  `declare` answers false where stage0 throws, which is D1's error-value
  threading: the caller reports against the declaration it is already looking
  at, which is the node with the right span anyway.

  This is the part of the checker a program can observe going wrong. A narrowing
  kept one statement too long compiles a load through a pointer the checker
  promised was not null, so the oracle drives both implementations through one
  script — shadowing in a nested block, a narrowing that holds through the
  chain, an inner narrowing that wins over an outer one, and an assignment that
  drops both — and compares every answer.

- **Close the reachable-struct set once the whole program is bound**

  The closure ran inside `bindImport`, using the exporting module's registry as
  it stood at that moment. That registry is only complete after *that* module
  has bound its own imports, so a struct two hops away — `main` imports `mid`'s
  class, whose method returns `leaf`'s — was found or not depending on the order
  the modules happened to be bound in.

  It is now a pass of its own, after every module is bound, against a registry
  of every struct declared anywhere in the program. A struct name is already a
  program-wide symbol (`%struct.<name>`, `@<name>.method`), so a collision is a
  broken program either way and the first declaration wins.

  Found writing the self-hosted compiler's annotation resolver, whose context
  reads a `StringSet` field of a class imported from another module.

- **Port the checker's signature pass**

  `self/checker.ts` and the modules around it are stage0's pass 1 in StaticTS:
  `program.ts` holds the side tables, `context.ts` what every pass is given,
  `annotations.ts` resolves type annotations, `declarations.ts` collects
  function signatures and imports, `structs.ts` classes and interfaces with
  their layouts, `constants.ts` folds module constants.

  206 of 206 corpus files agree with stage0 over 1,255 signature lines. The
  comparison goes through the `--emit-checked` dump both compilers write, so
  what is checked is not that a file was accepted but every struct's size and
  alignment, every field's index and byte offset, every signature and symbol,
  every folded constant, and the order they come out in. The lines later phases
  fill in are filtered out of the diff rather than left out of stage1's format,
  so they start being compared the moment those phases land.

  Three shape changes, each with a reason:

  - Side tables are arrays indexed by a dense `Node.id` the parser hands out,
    not `WeakMap`s. StaticTS has no `WeakMap`, and an array index beats hashing
    a pointer. The rule the `WeakMap`s exist for still holds: the AST carries
    syntax only and the emitter reads what the checker recorded.
  - An annotation resolves against a `typeNames` set that is narrower than the
    layout registry, which is what keeps a layout reached through an imported
    class from becoming a name this module may spell.
  - Folding needs no bigint: `i64` arithmetic in StaticTS already wraps at the
    width, where stage0 computes in bigint and wraps by hand.

  The parser now reports into the shared `Diagnostic` of `self/diagnostics.ts`
  instead of a class of its own, so a syntax error and a checker error land in
  one sorted report. Its messages gain the format they should always have had —
  `file:line:col: syntax error:` and a source excerpt, the same shape stage0
  prints — which is what `tests/parser/recovery.err` now pins.

- **Give a ternary arm the conditional's literal context**

  `const x: f64 = c ? 1.5 : 2.5` was rejected. The context walk that gives a
  numeric literal its type handles an annotated initializer, a `return`, an
  argument, an array-literal element and an assignment target, but had no clause
  for a conditional expression, so the annotation reached a literal written
  directly and not one behind a `?:`.

  Both arms are the value the context asked for, so they inherit it; the
  condition is a boolean and inherits nothing. The golden shows the two arms
  becoming `0x41E0000000000000` and `0x3FE0000000000000` in one `phi`, and an
  `i64` arm taking `5` as an `i64`.

  Found writing the self-hosted checker, where an i32/f64 limit is picked with a
  ternary.

- **Reach layouts through an imported function's signature too**

  `import { lex }` where `lex(): Token` hands this module `Token` values it
  never names, exactly as an imported class's `all(): Entry[]` does — and with
  the same consequence when the layout does not travel: the checker cannot find
  `Token`'s methods and the emitter cannot compute a field offset.

  The closure now seeds from every imported signature's parameter and return
  types as well as from imported classes, and walks on from there as before.

  Found writing the self-hosted checker's statement pass, which imports a
  `caseValue(): CaseValue` from its constant folder.

- **Port the checker's body pass and Phase 0**

  `self/expressions.ts`, `statements.ts`, `members.ts`, `arrays.ts`,
  `builtins.ts` and `validator.ts` are stage0's pass 2 and its forbidden-syntax
  sweep, written in StaticTS.

  Two shape decisions, each with its reason:

  - The dispatch is one central `switch` rather than the tables `src/` registers
    into. That is D2 of the plan, taken with its cost known — adding a construct
    now touches the switch as well as its family — because a table of function
    values needs function pointers, which StaticTS does not have, and a `switch`
    on a node kind lowers to an LLVM `switch` and a jump table.
  - The contextual type is threaded down instead of walked up, because the tree
    has no parent pointers. The one place that shows is `console.log` and the
    other `void` builtins: "this must be a statement" is answered by the
    statement checker recording the expression it is about to check, which is
    one field where stage0 follows a parent chain.

  The proof is both halves of what a checker does. On what it accepts, the
  `--emit-checked` dump is compared over the whole corpus and now includes the
  per-body locals and callees: 207 of 207 files agree over 2,079 lines — every
  variable's type, every call's resolved callee, every field offset, every
  folded constant. On what it refuses, every `reject_*` case is run through
  stage1 and required to produce the fragments its own `.err` file pins, which
  is the same assertion the suite already makes of stage0: 154 of 154 agree.

  The 11 rules still missing are named in tests/self/reject_backlog.txt rather
  than skipped, so they are counted in the suite's own output, and a backlog
  entry that starts agreeing fails the oracle until it is removed.

- **Finish milestone S3: the checker agrees with stage0**

  Definite assignment (`self/assignment.ts`), `super(...)` placement,
  `process.argv` being read-only and the rule that a narrowing does not survive
  a loop that assigns the variable were the last rules missing. With them the
  backlog file is empty and gone.

  Both halves of the milestone now hold over the whole corpus:

    what it accepts   207/207 files agree, 2,079 dump lines
    what it refuses   165/165 reject_* cases, 168 message fragments

  The accepted side compares the `--emit-checked` dump: every struct's size,
  alignment and per-field byte offsets, every signature and symbol, every folded
  constant, every body's locals and resolved callees. The refused side requires
  of stage1 exactly what the suite already requires of stage0 — that each
  `reject_*` case produce the fragments its own `.err` file pins.

  The skips are counted and named rather than waved past: 24 accept-side and 5
  refuse-side files need the S5 module driver, 6 are rejected by stage0 itself
  without the flags the harness passes, and 39 are cases the S2 parser refuses
  by name rather than by Phase 0's wording — the deliberate difference the plan
  recorded at S2.

  The last of those rules was found by the oracle rather than by reading:
  `(process.argv).push("extra")` slipped through because the parentheses hid the
  receiver.

- **Add the orientation map a new session starts from**

  `.claude/orientation.md` is the ninety-second model of the repository: the
  two compilers, the five invariants, the code map, the commands, and where
  to read next. `.claude/selfhost.md` is the same for `self/` — StaticTS-0
  and what it forces, the module-by-module correspondence with `src/`, every
  oracle and what it compares, and the milestone state.

  Both are linked from CLAUDE.md and AGENTS.md so the entry point is the
  first thing either file says.

- **Count readFileSyncOrNull as an allocation site**

  The escape analysis recognised `readFileSync` and not its `OrNull` twin,
  although both bump their result out of the arena. A function that read a
  file that way and returned the bytes therefore had no `returned` site, so
  its other local allocations still earned an automatic arena scope, and the
  `sts_arena_release` before the `ret` rewound the bump pointer past the
  string the caller was about to read.

  Both names are sites now. The new case pins the shape that made it
  visible: one template literal that really does flow locally, plus the
  returned file contents, and the golden has no mark or release in it.

  Found while porting the analysis to `self/` for milestone S4.

- **Self-hosting S4: the StaticTS emitter**

  `self/` now carries the back end: the IR builder, the runtime ABI table,
  the target layouts, the escape analysis, the whole-program attribute
  fixpoint, the six construct families, the module assembly, and a
  one-module driver. 6,761 lines of StaticTS against the 5,686 of
  `src/codegen/` they replace.

  The proof is stronger than the milestone asked for. `tests/self/
  ir_oracle.js` compares the two compilers' *entire output, byte for byte*,
  over every import-free program in the corpus — 206 of 206 files, 19,452
  lines of IR — rather than a growing whitelist. Every attribute group,
  every block label and every SSA number has to match. The 49 skips are 39
  programs that need the S5 module driver, 6 that stage0 rejects without
  the flags the harness passes, and 4 that ask for `-g` or a dump flag
  stage1 does not have.

  Three shape changes, all forced by StaticTS-0 and none visible in the
  output. The `factCollectors` array of function values becomes one
  collector class, which is what D2 said the central switch would cost;
  the paired `BuiltinCall { emit, callees }` invariant it protected now
  sits side by side in one file with the IR oracle keeping it honest.
  Parent links, which the escape analysis genuinely reads, come from a side
  table indexed by `Node.id` rather than from a field on the tree. And
  stage1 emits no debug info: `-g` stays stage0's, as `--link` does.

  A compound integer division contributed no `sts_panic_div` callee,
  because the checker resolves the target as an assignment target and
  records no type for it. Its caller therefore kept `willreturn` and
  `readnone` over a call that writes and never returns, which LLVM is
  entitled to delete. Fixed, with a case per target shape.

- **Self-hosting S5: the compiler compiles itself**

  `self/compilation.ts` is the whole-program driver: transitive module
  loading through `import`, cross-module binding, the reachable-struct
  closure once every module is bound, symbol-clash rejection, and one
  attribute fixpoint over the program rather than per module.
  `self/compile.ts --out-dir <dir>` writes one `.ll` per module. There is no
  `mkdir` in it and no working directory: a module's identity is its
  specifier resolved against the name its importer was given, which stays
  relative and needs neither, and which is why the module headers agree with
  stage0's string for string.

  `tests/self/bootstrap.js` runs the stages. All three equalities hold over
  the 41 modules and 4,095,128 bytes of IR that make up `self/`:

    IR(stage0, self/) == IR(stage1, self/)   the two implementations agree
    IR(stage1, self/) == IR(stage2, self/)   the fixed point
    stage3            == stage2              byte for byte, as files

  The first is the stronger equality §1 said was worth aiming at and not
  worth blocking on. It holds for every module, so the TypeScript
  implementation and the StaticTS one are the same compiler rather than two
  compilers that agree about the tests.

  S5 needed one addition to StaticTS-0, and the S2 parser oracle had been
  naming it as a skip for three milestones: the parenthesised type.
  `self/program.ts` writes `(Local | null)[]` and has to, because
  `Local | null[]` groups the other way. stage0 always accepted it; the
  parser now builds `N_TYPE_PAREN` and `resolveType` reads through it, with
  a golden case, a rejection, a language rule and a cookbook entry.

  The IR oracle grew with the driver: it compiles whole programs now,
  `tests/link/` included, and compares every module of each — the module set
  too. 259 of 259 programs, 848 modules, 1,074,371 lines of IR.

  D5, measured rather than guessed: compiling the whole compiler costs
  stage1 91 ms and 86 MB of peak RSS, against stage0's 786 ms and 178 MB.

- **Answer D5 where it was asked**

  The peak-memory question §3a D5 raised is answered in the S5 section, so
  the decision now points at its own measurement rather than leaving a
  reader to find it. S4's milestone row says what the proof turned out to be
  — the whole corpus, not the growing whitelist it was planned as.

- **Add Result<T, E> and remove throw**

  A function that can fail says so in its return type and hands the caller a
  `Result<T, E>`; the caller cannot reach the success value without first
  deciding what happens to the failure.

  Lowering: `Result<T, E>` is a built-in type constructor, not a user generic.
  Each distinct pair of payload types gets one monomorphised
  `%struct.sts_result.<T>.<E> = type { i1 ok, T value, E error }`, named by a
  prefix-coded mangling of the payloads and held by pointer, laid out and
  allocated exactly as a class is. The layout is derived from the type rather
  than declared, so the checker and the emitter compute the same one and an
  imported signature that mentions a `Result` brings across only its payload
  layouts. `Ok(v)` / `Err(e)` are WP6 allocation sites, so a `Result` that does
  not outlive its function becomes an entry-block alloca with no allocator call;
  `orReturn()` loads the discriminant, branches, and on the error arm builds this
  function's own `Err` and returns it, which is why it also marks the function as
  returning an allocation and disqualifies it from an automatic arena scope.
  `Result<void, E>` carries no value field at all.

  Three rules are checker errors rather than lints: a `Result` may not be dropped
  (neither as a bare expression statement nor as a local nobody reads), the
  payload is unreachable until the discriminant is tested, and `orReturn()` is
  legal only inside a function returning a compatible `Result`, so propagation is
  contagious through the signatures. The narrowing is the `T | null` engine,
  extracted into `checker/narrowing.ts` with a registry that `nullable.ts` and
  `result.ts` each add one rule to; the refinement rides on the type as `state`,
  which `sameType` ignores because the LLVM value is the same pointer either way.

  The surface is Rust's in the spelling TypeScript already has: `Ok`/`Err`,
  `isOk()`/`isErr()` (and `r.ok`, the discriminant a TypeScript reader expects),
  `value`/`error`, `orReturn()` for `?`, `unwrapOr`, `expect`. `runtime/statictsc.d.ts`
  declares it as the tagged union TypeScript would use anyway, intersected with
  the method surface, so a Result program also type-checks under plain
  `tsc --strict` and narrows there for the same reason it narrows here.

  `throw` is removed in the same change. It never unwound — it evaluated its
  operand, discarded it, and executed `llvm.trap` — so it was an abort wearing
  the syntax of error handling, and it let a program report a failure no caller
  could see. Phase 0 refuses it in both the compiler and stage1, naming both
  replacements: a `Result` for a failure a caller should handle, `panic(message)`
  for an invariant that cannot hold.

- **Implement Result<T, E> in the self-hosted compiler**

  S5 froze stage0 as the bootstrap seed and required new constructs to land in
  `self/` too, and the S4 IR oracle enforces it: it refuses to skip a program
  stage1 cannot compile, so the six `res_*` cases and the `result_import` link
  test failed against the newly landed oracle. This is the other half of the
  implementation.

  The port mirrors stage0 module for module. `self/types.ts` gains `K_RESULT`
  with the two payload arms and the `state` refinement interned alongside them,
  so a narrowed `Result` is a third id rather than a field on an object — the
  same difference the rest of the port already carries. `assignable` and
  `typeName` ignore the state, because the LLVM value is the same pointer
  whatever has been proved about it, and `isResult` answers for the -1 the side
  tables hand out for an unrecorded node.

  `self/result.ts` holds the three rules and the derived layout; `self/annotations.ts`
  resolves the type; `narrow` in `self/expressions.ts` gains the discriminant
  test; `self/emit_result.ts` is the lowering; `self/escape.ts` counts `Ok`/`Err`
  as stackable allocation sites and `orReturn()` as returning memory; and
  `self/attributes.ts` classifies the receivers and arguments and reports the
  memory facts. `noteStructNames` and the emitter's `noteStruct` descend into
  both payload arms, which is what carries an imported `Result`'s layouts across
  a module boundary.

  The oracles now hold both sides to each other: 267/267 programs emit identical
  IR (1,260,417 lines), and all 180 `reject_*` cases produce stage0's exact
  message, so `tests/self/reject_backlog.txt` is deleted rather than extended.

- **Ship the self-hosted compiler**

  S5 proved the fixed point inside the test harness: tests/self/bootstrap.js
  builds four compilers in a temporary directory, compares them and deletes the
  lot. It left no compiler behind, so `self/` was self-hosting without being
  runnable outside the suite. This adds the two pieces that close that gap.

  scripts/bootstrap.sh builds the chain from a checkout. stage0 (dist/index.js)
  builds stage1, stage1 builds stage2 — the default output, and the first binary
  no part of stage0 emitted — and stage2 builds stage3. `--verify` runs the three
  equalities of wp14 §1 with cmp rather than with the suite's reporting, so the
  recipe is self-checking outside a checkout of the tests: 43 modules identical
  for IR(stage0)==IR(stage1) and IR(stage1)==IR(stage2), and stage3 byte-identical
  to stage2, in 52 s. `--stages 1` stops at the seed's own output, two links
  sooner.

  scripts/statictsc.sh is the command line D4 said a wrapper would supply. The
  compiler emits .ll and nothing else, because a directory and a linker would
  mean mkdirSync and spawnSync builtins; the wrapper makes the directory, runs
  scripts/build.sh, and mirrors stage0's file layout exactly — `-o <file.ll>`,
  `-o <dir>/`, and `--link <exe>` writing <exe>.ll for one module and
  <exe>.modules/ for a program with imports — so either compiler can be dropped
  into a build script. The flags that are stage0's rather than missing (-g, the
  dumps, the interop sidecars) are refused by name with what to run instead: a
  flag that is silently ignored is how a build ends up not carrying the thing it
  asked for. D4's bet is settled at 139 lines of bash and no runtime growth.

  The WP14 section of the suite now checks the artifact and not only the fixed
  point: it builds a compiler with the script and uses it, through the wrapper,
  to compile, link and run examples/hello.ts (one module) and
  examples/multi/main.ts (two modules, exit 49), and asserts that -g is refused.
  One stage rather than three, because what is under test is the recipe and the
  wrapper; the bootstrap check above owns the equalities.

  stage0 stays the published package: it is the seed every bootstrap starts from,
  the oracle every self/ phase is compared against, and the only one of the two
  that emits DWARF and the interop sidecars.

  Also: docs/wp14-selfhost.md §7, a README self-hosting section, docs/INSTALL.md
  §2a, `npm run bootstrap`, and the stale README status table and "not in the
  language yet" list — switch, the string methods and process.argv have all
  landed, and generics, closures, try/catch and labelled break are refusals with
  a message rather than gaps.

- **Return a small Result in a register, and let one cross to a host**

  WP16 shipped `Result<T, E>` as a pointer to an arena struct and said the C
  ABI, not the design, was the reason. Half of that holds: clang lowers
  `struct { bool; int32_t; int32_t; }` to `{ i64, i32 }` on x86-64, `[2 x i64]`
  on aarch64 and through `sret` on wasm32, so there is no one aggregate
  signature a target-neutral module can emit. But a by-value *scalar* is
  uniform, and that is enough.

  A `Result` whose two payloads are each a scalar of at most four bytes —
  void, boolean, u8, u16, i32, u32, f32 — is now returned as one `i64`:

      bits  0..31   the discriminant, 1 for Ok and 0 for Err
      bits 32..63   the live arm's payload, zero-extended (f32 by bitcast)

  The dead arm is not represented, which is what makes the twelve-byte
  `Result<i32, i32>` fit. Eight bytes is not a tuning knob: `i64` is the only
  return width whose C-ABI lowering is the same LLVM type on all six supported
  triples (`__int128` is `{ i64, i64 }` on x86-64 and `i128` elsewhere).

  The lowering touches only the return boundary. The callee packs where it
  would have allocated (`return Ok(v)` is a shift and an `or`; `orReturn()`
  propagates without building an object); the caller unpacks the word into an
  entry-block object every existing construct already reads, so the in-memory
  layout, the narrowing and the payload accessors are unchanged. The allocation
  moves from callee to caller, so the call is now an allocation site of the
  caller in escape.ts and the allocator call is reported there in attributes.ts.
  SROA folds the alloca, the stores and the shifts once the call is inlined.

  Measured with both compilers built and the same program compiled by each
  (`--profile speed`, 2e8 iterations, x86-64): 0.50 s -> 0.143 s, same
  checksum, and `use` is 14 instructions with no frame and no call against 47
  with three. Across a call boundary the optimiser cannot inline away, the win
  is 2.09x, where `sret` reaches 1.43x.

  A `Result` also crosses the host boundary now. `--emit-header` declares
  `struct sts_result_<T>_<E>` for the arena object and a
  `sts_result_<T>_<E>_word` typedef for the packed return, with a `sizeof`
  assertion; clang lowers a function returning that typedef to exactly the
  `i64` the module defines, so a C host includes the header and calls across
  with no glue. `--emit-napi` bridges a by-value `Result` as
  `{ ok: true, value }` / `{ ok: false, error }`, and `--emit-dts` declares the
  same union with the generated loader unpacking the exported `i64`.

  And `-g` builds a `DW_TAG_structure_type` from `resultLayout` instead of an
  opaque pointer, describing a packed return slot as the packed shape the
  header declares.

  Both compilers, as WP16 did: nothing was added to StaticTS-0, and the IR
  oracle holds stage1 to stage0 byte for byte over 272 of 272 programs before
  the bootstrap reaches its fixed point.

- **Pass a small Result by value too, and benchmark the packing**

  WP17 packed a `Result` into a register on the way out and left the way in
  alone, on the grounds that a `Result` argument is rare. Making it symmetric
  turned out to be the smaller half of the work and removes the one place the
  C header needed two spellings for one type: a `Result` whose two payloads are
  each a scalar of at most four bytes is now returned *and* passed as one
  `i64`, and `int32_t describe(sts_result_i32_i32_word r)` is `i32 @describe(i64)`
  on all four native triples, exactly as the return side is.

  The callee unpacks the word once, in its prologue, into the object every
  WP16 construct already reads. Which memory that object lives in is the
  ordinary WP6 decision and it has to be, because a `Result` can be stored into
  an object literal or pushed onto an array and so outlive the frame:
  `EscapeResult.stackParams` runs the same `localOutcome` walk a local holding
  an allocation gets, so a parameter that is only read is an entry-block alloca
  and one whose pointer is kept is an arena bump. An argument feeding a
  by-value parameter cannot be captured by the callee at all, which is one more
  way a `Result` stays off the arena.

  N-API and the wasm loader carry the argument direction too, so
  `describe({ ok: true, value: 41 })` works from both, and `-g` describes a
  packed parameter as the packed shape rather than as a pointer that is not in
  the register.

  `bench/result` is the seventh benchmark: 2e8 calls of a function returning a
  `Result<number, number>` and one taking it, against a C twin using the
  two-word struct `--emit-header` declares and a Rust twin using Rust's own
  `Result<i32, i32>`. It is the regression guard for the packing, and it
  immediately named a gap the packing does not close — StaticTS 650 ms, C
  444 ms, Rust 251 ms.

  That gap is diagnosed rather than guessed. C written the way statictsc emits
  the word (`uint64_t`, `<< 32`, `|`) times at 653 ms, i.e. exactly the
  StaticTS column, so it is not a code-generation defect here. What the two
  faster columns have is the ok arm and the error arm as separate SSA values:
  instcombine then folds `odd ? n : n >> 1` into one variable shift, where a
  `select` on the combined word leaves the shift in the loop. Loop unrolling
  and the checked-division blocks were both ruled out by measurement, and
  respelling the pack as clang's two-word coercion (store the halves, load an
  i64) was implemented, measured to produce byte-identical assembly, and
  reverted. The fix that would work is a private two-scalar ABI for internal
  functions — rustc's ScalarPair — which needs `--strict-exports` to be
  load-bearing, and is recorded as such in docs/wp9-optimisation.md.

  Both compilers, as before: nothing was added to StaticTS-0, and the IR oracle
  holds stage1 to stage0 byte for byte over 274 of 274 programs before the
  bootstrap reaches its fixed point.

- **Rename the language to AmritScript and the compiler to amritc**

  The previous name collided with an unrelated project. The language is
  AmritScript, the compiler is `amritc`: the npm package and `bin` entry,
  `runtime/amritc.h`, `runtime/amritc.d.ts`, `scripts/amritc.sh`, the
  `AMRITC_DEBUG` / `AMRITC_SIMULATE_ICE` environment variables, and the
  `AMRITC_<STEM>_H` guard on a generated header.

  The name is now written out in exactly two source files, so the next
  rename is an edit to those rather than a sweep over the tree:

    src/branding.ts   LANGUAGE, CLI, and the names derived from CLI
                      (ENV_DEBUG, ENV_SIMULATE_ICE, RUNTIME_HEADER,
                      HEADER_GUARD_PREFIX)
    self/branding.ts  LANGUAGE only; stage1's driver calls itself
                      `compile`, so that is the only name it prints

  Every string either compiler prints builds its name from those
  constants: the Phase 0 messages, `--help`, the banner, include guard and
  `#include` of a generated header, the DWARF producer string, and the
  internal-error report. The two files must agree on LANGUAGE, and
  tests/self/reject_oracle.js already compares the two compilers' messages
  byte for byte, so a name changed on one side and not the other fails.

  Prose stays exempt. Comments and docs name the language where that reads
  better than a constant would, but the generic mentions in src/ and self/
  now say "the language", which is both accurate and one less thing a
  rename has to touch. Phase 0's entry point is `validateSyntax`, named
  after its job rather than after the language.

  The `sts_` prefix on the runtime's C symbols is deliberately unchanged.
  It is ABI: it is in every golden .ll, in runtime.c and amritc.h, and in
  binaries users have already linked, and it was never derived from the
  product name. docs/ARCHITECTURE.md ("Where the name lives") and the
  .claude/ guidelines now say so.

- **Emit the arrays interop sidecars before the N-API compile loop**

  The loop that syntax-checks the generated N-API shims covers add,
  strings and arrays, but compiled a stem only `if` its .napi.c already
  existed, and the arrays sidecars were not written until 270 lines later.
  So the arrays leg never ran on a clean build/ and, on a dirty one,
  compiled whatever the previous run had left behind — which is how a
  rename of the runtime header surfaced as `'statictsc.h' file not found`
  against source that no longer existed anywhere in the tree.

  Emit the arrays sidecars beside add's and strings', leaving the arrays
  assertions where they are, and make an absent .napi.c a failure rather
  than a silent skip: all three are written above, so a missing one now
  means --emit-napi failed and there is nothing to be quiet about.

- **Rename the runtime's C symbol prefix to amrit_**

  The last trace of the old product name was `sts_`, its initials, on every
  runtime C symbol. The rename that gave the language its name left the
  prefix alone on the grounds that it is ABI rather than branding, which is
  true and is why it is worth moving now rather than later: nothing has been
  released, so no binary anywhere links `sts_`, and the ~200 goldens that
  carry it are generated by `npm run test:update` rather than written.
  Neither will be true after a first release.

  The sweep is mechanical and total. Every `sts_*` symbol becomes `amrit_*`
  on both sides of the ABI at once — `runtime.c`, `runtime_wasm.c`,
  `amritc.h`, both compilers' runtime tables, the interop generators, the
  goldens, the link and layout fixtures. The `STS_*` macros become `AMRIT_*`,
  including `AMRIT_SYMBOL`, which generated headers emit. The Node shim's
  `__sts` namespace and its `StsResult` become `__amrit` and `AmritResult`,
  the benchmark variant ids `sts`/`sts-nsw`/`sts-size` become `amrit*`, and
  the master plan's never-implemented `.d.sts.json` sidecar is renamed with
  them. `grep -riE '\bsts\b|sts_|staticts'` over the tree is now empty.

  This is a C ABI break for any host that links `runtime/runtime.c` or
  includes `runtime/amritc.h`. It is deliberate, it is recorded in
  CHANGELOG.md, and it is the last one: the documentation that said the
  prefix never follows a rename now says the prefix is frozen, and says why
  this rewrite was affordable exactly once instead of leaving it as a
  precedent. src/branding.ts, self/branding.ts, docs/ARCHITECTURE.md
  ("Where the name lives"), .claude/orientation.md and .claude/architecture.md
  all agree on that.

- **Fuzz stage1 against stage0, not only the binary against Node**

  The WP13 fuzzer generated random programs, compiled them with stage0 and
  compared the binary with Node. stage1 never saw them: the only programs it
  was asked about were the checked-in corpora, which both compilers have been
  adapted to. The strongest equality available — a program neither compiler
  has ever seen, compiled by both — was not being tested.

  `tests/differential/fuzz.js --stage1` adds it. Every generated program is
  compiled by stage0 and by the self-hosted compiler and the emitted IR is
  compared byte for byte, module set included, through the `build` and
  `compare` of tests/self/ir_oracle.js rather than a second copy of them; the
  stage1 binary is linked once per run and every program reuses it. stage0 is
  the oracle, so there is no golden in this path, and a stage1 rejection of a
  program stage0 accepts is a disagreement rather than a skip. A disagreement
  saves the program as build/test/differential/fuzz-stage1-fail-<seed>.ts and
  prints the first differing line with the command that reproduces it.

  The default mode is untouched: it still compares the native binary with Node
  and knows nothing about self/. The WP14 block of tests/run.js runs 16
  programs from a fixed seed, which costs about 21 s — most of it the one link
  — and keeps the suite the length it was; 300 programs from seed 20261001
  agreed on all 141,098 lines of IR.

- **Say in the README that the name is a working title**

  The name is a placeholder and is expected to change, which a reader
  choosing whether to depend on `amritc` should learn from the README rather
  than from the next rename. The note says so, tells them to pin a commit
  instead of a name, and points at why the change is cheap on our side: the
  two branding files, and the `amrit_` prefix as the one deliberate exception
  that does not follow a rename.

  "Where the name lives" in docs/ARCHITECTURE.md now opens by saying the same
  thing, so the section that sets the rule also says why the rule is load
  bearing rather than speculative.

- **Emit DWARF from the self-hosted compiler**

  stage1 had no `-g`: no `DISubprogram`, no `DILocation`, no
  `llvm.dbg.declare`, and `self/emit.ts` said so in its header. `self/debug.ts`
  is the port of `src/codegen/debug.ts` and closes that gap.

  The lowering, which is stage0's and is now written twice:

    - the module gets a `DICompileUnit` reserved as `!0` so the `DIFile` it
      names can be `!1`, plus the `Dwarf Version` / `Debug Info Version` module
      flags LLVM needs before it will keep any of this;
    - every function gets a `distinct !DISubprogram` on its `define`, the
      function's own line as the default location, and one `llvm.dbg.value` per
      parameter; the C-ABI entry wrapper gets an artificial one at the user's
      `main`;
    - `emitStatement` and `emitExpression` set the location around the handler
      and restore the enclosing one after, so a loop's back edge points at the
      loop rather than at the last thing inside it, and `IRFunction.emit`
      appends `, !dbg !N` while one is active;
    - a `let`/`const` slot and a `for (const x of a)` element get an
      `llvm.dbg.declare` beside the alloca;
    - types map as the C ABI header names them, down to the packed
      `{ i32 ok; union { T; E; }; }` a by-value `Result` carries in a register
      (WP17) rather than the in-memory composite a local sees.

  `self/ir.ts` grew the metadata list this writes into: numbered nodes interned
  by text so identical locations share one, reserved numbers for a composite
  that must be referenced before its members exist, and the named lines printed
  ahead of them. `-g` is a flag of `self/compile.ts` and of `scripts/amritc.sh`,
  which passes it on to `scripts/build.sh` so `runtime.c` is compiled with it
  and the profile's strip step is skipped.

  Three things had to change to make the two compilers agree byte for byte.

  A `DIFile`'s directory was `process.cwd()`. stage1 has no working directory
  to ask for and D4 will not grow the runtime for one string, so both compilers
  now write `.`, which is what clang's `-fdebug-compilation-dir=.` writes and
  what makes a debug build reproducible across machines. For a relatively
  spelled entry the two now agree on the whole `DIFile`, exactly as they
  already agreed on the module header (wp14 §4).

  A class reached only through an imported class's signatures was described
  with the *importer's* `DIFile` and with its declaration offset looked up in
  the *importer's* line table, so a debugger was sent to a line in the wrong
  source. A struct is now described against the file that declares it, which is
  why a program with imports carries more than one `DIFile`.

  `IRBlock.terminated` spelled `src/`'s `^(ret|br|switch|unreachable)\b` as
  "the word, then a space or the end". With `-g` an `unreachable` is written
  `unreachable, !dbg !9`, so the test missed it and the emitter added a second
  terminator. It is a word-boundary test now.

  `tests/self/ir_oracle.js` moves `-g` from the unsupported set into
  `SHARED_FLAGS`: `dbg_locals` and `dbg_result` are compared byte for byte,
  metadata numbering included, and the skip count drops from 22 to 20 with
  278/278 programs still agreeing. The runner check that proved `-g` was
  refused by name is replaced by one that links `examples/hello.ts` through the
  wrapper with `-g` and finds `.debug_info` in the binary; `--emit-header`
  keeps the refusal for the flags that are still stage0's. A new check pins the
  imported-class fix against `tests/link/reachable_struct`, and another keeps
  `self/branding.ts`'s `VERSION` in step with package.json, since the producer
  string is compared like every other byte.

- **Compare whole programs in the stage1 oracles**

  Two oracles still skipped every file that imports with the reason "needs
  the S5 driver", which stopped being true when the driver landed, and all
  three treated a program refused for want of `--number-mode f64` as a gap
  in the port rather than as a program nobody was compiling correctly.

  `self/dump_checked.ts` now drives `self/compilation.ts` instead of one
  `Checker`: it loads the entry with everything it imports, checks the
  program as a whole, and dumps every module in load order exactly as
  `dumpChecked(compilation)` walks `compilation.modules` — so each `import`
  line names what pass 1b bound it to, and a module lists only the
  constants, structs and functions whose origin it is. The 42 modules of
  `self/` are now compared by their dump as well as by their IR.

  `tests/self/reject_oracle.js` reads the `tests/link/` negatives too,
  because a rejection that needs more than one module cannot be provoked by
  a single file, and it counts the parser refusals apart from the skips
  rather than in the same total. Two rules stage0 has and stage1 did not
  are ported to make those cases agree: a local name imported twice names
  the module it first came from, and a non-entry module that declares
  `export function main` is refused as such.

  `tests/self/corpus.js` is the one place that knows the corpus and the
  flags each program is compiled with, read from its `.args` sidecar or its
  `// smoke: args` line; `bench/*.args` are new and `bench/run.mjs` reads
  them instead of keeping its own copy of the mode.

  Two bugs fell out of comparing what had not been compared. stage0 ended
  with `process.exit`, dropping whatever was still buffered in stdout, so a
  dump larger than a pipe's 64 KB came out truncated mid-line; the status
  is set on `process.exitCode` instead. And stage1 typed a bare numeric
  literal from the type the whole expression was being checked into, where
  stage0 consults only the other operand, which mixed widths at every `+`
  of `toF64((ij * (ij + 1)) / 2 + i + 1)` in f64 mode.

    checked_oracle  225 agree, 48 skipped -> 272 agree, 1 skipped
    reject_oracle   181 agree, 44 skipped -> 194 agree, 42 parser, 1 skipped
    ir_oracle       275 agree, 22 skipped -> 280 agree, 6 skipped, 11 negatives

  What is left is named rather than counted as a hole: a parser fixture no
  checker accepts, a `--link` failure stage1 has no way to write, and the
  `-g` and dump flags.

- **Answer --emit-checked, --json, --help and --version in stage1**

  The four flags of stage0's command line that are not about linking are
  stage1's now, spelled and behaving as stage0 spells them. `--json` writes
  one flat diagnostic object per line to stdout, uncapped and in the sink's
  order, from the `Diagnostic.json()` the diagnostics oracle already compares;
  `--emit-checked` writes the checked tables of a whole program; `--help` goes
  to stderr with exit 2; `--version` prints `amritc <version>` from
  `self/branding.ts`, because stage1 cannot read `package.json`.

  The dump text moves to `self/dump.ts`. `self/compile.ts` cannot import
  `self/dump_checked.ts` — only the entry module may declare `export function
  main`, which stage1 itself now enforces — and one module for the format is
  the better shape anyway: the driver and the entry the checked oracle spawns
  print the same text because they call the same function.

  `scripts/amritc.sh` passes the four through; `--emit-checked` and
  `--version` print text rather than writing IR, so they skip the output
  planning and the link. It also stops discarding the compiler's stdout on a
  failed compile, which is where `--json` puts its diagnostics.

  `--emit-ast` stays stage0's, by design rather than by backlog: its dump
  prints the `typescript` package's node names and line:column spans, while
  stage1's tree is the flattened one `self/nodes.ts` defines and the parser
  oracle translates TypeScript into that vocabulary rather than the reverse.
  Matching it would put a mirror of `ts.SyntaxKind` inside the self-hosted
  compiler to imitate an implementation detail of the seed. The IR oracle
  therefore counts a dump-flag program as a dump rather than as a gap in the
  port: `--emit-checked` is compared by the checked oracle over the whole
  corpus, and `--emit-ast` is not stage1's to answer.

- **Give stage1 the interop sidecars**

  `--emit-header`, `--emit-dts` and `--emit-napi` now work in the self-hosted
  compiler, spelled exactly as stage0 spells them and writing the same files to
  the same paths. The five modules of `src/interop/` are ported one for one to
  `self/interop_abi.ts`, `interop_header.ts`, `interop_dts.ts`, `interop_wasm.ts`
  and `interop_napi.ts`, so the two implementations stay diffable.

  Three shapes change and no generated byte does:

    - A type is an `i32` into the `TypeTable`, so the `kindOf(t)` string switch
      is a switch over the `T_*` / `K_*` ids.
    - The empty string stands in for `undefined` (`cType`, `wasmType`,
      `cPrototype`); `typedView` and the readers answer `null`, since those are
      objects.
    - The N-API shim's readers and boxers are records of closures in `src/`,
      which the language cannot hold. Here each is a record with a kind tag and
      `napiReaderLines` / `napiBoxerCall` switch on it to write the same lines —
      the same trade D2 made for the dispatch tables.

  `externalFunctions` also runs the whole-program attribute fixpoint once per
  compile and threads the list into the generators, where `src/` re-runs it in
  each of them: stage1's arena is never released and that pass allocates most.

  D4 is untouched. A sidecar is derived from the checked program after the IR
  and written with the `writeFileSync` stage1 already had, to the path it was
  given; nothing here makes a directory or spawns a linker. `scripts/amritc.sh`
  therefore stops refusing the three flags by name, passes them through, and
  makes the sidecar's directory the way it makes the IR's; `-g` and the dumps
  are still refused.

  `tests/self/interop_oracle.js` is the oracle: both compilers over the WP8
  interop corpus, all four generated files per program (`.h`, `.d.ts`, its
  `.mjs` loader, `.napi.c`) compared byte for byte, skips counted and named and
  stage1 rejections counted apart from them. `--all` runs the same comparison
  over every whole program the IR oracle reads: 281 programs, 1,124 sidecars,
  15 MB of generated C, TypeScript and JavaScript, no difference.
  `tests/self/interop_payloads.ts` is a fixture for the narrow `Result`
  payloads — `f32`, `u8`, `u16`, `u32` — that nothing else in the corpus
  mentions, each of which has a reader and a writer of its own.

  The bootstrap fixed point still holds over the ~2,400 new lines of `self/`:
  IR(stage0) == IR(stage1) == IR(stage2), stage3 byte-identical to stage2.
  Compiling the whole compiler costs 114 MB of peak RSS and 127 ms, against
  96 MB and 107 ms before.

- **Refresh the oracle counts the ports moved**

  The milestone table and the bootstrap paragraph quoted the numbers that
  held when each milestone closed, and four landings since — DWARF, the
  interop sidecars, the whole-program oracles and the CLI flags — have moved
  every one of them. Measured on the merged tree: the lexer over 565 files,
  the parser over 528, the checked dump over 279 whole programs, the IR over
  289, and the fixed point over 51 modules and 5,963,202 bytes of IR rather
  than the 41 and 4,095,128 S5 first reached.

  The `-g`-forced sweep keeps its 278, marked as the corpus of the day: it
  records one experiment that was run once, not a property the suite holds
  to.

- **Record the measured full-corpus sidecar comparison**

  `--all` was quoted at the 281 programs it covered before the merge with
  main; on the merged tree it is 287 programs and 1,148 sidecars, 16.9 MB of
  generated text with no difference between the two compilers.

- **Answer the way stage0 answers in stage1's command line**

  Seven divergences, none of them a decision D4 or §7 records. An unknown
  `--number-mode` meant i32 silently, which compiles the program in the
  other arithmetic; it is refused now, as stage0 refuses it. Every
  positional is a root, where the last one used to win and the rest were
  compiled into nothing. `wrote <file>` moves to stderr, where stage0 puts
  it, so stdout carries the IR and the `--json` diagnostics and nothing
  else — which also lets `scripts/amritc.sh` stop capturing stdout and
  replaying it, and lets it correct only the two `wrote` lines that name
  the directory it compiled into rather than where the file ended up. A
  root that cannot be opened is reported by the driver, in stage0's two
  shapes (`error: cannot open <path>` on stderr, one flat object under
  `--json`), instead of by the loader, which could answer neither; the
  errno stays stage0's, because Node names it and `readFileSyncOrNull`
  answers null without saying why.

  In the wrapper: `--link` on a program with no `export function main` is
  refused with stage0's message and its exit 1 rather than reaching clang
  for `undefined reference to main` and exit 3; an unknown `--profile` is
  refused before the compile rather than after it; and `-o <dir>/` writes
  into the directory it was given instead of clearing it first, which for
  `-o build/` took the rest of `build/` with it. The scratch directory the
  single-file case needs is `mktemp -d` now, so nothing the caller named
  is ever removed.

  The WP14 section also prints a SKIP when clang is missing. It used to
  disappear in silence, so a run reported the 55 compile-gate passes above
  it and looked like a proof of the fixed point.

- **Say what is true today about the ports that landed**

  Four landings — DWARF in stage1, the interop sidecars, the whole-program
  oracles and the CLI flags — moved numbers and claims that four documents
  still quoted from before them.

  INSTALL.md said the native compiler does not emit `-g`. It does, and the
  wrapper hands `-g` to the link as well, so the DWARF reaches the binary;
  what is still only stage0's is the link step, the directory creation and
  the AST dump.

  wp12-release.md's `scripts/` row omitted `bootstrap.sh` and `amritc.sh`,
  which the tarball ships, and the file count was 92 against a measured
  135. Multi-error reporting and `--json` were listed as not in the work
  package and have since landed in WP10; the line says so rather than
  disappearing.

  The oracle counts are measured rather than remembered: 289 of 289
  programs, 1,305 modules and 2,048,420 lines of IR, against the 280 and
  989 the doc carried. The "skips S5 left behind" table keeps its figures
  and is relabelled as the record of that closure, which is what it is;
  the sentence beside it no longer counts `-g` among the skips, because
  stage1 emits DWARF now and the oracle compares those two programs like
  any other.

- **Link the self-hosted compiler's output from the compiler**

  `amritc self/compile.ts --link amritc` produces a compiler byte-identical
  to the one that ran it, with no shell script between them.
  scripts/amritc.sh is deleted.

  WP14 §3a D4 dropped `--link`, `--profile` and directory creation from the
  self-hosted compiler because they would mean `spawnSync` and `mkdirSync`
  builtins and runtime growth. It was right about the order of the work —
  the fixed point compares IR and never needed a linker, and 195 lines of
  bash carried the deployment path through four landings. It was wrong
  about the end state: a compiler that cannot produce an executable on its
  own is self-hosted in the IR and not in the artifact.

  Two builtins, each landed in src/ first with its golden, its native round
  trip, two negatives, its LANGUAGE.md rule and its cookbook entry.
  `mkdirSync(path)` makes one directory, not recursively, and answers
  whether a directory is there afterwards; the retry is a stat rather than
  `errno == EEXIST`, so a plain file at the path answers false, which is
  what the promise means. `spawnSync(argv)` runs argv[0] through PATH,
  waits, and answers the exit status, 128 + signal, or -1 for an empty
  vector or a program that would not start. Both answer a value where they
  could have exited, for the reason readFileSyncOrNull answers null: there
  are no exceptions, so the caller owns the diagnostic.

  `spawnSync` is the first builtin whose pointer argument the runtime
  keeps — amrit_spawn copies each element's bytes pointer into an arena
  vector that outlives the call — so classifyUse reports an escape and the
  declaration carries no `nocapture`; and the first that is not
  `willreturn`, because the child may never exit and waitpid waits.

  With them self/compile.ts plans its own output on stage0's rules, makes
  every directory in the way of the IR, a sidecar or the binary, writes
  <module>.ll beside each source when nothing is named, refuses `--link`
  on a program with no `export function main` before the emit rather than
  leaving it to the linker, and refuses `--emit-ast` by name. It finds
  scripts/build.sh and runtime.c from the path it was invoked by, falling
  back to the working directory, and names both when neither has them.
  Nothing about the host platform came in with any of it: `--link` spawns
  `bash scripts/build.sh`, which is what src/index.ts spawns and where the
  uname and the profile flag sets have always lived.

  The bill is 257 bytes of .text, 2,287 to 2,544 at -Oz, and a program
  that calls neither pays none of it: examples/hello.ts at the size
  profile is 4,696 bytes with these two functions in the runtime and 4,696
  without, because -ffunction-sections --gc-sections drops both. The
  runtime budget in MASTER_PLAN §2 is restated to measure .text rather
  than the text column of size, which counts the .eh_frame the size
  profile strips, and rather than source bytes, over budget since WP4
  because comments are not code.

- **Point the docs at the compiler instead of the wrapper**

  Five files still told a reader to run `scripts/amritc.sh`, which no
  longer exists, and listed the link step and the directory creation among
  the things only stage0 does. Both are the self-hosted compiler's now.
  What is left of that list is the `--emit-ast` dump and `--target host`,
  and the docs say so where they said the other.

  INSTALL also gains the one fact a user needs that the wrapper used to
  hide: the compiler looks for scripts/build.sh and runtime/runtime.c one
  level up from its own path and then in the working directory, so it
  wants a checkout or an installed package around it, the way the Node one
  does.

- **Give the differential harness the two new builtins**

  `io_mkdir` and `io_spawn` ran natively and failed under Node, because
  runtime/shim.mjs had no `mkdirSync` or `spawnSync` and
  tests/differential/rewrite.js did not know their names. That is the shape
  of every builtin that has ever been added and forgotten there, and it is
  what the WP13 comparison is for: 125 of 136 programs agree with Node now,
  0 unexpected failures.

  The shim's `mkdirSync` decides with `statSync` rather than with the
  exception Node throws, so it answers `false` where the runtime answers
  `false` — a plain file at the path included.

  The runtime figures the docs quote are re-measured against the tree as it
  landed: 12,707 bytes of source, not the 13,091 an intermediate draft had.
  ARCHITECTURE.md's runtime paragraph carried the pre-WP7 numbers and the
  old two-part budget; it carries `.text` now, like MASTER_PLAN §2.

  Also records the one change the new builtins forced in the checker:
  `checkArgumentType` compared type kinds, which was enough while every
  builtin wanted a scalar or a string, and an `i32[]` is not a command
  line.

- **Build every bootstrap stage with one --link**

  scripts/bootstrap.sh compiled stages 2 and 3 with --out-dir and then
  called scripts/build.sh itself, which made it a second driver with its
  own opinion about where the IR goes — the thing D4's reversal was meant
  to stop needing. Each stage is one --link by the stage before it now,
  and the equalities read the <exe>.modules/ directory --link already
  writes, so the chain that proves the fixed point is the same command a
  user runs. link_stage is gone with the two scratch directories it needed.

  Verified: --verify over the whole chain, 51 modules identical for
  IR(stage0) == IR(stage1) and again for IR(stage1) == IR(stage2), stage3
  byte-identical to stage2.

  The bootstrap's own figures are re-measured with it: 6,049,827 bytes of
  IR, against the 5,963,202 the doc carried. 51 modules rather than the 54
  files in self/ because the three dump entry points are the oracles'
  roots, not compile.ts's imports — which the doc now says, since the two
  numbers look like a discrepancy otherwise.

- **List in full what is still stage0's**

  §7a said which flags stayed behind but not the whole of it, which is how
  a gap gets rediscovered a milestone later. Four things, each with the
  reason and the measured price: `--emit-ast` and `--target host`, both
  refused by name with a message; exit 70 for an internal error, where the
  self-hosted compiler reaches `panic(msg)` and the language defines that
  as exit 1; and `-o <dir>` for an existing directory without the trailing
  slash, which stage0 answers with a `stat`.

  The price of the second is measured rather than guessed: `process.platform`
  and `process.arch` as builtins, composed into a triple the way
  src/codegen/target.ts composes one, cost 8 bytes of `.text` — not the
  ~40 first written here.

  None of the four is a program one compiler can build and the other
  cannot, which is the line §1 drew.

- **Count the tarball again now the wrapper is out of it**

  The suite measures it and says 134; the doc said 135, which was right
  before scripts/amritc.sh was deleted.

- **Design WP18: user generics by monomorphisation**

  A design note only: no compiler code, no test, and no other document
  changes. The decision it is written inside — AmritScript gets user
  generics, lowered by monomorphisation, in both compilers, with
  AmritScript-0 left alone — is taken; this note is the how.

  The load-bearing parts:

  - Inference at a call site, not type arguments. `self/parser.ts` has one
    token of lookahead and no backtracking, so `f<i32>(x)` is a comparison
    to it; the two positions where a type argument is unambiguous — an
    annotation and after `new` — are the two its parser already reads.
  - One definition per instantiation, in the module that declares the
    template, with the template's own linkage. `linkonce_odr` is rejected:
    this is a whole-program compiler, and folding would defeat the
    `internal` linkage `--strict-exports` exists for.
  - Termination is a static rule, not a depth limit. A cycle in the
    template graph is legal only when every type argument on it is a bare
    parameter; an expanding edge is refused with the chain named. A hard
    instantiation cap stays as a backstop.
  - An instantiated generic class is an ordinary struct type, `Box$i32`,
    so layout, `implements`, `extends`, DWARF and the C header need no new
    case. `# Changelog

All notable changes to `nish` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

**This file is generated.** A section is written when a release is cut, from
the commits that release contains: `scripts/changelog-gen.mjs` reads each
commit's subject for the heading and its body for the prose, and writes
`changelog/<version>.json`. That JSON is the record — it is what the website
reads — and the section below is rendered from it. To fix a wording, edit the
JSON in the release pull request and re-render; editing here is overwritten.

The release pull request is where a release is reviewed: every merge to `main`
refreshes it with the version bump, the JSON and this section, and merging it
creates the tag. [docs/wp12-release.md](docs/wp12-release.md) has the
procedure, and `CLAUDE.md` has the commit convention the headings come from.
Between releases `[Unreleased]` is empty, because there is nothing to write by
hand — the git log is the working account until a release turns it into one.

 becomes reserved in a declared name so the mangling is
    injective, and the C spelling reuses the `_` collapse plus
    AMRIT_SYMBOL that method symbols already use — `-pedantic` refuses `# Changelog

All notable changes to `nish` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

**This file is generated.** A section is written when a release is cut, from
the commits that release contains: `scripts/changelog-gen.mjs` reads each
commit's subject for the heading and its body for the prose, and writes
`changelog/<version>.json`. That JSON is the record — it is what the website
reads — and the section below is rendered from it. To fix a wording, edit the
JSON in the release pull request and re-render; editing here is overwritten.

The release pull request is where a release is reviewed: every merge to `main`
refreshes it with the version bump, the JSON and this section, and merging it
creates the tag. [docs/wp12-release.md](docs/wp12-release.md) has the
procedure, and `CLAUDE.md` has the commit convention the headings come from.
Between releases `[Unreleased]` is empty, because there is nothing to write by
hand — the git log is the working account until a release turns it into one.


    in a C identifier.
  - One AST, N type assignments: every node-keyed side table moves behind
    an accessor and each instantiation carries an overlay. That is the
    first milestone and its diff is large while its test output is empty.

  The worked IR for identity<T> and Box<T> is checked against the goldens
  it is copied from rather than invented, and per-instantiation purity is
  shown with two attribute groups that already exist in the tree.

  Result<T, E> and Array<T> stay built-in, against wp15 §5's aspiration,
  with the reason. Discriminated unions are deferred with the coupling
  that paired them to generics dissolved. Nine open questions are recorded
  as questions.

- **Bring the plan and the design notes back level with the tree**

  MASTER_PLAN.md called itself the single source of truth while describing a
  compiler from several milestones ago. §4 named `src/checker.ts` and a
  single-file checker and stopped at the WP-P era; it is now an inventory of
  what is actually here, both compilers included, with the measured numbers
  cited to the notes that hold them. §5 stopped at WP11: WP12, WP13, WP14, WP16
  and WP17 are recorded in the plan's own form and marked landed, WP15 as the
  roadmap the project is on. §6's waves and §9's milestones carry their state —
  M1/M2/M3/M5 done, M4 the open one — and §9 now carries WP15's sequencing, so
  the remaining road is in the plan and not only in the design note. The branch
  every agent was told to work on, `claude/llvm-ir-typescript-compiler-hf5pxr`,
  is `main` in all three places it appeared.

  src/checker/result.ts opened with a TODO(WP17) saying small `Result`s are not
  returned by value and that a `Result` may not cross the interop boundary. Both
  have been false since WP17: the comment now describes the packed `i64`, what
  `resultByValue` decides, what keeps the pointer, and the header, N-API and
  wasm bridges, and points at docs/wp17-result-abi.md for the measurements.

  wp17-result-abi.md ended with "the DWARF is still stage0's". `self/debug.ts`
  has landed; the sentence keeps its point about what WP17 shipped and says what
  closed it since.

  wp14-selfhost.md described `scripts/amritc.sh` in the present tense in the
  `-g` section, which is a statement about today and is now wrong — `-g` is a
  flag of `self/compile.ts`, which hands it to `scripts/build.sh` itself. §7 is
  history and keeps its wording under its "superseded by §7a" banner; only its
  copy-pasteable command line is marked.

  wp9-optimisation.md's summary table said spectral and nbody met the 1.10x
  target. BENCHMARKS.md, regenerated, says spectral 1.18x, nbody 1.14x, strbuild
  1.64x and result 2.59x — four misses. The table stays as the snapshot it is,
  and a new section records the four current misses with a pointer to where each
  is diagnosed: wp17 §4 for `result`, this file's own remaining item for
  `strbuild`, and nowhere yet for spectral and nbody, which is said plainly
  rather than guessed at.

  wp12-release.md gains the decision nobody had written down: the compiled
  native binary is what should reach a user, and stage0 exists to build it and
  to be the seed and the oracle. Today `files` ships `scripts/bootstrap.sh`
  without `self/`, so the bootstrap in the tarball exits 3 on its own guard. The
  three ways to close that are recorded with what each costs. Nothing about
  packaging changes here; `package.json` is untouched.

- **Say that the built-in Result stays built-in**

  The WP15 entry inherited wp15 §5's expectation that generics turn
  `Result<T, E>` into ordinary library code. The generics design decided the
  opposite for the two built-in type constructors: monomorphising a user generic
  is the same mechanism, but `Result` and `Array` keep their built-in
  resolution because their layouts are derived rather than declared and their
  lowering is already special at the call boundary.

- **Correct the WP18 termination rule to accept ground recursive edges**

  The rule as written refused a terminating shape. It called an edge
  non-expanding only when every type argument was a bare type parameter,
  so a recursive call that binds the parameter to a concrete type —
  `countDown(1, n - 1)` inside `countDown<T>`, where inference gives
  `T := i32` — was labelled expanding and rejected, even though its
  instantiation set is two entries and the worklist drains after one
  step. The same false rejection hit mutual recursion where a generic
  helper bottoms out at a concrete type.

  An edge is now expanding iff some type argument mentions a parameter of
  the source template without being exactly that parameter, which splits
  the arguments into three cases rather than two: a bare parameter passes
  the caller's tuple on, a ground argument names one fixed instantiation
  that re-entering the cycle asks for again, and only a constructor
  applied to a parameter builds something larger.

  The soundness argument moves with it. The bound was over the seed's own
  arguments, which is wrong now that a cycle may introduce a type the seed
  never mentioned; it is over the subterms of the type expressions the
  program mentions, a finite set fixed before monomorphisation starts
  because unification selects subterms and never builds. Nothing on a
  legal cycle constructs a type, so the reachable tuples are bounded by
  that set to the arity.

  Also in this commit:

  - Say explicitly that a self-edge is a cycle. `grow` is a path of length
    one, so a detector that only looks for paths of two or more misses
    every case the rule exists for.
  - Write `grow`'s recursive call without an explicit type argument, which
    §2a forbids anyway. Inference produces the expansion from `[x]`, which
    is the better example: the rule is about the graph the checker builds,
    not the syntax the user typed.
  - Diagnostic 5 no longer over-promises. It says the argument is under a
    constructor rather than that it is larger, and offers both accepted
    fixes — pass the parameter itself, or a type that does not mention it.
  - Pin the boundary with tests instead of prose: `gen_recursive_ground`
    joins `gen_recursive_same_type` as a positive golden, opposite
    `reject_generic_polymorphic_recursion` and
    `reject_generic_expanding_field`.

- **Point the plan at the generics design note**

- **Bridge the unsigned widths and f32 through the N-API shim**

  `--emit-napi` kept its own reader and boxer tables and they had rows for
  i32, f64, bool and i64 only, so `reader()` and `boxer()` answered undefined
  for u8, u16, u32, u64 and f32, `plan()` refused the whole signature, and the
  addon simply did not export the function. A packed `Result` over those
  payloads went the same way, since its arms go through the same tables. The C
  header and the wasm `.d.ts` had carried the widths since WP15, so a host read
  a prototype for a function the addon did not have.

  Each width now has both halves.

  Reading. `SCALAR_READERS` gains `raw`, `open` and `close`: the C type the
  getter writes, and how it becomes the parameter's own type. It differs from
  `c` exactly where N-API has no getter of that width. `napi_get_value_uint32`
  is the only unsigned getter for a JS number, so u8 and u16 are read into a
  `uint32_t` temporary and then cast; u32 needs no temporary. The rule for an
  out-of-range number is the one JavaScript itself applies storing into a typed
  array — ToUint32, then the width's modulus — so 300 reaches a u8 as 44 and -1
  reaches a u32 as 4294967295, and nothing throws. That matches the i32 reader,
  which has always applied ToInt32, and a bridge that refused 300 for a u8
  while wrapping 2^31 for an i32 would be the surprising one. f32 is read as a
  double and converted by a generated `amrit_napi_f32` rather than a bare cast,
  because C leaves a double-to-float conversion undefined out of range: the
  helper sends anything at or past 0x1.ffffffp127 — the midpoint between
  FLT_MAX and 2^128, where round-to-nearest-even stops being finite — to an
  infinity of that sign, and converts everything else, NaN and the infinities
  included, directly. u64 crosses as a bigint like i64, through
  `napi_get_value_bigint_uint64` and the same shared `lossless` local.

  Boxing. `scalarBox` gains `napi_create_uint32` for u8/u16/u32, which is what
  keeps a u32 above 2^31 positive instead of handing JS the negative twin of
  the same bits, `napi_create_bigint_uint64` for u64, and `napi_create_double`
  for f32, which widens exactly. A packed `Result` narrows each arm through its
  own temporary and assigns into the union member the discriminant selects.

  Saying so. A function the shim genuinely cannot carry was omitted under one
  fixed sentence that named neither its types nor the position that stopped it,
  which is how the gap survived. It is now `not bridged: parameter 1 (p) is
  Point` / `not bridged: it returns Result<number, IoError>`, under a heading
  listing what does cross.

  `self/interop_napi.ts` carries the same change — a `ScalarReader` there grows
  the same four fields and `napiReaderLines` writes the same lines from them —
  and `tests/self/interop_oracle.js` compares the two shims byte for byte over
  a corpus that now includes `tests/self/interop_widths.ts`. That fixture is
  also built into a real `.node` addon by the interop section of `tests/run.js`
  and called at every boundary: 0, 255, 65535, 4294967295, 300 and -1 through
  the readers, a u32 above 2^31 and a bigint u64 back out, an f32 round trip
  that must equal `Math.fround(0.1)` and not 0.1, a double past the float range
  that must be an infinity, and both arms of a `Result<f32, u8>`.

  Bare unsigned widths still do not cross the wasm loader — `--emit-dts`
  declares them but `crossesWasm` does not list them, so the companion `.mjs`
  writes no entry. That is loader work (a mask in, `>>> 0` and
  `BigInt.asUintN` out) and is now written down in docs/wp8-interop.md under
  "Not in this package" instead of being left to be discovered.

- **Plan the retirement of stage0 instead of only its freeze**

  WP14 §6 decided stage0 is frozen rather than retired: kept buildable as the
  bootstrap seed and the differential oracle, not kept up to date. That bounded
  the cost of two implementations but left no account of the end state, so the
  question "when can the Node compiler go" had no answer written down anywhere.

  docs/wp18-stage0-retirement.md is that account. It takes the arrangement rustc
  and Go both reached — the seed is the previous release of the compiler itself,
  not a second implementation — and prices it against what stage0 still owns:

    - the four flags and exit codes §7a left with it;
    - twelve oracles, six of which die with stage0 and six of which never read
      src/ and survive, plus the successor for the six (the seed release
      compared against HEAD over the corpus, byte for byte);
    - the npm package, the --version source, and wp12's "prebuilt binaries are
      a non-goal", all three of which are statements about stage0;
    - IR(stage0, self/) == IR(stage1, self/), the diverse-double-compiling
      property none of the projects in the comparison table asserts.

  Six gates, each with a check that CI can fail: parity, oracle succession
  before deletion, a seed protocol CI exercises, a published seed policy, a
  distribution path that does not need Node, and a tag recording the provenance
  before it is unrecoverable. Four builtins close the parity gate —
  process.platform/arch, isDirectorySync, getenv, panicInternal — and every one
  lands in stage0 first, because the seed has to compile the compiler that
  replaces it.

  Retirement does not dissolve AmritScript-0 and does not remove Node from the
  harness; it moves the freeze's reference point from stage0 to the last
  release, turning a permanent lag into a one-release one. That, and not the
  deleted code, is what the package buys.

  Nothing here is scheduled. The document ends with the honest trigger: a
  release cycle in which stage0 found nothing, changed nothing, and shipped
  nothing except itself.

- **Close three of the four gaps between stage0 and stage1**

  docs/wp14-selfhost.md §7a listed four things the self-hosted compiler still
  left to stage0. Three of them close here. `--emit-ast` stays refused by name,
  which is a decision rather than a to-do.

  Three constructs enter the language and src/ first, each with a golden .ll, an
  llvm-as pass, a native round trip, negatives, a LANGUAGE.md rule and a cookbook
  entry, and only then self/:

    process.platform      %v = call i8* @amrit_platform()
    process.arch          %v = call i8* @amrit_arch()
                          declare noundef nonnull align 8 i8* @amrit_platform() #n
                          attributes #n = { nounwind willreturn readnone }

    isDirectorySync(p)    %v = call zeroext i1 @amrit_is_dir(i8* %p)
                          declare zeroext i1 @amrit_is_dir(i8* noundef nonnull
                              readonly align 8 nocapture) #m
                          attributes #m = { nounwind willreturn }

  The two machine properties answer the address of a string in the runtime's own
  constant data, settled when runtime.c was compiled — a cross build compiles the
  runtime for the target, so the answer is the target's. Nothing is allocated and
  nothing is loaded, which is what makes readnone a fact rather than a hope and
  lets two reads in one function fold into one; the declarations deliberately
  carry no noalias, because every call answers the same pointer and noalias
  promises the opposite. amrit_is_dir is one stat and carries effect "write" for
  the reason amrit_parse_number is not readonly: a failed stat stores errno, and
  the file system is not memory LLVM may reason about, so a caller must not be
  hoisted across anything that could change it. amrit_mkdir is rewritten to call
  it, so the stat exists once.

  With them self/target.ts composes the host triple exactly as
  src/codegen/target.ts does, so --target host is stage1's and both compilers
  emit the same module for it; and self/compile.ts takes `-o <dir>` for a
  directory that is already there, without the trailing slash, which is the rule
  stage0's statSync has always applied.

  An internal compiler error in stage1 exits 70 (EX_SOFTWARE) with stage0's
  report, where a broken invariant used to reach panic(msg) and exit 1. This
  needed no language change, which is why it was chosen over the second panic §7a
  also costed: process.exit(n) already means "this code, now", so the status one
  program wants for its own bugs is not the language's business, and the report's
  wording is the compiler's policy rather than a builtin's. self/ice.ts holds the
  report and answers the status, so each of the 28 converted sites is the single
  statement `process.exit(internalError("..."))` — a report call followed by an
  exit could be half-written, and this cannot, because process.exit is what the
  definite-return analysis reads as a terminator. stage1 names AMRITC_DEBUG and
  says there is nothing behind it here rather than promising a stack: with no
  exceptions the report is made at the site, so there is no stack to unwind and
  no process.argv to read (that builtin needs an entry main, and the modules that
  report internal errors are compiled on their own too). Seven sites in
  self/emit_ops.ts and self/interop_napi.ts still exit 1; both files are owned
  elsewhere.

  runtime.c .text at -Oz goes from 2,544 to 2,561 bytes against the 4,096 budget:
  eight bytes each for the two machine functions, exactly as §7a costed them, and
  one byte net for the stat. examples/hello.ts at the size profile is 4,696 bytes,
  the same as before, because --gc-sections drops what is not called.
  runtime/shim.mjs, tests/differential/rewrite.js and runtime/amritc.d.ts know all
  three, the last of them also picking up mkdirSync and spawnSync, which it had
  never been told about.

- **Lower bitwise compound assignment to a field and an element**

  `this.flags |= MASK` and `xs[i] &= 0xff` were refused — `Unsupported
  assignment operator `|=`` for a field, `Only simple variables can be
  assigned` for an element — while `+= -= *= /= %=` had taken both targets
  since WP2 and WP4. Nothing but a missing row stood behind that: the
  lowering the arithmetic forms use is exactly the one the bitwise family
  needs.

  The lowering. A field is one `getelementptr` shared by the load and the
  store: GEP, `load`, one instruction, `store`, and the expression's value
  is what was stored. An element is the array, the index, one bounds check,
  one GEP, `load`, one instruction, `store` — so the target expression is
  evaluated exactly once and pays for exactly one check, which is what
  `xs[next()] |= 1` needs and what `arr_element_bitwise_assign`'s `.out`
  proves by printing once per statement rather than twice.

  To keep the three targets from drifting apart, each half is written once
  and shared. `checkBitwiseAssignOperands` is the operand rule (two
  integers of one type, a boolean refused by naming `&&`/`||`/`!==`, the
  f64 hint under `--number-mode f64`) and names the compound token that was
  written, so a local, a field and an element are refused in the same
  words. `emitBitwiseCombine` is the apply step, which is where the
  shift-count mask lives: `f.bits <<= 33` is a shift by one on a field
  exactly as on a local, a constant count folds and a variable one costs
  one `and`, and `>>` still reads the target's signedness — `ashr` on
  `i32`, `lshr` on a `u32`, where `>>>` is always `lshr`.

  Nothing about a write relaxes. `readonly` is checked before the operator
  is looked at, so an inherited `readonly` field refuses `|=` in a derived
  constructor and everywhere else; definite assignment still counts
  `this.f |= v` as a read of `f`, because it is one; and the memory-effect
  and escape facts were already keyed on `isAssignmentOperator`, so a field
  or element write through the new operators is classified as it always
  was.

  Both compilers change together, and `self/` gains one property it lacked:
  its local `&=` path went through `checkOperator` with the operator
  stripped, so it reported ``Operator `&` `` where stage0 reported
  ``Operator `&=` ``. Routing all three targets through the shared rule
  removes that divergence rather than adding a second one.

  Also fixed here because the new negative case walked straight into it:
  `installArrayAssignmentCheckers` handed `checkElementAssignment` a spread
  copy of the binary expression so the parentheses of `(a[i]) += v` were
  already peeled. A spread copy is a plain object with no `getStart`, so
  the first diagnostic reported on the expression itself died with exit 70
  instead of printing. The unwrapped target travels beside the real node
  now.

  Tests. `cls_field_bitwise_assign` and `arr_element_bitwise_assign` are
  new goldens with native round trips. The two cases that described the old
  refusal are repointed rather than deleted, to the negatives that are still
  true: `reject_cls_field_bitwise_assign` becomes
  `reject_cls_field_bitwise_readonly` (an inherited `readonly` field) and
  `reject_arr_element_bitwise_assign` becomes
  `reject_arr_element_bitwise_f64` (an `f64` element, refused by the operand
  rule). `tests/differential/corpus/bit_compound_target` puts the mask, the
  fill and the single evaluation in front of Node and they agree.
  `docs/LANGUAGE.md`, the `expr_compound_target` cookbook entry and
  `CHANGELOG.md` follow.

- **Cross the unsigned widths to wasm, and declare only what the loader implements**

  `--emit-dts` and its companion `.mjs` each decided for themselves what crosses
  the wasm boundary, and the two answers had drifted. `wasmType` spelled
  `u8`/`u16`/`u32` as `number` and `u64` as `bigint`, so the declarations carried
  such a function; `crossesWasm` had never listed those widths, so the loader
  wrote no entry for it. `load()` returned an object missing a function its own
  typings promised -- a TypeError at the call site with no diagnostic anywhere,
  reproducible today with `port(p: u16)` in tests/self/interop_payloads.ts.

  There is one predicate now. `wasmType` moves next to the loader and
  `wasmSkipReason` is built on it; `generateDts` declares a function exactly when
  `wasmBridged` keeps it, so neither file can describe a function the other
  omits. A function that cannot cross becomes a comment naming the position and
  the type that stopped it (``argument 2 (a) is `string` ``, ``the result is
  `string` ``) instead of one blanket sentence, and `main` -- which the loader
  always dropped and the declarations always kept -- is named too.

  The widths then have to be bridged for real. The wasm ABI has only
  i32/i64/f32/f64, so all four unsigned types share a value type with a signed
  one and the loader is the only place their range can be restored:

    idU8:  (x) => raw.idU8(x & 0xff) & 0xff,
    idU32: (x) => raw.idU32(x) >>> 0,
    idU64: (x) => BigInt.asUintN(64, raw.idU64(x)),

  Out, for two different reasons. A `u32` result is the full width but signed, so
  4294967295 was reaching JavaScript as -1 and a `u64` above 2^63 as a negative
  bigint. A `u8`/`u16` result is masked because the callee does not narrow it:
  `add i8` is congruent modulo 256, so the wasm backend adds in a 32-bit register
  and `addU8(200, 100)` answered 300 where the language says 44.

  In, only the narrow two, and the reason is the IR rather than the observed
  behaviour. The emitter writes the parameter as a bare `i8` with no `zeroext`
  (`define noundef i8 @idU8(i8 noundef %x)`), which leaves zero-extending it the
  caller's job under the wasm C ABI, and JavaScript is the caller. Today's
  backend, having no `zeroext` to lean on, inserts the `i32.and` itself wherever
  the narrow value is observable inside the callee -- before an `icmp ugt i8`, a
  `udiv i8`, a `zext i8 to i32` -- so an unmasked argument survives by luck, and
  it is luck the day the emitter adds that attribute would take away silently.
  The mask also makes the boundary behave the way JavaScript already does for
  these widths: `idU8(300)` is 44 and `idU8(-1)` is 255, as a Uint8Array store
  would give. The spellings are runtime/shim.mjs's, so the wasm build and the
  differential rewrite agree on what a `u32` above 2^31 is.

  `f32` needs nothing either way, checked rather than assumed: the JS-to-wasm
  call rounds an argument to f32, which is what an `f32` parameter means, and
  every f32 is exact in the double a result arrives in.

  Both compilers change together (src/interop/{wasm,dts}.ts,
  self/interop_{wasm,dts}.ts) and the interop oracle compares their sidecars byte
  for byte over a corpus that now includes tests/self/interop_unsigned.ts. The
  WP8 section of tests/run.js builds that module to wasm and calls it at every
  boundary -- 0/255/65535/4294967295/2^64-1, the truncations on the way in, and a
  `u32` above 2^31 arriving positive -- and checks that every function a `.d.ts`
  declares has an entry in its `.mjs`. Four of those checks fail on the old
  generators.

- **Renumber the retirement plan to WP19 and defer to WP18 where it lands**

  PR #13 claims WP18 for generics by monomorphisation, and it was opened first.
  It also lands three of the builtins this plan asked for — process.platform,
  process.arch and isDirectorySync — which closes two of the four rows §7a left
  with stage0: --target host and `-o <dir>` without the trailing slash.

  So the document is WP19, its §2A table marks those two rows as WP18's rather
  than counting them twice, and §4's builtin table says which side of the line
  each of the four is on. What is left here is getenv and panicInternal.

- **Comment the macOS job out of the CI matrix**

  Every CI run has been red on macOS and green on Linux, on this branch and on
  main alike, for a reason that is neither the compiler's nor the architecture's:
  scripts/build.sh runs under `set -euo pipefail`, and macOS ships bash 3.2 as
  /bin/bash, where expanding an empty array as "${arr[@]}" while `set -u` is on
  raises "unbound variable". bash 4.4 made that expansion legal, so every Linux
  runner passes it at any architecture and every macOS one dies at

    scripts/build.sh: line 96: pgo[@]: unbound variable

  pgo, elf, strip_flag and libs are all legitimately empty on the ordinary macOS
  path, so every --link at the speed, size and napi profiles fails before clang
  is reached.

  The matrix entry is commented rather than deleted, and carries the fix beside
  it: ${arr[@]+"${arr[@]}"} at the nine sites that expand those four arrays.
  docs/wp10-ci.md says what the gap costs while it is open — the ld64 / Mach-O
  half of build.sh, -dead_strip and -Wl,-x and the absence of -fuse-ld=lld and
  -fno-plt, which no Linux runner exercises at any architecture.

- **Say in the README that the project is pre-alpha**

  The README described what the compiler does and where the milestones stand,
  but never said outright that none of it is stable. Add a status note beside
  the working-title note: the version is 0.1.0, the language, the CLI flags and
  the emitted IR change without notice until 1.0, so pin a commit and read the
  changelog before upgrading. The Project status section now names M4 as the
  milestone that freezes the reference, so the table is read as a schedule
  rather than a stability claim.

- **Add the performance diagnostic class with its first two warnings**

  WP15 §8. The compiler now says something when it had to take a slow path
  and a faster one was available, in a third severity beside error and syntax
  error. A warning is the same anchored, excerpted diagnostic an error is,
  with `performance` where the word `error` would be, so nothing that greps
  `: error: ` picks one up, and `--json` carries `"severity":"performance"` —
  the field a tool filters on. Warnings are on by default, print on stderr,
  and never touch the exit code: a program that trips one still compiles and
  still exits 0. A compilation that failed prints its errors and none of its
  warnings, which is what keeps the single-error output byte-identical to
  what WP10 pinned; more than one warning is capped at 20 exactly as the
  error report is. They need no sort — the analysis meets them in module load
  order and then in source order, which is the order the sink sorts errors
  into. `--no-warn-performance` silences the class and changes nothing else,
  and deliberately never reaches CompilerOptions: the checker computes the
  warnings either way and only the driver reads the flag, so the option
  struct that --emit-checked, the interop surfaces and both compilers mirror
  is untouched, and the IR is byte-identical with the flag and without it.

  The analysis is a per-function pass in the checker after the body is
  checked (src/checker/performance.ts, and the WP15 section at the end of
  self/checker.ts). Both facts are syntax plus the types and bindings pass 2
  already wrote, so nothing is re-derived; the emitter could not host them,
  because emit/*.ts reports no user-facing diagnostics at all and an
  unexpected node there is exit 70. The walk carries a stack of the enclosing
  loop statements and a parallel record of the local each declaration
  introduced and the loop depth it was introduced at, which is what tells
  "the accumulator is reset every pass" from "the accumulator outlives the
  pass". A `for` initializer is walked outside the loop it heads, because it
  runs once; a `for...of` variable inside it, because it is a fresh binding
  every pass.

  Quadratic string building fires on `s = <rhs>` where `s` is a string local,
  the assignment sits in a loop that did not declare it, and `rhs` reaches
  `s` through `+` operands, parentheses or template holes. Every pass copies
  the whole accumulator into a fresh arena string, which §1 measures at
  180 MB of peak RSS for 88 KB of output. `s += t` is not a case: `+=`
  requires numeric operands in this language.

  Allocation in a loop is narrowed to exactly what WP6 does not already
  handle: a `new Array<T>(n)` with a non-literal `n`, which can never be an
  entry-block alloca, declared inside a loop, and whose local is only ever
  read through within that iteration. A stackable site — `new C(...)`, an
  object or array literal, `new Array<T>(<literal>)` — becomes one alloca
  whose slot is reused every pass and has nothing to hoist, and an allocation
  that is pushed, stored, returned or handed to a callee is memory the
  program asked for. Both stay silent, because a warning that fires where the
  compiler already did the right thing is the un-actionable kind §8 forbids.

  Tests: perf_str_concat_loop and perf_alloc_loop for the warnings, over
  `for`, `while`, `do` and a nested loop whose accumulator is declared one
  level out; perf_str_concat_quiet and perf_alloc_quiet for the guards, which
  are the cases that matter — loops that concatenate and allocate and must
  say nothing at all. A WP15 §8 block in tests/run.js pins the exact text and
  excerpt of both messages, the flag, the --json shape, the 20-warning cap,
  and that a failed compilation reports no warnings.

  Run over the corpus, the warnings found one real bug: self/lexer.ts builds
  the text of a string and of a template literal one character at a time with
  `text = text + ...` inside a while loop, the shape .claude/selfhost.md
  forbids in self/. It is reported here rather than fixed, since the fix is a
  change of its own.

- **Reclaim a callee's arena temporaries at the call site**

  A function that returns a string can never have an automatic arena scope:
  the string it hands back has to outlive it, so `returnsAllocation` disables
  the scope and every intermediate it built stays in the arena for the life of
  the program. That is what made bench/strbuild touch 48 MB of fresh pages to
  produce an 806 KB string, and it is the remaining item the WP6 note at the
  top of docs/wp9-optimisation.md left open.

  The lowering. A call to a user function now compiles to

      %mark = call i64 @amrit_arena_mark()
      %t    = call i8* @join(i32 %lo, i32 %hi)
      %kept = call i8* @amrit_arena_keep(i64 %mark, i8* %t)

  with %kept used everywhere %t would have been. The mark is emitted after the
  arguments, so the bracket contains what the callee bumped and nothing the
  caller did. `amrit_arena_keep` releases back to the mark while preserving the
  newest block: it moves the block down onto the mark and frees every newer
  chunk, or, when the mark sat at the end of a chunk the callee filled exactly,
  leaves the block where it is and unlinks the chunks between. Both arms are
  needed -- without the second the reclaim does nothing for strings above one
  64 KB chunk, which is where strbuild's memory is.

  The proof. The obligation is that every byte released is unreachable, and a
  call hands back exactly one value, so the only things in the window are what
  the callee returned (kept, not freed), what it dropped, and what it stored
  somewhere the caller can reach. The last is the whole question, and it needs
  a fact escape.ts did not have: `allocLeaks` merges a value stored where the
  caller can reach it with one merely assigned to a local of the frame
  (`s = s + piece(i)`, the shape of every string builder), and only the first
  is a reason not to reclaim. Every Outcome now carries an `escapes` bit
  computed in the same walk from the same `classifyUse` -- true for a store
  into a field, an element, a literal, a `push` or a capturing callee, and
  following the value into the local for an assignment -- and `allocEscapes`
  propagates it over the call graph in the same fixpoint as `allocLeaks`.
  `allocEscapes` implies `allocLeaks` and never the reverse; `flow` is
  untouched, so the stack rule and the automatic scopes decide exactly what
  they decided before. The recursion guard is pessimistic for `escapes`,
  because following `y = x` can cycle where the `const y = x` chains `flow`
  follows cannot.

  Only a plain `string` return is bracketed. A string is one flat block with no
  interior pointers, so relocating its bytes relocates the whole value; an array
  header names a separate data block and a `Result` names a payload bumped
  before it, so moving either would leave a dangling pointer. Every runtime
  guard refuses rather than moves -- a block that is not the arena's newest (a
  literal, or a pass-through of a parameter), a stale mark, a mark newer than
  the block -- which reclaims less and is always safe.

  Measured on bench/strbuild (131,072 pieces, 806 KB result, --profile speed,
  peak RSS via bench/rss.c): peak resident set 48,676 KB -> 16,420 KB, peak
  live arena 51,503,624 -> 15,196,680 bytes, same output and same bytes bumped.
  `.text` in runtime/runtime.c goes 2,561 -> 2,775 at -Oz against the 4,096
  budget.

  tests/cases/mem_reclaim_call is strbuild in miniature, mem_reclaim_argument
  passes the temporary on and holds it across a later call,
  mem_reclaim_no_stack_alloc pins that the flag moves allocations without
  moving a bracket, and mem_reclaim_guards is the negative half: four calls of
  which exactly one is bracketed, the others refused for storing into the
  caller's object, for Arena.reset, and for returning a Result<string, number>.
  tests/runtime_test.c covers both outcomes of amrit_arena_keep and its three
  refusals. Both compilers emit the bracket identically and the bootstrap still
  reaches its fixed point.

- **Scan string and template literals in runs, not a byte at a time**

  The `performance` diagnostic class warned about `self/lexer.ts` itself, and it
  was a true positive. `scanString` and `scanTemplate` both accumulated the
  literal's decoded text with `text = text + <one byte>` inside their scan loop,
  which is the shape docs/wp14-selfhost.md §2.3 forbids: every byte copied the
  whole accumulator into a fresh arena string, and the arena never reclaims, so
  the cost was quadratic in time and in arena bytes — in the loop that reads
  every file the compiler compiles.

  Both scans now keep a `chunk` cursor at the start of the run of plain bytes
  not yet taken. An escape flushes the run before it in one `substring`, and the
  terminator flushes the rest. The common case is that there is no escape at
  all, and it is now exactly one `substring` of the whole span with the builder
  untouched, which is why `literalText` tests `isEmpty()` rather than always
  joining. The escape path goes through one `StringBuilder` held by the lexer
  and reset per literal rather than allocated per literal, reached by the two
  helpers the two scans now share: `takeEscape`, which takes the pending run and
  the escape together, and `literalText`, which finishes the literal.

  Nothing the lexer produces changed. The token streams of 678 files are
  byte-identical to the old lexer's, the malformed ones the oracle cannot judge
  included, and tests/lexer_oracle.js still agrees with the `typescript` scanner
  over 588 files and 176,304 tokens. `tests/lexer/literals.ts` and
  `templates.ts` gain the cases where the new code's runs are empty: an escape
  at the very start of a literal, two escapes with nothing between them, a
  literal that is only an escape, a line continuation, and a template part whose
  escape runs into the `${` that ends it.

  Measured with stage1 over the whole of `self/`: peak RSS 131.8 MB to 128.9 MB,
  wall time about 226 ms to 214 ms on a shared machine, so the memory is the
  number to trust. On a source whose literals are long rather than short the
  quadratic shows its real size: 400 KB of literal text cost 408 MB and 392 ms
  to lex and now cost 2.4 MB and 10 ms. Both compilers now report zero
  performance warnings for the whole of `self/`, and both still report the four
  on the old source, which is a check on the warning as much as on the fix.

- **Turn on the two fast defaults: `nsw` and internal linkage**

  WP15 §3, item 1 of §9. Both flags flip, and the semantic half of the flip is
  a withdrawn guarantee rather than a tuning knob, so it is stated plainly
  everywhere the old one was promised.

  `--nsw` is on by default, with `--wrapping` to opt out. Every user-level
  signed i32/i64 add/sub/mul — binary operators, unary minus, `op=` on locals,
  fields and elements, `++`/`--` — now carries `nsw`, so signed overflow is
  undefined as it is in C and LLVM may widen induction variables and
  strength-reduce the loops around them. Measured on a strided sum: the index
  arithmetic widens to i64 instead of a per-iteration trunc/shl/sext and the
  loop vectorises to 16-wide strided loads, where the same source under
  `--wrapping` stays scalar.

  Unsigned arithmetic never carries a no-wrap flag, in either mode. `--nsw`
  used to put `nuw` on it, which was defensible while the flag was opt-in and
  is not defensible as a default: u8/u16/u32/u64 are defined as wrapping
  precisely so that hashing and bit-packing have somewhere to live. `intOpcode`
  now reads the checker's recorded signedness as the proof under the attribute
  and emits nothing for an unsigned type.

  Constant folding mirrors the emitter rather than diverging from it. By
  default an initialiser whose +/-/* or unary minus leaves its width is
  `attempt to compute with overflow in a constant`; the compiler will not hand
  back the one value the optimiser is entitled to assume cannot happen. Under
  `--wrapping` it wraps, as it always did. This is the treatment the two
  divisor failures already had. stage1 computes the fold and its overflow
  detection through u64, whose wrapping is defined, so the compiler never
  overflows a signed value of its own to describe one.

  `--strict-exports` is on by default, with `--no-strict-exports` to opt out:
  a function without `export` gets `internal` linkage and leaves the
  `--emit-header` / `--emit-dts` / `--emit-napi` surface with it. A C driver
  that calls a non-exported function needs the flag or an `export`; the test
  corpus took the second route, so `tests/driver.c`'s `test()`, `tests/cases/add.ts`,
  `tests/layout/structs.ts` and the two examples that exist to be called from C
  now say `export`.

  A duplicate function name is refused whether or not the flag is in play. The
  check used to be skipped under `--strict-exports`, on the reasoning that an
  `internal` symbol never reaches the linker; it does reach `analyzeFunctions`,
  which keys the whole-program fact fixpoint by `FunctionSig.name`, so two
  functions sharing a name shared one set of facts and each was emitted with
  the other's attributes. That is a miscompile, not a link error. Making the
  flag the default made it easy to hit, and the bootstrap did: an out-of-bounds
  inside stage1 the moment two modules of `self/` both declared a `narrow`.

  `self/` relied on wrapping in two places and both are fixed rather than
  exempted: the FNV-1a round in `self/map.ts` accumulates in u32, and
  `parseIntegerLiteral` multiplies through u64. Same instructions, same bits,
  and now the claim under them is true.

  Every test that pinned wrapping is re-pointed rather than deleted:
  `const_wrap` and `i64_basic` carry `--wrapping` in their `.args`, and so do
  the twelve differential corpus programs that overflow on purpose, so the Node
  oracle keeps comparing against something defined. `opt_nsw` is the default
  now and pins which operations carry the flag; `opt_wrapping` is the same
  source under the opt-out and the two goldens differ in exactly the flags.
  `reject_const_overflow_arith`, `export_no_strict` and
  `tests/link/duplicate_internal` are the new negatives.

- **Regenerate the goldens the two fast defaults reached**

  Fifteen goldens were written against the old defaults: seven where the
  call-site reclaim and this flip both changed the same file, and eight from
  the reclaim and the performance-diagnostic work, whose cases were authored
  before nsw and internal linkage became the default. The compilers already
  agreed — the self/ oracles and the bootstrap fixed point passed while these
  failed — so only the checked-in text was behind.

  Regenerated from the compiler rather than hand-merged, and read back to
  confirm both changes are present in the files that carry both: the
  mem_reclaim goldens keep their amrit_arena_mark/keep brackets and now also
  show define internal and nsw.

- **Say in wp9 that the nsw default has since flipped**

  wp9 measured --nsw as an opt-in flag and recorded that the default stays
  wrapping. WP15 §3 flipped it, so the note now points at the decision its own
  -8 % on sieve bought, and says its wrapping column is what --wrapping
  produces rather than what a default build does.

- **Regenerate the benchmarks and attribute what the defaults moved**

  The table is re-run on an idle machine with the same --runs 15 --warmup 3 the
  previous one used; the defaults are 5 and 1, and a table built with those is
  not comparable to one built with these.

  strbuild leaves the miss list: 1.64x to 0.90x against Rust and 0.82x against
  the naive C twin, which is the call-site reclaim rather than these flags.
  nbody links to 10,856 bytes where it linked to 12,000, which is the
  dead-stripping §3 promised.

  fib appeared to lose 4 % and did not. Both binaries were disassembled, their
  addresses normalised and their instruction streams sorted: the multisets are
  identical, so the difference is where the linker placed the function under
  internal linkage, not what the compiler emitted. --nsw alone is neutral on a
  recursive function with no induction variable, measured at 439 ms against 436.
  nbody is a real 2.6 % with 13 % fewer instructions, and is named rather than
  averaged away.

  wp9's current-standing table is re-pointed at these numbers: three programs
  outside the 1.10x target now rather than four.

- **Type the ambient terminators as `never` and declare the two missing builtins**

  `runtime/amritc.d.ts` claims one direction — a program `amritc` accepts is
  never one `tsc` refuses — and it was wrong about that in 68 places in `self/`
  alone.

  `panic` and `process.exit` were typed `void`. Both end control flow, so a
  function may end with either instead of a `return`, and the guard-then-panic
  shape `self/` writes wherever another language would assert
  (`if (x === null) { panic(...); }`) narrows below the guard. Neither is
  something `void` can say: `tsc` saw 16 functions falling off their end and
  some 40 values still possibly null. They are `never` now, which is how
  TypeScript spells a terminator, and the narrowing follows from the
  declaration rather than being asserted beside it.

  `mkdirSync` and `spawnSync` have been builtins since the self-hosted link
  step needed them (WP14 §3a D4) and were never declared at all.

  The claim survived being wrong because the WP16 block tested it on the
  `res_*` cases, and nothing in the `Result` surface panics. It now
  type-checks every case `amritc` accepts and every `self/` module, with the
  three real divergences named rather than tolerated: the typed-array aliases
  and the implicit `super()` on the case side, and `a.pop()` being `T` here
  and `T | undefined` in `lib.es5.d.ts` on the `self/` side. A fourth
  diagnostic is a hole in the declarations and fails the run.

  No IR changes: the file is consumed by `tsc` and by editors, never by the
  compiler.

- **Add `readonly T[]`: the array a callee may read and not write**

  `--emit-header` already spelled an array parameter `const amrit_array *`
  whenever the whole-program fixpoint proved nothing stored through it. That
  makes `const` a *consequence*, and a consequence can disappear without anyone
  deciding it should: a callee three levels down starts writing and the
  prototype quietly loses the qualifier the C on the other side was reading.

  `readonly T[]` — and `ReadonlyArray<T>`, the same type under the other
  spelling — makes it a promise the signature keeps. It is the same header, the
  same pointer and the same LLVM type; the cookbook entry is one function under
  both spellings and the two bodies are identical instruction for instruction,
  because the annotation is something the checker enforces and not something the
  emitter lowers. A `T[]` widens into one at any sink and never back, since
  laundering the promise away one call deeper would leave it worth nothing.
  Stores, `push` and `pop` through one are refused under their own names. It is
  shallow, as TypeScript's is, and it is a type rather than a parameter
  modifier, so a field, a return type and a `const`'s annotation all take one
  and the rule travels with them.

  The declaration and the fixpoint must agree. A `readonly` parameter the
  fixpoint says is written through means the checker let a write past it, and
  `const` on the prototype would then be a promise the code does not keep — a
  miscompile in the C that trusts it — so `writtenArrayParams` fails the build
  with exit 70 rather than writing the header.

  The spelling was not a choice. TypeScript permits `readonly` on array and
  tuple types and nothing else (TS1354), so `readonly Point`, which would have
  been the other half of this, is not TypeScript and was left out rather than
  invented; `readonly i32` names that rule instead of reading as a gap.

  Both compilers land together, as a construct must: a new `N_TYPE_READONLY`
  node in stage1's parser, the flag interned beside the array id rather than
  given a kind of its own so that all 27 sites asking `K_ARRAY` keep working,
  and `TypeOperator` taught to the parser oracle. `IR(stage0) == IR(stage1) ==
  IR(stage2)` still holds over the whole corpus and stage3 is byte-identical to
  stage2.

  `docs/IR_COOKBOOK.md` also picks up six lines of drift it was already carrying:
  non-exported functions gained `internal` linkage since it was last generated,
  and `regen.sh --check` was red before this change.

- **Provision the agent toolchain and gate the docs that agents read**

  Two surfaces an AI agent depends on had no enforcement behind them.

  A Claude Code on the web container starts without LLVM 18, and
  `tests/run.js` skips its toolchain-dependent half rather than failing when
  the tools are absent. A green `npm test` in such a session therefore proves
  far less than it looks, which is exactly the trap `.claude/orientation.md`
  and `.claude/node.md` warn about in prose. Add a SessionStart hook that
  installs the six binaries the harness probes for, using the same packages
  and the same private-bin-dir trick as CI, and that prints what the session
  actually got. It is remote-only and a no-op when the tools are present.
  Register it in a new `.claude/settings.json`, alongside an allowlist of the
  repository's standard commands so routine work does not stop for prompts.

  `docs/check-links.mjs` and `docs/cookbook/regen.sh --check` both existed and
  neither ran in CI, so the reference material could rot unnoticed -- and had:
  `docs/IR_COOKBOOK.md` still showed external linkage and plain `add` for six
  functions, predating the `--strict-exports` and `--nsw` defaults. Regenerate
  it and wire both checks in: the cookbook into the `test` job, which has the
  LLVM the regeneration needs, and the link check into `lint`, which needs no
  toolchain.

- **Run a program under Node with nothing rewritten, and pin the overlap**

  WP13's rewriter is exact because it loads a program through the compiler's own
  checker and rewrites every expression from the recorded types. That makes it a
  testing oracle, not something to hand anyone: "your program runs under Node"
  is not a useful claim if the answer is "after my compiler rewrites it".

  `runtime/amritscript.mjs` is the smaller claim beside it.

      node --experimental-strip-types --import ./runtime/amritscript.mjs prog.ts

  Nothing is rewritten. The prelude supplies only what Node lacks — the globals
  AmritScript has and `node:fs` does not, the conversions, `Ok`/`Err`, the two
  string parsers whose deviations are documented rules, `process.argv`'s
  indexing, an `Arena` that answers zero — plus `console.log`'s formatting, which
  has to be `String(x)` on a synchronous write because Node's console inspects
  and would print `-0` and a BigInt's `n`. Every one of them delegates to
  `runtime/shim.mjs`, the module the differential harness already uses, so a
  semantic fixed in one is fixed in both.

  It is honest in f64 mode, where JavaScript's `+ - * / %` on doubles are
  `fadd/fsub/fmul/fdiv/frem`, and it will never be honest in i32 mode, where
  `number` wraps at 32 bits and every arithmetic operator differs.
  `docs/RUN_UNDER_NODE.md` states the whole overlap rather than implying there
  isn't one: byte-length `.length`, unchecked `a[i]`, virtual dispatch,
  `orReturn()` (which needs the caller's control flow, so it needs the
  rewriter), `Number(s)`, and the three float decisions. Each lives in an
  operator or in the object model, where a prelude cannot reach.

  `tests/differential/unmodified.js` keeps it honest: every f64-mode program
  with an entry point, native against unmodified Node, four listed divergences
  and any other difference failing the run. Six of ten agree, and the four that
  do not are the programs written to probe exactly those decisions —
  `examples/nbody.ts` prints byte-identical output either way. The runner copies
  each program into a directory whose package.json says `"type": "module"`,
  because this repository's says commonjs and an in-tree `.ts` would otherwise
  be read as CommonJS and reject its own `export`.

  Also: `readonly` on an interface field finally has a test
  (`reject_cls_readonly_interface`). It has worked since interfaces and classes
  started sharing `collectField`, and LANGUAGE.md documented it as *(CLI only)* —
  an implemented rule with nothing pinning it, which is how the `panic` hole in
  the ambient declarations survived as long as it did.

- **Answer --help on stdout and give every diagnostic a stable code**

  Two halves of the same problem: a tool that wraps the compiler had nothing
  reliable to read.

  `--help` printed the usage text on stderr and exited 2, so a successful
  request was indistinguishable from a rejected one and `amritc --help`
  counted as a failed command. Split the text from the two ways it is printed:
  `-h`/`--help` now writes it to stdout and exits 0, the way clang, tsc and git
  answer it, while a genuine usage error -- unknown flag, missing argument, no
  inputs -- keeps stderr and exit 2. stage1 mirrored the old behaviour
  deliberately, so `self/compile.ts` moves with it and the comment saying why
  is rewritten. Neither returns through `process.exit`: the usage text is now
  the longest thing the driver writes to stdout, and exiting would truncate it
  into a pipe.

  `--json` carried a `code` field that the source described as "reserved and
  absent for now". Fill it in. `src/codes.ts` and `self/codes.ts` hold one
  registry of 332 rules, generated from the compiler's own diagnostic sites by
  scripts/gen-diagnostic-codes.mjs, so a new diagnostic that has no code is a
  failing check rather than something noticed a release later. A fragment is
  the longest literal run of a message's template, matched as a substring,
  which is also what keeps the project's name out of the table: every "... is
  forbidden in ${LANGUAGE}" contributes the run before the name, so
  `branding.ts` stays the only place it is spelled.

  The numbers are the point, so they never move: the generator preserves every
  assignment already committed and only appends, one past the highest in that
  band. Bands follow the pipeline -- AS0001 a syntax error, AS1xxx Phase 0,
  AS2xxx the checker, AS3xxx the driver, AS4xxx interop, AS9xxx a performance
  warning, AS0000 a rule that has none yet. 221 of the 229 distinct messages
  the suite exercises carry one; the eight that do not are built entirely out
  of interpolations and are pinned as a backlog that may shrink, not grow.

  Codes appear in `--json` only. The human summary line is unchanged, because
  the `.err` goldens and `tests/self/reject_oracle.js` match on it byte for
  byte -- and the stage0/stage1 `--json` comparison already in the suite now
  also proves both compilers resolve the same code for the same message.

  Also stop `node tests/run.js <sub>` reporting a spurious failure when the
  filter excludes the case whose IR the `-g` verify step reads.

- **Fix five review findings, four of them mine and one a stale claim**

  **The `readonly`/fixpoint guard was unsound, and it aborted legal programs.**
  `writesThrough` is not "stores through this pointer", it is a conservative
  *may-write*: `noteUse` sets it for every escape, on the grounds that an alias
  might be written through later. So the cross-check fired on
  `function first(xs: readonly i32[]): readonly i32[] { return xs; }` — a program
  the checker had just accepted — and exited 70, and it would have fired on
  `rows[0][0] = v` through a `readonly i32[][]`, which LANGUAGE.md documents as
  legal because readonly is shallow. There is no fact meaning "definitely
  writes", so no sound cross-check exists to write. The header now never consults
  the fixpoint for a `readonly T[]`: the checker refuses every write and refuses
  the widening back to a mutable `T[]`, which makes it exact where the fixpoint
  is conservative. `arr_readonly_escape` pins all three shapes, and the WP8 block
  checks the `const` survives the escape.

  **stage1 dropped the `process.exit` that an internal error needs.** Every other
  `internalError` site in `self/` is `process.exit(internalError(...))` — its own
  header explains why the pair cannot be half-written — and this one was a bare
  call, so stage1 would have printed the banner, emitted a non-`const` prototype
  and exited 0 where stage0 exited 70. Moot now that the guard is gone, but it is
  why the guard should never have been written twice by hand.

  **`mkdirSync` and `spawnSync` were already declared.** They landed in
  `amritc.d.ts` on main while this branch was in flight, and the rebase merged
  both copies without conflict because they sit in different parts of the file.
  TypeScript folds identical overloads, so nothing failed. The duplicates are
  gone and the changelog no longer claims they were missing — they were, when the
  commit was written, and were not by the time it landed.

  **The prelude's `Arena` was written inline** rather than delegating to
  `runtime/shim.mjs` like everything else in the file, which broke the one
  invariant its header claims: it answered `0n` where the shim answers `0`. It
  delegates now. The BigInt-shaped conversions (`toI64`, `toU64`, `f64ToBits`)
  stay as they are — a `TypeError` at the first `n + 1` is the right failure for
  a 64-bit integer under an unrewritten runtime, much better than a number that
  silently stops wrapping at 2^53 — but that boundary was undocumented, and
  `RUN_UNDER_NODE.md` now lists i64/u64 beside i32 mode.

  **A check that could pass by testing nothing.** The `self/` ambient check
  asserted only that every `error TS` line was the documented `pop` divergence,
  and a tsc that fell over before checking anything produces no such lines at
  all: `[].every(...)` is `true`. It now requires either a clean run or at least
  one diagnostic, all of them that divergence, and matches the file it comes from
  rather than any `TS2345` mentioning `| undefined`.

- **Make every failure machine-readable, count what the suite skipped**

  Three gaps left a tool -- an editor, a script, an agent -- guessing.

  `--json` covered the diagnostics with a source span and nothing else, so an
  unusable C toolchain (exit 3) and an internal compiler error (exit 70) printed
  prose on stderr and left stdout empty. A caller that asked for JSON then had
  to scrape stderr to learn why the run failed, which is the thing the flag
  exists to avoid. Both now print one flat object with the band-0 codes AS0002
  and AS0003; the human report still goes to stderr for a crash, because that is
  worth seeing twice. Driver refusals and unreadable paths gained the same
  `code` field.

  stage1 mirrors this for `--link`, and deliberately not for the internal error:
  `self/ice.ts` is a library module, so `process.argv` is out of reach there --
  it needs an `export function main` -- and the language has no mutable module
  state, so the only way in is a parameter on all 39 callers of `internalError`,
  which are broken invariants scattered through every phase. Recorded in
  docs/wp14-selfhost.md section 7 with the other deliberate differences.

  `tests/run.js` reported `N passed, M failed` and said nothing about what did
  not run. Without LLVM 18 the toolchain-dependent half of the suite skips
  rather than fails, so a run that proved almost nothing looked exactly like one
  that proved everything. Skips now go through `skip(reason)`, are counted in
  the summary, and a run missing the toolchain ends with a DEGRADED banner
  naming the tools and what stays unproven.

  The code generator had two flaws worth fixing before any of this shipped. It
  scanned its own output, whose header quotes the patterns it looks for, so each
  run grew a rule; and a rule that disappeared from the sources freed its
  number for the next new rule to reuse -- the one thing a stable code may not
  do. Retired fragments now keep their entry, and with it their number.

  Docs: the `--json` schema, the code bands and the registry in wp10-ci.md; the
  exit-code table and the `--help` contract in wp12-release.md; the flag in
  LANGUAGE.md and README.md; a "machine-readable surfaces" table and a section
  on what a green test run is worth in AGENTS.md; the same two points in
  orientation.md, node.md and testing.md. CI gains the registry check next to
  the cookbook one.

- **Move the package to ES modules and raise the Node floor to 22.18**

  `"type": "commonjs"` had been in package.json since the first commit. It was
  the tsc default of 2019, not a decision anyone made and defended, and nothing
  in docs/ ever argued for it — `.claude/typescript.md` merely recorded it as a
  fact, alongside the `.mjs` exceptions it forced.

  It had started to cost something. An in-tree `.ts` was loaded as CommonJS, so
  `export function main` was a syntax error before type stripping ever ran, and
  `node --experimental-strip-types examples/nbody.ts` failed in the directory the
  examples live in. `tests/differential/unmodified.js` had to copy every program
  into a scratch directory carrying `{"type": "module"}` to escape the package's
  own module system. A compiler that cannot run its own example programs in place
  is a poor advertisement for a language whose modules are ES modules and whose
  CommonJS support is nil.

  The conversion is mechanical and the type checker enumerated most of it.
  `module: Node16` means Node resolves what it is given, so every relative import
  in `src/` carries its `.js` extension — 294 across 55 files, each one an error
  (TS2835) until it did, which is a better worklist than a grep. `__dirname` in
  `version.ts` becomes `import.meta.dirname`. The 18 files of `tests/` and
  `scripts/` follow: `require` to `import`, `module.exports` to `export`,
  `require.main === module` to a comparison against `import.meta.url`, and the
  oracles' synchronous reads out of `dist/` to top-level `await import(...)` of a
  file URL. One `require` survives on purpose — a `createRequire` in
  `tests/run.js`, because `require.resolve("typescript/bin/tsc")` has no ESM
  spelling.

  The floor moves from 18 to 22.18: the version where Node strips types without a
  flag, which is what turns docs/RUN_UNDER_NODE.md into something to point people
  at rather than a footnote about `.mts`. CI already ran 22.

  Nothing in the repository consumed the package as a library, and the `bin` is
  unchanged, so the CLI is unaffected — the packaging tests install the tarball
  and drive the installed `amritc` from an unrelated directory, and they pass.
  `runtime/shim.mjs`, `runtime/amritscript.mjs` and `bench/` keep their `.mjs`
  extensions, which now mean "loaded by something else" rather than "the
  exception to the package".

- **Refresh the lockfile's Node floor to match package.json**

  `1e66fc4` raised `engines.node` to >=22.18.0 when the package moved to ES
  modules, but the copy of that field the lockfile keeps in its root package
  entry still read >=18. `npm install` rewrites it, so a fresh install left
  the tree dirty; this commits what it writes.

  No dependency versions change.

- **Run CI once per commit by scoping the push trigger to main**

  `on: push` carried no branch filter, so every push to a branch with an open
  pull request started the full matrix twice: once for the `push` event and
  once for `pull_request` on the same commit.

  The `concurrency` group cannot collapse the pair. It keys on `github.ref`,
  which is `refs/heads/<branch>` for the push and `refs/pull/<n>/merge` for the
  pull request, so the two runs land in different groups and neither cancels
  the other.

  Scope `push` to `main` and leave `pull_request` to cover branches. Nothing
  loses coverage: pushes to `main` still run, pull requests still run, and tags
  reach the same workflow through `workflow_call` from release.yml, which
  triggers on `v*`. The one behaviour that goes away is CI on a branch that has
  no pull request open yet.

- **Sync the lockfile's engines with the Node floor package.json raised**

  `1e66fc4` moved the package to ES modules and raised `engines.node` to
  >=22.18.0, but the mirrored `engines` block npm keeps for the root package in
  `package-lock.json` still said >=18. `npm install` rewrites it on the first
  run in a fresh checkout, so the stale line was one dirty working tree per
  container and nothing else.

  No dependency, version or integrity hash moves: the diff is the one line.

- **Sync the lockfile's Node floor with package.json**

  Raising the engine floor to >=22.18.0 in package.json left the root
  package entry in package-lock.json still claiming >=18. `npm install`
  rewrites it; commit the result so a clean checkout does not show a dirty
  lockfile.

- **Close R1's builtin and flag parity, and build the gate that measures it**

  WP19 R1 asks that no program and no flag be stage0's alone, and that a
  `--parity` mode prove it. Three pieces:

  **`getenv(name: string): string | null`** (§4's remaining builtin), in
  both compilers. `amrit_getenv` copies the value out of `environ` into the
  arena rather than handing back libc's pointer, which a later `setenv` may
  move; the declaration is `noalias` because every call answers a fresh
  string, and `readnone` on neither side because it allocates and the
  environment is not memory LLVM tracks. `null` and `""` are different
  answers on purpose: an unset `CC` means "use the default", a `CC=` means
  someone set it to nothing, and a driver acts on the difference. It is a
  call and not `process.env.CC` because member access on a runtime key is
  what Phase 0 forbids.

  Testing it needed a harness capability the suite did not have: a
  `<name>.env` sidecar, read by `tests/run.js` and by
  `tests/differential/lib.js` so both sides of a differential run see one
  environment. A case cannot pin its own answer — the language has no
  `setenv` — and a golden that read the developer's environment would not
  be a golden.

  **`--emit-ast` in stage1**, the one §2A row that was a deliverable rather
  than a lowering. The printer moves to `self/ast_text.ts`, shared by
  `self/compile.ts` and `self/dump_ast.ts`, which is the arrangement
  `self/dump.ts` already had for `--emit-checked`: the flag and the parser
  oracle print through one function and cannot drift. What the two
  compilers print still differs by design — stage0 the `typescript`
  package's node names and line:col spans, stage1 the flattened vocabulary
  of `self/nodes.ts` with byte offsets — so there is a golden per compiler
  rather than an oracle between them. `dump_ast.ts`'s own output is
  unchanged to the byte.

  **`node tests/run.js --parity`** (`tests/self/parity.js`): the corpus
  through both compilers across the fourteen flag variations the suite
  itself uses, comparing exit status, stdout, stderr's `error:` lines and
  every file written. A difference is a failure unless declared with a
  reason, and a declaration must earn itself by normalising away exactly
  the bytes allowed to differ, so it cannot swallow the next real
  divergence on the same surface.

  Building it found a fifth §2A row nobody had counted: stage0 runs the
  attribute pass before `--emit-checked` and prints `facts:`, `calls:` and
  `stackSites=`; stage1 dumps after `check()` and prints none of them.
  `checked_oracle.js` filters exactly those lines away, by design, because
  it compares the checker. It is recorded as open in §2A rather than
  declared away, so G1 is not yet green.

- **Refuse a contextual type for unwrapOr's fallback in stage1**

  `--parity`'s first full run found the two compilers disagreeing about a
  program: `tests/cases/res_unwrap.ts` under `--number-mode f64` is refused
  by stage0 and compiled by stage1.

  `self/result.ts`'s `checkUnwrapOr` threaded the success type down as the
  argument's contextual type, so the bare `-1` in `r.unwrapOr(-1)` on a
  `Result<i32, string>` typed as `i32`. stage0 checks that argument with no
  contextual type at all, so the literal takes the mode's default, `f64`,
  and does not match. `docs/LANGUAGE.md` is normative and its
  contextual-literal table is an enumerated list of positions that this is
  not one of, so stage1 was the side in the wrong; the hint is dropped.

  Nothing had ever compiled that program in f64 mode through both
  compilers. Every oracle uses the flags a program already carries and
  `res_unwrap.ts` carries none, which is the hole the cross product exists
  to cover. `reject_res_unwrap_or_f64` pins the refusal on both sides.

  Also replaces the check that asserted `--emit-ast` is refused by name,
  which the previous commit made false, with the property it was really
  pinning: a flag the compiler does not know is refused rather than
  quietly dropped, on both compilers.

- **Key parity declarations on effective flags, and report progress**

  Two things the first full `--parity` run showed about the driver itself.

  **A declaration was keyed on the variation's name**, so a program whose
  own `.args` already ask for a dump — `tests/cases/dump_ast.ts` and the two
  `dump_checked` cases — was dumping under every variation and had its one
  known difference reported as undeclared eleven times over. Thirty-three of
  the run's 228 undeclared rows were that, and none of them was a fact about
  the compilers. Declarations now match on the flags the run effectively
  carried, which is what "this difference is decided" was always about.

  **A full run is minutes and said nothing until the end.** `self/`'s
  modules are whole programs and every one is compiled under every
  variation, so the corpus is far more work than its file count suggests.
  It now writes a counter to stderr — stderr so that piping the table
  somewhere does not collect the progress with it, and only to a terminal,
  so a CI log is not a thousand lines of counter.

- **Write down what the parity gate found on its first run**

  2,408 runs over `tests/cases`, 206 undeclared differences, five root
  causes. The numbers are the argument for the gate, so §A2 records them
  rather than leaving them in a terminal:

    - `Ok(...)`'s payload and an object literal's field take a contextual
      type in stage1 where stage0 gives none, so three `res_*` programs
      compile in f64 mode that stage0 refuses. Same shape as the `unwrapOr`
      fix, at two more sites;
    - a fixed-length stack array is sized by parsing an IR operand, which
      in f64 mode is a register rather than digits. stage0 writes
      `alloca [NaN x float]` and exits 0 — IR `llvm-as` refuses — and
      stage1 writes `alloca [0 x float]`, which assembles and then stores
      two floats past the slot. Both wrong, and stage1's builds and runs,
      which is worse. It predates this package;
    - the two compilers report a different *first* diagnostic for
      `cf_switch_break` in f64 mode, and stage1 drops the `/=` spelling
      from a compound-operator message.

  None of it was reachable by an oracle: every oracle compiles a program
  with the flags that program already carries, and not one of these
  programs carries the flag that exposes it. A cross product over flags the
  suite already uses found a miscompile that eleven oracles and 1,161
  checks had not.

- **Close the flag half of WP19 G1, and give it a check that can fail**

  R1 asks that no program and no flag be stage0's alone, and G1 asks for a
  check that says so rather than a belief. Neither existed, and the reason
  the gaps had survived is that nothing in the tree asks a compiler what
  flags it has: every oracle in `tests/self/` runs the corpus through both
  compilers with each program's own flags, so a flag one side had and the
  other did not was invisible to all of them.

  Two were. `--no-warn-performance` was stage0's, and worse than the flag:
  stage1 had the whole of WP15 §8 — the analysis in `self/checker.ts`, the
  second list in the sink, the report in `self/diagnostics.ts` — and its
  driver never printed any of it, so `build/amritc` compiled a quadratic
  string loop in silence where `amritc` named it. The driver reports them
  now on stage0's streams (stderr capped at 20, JSON objects on stdout
  under `--json`, exit code untouched) and takes the flag that silences
  them. `--out-dir` ran the other way: stage1's own spelling for `-o
  <dir>/`, which stage0 has never had, kept because three oracles passed
  it. They pass `-o <dir>/` to both compilers now and the flag is gone,
  which is the parity the gate wants without the frozen compiler growing
  anything.

  `tests/self/parity.js` is G1's check. It reads the flag set out of each
  compiler's `--help`, diffs the two, then runs a matrix of every no-value
  flag and every value a valued flag takes across six programs — each with
  the flags the suite compiles it with — requiring the same exit code, the
  same stdout, the same stderr and the same IR. A difference fails the run
  unless the file names it with a reason; `--emit-ast` is the one that
  does. 24 stage0 flags, 23 stage1 flags, 100 flag/program pairs agreeing,
  0 differences.

  Both usage texts name the same six spellings now. `-o`/`--output`,
  `-v`/`--version` and `-h`/`--help` were always both accepted by both
  compilers and each side documented a different subset; since the check
  reads `--help`, what a compiler documents is what it is held to.

  The stale skips go with it. A skip prints only under `--verbose`, so a
  corpus file whose `.args` names a flag an oracle's `SHARED_FLAGS` does
  not list leaves the comparison without failing anything: `--wrapping`
  and `--no-strict-exports` had been stage1's since §7a and were never
  added, so the cases the WP15 overflow flip brought went straight into
  the skip count. The IR oracle was at seven skips and is back to the one
  documented file, comparing 318 programs where it compared 312.
  `checked_oracle.js` passed only `--number-mode`, which stopped being the
  only flag the checker reads when constant folding learned `--wrapping`;
  it passes both now and compares 308 whole programs.

  That last one uncovered a real bug. `self/dump_checked.ts` took any
  argument it did not recognise as the file name, so `--wrapping` became
  the path, the real path overwrote it, and the dump came out with the
  flag dropped — stage1 then rejected a fold stage0 accepted. It takes
  `--wrapping`, and refuses an unknown flag rather than turning it into a
  file name.

  One thing the check found and cannot fix is recorded as an open R1 row
  in wp19 §2A rather than exempted: on a program refused in a mode it was
  not written for, the two compilers report different *sets* of errors —
  stage0 poisons the declaration and cascades, stage1 recovers and reaches
  three further real errors. Every individual message agrees and both exit
  1; it is the recovery that differs, and the reject oracle compares each
  case against its own fragments rather than against stage0's list, so
  nothing here was going to see it.

  Docs carry the numbers they had drifted from: the oracle counts in
  selfhost.md and wp19 §2B, and the 53 modules and 6,559,260 bytes of IR
  the diverse-double-compiling equality holds over.

  1158 passed, 0 failed, 1 skipped (the WASI sysroot, environmental).

- **Write down the plan for true multithreading**

  The question "how does AmritScript do threads, like Go or Rust" has an
  answer the project's existing decisions force rather than leave open, so
  this records it as a design note before any code moves.

  1:1 OS threads with data races rejected at compile time, not goroutines.
  Green threads need a relocatable stack and that needs a precise GC, which
  is the budget WP6 already spent: an allocation site that does not outlive
  its function becomes an entry-block alloca, and a site in a loop reuses
  one slot, both on the argument that nothing outside the frame can name
  the object. Relocating the frame is what that argument does not survive.
  Separately, Go's posture -- a race is a bug a runtime detector finds --
  is unavailable to a compiler whose readnone/readonly/pointer-parameter
  attributes come from a fixpoint that assumes a single mutator, since a
  false attribute there is silent miscompilation, not a race report.

  The note prices the assets and the blocker. The assets are accidents of
  other decisions: no mutable global state exists in the language at all
  (top-level `let`, static fields and top-level statements are each
  rejected, and a module const emits no symbol), there are no closures so a
  thread entry can only be a named top-level function, and escape.ts plus
  the whole-program fixpoint already compute the shape of judgment a Send
  rule needs -- which is why the design reaches for a shareable-type rule
  instead of a trait system. The blocker is that the arena is one global
  and its bump is inlined into the emitted IR, a non-atomic load/add/store
  on @amrit_arena at every allocation site, so two threads allocating race
  in the IR rather than only in runtime.c.

  Five stages follow. T0, a thread-local arena and RNG behind --threads,
  has no language surface, is a prerequisite for every version of the
  design including the detached-thread ones the note defers, and is gated
  on BENCHMARKS.md rather than on argument. T3 waits for monomorphisation
  (WP15 item 8). Detached threads, wasm threads, atomics and a race
  detector are named as out of scope, with the reason for each.

  Nothing in the compiler changed.

- **Tell LLVM an array's header is not its elements**

  An array value is a `%struct.amrit_array*` to `{ i64 len, i64 cap, i8* data }`
  and `data` points somewhere else, but nothing in the IR said the two regions
  are disjoint. So LLVM had to assume `a[i] = v` might land on some array's
  `len` or `data`, and the consequence was not a missed peephole: the header was
  reloaded on *every iteration* of every loop that writes an element, because
  LICM may not hoist a load a store might clobber, and the vectoriser gave up
  behind it.

  Every load and store of a header field now carries `!alias.scope`/`!noalias`
  naming a "header" scope, and every load and store of element data the matching
  "elements" scope. On `dst[i] = src[i] * 2.0` over 8192 doubles, `--profile
  speed`, min of 7: 1227 ms -> 762 ms, a 1.61x with no language change, no flag
  and nothing observable altered.

  The proof is about bytes rather than allocations, which is what makes it hold
  for every shape at once: a header's three fields and the `cap * sizeof(T)` of
  element storage never overlap, whether they are two arena bumps, two
  entry-block allocas, the two bumps `amrit_alloc_array` makes for a host, or
  `amrit_argv_init`'s single malloc block whose elements begin after the header.
  The wasm runtime bumps the same way. Strings are deliberately left out — one
  block, length and bytes contiguous, no split to describe — and so are struct
  fields, for want of a measurement: annotating nbody's array headers moved it
  by nothing.

  Measuring this also corrected an attribution that wp9 had half-right. With the
  header hoisted, `--unchecked-indexing` on the same loop is worth 0.5%. The
  bounds checks were never what those loops paid for; they only looked expensive
  because the `len` they compare against was reloaded with everything else. That
  re-orders WP15's own sequencing, so §2b records it and §2c writes down what
  closing the remaining 2x needs (an invariant header, which wants either
  fixed-length array types or a whole-program "no push reaches this loop"
  analysis — `readonly T[]` is not enough, since another alias may still push).

  stage1 mirrors it and interns the five metadata nodes in stage0's order, so
  the bootstrap still reaches its fixed point byte for byte.

  `tests/cases/arr_alias_domains` pins the property a golden cannot express:
  after `opt -O2` no header load survives inside the loop. The check is on the
  loads rather than the GEPs, which hoist on their own — a first version that
  looked for the GEPs passed with the change stubbed out.

  1161 passed, 0 failed. 39 goldens grew the metadata; `--plain` emits none.

- **Fix the arena layout on wasm32: uint64_t, not size_t**

  `struct amrit_arena` spelled `off` and `cap` as `size_t`, which is the IR's
  `%struct.amrit_arena = type { i8*, i64, i64, i8* }` only where a pointer is
  eight bytes. Under wasm32 the C struct was 16 bytes with those fields at 4 and
  8, while the bump allocator every compiled function inlines (`inlineAllocator`
  in src/codegen/runtime.ts) bumped byte 8 and compared byte 16 — past the end of
  a global that was not that long.

  A program that allocates only strings survived, because runtime.c allocates
  those itself through its own consistent view of the struct. Anything that built
  an object or an array in compiled code got a pointer from nowhere, so the wasi
  profile trapped on the first `new` in a loop. The freestanding wasm profile was
  never affected: runtime_wasm.c had the rule right and wrote down why.

  runtime.c and amritc.h now use uint64_t for the same reason, and all three
  static-assert the offsets wherever they are compiled. `amrit_arena_grow` and
  `amrit_alloc_struct` take uint64_t too: their `size_t` parameter disagreed with
  the `i64` the IR passes on the same target, and the growth path now refuses a
  chunk larger than the host's `size_t` instead of asking malloc for its low half.

  The alloc-smoke check links for the host, so it could only ever prove the
  64-bit layout. tests/run.js compiles the header's layout assertions for the host
  and for wasm32 as well, with -fsyntax-only: no sysroot, no linker, so the guard
  runs wherever clang does.

- **Add web/: the compiler in a browser worker**

  self/ is an AmritScript program, so the compiler compiles itself to wasm like
  any other one: `--profile wasi` links it into a single 480 KB module (140 KB
  gzipped) that lexes, checks and emits LLVM IR with no server involved. web/ is
  what drives that module.

    wasi.mjs     A WASI preview1 host over an in-memory filesystem, with no
                 imports at all, so the same file runs in a page and under Node.
                 It answers the thirteen syscalls a wasi-libc build of runtime/
                 actually makes and ENOSYS for everything else, rather than
                 pretending: a compiler that silently read an empty file would be
                 worse than one that stops.
    worker.mjs   One compile per message, each in a fresh instance. The arena only
                 grows and proc_exit ends the instance that ran it, so the module
                 is compiled once and instantiated per request; a trap comes back
                 as exit 70 rather than as a dead worker.
    compile.mjs  A Node driver over node:worker_threads, so the browser path is
                 exercisable — and testable — without a browser.
    index.html   A playground: source on the left, IR or diagnostics on the right.

  tests/run.js builds the module and checks that the IR it emits for
  examples/add.ts is stage0's, byte for byte. It lives in the block that already
  skips when there is no WASI sysroot, and it doubles as the end-to-end guard on
  the arena ABI: the compiler allocates from compiled code on every node it
  parses, so a wasm32 layout that disagrees with the IR traps there before it
  prints anything.

  It stops at the IR by design. amritc emits textual LLVM IR and hands the rest to
  clang and wasm-ld, neither of which exists in a page, so --link and --profile
  report the toolchain failure WASI's spawnSync answers with, and --target host is
  refused because process.platform is `unknown` there.

- **Compute a double's shortest digits instead of searching for them**

  `String(x)` prints the fewest digits that read back as the same double, and
  the language promises that spelling. `amrit_str_from_f64` looked for the
  length by asking snprintf for k digits and strtod whether they round-trip,
  walking k up from 1. Two things were wrong with that.

  It was slow: up to seventeen format-and-parse round trips, 2,557 ns per
  number against 15 ns for the same value as an integer.

  It was also *wrong*, for about one value in twenty thousand. snprintf can
  only hand back the correctly-rounded k-digit string, and the shortest string
  that round-trips at length k need not be that one; when it was not, the
  search rejected k and moved on to k+1. So we printed
  7.1202363472230444e-307 where Node prints 7.120236347223045e-307 — and
  runtime/shim.mjs, which delegates to JavaScript's own String, disagreed with
  the native runtime it exists to twin.

  Ryu (Adams, PLDI 2018) computes the digits directly: 72 ns, a 35x speedup,
  and the shortest string by construction. Only digit generation moved; the
  ECMAScript layout around it — where the point goes, when to use e-form — is
  untouched, which kept the change to one function and its tables.

  Validated against the ECMAScript rule itself rather than against the code it
  replaces, which was just as well since that code was the buggy one: the
  digits round-trip, no shorter string round-trips, and no same-length string
  is closer. 20.9 million values — every finite exponent with boundary and
  random mantissas, the powers of ten and two, small integers and their
  reciprocals, uniform random bit patterns. Zero violations; the same harness
  finds 46 per 1.4 million in the old implementation.

  This costs binary size, and the size lands only on programs that use it.
  The two power-of-five tables are 9,888 bytes of read-only data, derived by
  scripts/gen-pow5-tables.py with exact integer arithmetic rather than
  transcribed, so they can be checked rather than trusted. runtime.c's .text
  goes 2,775 -> 3,852, still inside the 4 KB budget; its .rodata goes 32 ->
  9,920. Section GC keeps the tables out of any binary that never formats a
  double: bench/fib is unchanged at 5,600 bytes, bench/nbody goes 10,856 ->
  21,168. That is the largest size regression taken deliberately here, so
  wp15 section 7a records it and names the smaller-table variant that would
  trade a third of the speed back.

  One thing measuring this turned up on the side: scripts/size-report.sh
  reported the `text` column of `size`, which counts .rodata and the .eh_frame
  entries the size profile strips, while MASTER_PLAN section 2 defines the
  budget as the .text *section*. That row read 4,696 against a 4,096 budget
  while the section it names was at 2,775. It now reports .text against the
  budget and .rodata on a row of its own.

  1164 passed, 0 failed.

- **Add `getenv`: the environment, as a call**

  The last builtin the retirement gates named (wp19 §4), and the only shape
  the language has for the job. `process.platform`, `process.arch` and
  `process.argv` are member reads on a name fixed at compile time; an
  environment lookup is by a key that is a *value*, and member access on a
  dynamic key is exactly what Phase 0 refuses — nor is there an object type
  with arbitrary properties for `process.env` to be. So it is a function,
  named after C's rather than after Node's, because Node's spelling is the
  one that cannot exist here.

      getenv(name: string): string | null

  `string | null`, and a variable set to nothing (`FOO=`) is `""` and not
  `null`. That distinction is the whole reason the result is nullable
  rather than a string that happens to be empty when absent: `CC=` means
  something different from `CC` unset, and a driver is exactly the caller
  that has to tell them apart. The value is narrowed like any other
  nullable, so a program cannot read it without first saying what an unset
  variable means.

  The bytes are copied into the arena rather than borrowed from the
  environment, because a string here carries a length header the
  environment's does not, and because a later `setenv` from linked C may
  free what a previous `getenv` answered. That same possibility is why the
  declaration is not `readonly`: two reads of one variable in a function
  stay two calls. `noalias` (freshly allocated) but not `nonnull` (it may
  be unset), which is `amrit_read_file_or_null`'s shape.

  42 bytes of `.text` at -Oz, against the 4,096 budget. Deliberately not
  beside it: `setenv`. Reading the environment a process was given is a
  question with one answer; writing it mutates state shared with every
  library linked into the program, and nothing in the compiler needs it.

  What it closes is the *language* side of two gates rather than the
  gates. The `CC` pre-flight probe is a stage1 driver change and is still
  open. `AMRITC_DEBUG` turns out not to be closable by this builtin at
  all: a stack trace is the only thing that variable turns on, and a
  compiler with no exceptions has none to print whether it is set or not,
  so `self/ice.ts` says that once rather than branching to print two
  versions of the same "nothing here". Its note records that as a decision
  now instead of a limit.

  Two things came with it, both because a check refused to pass.

  `<name>.env` in the golden harness, beside `<name>.argv`: one entry per
  line, `KEY=value` to set (the value may be empty) and a bare `KEY` to
  unset, applied to the native run. A case that reads the environment
  cannot otherwise have a `.out` — the unset case is only reliable if the
  harness unsets it, and the empty case only exists if the harness sets
  it.

  And the argument-type message got words of its own. The suite pins how
  many distinct rejection messages carry no stable code, as a ratchet that
  may shrink and not grow, and a new builtin's argument-type message is a
  new distinct message: adding `getenv` pushed it from 8 to 9. The
  registry derives a code from the longest literal run between a message's
  interpolations, and `` `${name}` expects ${want}, got ${got} `` has none
  long enough to name a rule — that one template was eight of the nine.
  The check's own comment says the fix is to give the message words rather
  than to edit the table, so it reads `expects an argument of type string,
  got i32` now, which covers `readFileSync`, `mkdirSync`,
  `isDirectorySync`, `spawnSync`, `getenv`, `indexOf`, `f64ToBits`,
  `bitsToF64` and `Arena.release` at once. Coverage 230/239 (96.2%) ->
  238/239 (99.6%), the pin is now 1, the registry gained one rule
  (AS2268), and no existing number moved. The one still uncoded is
  `` Unknown base class `X` (...) ``, whose leading run is shorter than the
  parenthetical that states the rule.

  `io_getenv` is the round trip, `reject_getenv_arity`,
  `reject_getenv_type` and `reject_getenv_unchecked` the negatives,
  `builtin_getenv` the cookbook entry, and `runtime/shim.mjs` has it so
  WP13 runs the same program under Node — which it does, byte for byte.

  1164 passed, 0 failed, 1 skipped (the WASI sysroot, environmental).

- **Give a non-exported function a private ABI for a small Result**

  A `Result` with two small scalar payloads has travelled in one `i64` since
  WP17, because that is what a C or wasm host has to see. Between two functions
  of one module nobody is looking, and the word costs something real there:
  with the discriminant and the payload in a single register, the `select` that
  picks the live arm happens on the word, and instcombine can no longer fold
  the arithmetic around it. wp17 section 4 diagnosed this and named the fix; this
  is that fix.

  A function that gets `internal` linkage now takes and answers `{ i1, i32 }` —
  rustc's `ScalarPair`. `bench/result` goes from 650 ms to 464 ms against C's
  444, so the 1.46x behind C in that note is now 1.04x.

  The change is much smaller than the note expected, because of one
  measurement. Building the word exactly as before and splitting it at the call
  boundary measures 464 ms; a hand-written two-scalar lowering of the same
  program measures 467 ms. LLVM folds the round trip away entirely, so
  `packArm`, `packObject` and `unpackResult` stay as they are and this is a
  predicate plus a boundary conversion rather than a rewrite of the packing
  path. One packing path is worth more than the instructions the conversion
  appears to cost.

  The condition is the linkage condition — `strictExports && !exported`, the
  same test that writes `internal` — because the private shape is safe only
  while no host can name the symbol. The two must not drift, and the comment at
  each site says so. `--no-strict-exports` turns both off together. An imported
  function is exported by definition, so a cross-module call is always packed
  and two modules agree without consulting each other; `--emit-header`,
  `--emit-dts` and `--emit-napi` describe exported functions only, and
  `tests/cases/res_export` still emits `i64` for all four of its shapes.

  `dbg_result` moved too, and in the right direction: a `dbg.value` operand has
  to carry the parameter's actual type, so it now names the pair, while the
  `DILocalVariable` still describes the source-level `Result`.

  1164 passed, 0 failed; the bootstrap still reaches its fixed point, so stage1
  emits the new ABI byte for byte with stage0.

- **Search a string in the runtime instead of a probe per offset**

  `s.indexOf(sub)` was a loop over `amrit_str_at`, one probe per byte offset,
  emitted at every call site so that `runtime.c` stayed inside its size budget.
  That made the idiomatic string search a byte-at-a-time scan: 53.7 ms over 52 MB
  of haystack. WP15 section 7's rule is that the budget yields to a measured win,
  and this is one — `amrit_str_index_of` uses `memchr` to find a candidate first
  byte and `memcmp` to confirm it, both the libc's vectorised routines, for
  2.9 ms, or 3.1 ms when the needle starts with a byte the haystack is full of.
  About 17x either way.

  It also *shrinks* the caller: thirty lines of loop become one call. The
  runtime's `.text` goes from 3,852 to 4,002 bytes against the 4 KB budget of
  MASTER_PLAN section 2, which is inside it but with little left.

  `memmem` would be 2.5 ms and was written, then taken out. It is a GNU
  extension glibc hides behind `_GNU_SOURCE`, and defining that macro makes
  `<string.h>` include `<strings.h>` — which any `-I` directory holding a file
  of that name then shadows. This project generates exactly such a header from
  `examples/strings.ts`, and the interop tests caught it at once: runtime.c
  picked up the generated `strings.h`, inherited `amritc.h` through it, and
  failed with four redefinitions. A C host pointing `-I` at its own generated
  headers would hit the same. A fifth of the time is not worth making the
  runtime sensitive to its includer's include path, so there is one path and no
  second one to rot.

  The semantics are the loop's: an empty needle answers 0, a needle longer than
  the haystack -1, and the offset is in bytes. Eleven cases in runtime_test.c
  pin those edges, the repeated-first-byte shape the scan walks, and a UTF-8
  offset.

  Also regenerates docs/BENCHMARKS.md for the three changes that came before it.
  Read it within a row, not against the committed table: this machine ran faster
  throughout (C's fib 369 -> 330), so only the columns beside each other are
  comparable. `result` is 464 against C's 444, where it was 1.46x behind; the
  binary-size column shows the Ryu tables landing only on the three benchmarks
  that print a double, with fib, sieve, strbuild and result unchanged.

  And it corrects wp9's arena-provenance note. That section reports nbody -6%
  from making the allocator `noinline` so its `noalias` return survives. On
  today's compiler the same edit measures 1467 ms against 1479 — noise, and
  slightly the wrong way. WP6's stack allocation took the objects it was
  recovering and vec3 now beats C without it, so the trade buys nothing and is
  not being made. nbody's remaining gap is unexplained by any theory in either
  note, which is now what they say.

  1164 passed, 0 failed.

- **Add a Go column to the benchmark suite**

  The suite compared AmritScript against C and Rust; there was no Go twin of
  any program, so "how do we do against Go" had no answer to give. Add one
  `.go` per benchmark and a Go column to the runner, under the rules the other
  twins already follow.

  The Go versions are transliterations, not idiomatic rewrites: the same loops,
  the same temporaries, the same left-to-right evaluation. Slice indexing keeps
  its bounds checks (no `-gcflags=-B`), objects are heap allocated (`&T{...}`)
  as they are in C, Rust and the AmritScript arena, and the collector runs at
  its default GOGC. `go build` has one optimisation level, so Go gets one
  column rather than the plain/native pair Rust gets.

  Two places where Go needed care to print the same checksum:

  - Untyped Go constants fold in arbitrary precision and round once, where C,
    Rust and AmritScript round every step to f64. In nbody that put SOLAR_MASS
    one ULP out and moved the final energy of a chaotic system in the eleventh
    digit, inside the runner's 1e-9 tolerance but not the bit-for-bit agreement
    the suite is built on. nbody.go spells those constants as typed variables.
  - Go has no Result type, so result.go uses the same two-word struct as
    result.c -- the one --emit-header declares for Result<number, number> --
    which Go's register ABI passes and returns in registers, as Go's own
    (value, ok) pair of results would be.

  The runner gains --no-go, a GO override and the /usr/local/go/bin lookup,
  an `AmritScript / Go` ratio column beside the Rust one, and Go rows in the
  size and memory tables. The --help banner now ends at the first non-comment
  line instead of a hardcoded line count, which had to be edited by hand
  whenever an option was added and was wrong the first time here.

- **Regenerate the benchmark report with the Go column**

  Records the Go rows in the wall-time, size and memory tables, and the
  CHANGELOG line for the column. The run is on a 2.10 GHz Xeon, not the
  2.80 GHz machine the previous report was measured on, so only the ratios
  within this run compare to the ones within that one.

- **Record the clean benchmark run, and what the machine's noise hides**

  The previous report was timed while this session was running git commands
  against the same container, and its ratios are not reproducible: a second
  back-to-back run of the same binaries moves fib from 1.01x to 0.83x against
  Rust, nbody from 1.24x to 1.03x, spectral from 1.09x to 0.86x and vec3 from
  0.94x to 1.10x. Replace it with a run that had the machine to itself.

  The wider point belongs in the WP9 note rather than in a regenerated table,
  so record it there: on a shared virtual machine this suite resolves a gap the
  size of result's and does not resolve the difference between 0.95x and 1.15x.
  Three rows held across both runs -- sieve about 0.82x, strbuild about 0.96x,
  and result about 2.8x -- and nbody's 1.24x "miss" was noise.

  Also note what the Go column says: AmritScript is ahead of Go on six of the
  seven programs and behind on result alone, which is the same program the Rust
  column singles out.

- **Close WP19 §A2's parity differences, and the dump behind 193 of them**

  `--parity`'s first run found five ways the two compilers disagree about a
  program; four were open. All five are closed here, along with three more
  of the same family that fixing them turned up, and the `--emit-checked`
  row that accounts for 193 of the 206 reported differences.

  The miscompile first. A fixed-length stack array types its slot
  `[n x T]`, and both emitters got `n` by parsing back the IR operand they
  had just emitted for the length. Under `--number-mode f64` that operand
  is a register, because the literal has been through a conversion: stage0
  parsed it to NaN and wrote `alloca [NaN x float]`, IR that `llvm-as`
  refuses from a compile that exited 0, and stage1 parsed it to 0 and
  wrote `alloca [0 x float]`, which assembles and then stores two floats
  past a zero-element slot. Both now read the length from the literal,
  through the one `literalLength` the escape analysis already used to
  decide the site was stackable, so the two answers cannot differ; a stack
  site whose length is not a literal is an internal error rather than a
  silent zero. It lives in `emit/arrays.ts` on both sides because
  `escape.ts` already imports that module, and the reverse import closes
  an ESM cycle that surfaces as a dispatch table read before its
  initializer.

  Then five refusals stage1 did not make. They are one design difference
  seen from five directions: stage0 decides a contextual type by walking
  up from the literal through three functions with enumerated positions,
  and stage1 threads a single `want` down, because AmritScript-0 has no
  parent pointers. One channel where stage0 has three is more permissive
  by construction, and every difference is stage1 handing `want` to a
  position stage0's walk does not name — a `Result` payload, an object
  literal's property value (for a numeric literal or `[]`, never for a
  nested literal or a `null`), and a binary operator's operands. Two of
  them, `{ b: 255 }` for a `u8` field and `const b: u8 = 1 + 2`, compiled
  in the default mode with no flag involved. A compound arithmetic
  assignment was routed through the binary operator's rule as well, which
  lost the `=` from the message and let `s += "b"` through; stage0 has one
  numeric-only rule for the construct and stage1 has it now, for a local,
  a field and an element alike.

  `--emit-checked` prints the attribute pass's facts in stage1 too:
  `self/compilation.ts` grew stage0's memoised `analyze()` and
  `self/dump.ts` grew `factsText` in stage0's format, so
  `checked_oracle.js`'s `LATER_PHASES` filter is deleted and all 314
  programs agree over 297,074 dump lines with nothing filtered out. The
  new lines caught a regression on their first run: the compound
  assignment rewrite had stopped recording the target's type, which
  `collectDivisionFacts` reads to know that `x /= k` can reach
  `amrit_panic_div`, so stage1 called a trapping function `readnone` and
  `willreturn`. Wrong facts are wrong attributes, which is the class of
  bug a golden `.ll` is worst at catching.

  `Field \`code\` of \`IoError\` is i32, got f64` is now `... expects a
  value of type i32, got f64`: the message was assembled entirely out of
  interpolations and had no literal run for the code generator to key on,
  so the new cases would have grown the uncoded backlog instead of AS2269.

  Seven cases: `arr_stack_f64` pins the IR and runs it, and six
  `reject_*`s pin the refusals on both compilers.

- **Write down what --parity says over the corpus it defaults to**

  The previous commit closed §A2's rows and left one sentence standing:
  that what remains for R1 is running `--parity` to an empty difference
  set. Running it says otherwise, and the number is worth having written
  down before someone plans around the old one.

  §A2 measured `tests/cases` — 172 programs, 2,408 runs. The mode's own
  default is the whole corpus `tests/self/corpus.js` enumerates: 593
  programs, 8,302 runs, and 13,800 undeclared differences with everything
  in §A2 fixed. §A3 breaks that into five classes with counts. None is a
  wrong-code bug. Three are decided rather than broken and want a
  declaration — a path inside the IR (12,209 rows: the declaration
  `--emit-checked`'s header already carries, at `ModuleID` and `DIFile`
  too), a parser refusal that beats Phase 0 to the rule (602, by design and
  counted apart by `reject_oracle.js`), and one wording where stage1's
  message is the better of the two. Two want code: `--emit-ast` exits 0 on
  a program Phase 0 refuses because stage1 dumps without validating, and
  error recovery, which is the structural one — stage0 throws out of a
  construct and stage1 threads an error value and carries on.

  That last class is also what §A2's "the first diagnostic differs" row
  really was. The first diagnostic is the same on both sides and always
  was; stage1 reports one more after it. Reading only line 1 is what made
  that row look closed in the previous commit, and the row is corrected
  rather than deleted, because how it was misread is the useful part.

  The oracles cannot see any of this: they hand both compilers the same
  relative path and the flags each program already carries.

- **Close three of A3's five classes: paths in the IR, --emit-ast, unary `+`**

  **A path inside the IR (12,209 of the 13,800 rows).** An imported module
  carried a cwd-relative name in stage0 and the absolute path it was
  resolved to in stage1, so `ModuleID`, `source_filename` and `-g`'s
  `DIFile` disagreed on every multi-module program compiled by absolute
  path — which is how a build system compiles one.

  stage0 now names an imported module the way stage1 always has: the
  specifier resolved against **the name the importer was given**
  (`importedName`), not against `process.cwd()`. Named relatively, as
  every caller in this repository names it, the answer is unchanged and no
  golden moves. Named absolutely, the two compilers now write the same
  bytes: the whole of `self/` compiles to byte-identical IR through either
  compiler, by either spelling of the entry path.

  The rule that needed no cwd was also the only one available. stage1 has
  no working directory by design (WP14 §3a D4) and cannot grow one for
  this: `runtime.c` is 4,088 bytes of `.text` against a 4,096 budget, eight
  bytes of headroom, and `getcwd` does not fit in eight bytes. Removing the
  dependence on where the compiler was run from is the better rule anyway
  — it is what makes the IR reproducible — so this is parity bought by
  improving the frozen compiler rather than by declaring a difference away.
  `tests/run.js` pins it on `link/diamond` compiled by absolute path,
  because a golden cannot: goldens strip the module header.

  **`--emit-ast` on a program Phase 0 refuses (40 rows).** stage0 validates
  before it dumps, prints the refusal and exits 1; stage1 dumped the tree
  it had parsed and exited 0, because `load` reports a Phase 0 refusal into
  the sink and answers true anyway. A dump flag does not turn a refused
  program into a compiling one. `tests/cases/dump_ast_reject`.

  **Unary `+` (13 rows).** Two messages for one refusal: stage0's said only
  that the operator was unsupported, stage1's said why — `+x` converts, and
  this language has no conversions. The better sentence wins and stage0
  takes it, as a `PlusToken` entry in the unary dispatch table rather than
  the table's fallback. `tests/cases/reject_unary_plus` pins it on both.

  Left: the parser refusing before Phase 0 names the rule (602), and error
  recovery after the first diagnostic (~950).

- **Write down the plan for packages**

  Two questions arrived together — what an extra `exports` condition beside
  `import` and `require` would look like, and how one AmritScript package
  should depend on another — and docs/wp21-packages.md separates them.

  A foreign host (JavaScript on Node, in a browser, or C) takes a built
  artifact across the ABI, which WP8 already generates. Another AmritScript
  program takes source, compiled into its own whole program, because a
  prebuilt library cannot carry the exporter's attribute set into the
  importer's `declare` (WP5), cannot hold a generic nobody has instantiated
  yet (WP18), and would have to exist once per number mode, target and
  profile. So an artifact is a cache for an AmritScript consumer, never a
  distribution format, and an `exports` map states one condition per kind of
  consumer.

  The blocker is the flat symbol namespace: two modules defining the same
  non-exported name is already an error, deliberately not waivable by the
  linkage flag, because the whole-program fact fixpoint is keyed by symbol
  name. Two packages with a private helper() each would not compile
  together. Package-scoped symbols are stage one of five.

  Nothing here is implemented; several sections are marked as sketches.

- **Say how a package declares itself AmritScript**

  The plan named a manifest and left it at "one key in package.json". WP21
  section 6 now answers it: the `amrit` export condition is the declaration —
  its presence is the claim, its value is the entry module, and its absence is
  what turns a bare import of an ordinary npm package into "no AmritScript
  entry point" rather than a module-not-found.

  A condition maps to a path, so three things sit beside it: the number mode,
  a compiler version floor in `engines.amritc`, and the runtime capabilities
  the package needs. The mode earns its place — an f64 package compiled in i32
  mode often fails loudly on a `1.5` literal, but `a / b` compiles under both
  modes and truncates under one.

  Those three are generated rather than declared: `--emit-manifest` reports
  what the checked program requires, as a fourth interop sidecar beside
  --emit-header, --emit-dts and --emit-napi, on the same rule that governs
  attributes. Nothing here is a trust boundary — the consumer's build
  re-establishes the property from source and the compiler is the verifier —
  so the manifest is there to make a failure arrive early and legibly, which
  is also why a compile error inside a dependency must not look like one in
  your own program.

- **Close A3's last two classes: error recovery, and the parser's refusals**

  **Error recovery (~950 rows).** Both compilers recover per statement —
  `checkStatements` wraps each one in a `try` in stage0 — but its `throw`
  abandons the rest of the statement it came from, and stage1 carried on
  through it. One bad type became a paragraph of consequences where stage0
  reported the cause: over a module written for i32 mode and compiled with
  `--number-mode f64`, twenty diagnostics and twenty different ones.

  `errored` in `self/context.ts` is that throw in a language with none. It
  is set by `error`, cleared at the start of each statement, and consulted
  where the unwind would have gone: `checkStatement` and `checkExpression`
  stop, and `error` itself drops later reports, which is what makes it
  complete — a check that reports without going through either of those,
  like the `switch` clause rules, would otherwise keep talking about a
  statement stage0 had left. A list *inside* a refused statement is not
  entered (a `switch` abandoned at its discriminant does not go on to
  refuse its `case` labels); a list that runs to the end clears the flag,
  so the `else` of an `if` whose `then` failed is still checked. And a
  rejected initializer leaves its variable undeclared unless the annotation
  says what it is, which is what makes `const at = m.get(k, -1)` report
  `Unknown identifier` at each later use on both sides.

  Measuring that turned up four more contextual-type divergences of the
  same family as the ones already fixed — stage1 handing its single `want`
  to a position stage0's walk does not name — and one message:

    - a method's argument, where the table says a *function* and a
      constructor (`reject_method_arg_literal`); `super`'s too;
    - `push` and `indexOf` through a field, where stage0 reaches the
      element type by a callee name `b.xs.push` does not have
      (`reject_push_field_literal`);
    - the other operand of a binary operator when it is not a shape stage0
      can peek at, so `0xc0 | (cp >> 6)` in f64 mode is an f64 meeting an
      i32 — `peekable` in `self/expressions.ts` is that list;
    - the caret on a nullable member access, which belongs under the
      property name;
    - and an unknown dotted call is now `` Unknown builtin `foo.bar`
      (supported: …) `` on both sides, naming the callee and listing what
      there is, rather than four shorter sentences and an
      `Unknown identifier` for the receiver.

  None of those was reported by anything: a compiler that reports every
  consequence of a mistake buries the ones that are its own.

  **The parser's refusals (602 rows), declared.** `var x = 1` stops at
  stage1's parser with `` expected `;` `` where stage0 parses it with the
  `typescript` package and refuses it in Phase 0 by name. That is the habit
  `.claude/selfhost.md` states — lex and parse what is written, refuse in
  the phase that owns the rule — and closing it in code means grammar for
  43 constructs the language forbids, which is a parser rewrite rather than
  a fix. The declaration is narrow: it applies only when stage1's first
  diagnostic is a syntax error *and* stage0 refuses the same file, it
  covers stderr alone, and exit status, stdout and every file written are
  still compared byte for byte. stage0 accepting a program stage1 refuses
  is a failure, not this. `parity.js` grew two things for it — a
  declaration with no flag, which applies to every invocation, and one
  asked about both texts together, because here the *shape* is what is
  decided rather than the bytes.

- **Put the number mode in the condition and drop the manifest**

  The previous section 6 answered "how does a package say it is AmritScript"
  with a generated sidecar. It was over-built: a fact the compiler can
  recompute is not metadata, and only the number mode has to be known before
  the compiler can look, because it selects which source file resolution
  returns.

  So the mode rides in the condition by spelling — `amrit-f64`, `amrit-i32`,
  or plain `amrit` for a package correct under either — and `--number-mode
  f64` asks for ["amrit-f64", "amrit"]. A mismatch becomes a resolution
  failure at the package boundary, before a byte of the dependency is
  checked, with no new file format to keep in sync.

  The mode earns the mechanism where the other candidates do not. Measured:
  `(a + b) / 2` answers 3 for mean(3, 4) in i32 mode and 3.5 in f64, cleanly
  under both, because `/` truncates. Most f64-flavoured code fails loudly
  instead — `Math.sqrt` on a `number` in i32 mode names the fix in its own
  message, a `1.5` literal is rejected — so the silent window is division and
  what is built on it. Narrow, not empty.

  Runtime capabilities need no declaration: the compiler knows the target and
  which builtins the whole program touches, so a builtin the target cannot run
  is a whole-program diagnostic. A version floor goes in `engines.amritc`.
  That leaves --emit-manifest with nothing to carry, and S3 is now messages
  rather than an artifact.

- **Align the diagnostics themselves: spans, wordings, and two stage0 bugs**

  Closing A3's five classes took the corpus from 13,800 undeclared
  differences to 503, and what was underneath was a long tail of
  diagnostics that say the same thing differently. None of it was
  reachable before: the parser and path classes were 94% of the rows and
  buried the rest.

  **Where the caret goes.** A diagnostic about a member access belongs on
  the property name, which is the node stage0 hands to the error, and
  stage1 was pointing at the whole access — one column early on `Unknown
  field`, `Unknown property`, `Unknown method`, `join`, and every `Result`
  read. `CheckContext.errorAtProperty` is that anchor; the member's name is
  `text` on the node here rather than a node of its own, so the span is the
  tail of the access. Four more had their own answers: `process.argv` is
  read-only points *through* the parentheses, `main` cannot take parameters
  points at the first parameter, a negative literal covers its sign, and
  the two import diagnostics point at the module specifier —
  `errorAtSpecifier` recovers that span from the source, because giving the
  specifier a node of its own would change the layout `nodes.ts`
  documents, the `--emit-ast` golden and the parser oracle's translation,
  all to move a caret.

  **What the words are.** Six messages differed in their tails, in both
  directions, and each was resolved on which one is better rather than on
  which compiler said it. stage1 gained the parentheticals it was missing
  (union types have one fixed layout, a condition has no truthiness to
  fall back on, `process.argv` needs an entry point, `bigint` names the
  types to use instead) and one sentence it had truncated. It kept its own
  where it was the better one, and **stage0 took two fixes**: `` a `Result`
  is immutable once built (return a new `ok(...)` or `err(...)`) `` named
  constructors that do not exist — they are `Ok` and `Err` — and the array
  `length` rule was unreachable dead code, because `rejectLengthAssignment`
  wraps the `=` handler that the class checker has already replaced, so the
  message `docs/LANGUAGE.md` documents had never once been printed.

  **Recovery outside a statement.** `errored` is cleared per statement, and
  pass 1 has no statements: a constant or a class is a recovery point of
  its own there, as `sink.recover` makes it in stage0. Two cycles now
  report once per constant and the fold unwinds without marking anything
  folded, which is what stage0's `catch` does deliberately ("let a second
  reference report the same error rather than a stale `folding`").

  **One difference is declared rather than fixed, and the reason is
  worth reading.** stage0 reports an inheritance cycle once per class
  because its throw leaves `collected = "collecting"` behind and the next
  class finds the stale marker. Reproducing that by hand — returning early
  with `collecting` still set — makes stage1 *loop*, since `resolveBase`
  collects the base recursively and the pair re-enter each other. A caret
  is not worth an infinite loop in the compiler.

  `--emit-ast`'s refusal is narrowed to Phase 0's own diagnostics, which is
  what the flag answers from: a pass 1 error is one stage0 never reached,
  and refusing on it made stage1 exit 1 where stage0 dumps.

- **Stop Phase 0 where stage0 stops, and declare the dump's parser refusal**

  **A Phase 0 refusal ends the compilation.** stage0's validator `fail`s
  by throwing out of `load`, so one `any` is one diagnostic and pass 1
  never runs. stage1 reported it into the sink and carried on, so the
  annotation resolver refused the same `any` a second time from the same
  column. `load` answers false for a module Phase 0 refused now, which is
  also what `--emit-ast` needed: the flag's own check goes away, because a
  validated module is the only kind that reaches it.

  **An unresolved annotation is not an annotation.** `const head: Entry =
  ...` where `Entry` does not resolve leaves the variable undeclared, so
  its later uses are `Unknown identifier` — stage0 declares one only from
  an annotation it actually has, and a `T_ERROR` is not one
  (`tests/link/reachable_struct_annotation`).

  **The parser's refusal, on the surfaces a dump flag reaches.** Under
  `--emit-ast` a program stage1's grammar cannot read has no tree to print,
  so it exits 1 and says why; stage0 parses it with the `typescript`
  package, which recovers, dumps a tree and exits 0 in silence. Same
  decided difference as the stderr declaration, so the same declaration
  covers it — narrowly: the exit half only when stage1's own first
  diagnostic is that syntax error and only in the 0-to-1 direction, and the
  stderr half only when the flags say a dump is what was asked for.
  `parity.js` hands a declaration the whole run for it, because a
  difference on one surface can be decided by what happened on another.

- **Measure what the number mode costs, and use a real program in WP21**

  The FAQ has claimed `i32` is "one machine word, exact, vectorisable" since
  WP11 with no number beside it. wp9-optimisation.md now has them, measured
  the way bench/run.mjs measures — 3 warm-up, 15 timed, min and median, speed
  profile — with the commands spelled out, because bench/run.mjs has no mode
  axis and this is a one-off rather than a generated table.

  Recompiling the same program under --number-mode f64 costs 1.36x on fib,
  1.80x on sieve, 1.52x on strbuild and 3.42x on an array reduction, rising to
  14.3x when the array is cache-resident, so the gap is not memory traffic.
  Three mechanisms, each visible in the IR: every subscript pays an fptosi
  (five in sieve, none in i32), induction variables lose `nsw` and with it the
  widening and strength reduction, and a reduction cannot be reassociated — the
  i32 binary carries 13 paddd where the f64 one carries 11 addsd on a serial
  dependency chain. Binary size is a flat +12.2 KB, the shortest-digits
  formatter that console.log of a double links, which also accounts for the
  size column of BENCHMARKS.md.

  Two of the four i32 benchmarks do not survive recompilation, and that is the
  other half. result.ts does not compile (`&` needs integer operands, and says
  so). strbuild.ts compiles, runs, exits 0 and prints 2410293 where i32 prints
  806394, because `const step = (count + 31) / 32; // ceil(count / 32)` has a
  comment that holds only where `/` truncates. It replaces the invented
  example in WP21 section 6: a program already in the tree makes the case for
  a visible number mode at a package boundary better than one written for it.

- **Stop where stage0 stops: pass 1, and the imports it never loads**

  Three differences, all one shape — stage1 kept working where stage0's
  throw had ended the compilation, and said things stage0 never reached.

  **A module whose pass 1 reported anything does not load its imports.** A
  duplicate function in the entry hides everything an imported module would
  have said, because that module is never read. `tests/link/main_in_import`
  is the case that shows it: in f64 mode the entry's own `main` is the
  refusal, and stage1 went on to load `lib.ts` and report the `main` it
  declares there as a second entry point.

  **The tilde carries the same hint the binary operators do.** An `f64`
  operand under `--number-mode f64` is the mode's `number` rather than a
  deliberate annotation, and `` Operator `~` requires an integer operand ``
  now says so on both sides.

  **A missing module is named from the importer**, as `importedName` names
  one that is found. A diagnostic about a file that is not there should not
  depend on the directory the compiler was run from any more than the IR
  does; `displayName` has no callers left in `src/compilation.ts` and is
  gone.

- **Correct the pass-1 stop: resolve the imports, do not load them**

  The previous commit stopped a module's imports from loading when its
  pass 1 reported anything, and took the gate from 28 undeclared
  differences to 53. Two things were wrong with it.

  **A missing module is still reported.** stage0 resolves every specifier
  either way — that is where "cannot find module" comes from — and only
  the modules that *exist* go unloaded. `tests/link/missing_module` in f64
  mode lost its diagnostic to the earlier rule and has it back.

  **`--emit-ast` is exempt.** The flag prints the tree of every module it
  managed to read, and stage0 reaches that dump before it looks at anything
  pass 1 recorded, so a pass 1 refusal must not stop the load there. It
  cost five programs their dump and their exit status. Phase 0 still stops
  it on both sides: stage0's validator throws, and a program it refuses
  prints no tree anywhere.

  The rule that survives both is narrow and observable: a module whose
  pass 1 refused something resolves its specifiers and loads none of them,
  unless the tree is what was asked for.

- **Record R1 closed: the parity gate is green over the whole corpus**

  parity: 8358 runs over 597 programs; 0 undeclared difference(s),
              1523 declared

  Every program the suite has, through both compilers, under each of the
  fourteen flag variations. Every diagnostic, every span, every byte of IR,
  every sidecar and every exit code is identical.

  Five declarations stand and §A4 lists them with their counts: the parser
  refusing syntax the language forbids before Phase 0 names the rule (602),
  each compiler's own `--emit-ast` tree (548), the `module <path>` header
  line (349), the inheritance cycle stage0 reports once per class (13), and
  the exit status the parser refusal reaches under a dump flag (11).

  The trajectory is in §A4 too, including the step that went backwards, at
  28 undeclared, on a rule about stage0 that two experiments supported and
  a third would have refuted. The mode caught that as well, which is the
  argument for having built it.

- **Write down the casing rules, and why they are not linted**

  The style guide had a Naming Conventions section that covered suffixes and
  basic-block names but never stated the base convention, and biome.json has
  no useNamingConvention rule, so camelCase held only by habit. Say it:
  camelCase for values, PascalCase for types, CONSTANT_CASE for the frozen
  module tables, acronyms keeping their own case (IRBlock, compileToIR), and
  file names as the one exception Biome does enforce.

  Record the three classes of name that are exempt because the spelling is
  the meaning: a table key that names a JavaScript global is the identifier
  being matched (Function, Proxy, Int32Array, parseInt), a name crossing an
  ABI keeps the ABI's spelling (amrit_*, WASI's fd_write, x86_64Layout), and
  a ported benchmark keeps its source program's constants (SOLAR_MASS).

  Also record the measurement behind leaving the rule off: useNamingConvention
  flags 82 places with strictCase on and 70 with it off, and every one falls
  in those three classes, so the rule would be all false positives.

- **Regenerate the diagnostic-code registry, and fix a lint error**

  Two CI failures, both mine, and both from the same gap: the messages this
  branch changed in `src/` landed after its last full `npm test`, so the
  registry generated from those messages went stale and nothing local said
  so.

  `` a `Result` is immutable once built (return a new `Ok(...)`…) `` and
  `` Unary `+` is forbidden; it converts… `` are AS2270 and AS2271. They
  were also the two uncoded messages the coverage check counted: the
  generator derives a rule from a message's longest literal run, and both
  of those rewordings gave it one to key on, so the backlog is back to its
  pinned 1.

  The lint error is `useExplicitLengthCheck` in the declaration added for
  the inheritance cycle: `one.length >= 1` is `one.length > 0`.

- **Write down the plan for arrow functions**

  Arrow functions become how AmritScript declares a function and `function`
  becomes legacy. The note's first job is to establish that this cannot
  change the output of any program: the emitter iterates checked FunctionSigs
  and there is no isFunctionDeclaration anywhere in src/codegen, so the
  declaration form is erased before codegen begins. The golden .ll files are
  therefore the migration's oracle rather than work it creates.

  Runtime cost is nil on both sides. Under Node, 2e9 calls at a monomorphic
  call site measured 1475.6/1494.9/1495.2 ms for declarations against
  1510.1/1486.1/1486.3 ms for arrows. A first attempt said 7.6x and was wrong
  in a way worth recording: it passed both forms through one bench(f) helper,
  so the second made the call site polymorphic and deoptimised it, and the
  declaration then measured 10.5 s too. The cost in JavaScript is an indirect
  call site with more than one callee, which the Function prohibition already
  rules out.

  Two checker rules accept an arrow without admitting function values: a
  module-level const whose initializer is an arrow is a function declaration
  and takes its signature from the arrow's own annotations, and a name bound
  to a function may appear only in call position. Class methods stay methods.
  The concise body is the one new shape, and needs one desugaring at the ~40
  sites reaching sig.decl.body, since FunctionSig.decl is already a three-way
  union.

  The bootstrap forces the order: both compilers must accept arrows before
  self/ can be migrated, and self/ must be arrows before function can be
  rejected. Four stages, with the last two recommended incrementally rather
  than as a flag day: 603 declarations in self/ and 798 across the corpus.

- **Audit what removing `function` would foreclose**

  The four stages were written as if the last one were free. It is the only
  one that removes a spelling, so it is the only one that can cost something
  later, and three constructs have no arrow form at all.

  An arrow cannot be a generator: `const g = *() => {}` is a TypeScript syntax
  error, and the language has no arrow-generator syntax to reach for. That
  turns out to be safe rather than fatal, because `function*` and `yield` are
  already Phase 0 errors with a stated reason, so the stage keeps a forbid
  instead of blocking a plan, and a generator method stays reachable if a
  coroutine runtime ever arrives, since class methods survive.

  Overload signatures and `declare function` also have no arrow spelling, both
  needing the function types Phase 0 forbids. The second is the live one:
  `declare function` is refused as not supported yet rather than forbidden,
  and declaring an external C function is the first thing wanted when binding
  a library. So the stage is narrowed to reject a function definition, and
  `declare function` — which defines nothing — stays legal.

  Generic functions need no rescue, `const f = <T>(x: T): T => x` parses in a
  .ts file, but every example in the generics note is written with the keyword,
  so that surface is restated alongside the rest of the docs.

- **Declare functions with an arrow, in stage0**

  A module-level `const` whose initialiser is an arrow declares a function
  rather than a value: `const double = (n: i32): i32 => n * 2`. The signature
  comes from the arrow's own annotations, so nothing here needs the function
  type Phase 0 forbids, and the `function` keyword keeps declaring the same
  thing as the legacy spelling.

  The two spellings emit byte-identical IR. That is structural rather than
  lucky — the emitter iterates checked FunctionSigs and never looks at the
  declaration's syntax kind — and it is what makes the migration ahead
  verifiable, since a rewritten program whose golden moves by a byte is a
  wrong rewrite.

  FunctionSig gains a normalised `body`, a Block or the concise expression,
  and a `nameNode`, because an arrow has no name of its own and a diagnostic
  that names the function has to point at the const's identifier. Four places
  walk a body and now branch on ts.isBlock; the concise body shares the
  return path with `return` itself, in the checker through checkReturnValue
  and in the emitter through emitReturnValue, so the instructions cannot
  drift between the two forms.

  A function is still not a value in either spelling: the arrow form
  registers in the function table and never in program.constants, which is
  what already makes `const alias = double` an unknown identifier.

  The positive golden waits for stage B, and finding out why corrected the
  plan: every program in tests/cases is compiled by both compilers, so an
  arrow program there fails the IR oracle with `1 rejected by stage1` until
  stage1 parses arrows too. The rejection cases ship now, because stage1's
  parser refuses them and the reject oracle already tolerates that.

- **Read arrow functions in stage1 too**

  Both compilers now take `const double = (n: i32): i32 => n * 2`, so
  tests/cases/fn_arrow ships with the golden .ll, the llvm-as pass and the
  native round trip stage A could not carry: IR(stage0, p) == IR(stage1, p)
  byte for byte over it, concise body and recursion included.

  One piece of the parser was real work. A parenthesis opens a parameter list
  and a parenthesised expression alike, and self/parser.ts keeps one token of
  lookahead, so `const x = (a + b) * c` and `const f = (a: i32): i32 => a`
  cannot be told apart at the `(`. A scratch Lexer runs ahead over the same
  source from the `const`, counts to the parenthesis that closes this one and
  looks at what follows: `=>`, or the `:` of a return type. That is exact
  rather than heuristic, because nothing else can follow a parameter list and
  nothing else puts a `:` after a parenthesis at the head of an initialiser.

  Everything downstream was free, because the parser normalises to the same
  N_FUNCTION node the keyword builds: stage1's checker, emitter, attribute
  pass and escape analysis are untouched for block bodies. The parser oracle
  normalises the same way and says so, being the one place it reshapes a
  typescript tree rather than transcribing it.

  The concise body cost four branches mirroring stage0's, and the oracles
  caught the one they missed: self/dump.ts guarded its body walk on N_BLOCK,
  so a call inside a concise body never reached --emit-checked while stage0
  printed it. The callee table was never wrong -- walkBody prints it, it does
  not build it -- but the guard was, and walkBody had always taken any node.

  The harness was the other surprise. tests/run.js decided whether a case is
  a whole program by matching /\bexport\s+function\s+main\b/ against the
  source, and the two differential harnesses did the same, so an arrow entry
  point linked against tests/driver.c and failed on a duplicate main. Three
  regexes, each now taking either spelling, and a preview of what the corpus
  migration will keep finding: the tooling that reads the language with a
  regex rather than a parser.

- **Give the arrow cookbook entry its snippet**

  docs/cookbook/regen.sh compiles every docs/cookbook/<name>.ts and rewrites
  the block between that name's markers in IR_COOKBOOK.md, so a marker with
  no snippet is an error it reports rather than a block it leaves alone. The
  arrow entry was written by hand with the IR beside it and no source file,
  which `npm test` does not look at -- CI runs the check as its own step, and
  that is what caught it.

  The generated block is byte for byte what was there, so the doc does not
  move: the snippet is the only thing that was missing.

- **Add WP23, the plan of record for the loose language surface**

  A review of the corpus for the sentence "the language has no X" turned up
  eight candidates that no existing work package owns. docs/wp23-language-surface.md
  records the decision on each, with the evidence and an honest cost.

  Landing now, both pure checker work that changes no byte of IR: non-generic
  `type` aliases, where an alias is the type it names -- Int32Array already
  establishes that reading, with sameType holding across it -- and a numeric
  `enum` as a distinct type with i32 representation, stricter than TypeScript
  because "two values are compatible only when their types are identical" is
  the rule the type system is built on. self/ stands 171 module constants in
  for three enums across three files, all i32, so nothing today stops passing
  a token kind where a node kind belongs.

  Proposed and defended, not built:

    - Module-level mutable state, the one functional gap: stage1 cannot emit
      the AS0003 --json object for an internal compiler error, and orientation
      rule 7 says every failure is one of those objects. The note designs the
      narrow version -- module-private, scalar-only, literal initialiser,
      thread-local by construction -- works through what it costs the attribute
      fixpoint, escape analysis, the WP6 model and WP20's asset table, and then
      recommends against building it: an ignored boolean parameter keeps every
      attribute a function had, so threading it costs seven ugly signatures and
      zero proofs while the first writable global costs a symbol in the flat
      namespace WP21 must fix and a withdrawn row from WP20 section 2.
    - Pair<A, B> as a library interface under WP18 monomorphisation rather than
      tuple syntax: no new type constructor, and Pair<i32, i32> reuses WP17's
      packed-i64 path exactly.
    - Compile-time function parameters, marked speculative and strictly after
      WP18, with function values left forbidden.

  Declined, with the rule each one breaks written out: `for...of` over a string
  (tsc --strict types the binding as string, the type-honest version allocates
  per iteration, and JavaScript iterates code points where this language is
  byte-oriented); string `switch`, in agreement with LANGUAGE.md, with the
  length-bucketed variant recorded and refused; and `?.`, because its value in
  the null case is `undefined`, which the language does not have.

  Three claims the review made are corrected in the note rather than repeated:
  self/target.ts is not a flat pair table (it is a class and an if chain);
  self/codes.ts is generated, so its flatness costs nobody anything; and WP17
  proves a packed i64, having explicitly refused the register pair on
  portability grounds. The internalError call-site count is 38, not 39, and
  process.argv is out of reach in self/ice.ts because every self/ module is
  also compiled standalone as its own oracle case, not because it is a library.

  MASTER_PLAN section 9 and docs/README.md point at the note.

- **Accept non-generic `type` aliases in both compilers**

  `type Byte = u8;` at module level was
  `Only top-level function declarations are supported in Phase 1 (found
  TypeAliasDeclaration)`. It is a declaration now, in stage0 and stage1 alike.

  There is no lowering, and that is the point. An alias **is** the type it
  names, the way `Int32Array` is `i32[]`: no new `StaticType` kind, no new LLVM
  type, no side table the emitter reads, no line of IR. `sameType` never sees
  the alias's name because the name is gone by the time a signature is built --
  `resolveTypeNode` answers a `TypeReference` from the module's alias table and
  hands back the resolved type itself. tests/cases/type_alias_ir.ts and
  tests/cases/type_alias_expanded.ts are one program written twice, with and
  without its aliases, and their `.ll` goldens are byte-identical files; if they
  ever differ, an alias has started to mean something.

  Resolution is lazy and memoised, the shape `checker/constants.ts` already uses
  for a constant's fold, and for the same two reasons: an alias may name a class
  or an alias declared further down the file, and one that names itself has to
  be caught rather than followed. A `"resolving"` mark makes that a diagnostic --
  `` Type alias `Feet` is defined in terms of itself ``, the constant cycle's
  wording because it is the same mistake -- and a failed resolution clears the
  mark rather than memoising the error, so a second use reports the real cause.
  Every alias is resolved even when nothing names it, so a broken right-hand
  side is reported where it is written.

  Three rules refuse what an alias must not be. Generics still die in the
  validator (stage0) and at the `=` the parser expects (stage1). A built-in
  type name may not be taken: `string` is resolved from the syntax and `i32` or
  `Result` before any declared name, so `type string = i32` would otherwise sit
  there meaning nothing. And the name shares the one declaration namespace with
  functions, classes, interfaces and constants, checked in both directions.

  `export type` is refused rather than half-supported. A module's signatures are
  resolved during load, before its imports are bound, so an imported name in
  type position resolves provisionally as `%struct.<name>`; an alias has no
  layout to stand in for, and there is nothing to fix up afterwards because the
  type is already baked into the signature. Making it work means resolving every
  module's aliases before any module's signatures -- a change to the load order
  of both drivers, not part of this rule -- so the message says so and
  LANGUAGE.md records why.

  stage1 grows the grammar to match: `type` stays a contextual keyword matched
  by text where `from` and `of` are (so the lexer oracle is untouched),
  `N_TYPE_ALIAS` is node kind 58, and tests/parser_oracle.js transcribes
  `TypeAliasDeclaration` into it so the two parsers are still compared node for
  node. AmritScript-0, the subset `self/` is itself written in, is unchanged: it
  still has no `type` aliases.

- **Rename the language to Nish and the compiler to `nish`**

  The language is Nish and the compiler is `nish`: the npm package, the `bin`
  entry, `runtime/nish.h`, `runtime/nish.d.ts`, `runtime/nish.mjs`,
  `NISH_DEBUG` / `NISH_SIMULATE_ICE`, and the `NISH_<STEM>_H` guard on a
  generated header. `Nish Lang` is the longer form for places a bare name is
  ambiguous, the way Rust writes `rust-lang`; nothing the compiler prints uses
  it.

  The rename cost the two constants docs/ARCHITECTURE.md ("Where the name
  lives") promised it would -- `LANGUAGE` and `CLI` in src/branding.ts and
  self/branding.ts. Every string either compiler prints builds its name from
  those, so no diagnostic was edited to change what it says.

  Three things do not derive from those constants and moved by hand:

  The `amrit_` prefix on the runtime's C symbols is now `nish_`, along with
  `AMRIT_*` -> `NISH_*`, the `%struct.amrit_arena` / `amrit_array` / `amrit_str`
  / `amrit_result_*` layouts, and the Node shim's `__amrit` namespace. This is a
  C ABI break: a host that links runtime/runtime.c or includes runtime/nish.h
  must use the new names. Nothing has been released, so nothing linked the old
  ones. This is the second and last time that prefix moves -- it is ABI rather
  than branding, and neither reason that made it affordable (no release, and
  goldens that are generated rather than written) survives a first release.
  docs/ARCHITECTURE.md records both rewrites and why a third rename stops at
  `LANGUAGE` and `CLI`.

  Diagnostic codes are `NL####` rather than `AS####`. Every number keeps the
  rule it named -- all 344 assignments are preserved, only the two letters move
  -- because a code is a promise across releases. `NL` is a literal in
  scripts/gen-diagnostic-codes.mjs rather than a value from branding.ts, so it
  is frozen by design instead of following the name.

  The repository URLs point at amritk/nish.

  Two goldens carried the name inside a string constant, where LLVM records an
  explicit byte length: io_getenv.ll (`NISH_TEST_*`) and io_spawn.ll
  (`nish-no-such-program`) are regenerated so the lengths match the shorter
  text. The `amrit_` -> `nish_` symbol rename needs no such fixup; only string
  literals are length-prefixed.

  npm run check and npm test are green: 1211 passed, 0 failed, 1 skipped, the
  same counts as before the rename.

- **Regenerate docs/IR_COOKBOOK.md for the shorter name**

  The cookbook embeds the exact IR each construct compiles to, and one snippet
  carries the project's name inside a string constant. LLVM records an explicit
  byte length beside such a constant, so substituting the shorter name into the
  text left the counts describing the old one:

    -@.str.0 = ... { i64, [23 x i8] } { i64 22, [23 x i8] c"hello from Nish\00" }
    +@.str.0 = ... { i64, [16 x i8] } { i64 15, [16 x i8] c"hello from Nish\00" }

  Regenerated with docs/cookbook/regen.sh, which compiles the snippet rather
  than editing it, so the counts come from the compiler.

  This is the same class of breakage as tests/cases/io_getenv.ll and
  io_spawn.ll in the previous commit. A scan of every tracked file that holds
  an IR string constant -- 86 of them, goldens and Markdown alike -- now finds
  no mismatch between a declared length and its text.

- **Write down the plan for async, which is a refusal**

  WP20 section 6 deferred "how does Nish do async/await" to a note that did
  not exist. docs/wp24-async.md is that note, and it declines the feature for
  a reason that is not the expected one.

  The lowering is the cheap part, and this is measured rather than argued. A
  minimal switch-resumed coroutine written by hand in textual IR -- no clang,
  no C++, which is the shape this compiler emits -- is split by LLVM 18.1.3's
  default `opt -O2` pipeline. When the handle is consumed by its caller and the
  coroutine is internal, the frame type, the 24-byte allocation, @f.resume and
  @f.destroy are all elided and the module is the caller's straight-line code;
  store the handle into a global and every one of them comes back. That
  elision condition is the local / returned / leaks classification
  src/codegen/escape.ts already computes, and --strict-exports on by default
  puts an ordinary program on the free row. The whole spike is in section 10
  so the measurement can be re-run.

  What is missing is anything to await. Every I/O call in the language is
  synchronous, and a grep over src/, self/ and runtime/ for
  setTimeout|sleep|poll|epoll|kqueue|socket returns nothing: no timer, no
  sleep, no poller, no socket. Readiness polling does not help a regular file,
  which is why Node's own fs async is a thread pool; the one call that waits
  on something outstanding is spawnSync, and waiting on four children is four
  threads. So the first deliverable of an async package would be a poller and
  a socket type rather than a keyword -- a larger package than the syntax, for
  a workload nobody has asked for.

  The costs are written down anyway, because they fix the order if the answer
  ever changes: Promise<T> is a generic (WP15 item 8, and wp18 section 6.1
  argues against a third built-in family by hand); with no function values
  there is no callback to stop the colour, so one async leaf reaches main and
  links an event loop into a binary whose premise is a 4,696-byte hello world;
  willreturn dies at every suspend and readnone at every frame spill, which is
  a correct loss no effort recovers; a scheduler does not fit in the 244 bytes
  left of runtime.c's budget; wasm's loop belongs to the host; and Node is the
  differential oracle, so microtask ordering would become a declared
  difference for a construct users assume is identical.

  One item is recommended for building and it has no language surface: an
  asynchronous N-API export. --emit-napi writes a shim that calls the function
  on the thread N-API handed it, so an addon that runs for 200 ms blocks Node's
  event loop for 200 ms. napi_create_async_work plus napi_create_promise moves
  it to libuv's pool with the Nish function left exactly as synchronous as it
  is, and its entire prerequisite is WP20's T0 thread-local arena -- a worker
  allocating through the inlined bump allocator is a data race in the emitted
  IR, not merely in runtime.c.

  Six refusals carry the rule each one breaks, including the tempting one:
  accepting async as an erased no-op keyword would make a program mean
  something different under Node than it does here, in the one direction
  tests/differential/ exists to prevent.

  Nothing here is pre-1.0 -- LANGUAGE.md keeps the rejections it has, so M4's
  freeze waits on none of it. MASTER_PLAN section 9, docs/README.md and WP20
  section 6 point at the note.

- **Close slice iterators by measurement, and correct four stale status claims**

  WP15 item 3 proposed lowering `for (const c of s)` to pointer advancement so
  that the idiomatic loop would also be the check-free one. Measured, the loop it
  was written to beat already is that loop, and the mechanism has nothing left to
  build.

  Two programs summing a 20,000,000-element `i32[]`, one written
  `for (const x of xs)` and one as a counted loop over `xs[i]`, link to 8,008
  bytes and byte-identical binaries: §2b's alias domains let LICM hoist both the
  length and the data pointer out of the loop, leaving a body of getelementptr +
  load + add + add + icmp. A guarded byte loop is 7,008 bytes with and without
  `--unchecked-indexing`, byte-identical, because LLVM relates the index to the
  length and drops the check unaided; a call in the body does not put the header
  back, since the attribute fixpoint gives a string parameter `noalias nocapture
  readonly`. The string half of the proposal is declined on language grounds by
  WP23 §7, so both halves are closed.

  What is not free is a cursor the body advances by a variable amount, which
  `for...of` cannot express: a lexer-shaped program measures 1.40 s checked
  against 1.28 s unchecked, 1.094x and 216 bytes. That is the ceiling for
  eliminating bounds checks on real lexer code, and it is the acceptance number
  for ranged types and length narrowing (item 6) rather than for item 3 -- which
  is what `self/lexer.ts` is made of, and the measured form of the observation
  WP23 §7 makes from the language side.

  The status lists had gone stale around it, so four claims are true again:
  items 2 (the `performance` diagnostic class) and 4 (unsigned types) had both
  shipped while MASTER_PLAN §9 and WP15 §9 still listed them as remaining;
  wp20-threads §2 still said arrow functions are rejected, which WP22 stages A
  and B changed, though a function is still not a value, which is what that row's
  argument rests on; and wp22-arrow-functions still opened "Proposed, not
  implemented" above its own table recording A and B as landed.

  Documentation only: no compiler source changed, `npm run check` and `npm test`
  are green (1211 passed, 0 failed, 1 skipped for a missing WASI sysroot), and
  `docs/check-links.mjs` passes 332 links.

- **Correct WP24: Rust builds its own state machine, and generics are not a gate**

  Two corrections to the async note, both from asking what Rust actually does
  rather than assuming.

  First, vocabulary the note should have led with: a coroutine is not a strategy
  for async/await, it is what async/await is. A function that suspends has to
  put its live locals somewhere other than the frame it left, and there are three
  places -- a struct holding just the live values, a whole stack per task, or
  nowhere because you never suspend. The only real choice is who writes the state
  machine, and the note measured just one of the two answers.

  The other answer is Rust's, measured here with the rustc the benchmark suite
  already uses (1.94.1), on an async fn with two suspension points and a local
  live across both: zero llvm.coro.* intrinsics at -C opt-level=0 and 2 alike, a
  generated poll that loads a one-byte state discriminant at offset 12 of the
  future and switches into five resume points, a 20-byte future that is a plain
  value with fields at 4/8/12/16, and no heap allocation anywhere on the async
  path -- size_of_val folds to `ret i64 20`. rustc does the transform in MIR and
  hands LLVM ordinary IR.

  That is the shape to build if this is ever built, not the llvm.coro.* one the
  note spiked. A struct with a discriminant and a switch over it are constructs
  this language already has, and WP23's numeric enum makes the discriminant a
  distinct type; there is no dependence on an intrinsic family whose lowering
  lives in an optimisation pass, so the cost model stops inverting between
  --profile debug and speed; and the frame becomes an ordinary allocation site
  that escape.ts classifies with the rule it already has. Section 9's open
  question about what a debug build of a coroutine would cost is answered by not
  depending on the pass.

  Rust's hardest async problem does not arise here. Pin, Unpin and the unsafe
  around them exist because Rust puts locals in the frame and lets a program take
  a reference to one, so moving the frame invalidates it. Here escape.ts already
  decides alloca versus arena, and a value whose reference is live across a
  suspend is simply denied the alloca -- the same judgment wp20 section 3.3 needs
  for a spawn.

  Second, and this moves a gate: section 4.1 claimed Promise<T> is a generic and
  WP18 is a hard prerequisite. It is not. Rust's impl Future is anonymous -- one
  unnameable compiler-generated type per async fn -- and await here would always
  apply to a known call site, so the state machine type need never be spelled in
  a program. What generics actually buy is futures held as data: an array of
  them, join, select, storing one in a field. So WP18 stops being a prerequisite
  in front of the feature and becomes an enhancement after it. The section keeps
  the wrong claim visible rather than quietly editing it out, and section 6's
  gate table is renumbered to match: A3 is the feature and waits only on A2, A4
  is futures-as-data.

  What does not change is the conclusion. Rust demonstrates that the language
  half of async is cheap and that the language half does nothing alone: std has
  no executor, an async fn nobody polls is an inert struct, and the reactor and
  scheduler arrive as a dependency. That is section 2's finding from the other
  side.

  Both spikes are in section 10 so either measurement can be re-run.

- **Add WP24 section 9: what the refusal costs, and what survives it**

  Two questions a decision to not build something has to answer, and the note
  answered neither: does waiting foreclose anything, and which parts of the
  feature are still reachable when the trigger arrives.

  Waiting forecloses nothing in the language, and this is checked rather than
  assumed. `async` and `await` are contextual in TypeScript's grammar and this
  compiler inherits that grammar, so both are ordinary identifiers now and stay
  ordinary identifiers after. Verified against the typescript package's own
  parser and against the compiler: `export function async(n: i32): i32` compiles
  today and still parses once the modifier exists, since `async function async()
  {}` is valid TypeScript; a local named `await` is fine in a synchronous
  function and is rejected inside an async one exactly as JavaScript rejects it.
  So no keyword needs reserving before the M4 freeze and no migration note is
  owed.

  What waiting does cost is four small things, the second of which was not
  written down anywhere. WP6's automatic scopes and WP9's call-site reclaim both
  bracket a contiguous dynamic extent with arena mark/release/keep, and a suspend
  point in the middle of such a bracket is what those brackets are not built for
  -- a coroutine suspending inside a scoped function would have its memory
  released underneath it. The rule an async package needs is that a function
  which can suspend gets no automatic scope and an awaited call gets no
  call-site reclaim bracket. Cheap to state now and more expensive the more later
  optimisations assume that extent is contiguous, so whoever writes the next
  arena optimisation should know there is a future customer for the assumption.

  What survives is Rust's arrangement rather than JavaScript's, and the table
  says so row by row: async/await and sequential suspension yes, with no generics
  needed; fixed-arity awaitAll over known call sites yes for the same reason; a
  homogeneous awaitAll over an array yes after WP18; Promise.all typed as a tuple
  of mixed types no, since that wants tuples and variadic generics and wp23
  section 5 stops at Pair; and the promise as a first-class value no.

  That last row is the only entry refused by a decision the project has already
  made and already lives with rather than by work nobody has done. Result has no
  map, andThen or orElse because they need function values and the whole-program
  pass cannot prove purity, termination or escape through an unknown callee
  (wp16 section 6), and .then is andThen wearing a promise. A language that
  rejected Result.map and then accepted Promise.prototype.then would be trading
  the attribute fixpoint for a spelling.

  Open and the appendix renumber to 10 and 11.

- **Make the bootstrap seed a parameter, and build its comparison tool**

  Four of WP19's six retirement gates, and the macOS blocker that stood in
  front of the fifth. stage0 stays the seed and the oracle; nothing is deleted.

  G3, the seed protocol. `scripts/bootstrap.sh` stops assuming `dist/index.js`
  and reads `NISH_BOOTSTRAP`, the way `GOROOT_BOOTSTRAP` names the Go that
  builds Go. The seed is a released `nish` executed directly, or a `.js`/`.mjs`
  entry point run under node, chosen by extension: the executable bit describes
  the download rather than the file, and `dist/index.js` is 0644 in a fresh
  checkout. Either kind must answer `--version` before a stage runs, so a binary
  for the wrong platform fails under the variable's own name instead of three
  stages deeper. Unset, the seed is stage0 and the output is unchanged line for
  line.

  The header records that the first equality changed meaning. With stage0 as the
  seed, `IR(seed) == IR(stage1)` is WP14's claim that two independently written
  implementations agree; with a released binary it is the weaker claim that a
  release and HEAD agree.

  G2 items 1 and 2. `tests/nish-cmp.js` compares a reference compiler with a
  candidate over the whole corpus, byte for byte, and succeeds `ir_oracle.js`
  and `interop_oracle.js` in one pass: every `.ll`, the four sidecars, the file
  set, and the exit status, since a program one side refuses is a difference.
  It reuses `tests/self/corpus.js` so it compiles what every other oracle
  compiles, with the same flags. A difference must be named in `CHANGELOG.md`,
  and a declaration whose words are missing from the changelog fails as loudly
  as an undeclared difference. It agrees with the oracle it replaces on all 329
  programs and 2,332,971 IR lines, and it has been watched failing on an induced
  one-flag difference. With no release to compare against it skips, counted and
  explained rather than reported as a pass. `fuzz.js --stage1` takes the same
  pair and falls back to stage0 versus stage1.

  G4, the seed policy: nish 0.N is built by the last patch release of 0.(N-1),
  with 0.1.0 as the stated base case, built by stage0 and creating the first
  seed. Its consequence for contributors is that a construct added in 0.N cannot
  be used by `self/` until 0.(N+1), so wp14 rule 1 survives retirement with only
  its subject changed.

  G6, the provenance procedure: how to re-verify diverse double-compiling from
  the `ddc-<version>` tag years later, and what a pass and a failure each mean.
  The tag itself is cut at release time.

  The macOS blocker, which G5 needs for darwin binaries: `scripts/build.sh` runs
  under `set -u`, and bash 3.2 treats an empty `"${arr[@]}"` as an unbound
  variable. Ten sites take the `${arr[@]+"${arr[@]}"}` spelling; `common`,
  `inputs`, `gc` and `shared` are provably non-empty and are left alone. The
  emitted command lines are byte-identical on Linux at every profile.

  npm run check and npm test green: 1211 passed, 0 failed, 2 skipped — the
  WASI sysroot, and nish-cmp declining to compare against a release that does
  not exist yet.

- **Ship the self-hosted compiler with a release, and bootstrap CI from it**

  A `v*` tag now attaches nish-<version>-x86_64-linux.tar.gz beside the npm
  tarball, and ci.yml gains a `bootstrap` job that builds self/ with the last
  release as its seed. Linux only, and one binary rather than four: macOS stays
  out of the test matrix, so G3's second operating system and three of G5's four
  binaries stay open. wp19 records what each gate has and what it lacks rather
  than claiming either is closed.

  A tarball rather than a bare binary, because a bare binary is half a compiler.
  `--link` runs scripts/build.sh and compiles runtime/runtime.c, and the compiler
  looks for both in its own directory's parent and in the working directory. So
  bin/nish one level below runtime/ and scripts/ is the layout that works -- the
  shape dist/index.js already has in the npm package. Shipped flat beside
  runtime/, it links only while the working directory happens to be the unpacked
  folder, which is a trap rather than a distribution. Measured rather than
  assumed: a bare binary emits IR and then says it cannot find scripts/build.sh,
  and the flat layout passes only when run from inside itself.

  The release smoke step therefore unpacks the real tarball in one directory and
  drives it from a third, so neither the repository nor the unpack directory can
  be what makes it work. The binary is stage2 and is --verify'd before it ships,
  because it is not only a convenience: it is the seed every later release
  bootstraps from, which is also why its name and layout are a contract between
  the two workflows rather than a label.

  The bootstrap job is what enforces the rolling freeze. Using a construct before
  the seed knows it breaks there and nowhere else, since `npm test` seeds from
  stage0, which always knows every construct the working tree does. Before 0.1.0
  there is no release to seed from, and the job says so in an annotation instead
  of passing quietly.

  Verified locally end to end, in the shape CI will run it: the tarball builds
  (441 KB), unpacks, links and runs a program from an unrelated directory; used
  as NISH_BOOTSTRAP it builds self/ to IR(seed)==IR(stage1)==IR(stage2) with
  stage3 byte-identical to stage2; and nish-cmp against it agrees on 329/329
  programs and 2,332,971 IR lines. `node tests/run.js wp12` 31 passed, 0 failed;
  docs/check-links.mjs 334 links.

- **Write down the coverage that dies with stage0**

  WP19 gate G2 item 4. Four oracles -- checked, types, diagnostics, symbols --
  prove stage1 correct by holding it against stage0, and prove nothing once src/
  is deleted. They are green, so what stage1 prints is the agreed behaviour of
  both implementations; tests/self/goldens/ is that output checked in, and
  tests/self/goldens.js compares stage1's live answer against it with stage0
  nowhere in the picture. Both run while stage0 lives. This one survives it.

  1,332 KiB: the --emit-checked dump of all 319 corpus programs (303,096 lines),
  the 119-line type matrix, the 570-line diagnostic-machinery transcript, the
  25-line scope-and-narrowing script. The self/ dumps are 19.9 MB raw, because a
  self/ program is loaded whole and each of the 57 entries re-dumps every module
  it imports; the distinct content is 1.0 MB, so they are stored by module. That
  is a storage decision and not a coverage one -- the check still runs all 57
  programs and compares every one of the 19.9 MB of bytes, and a module that
  dumps differently under two entries is a hard error naming both rather than a
  silent pick.

  Verified by the property it exists for: with src/ and dist/ moved aside the new
  check passes while all four oracles fail to start. Each golden was also watched
  failing, on a perturbed byte and on perturbed stage1 source -- deleting the
  parent-scope recursion in Scope.typeOf reports the narrowing that outlives its
  scope in two readable lines.

  What this does NOT recover is the diagnostic wordings, which is the half the
  gate singles out, so the number is written down rather than assumed. Of 344
  registry codes the surviving reject_* and tests/link/ negatives exercise 148;
  196 are exercised by nothing that outlives stage0, and these goldens close none
  of that gap -- measured by matching every registry fragment against each file.
  On the 265 reject_* cases alone stage1 names 144 codes where stage0 names 182,
  that difference being the class where stage1's parser refuses the syntax before
  Phase 0 can name the rule. All six driver wordings, all six interop wordings
  and both performance warnings are exposed. wp19 §2B carries the list, and R3
  now says this is the half that matters.

  Also here: CHANGELOG.md is emptied and its policy stated. A section is written
  when a release is cut, not as development goes along, so between releases the
  file is empty and the account of what changed is the git log and the wp notes.
  And tests/link/no_main/main.ll is ignored -- the negative case writes its IR
  beside the source before reporting the missing main, so every run of the link
  section left an untracked file where `git add -A` could sweep it up.

  npm run check clean; npm test 1212 passed, 0 failed, 2 skipped (the WASI
  sysroot, and nish-cmp with no release to compare against).

- **Remove inheritance; widen `implements` to a prefix check**

  `class D extends B`, `super(...)`, `super.m()` and method overriding are gone
  from the language, and `class C implements I` now requires `I`'s fields to be
  `C`'s *first* fields rather than all of them. The two go together: the second
  keeps the only thing the first was buying.

  `extends` gave three things. A field prefix -- `%struct.D` was `B`'s fields
  followed by `D`'s own, so a `D*` was a valid `B*` after one `bitcast`. Member
  reuse. And polymorphism, which is the reason hierarchies exist and the one
  thing this language never had, because dispatch is static: `d.m()` resolves to
  the `m` of `d`'s *declared* type. Holding a `Base[]` and calling `m()` -- the
  classic use -- silently ran the base method. Inheritance without virtual
  dispatch is the syntax of a hierarchy with none of the payoff.

  The prefix keeps working, through `implements` instead:

    %struct.Shape  = type { i32, i32 }
    %struct.Square = type { i32, i32, i32 }
    %struct.Circle = type { i32, i32, i32, i1 }

  A `Square*` becomes a `Shape*` with one `bitcast`, a `Shape` operation reads
  and writes the `Square`'s own bytes at the same offsets, and two classes with
  different tails live in one `Shape[]`. No IR moved: not one golden changed
  except the ones whose programs were deleted, and tests/layout/structs.ts
  declares `K`, `L` and `M` -- the three classes that used to be derived -- as
  classes implementing an interface, still 24, 16 and 32 bytes, with the C twin's
  _Static_asserts untouched. A class's own fields reuse the prefix's tail
  padding, which a nested struct member would not.

  What the removal buys is the language's only knowing divergence from
  JavaScript. An override reached through a base-typed value ran the base method
  natively and the derived one under Node:

                            Node    native
    areaOf(sq)                 9        0
    sq.report()              100       10

  RUN_UNDER_NODE.md listed it among the four things no prelude can reach and
  known-failures.txt carried cls_extends_override as a by-design failure. Both
  entries are deleted rather than explained. Two smaller declarations went too:
  the parity oracle's inheritance-cycle entry (stage0 reported a cycle once per
  class, stage1 once, because stage0's throw left a `collecting` marker set), and
  the last `tsc` ambient divergence but one, an implicit `super()` that
  JavaScript throws on.

  Sixteen `reject_*` cases collapse into two, because sixteen rules collapse into
  two: `extends` is refused and `super` is refused, in every spelling. Both live
  in the checker rather than Phase 0 -- inheritance needed nothing Phase 0 exists
  to refuse, it compiled until now -- and both messages name the rewrite, by the
  doctrine wp22 section 6 states for a removed spelling. The registry appended
  NL2277-NL2279 and renumbered nothing.

  self/ did not change: 25,911 lines over 57 modules and not one derived class,
  because wp14 section 2.1 had already chosen a single `Node` class with a `kind`
  discriminant over a hierarchy, and Nish-0 was defined as the language minus
  "inheritance and downcasts". The largest Nish program there is had declined the
  feature years before this commit removed it.

  docs/wp24-inheritance.md is the plan of record.


[Unreleased]: https://github.com/amritk/nish/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/amritk/nish/releases/tag/v0.1.0
