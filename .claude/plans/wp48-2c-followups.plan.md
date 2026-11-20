---
name: WP48 stage 2c follow-ups (#1817)
overview: Pin the N-API refusals of compact classes that no test covers yet (--emit-napi-async alone and beside --emit-header, NL4020 beside --emit-header), and make the guide, LANGUAGE.md and the generated reference say which of NL4020 and NL4021 appears when. Tests and docs only; src/ is untouched.
stages:
  - id: s1-negatives-docs
    title: "test(interop): pin the N-API refusals of compact classes, and say which code appears when"
    goal: Every flag combination that refuses a compact class has a tests/link negative pinning its codes and locations, and the docs state the NL4020-vs-NL4021 rule the code implements
    verification: node tests/run.js link && node scripts/gen-reference.mjs --check && npm run lint && npm run check && node docs/check-links.mjs
    todos:
      - id: neg-napi-async
        content: Add tests/link/compact_reject_napi_async (--emit-napi-async --threads, expected.err + expected.json) — see Negatives
        status: pending
      - id: neg-header-napi-async
        content: Add tests/link/compact_reject_header_napi_async (--emit-header beside --emit-napi-async --threads, expected.err + expected.json) — see Negatives
        status: pending
      - id: neg-header-export
        content: Add tests/link/compact_reject_header_export (NL4020 with --emit-header beside --emit-napi, expected.err + expected.json) — see Negatives
        status: pending
      - id: guide-which-code
        content: Rewrite the refusal bullet in docs/guide/language/compact-classes.md to say which code appears when — see Docs
        status: pending
      - id: language-which-code
        content: Align the NL4020/NL4021 sentence in docs/LANGUAGE.md and any matching text in runtime/nish.d.ts or tests/wordings comments — see Docs
        status: pending
      - id: language-grammar
        content: Fix the grammar of the 8-aligned compact class sentence in docs/LANGUAGE.md — see Docs
        status: pending
      - id: explain-layout-note
        content: Add one guide sentence that --explain-layout under --emit-header reports the automatic rule, not an explicit Compact class's header layout — see Docs
        status: pending
      - id: regen-reference
        content: Regenerate docs/reference with node scripts/gen-reference.mjs and read the diff — see Verification
        status: pending
---

## Context

WP48 stage 2c (PR #1781, `ce9bfd3a`) lets a compact class cross `--emit-header` as an opaque handle. `--emit-napi` and `--emit-napi-async` still refuse compact classes, alone or beside `--emit-header`, through one branch: [`src/compile.ts`](../../src/compile.ts) ~1783-1795 picks `hostFlag` and calls `refuseCompactSidecars` in [`src/interop-abi.ts`](../../src/interop-abi.ts) (~1340-1381). Issue #1817 records three gaps acceptance found. The behaviour is correct; this stage is tests and docs only.

What the code does (verify by running each negative, not by trusting this summary):

- **NL4020**, at the name of every exported function or constructor whose return or parameter type is (or is a nullable or array of) a compact class. `compactHeld` stops at the first compact class it finds (return type first, then parameters in order), and only that class's name is added to `reported`.
- **NL4021**, at the name of every compact class whose name is not already in `reported`. The message names the flag (`--emit-napi` or `--emit-napi-async`).
- `--emit-napi` wins over `--emit-napi-async` when both are given. `--emit-header` beside either changes nothing about these two codes.

## Negatives

Existing siblings to mirror (args format, header comment line): `tests/link/compact_reject_export` (NL4020, `--emit-napi`), `tests/link/compact_reject_napi` (NL4021, `--emit-napi`), `tests/link/compact_reject_header_napi` (NL4021, `--emit-header` + `--emit-napi`). `--emit-napi-async` without `--threads` exits 2, so the async cases pass `--threads`. Output paths go under `build/test/link/<name>.*` like the siblings.

Each new directory gets `main.ts`, `args`, `expected.err` (the needle `tests/nish/run.ts` reads) and `expected.json` (every `--json` diagnostic, compared whole — this is what pins both codes, their locations, and the absence of NL4021 for a class an export names). Generate `expected.json` from the compiler's own `--json` output and read it; never hand-write it.

| directory | flags | program shape | pins |
|---|---|---|---|
| `compact_reject_napi_async` | `--emit-napi-async … --threads` | one compact class an export names, one compact class no export names | NL4020 at the export, NL4021 (naming `--emit-napi-async`) only at the unnamed class |
| `compact_reject_header_napi_async` | `--emit-header … --emit-napi-async … --threads` | same shape | same codes; `--emit-header` lifts nothing |
| `compact_reject_header_export` | `--emit-header … --emit-napi …` | same shape, or the `compact_reject_export` program | NL4020 at the export beside `--emit-header` |

With the existing three, the four flag combinations (`--emit-napi`, `--emit-header`+`--emit-napi`, `--emit-napi-async`, `--emit-header`+`--emit-napi-async`) each have a negative for NL4020 and for NL4021. If a program shape above turns out not to compile to exactly these diagnostics, record the real output, and stop and say so in the PR rather than changing `src/`.

## Docs

- [`docs/guide/language/compact-classes.md`](../../docs/guide/language/compact-classes.md) "Where a compact class is refused" (~line 136): replace "refuses every compact class (NL4021), and an exported function whose signature holds one (NL4020)" with the rule above: NL4020 at each export whose signature holds a compact class; NL4021 at each compact class no NL4020 already named; both under either flag, with or without `--emit-header`. Keep the guide's voice (`docs/README.md` → "Writing a guide page").
- [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) ~10794-10800: fix "an 8-aligned compact class's included" (e.g. "including an 8-aligned compact class's") and make the NL4021/NL4020 sentence state the same rule. Grep `docs/LANGUAGE.md`, `docs/guide/`, `runtime/nish.d.ts`, `tests/wordings/nl402[01]_*.ts` (their first-line comment becomes the reference's example caption) for any other "every compact class … NL4021" reading and align it. `docs/roadmap/` and `docs/wp48-*.md` are history; leave them.
- `--explain-layout` note (optional in #1817, in scope here): under `--emit-header` it reports `native: --emit-header` for every class. That is the automatic rule's verdict (`src/compact-rule.ts` `notNative`, unchanged). Add one sentence where the guide describes `--explain-layout` with compact classes (compact-classes.md, or [`docs/guide/using-nish/cli.md`](../../docs/guide/using-nish/cli.md) ~818) saying it describes the automatic rule, not the layout an explicit `implements Compact` class gets in a header build.
- Then run `node scripts/gen-reference.mjs`; the builtins page and the diagnostics band page mirror LANGUAGE.md and `tests/wordings/`.

**Owns:** `tests/link/compact_reject_napi_async/**`, `tests/link/compact_reject_header_napi_async/**`, `tests/link/compact_reject_header_export/**`, `docs/guide/language/compact-classes.md`, `docs/guide/using-nish/cli.md`, `docs/LANGUAGE.md`, `runtime/nish.d.ts`, `tests/wordings/nl4020_compact_export.ts`, `tests/wordings/nl4021_compact_napi.ts`, `docs/reference/**`

## Out of scope

- Any change under `src/` (including `src/compact-rule.ts` and the `--explain-layout` output). If one looks needed, stop and say so in the PR.
- `tests/shard-costs.json` (regenerated from CI logs by `scripts/shard-costs.mjs`).
- New diagnostic codes or changed diagnostic messages.

## Verification

```
node tests/run.js link
node tests/run.js wordings        # only if a tests/wordings file changed
node scripts/gen-reference.mjs --check
npm run check && npm run lint && node docs/check-links.mjs
```

No `src/` or `std/` change, so no nish-cmp IR can move and no `DECLARED` entry is needed. The full suite is CI's nine shards.
