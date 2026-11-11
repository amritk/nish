---
name: WP27 S4 and S5 — C structs by layout declaration, and errno
overview: Finish WP27 (Calling C). S4 lets a program declare a C struct's layout with `declare class`, pass it by pointer to a `declare function`, and copy a C-owned struct out of a `CPtr`. S5 gives a program the `errno` a foreign call left behind. Each stage writes its own design-note section, LANGUAGE.md rule, cookbook entry and guide text in the PR that builds it.
stages:
  - id: s4-layout
    title: WP27 S4.1 — declare class as a C struct layout, passed by pointer
    goal: A program declares a C struct with `declare class`, constructs it, reads and writes its fields, and passes it to a `declare function` that reads and writes it through a pointer, laid out exactly as clang lays out the same C struct
    verification: npm run check && npm run lint && node tests/run.js ffi_struct && node tests/run.js ffi && node tests/run.js reject_ffi && node tests/run.js reject_cls_declare && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s4l-note
        content: Write docs/wp27-ffi.md §9 (S4 design — the layout rule, the borrow, what stays refused, steps) and update its status line and §3 table — see S4.1 design
        status: pending
      - id: s4l-check
        content: Accept `declare class` with foreign-scalar, CPtr and nested-layout fields in the checker, refusing everything else by name — see S4.1 design
        status: pending
      - id: s4l-layout
        content: Lay a layout class out in declaration order at C natural alignment in src/structs.ts, never reordered and with no padding warning — see S4.1 design
        status: pending
      - id: s4l-param
        content: Lower a layout-class parameter of a `declare function` to a pointer, borrowed for the call, with escape and fact invalidation as for a `u8[]` buffer — see S4.1 design
        status: pending
      - id: s4l-tests
        content: Add ffi_struct_param, ffi_struct_layout (C sidecar checks every offset and the size), and the reject_ffi_struct_* cases — see S4.1 tests
        status: pending
      - id: s4l-docs
        content: Add the LANGUAGE.md rule, IR_COOKBOOK entry and docs/cookbook program, the interop guide section, regenerate goldens and docs/reference, and tick S4 in docs/roadmap/wp27-ffi.md — see S4.1 docs
        status: pending
  - id: s4-read
    title: WP27 S4.2 — readStruct, copying a C-owned struct out of a CPtr
    goal: A program reads a struct C owns, given only a `CPtr` to it, by copying it into a Nish-owned layout instance with `readStruct` from `nish:unsafe`
    verification: npm run check && npm run lint && node tests/run.js ffi_struct && node tests/run.js unsafe && node tests/run.js reject_unsafe && node tests/run.js reject_ffi && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s4r-note
        content: Extend docs/wp27-ffi.md §9 with the copy-out rule and its alternatives (a view, a borrowed reference) and why the copy — see S4.2 design
        status: pending
      - id: s4r-builtin
        content: Add `readStruct<T>(p CPtr) T` to nish:unsafe (checker, nish.d.ts, emitter, panics list, capability) — see S4.2 design
        status: pending
      - id: s4r-tests
        content: Add ffi_struct_read (libc localeconv and a C sidecar pointer, each copy kept across a churned arena and a later C write) and its reject cases — see S4.2 tests
        status: pending
      - id: s4r-docs
        content: Add the LANGUAGE.md rule, cookbook entry, guide text and the security-record finding, regenerate goldens and docs/reference, mark S4 done in the roadmap — see S4.2 docs
        status: pending
  - id: s5-errno
    title: WP27 S5 — errno after a foreign call
    goal: A program reads the errno its most recent `declare function` call left on this thread, zeroed before that call and unclobbered by the compiler's own marshalling or allocation after the call
    verification: npm run check && npm run lint && node tests/run.js ffi_errno && node tests/run.js ffi && node tests/run.js reject_ffi && node tests/run.js unsafe && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s5-note
        content: Write docs/wp27-ffi.md §10 (S5 design — capture after the call, why not a foreign global, threads, wasm32) — see S5 design
        status: pending
      - id: s5-builtin
        content: Add the errno builtin and the capture the compiler emits after every foreign call in a program that names it — see S5 design
        status: pending
      - id: s5-runtime
        content: Add the thread-local slot and its accessor to runtime/nish.h and runtime/runtime.c inside the unit's text ceiling — see S5 design
        status: pending
      - id: s5-tests
        content: Add ffi_errno (ENOENT from open, kept across a string-returning call and an allocation; per-thread under parallel) and reject_ffi_errno_* — see S5 tests
        status: pending
      - id: s5-docs
        content: Add the LANGUAGE.md rule, cookbook entry, guide text, regenerate goldens and docs/reference, tick S5, and move WP27 to Landed in the roadmap index if S4 is done — see S5 docs
        status: pending
