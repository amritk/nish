---
name: WP51 — references to capture-free top-level functions
overview: Stages 1 and 2 shipped function references in places, as arguments, | null and Map values; stage 3 (capture-free arrows in value position) is left, plus the owner's decisions on stage 2's per-call-site instantiation and refused field arguments.
roadmap: docs/roadmap/wp51-function-references.md
spec: docs/wp51-function-references.md
priority: 40
stages:
  - id: s3-arrows
    title: WP51 S3 — capture-free arrows in value position
    goal: A capture-free arrow in value position is admitted as a function reference with its own per-place set, through the same dispatcher lowering as a top-level function.
    verification: node tests/run.js fnref && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    todos:
      - id: s3-checker
        content: Admit a capture-free arrow as a reference member in the per-place pass and signature sets in src/ — see WP51 S3 — capture-free arrows in value position
        status: pending
      - id: s3-tests
        content: Add golden .ll, native round trip, negative tests, LANGUAGE.md rule, cookbook entry and guide page for arrows in value position — see WP51 S3 — capture-free arrows in value position
        status: pending
  - id: s2-acceptance-decisions
    title: WP51 S2 acceptance — per-call-site instantiation and refused field or element arguments
    goal: The owner has decided each item, and the kept ones are documented as final or the chosen ones scheduled.
    verification: node tests/run.js fnref && npm run lint
    status: pending
    issue: 1476
    labels: [needs-decision]
    todos:
      - id: acc-decide-record
        content: Record each decision in docs/wp51-function-references.md section 9 and the roadmap page — see WP51 S2 acceptance — per-call-site instantiation and refused field or element arguments
        status: pending
---

# WP51 — references to capture-free top-level functions

## Context
The design, the escape proof, stage 1 (references in fields, locals, arrays, returns, calls, `===`, per-place sets, the debug tag check) and stage 2 (arguments, `| null`, `Map` values) have landed; see [the roadmap page](../../docs/roadmap/wp51-function-references.md). Left is stage 3 and the decisions in #1476. Spec: [design note §9](../../docs/wp51-function-references.md#9-if-it-ships-stages).

## WP51 S3 — capture-free arrows in value position
Extends references to arrows that capture nothing, in value position. Closures, `Function` and references across the C ABI stay out of scope. It is a construct stage: golden `.ll`, `llvm-as` pass, native round trip, a negative test, the `docs/LANGUAGE.md` rule, cookbook entry and guide page, and goldens regenerated (`node tests/self/goldens.js --update`). Because it touches `src/`, run `node tests/run.js wasi` and `node tests/run.js performance`.
Likely files: `src/` per-place pass and dispatcher generation, `docs/LANGUAGE.md`, `docs/guide/`.

## WP51 S2 acceptance — per-call-site instantiation and refused field or element arguments
#1476 is the acceptance pass of stage 2. Two criteria differ from the plan, both deliberate:
- Criterion 2: the callee is instantiated once per call site (`apply$fn.16.nish_main$arrow3` and `arrow4` in `tests/cases/fnref_arg.ll`), not once per set as `$fn.ref.<set>`. A code-size cost, not a correctness one; the note's §9 records it.
- Criterion 1: a field read or array element passed directly is refused with NL2759 (`tests/cases/reject_fnref_arg_field.err`), because the arrow rewrite would read the place at every call; read it into a `const` first.
Related: NL2761 (a later argument assigns a reference argument) and NL2762 (a reference inside a `Result`; making a `Result` arm a place of the per-place pass would lift it).

### Decision needed
Keep per-call-site instantiation as final, or schedule per-set sharing? Keep the NL2759 refusal, or build an evaluate-once lowering (which would hide the argument's calls from escape analysis)? The issue gives no recommendation; the note already records both as shipped.
