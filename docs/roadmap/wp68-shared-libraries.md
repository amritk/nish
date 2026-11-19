# WP68: Shared libraries, layered like atomic design

**State:** Proposed · **Done:** 1 of 9 · **Design note:** [`docs/wp68-shared-libraries.md`](https://github.com/amritk/nish/blob/main/docs/wp68-shared-libraries.md)

## Stages

- [x] S1: the survey of duplicated helpers, the benches that time the copies each cluster's bench names (§4.3 lists the rest), the tiers (atoms, molecules, organisms, pages) and their import rule (this note)
- [ ] S2: the hex atom from a 256-entry table (4.8x over `lower` on mixed bytes, 5.5x over `manifestHexDigit` on random hex, none established on digits alone; 1.5x over `lower` behind a range guard on `i32` code units, `bench/wp68-hex.ts`), with `std/atoms/`, `std/molecules/` and the `biome.json` tier rule and a fixture that breaks it
- [ ] S3: the decimal writer, two digits a step (5–6% over `http1PutDecimal` on non-negative values; on signed values `jsonWriterPutDigits64` is the baseline and is not beaten); the `integer<1, 20>` digit count benched first
- [ ] S4: the JSON escape molecule from `skipJsonPlain` and `copyBytes`, with a length and density switch that is benched first; callers of the byte loop gain 1.9x to 4.2x on sparse strings from 16 bytes
- [ ] S5: the big-endian load atom in the shift form, giving the same answer under Node, with its crypto records; no gain over `shifts` is established, and no caller bench exists. The shift form is 1.5x `std/bytes.ts` `getU32BE` in the micro-bench, and `getU32BE`'s one caller outside `std/bytes.ts` loads a DNS TTL once per record
- [ ] S6: the UTF-8 molecule: one RFC 3629 validator from the tokenizer's kernel path (`skipJsonText`, then `jsonTokUtf8Length`), its candidates benched first, the corner tests run against every former caller
- [ ] S7: the digit predicate, consolidated with no gain claimed and none lost
- [ ] S8: the byte-buffer grow, consolidated with each copy's policy kept or named
- [ ] S9: the FNV-1a step, consolidated with no gain claimed and none lost

## Next

S2: [§11](https://github.com/amritk/nish/blob/main/docs/wp68-shared-libraries.md#11-stages). After it, S3, S4, S5, S7, S8 and S9 do not depend on one another. S6 follows S4, because both edit `std/json.ts` and `std/json-tokenizer.ts`.

## Open questions

The owner's decisions D1 to D6, in [§9](https://github.com/amritk/nish/blob/main/docs/wp68-shared-libraries.md#9-decisions-for-the-owner): the tiers' directories and names, whether atoms are `@internal`, whether `src/` imports them under the seed freeze, how divergent copies are unified, whether biome enforces the rule, and which crypto callers keep their constant-time copies.

## Not planned

Moving or renaming a public `std/` module, folding `std/bytes.ts` into the atoms directory, and sharing code between `runtime/*.c` and Nish.

[All work packages](index.md)
