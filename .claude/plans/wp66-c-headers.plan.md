---
name: WP66 S2–S7 — C libraries from their headers
overview: Build the rest of WP66 on top of S1 (zeroext, merged in #1758) — the `nish c-import` generator, opaque classes, fixed-length array fields, buffers paired with a count by name, and packages that link C — then teach the generator the three new spellings and re-measure §4. S6 (callbacks) stays an open question and is not built.
stages:
  - id: s2-c-import
    title: "feat(cli): nish c-import writes a Nish module from a C header"
    goal: A header read through clang becomes a checked-in Nish module of declare functions, declare classes, out classes and constants, with an override file and a not-bound report, using only today's language
    verification: npm run check && npm run lint && node tests/run.js c-import && node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check
    todos:
      - id: s2-ast-reader
        content: Add src/c-import.ts — run clang -ast-dump=json for --target, walk the AST with std/json, map types per §6.1–§6.4 — see S2 the generator
        status: pending
      - id: s2-constants
        content: Evaluate object-like macros through clang (§4.3) into export consts with §6.5 types — see S2 the generator
        status: pending
      - id: s2-overrides
        content: Read the §7 override file (allow, per-parameter roles, return nonnull/owned/nullable); a name not in the header is a diagnostic — see S2 the generator
        status: pending
      - id: s2-report
        content: Emit the header comment (source, target triple, data model, regeneration command) and the Not bound block in header order — see S2 the generator
        status: pending
      - id: s2-data-model
        content: Refuse a generated module under a target of another data model with a diagnostic naming the regeneration command (D3) — see S2 the generator
        status: pending
      - id: s2-cli
        content: Wire the c-import subcommand into src/compile.ts and its --help text in src/cli-style.ts — see S2 the generator
        status: pending
      - id: s2-tests
        content: Add tests/c-import/ golden headers with regenerated expected modules, a sqlite3.h round trip opening a database through sqlite3_open with an out class, and link negatives for each new code — see Tests
        status: pending
      - id: s2-docs
        content: Add the guide page, its route, the docs/security/c-import.md record and index row, and tick S1 and S2 on the roadmap page — see S2 the generator
        status: pending
  - id: s3-opaque
    title: "feat(checker): opaque declare classes C can return"
    goal: A field-less declare class is opaque — no new, returnable from a declare function as S or S | null, held in locals under CPtr's placement rule, lowered as CPtr — so one C pointer type is not passed where another is wanted
    verification: npm run check && npm run lint && node tests/run.js opaque && node tests/run.js ffi && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s3-checker
        content: Classify a field-less declare class as opaque and enforce its rules (no new, CPtr placement, distinct nominal type) — see S3 opaque classes
        status: pending
      - id: s3-emit
        content: Lower an opaque class as CPtr in parameters, results and locals — see S3 opaque classes
        status: pending
      - id: s3-construct
        content: Ship the construct checklist — golden .ll, llvm-as, native round trip, negatives, LANGUAGE.md rule, cookbook entry, guide section; tick S3 — see S3 opaque classes
        status: pending
  - id: s5-buffer-count
    title: "feat(checker): pair a C buffer with its count by name, at any unsigned width"
    goal: A declaration names a buffer's count parameter, of any unsigned width or as an out class's field, and the call keeps WP53's check — compared with the buffer's length before C runs and proved away where it is the buffer's own length
    verification: npm run check && npm run lint && node tests/run.js ffi-buffer && node tests/run.js ffi && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s5-spelling
        content: Choose and implement the spelling that names a buffer's count parameter, recorded in LANGUAGE.md — see S5 buffers paired by name
        status: pending
      - id: s5-check
        content: Emit the length check for u8/u16/u32/u64 and out-class counts and let the prover discharge it when the count is the buffer's length — see S5 buffers paired by name
        status: pending
      - id: s5-construct
        content: Ship the construct checklist — golden .ll, llvm-as, native round trip against a zlib-style uInt count, negatives, cookbook, guide section; tick S5 — see S5 buffers paired by name
        status: pending
  - id: s7-package-link
    title: "feat(cli): a package links a C library or its own C sources"
    goal: A package.json nish.link names libraries and C sources; nish run and --link pass -l and compile the sources beside the runtime, a dependency's link waits for the root's grant, and SQLite's symbol rule becomes one entry of the mechanism
    verification: npm run check && npm run lint && node tests/run.js link && node tests/run.js manifest && node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs
    todos:
      - id: s7-manifest
        content: Read nish.link from package.json in src/manifest.ts, failing closed on any key it does not know — see S7 package linking
        status: pending
      - id: s7-build
        content: Pass -l and compile link sources under nish run and --link, keyed into the run cache, and fold the SQLite prefix rule into the mechanism — see S7 package linking
        status: pending
      - id: s7-grant
        content: Make a dependency's link a grant the root package must give, under the WP40 grant rules — see S7 package linking
        status: pending
      - id: s7-docs
        content: Add the security record and index row, the guide section, and tick S7 — see S7 package linking
        status: pending
  - id: s4-array-fields
    title: "feat(checker): fixed-length array fields in a declare class"
    goal: A declare class field may be a fixed-length array laid out inline as C lays out unsigned h[5], read and written by index, so SHA_CTX-style structs bind
    verification: npm run check && npm run lint && node tests/run.js ffi-struct && node tests/run.js ffi && node tests/run.js layout && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s4-spelling
        content: Choose and implement the spelling of a fixed-length array field, recorded in LANGUAGE.md — see S4 fixed-length array fields
        status: pending
      - id: s4-layout
        content: Lay the field out inline with C's size and alignment, index it with a bounds check the prover can discharge for constant indices — see S4 fixed-length array fields
        status: pending
      - id: s4-construct
        content: Ship the construct checklist — golden .ll, llvm-as, native round trip against a C struct, negatives (union still refused), cookbook, guide section; tick S4 — see S4 fixed-length array fields
        status: pending
  - id: s8-generator-uses-new-types
    title: "feat(cli): nish c-import emits opaque classes, array fields and named buffer pairs"
    goal: The generator uses S3, S4 and S5, and §4's four-header table is re-measured and recorded
    verification: npm run check && npm run lint && node tests/run.js c-import && node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs
    todos:
      - id: s8-emit
        content: Emit one opaque class per opaque struct, array fields for fixed-length array members, and a buffer override with any count width — see S8 generator uses the new types
        status: pending
      - id: s8-measure
        content: Re-run the four headers of §4 and record the moved counts in docs/wp66-c-headers.md — see S8 generator uses the new types
        status: pending
---

## Context

WP66 ([design note](../../docs/wp66-c-headers.md), [roadmap](../../docs/roadmap/wp66-c-headers.md)) replaces hand-typed `declare function`s with a generator that reads a C header through clang, and widens the boundary where the generator shows the language cannot yet say what a header says. S1 (`zeroext` on narrow foreign parameters) is merged as #1758; the roadmap page still reads 0 of 7, so S2 ticks S1 too. S6 (callbacks) is an open question for the owner and is **not** in this run.

## Owner decisions taken as recommended (§9)

| | Decision |
| --- | --- |
| D1 | The subcommand is `nish c-import`. |
| D2 | It lives in `src/`, in Nish under the rolling freeze, reading clang's JSON with `std/json`. |
| D3 | The generated header comment records the data model; a build whose target has another refuses the module with a diagnostic naming the regeneration command. |
| D4 | No `i8`/`i16`: functions using `signed char` or `short` are listed as not bound. |
| D5 | A field-less `declare class` becomes opaque (owner, at sign-off). No new marker. |
| D6 | `nish.link` takes `libraries` (`-l`) and `sources` (compiled with clang beside the runtime); no `pkg-config` (owner, at sign-off). |
| D7 | `std/sqlite.ts` is **not** regenerated in this run; it is a follow-up once S6 exists. |

## Concurrency and shared files

S2, S3, S5 and S7 start together (max 4); S4 starts when the first slot frees; S8 starts when S2, S3, S4 and S5 have merged. S3, S4 and S5 all change the checker and emitter for `declare class`/`declare function`, so their `src/` lanes overlap by necessity; every `src/` PR also changes the generated goldens, so each updates from `main` before it merges anyway (merge-gate rule 3). Merge order among the language stages is S3 → S5 → S4; the later PR's worker resolves conflicts at its update.

**Shared registries** — any stage may edit these, only to add or change its own entries (a new code at the end of its band, its test registration, its `DECLARED` entries, its rule section, its route, its index row, its roadmap box): `src/codes.ts`, `tests/run.js`, `tests/nish-cmp.js`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/guide/using-nish/interop.md`, `docs/guide/using-nish/cli.md`, `scalar.config.json`, `docs/security/README.md`, `docs/roadmap/wp66-c-headers.md`, `docs/roadmap/index.md`, `src/compile.ts` (S2: the subcommand dispatch only; S7: linking), `src/cli-style.ts`.

**Language `src/` lane** (S3, S4, S5): `src/checker.ts`, `src/declarations.ts`, `src/structs.ts`, `src/members.ts`, `src/expressions.ts`, `src/statements.ts`, `src/types.ts`, `src/program.ts`, `src/handles.ts`, `src/bounds.ts`, `src/attributes.ts`, `src/escape.ts`, `src/panics.ts`, `src/tbaa.ts`, `src/debug.ts`, `src/emit*.ts`, `src/interop-*.ts`, `src/runtime.ts`.

**Generated** (regenerated with the repo's tooling, never hand-merged): `tests/self/goldens/checked/**`, `tests/differential/goldens*`, `tests/differential/emit-ts-known.txt`, `tests/cases/*.ll`, `docs/reference/**`, `tests/shard-costs.json`, `tests/c-import/**/*.expected.ts`.

## S2 the generator

**Owns:** `src/c-import*.ts` (new), `src/compilation.ts` (the D3 data-model refusal only), `tests/c-import/**` (new), `tests/cases/c_import_*`, `tests/link/c_import_*/**`, `docs/guide/using-nish/c-import.md` (new), `docs/security/c-import.md` (new), plus the shared registries.

§5–§7 of the note, against today's language only (§2.1): a `CPtr` wherever S3–S5 would give a better type. clang is run with an argument vector, never a shell; its stdout is the only input parsed; nothing generated runs. A function is either bound or listed under `Not bound:` with its reason — never dropped silently. The generated module is ordinary source the user checks in; it carries the `ffi` capability unchanged. The sqlite3.h AST size is measured and recorded in the security record (§9 D2 asks for it). No `std/` edits: if `std/json` lacks something, the worker works around it in `src/c-import*.ts` or stops and says so in a draft PR.

## S3 opaque classes

**Owns:** the language `src/` lane, `tests/cases/ffi_opaque_*`, `tests/link/ffi_opaque_*/**`, `tests/ffi-handle.js`, plus the shared registries.

§8 S3, with the D5 answer from sign-off. `new` of an opaque class, a field on it, storing it outside CPtr's placement (WP27 §7b), and passing one opaque type where another is wanted are each a diagnostic with a `tests/link` negative.

## S5 buffers paired by name

**Owns:** the language `src/` lane, `tests/cases/ffi_buffer_*`, `tests/link/ffi_buffer_*/**`, `tests/ffi-buffer.js`, plus the shared registries.

§8 S5. WP53's adjacent-`u64` rule keeps compiling unchanged. The new form names its count; the count may be `u8`, `u16`, `u32`, `u64` or a field of an out class (`compress`'s `uLongf *destLen`). A narrowing count whose buffer length does not fit is refused at the call before C runs, as WP53 refuses a mismatch; the prover removes the check where the count is the buffer's own length. No new NL9007 in `src/`.

## S7 package linking

**Owns:** `src/manifest.ts`, `src/run-cache.ts`, `src/capability-*.ts`, `scripts/build.sh`, `tests/package-link/**` (new), `tests/link/pkg_link_*/**`, `docs/security/package-link.md` (new), `docs/security/supply-chain.md`, `docs/guide/language/modules.md`, plus the shared registries.

§8 S7 with the D6 answer from sign-off. `nish.link` is parsed with an allowlist: any key it does not know, or cannot parse, is a grant the user is asked about (fail closed, CLAUDE.md "Code that decides what a package may grant"). A dependency's `link` takes effect only once the root grants it. The run cache key includes the link set. SQLite's `sqlite3_`/`nishsqlite_` rule becomes one entry of the mechanism without changing what `std/sqlite.ts` users see.

## S4 fixed-length array fields

**Owns:** the language `src/` lane, `tests/cases/ffi_array_field*`, `tests/link/ffi_array_field*/**`, `tests/ffi-struct.js`, `tests/layout/**`, `runtime/nish.h`, plus the shared registries.

§8 S4; the spelling is the stage's to choose and record in LANGUAGE.md with the reason. Unions and bitfields stay refused.

## S8 generator uses the new types

**Owns:** `src/c-import*.ts`, `tests/c-import/**`, `tests/cases/c_import_*`, `docs/guide/using-nish/c-import.md`, `docs/security/c-import.md`, `docs/wp66-c-headers.md`, plus the shared registries.

Depends on S2, S3, S4, S5 merged (it cannot be written before). Re-runs §4's four headers (sqlite3.h vendored; zlib.h, png.h, openssl/sha.h where installed, naming any that were not) and records the moved counts per the note's §11.

## Out of scope

S6 (callbacks, `SQLITE_TRANSIENT`), regenerating `std/sqlite.ts` (D7), `i8`/`i16` (D4), variadics, function-like macros, unions, bitfields, `long double`, C++ headers, a compile-time `import` of a header.

## Tests

Mirror `tests/ffi-abi.js`, `tests/ffi-buffer.js`, `tests/ffi-struct.js`, `tests/ffi-handle.js` and the `tests/cases/ffi_narrow_zeroext.*` round trip from #1758. Every new diagnostic code lands with a `tests/link` negative (`expected.err`). Every TypeScript snippet a PR adds to the tests shows its exact LLVM IR in the PR body.

## Verification

Each stage's `verification` line, plus CLAUDE.md's definition of done: CI's eight `test` shards are the full-suite gate; `nish-cmp` `DECLARED` entries for any corpus IR move; goldens regenerated with `node tests/self/goldens.js --update`; `node scripts/gen-reference.mjs` after a `docs/LANGUAGE.md` change.
