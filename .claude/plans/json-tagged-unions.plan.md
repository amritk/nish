---
name: Typed JSON for tagged unions
overview: Teach nish/json-typed to decode and encode discriminated unions of classes — the tag written on the wire as a string — as a field, an array element, a Map value, a nullable and the top-level value, recursive unions included, with no existing call shape changed.
stages:
  - id: json-tagged-unions
    title: feat(checker) — typed JSON decodes and encodes tagged unions
    goal: A union of classes round trips through jsonDecode, jsonDecodeUnion and jsonEncode wherever a class may appear today, recursive unions emit one function per union, and a bad tag answers JSON_DECODE_TAG.
    verification: npm run check && npm run lint && node tests/run.js json && node tests/run.js union && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    todos:
      - id: checker-union-shape
        content: Add a UNION kind to JsonField and accept a union (and union or null) as a field, array element, Map value and root in src/json-typed.ts jsonValueOf/jsonClasses/jsonRefusal — see Checker
      - id: wire-tag-rules
        content: Read the wire tag of each variant (enum member name, or the new json option tag) and its key (the tag field, renamed by rename); refuse clashing tags and disagreeing tag keys with new NL codes in src/codes.ts — see Wire tag
      - id: generics-exemption
        content: Let a union bind T for the json-typed routes only (src/generics.ts union-argument refusal) — see Checker
      - id: emit-union-parts
        content: Emit one memoised decode and one encode function per union plus array and map parts in src/emit-json.ts, dispatching on the tag to the per-variant parts — see Emitter
      - id: std-api
        content: Add JSON_DECODE_TAG, jsonDecodeUnion and any decoder helper (tag lookahead) to std/json-typed.ts with doc comments, and rewrite its header — see Library
      - id: tests-link
        content: Add tests/link/json_tagged_union (recursive Expr round trip, array, Map, nullable, top level, rename and tag options, bad tags, missing field) with expected.out and expected.ir — see Tests
      - id: tests-negative
        content: Add tests/cases/json_reject_union_* and tests/wordings pins for each new NL code — see Tests
      - id: docs
        content: Write the docs/LANGUAGE.md Typed JSON rule, the docs/guide/using-nish/standard-library.md section, the docs/security/json.md note and regenerate docs/reference — see Docs
      - id: goldens-cmp
        content: Regenerate tests/self/goldens, register any new positive case, and add nish-cmp DECLARED entries if corpus IR moves — see Verification
---

# Typed JSON for tagged unions

## Context

[`std/json-typed.ts`](../../std/json-typed.ts) decodes and encodes declared classes. The compiler writes the code from the class layout: [`src/json-typed.ts`](../../src/json-typed.ts) does the checking and [`src/emit-json.ts`](../../src/emit-json.ts) does the emitting. There is one memoised internal function per (part, class), so a recursive class becomes a plain recursive call. Unions are refused today in two places: [`src/generics.ts`](../../src/generics.ts) (~L1612, `holdsAnyUnion`) refuses one as a generic argument, and `jsonRefusal` refuses one as a field (NL2485/NL2486).

The language already has discriminated unions (docs/LANGUAGE.md "Discriminated unions"): `type Expr = Num | Unop | Binop`. Each variant's first field is a `readonly` tag of an **enum member** type, for example `readonly kind: ExprKind.Num = ExprKind.Num`. At runtime that tag is an `i32` at offset 0 of `%union.tagged`. Nish enums are numeric only, and there are no string-literal types. So the JSON tag `"num"` has to be mapped to an enum member by a rule, which this plan sets.

A Nish rewrite of vector reads and writes recursive tagged-union JSON: `{ "kind": "binop", "op": "+", "left": {...}, "right": {...} }`. Today it needs a hand-written decoder over `json-value` for each union, and those decoders drift from the schema.

## Approach

