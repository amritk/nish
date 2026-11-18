# WP68: Shared libraries, layered like atomic design

**State:** Proposed · **Done:** 0 of 7 · **Design note:** [`docs/wp68-shared-libraries.md`](https://github.com/amritk/nish/blob/main/docs/wp68-shared-libraries.md)

## Stages

- [ ] S1: the survey of duplicated helpers, the benches that pick each cluster's fastest copy, the tiers (atoms, molecules, organisms, pages) and their import rule (this note)
- [ ] S2: the hex atom from a 256-entry table (7.1x on `bench/wp68-hex.ts`), with `std/atoms/`, `std/molecules/` and the `biome.json` tier rule and a fixture that breaks it
- [ ] S3: the big-endian load atom (1.5x), giving the same answer under Node, with its crypto records
- [ ] S4: the JSON escape molecule: runs above a length threshold (4.4x on 1 KiB strings), byte by byte below it
- [ ] S5: the UTF-8 molecule: one RFC 3629 validator, an ASCII word skip where the input is mostly ASCII, the corner tests run against every former caller
- [ ] S6: the decimal writer, two digits a step (5–8%)
- [ ] S7: the digit predicate, the buffer grow and the FNV-1a step, consolidated with no gain claimed and none lost

## Next

S2: [§11](https://github.com/amritk/nish/blob/main/docs/wp68-shared-libraries.md#11-stages). After it, S3, S6 and S7 do not depend on one another. S5 follows S4, because both edit `std/json.ts` and `std/json-tokenizer.ts`.

## Open questions

The owner's decisions D1 to D6, in [§9](https://github.com/amritk/nish/blob/main/docs/wp68-shared-libraries.md#9-decisions-for-the-owner): the tiers' directories and names, whether atoms are `@internal`, whether `src/` imports them under the seed freeze, how divergent copies are unified, whether biome enforces the rule, and which crypto callers keep their constant-time copies.

## Not planned

Moving or renaming a public `std/` module, folding `std/bytes.ts` into the atoms, and sharing code between `runtime/*.c` and Nish.

[All work packages](index.md)
