---
name: WP38 S3 — nish:simd, fixed-width portable vectors, built and measured against its bar
overview: The owner decided on 2026-10-30 to build S3 (docs/wp38-simd.md §3.2, §7, §8 Q10), since S3a's C vector forms cleared 1.5x on both bar kernels. This run records the decision and the surface, then builds nish:simd in two src/ stages (the value types with load, store and lanes; then the operations and masks), and finally writes S3a's two kernels with it and measures them against S3's bar. It also closes WP38's open housekeeping and #662.
stages:
  - id: s3-record
    title: "docs(wp38): record S3's decision and surface, and close the open WP38 housekeeping"
    goal: docs/wp38-simd.md carries Q10 as decided, S3's surface as this plan pins it (§3.2 updated, the u16x8 deviation explained), a current Status line, S1b's disposition, and #662's two criteria accepted as shipped; the stale stage statuses in the earlier WP38 plan files are corrected
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: r-q10
        content: Add Q10 to §8 (S3 — build on S3a's figures / decline; decided 2026-10-30, build) and rewrite §7's S3 row and the S3 paragraphs to "decided, being built" — see Record
      - id: r-surface
        content: Rewrite §3.2's type and operation lists to the surface pinned in this plan (the six types with u16x8 in place of i16x8, the four mask types, the operation table), stating why each deviation from the old text was made — see Surface
      - id: r-status
        content: Rewrite the Status line at the top of docs/wp38-simd.md to the current state (S6a–S6d outcomes, S3a landed, S3 being built, tracking issue of this run) — see Record
      - id: r-s1b
        content: Record S1b as superseded by S6c (the classifier re-aimed at JsonTokenizer, measured not reachable by S6c's gate and S6d) in its §7 row and paragraph — see Record
      - id: r-plans
        content: Correct the stage statuses in .claude/plans/wp38-s3a-cpu-flag.plan.md (all three merged — #659, #658, #660) and .claude/plans/wp38-s6d-per-value-cuts.plan.md (cuts and regate not built, gate NOT REACHABLE) — see Record
      - id: r-662
        content: Record #662's resolution in the S3a/S2 plan file and §7 — criterion 1 is native-only (indexing is unchecked under Node by design), criterion 4 is accepted as shipped (a baseline report has no cpu key) — and put `Closes #662` in the PR body — see Record
  - id: s3-types
    title: "feat(checker): nish:simd's vector types, with load, store, splat and lanes"
    goal: A program can import the six vector types from nish:simd, build them with the type's constructor and splat, load and store them from and to arrays bounds-checked as a whole vector, read and replace a lane at a constant index, keep them in locals, fields and arrays (16-byte aligned, layout pinned), and run the same program natively, under --profile wasi and under Node with the same output; every refusal in the stage has a negative test
    verification: npm run check && npm run lint && node tests/run.js simd && node tests/run.js layout && node tests/run.js wasi && node tests/run.js performance
    status: pending
    todos:
      - id: t-module
        content: Register nish:simd in src/nish-modules.ts (isNishModule, nishModuleNames with its .err goldens, nishModuleExports, nishExport) and bind it in the checker as the other builtin modules are — see Types, The module
      - id: t-types
        content: Add the six vector types to src/types.ts (ids or a kind, llvmType <16 x i8>/<8 x i16>/<4 x i32>/<4 x float>/<2 x double>, alignOf 16, size 16, typeName) and spell them in src/annotations.ts only when imported from nish:simd — see Types, The types
      - id: t-layout
        content: Give vectors their layout in src/structs.ts and src/inline-arrays.ts (16-byte size and alignment as a field and as an array element) and pin it in tests/layout with _Static_asserts — see Types, Layout
      - id: t-ops
        content: Check and lower the stage's operations — the constructor, splat, load, store, extract and replace — with loads and stores bounds-checked once per vector (one nish_panic_index branch) and lane indices required to be constants in range — see Types, Operations
      - id: t-refuse
        content: Refuse, each with a code in src/codes.ts and a reject_* case — a vector in an exported, N-API, wasm or C-header signature; a vector as a Map key; Secret<vector>; == / != / < on vectors; a non-constant or out-of-range lane index; a vector of one lane type where another is expected; the global spelling without the import — see Types, Refusals
      - id: t-node
        content: Give nish:simd its Node reading in runtime/nish.mjs (a fresh typed array per value, never mutated; f32 lanes through Float32Array) and its declarations in runtime/nish.d.ts; make emit-ts import it from nish/runtime and export the names there — see Types, Under Node
      - id: t-tests
        content: Add tests/cases/simd_* positives with golden .ll (only target-independent IR), .out and a Node round trip each; register them with node tests/differential/goldens.js --update; a tests/run.js section named simd that builds one program natively, under --profile wasi and under Node and compares their output, and greps every simd .ll for llvm.x86. / llvm.aarch64. — see Types, Tests
      - id: t-docs
        content: Add the LANGUAGE.md rule (builtin module table row and a nish:simd section for this stage's surface), IR_COOKBOOK entries with the exact IR, docs/cookbook/simd-*.ts entries, the guide page docs/guide/language/simd.md with its scalar.config.json route, and the builtin-module rows in docs/guide/language/modules.md and .claude/selfhost.md — see Types, Docs
  - id: s3-ops
    title: "feat(checker): nish:simd's arithmetic, comparisons, masks and reductions"
    goal: nish:simd gains the four mask types and the rest of the pinned operation table — float arithmetic, wrapping integer arithmetic, bitwise operations, comparisons into masks, select, min and max, horizontal sums, shuffle, any, all, bitmask and bitcasts — each lowered to LLVM vector IR or a target-independent llvm.* intrinsic, with a golden, a native and Node round trip and a negative test, and masks refused anywhere they would need storage
    verification: npm run check && npm run lint && node tests/run.js simd && node tests/run.js wasi && node tests/run.js performance
    status: pending
    todos:
      - id: o-masks
        content: Add the four mask types (mask8x16, mask16x8, mask32x4, mask64x2) lowered as <N x i1> SSA values, allowed in locals, parameters and returns of unexported functions, refused as a field, array element, generic argument, Map key or exported type — see Operations, Masks
      - id: o-arith
        content: Add float add/sub/mul/div/neg/abs/sqrt, integer addWrapping/subWrapping/mulWrapping, and/or/xor/not on integer vectors and masks, and min/max on every lane type — see Operations, The table
      - id: o-compare
        content: Add eq/ne/lt/le/gt/ge into the lane width's mask (unsigned compares for u-lanes, ordered for floats), select, any, all and bitmask — see Operations, The table
      - id: o-reduce
        content: Add sum (u8x16 and u16x8 widened to i32 exactly; floats in lane order 0..N-1, matching Node) and sumWrapping (i32x4, u32x4), shuffle with constant indices, and the six asT bitcasts — see Operations, The table
      - id: o-tests
        content: One positive tests/cases/simd_op_* per operation family with golden .ll, .out and a Node round trip (float lanes checked bit for bit, NaN and -0 included), a reject_simd_* per rule, the differential goldens registered, and the simd section extended (no llvm.x86./llvm.aarch64. in any .ll) — see Operations, Tests
      - id: o-docs
        content: Extend the LANGUAGE.md nish:simd section, IR_COOKBOOK, docs/cookbook and docs/guide/language/simd.md with this stage's operations — see Operations, Docs
  - id: s3-bar
    title: "docs(wp38): S3's bar, measured with nish:simd"
    goal: S3a's two bar kernels are written in Nish with nish:simd and timed by bench/simd-s3a.mjs beside S3a's four forms in interleaved rounds on one machine; docs/wp38-simd.md §2.3 and §7 record the figures (min and median of at least seven runs, the noise band, the commit as a PR number) and whether nish:simd is at least 1.5x faster than scalar Nish checked on mat-vec and on both depth documents
    verification: npm run lint && node docs/check-links.mjs && node bench/simd-s3a.mjs --self --runs 15
    status: pending
    todos:
      - id: b-kernels
        content: Write bench/simd-s3a/mat-vec-simd.ts and depth-simd.ts with nish:simd, printing the same checksum as the other forms of their kernel — see Bar
      - id: b-harness
        content: Add the nish:simd form to bench/simd-s3a.mjs (built --profile speed, its .ll grepped for target intrinsics like the C vector forms, its checksum checked) — see Bar
      - id: b-record
        content: Run it and record the figures and the verdict in §2.3 (an S3 subsection beside S3a's) and §7's S3 row; on a miss, record by how much and what the IR shows, without changing the surface — see Bar
---

## Context

[docs/wp38-simd.md](../../docs/wp38-simd.md) §3.2 proposes `nish:simd`. §8 Q8
(2026-10-16) ordered S3a first and S3 to be decided on S3a's figures. S3a
(#658) put both bar kernels in C with portable `vector_size(16)` vectors and
measured 1.65x (mat-vec) and 1.81x / 3.51x (depth, dense and sparse) over
scalar Nish checked at the median. §2.3 then says "S3's design is written
next". On 2026-10-30 the owner decided to build S3. This plan pins the
surface so the human signs it off once. `s3-record` writes it into the note,
and the two `src/` stages build it.

Everything else in WP38 is settled: S0, S1 (kernel and surface), S2, S3a, S5,
S6a, S6b and S7 are landed. S4 is declined. S6c and S6d are measured and found
not reachable. S1b was never built. `s3-record` records it as superseded by
S6c. #662 holds the last run's two escalated criteria, and the owner accepted
both as shipped.

## Sign-off

The owner chose the scope on 2026-10-30: design, build and measure. They also
chose #662's resolution, which accepts both criteria as shipped. The owner
accepted the plan, its surface (u16x8 in place of i16x8, the four
value-only mask types, the operation table and what it leaves out) and its
nine acceptance criteria on 2026-10-30, with autonomous merge.

## Approach

- **One stage, one PR, one branch** `feature/wp38-s3-nish-simd/<stage-id>`.
- **The chain.** `s3-types` → `s3-ops` → `s3-bar` is sequential. Each stage
  consumes the previous one's surface, and types and operations together are
  too large for one review. `s3-record` touches no `src/` and runs beside
  `s3-types` from the start. `s3-bar` edits `docs/wp38-simd.md`, so it starts
  after `s3-record` merges.
- **The rolling freeze.** `src/` implements `nish:simd` and never imports it.
  `bootstrap` must stay green.
- **Generated goldens** (`tests/self/goldens/checked/**`,
  `tests/differential/goldens/**`, `tests/differential/emit-ts-known.txt`) are
  regenerated with the repo's tooling, never hand-merged. The emit-ts known
  list is regenerated only under the Node that `ci.yml` pins.
- **Other runs are in flight.** The hardware CRC-32 run (`crc32-hw`), the
  SHA-NI run (#1055) and the JSON Schema run (#1051 to #1054) all edit
  `tests/run.js`, `src/emit.ts`, `src/runtime.ts`, `src/kernels.ts`,
  `tests/self/goldens/**`, and some edit `docs/wp38-simd.md` (the S-row
  tables). A conflict there is resolved by keeping both sides' lines and
  regenerating the goldens, never by dropping another run's rows. No stage of
  this run edits `runtime/*.c`, `src/kernels.ts`, `std/compress/**` or
  `std/json*.ts`.

## Surface

The pinned surface. Every name below is an export of `nish:simd`, and nothing
else is exported.

**Types.** The six 128-bit vectors are `u8x16`, `u16x8`, `i32x4`, `u32x4`,
`f32x4` and `f64x2`. They lower to `<16 x i8>`, `<8 x i16>`, `<4 x i32>`,
`<4 x i32>`, `<4 x float>` and `<2 x double>`, each 16 bytes in size and
16-byte aligned. **`u16x8` replaces §3.2's `i16x8`**, because Nish has `u16`
and no `i16` scalar, so an `i16x8` lane would have no type to extract to.

**Masks.** The four mask types are `mask8x16`, `mask16x8`, `mask32x4` and
`mask64x2`, lowered as `<N x i1>`. They are values only: a mask may be a
local, a parameter or the return of an unexported function, and nothing
else. A comparison of `f32x4`, `i32x4` or `u32x4` gives `mask32x4`, and so on
by lane width. Keeping masks as their own types stops a mask of one width
from selecting lanes of another. It also gives LLVM `icmp`/`fcmp` → `select`
and `llvm.vector.reduce.or` directly, which become `pmovmskb` and `ptest` on
x86-64 and `umaxv` on AArch64 with no target intrinsic in the IR.

**Operations** are free functions. The type follows from the arguments, except
where none carries it.

| Family | Names | Lanes | Lowering |
| --- | --- | --- | --- |
| construct | `u8x16(a0..a15)`, `u16x8(..)`, `i32x4(..)`, `u32x4(..)`, `f32x4(..)`, `f64x2(..)` (each a function named after its type) | per type | `insertelement` chain, or a constant vector |
| splat | `splatU8x16(x)` … `splatF64x2(x)` | per type | `insertelement` + `shufflevector` zeroinitializer |
| load / store | `loadU8x16(xs: u8[], i)` … `loadF64x2(xs: f64[], i)`, `store(v, xs, i)` | element array of the lane type | one bounds check `i >= 0 && i <= len - N`, then an `align 1` vector load/store |
| lanes | `extract(v, k)`, `replace(v, k, x)` | all | `extractelement` / `insertelement`; `k` a constant in `0..N-1` |
| float arithmetic | `add`, `sub`, `mul`, `div`, `neg`, `abs`, `sqrt` | f32x4, f64x2 | `fadd` … `llvm.fabs`, `llvm.sqrt`; no `fast` flags, no contraction |
| integer arithmetic | `addWrapping`, `subWrapping`, `mulWrapping` | integer vectors | `add`/`sub`/`mul`, no `nsw`/`nuw` |
| bitwise | `and`, `or`, `xor`, `not` | integer vectors and masks | `and`/`or`/`xor`, `xor` with all-ones |
| min / max | `min`, `max` | all | `llvm.umin`/`smin`/`umax`/`smax`; floats `llvm.minimum`/`maximum` (NaN-propagating, -0 < +0, which is JS `Math.min`) |
| compare | `eq`, `ne`, `lt`, `le`, `gt`, `ge` | all → mask | `icmp` (unsigned for `u*`), `fcmp` ordered (`une` for `ne`) |
| select | `select(m, a, b)` | mask of the lane width | `select` |
| any / all | `any(m)`, `all(m)` | masks → `boolean` | `llvm.vector.reduce.or` / `.and` on `<N x i1>` |
| bitmask | `bitmask(m)` | masks → `i32` | `bitcast <N x i1>` to `iN`, `zext` to `i32` |
| sums | `sum(v)` for `u8x16` and `u16x8` → `i32`, exact; `sum(v)` for floats → the lane type, in order 0..N-1; `sumWrapping(v)` for `i32x4` → `i32`, `u32x4` → `u32` | as listed | `zext` + `llvm.vector.reduce.add`; floats `llvm.vector.reduce.fadd` with no `reassoc` |
| shuffle | `shuffle(a, b, i0, …, iN-1)` | all; indices constants in `0..2N-1` | `shufflevector` |
| bitcast | `asU8x16(v)`, `asU16x8`, `asI32x4`, `asU32x4`, `asF32x4`, `asF64x2` | any vector | `bitcast` |

Left out, and recorded as later work in §3.2: conversions between lane types
(`sitofp` and the like), shifts, saturating arithmetic, widening multiplies,
256-bit vectors (Q4) and `Secret<vector>` (§6).

**Under Node** a vector is a fresh typed array of its lanes (`Uint8Array(16)`
… `Float64Array(2)`) that no operation mutates. `f32` lanes round through
`Float32Array` and integer lanes wrap through their array type, as scalar
`f32` and `wrappingAdd` do (class A, no ledger row). Masks are arrays of
`boolean`. `nish.d.ts` declares each type as an opaque branded interface, so
`a + b` stays a TypeScript error.

## Record

`s3-record` owns `docs/wp38-simd.md`, `.claude/plans/wp38-s3a-cpu-flag.plan.md`,
and `.claude/plans/wp38-s6d-per-value-cuts.plan.md`. It writes no code.

- **§8 Q10.** Question: "S3, `nish:simd`, on S3a's figures". Options: build it
  with §3.2's surface; decline it into §9. Decided 2026-10-30: build it with
  the surface in §3.2 as revised. Reason: both bar kernels cleared 1.5x in
  S3a, and the byte half is not reachable by S6c's runtime classifier.
- **Status line.** Rewrite it to say what is true now: the landed stages, S4
  declined, S6c and S6d not reachable, S3 decided and being built (link this
  run's tracking issue), and S1b superseded.
- **S1b.** In §7, S1b's row and paragraph say it is superseded by S6c, which
  re-aimed the same classifier at `JsonTokenizer` and found it not reachable
  (S6c's gate, S6d). So it is not built.
- **#662.** Criterion 1 holds natively only. `runtime/nish.mjs` does not check
  indexing, so the record says "natively". For criterion 4, the shipped form
  stands: a baseline capability report has no `cpu` key, as `LANGUAGE.md`
  says. Record both in the S3a/S2 plan file's Sign-off, mention them in §7,
  and close the issue from the PR.
- **Anchors.** Where §2.3 or §7 cites a pre-squash SHA that main cannot reach
  (`46a1e4d`, `d835d40`), add the PR number beside it (#658, #660).

## Types

`s3-types`. **Owns:** `src/nish-modules.ts`, `src/types.ts`,
`src/annotations.ts`, `src/structs.ts`, `src/inline-arrays.ts`,
`src/checker.ts`, `src/expressions.ts`, `src/builtins.ts`, `src/program.ts`,
`src/generics.ts`, `src/members.ts`, `src/constants.ts`, `src/panics.ts`,
`src/attributes.ts`, `src/capabilities.ts`, `src/codes.ts`, `src/debug.ts`,
`src/tbaa.ts`, `src/ir.ts`, `src/emit.ts`, `src/emit-*.ts`, `src/interop-*.ts`,
`src/secret.ts`, `src/declarations.ts`, `src/compilation.ts`, `src/dump.ts`,
`src/simd.ts` (new, if the checker and lowering want one home), `runtime/nish.mjs`,
`runtime/core.mjs`, `runtime/nish.d.ts`, `runtime/core.d.ts`, `tests/cases/simd_*`,
`tests/cases/reject_simd_*`, `tests/cases/reject_nish_unknown_module*`,
`tests/cases/*.err` (only the module-list line `nishModuleNames` moves),
`tests/layout/**`, `tests/link/simd_*/**`, `tests/emit-ts/**`, `tests/run.js`,
`tests/differential/**`, `tests/self/goldens/**`, `docs/LANGUAGE.md`,
`docs/IR_COOKBOOK.md`, `docs/cookbook/simd-*.ts`, `docs/guide/language/simd.md`,
`docs/guide/language/modules.md`, `docs/guide/language/types.md`,
`scalar.config.json`, `docs/RUN_UNDER_NODE.md`, `.claude/selfhost.md`.

- **The module.** `nish:simd` is a builtin module, but unlike `nish:unsafe`
  its names are not renames of globals. The global spelling of a `nish:simd`
  name does not exist. A worker that wants a `std/simd.ts` source-backed
  module (as `nish:secret` has) must say why in the PR body, because the types
  are compiler types and not classes.
- **The types.** A vector is a value type, copied by value like an `f64`. It
  may be a field, an array element (`f32x4[]`), a generic argument, a local, a
  parameter or a return.
- **Layout.** The size and alignment are both 16, as a field and as an array
  element. `tests/layout` pins `sizeof` and `_Alignof` of a struct holding
  one, and the stride of an array of them, against the C `__attribute__((vector_size(16)))`
  equivalent.
- **Operations.** This stage covers construct, splat, load, store, extract and
  replace. A load or store of `N` lanes checks `i >= 0 && i <= len - N` once
  and panics with the existing `index out of range` message. A lane index must
  be a constant expression in range, or the program is refused.
- **Refusals**, each with a code and a `reject_simd_*` case:
  - a vector in an exported, N-API, wasm or C-header signature (follow
    `wasmSkipReason`'s pattern)
  - a vector as a `Map` key
  - `Secret<vector>`
  - `==`, `!=`, `<` and the other relational operators on vectors
  - a non-constant or out-of-range lane index
  - one lane type where another is expected
  - a `nish:simd` name used without its import
- **Under Node.** See Surface. `emit-ts` maps the import to `nish/runtime`, as
  it does for the other builtin modules, so the runtime exports the names.
- **Tests.** Each positive `tests/cases/simd_*.ts` gets a golden `.ll`, a
  `.out` and a Node round trip. A `tests/run.js` section named `simd` builds
  one program natively, with `--profile wasi` (it skips when no WASI sysroot
  is present, and says so) and under Node, then compares the outputs. It also
  greps every `simd_*.ll` for `llvm.x86.` and `llvm.aarch64.`. The goldens of
  programs that do not import `nish:simd` do not move, apart from the module
  list in the unknown-module diagnostic. Show the exact IR in the PR body for
  every snippet added.
- **Docs.** A `LANGUAGE.md` rule, a guide page and a route, an `IR_COOKBOOK`
  entry and cookbook files (the construct checklist in `docs/ARCHITECTURE.md`).

## Operations

`s3-ops`. Starts after `s3-types` merges, and owns the same globs.

- **Masks.** See Surface. A mask in a field, an array, a generic argument, a
  `Map` key or an exported signature is refused, each with a negative test.
- **The table.** Lower each operation in Surface exactly as written. Integer
  `min`/`max`/compare are signed for `i32x4` and unsigned for every `u*`
  type. Float `min`/`max` use `llvm.minimum`/`llvm.maximum`, so a NaN lane
  stays NaN and -0 counts as less than +0, which matches `Math.min` and
  `Math.max` under Node. Float `sum` reduces sequentially in lane order with
  no `reassoc`, which is what Node computes.
- **Tests.** Write one positive per family, each with a golden, a `.out` and a
  Node round trip. Float lanes are compared bit for bit, with NaN, -0, the
  infinities and a subnormal included. The `simd` section's intrinsic grep
  covers the new goldens.
- **Docs.** Extend this stage's pages and entries.

## Bar

`s3-bar`. Starts after `s3-ops` and `s3-record` merge. **Owns:**
`bench/simd-s3a/**`, `bench/simd-s3a.mjs`, `docs/wp38-simd.md`.

- The two kernels do S3a's work: mat-vec, and depth counting on S3a's two
  documents. Each prints the same checksum as that kernel's other forms.
- The harness adds the form beside S3a's four, in interleaved rounds. The new
  form is built `--profile speed` at the default target, and its `.ll` is
  refused if it holds a target intrinsic.
- The bar is §7's for S3: at least 1.5x over scalar Nish, checked (S3a's form
  3), at the median, outside the noise band, on mat-vec and on both depth
  documents. Record the min and median of at least 7 rounds, the noise band,
  the machine, clang's version and the commit (cite the PR number, not a
  branch SHA).
- **On a miss**, record the figures and what the optimised IR shows against
  the C vector form, and stop there. The surface stays. Whether to change it
  is the owner's decision.

## Verification

Every stage runs `npm run check`, `npm run lint` and the targeted
`node tests/run.js` sections in its `verification` line. `src/` stages also
run `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`, reading the skip line)
and `node tests/run.js performance`, regenerate and read the goldens, and leave
`node bench/run.mjs --instructions --check` passing with
`bench/instructions.json` unchanged. The full suite is CI's four shards plus
`bootstrap`, all green on the head.

## Out of scope

- `src/` using `nish:simd` (the rolling freeze).
- `std/` modules rewritten onto it (`std/json*`, `std/crypto/*`). Each would
  be its own measured stage.
- The operations listed as left out under Surface, the AArch64 measurement,
  and `-msimd128` as a default for wasi.
