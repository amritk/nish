# WP62: Nish classes from a JSON Schema

**State:** Proposed · **Done:** 0 of 5 · **Design note:** [`docs/wp62-json-schema-classes.md`](https://github.com/amritk/nish/blob/main/docs/wp62-json-schema-classes.md)

## Stages

- [ ] S1: typed JSON prerequisites: an optional field whose default the constructor assigns (`[]`, `new Map()`, `new C()`, `new JsonNumber()`), with NL2498 reworded, a per-class `unknown: "ignore" | "error"` option, `new JsonNumber()` in a coerce class, and the `docs/security/json.md` update
- [ ] S2: `nish schema` for plain objects: scalars, strings, arrays, `required` and `optional`, the default rule with its warning, `additionalProperties` as `unknown`, every annotation as JSDoc, names and `rename`, a deterministic file with a header, its `Flags:` line and `--check`, every other keyword refused with its JSON Pointer
- [ ] S3: `$defs` and `$ref`, maps, nullables, tagged unions from `const` and OpenAPI's `discriminator`, the flat `allOf` merge, recursion through arrays, maps and `| null`
- [ ] S4: validation keywords onto WP61's `constraints` literal, `format` checked by default, after WP61's "S1: constraints in decode"; the transitive coerce switch after its "S2: coercion"
- [ ] S5: the vendored schema corpus with per-schema counts, the guide page, and the reverse generator if taken *(owner's decisions)*

## Next

S1: [§12](https://github.com/amritk/nish/blob/main/docs/wp62-json-schema-classes.md#12-stages), and the keyword table it works from, [§4](https://github.com/amritk/nish/blob/main/docs/wp62-json-schema-classes.md#4-the-keyword-table).

## Waiting on a decision

[§10](https://github.com/amritk/nish/blob/main/docs/wp62-json-schema-classes.md#10-decisions-for-the-owner): whether the typed JSON prerequisites land as WP62's S1 or in WP61, a reverse generator, `readOnly`/`writeOnly`, unknown and `x-*` keywords, nullable `boolean` and type-discriminated unions, presence flags, field-name style, where the generator lives, and whether `format` is checked by default.

## Not planned

A runtime schema interpreter, untagged unions by trial decoding, string enums, leaving absent optional keys out of the encoding, one file per `$defs` entry, OpenAPI 3.0, servers or clients from OpenAPI paths, a schema fetched over the network.

[All work packages](index.md)
