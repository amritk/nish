---
name: Integer-valued JSON numbers
overview: Tell whether the tokenizer's current number token is a whole number by its value, the JSON Schema 2020-12 "integer" rule, from the token's text alone, and expose the same answer on JsonDocument. Additive; isInteger, integral, isI64 and isU64 keep their spelling-based meaning.
stages:
  - id: integral-by-value
    title: "feat(std): tell an integer-valued JSON number by its value"
    goal: JsonTokenizer and JsonDocument answer whether a number's value is a whole number, whatever its spelling, identically under Node and native, without an f64 and without overflow on any exponent
    verification: npm run check && npm run lint && node tests/run.js std_json && node tests/self/goldens.js --update (diff read), then one undegraded npm test
    status: pending
    todos:
      - id: tokenizer-isintegral
        content: Add JsonTokenizer.isIntegral() in std/json-tokenizer.ts, computed from the current number token's text — see Tokenizer
        status: pending
      - id: document-isintegral
        content: Add JsonDocument.isIntegral(v) in std/json-value.ts through the tokenizer method, false for a non-number — see Document
        status: pending
      - id: tests-link
        content: Add the cases to tests/link/std_json_tokenizer and tests/link/std_json_value, expected.out identical under Node and native — see Tests
        status: pending
      - id: docs-rows
        content: Update std/README.md's json-tokenizer and json-value rows, the guide page docs/guide/using-nish/standard-library.md, and docs/security/json.md if a limit is touched — see Docs
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens/checked/ with node tests/self/goldens.js --update and read the diff
        status: pending
---

# Integer-valued JSON numbers

## Context

JSON Schema 2020-12 calls a number an integer when its *value* is whole:
`1.0`, `1e2`, `100e-2` and `-0.0` are integers. Today's readers go by
spelling: `JsonTokenizer.integral` (the field), `isInteger()`/`numberI64()`,
`isU64()` and `JsonDocument.isI64`/`isU64` mean "written without a fraction or
an exponent, and it fits". A validator that runs during the parse, without
building a `JsonDocument`, needs the value rule on the tokenizer's current
number token.

No open issue or PR covers this (searched `amritk/nish`).

## Tokenizer

**Owns:** `std/json-tokenizer.ts`, `std/json-value.ts`, `tests/link/std_json_tokenizer/**`, `tests/link/std_json_value/**`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, `docs/security/json.md`, `tests/self/goldens/checked/**` (generated)

`isIntegral(): boolean` on `JsonTokenizer` — `false` unless the current token
is `JSON_TOK_NUMBER`. Computed from the token's bytes, never through an `f64`,
so `1e400` and `12345678901234567890.0` answer correctly.

Rule: let the digits be the integer and fraction digits run together, F the
number of fraction digits, E the exponent (signed), z the trailing zeros of the
digits. The value is integral iff every digit is zero, or E − F + z ≥ 0.

- Clamp the exponent while accumulating it (the module already caps exponent
  accumulation with `JSON_TOK_EXPONENT_CAP`; reuse that idea or that constant,
  whichever keeps the arithmetic in range). `1e99999999999` and
  `1e-99999999999` must answer `true` and `false` with no `i32` overflow.
  The clamp must be large enough that F and z (bounded by
  `JsonLimits` number bytes) can never flip the sign of the answer: a clamped
  E must still dominate F − z.
- The function body is also its meaning under Node (std/README.md): use only
  operations whose result is the same on both hosts — follow how the existing
  `integerScan`/`unsignedScan`/fast-path exponent scan read bytes with
  `toI32(src[i])`, i32 arithmetic kept in range so Node's doubles and native
  i32 agree.
- Doc comment: say plainly that this is the value rule (JSON Schema
  "integer"), that it says nothing about fitting an `i64`, and how it differs
  from the `integral` field and `isInteger()`, which keep the spelling rule.
  Add a line to those two doc comments pointing at `isIntegral`.

## Document

`isIntegral(v: JsonValue): boolean` on `JsonDocument`: the tokenizer's answer
for a number value (through `readNumber` and `this.numbers`, as `isI64` does),
`false` for any other kind and for a stale handle. Doc comment contrasts with
`isI64`/`isU64`.

## Tests

In the existing link tests (`units.ts` or wherever the module's number units
live), printing one line per case into `expected.out`, identical under Node and
native:

- integral: `0`, `-0`, `0.0`, `-0.0e5`, `1.0`, `1.000`, `1e2`, `1E+2`,
  `100e-2`, `12345678901234567890.0`, `1e400`
- not integral: `1.5`, `1e-1`, `10e-2`, `123.456e2`, `1e-400`
- huge exponents both signs: `1e99999999999` (true), `1e-99999999999`
  (false), `0e-99999999999` (true), and one exponent longer than the clamp
- `isIntegral` false on a string, a literal, an array and an object through
  `JsonDocument`, and `false` on a non-number tokenizer token
- one line pinning that the old readers did not change: `1.0` is
  `isIntegral` true and `isI64` false

## Docs

- `std/README.md` json-tokenizer and json-value rows: name `isIntegral` and
  the value-vs-spelling distinction.
- `docs/guide/using-nish/standard-library.md` `nish/json-tokenizer` and
  `nish/json-value` sections, where they list the number readers.
- `docs/security/json.md`: add to the record if the exponent clamp is a new
  bound (it is: say what it is and why no input overflows).

## Verification

`npm run check`, `npm run lint` (exit status, not a piped tail),
`node tests/run.js std_json`, `node tests/self/goldens.js --update` with the
diff read, one background undegraded `npm test` before the PR (read the skip
count). Not a `src/` change, so `wasi`/`performance` are not required.
