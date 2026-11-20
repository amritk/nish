---
name: WP65 — the surface a lexer port asked for
overview: A C++ formatter port asked for byte search, allocation without the zero fill, non-literal field initializers and a number toString. Byte search and the zero-fill work are still open; the last two were built or decided and need their boxes closed.
roadmap: docs/roadmap/wp65-lexer-surface.md
spec: docs/wp65-lexer-surface.md
priority: 60
issue: 1884
stages:
  - id: s1-byte-search
    title: WP65 S1 — byte search on u8[], indexOf with fromIndex, indexOfByte, equalBytes and compareBytes
    goal: indexOf(x, fromIndex) works on every array and lowers to memchr on a byte array, and std/bytes has indexOfByte, equalBytes and compareBytes through memchr and memcmp, with the constant-table docs shown to a lexer author.
    verification: node tests/run.js bytes && node tests/run.js c-symbols && node tests/run.js performance && npm run check && npm run lint
    status: pending
    issue: 1629
    related: [1633]
    todos:
      - id: s1-indexof
        content: Add indexOf(x, fromIndex) on arrays, lowered to memchr on u8[] in src/emit-arrays or its equivalent — see WP65 S1
        status: pending
      - id: s1-std-bytes
        content: Add indexOfByte, equalBytes and compareBytes to std/bytes through memchr and memcmp, reserving each libc call in src/c-symbols.ts — see WP65 S1
        status: pending
      - id: s1-docs-measure
        content: Add the golden .ll, negative, LANGUAGE.md rule, cookbook entry, guide page, constant-table docs and a Measured trailer — see WP65 S1
        status: pending
  - id: s2-no-zero-fill
    title: WP65 S2 — allocation without the zero fill, withCapacity and grow
    goal: std/array has withCapacity and grow where growth is one realloc and no memset, then a fill is dropped where a counted loop overwrites it before any read, measured on its own.
    verification: node tests/run.js array && node tests/run.js c-symbols && node tests/run.js performance && npm run check && npm run lint
    status: pending
    issue: 1630
    todos:
      - id: s2-grow
        content: Add withCapacity and grow to std/array with a realloc-backed grow that never exposes stale memory — see WP65 S2
        status: pending
      - id: s2-drop-fill
        content: Drop the zero fill where a counted loop overwrites it before any read, in its own measured commit — see WP65 S2
        status: pending
      - id: s2-docs-measure
        content: Pin a golden .ll with the memset gone on the grow path, plus negative, docs and a Measured trailer — see WP65 S2
        status: pending
  - id: s3-field-initializers
    title: WP65 S3 — field initializers that are not literals
    goal: A class field initializer such as xs i32[] = [] runs in declaration order before the constructor body.
    verification: node tests/run.js cls_field_init && npm run check && npm run lint
    status: pending
    issue: 1889
    todos:
      - id: s3-verify-close
        content: Confirm tests/cases/cls_field_init and the reject_cls_field_init negatives cover the stage, then tick the box and note it in docs/wp65-lexer-surface.md — see WP65 S3
        status: pending
  - id: s4-number-tostring
    title: WP65 S4 — toString() on a number
    goal: n.toString() with no argument is refused naming the template literal, with a quick-fix.
    verification: node tests/run.js reject_num_tostring && npm run lint
    status: pending
    labels: [needs-decision]
    issue: 1890
    todos:
      - id: s4-verify-close
        content: Confirm tests/cases/reject_num_tostring covers D1b, then tick the box and record the decision in docs/roadmap/wp65-lexer-surface.md — see WP65 S4
        status: pending
---

# WP65 — the surface a lexer port asked for

## Context
Landed: array module constants for a byte-class table, as [constant tables](../../docs/LANGUAGE.md#constant-tables). See [the roadmap page](../../docs/roadmap/wp65-lexer-surface.md). Spec: [design note](../../docs/wp65-lexer-surface.md). S1 to S3 do not depend on one another. Not planned: an array whose `length` covers uninitialised slots, `memchr` for elements wider than a byte, `toString` on arrays or classes. Issues #1629 and #1630, items of the formatter tracker #1633, are S1's and S2's issues.

## WP65 S1 — byte search on u8[]
Spec: [§2](../../docs/wp65-lexer-surface.md#2-byte-search-on-u8-s1). Reported as #1629: programs write byte loops or build a string with `String.fromBytes` to compare a token. Check that `u8[].indexOf(byte, from)` is a scalar loop and lower it to `memchr` (the string path already does for a one-byte needle, `src/emit-strings.ts`); add a non-allocating sub-range compare on `memcmp`; possibly a multi-byte `memmem`. Every new libc call is reserved in `src/c-symbols.ts`.
Likely files: `src/emit-strings.ts`, `std/bytes.ts`, `src/c-symbols.ts`.

## WP65 S2 — allocation without the zero fill, withCapacity and grow
Spec: [§3](../../docs/wp65-lexer-surface.md#3-allocation-without-the-zero-fill-and-grow-s2). Reported as #1630: parallel `i32[]` token tables are grown by allocating, zero-filling and copying. Soundness first: an element readable before written must never expose stale memory.
Likely files: `std/array.ts`, `src/` array allocation, `runtime/*.c`.

## WP65 S3 — field initializers that are not literals
Spec: [§4](../../docs/wp65-lexer-surface.md#4-field-initializers-that-are-not-literals-s3). May already be done: the tracker #1633 ticks #1631 as done and `tests/cases/cls_field_init.ts` and `reject_cls_field_init_*` exist. The stage only verifies and ticks the box.

## WP65 S4 — toString() on a number
Spec: [§5](../../docs/wp65-lexer-surface.md#5-tostring-on-a-number-s4-open-question). May already be done: the owner chose D1b (#1632, ticked in the tracker), `tests/cases/reject_num_tostring*` exist.

### Decision needed
Record that D1b stands (the refusal names the template literal; `String(n)` keeps its refusal) so the open-question label can be dropped. Alternative D1a, building `n.toString()`, was the original recommendation but the owner chose D1b.
