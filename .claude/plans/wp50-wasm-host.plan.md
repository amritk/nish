---
name: WP50 — a WebAssembly module a TypeScript page drives
overview: Every stage is built; the one open item is acceptance issue 1377, two criteria where the signed-off wording was stricter than the request and the owner picks which wording stands.
roadmap: docs/roadmap/wp50-wasm-host.md
spec: docs/wp50-wasm-host.md
priority: 80
stages:
  - id: s7-acceptance-decisions
    title: WP50 S7 — the deterministic-refusal codes and the header comment without the flag
    goal: The owner has decided whether the family codes stand or split, and whether the -ffp-contract header comment stays for every build, and the chosen wording is in the code, docs and tests.
    verification: node tests/run.js deterministic && node tests/nish-cmp.js && npm run lint
    status: pending
    issue: 1377
    labels: [needs-decision]
    todos:
      - id: s7-codes
        content: Keep the family codes in src/capabilities.ts or split clock and entropy and ffi and host into distinct codes with LANGUAGE.md rows and reject case .err files — see WP50 S7
        status: pending
      - id: s7-header
        content: Keep or revert the -ffp-contract=off wording in src/interop-header.ts and STAGE4_HEADER_LINES in tests/nish-cmp.js — see WP50 S7
        status: pending
---

# WP50 — a WebAssembly module a TypeScript page drives

## Context
All six stages have landed and no roadmap box is open ([roadmap page](../../docs/roadmap/wp50-wasm-host.md)). The one open item is acceptance issue #1377 from the finishing run tracked in #1352 (stages 5b and 6 landed as #1363 and #1372). Spec: [design note](../../docs/wp50-wasm-host.md).

## WP50 S7 — the deterministic-refusal codes and the header comment without the flag
Issue #1377 is this stage; the acceptance found 9 of 11 criteria met and 2 partial, neither a defect against the original request.
- Criterion 2, "Math.random, Date.now and a host import are each refused with their own code". Refusals are coded by family: Math.random (entropy) and Date.now (clock) share NL2700 (`src/capabilities.ts:169`), a host import shares NL3054 with `ffi`. Each has its own negative test, `tests/cases/reject_deterministic_*`.
- Criterion 4, "without the flag nothing moves". The generated C header's comment (`src/interop-header.ts:253`) now says the runtime units are compiled with `-ffp-contract=off`, for every build; `STAGE4_HEADER_LINES` was updated. Runtime code, IR and existing goldens did not move.
Likely files: `src/capabilities.ts`, `src/interop-header.ts`, `tests/nish-cmp.js`, `docs/LANGUAGE.md`.

### Decision needed
Two calls for the owner. Codes: keep the family codes (no change, criterion reworded) or split into two new codes (more precise, needs LANGUAGE.md rows and `.err` updates). Header: accept the comment change as part of the requested build change (no work) or revert only the wording (header differs by build). The issue recommends neither; both are cases where the signed-off wording was stricter than the request.
