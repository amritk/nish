# WP61: Typed JSON, constraints and coercion in one pass

**State:** Proposed · **Done:** 0 of 3 · **Design note:** [`docs/wp61-json-typed-checks.md`](https://github.com/amritk/nish/blob/main/docs/wp61-json-typed-checks.md)

## Stages

- [ ] S1: constraints in decode. A `constraints` option in `static readonly json` covers bounds, lengths, `pattern`, `format`, `enum`, item counts and `uniqueItems`. Each is checked straight after its field's read and fails with `JSON_DECODE_CONSTRAINT` (-27) at the value. Unconstrained IR stays byte-identical. Includes the `docs/security/json.md` update.
- [ ] S2: coercion. With `coerce: true`, `jsonDecode` always answers `OK` with a correct instance. Lossless conversions follow an exact table; otherwise the field takes the class's own default. Malformed JSON and limits stop the reading but do not fail the decode. `reason` and `errorAt` stay readable after the `OK`. A per-field converted/defaulted record is always on or opt-in, as measurement decides.
- [ ] S3: the "Typed JSON" guide page and error-code table; Bun and Node rows, constrained and coercion workloads in `bench/json-compare`; an `Ir/doc` gate.

## Next

S1: [§4](https://github.com/amritk/nish/blob/main/docs/wp61-json-typed-checks.md#4-constraints) and [§11](https://github.com/amritk/nish/blob/main/docs/wp61-json-typed-checks.md#11-stages).

## Waiting on a decision

The option's shape, recording which keyword failed, checking on encode, and refusing a coerce class that reaches a strict one ([§9](https://github.com/amritk/nish/blob/main/docs/wp61-json-typed-checks.md#9-decisions-for-the-owner)).

## Not planned

Generating classes from a schema (that is WP62), a runtime schema interpreter, validating a `JsonDocument` against a schema, any second pass, coercion of unions, and reading past a limit or a syntax error.

[All work packages](index.md)
