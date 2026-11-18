---
name: WP48 stage 2c — a compact class crosses --emit-header as an opaque handle
overview: Today #1744 refuses `implements Compact` in every build C or Node reads (NL4021 at the class, NL4020 at an export signature). §3.1 rule 1's reason is that the range would be reserved inside a host process Nish does not own. An `--emit-header` build is a C executable whose author links the module with the Nish runtime, so the runtime's constructor reserves the range before `main` exactly as in `nish run`, and a busy address is the existing panic; an N-API addon is loaded into Node's process after V8 has laid out its address space. So this stage lifts both codes for `--emit-header` and keeps both for `--emit-napi` and `--emit-napi-async` (alone or beside `--emit-header`). A class holding a compressed field is opaque in the header and C holds it as a handle; a compact instance crossing an exported signature is a full pointer. The automatic rule's test 1 (src/compact-rule.ts) is not changed.
stages:
  - id: s2c-compact-header
    title: "feat(interop): a compact class crosses --emit-header as an opaque handle (WP48 stage 2c)"
    goal: An `implements Compact` program builds with `--emit-header`; the header keeps every class holding a compressed field opaque; a C program in tests/ links the module and the range runtime, holds a compact instance as a handle and round-trips it through exported functions with expected stdout; N-API builds still refuse with NL4020/NL4021; docs, reference and roadmap say which cases were lifted and which stay refused.
    verification: npm run check && npm run lint && node scripts/gen-reference.mjs --check && node tests/run.js compact && node tests/run.js header && node tests/run.js wordings && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: decide-and-record
        content: Record the decision in docs/wp48-ref32-classes.md (§3.1 rule 1 and the §4 "C ABI and headers" row) and on the roadmap's stage 2c line — lifted: NL4021 and NL4020 under `--emit-header`; kept: both under `--emit-napi` / `--emit-napi-async`, including when either is given beside `--emit-header`; the automatic rule's test 1 still refuses every sidecar build — see S2c
        status: pending
      - id: refusal
        content: src/compile.ts and src/interop-abi.ts `refuseCompactSidecars` — refuse only for an N-API flag (today `hostFlag` prefers `--emit-header` when several are given, which would let `--emit-header --emit-napi` through); reword NL4020/NL4021 to say why Node is refused (the addon runs in a process Nish does not own), and grep the old wording across the repo (expected.err, expected.json, tests/wordings, docs/reference/diagnostics, LANGUAGE.md, guide) — see S2c
        status: pending
      - id: opaque-header
        content: src/interop-header.ts — a class whose layout holds a compressed field (a compact class itself, any class with a field narrowed to i32, including a generic instantiation such as `Box<Cell>`) is emitted as `typedef struct X X;` with a comment saying why, like a Map or a Secret; the header states the runtime must be built with the compact range (`-DNISH_ARENA_RANGE` / `scripts/build.sh --arena-range`) — see S2c
        status: pending
      - id: signatures
        content: Confirm exported signatures taking or returning a compact instance spell it `struct X *` (a full pointer) and that FFI / N-API signature code in src/interop-abi.ts is unchanged for every program without the marker; confirm the header build's IR really narrows the links (the link is i32 in the struct body) — see S2c
        status: pending
      - id: c-host-test
        content: A tests/link (or tests/run.js) case with a C program that includes the generated header, links the module plus the runtime built with the range define, makes a compact instance through an export, holds it as a handle, passes it back through another export, and prints expected stdout; plus a check that linking without the range define fails (fail closed) — see S2c
        status: pending
      - id: negatives
        content: Move tests/link/compact_reject_header and compact_reject_export, and tests/wordings nl4020/nl4021 (`.args`), to N-API flags so each code keeps a provoking negative with expected.err; add a negative for `--emit-header --emit-napi` together — see S2c
        status: pending
      - id: docs
        content: docs/LANGUAGE.md's compact rule, docs/guide/language/compact-classes.md ("Where a compact class is refused" and a C-host example), cookbook entry if the checklist needs one, `node scripts/gen-reference.mjs` for docs/reference, regenerate tests/self/goldens/checked, tick stage 2c on docs/roadmap/wp48-ref32-classes.md (Done count, Next line) — see S2c
        status: pending
---

# WP48 stage 2c — a compact class crosses `--emit-header` as an opaque handle

## S2c

Owns: `src/**`, `tests/**`, `docs/**`, `scalar.config.json`,
`scripts/undocumented.txt`, `.claude/plans/wp48-s2c-compact-header.plan.md`.

`src/compact-rule.ts` is inside the glob but must not change: the automatic
rule's test 1 still refuses every sidecar build. No `runtime/*.c` or `std/`
change is expected; if one turns out to be needed, open the PR as a draft and
say why instead of widening scope.

### The decision (what this stage lifts and what stays refused)

§3.1 rule 1 keeps a compact class out of a process Nish does not own, because
the range is a fixed 15 GiB reservation at 0x40000000 made by the runtime's
constructor before `main`.

- **`--emit-header` — lifted (NL4021 and NL4020).** The header describes a
  module a C author links into their own executable together with the Nish
  runtime (`clang host.c module.ll runtime/*.c`, as
  `tests/run.js`'s `layout_inline_header` does). Built with the range define,
  that runtime reserves the range before `main` exactly as `nish run` does,
  and a busy address is the existing panic. A runtime built without the define
  does not define `nish_arena_range_abi`, so the link fails rather than running
  without the range. A class holding a compressed field is opaque in the header
  (C never reads an `i32` link as a pointer) and C holds it as a handle; a
  compact instance crossing an exported signature is a full `struct X *`, so
  signatures do not change.
- **`--emit-napi`, `--emit-napi-async` — kept (NL4021 and NL4020).** The addon
  is a `-shared` object loaded into Node's process after V8 has laid out its
  address space, which is exactly the host process rule 1 names. That holds
  when either flag is given beside `--emit-header`.
- **The automatic rule — unchanged.** `src/compact-rule.ts` test 1 still
  refuses every sidecar build; only the explicit marker crosses a header.
- **Out of scope:** a header build linked into a shared library that another
  process loads is the same "host process" case, which the compiler cannot see;
  the guide page says so.

### Verification

Targeted: `node tests/run.js <filter>` for the sections touched (compact,
header, wordings, link cases by name), plus `node tests/run.js wasi`
(`WASI_SYSROOT=/usr`) and `node tests/run.js performance` for the `src/`
change, `npm run check`, `npm run lint`, `node scripts/gen-reference.mjs
--check`, and nish-cmp before pushing (expect no corpus IR change). CI's
eight test shards are the full-suite gate.