| Decision | Choice | Why |
| --- | --- | --- |
| Tag key on the wire | The union's tag field name (one name across variants already, NL2525). `rename` can change it; every variant of one union must give the same wire key, or a new NL code is raised. | No new knob. It reuses the class options. |
| Tag value on the wire | The enum member's **name** by default (`enum ExprKind { num, unop, binop }` → `"num"`). A variant may override it with a new option, `static readonly json = { tag: "rfc-contract" }`. Two variants of one union reached by a route may not share a wire tag (new NL code). | It needs zero options for the common case, and it covers tags that are not identifiers. |
| Top-level decode | New `jsonDecodeUnion<T>(d: JsonDecoder, prev: T): T`. It answers `prev`, decoded into, when the input's tag is `prev`'s variant. Otherwise it answers a new variant. On failure it answers `prev`, and `d.failed` holds the code. `jsonDecode(d, out)` keeps refusing a union `out`, now with a message pointing at `jsonDecodeUnion`. | Type arguments are never written at a call site (LANGUAGE.md, generics), so `T` must come from an argument. `out` cannot change variant in place. This keeps the reuse semantics jsonDecode has. |
| Top-level encode | `jsonEncode(w, value)` accepts a union `value`. | The existing shape works unchanged. |
| Field, element and Map value | A union slot reuses its current object when the tag matches its variant. Otherwise it makes the variant with `new V()` (the same rule as a `| null` field). An array element past the end and a Map value are made fresh. | It matches today's class-slot rules. |
| A variant on its own | A class whose first field is a union tag decodes and encodes the tag as its wire string, and checks the decoded tag equals its own. | A field typed as one variant must agree with the union form. |
| Tag position in input | Anywhere in the object. Fast path: the tag is the first key. Otherwise the decoder marks its position, skips key/value pairs at this level with `skipValue` until the tag key, rewinds, and dispatches. | Key order is not guaranteed by producers. |
| Bad tag | `JSON_DECODE_TAG = -26` (next free code) for a missing tag, a tag that is not a string, and a string no variant has. `errorAt` is the tag value, or the object for a missing one. | One new code, as asked. |
| Code size | One `.json.decode.union.<U>` and one `.json.encode.union.<U>` per union per module, memoised like class parts. They call the per-variant class parts. Array and Map parts of a union are their own memoised parts. | A recursive union becomes a recursive call, so the generated code stays linear in the number of types. |
| Encode order | The tag first. This already holds, because the tag is the first field (NL2523); the encoder writes the wire string, not the number. | As asked. |

The lookahead re-reads one object's keys once per union level whose tag is not first. A crafted input that puts the tag last at every level costs at most `maxDepth` × the input. That bound goes in `docs/security/json.md` with a test that pins it (decode stays linear when the tag is first).

## Checker

- In `JsonField`/`jsonValueOf`, add a `UNION` kind (plus array-of-union, and a union as a `Map` value). Use `table.isUnion`/`variantsOf`. Every variant must be a declared, non-generic class that `jsonClassOf` accepts. An interface variant is refused with the NL2486 wording, naming the variant.
- `jsonClasses` walks the variants, so the readonly/constructor refusals (NL2487/NL2488) cover them. The tag field itself is the one `readonly` field allowed, because it is the tag.
- `src/generics.ts`: let a union bind `T` only when the callee is a json-typed route (`jsonRouteOf`). Everything else still gets `unionArgumentMessage`.
- `jsonDecode(d, out)` with a union `out` is refused with a message pointing at `jsonDecodeUnion`. That is a new NL code, or new wording on NL2486; choose whichever `src/codes.ts` conventions favour.

## Wire tag

- Add `tag` to the `static readonly json` keys (`noteJsonOptions`/`checkJsonOptions`). Its value is a string literal. It is allowed only on a class whose first field is a union tag (new NL code otherwise).
- Store the wire tag on the class info (or derive it at emit time from the enum member name). Use the same fact for decode dispatch and encode.
- New NL codes, at the next free number in their band, each with a `tests/wordings` pin: a wire tag shared by two variants of one union; variants that disagree on the tag's wire key; `tag` on a non-variant class.

## Emitter

