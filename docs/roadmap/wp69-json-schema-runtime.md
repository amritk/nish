# WP69: JSON Schema validation at run time, with external references

**State:** Proposed · **Done:** 0 of 5 · **Design note:** [`docs/wp69-json-schema-runtime.md`](https://github.com/amritk/nish/blob/main/docs/wp69-json-schema-runtime.md)

## Stages

- [ ] S1: `nish/json-schema` for 2020-12: a schema compiled from a `JsonDocument` validates any value of any document; in-memory `$ref`, `$defs`, `$id`, `$anchor` and `$dynamicRef`; the first error or all of them, each with ajv's fields (keyword, instance path, schema path, params); formats when asked; valid, invalid or unusable; no native recursion, a work budget and the other limits in `docs/security/json.md`
- [ ] S2: draft-04, draft-06, draft-07 and 2019-09 as ajv reads them, chosen by the caller or by `$schema` (draft-07 when neither says, as Spectral does); a caller's translation applied to each `pattern` before `nish/regex` compiles it
- [ ] S3: external references without I/O in the validator (compile answers what it is missing, the caller adds it), and the `nish/json-schema-file` loader: relative and `file:` references, YAML or JSON, an optional root
- [ ] S4: the `nish/json-schema-http` loader through `nish/net/fetch`: off unless enabled, `allowedHosts`, private, loopback and link-local addresses refused on every hop unless `allowPrivateHosts`, caps on bytes, time and fetches; its security record and index row
- [ ] S5: a differential against ajv 8 as Spectral configures it over the OpenAPI and AsyncAPI meta-schemas and a document corpus, the guide page, `std/README.md` rows and `docs/reference/`; whether ajv becomes a dev dependency or its answers are committed once *(open question)*

## Next

S1: [§4](https://github.com/amritk/nish/blob/main/docs/wp69-json-schema-runtime.md#4-the-decisions) and [§7](https://github.com/amritk/nish/blob/main/docs/wp69-json-schema-runtime.md#7-stages). S2, S3 and S4 follow in order; S5 can start once S2 lands.

## Open questions

How S5's differential gets ajv's answers: ajv 8 as a dev dependency of this repository, run by the test, or its answers generated once and committed beside the corpus ([§7](https://github.com/amritk/nish/blob/main/docs/wp69-json-schema-runtime.md#7-stages)).

## Not planned

Lookaround and backreferences in `pattern`, `better-ajv-errors`' wording and `ajv-errors`' `errorMessage` (the linter's), generating classes from a schema (that is WP62), applying defaults or coercing, `$data`, custom keywords and `$async`.

[All work packages](index.md)
