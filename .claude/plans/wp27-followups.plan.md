---
name: WP27 follow-ups (#1498)
overview: Close the two follow-ups #1498 records after WP27 (Calling C) landed. Pin `getrlimit` through a `declare class Rlimit` against what `ulimit -Sn` / `ulimit -Hn` report in the same environment, and give `readCString` the `NULL` test `readStruct` has, so a `NULL` `CPtr` panics with `ffi-null` instead of reading address 0.
stages:
  - id: ulimit-check
    title: "test: pin getrlimit through a declare class against ulimit -Sn / -Hn"
    goal: tests/ffi-struct.js has a check that builds a Nish program printing getrlimit(RLIMIT_NOFILE)'s cur and max through a `declare class Rlimit`, runs it and `sh -c 'ulimit -Sn; ulimit -Hn'` in one environment, and requires the values to agree
    verification: node tests/run.js "ffi_struct checks"
    todos:
      - id: ulimit-program
        content: An inline program in tests/ffi-struct.js (as LAYOUTS and read.ts are) with ffi_struct_param's Rlimit and getrlimit declarations that prints cur and max and calls no setrlimit — see Stage ulimit-check
      - id: ulimit-compare
        content: Run the program and the shell under one shell that first lowers the soft limit to a value no default has, and compare both lines, `unlimited` read as RLIM_INFINITY — see Stage ulimit-check
      - id: ulimit-record
        content: Cite the check by its exact name where acceptance or the WP27 record would look for it (docs/wp27-ffi.md is not this stage's — name it in the PR body instead)
  - id: readcstring-null
    title: "fix(codegen): readCString tests its pointer for NULL and panics with ffi-null"
    goal: readCString panics with `ffi-null` on a NULL CPtr, natively and on wasm32, exactly as readStruct does; --emit-panics lists it as an ffi-null site, --deny-panics refuses it, and RT-16, LANGUAGE.md, runtime/nish.d.ts, the guide and docs/reference say so
    verification: node tests/run.js ffi_string && node tests/run.js panics_ffi && node tests/run.js ffi_owned_string && node tests/run.js ffi_struct_read && node tests/run.js wasi && npm run check && npm run lint && npm run lint:dead && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node tests/diagnostic-coverage.js
    todos:
      - id: null-test
        content: Test readCString's pointer before the @nish.ffi.str copy and branch to the ffi-null panic naming `readCString`, reusing readStruct's NULL test rather than a second copy of it — see Stage readcstring-null
      - id: panic-kind
        content: src/panics.ts reports readCString as PANIC_FFI_NULL, not PANIC_UNCHECKED, and every comment that calls it the reader that trusts a CPtr not to be NULL is rewritten
      - id: null-tests
        content: A native round trip that panics (panics_ffi_read_cstring_null, exit 1 and the message), the --emit-panics and --deny-panics checks in tests/ffi-string.js rewritten, --deny unsafe and --emit-checked unchanged, goldens regenerated
      - id: null-docs
        content: RT-16 (before/after and the test), docs/wp27-ffi.md §8e/§9h, LANGUAGE.md's panic-sites and nish:unsafe rules, runtime/nish.d.ts's readCString doc, the interop and cli guide pages, docs/reference regenerated
---

# WP27 follow-ups (#1498)

WP27 (Calling C) is on `main`: S4.1 `declare class` C layouts (#1455), S4.2
`readStruct` with a `NULL` test that panics with `ffi-null` (#1471), S5
`cErrno` (#1443). Design: `docs/wp27-ffi.md` §9–§10. Issue #1498 records two
gaps the WP27 run left.

## Stage ulimit-check

**Owns:** `tests/ffi-struct.js`

The criterion WP27's run did not pin: a program declaring `Rlimit` and calling
`getrlimit(7, rl)` prints what `ulimit -Sn` / `ulimit -Hn` report.
`tests/cases/ffi_struct_param.ts` cannot carry it: its `.out` is fixed and the
limits are not, and it lowers the soft limit with `setrlimit` part-way.

- Write the program inline in `tests/ffi-struct.js` beside `LAYOUTS` and
  `read.ts`, so it is not a new `tests/cases` entry (no golden, no
  differential registration). Same `Rlimit` / `getrlimit` declarations as
  `ffi_struct_param.ts`; print `cur` then `max`, nothing else.
- **Print the u64 exactly.** `RLIM_INFINITY` is `2^64 - 1`. Confirm how
  `console.log` of a `u64` prints a value above `2^53` and print it in a way
  that does not round (e.g. compare against `RLIM_INFINITY` in the program and
  print `unlimited`, which is what `ulimit` prints).
- **Same environment, and not a tautology.** Run both under one shell that
  first sets the soft limit to a value no default has — e.g.
  `sh -c 'ulimit -Sn 123; ./prog; ulimit -Sn; ulimit -Hn'` (the binary and the
  two `ulimit`s inherit the same limits). Pick a value below any CI hard limit
  and say why in the comment. Assert the program printed exactly that soft
  value and the same hard value the shell printed.
- Gate it like the other native checks in the file (`only`, a compiler that
  builds natively); on a platform where `RLIMIT_NOFILE` is not 7 (macOS: 8),
  skip with a reason rather than fail — check how the file already handles
  platform.
- `Refs #1498` in the PR body (the other stage closes it).

## Stage readcstring-null

**Owns:** `src/**`, `runtime/nish.d.ts`, `docs/LANGUAGE.md`,
`docs/wp27-ffi.md`, `docs/security/runtime.md`, `docs/guide/**`,
`docs/reference/**`, `docs/AI.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`,
`scalar.config.json`, `tests/ffi-string.js`, `tests/run.js`, `tests/cases/**`,
`tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`

Today `readCString` is an allowed `unchecked` site (`src/panics.ts`), and
`nish.ffi.str` loads from its pointer directly, so a `declare function` that
answers `NULL` through a plain `CPtr` reads address 0 (a fault natively,
garbage on wasm32). `readStruct` already tests its pointer and panics with
`ffi-null` (`emitStructCopy`, `src/emit-classes.ts`; RT-52).

- Share the test with `readStruct`: one helper for "test a `CPtr` for `NULL`,
  panic `ffi-null` naming the reader", used by both. Message in the same
  shape as readStruct's (`` `readCString` read a NULL pointer ``).
- The `string` result of a `declare function` already panics `ffi-null` on
  `NULL` (RT-15) through `emitForeignStringResult`; check that path does not
  now test twice.
- **User-visible:** `--deny-panics` now refuses a `readCString` call, where it
  was allowed. The refusal reuses the existing `` `ffi-null` may panic here ``
  diagnostic; if any new diagnostic or code is added, it needs a
  `src/codes.ts` rule and a passing `node tests/diagnostic-coverage.js`.
- Tests: a new `tests/cases/panics_ffi_read_cstring_null` (native, exit 1,
  expected stderr), registered with `node tests/differential/goldens.js
  --update`; in `tests/ffi-string.js`, rewrite "ffi_owned_string: `readCString`
  is an allowed `unchecked` site …" to the `ffi-null` site, and add a
  `--deny-panics` refusal check; the wasm32 run of the NULL case if the file
  runs wasm32 for readStruct. Regenerate `tests/self/goldens/checked/` and any
  moved `.ll` (`tests/cases/ffi_struct_read.ll`, `ffi_owned_string.ll`) and
  show the IR diff in the PR body. Run nish-cmp; add `DECLARED` entries if a
  corpus program's IR moves.
- Docs: RT-16 becomes a before/after (before: address 0; after: the panic,
  exit 1, the test name) and RT-52's "readCString stays the one reader that
  trusts…" sentence goes. Do **not** touch `docs/security/README.md`'s totals
  table unless a count really changes — it conflicts with every concurrent
  security PR. `LANGUAGE.md`'s panic-sites list and `nish:unsafe` rule,
  `runtime/nish.d.ts`'s `readCString` doc (`@returns`, the panic),
  `docs/guide/using-nish/interop.md` and `cli.md` (`--deny-panics`), then
  `node scripts/gen-reference.mjs`. Grep `docs/`, `.claude/` and `src/`
  comments for "trusts" / "unchecked" next to `readCString`.
- `src/` change: `node tests/run.js wasi` (`WASI_SYSROOT=/usr`) and
  `node tests/run.js performance` before pushing.
- `Fixes #1498` in the PR body.

## Merge order

Disjoint; `ulimit-check` merges first so `readcstring-null`'s `Fixes #1498`
closes the issue last.
