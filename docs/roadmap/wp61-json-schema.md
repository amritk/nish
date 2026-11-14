# WP61: Typed JSON from a JSON Schema, validated and coerced in one walk

**State:** Proposed · **Done:** 0 of 4 · **Design note:** [`docs/wp61-json-schema.md`](https://github.com/amritk/nish/blob/main/docs/wp61-json-schema.md)

## Stages

- [ ] S1: constraints in decode: a `constraints` option in `static readonly json` (bounds, lengths, `pattern`, `format`, `enum`, item counts, `uniqueItems`), each checked straight after its field's read, failing with `JSON_DECODE_CONSTRAINT` (-27) at the value; unconstrained IR byte-identical; the `docs/security/json.md` update
- [ ] S2: coercion: a per-field `coerce` option accepting a numeric string for a number and `"true"`/`"false"` for a boolean, under the same range checks and constraints; strict stays the default
- [ ] S3: the generator: `nish schema` writes deterministic classes from a draft 2020-12 schema (OpenAPI 3.1 `components.schemas` included), with `--check`, refusing what it cannot represent rather than weakening it
- [ ] S4: the "Typed JSON" guide page and error-code table, Bun and Node rows and a constrained workload in `bench/json-compare`, an `Ir/doc` gate *(owner's decisions)*

## Next

S1: [§5](https://github.com/amritk/nish/blob/main/docs/wp61-json-schema.md#5-constraints-in-the-class) and [§13](https://github.com/amritk/nish/blob/main/docs/wp61-json-schema.md#13-stages).

## Waiting on a decision

The option's shape, recording which keyword failed, where the generator lives, coercion's granularity, recursive `$ref`, checking on encode, and draft-07 ([§10](https://github.com/amritk/nish/blob/main/docs/wp61-json-schema.md#10-decisions-for-the-owner)).

## Not planned

A runtime schema interpreter, validating a `JsonDocument` against a schema, any second pass, untagged unions by trial decoding, string enums in the language, servers or clients generated from OpenAPI paths.

[All work packages](index.md)