- New `PART_DECODE_UNION`, `PART_ENCODE_UNION`, `PART_DECODE_UNION_ARRAY`, `PART_ENCODE_UNION_ARRAY`, and union-valued map parts, or extend the existing array and map parts to take a union element. Names follow the `jsonPartName` scheme, for example `.json.decode.union.Expr`.
- Decode union part: `beginObject`, then find the tag (fast path or lookahead), then compare the tag string against each variant's wire tag. A `switch` on length then a `memcmp` is fine. Then either reuse the slot (the tag at offset 0 equals the variant's enum value) or call `.json.new.V`, then call the variant's class decode body positioned inside the object. The tag key, when it is met again in the body, is checked against the variant and counted as seen.
- Encode union part: load the tag at offset 0 and `switch` to `.json.encode.V`, which writes the wire tag string first.
- `emitJsonRoute` handles a union root for `jsonEncode` and `jsonDecodeUnion`.
- Write no attribute without a proof (`src/attributes.ts`). `markJsonRoute` must know the new parts' callees.

## Library

- `std/json-typed.ts`: `export const JSON_DECODE_TAG: i32 = -26` with a doc comment. Add `jsonDecodeUnion` with a Node body that panics like `jsonDecode`, plus `@param`/`@returns`. Add the decoder's mark/rewind (or tokenizer save/restore) helper if one is needed; extend `std/json-tokenizer.ts` only if the decoder cannot do it alone.
- Header: unions in the field table, the wire-tag rules, the `tag` option, `jsonDecodeUnion`'s call shape, and `JSON_DECODE_TAG` in the error table.

## Docs

- `docs/LANGUAGE.md` → "Typed JSON": the rule (tag key, wire value, `tag` option, call shapes, `JSON_DECODE_TAG`, lookahead cost), the new codes, and their tests. Cross-link from "Discriminated unions".
- `docs/guide/using-nish/standard-library.md` → `## nish/json-typed`: a compiled example of a recursive `Expr` round trip (page rules: docs/README.md "Writing a guide page").
- `docs/security/json.md`: the lookahead bound and its test.
- Regenerate `docs/reference` with `node scripts/gen-reference.mjs`. Update `docs/AI.md` and `llms.txt` only if they list what typed JSON accepts.

## Tests

- `tests/link/json_tagged_union/` (registered in `tests/run.js` beside `std_json_typed`):
  - Recursive `Expr` (`num`, `unop`, `binop`, plus one variant with a `tag` option): decode a nested text, encode it, and print whether the output equals the input byte for byte.
  - The input with the tag last in some objects decodes to the same value.
  - `Expr[]` and `Map<string, Expr>` fields, an `Expr | null` field, and the top level through `jsonDecodeUnion`, including the reuse/new-variant case.
  - A missing tag, an unknown tag, and `"kind": 1` each print `JSON_DECODE_TAG`. A `binop` missing `right` prints `JSON_DECODE_MISSING`.
  - `expected.ir` pins the emitted IR of one small union (one `.json.decode.union.*` define and its tag dispatch). The PR body quotes that IR.
- `tests/cases/json_reject_union_*` with `.err`, one per new code, plus an interface variant and `jsonDecode` with a union `out`.
- Existing `std_json_typed`, `json_presence` and the `json_reject_*` cases pass unchanged. That is the "no call shape changed" evidence.

## Out of scope

- String-literal types or string enums in the language.
- Unions whose variants are not classes (scalars, arrays), and untagged unions.
- `nish/json-value` and the TypeScript emitter's runtime behaviour beyond the existing Node panic.

## Verification

```bash
npm run check
npm run lint
npm run lint:dead
node tests/run.js json
node tests/run.js union
WASI_SYSROOT=/usr node tests/run.js wasi
node tests/run.js performance
node tests/self/goldens.js --update   # then read the diff
node tests/differential/goldens.js --update   # if a positive tests/cases file is added
node scripts/gen-reference.mjs --check
node scripts/gen-diagnostic-codes.mjs --check
node docs/check-links.mjs
node tests/nish-cmp.js   # add DECLARED entries if corpus IR moves
```

**Owns:** `src/**`, `std/json-typed.ts`, `std/json-tokenizer.ts`, `tests/link/json_tagged_union/**`, `tests/cases/json_reject_union_*`, `tests/wordings/**`, `tests/run.js`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`, `tests/fuzz/targets/json-typed.ts`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/security/json.md`, `docs/reference/**`, `docs/AI.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `llms.txt`, `scalar.config.json`, `scripts/undocumented.txt`