---

## Context

WP27 is 3 of 5. S1 (scalars), S2 (`CPtr`) and S3 (`string` both ways, `readCString`) are built; WP53 added `u8[]` buffers and `using` handle classes. S4 and S5 were marked "owner's decision"; the owner has decided to do both. There is no design section for either yet, so each stage writes its own, in [docs/wp27-ffi.md](docs/wp27-ffi.md), in the PR that builds it (§8 is the model for S3).

Facts from the code at base `60e5be71`:

- `declare function` is parsed at [src/parser.ts](src/parser.ts) (`parseForeignFunction`), checked by `checkForeignSignature` in [src/declarations.ts](src/declarations.ts), typed by `isForeignType` / `isForeignBuffer` in [src/types.ts](src/types.ts), declared by `foreignDeclarationFor` and called at [src/emit.ts](src/emit.ts).
- `declare class` already parses (`declaredTypeAhead`, `FLAG_FOREIGN` on the class) and the checker refuses it: `reject_cls_declare` ("promises a layout from elsewhere, and there is no elsewhere"). S4.1 makes that elsewhere C.
- Struct layout is [src/structs.ts](src/structs.ts): natural alignment, fields **reordered** widest-first, a `perf` padding warning. There is no C-order layout today.
- `nish:unsafe` ([src/nish-modules.ts](src/nish-modules.ts)) holds `readCString`, lowered by `emitCStringCopy` in [src/emit-builtins.ts](src/emit-builtins.ts). Nothing reads memory at an offset from a `CPtr`.
- Nothing reads `errno`. OS builtins answer `-errno` as a negative `i32`. Targets: linux and darwin on x64 and arm64, and wasm32.

## Approach

**S4: C layout by `declare class`, crossing by pointer, reading by copy.** The spelling is TypeScript's own "this exists elsewhere", as `declare function` is. The compiler lays the class out by the C rule the platforms Nish targets share for these field types (declaration order, natural alignment, size rounded to the struct's alignment), so it computes the layout rather than being told offsets. A struct never crosses by value: the C ABI for struct arguments and returns differs per platform and LLVM does not lower it for us. A Nish-owned instance crosses as a borrowed pointer, the S3.1 borrow rule. A C-owned struct is read by copying it into a Nish-owned instance, the S3.2/`readCString` reasoning: a copy out is sound by construction, a view is not.

**S5: errno captured by the compiler, read by a builtin.** `errno` is a macro over a thread-local (`__errno_location()` on glibc and musl, `__error()` on Darwin), so `declare let errno: i32` would name a symbol that does not exist on glibc. And anything the compiler runs after the call (a string-result copy, an arena allocation) may call malloc and clobber it. So in a program that names the builtin, the compiler stores errno into a runtime thread-local slot immediately after every `declare function` call returns, before any marshalling, and the builtin reads that slot. The rule a user reads: "the errno the most recent foreign call on this thread left". A program that never names it pays nothing.

Settled at sign-off: `readStruct` and `cErrno` live in `nish:unsafe`, and errno is zeroed before each foreign call as well as saved after it (S5).

## WP27 S4.1 — declare class as a C struct layout, passed by pointer

