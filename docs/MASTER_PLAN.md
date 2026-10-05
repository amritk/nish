# Nish Master Plan

What Nish is, what exists, what remains, and how the work is cut into
packages. The packages that have landed are a table in §5 with a link to the
note that records each one; the open work is under [What remains](#what-remains).
`docs/LANGUAGE.md` is normative for the language; where this plan or a
`wp*.md` note disagrees with it, LANGUAGE.md wins.

Repo: `amritk/nish`, default branch `main`.

---

## 1. Vision

Nish is an ahead-of-time compiler for a strictly static subset of
TypeScript. It parses source with its own lexer and parser, written, like the
rest of the compiler, in the language it compiles; it hard fails on anything
dynamic, and emits LLVM IR that clang/LLVM turn into native
binaries for x86_64, ARM64, and WebAssembly.

Targets, in priority order:

1. **Correctness by construction.** No `any`, no dynamic properties, no GC.
   If it compiles, memory layout is fixed and known.
2. **Rust-class output.** Sub-megabyte (in practice sub-100 KB) binaries,
   `-O3` loop/math speed, zero-cost abstractions, LTO and dead-stripping.
3. **Zero-GC memory.** Arena/bump allocation by default, explicit reset,
   optional reference counting only for objects that must outlive an arena.
4. **Node/npm interop in one direction only.** Nish exports `.wasm` /
   native addons that Node imports. Nish never embeds a JS engine.

Non-goals: running arbitrary TypeScript, JS semantics for `number` overflow,
prototypes, `eval`, reflection, exceptions as control flow.

## 2. Architecture: the three-layer stack

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Developer UX                                                  │
│    Biome: format-on-save, style lint. Advisory only. Never a     │
│    correctness gate.                                             │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. Compiler frontend (this repo, src/, written in Nish)          │
│    Phase A  lexer.ts, parser.ts   one Node tree, dense ids       │
│    Phase 0  validator.ts   forbidden-syntax sweep, hard fail     │
│    Phase B  checker.ts + families   types, scopes, side tables   │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. Compiler backend                                              │
│    Phase C  attributes.ts   purity / escape / loop facts         │
│             emit*.ts        AST -> LLVM IR text                  │
│             runtime.ts      runtime ABI, inline allocator        │
│    runtime/runtime.c            arena + strings (C, 3.6 KB)      │
│    runtime/runtime-os.c         files, spawn, env (C, 1.5 KB)    │
│    runtime/runtime-host.c       clock, rng, signals (C, 0.8 KB)  │
│    runtime/runtime-net.c        sockets (C, 2.3 KB)              │
│    runtime/runtime-parallel.c   range partitioner (C, 0.3 KB)    │
│    scripts/build.sh             clang -O3/-Oz, LTO, gc-sections  │
└──────────────────────────────────────────────────────────────────┘
```

Design rules that every WP must respect:

- **Checker records, emitter reads.** The checker writes types and bindings
  into side tables (`src/program.ts`). The emitter contains no user-facing
  error handling; any node it sees is valid, and an unexpected one is exit 70.
- **Attributes are guarantees.** An LLVM attribute is emitted only when the
  checker has proved it. A wrong attribute is undefined behaviour.
- **ABI is a contract.** Struct layouts in `src/runtime.ts` and
  `runtime/runtime.c` / `runtime/nish.h` must match byte for byte, and
  `tests/run.js` fails when they disagree.
- **Every construct ships with a golden test** (`.ts` in, `.ll` out) and a
  native round trip (link with clang, run, compare stdout).
- **Runtime stays tiny.** Each translation unit has its own ceiling on every
  `.text*` section summed at `clang -Oz`, measured by `tests/run.js` on every
  run (`node tests/run.js budget`) rather than by a reviewer. The core,
  `runtime.c`, is a closed set whose ceiling should only come down; the
  OS-facing units grow with the surface, and an addition that does not fit
  becomes a unit of its own rather than borrowing room. Measured 2026-10-05
  with clang 18 on linux-x64:

  | Unit | Today | Ceiling |
  | --- | ---: | ---: |
  | `runtime.c` | 3,606 (3,731 with `-DNISH_THREADS=1`) | 3,606 (3,840) |
  | `runtime-os.c` | 1,530 | 1,536 |
  | `runtime-parallel.c` | 286 (905 threaded) | 320 (1,024) |
  | `runtime-host.c` | 764 | 768 |
  | `runtime-net.c` | 2,303 | 2,304 |

  `-ffunction-sections -Wl,--gc-sections` means a binary pays only for the
  functions it calls. [wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget)
  records each measurement, why the single ceiling became one per unit, and
  every time a ceiling moved.

## 3. Consolidated language specification (Nish)

A summary. [LANGUAGE.md](LANGUAGE.md) is the normative statement of every
rule here.

### 3.1 Types

| Nish | LLVM | Notes |
| --- | --- | --- |
| `number` | `i32` (default) or `double` (`--number-mode f64`) | Signed overflow is a checked panic (#426). |
| `i32`, `f64`, `i64` | `i32`, `double`, `i64` | Explicit, always available. |
| `u8`, `u16`, `u32`, `u64` | `i8` … `i64` | Unsigned; overflow wraps (WP15 item 4). |
| `integer<Lo, Hi>` | `i32` | A ranged integer; entry into the range is checked (WP31). |
| `boolean` | `i1` | `zeroext` at ABI boundaries. |
| `string` | `i8*` to `{ i64 len, i8 data[len], i8 0 }` | Immutable, UTF-8, 8-aligned, arena or constant. |
| `void` | `void` | |
| `class` / `interface` | `%struct.Name = type { ... }` | Fixed fields, declared order, natural alignment. WP2. |
| `T[]` | `%array.T = type { i64 len, T* data }` | Fixed element type, bounds-checked; an `interface` element is stored inline (WP15 item 7). WP4. |
| `T \| null` | nullable pointer | WP6, pointer types only. |
| `Result<T, E>` | a struct, or one `i64` when both arms are small scalars | WP16, WP17. |
| `Map<K, V>`, `Set<T>` | generic classes written in Nish (`std/collections.ts`) | Insertion-ordered, as JavaScript's. WP32. |
| generic functions, classes, interfaces, methods | one instantiation per type argument list | WP18. |

### 3.2 Forbidden (Phase 0 validator, hard compile error)

Everything dynamic is refused before the checker runs, each with a message
and a `reject_*` case: `any`, `unknown`, `symbol`, `bigint`, `undefined` as a
type or value, union types other than `T | null`, `eval`, `Function`, `Proxy`,
`Reflect`, `Symbol`, `globalThis`, `arguments`, `with`, `delete`, `typeof`,
`instanceof`, `in`, `for...in`, `==`/`!=`, comma expressions, `void expr`,
`var`, `try`/`catch`/`finally` and `throw` (a failure is a `Result<T, E>`,
WP16), labelled statements, generators and `yield`, `async`/`await` (WP24),
decorators, enum members that are not numeric literals, namespaces and
`declare global`, computed property names, object spread, prototype access,
`Object.assign` and its relatives, string-keyed element access, `?.`, `??`
except on a `Map.get` result, regex literals, dynamic `import()`,
`import.meta`, and type parameters on a type alias or a constructor.
[LANGUAGE.md](LANGUAGE.md#forbidden-constructs-phase-0-validator) has the
table with each message and the idiom to write instead.

### 3.3 Semantics decisions already made

- Signed integer overflow is a checked panic: an operation the bounds walk
  cannot prove fits is `llvm.s*.with.overflow` and a branch to
  `nish_panic_overflow`, and one it can is `nsw` (#426). `wrappingAdd`,
  `wrappingSub` and `wrappingMul` from `nish:unsafe` wrap at one site, and the
  deprecated `--wrapping` makes the entry package's operators wrap. `--nsw` is
  refused. Unsigned overflow wraps. Was "overflow wraps" until WP15 §3 made it
  `nsw` undefined behaviour, and that until #426 made it checked.
- Strings are immutable and shared by pointer; equality is by content.
- Functions are `nounwind`; there is no `throw` (WP16), and `panic(message)`
  prints and exits 1. `--deny-panics` and the manifest's `noPanic` refuse every
  panic site the checker cannot prove away (#443).
- Parameters are immutable (`const` semantics) and used as SSA values.
- Locals use `alloca`/`load`/`store` with natural alignment; `opt -mem2reg`
  promotes them, so this is free.
- Only `export`ed functions carry the C ABI; every other top-level function is
  `internal`, so LLVM may inline, specialise or drop it. `--no-strict-exports`
  makes them all external again (WP15 §3).
- An out-of-range index panics. `uncheckedGet` and `uncheckedSet` from
  `nish:unsafe` opt one site out; `--unchecked-indexing` is deprecated
  (NL9014), and `nish --fix` migrates it (#459).

### 3.4 Open decisions

| Question | Options | Recommendation |
| --- | --- | --- |
| Default `number` mode | `i32` (fast, current) vs `f64` (JS semantics) | Keep `i32` default; document loudly; `f64` via flag. [wp28](wp28-compatibility-mode.md) §5.3 proposes the answer that a second dialect forces: `i32` in strict, `f64` in compat, because a ported codebase that truncates at 2\*\*31 diverges quietly. |
| Overflow | wrap / trap / `nsw` UB | **Decided (#426): trap — a checked panic by default, `nsw` only where proven, `wrapping*` from `nish:unsafe` to opt out at one site.** WP15 §3 had chosen `nsw` UB. |
| Class inheritance | none / single with prefix layout / interfaces only | **Decided (WP25): none.** `extends` was built and then removed; the field-prefix layout it bought survives as a prefix-checked `implements`. |
| Object lifetime | arena only / arena + RC / escape-analysed stack | **Decided:** arena + escape-analysed `alloca` (WP6), with `using a = arena()` as the explicit bracket (#420). Reference counting is not built. |
| String encoding | UTF-8 bytes (current) vs UTF-16 (JS) | UTF-8; `.length` is byte length, documented. [wp33](wp33-round-trip.md) §7 Q1 keeps it: UTF-16 offsets would cost the native build, so this stays a translated difference between the two readings, flagged on the way in. |

## 4. What exists today

There is **one compiler**, and it is written in the language it compiles:
`src/`, 83 modules (`ls src/*.ts | wc -l`) and 72,739 lines of Nish
(`cat src/*.ts | wc -l`), built by the last released `nish`, the seed (M6).
`.claude/orientation.md` is the ninety-second map, and
[ARCHITECTURE.md](ARCHITECTURE.md)'s pipeline table maps each stage to its
modules; the table below is the inventory.

| Area | State | Where |
| --- | --- | --- |
| CLI and driver: `-o`, `--link`, `nish run`, `--profile`, `--number-mode`, `--target`, `-g`, `--json`, `--fix`, the dumps, the interop sidecars, `--emit-panics`, `--deny-panics`, `--emit-capabilities`, `--allow`/`--deny`, `--version`, exit codes 0/1/2/3/70 | done | `src/compile.ts`, `compilation.ts`, `fix.ts`, `ice.ts`, `branding.ts` |
| Parse and Phase 0 validate | done (WP0) | `src/lexer.ts`, `parser.ts`, `validator.ts` |
| Checker: pass 1 signatures, pass 1b imports, pass 2 bodies; generics, `Result`, ranged integers, bounds facts, panic sites, capabilities | done | `src/checker.ts` and its families |
| Emitter, attributes and escape analysis | done (WP1–WP9, WP15) | `src/emit*.ts`, `attributes.ts`, `escape.ts`, `bounds.ts` |
| Debug info | done (WP10, WP17) | `src/debug.ts` |
| Interop: C header, `.d.ts` and loader, N-API (sync and async), wasm, C calls through `declare function` | done (WP8, WP17, WP24, WP27, WP30) | `src/interop-*.ts` |
| Packages: `package.json` `exports`, bare specifiers, real-path identity, the manifest's `nish` field | S1–S2 and half of S3 (WP21) | `src/manifest.ts`, `paths.ts` |
| Runtime: five translation units, the WASI twin, the Node shim and prelude | done | `runtime/` |
| Threads: `parallelMapInto`, `parallelReduce`, `using s = scope()` | P1, P2 (WP20, WP29) | `std/threads.ts`, `runtime/runtime-parallel.c` |
| Standard library: testing, text, json, pair, collections, secret, threads, `nish/crypto/*`, `nish/net/*` | growing (WP26, WP34) | `std/`, [std/README.md](../std/README.md) |
| Build profiles `debug`, `speed`, `size`, `wasm`, `wasi`, `napi`, PGO | done (WP9) | `scripts/build.sh` |
| Tests: 1,621 golden cases (946 of them `reject_*`), 335 `tests/link/` programs, `llvm-as`, native round trips, layout, runtime budgets, interop, packaging, `tests/fix/` | done | `tests/run.js`, `tests/cases/`, `link/`, `fix/` |
| Differential testing against Node and against the last release | done (WP13, WP19) | `tests/differential/`, `tests/nish-cmp.js` |
| The bootstrap and the goldens that succeeded the stage0 oracles | done (WP14, WP19) | `scripts/bootstrap.sh`, `tests/self/` |
| Benchmarks in Nish, C, Go and Rust | done (WP9) | `bench/`, [BENCHMARKS.md](BENCHMARKS.md) |

Measured 2026-10-05: `examples/hello.ts` links to 4,712 bytes at the `size`
profile on linux-x64.

## 5. Work packages

Sizes, where a package was given one: S = under a day of agent work, M = one
to two days, L = several days. Each package has a note, `docs/wpN-*.md`; a
landed package's note is a summary of what shipped and why, and an open one's
is its plan. [README.md](README.md) indexes them.

| WP | Package | State | Note |
| --- | --- | --- | --- |
| P | Pipeline prep: dispatch tables, the golden harness, `npm run check` | landed | — |
| 0 | Phase 0 validator, Biome | landed | [wp0](wp0-validator.md) |
| 1 | Control flow | landed | [wp1](wp1-control-flow.md) |
| 2 | Classes, interfaces, structs | landed; WP2b's inheritance later removed (WP25) | [wp2](wp2-classes.md) |
| 3 | Strings | landed | [wp3](wp3-strings.md) |
| 4 | Arrays | landed | [wp4](wp4-arrays.md) |
| 5 | Modules, entry point, linkage | landed | [wp5](wp5-modules.md) |
| 6 | Memory: escape-analysed stack, arena scopes, `T \| null` | landed | [wp6](wp6-memory.md) |
| 7 | Runtime and intrinsics | landed | [wp7](wp7-runtime.md) |
| 8 | Interop: wasm, N-API, headers | landed | [wp8](wp8-interop.md) |
| 9 | Optimisation and benchmarks | landed | [wp9](wp9-optimisation.md) |
| 10 | CI, diagnostics, the code registry | landed | [wp10](wp10-ci.md) |
| 11 | Documentation | continuous, folded into every package | — |
| 12 | Release engineering | landed | [wp12](wp12-release.md) |
| 13 | Differential testing against Node | landed | [wp13](wp13-differential.md) |
| 14 | Self-hosting | landed (M5) | [wp14](wp14-selfhost.md) |
| 15 | Performance first | closed: every item done, closed by measurement or closed by decision | [wp15](wp15-performance.md) |
| 16 | `Result<T, E>` and the end of `throw` | landed | [wp16](wp16-results.md) |
| 17 | `Result` across the ABI | landed | [wp17](wp17-result-abi.md) |
| 18 | Generics by monomorphisation | landed; §16 lists what stays deferred | [wp18](wp18-generics.md) |
| 19 | Stage0 retirement | landed (M6) | [wp19](wp19-stage0-retirement.md) |
| 20 | Threads: the runtime half | T0 and the partitioner built; the surface moved to WP29 | [wp20](wp20-threads.md) |
| 21 | Packages | S1, S2 and half of S3 landed; the rest open | [wp21](wp21-packages.md) |
| 22 | Arrow functions as the declaration form | A and B landed, C done but for the test corpus; stage D is an open question | [wp22](wp22-arrow-functions.md) |
| 23 | The language surface a corpus review asked for | settled row by row | [wp23](wp23-language-surface.md) |
| 24 | `async`/`await` | declined; `--emit-napi-async` built | [wp24](wp24-async.md) |
| 25 | Remove inheritance, widen `implements` | landed | [wp25](wp25-inheritance.md) |
| 26 | The standard library | landed, and growing | [wp26](wp26-stdlib.md) |
| 27 | Calling C | S1 and S2 built | [wp27](wp27-ffi.md) |
| 28 | Compatibility mode | proposed | [wp28](wp28-compatibility-mode.md) |
| 29 | The thread surface | P1 and P2 built; P3 proposed | [wp29](wp29-thread-surface.md) |
| 30 | Bytes across the interop boundary | landed | [wp30](wp30-bytes-interop.md) |
| 31 | Ranged integers | landed in 0.13.0 | [wp31](wp31-ranged-integers.md) |
| 32 | `Map` and `Set` | landed in 0.11.0 and 0.12.0; a `Map` read in a parallel body (§9.3) is still open | [wp32](wp32-map.md) |
| 33 | The round trip to TypeScript | R0–R2 built, R5's exact half built; R3, R4 open | [wp33](wp33-round-trip.md) |
| 34 | Hosting cs: the network stack | in progress | [wp34](wp34-hosting-cs.md) |
| 35 | The capability report | landed | [wp35](wp35-capabilities.md) |
| 36 | The capability policy | landed | [wp36](wp36-capability-policy.md) |
| 37 | The OS sandbox | proposed; no note yet | — |

A package's plan said where its work would be done, which for everything up
to WP19 was often stage0's `src/`, the TypeScript compiler R6 deleted. Each
piece now lives in `src/`.

## 6. Dependency graph and waves

The original cut forked like this, and every wave of it has landed:

```
WP-P ─┬─► WP0 ─────────────────────────────────────────┐
      ├─► WP1 ─┬─► WP2 ─┬─► WP4 ─┬─► WP6              │
      │        │        │        ├─► WP9 (needs 1,2,4)  │
      ├─► WP3 ─┘        │        │                      │
      ├─► WP5 ──────────┴─► WP8 ─┘                      │
      ├─► WP7                                           │
      ├─► WP10                                          │
      └─► WP11 (continuous) ◄───────────────────────────┘
```

Everything after it was cut as the work turned up and did not fork:
WP12 and WP13 need a working compiler rather than a construct, WP14 needs all
of it, WP16 to WP19 followed in order, and since then a package is one agent
at a time on whichever part of `src/` it touches. `src/` is the whole tree, so
two packages that edit the checker do not run in parallel.

## 7. Conventions for every agent

1. Work on a branch off `main` and open a pull request into it.
   [AGENTS.md](../AGENTS.md#shipping-a-change-what-a-pull-request-must-be-and-who-merges-it)
   says what a pull request must be and who merges it.
2. `npm run check` and an undegraded `npm test` must be green, and every new
   construct needs: a golden `.ll`, an `llvm-as` pass, a native round trip
   with expected stdout, and at least one negative test. Run
   `opt -passes=verify` on every emitted module.
2a. There is one compiler, so a construct is implemented once, in `src/`
   ([ARCHITECTURE.md](ARCHITECTURE.md), "How to add a construct"). Under the
   rolling freeze `src/` may not *use* it in its own source until the seed
   compiles it, which is the next release; CI's `bootstrap` job, which builds
   stage1 from the released seed, is what checks that. A new diagnostic is an
   entry added by hand to `src/codes.ts` with the next free number in its
   band, never a renumbered or reused one, and it needs a case that *reaches
   its words* (`tests/diagnostic-coverage.js`, inside `npm test`), not only a
   code.
3. Do not emit an attribute you cannot cite a checker proof for. Write the
   reason in `src/attributes.ts` alongside the code.
4. Any change to a struct layout touches `src/runtime.ts` and the C runtime in
   the same commit and adds or extends a layout smoke test.
5. Keep every runtime translation unit within its ceiling (§2). Report the
   size of whichever you changed in the pull request.
6. Update `docs/LANGUAGE.md` and the IR cookbook for what you added. The
   cookbook is regenerated by `docs/cookbook/regen.sh` against `build/nish`,
   so its entry lands with the construct.
7. Commit messages follow the convention in `CLAUDE.md`: a conventional
   subject and a body in prose, because `scripts/changelog-gen.mjs` writes
   `CHANGELOG.md` from them and nothing edits it by hand. No model names in
   commits, code, or pull request text.
8. Never widen scope into another package's files; leave a TODO referencing
   the WP number instead.

## 8. Agent brief template

```
You are implementing <WP-N: title> for Nish, a TypeScript-to-LLVM-IR AOT
compiler. The compiler is src/, written in Nish and built by the last
released nish (the seed): `npm run build` leaves build/nish. Read
.claude/orientation.md, .claude/selfhost.md, docs/MASTER_PLAN.md (§2 design
rules, §7 conventions), docs/ARCHITECTURE.md and the package's note
docs/wp<N>-*.md first. Run `npm test` before changing anything.

Scope: <the note's stage being built>.
Out of scope: <neighbouring packages>.

Definition of done:
- <acceptance criteria from the note>
- `npm run check` and an undegraded `npm test` green, new goldens under
  tests/cases/, docs updated.
- src/ does not use the new construct in its own source until the next
  release (the rolling freeze).
- A pull request into `main` with the IR for each new construct shown in its
  body.

Show the exact LLVM IR for every TypeScript snippet you add to the tests.
```

## 9. Milestones

| Milestone | Contents | Proof | State |
| --- | --- | --- | --- |
| M1 "Programs" | WP-P, WP0, WP1, WP3, WP5, WP10 | fib/gcd/string CLI builds with `nish --link`, under 20 KB. | done |
| M2 "Data" | WP2, WP4, WP7 | nbody with structs and arrays, matches C output bit for bit. | done |
| M3 "Rust parity" | WP6, WP9, WP8 | benchmark table within 10 % of Rust; wasm and N-API demos. | done as a package; [BENCHMARKS.md](BENCHMARKS.md) has the current table and [wp9-optimisation.md](wp9-optimisation.md#summary) the analysis of every gap |
| M4 "1.0" | stabilised spec | tagged release, language reference frozen. | **not scheduled.** The project stays on 0.x until its owner declares 1.0 — see [What remains](#what-remains) |
| M5 "Self-hosting" | WP14 | `src/` compiles `src/`, and stage3 is byte-identical to stage2 (`tests/self/bootstrap.js`). | done |
| M6 "One compiler" | WP19 | stage0 deleted rather than frozen, after the six gates of [wp19 §3](wp19-stage0-retirement.md) closed: parity, oracle succession, the seed protocol, the seed policy, distribution without Node, and the provenance tag. | **done** in #150 ([wp19 §5](wp19-stage0-retirement.md#5-order)), first released in 0.7.0. Each stage0 oracle has a successor that runs without it: `tests/self/goldens/`, the `.ll` goldens, and `tests/nish-cmp.js` against the last release. |

### What remains

**Nish stays on 0.x until its owner declares 1.0, and no date is set.** Until
then a release may change the language, and a break moves the minor. The rule
for after 1.0 is written at the head of [LANGUAGE.md](LANGUAGE.md) so that it
is not invented under pressure: a minor may add a rule or turn a refusal into
an acceptance, and withdrawing or narrowing an accepted construct, or changing
what one means, needs a major. The changelog generator never computes 1.0.0 on
its own; when 1.0 is declared it is chosen with a `Release-As:` trailer,
which `scripts/changelog-gen.mjs` has honoured since
[#200](https://github.com/amritk/nish/pull/200), followed by the Release PR,
which a human merges.

Breaking changes taken while a break is still a minor: the reserved name
`integer` (0.10.0, [#201](https://github.com/amritk/nish/pull/201)), which let
ranged integers land in 0.13.0 without breaking anything; a module is its
real path and a package its real directory (0.10.0,
[#202](https://github.com/amritk/nish/pull/202)); `Secret<T>`
([#418](https://github.com/amritk/nish/pull/418)); and signed overflow as a
checked panic ([#426](https://github.com/amritk/nish/pull/426)).

**The WP15 list is closed.** Every item landed, was closed by measurement
(item 3, slice iterators: a `for...of` loop and the checked indexed loop
already compile to identical binaries) or was closed by decision (item 7's
class elements: an array of classes is one pointer per slot, and the
contiguous shape is spelled `interface`). Item 1b, the invariant array header,
shipped as an emitter hoist (#104) and property-path length facts (#179) after
`!invariant.load` was refuted as a miscompile.
[wp15-performance.md](wp15-performance.md) §9 is the record, and
[BENCHMARKS.md](BENCHMARKS.md), regenerated by `node bench/run.mjs`, is the only
place the numbers are current.

**One language question is open: WP22 stage D.**
[wp22-arrow-functions.md](wp22-arrow-functions.md) made arrows the declaration
form and `src/` is arrows, and stage D would reject a `function` definition.
That withdraws an accepted construct: on 0.x a breaking minor, after 1.0 a
major. Whether it happens at all is still wp22 §10's open question.

#### Next

1. **WP34, hosting cs** ([wp34-hosting-cs.md](wp34-hosting-cs.md)): the port
   of a browser game and its servers, starting with its Rust relay on a Nish
   network stack. Built: the compiler items N1, N2, N3, N5 and N6, every
   cryptography lane K1 to K6, TLS 1.3 (T1, T2) and QUIC (Q1, Q2); HTTP/1.1
   and WebSocket parsing (H1) and HPACK (H2) are half built. Next are the
   HTTP/1.1 server, HTTP/2 frames and streams, QUIC Q3 and Q4, HTTP/3 and
   WebTransport, and moving the key-holding structs onto `nish:secret`
   ([#430](https://github.com/amritk/nish/issues/430)). §5 of the note has the
   lane table and the order.
2. **WP33 R3 and R4, the round trip** ([wp33-round-trip.md](wp33-round-trip.md)):
   R1 (the `portability` class behind `--warn-portability`) and R2 (the
   typed-array names lose `push` and `pop`) are built, and so is R5's exact
   half, `nish --fix`. Next are R3, the runtime split by host, and R4,
   `--emit ts` with its live differential. Its rule binds now: every construct
   states its TypeScript reading, and no stage moves a `.ll` golden or raises
   `bench/instructions.json`.
3. **Threads P3, a lock that owns its data** ([wp29-thread-surface.md](wp29-thread-surface.md)
   §4.3), proposed. P1 (`parallelMapInto`, `parallelReduce`, 0.11.0) and P2
   (`using s = scope()`, 0.13.0) are built.
4. **WP37, the OS sandbox**: `--sandbox` has the native main wrapper confine
   the process with Landlock and seccomp to the capabilities the compiler
   computed, and accepts the `fs.read=<dir>` scopes WP36 refuses. WP35, the
   capability report ([wp35-capabilities.md](wp35-capabilities.md)), and
   WP36, the compile-time policy
   ([wp36-capability-policy.md](wp36-capability-policy.md)), are built.

#### Additive and unscheduled

- **WP21 S3's last two items**: a builtin the target has no runtime for, and a
  compile error attributed to a dependency rather than to its consumer. Each
  is a diagnostic for a program that already fails, so neither withdraws
  anything. S4's build cache and S5's prebuilt distribution follow them
  ([wp21-packages.md](wp21-packages.md) §8).
- **Compatibility mode** ([wp28-compatibility-mode.md](wp28-compatibility-mode.md)),
  proposed and unbuilt. It may only add acceptance, behind a flag, and strict
  does not grow, so it fits a minor.
- **WP27's later stages**, calling C beyond scalars and opaque pointers
  ([wp27-ffi.md](wp27-ffi.md)).

#### Settled, with the note that settles it

- **`async`/`await` is refused** ([wp24-async.md](wp24-async.md)): there is
  nothing in either runtime to wait for. The one item it recommended,
  `--emit-napi-async`, is built.
- **Inheritance is removed** and `implements` is a field prefix
  ([wp25-inheritance.md](wp25-inheritance.md)).
- **The rest of the surface a corpus review asked for** is answered row by row
  in [wp23-language-surface.md](wp23-language-surface.md): aliases, `enum` and
  `Pair<A, B>` landed, module-level mutable state is *no*, and `?.`, a string
  `switch` and `for...of` over a string are declined.
