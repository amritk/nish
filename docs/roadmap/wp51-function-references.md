# WP51: References to capture-free top-level functions

**State:** Proposed · **Done:** 1 of 4 · **Design note:** [`docs/wp51-function-references.md`](https://github.com/amritk/nish/blob/main/docs/wp51-function-references.md)

## Stages

- [x] Designed and measured: dispatch, the escape proof, the tag check, sets to 32 members and leaks
- [ ] Stage 1: references in fields, locals, arrays and returns; calls; `===`; per-place sets; the escape-join refusal; the debug-build tag check
- [ ] Stage 2: references as arguments, `| null` and `Map` values
- [ ] Stage 3: capture-free arrows in value position

## Next

Waiting on the recommendation, which is strict with stage 1's three requirements. Then stage 1. Spec: [§9](https://github.com/amritk/nish/blob/main/docs/wp51-function-references.md#9-if-it-ships-stages).

## Waiting on a decision

Accept strict over compatibility mode. Spec: [§8](https://github.com/amritk/nish/blob/main/docs/wp51-function-references.md#8-the-recommendation).

## Not planned

Closures, `Function`, and references across the C ABI.

[All work packages](index.md)
