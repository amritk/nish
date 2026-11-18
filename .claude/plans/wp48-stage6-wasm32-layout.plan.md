---
name: WP48 stage 6 — a class pointer field on wasm32 laid out in 4 bytes
overview: computeLayout gives every class pointer field an 8-byte slot, so on wasm32, where LLVM's p:32:32 lays out a pointer in 4, info.size over-allocates and field offsets can disagree with LLVM's own layout. Make the slot 4 wide and 4 aligned on wasm32, check every reader of info.size and info.align against LLVM's layout, pin a class's size against LLVM's DataLayout in a wasm32 test, and record the IR it moves.
stages:
  - id: wasm32-layout
    title: "fix(codegen): lay out a class pointer field in 4 bytes on wasm32"
    goal: On wasm32 a class's info.size, info.align and every field offset equal what LLVM's DataLayout gives the emitted struct type; native targets' IR does not move; a wasm32 test pins it; stage 6 is ticked
    verification: npm run check && npm run lint && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js wasm && node tests/run.js performance && node tests/self/goldens.js && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: layout-slot
        content: In computeLayout (src/structs.ts) give a class pointer field a 4-byte width and 4-byte alignment on wasm32, not only a declare class's CPtr field; audit every other field kind whose LLVM type holds a pointer (boxed slice, inline header, nullable, union payload) for the same 8-vs-4 assumption — see The layout
        status: pending
      - id: layout-readers
        content: Check every reader of info.size / info.align / field.offset still agrees with LLVM's layout on wasm32 and on native — emitStructCopy, the record memcpy in src/emit-arrays.ts (~line 1056), src/emit-root.ts writeTrace, the JSON emitters (src/emit-json*.ts), allocation, debug info, --explain-layout and the WP15 padding warning — and fix any that assumed the 8-byte slot — see The readers
        status: pending
      - id: layout-test
        content: Add a wasm32 test in tests/run.js that compiles classes with class-pointer fields (a linked node, a mix with i64/f64 and i32 fields, a nullable link) for wasm32 and pins the compiler's size for each against LLVM's DataLayout for the emitted struct type (llvm-as/opt constant-folding a gep-null size, or equivalent), failing if the slot regresses to 8 — see The test
        status: pending
      - id: layout-goldens
        content: Regenerate the goldens the change moves (UPDATE_GOLDENS for wasm32 .ll goldens, node tests/self/goldens.js --update, node tests/differential/goldens.js --update if needed), read each diff, and add narrow DECLARED entries to tests/nish-cmp.js for every corpus program whose IR moves, with the PR's release-note words — see Goldens and nish-cmp
        status: pending
      - id: layout-docs
        content: Tick stage 6 on docs/roadmap/wp48-ref32-classes.md (Done 3 of 7) and its row in docs/roadmap/index.md if it carries a count, and fix the wasm32 row of §4 in docs/wp48-ref32-classes.md, which still says the over-allocation happens "today" and that "Stage 4" fixes it — see Docs
        status: pending
---

# WP48 stage 6 — a class pointer field on wasm32 laid out in 4 bytes

## Context

The WP48 survey ([`docs/wp48-ref32-classes.md`](../../docs/wp48-ref32-classes.md), §4, the wasm32 row, and §8 item 6) found that `computeLayout` (`src/structs.ts`, around line 167) picks `pointer = info.layout && ctx.wasm ? 4 : 8`: only a `declare class`'s `CPtr` field gets the target's 4-byte pointer on wasm32, and every other class keeps an 8-byte slot. LLVM's wasm32 DataLayout (`p:32:32`) lays a `%T*` field out in 4 bytes, 4 aligned. So on wasm32 `info.size` over-allocates, and wherever the compiler's own offsets or sizes are used instead of LLVM's `getelementptr`, they can disagree with the struct LLVM actually lays out. The roadmap lists this as stage 6, independent of stages 1 to 5. On native targets nothing changes: a pointer is 8 there.

## The layout

