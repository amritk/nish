# WP62: Nish classes from a JSON Schema

**State:** Proposed · **Done:** 0 of 4 · **Design note:** [`docs/wp62-json-schema-classes.md`](https://github.com/amritk/nish/blob/main/docs/wp62-json-schema-classes.md)

## Stages

- [ ] S1: `nish schema` for plain objects: scalars, strings, arrays, `required` and `optional`, defaults as initializers, every annotation as JSDoc, names and `rename`, a deterministic file with a header and `--check`, every other keyword refused with its JSON Pointer
- [ ] S2: `$defs` and `$ref`, maps, nullables, tagged unions from `const` and OpenAPI's `discriminator`, the flat `allOf` merge, recursion through arrays, maps and `| null`
- [ ] S3: validation keywords onto WP61's `constraints` literal, after WP61's S1; `--coerce` after its S2
- [ ] S4: the vendored schema corpus with per-schema counts, the guide page, and the reverse generator if taken *(owner's decisions)*

## Next

S1: [§12](https://github.com/amritk/nish/blob/main/docs/wp62-json-schema-classes.md#12-stages), and the keyword table it works from, [§4](https://github.com/amritk/nish/blob/main/docs/wp62-json-schema-classes.md#4-the-keyword-table).

## Waiting on a decision

[§10](https://github.com/amritk/nish/blob/main/docs/wp62-json-schema-classes.md#10-decisions-for-the-owner): whether WP62 replaces WP61's generator stage, a reverse generator, `readOnly`/`writeOnly`, unknown and `x-*` keywords, nullable `boolean` and type-discriminated unions, presence flags, field-name style, and where the generator lives.

## Not planned

A runtime schema interpreter, untagged unions by trial decoding, string enums, leaving absent optional keys out of the encoding, one file per `$defs` entry, OpenAPI 3.0, servers or clients from OpenAPI paths, a schema fetched over the network.

[All work packages](index.md)