**Owns:** `src/**` (except the files s5-errno owns alone; see Concurrency), `tests/cases/ffi_struct_*`, `tests/cases/reject_ffi_struct_*`, `tests/cases/reject_cls_declare*`, `docs/wp27-ffi.md`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/guide/using-nish/interop.md`, `docs/roadmap/wp27-ffi.md`, `docs/security/**`, generated files

### S4.1 design

```ts
declare class Rlimit {
  rlim_cur: u64;
  rlim_max: u64;
}
declare function getrlimit(resource: i32, rl: Rlimit): i32;

export function main(): i32 {
  const rl = new Rlimit();          // zero-initialised
  if (getrlimit(7, rl) !== 0) return 1; // RLIMIT_NOFILE on Linux
  print(rl.rlim_cur);
  return 0;
}
```

- **Fields:** each one a foreign scalar (`i8`–`i64`, `u8`–`u64`, `f64`, and `f32` if the language has it), `CPtr` or `CPtr | null`, or another layout class nested by value. No `string`, array, Nish class, `boolean` (C's `_Bool` width is the ABI's business; write `u8`), initialiser, method, constructor, `static`, accessor, generic, `extends` or `implements`. Each refusal has a named case.
- **Layout:** declaration order; each field at its natural alignment; size rounded up to the largest field alignment. The layout path in [src/structs.ts](src/structs.ts) skips the widest-first reorder and the padding warning for a layout class.
- **Instances:** `new Name()` with no arguments, every field zero. Fields read and write as ordinary class fields. A layout instance may live where an ordinary class instance may.
- **Crossing:** a `declare function` parameter typed as a layout class (or `Name | null`, literal `null` or narrowed, as `CPtr | null`) lowers to a pointer to the struct. It is borrowed for the call: C may read and write through it while the call runs and must not keep it, which is a stated contract like S3.1's. Escape analysis keeps the instance live across the call; a write through it invalidates field facts, as WP53 §3c does for a `u8[]`.
- **Refused:** a layout class as a `declare function` return or by value anywhere C sees it (`reject_ffi_struct_return`); a layout class in an array (`reject_ffi_struct_array`); every bad field and member above; an ordinary class as a foreign parameter stays refused (`reject_ffi_class_param`). `reject_cls_declare` is rewritten to pin the refusal of a `declare class` that is not a valid layout.
- **What does not change:** the `ffi` capability names every foreign call; FFI programs stay outside the differential oracle; `--emit-header`, `--emit-dts`, `--emit-napi` are untouched; `--emit-ts` refuses a layout class as it refuses a `declare function`.
- **Rolling freeze:** `std/` may use it from this commit; `src/` may not until the next release.

### S4.1 tests

- `ffi_struct_param`: `getrlimit` then `setrlimit` lowering the soft limit and reading it back; `clock_gettime(CLOCK_MONOTONIC, ts)` twice, second not earlier; a nested layout. Golden `.ll`, `llvm-as`, native round trip.
- `ffi_struct_layout`: a C sidecar defines the same struct with mixed widths (`u8`, `u64`, `i32`, `f64`, `u16`, `CPtr`, a nested struct, trailing padding) and fills a Nish instance by pointer; the sidecar also prints its own `offsetof`/`sizeof` and Nish prints the fields it read. Equal output on x64 and arm64, Linux and macOS.
- One `reject_ffi_struct_*` case per refusal above.

### S4.1 docs

LANGUAGE.md "Calling C" rule (lifting the `declare class` refusal from the unsupported list), IR_COOKBOOK entry with a `docs/cookbook/` program (`bash docs/cookbook/regen.sh`), a section in [docs/guide/using-nish/interop.md](docs/guide/using-nish/interop.md), diagnostics registry (`node scripts/gen-diagnostic-codes.mjs`), goldens (`node tests/self/goldens.js --update`, `node tests/differential/goldens.js --update` if a positive case needs it), `node scripts/gen-reference.mjs` if `runtime/nish.d.ts` moves, and the roadmap page's S4 line notes S4.1 built.

## WP27 S4.2 — readStruct, copying a C-owned struct out of a CPtr

**Owns:** the same globs as S4.1, plus `runtime/nish.d.ts`. Starts after S4.1 merges (it consumes the layout).

### S4.2 design

```ts
import { readStruct, readCString } from "nish:unsafe";
declare class Lconv { decimal_point: CPtr; thousands_sep: CPtr; grouping: CPtr; }
declare function localeconv(): CPtr;

const lc = readStruct<Lconv>(localeconv());
print(readCString(lc.decimal_point)); // "."
```

- `readStruct<T>(p: CPtr): T`, `T` a layout class given explicitly. It copies the struct's size in bytes into a fresh Nish instance; the result never aliases C memory. A `null` `CPtr` panics with S3.2's `ffi-null` kind (or the stage's note argues for a new kind).
- In `nish:unsafe` beside `readCString`, under the `unsafe` capability; refused without the import, with a non-layout `T`, with no type argument.
- No `writeStruct`: writing into C memory stays out (§9 says why: a write needs C's lifetime, a borrowed parameter already covers writing).

### S4.2 tests

- `ffi_struct_read`: `localeconv()` read and printed; a C sidecar returns a pointer to a static struct, Nish copies it, the sidecar then overwrites the static, and the copy still prints the old values after a churned arena.
- `reject_unsafe_read_struct_*`: no import, non-layout `T`, no type argument; `reject_unsafe_no_import` extended.

### S4.2 docs

As S4.1, plus the `nish:unsafe` reference page (`node scripts/gen-reference.mjs`), and a finding in the security record that holds `readCString`'s (the read trusts the pointer, the copy bounds the lifetime). The roadmap page ticks S4.

## WP27 S5 — errno after a foreign call

**Owns:** `runtime/runtime.c`, `runtime/nish.h`, `tests/cases/ffi_errno*`, `tests/cases/reject_ffi_errno*`, `src/runtime.ts`, `src/panics.ts`, `src/capabilities.ts`, and the shared files listed under Concurrency

### S5 design

```ts
import { cErrno } from "nish:unsafe";
declare function open(path: string, flags: i32): i32;

if (open("/nonexistent/x", 0) < 0) print(cErrno()); // 2
```

- After each call to a `declare function` (not a host-module import, not a handle close unless the note decides otherwise), in a program that names `cErrno`, the compiler emits a store of the C library's errno into a thread-local runtime slot, **before** any result marshalling. `cErrno()` reads the slot. Before any foreign call it is 0.
- The runtime reads errno through `errno` itself in C (one small function), so glibc, musl, Darwin and wasi-libc each get their own definition; the compiler never names `__errno_location` or `__error`.
- Threads: the slot is `_Thread_local`, so a `parallel` worker reads its own.
- wasm32: what a `declare function` does there today decides it; the note records it.
- Refused: `declare let errno` / `declare var errno` (pin the diagnostic they get, `reject_ffi_errno_global`), a call without the import, an argument.
- **Zeroed before, saved after (owner's decision at sign-off).** In a program that names `cErrno`, the compiler also sets errno to 0 immediately before each `declare function` call, so a C function that reports failure only through errno (`strtol` out of range, `readdir` at the end versus on error) can be checked. No setter is exposed.

### S5 tests

- `ffi_errno`: `open` on a missing path gives `ENOENT`; a later successful `strerror` (a `string` return, whose copy allocates) does not change what the earlier call reported unless the call itself set errno, which the case shows; `cErrno()` before any call is 0; `strtol` on an out-of-range string reports `ERANGE` and on an in-range one reports 0, showing the zeroing; a `parallel` case where two workers read different errnos.
- `reject_ffi_errno_*` as above. Attribute assertion: a function that calls `cErrno` keeps the attributes a caller of C keeps.

### S5 docs

LANGUAGE.md rule, IR_COOKBOOK entry and cookbook program, interop guide section, `nish:unsafe` reference regenerated, goldens, and the roadmap: tick S5, and if S4 is ticked, set WP27 to Landed, 5 of 5, and move it in [docs/roadmap/index.md](docs/roadmap/index.md) and [docs/README.md](docs/README.md).

## Concurrency

s4-layout and s5-errno run at the same time; s4-read starts when s4-layout merges. Both concurrent stages must touch the compiler's shared files (`src/emit.ts`, `src/nish-modules.ts`, `src/builtins.ts`, `src/emit-builtins.ts`, `runtime/nish.d.ts`) and the shared docs (`docs/wp27-ffi.md`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/guide/using-nish/interop.md`, `docs/roadmap/wp27-ffi.md`). Each adds its own section and its own functions; neither rewrites the other's. **Merge order: s4-layout, then s4-read, then s5-errno.** s5-errno takes in `main` after each earlier merge, resolves the textual conflicts in its own sections, and regenerates every generated file. Generated files are never resolved by hand.

## Out of scope

Structs by value (argument or return), C unions, bit-fields, `#pragma pack`, fixed-length inline array fields (`char d_name[256]`, so `readdir`'s name stays out of reach), writing into C-owned memory, `string[]` as `char **`, callbacks, variadics.

## Verification

Each stage's `verification` line, plus `node scripts/gen-reference.mjs --check`, `bash docs/cookbook/regen.sh --check`, `node scripts/gen-diagnostic-codes.mjs --check`, `node scripts/security-scope.mjs`, and nish-cmp if the corpus IR moves. CI's eight test shards are the full-suite gate.