- The pointer width comes from the target, not from whether the class is a `declare class`: 4 on wasm32, 8 on native, for every field whose LLVM type is a pointer (a class reference, nullable or not, and `CPtr`).
- Walk `fieldWidth` / `fieldAlign` and `table.alignOf` (`src/types.ts:1385`) for every field kind and confirm each against the LLVM type the emitter writes for it on wasm32. A boxed field (`SLICE_BYTES`), an inline array's header, and a union or optional payload each hold a pointer; say in the PR body which kinds change and which do not, and why.
- If a `TypeTable` answer (`alignOf`, `sizeOfField`) is target-independent and also feeds other code, prefer passing the pointer width in over making the table target-aware globally — but do whichever keeps every caller in agreement with LLVM, and say why.
- The WP15 padding warning reads the floor `computeLayout` returns. Check its message and its tests still hold on wasm32.

## The readers

Every place that reads `info.size`, `info.align` or `field.offset` must agree with LLVM's layout of the emitted type on both targets. At least:

- `emitStructCopy` and the record `memcpy` in `src/emit-arrays.ts` (~1056): a copy of `info.size` bytes must not read or write past an element whose stride is LLVM's size.
- `src/emit-root.ts` `writeTrace` (wasm32 only): its offsets must be LLVM's.
- The JSON emitters (`src/emit-json*.ts`) and anything else that addresses a field by byte offset rather than by `getelementptr` field index.
- Allocation (`nish_alloc_struct` size argument, the arena bump), debug info (`DW_TAG_member` offsets and sizes), the opaque C header, and `--explain-layout`.

Grep `src/` for `.size`, `.align`, `.offset` on a `StructInfo` / `FieldInfo` and list in the PR body every reader checked.

## The test

A section in `tests/run.js` (skipped, counted, without a wasm32 toolchain) that compiles a few classes for wasm32 — a linked node (`next: Node | null; value: i32`, which is 8 bytes on wasm32, 16 on native), a class mixing `f64`/`i64` with pointer and `i32` fields, and one with several links — and pins, for each, the size and alignment the compiler uses against LLVM's DataLayout for the emitted struct type. One way: emit the module, then have `opt` constant-fold `ptrtoint (getelementptr (%T, %T* null, i32 1))` under the module's wasm32 datalayout, and compare with the size in the compiler's allocation call. The test must fail if the slot goes back to 8. Show the exact LLVM IR for every TypeScript snippet the test adds, in the PR body.

## Goldens and nish-cmp

This moves wasm32 IR. Regenerate, never hand-edit: wasm32 `.ll` goldens with `UPDATE_GOLDENS=1` on the sections they belong to, `node tests/self/goldens.js --update` (`--seed build/seed/bin/nish` without `build/nish`), and `node tests/differential/goldens.js --update` if a differential golden moves. Read each diff: only wasm32 output should move. Run nish-cmp (`NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js`); for every corpus program whose IR it reports as moved, add a narrow `DECLARED` entry (program + file, `changelog:` text) whose text appears verbatim in the PR title, which becomes the squash subject. If no corpus program moves (the corpus may compile native only), say so in the PR body with the nish-cmp output line.

## Docs

- `docs/roadmap/wp48-ref32-classes.md`: tick stage 6, **Done** 3 of 7; leave **Next** on stage 2.
- `docs/roadmap/index.md`: update WP48's row if it shows a count.
- `docs/wp48-ref32-classes.md` §4, wasm32 row: the over-allocation is fixed (by stage 6, not "Stage 4"); §8 item 6 stays as the record of the stage.
- No user guide page moves: the layout is internal and a program's behaviour is unchanged. If the worker finds a guide page that states a wasm32 class size, update it.

## Owns

**Owns:** `src/**`, `tests/**`, `docs/roadmap/wp48-ref32-classes.md`, `docs/roadmap/index.md`, `docs/wp48-ref32-classes.md`

One stage, no concurrent sibling, so the globs are wide on purpose; the review checks the diff stays to the layout and its readers.
