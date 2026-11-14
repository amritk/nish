# WP61: Typed JSON from a JSON Schema, validated and coerced in one walk

**Status: proposed, design only.** Nothing here is built. This note proposes
four stages: constraints checked inside `jsonDecode` (S1), opt-in coercion
inside the same read (S2), a generator that writes Nish classes from a JSON
Schema (S3), and the guide page and benchmarks (S4). Every claim about today's
compiler is anchored at commit `798636cb`; a citation is a function name and
`file:line` at that commit. [LANGUAGE.md](LANGUAGE.md) stays normative.

Two things are decided by the owner and this note does not reopen them:

1. **The class is the single source of truth.** A JSON Schema is an *input*
   that produces Nish classes, each with its `static readonly json` options
   (rename, optional, presence, tag, and the constraints this note adds). The
   compiler then writes the decoder from the class, as it does today. There is
   no runtime schema interpreter: nothing reads a schema while a document is
   decoded.
2. **One walk.** Validation and coercion happen inside `jsonDecode`'s single
   pass. A constraint is checked, and a coercion applied, as the field's value
   is read: never in a second pass over the object, and never over a
   `JsonDocument` tree built first.

## 1. The problem

A Nish program that receives JSON from a peer writes a class and calls
`jsonDecode` (`std/json-typed.ts:1626`). The decoder the compiler writes for it
checks the *shape*: every key names a field (`JSON_DECODE_UNKNOWN`, `:419`),
none is given twice (`DUPLICATE`, `:425`), none required is missing (`MISSING`,
`:427`), and every value has its field's type (`TYPE`, `:411`) and fits it
(`RANGE`, `:417`). It checks nothing a JSON Schema says beyond the shape: a
`name` that must be 1 to 64 characters, an `age` from 0 to 150, a `status`
that must be one of three strings, an `email` that must be an email. Today the
program checks those after the decode, by hand, field by field, or not at all.

Two costs follow. A check written by hand after the decode is a second walk
over the decoded object, separated from the bytes that produced each value, so
the error has no offset: the program can say "age out of range" but not where
in the body. And the API's contract is written twice, once as the OpenAPI or
JSON Schema document the service publishes and once as Nish classes and hand
checks, which drift.

The comparison the owner set is Bun. `JSON.parse` there gives an untyped
value; a TypeScript program then checks it by hand or with a validator, a
second walk over the tree. Bun's typed `JSON.parse<T>` refuses `{"id":"7"}` for
`id: number`, and so does Nish today: `d.i32()` reads the token, finds a string,
and fails with `JSON_DECODE_TYPE` at byte 6, the string's first byte
(`integer`, `std/json-typed.ts:1077`, calling `wrongType`, `:673`, which fails
at `this.tok.tokStart`). Strict stays the default in this package; coercion is
something a class asks for (§6).

## 2. What exists today

### 2.1 The typed layer

`nish/json-typed` is two halves, a library and the compiler's lowering.

**The library**, `std/json-typed.ts`:

- `jsonDecode(d, out)` (`:1626`), `jsonDecodeUnion(d, prev)` (`:1647`) and
  `jsonEncode(w, v)` (`:1662`) are generic functions the compiler lowers in
  place, per module, into one internal function per class, array, map and
  union it meets (a "part"). Under Node, where the types are erased, the three
  end the program with an error.
- `JsonDecoder` (`:584`) holds the tokenizer and two sticky fields, `failed`
  and `errorAt`. `fail(code, at)` (`:659`) records the first error only, so a
  later read cannot overwrite where the first went wrong. `wrongType()`
  (`:673`) is `@internal`, called by name by the generated decoder.
- The value reads are methods: `i32()` (`:1103`), `u32()`, `i64()` (`:1131`),
  `u64()`, `number(n)` (`:1166`), `f64()` (`:1199`), `boolean()` (`:1215`),
  `string(cur)` (`:1233`), and the array and `| null` variants that follow
  them. The four integer reads share `integer(lo, hi, bounded)` (`:1077`),
  which already compares a value with a range and fails with
  `JSON_DECODE_RANGE` at `tok.tokStart`.
- The codes are `JSON_DECODE_OK = 0` (`:404`) and `TYPE = -20` through
  `TAG = -26` (`:411` to `:442`). **The next free code is -27.** The
  tokenizer's own codes are -1 to -13.

**The checker half**, `src/json-typed.ts`:

- A field's kind is one of `JSON_FIELD_SCALAR` to `JSON_FIELD_TAG` (`:48` to
  `:66`), recorded on a `JsonField` (`:72`).
- `checkJsonOptions` (`:507`) reads the `static readonly json` literal. Its
  whitelist is one line, `src/json-typed.ts:542`:
  `option !== "rename" && option !== "optional" && option !== "presence" &&
  option !== "tag"`. Anything else is NL2494. Each option has its own reader:
  `jsonReadRename` (`:267`), `jsonReadOptional` (`:317`),
  `jsonReadPresence` (`:383`) and `jsonReadTag` (`:467`).

**The emitter half**, `src/emit-json.ts`:

- Its header (`:1` to `:59`) shows the decode a class gets: `beginObject`, a
  `while (nextField)` loop, a `switch` on the key's length and `keyIs`, a
  `seen` flag per field for the duplicate check, `out.x = d.i32()`, and the
  `missingField` checks after the loop. The generated code "has no error path
  of its own": every failure is recorded by a `JsonDecoder` method.
- `emitJsonDecodeBody` (`:911`) writes that body. `emitJsonDecodeValue`
  (`:1054`) writes one field's read. A scalar other than a string is one line,
  `jsonStore(emitter, place, jsonCallMethod(..., jsonScalarMethod(f.scalar),
  ...))` (`:1057`); a string goes through `emitJsonDecodeInto` (`:1207`), which
  calls `d.string(target)` (`:1217`). An enum field is read with `d.i32()` and
  checked by a `switch` on its members (`emitJsonEnumCheck`, `:1029`), whose
  other arm calls `wrongType` (`:1070`).

**The key fact for this note:** every read takes exactly one token, so after
`d.i32()` or `d.string(cur)` returns, `tok.tokStart` still points at the first
byte of the value just read (`take`, `std/json-typed.ts:683`, consumes the
token; the next `take` is the next read's). A check placed straight after the
read can fail at the value's offset, in the same pass, with no new state.
`emitJsonEnumCheck` already does exactly this for enums.

### 2.2 The JSON Schema pieces already in `std/`

These were written for JSON Schema and are what S1 calls:

| Module | What it gives | Where |
| --- | --- | --- |
| `nish/json-format` | draft 2020-12 §7.3 formats; `jsonFormatId(name)` resolves a name once, `jsonFormatCheck(id, s)` checks each instance: `JSON_FORMAT_VALID = 1`, `INVALID = 0`, `UNKNOWN = -1` | `std/json-format.ts:1046`, `:1151`; codes `:79` to `:83` |
| `nish/json-number` | exact decimal compare and `multipleOf`, never through `f64` | `jsonNumberCompare`, `std/json-number.ts:295`; `jsonNumberMultipleOf`, `:445` |
| `nish/json-equal` | equality and a hash over `JsonDocument` values, for `const`, `enum` and `uniqueItems` | `std/json-equal.ts:155`, `:310` |
| `nish/json-pointer` | parse and resolve RFC 6901 pointers, for `$ref` | `jsonPointerResolve`, `std/json-pointer.ts:246` |
| `nish/regex` | a compiled regex that never backtracks | `regexCompile`, `std/regex.ts:4940`; `Regex`, `:2100`; `test`, `:4626` |

`JsonNumber` (`std/json-typed.ts:467`) already keeps a number's text exactly.

### 2.3 What is new

- A `constraints` option in the literal, its checker, and the checks it emits.
- `JSON_DECODE_CONSTRAINT = -27`.
- A `coerce` option, and coercing reads in `JsonDecoder`.
- A generator from a JSON Schema to Nish source.
- A "Typed JSON" guide page with the error-code table, and Bun and Node rows
  in `bench/json-compare`.

## 3. The decision

The schema becomes classes once, when the program is built, by a generator
(§7). Each schema keyword the class cannot already say is a *constraint*
written in the class's options literal, beside `rename` and `optional`, with
the keyword's own JSON Schema name:

```ts
class User {
  static readonly json = {
    rename: { userId: "user_id" },
    optional: ["email"],
    constraints: {
      name: { minLength: 1, maxLength: 64, pattern: "^[A-Za-z][A-Za-z0-9_]*$" },
      age: { minimum: 0, maximum: 150 },
      email: { format: "email" },
      role: { enum: ["admin", "member", "guest"] },
      tags: { maxItems: 16, uniqueItems: true },
    },
  };
  userId: i64 = 0;
  name: string = "";
  age: i32 = 0;
  email: string | null = null;
  role: string = "member";
  tags: string[] = [];
}
```

The compiler writes the check for each constraint straight after the read of
its field, in the code it writes today. A class with no `constraints` is
decoded by exactly the code it has now (§8). A failed constraint is
`JSON_DECODE_CONSTRAINT` at the first byte of the offending value, recorded by
the same sticky `fail`, so `failed` and `errorAt` mean what they mean today and
a program that checks `d.failed` needs no change.

Why the class literal and not something else:

- It is the one place a class's wire contract already lives, checked where the
  class is declared whether or not anything decodes it (the header,
  `std/json-typed.ts:169`). A reader of the class sees the rule.
- It is a literal, so the compiler knows every bound, pattern and format at
  build time: a pattern is compiled once (§5.4), a format's id is resolved
  once, and an integer bound becomes two `icmp`s.
- The keyword names are JSON Schema's, so the generator copies a keyword
  across without translation, and a person writing a class by hand uses the
  names the schema documentation uses.
- It needs no new syntax: no decorator, no type-level annotation. `src/` is
  untouched by the rolling freeze until the next release ships the option (§9).

## 4. The schema → type mapping

Draft **2020-12** is the dialect (§4.3). Each row is what the generator writes.
The field types are the ones the decoder takes today (the table at
`std/json-typed.ts:45` to `:80`); nothing below adds a field type.

| Schema | Nish | Notes |
| --- | --- | --- |
| `type: "integer"` | `i64` | narrowed when `minimum` and `maximum` are both given and fit: `u32` when the range is within [0, 2^32 − 1], `i32` when within [−2^31, 2^31 − 1] (`u32` preferred for a non-negative range), `u64` when the minimum is ≥ 0 and the maximum exceeds `i64`. A bound that fits the type exactly is the type's own range check (`RANGE`), not a constraint; a tighter one stays a constraint. |
| `type: "number"` | `f64` | `JsonNumber` when the generator is asked for exactness (`--exact-numbers`), or when the schema gives a `multipleOf` that is not an integer or a bound with more than 15 significant digits. |
| `type: "string"` | `string` | `minLength`, `maxLength`, `pattern`, `format` become constraints. |
| `type: "boolean"` | `boolean` | |
| `type: "array"`, `items: S` | `S'[]` | `minItems`, `maxItems`, `uniqueItems` become constraints. `prefixItems` (a tuple) is refused. |
| `type: "object"` with `properties` | a class, named from its `title` or the property path | `additionalProperties: false` is today's strict decode; absent or `true`, the class sets `ignoreUnknown` in the decoder the generated `decode` helper makes (§7.2). |
| `additionalProperties: S` and no `properties` | `Map<string, S'>` | `minProperties`/`maxProperties` constrain the map; with `properties` as well it is refused. |
| a property not in `required` | listed in `optional`, with an initializer | the initializer is the schema's `default` when given and representable, else the type's zero, or `null` for a nullable field. |
| `type: [T, "null"]`, or `oneOf: [S, {type: "null"}]` | `T' \| null` | as the decoder takes today. |
| `type: "string"`, `enum: [...]` of strings | `string` with an `enum` constraint | Nish has no string enums; the constraint is a `switch` on length and bytes, as key dispatch is (`emitJsonDispatch`, `src/emit-json.ts:858`). |
| `enum` of integers | `i32` with an `enum` constraint | a numeric Nish `enum` is not generated: its members would need names the schema does not give. |
| `const: v` | the `enum` constraint with one value | |
| `oneOf` of objects each with a `const` property, or with OpenAPI's `discriminator.propertyName` | a tagged union: a Nish `enum` of the tags, one class per variant with `readonly kind: Kind.X`, and `tag` set to the wire string | as `jsonDecodeUnion` takes today (the header at `std/json-typed.ts:267`). The tag field may be any property name; `rename` maps it. |
| `$ref` to `#/$defs/X` (or `#/components/schemas/X`) | the shared class `X` | resolved with `jsonPointerResolve`; one class per definition, however often it is referenced. |
| `allOf` of a `$ref` and an object, or of objects whose properties do not overlap | one class with the union of the properties | the one merge accepted. |
| `title`, `description`, `examples`, `deprecated`, `$comment` | a doc comment on the class or field | |

### 4.1 Refused, with a diagnostic

The generator refuses what it cannot represent exactly. **It never silently
weakens a schema**: a schema the program publishes and a decoder that accepts
more than it says is the bug this package exists to remove. Each refusal names
the keyword and its JSON Pointer in the schema, and exits non-zero with nothing
written:

- `allOf` beyond the merge above (overlapping properties, conflicting types,
  a constraint on a merged property from two branches);
- `anyOf`, and `oneOf` with no `const` or `discriminator` tag (an untagged
  union would need trial decoding, which is a second walk);
- `not`, `if`/`then`/`else`, `dependentSchemas`, `dependentRequired`;
- `patternProperties`, `propertyNames`, `unevaluatedProperties`,
  `unevaluatedItems`, `contains`, `prefixItems`;
- `type` with two non-null types (`["string", "integer"]`);
- `$dynamicRef`, `$anchor`, and a `$ref` outside the document;
- a recursive `$ref` (a class that holds itself through a field): the decoder
  today recurses one frame per level (JSON-7 in `docs/security/json.md`), and a
  self-typed field that is not `| null` needs an object of its own type at
  construction, which has no end; refused until the owner decides (§10, question 5);
- `format` a name `jsonFormatId` answers `JSON_FORMAT_UNKNOWN` for, unless the
  generator is told `--unknown-format=ignore`, the one weakening that is asked
  for by name, as draft 2020-12 itself treats `format` as an annotation by
  default.

### 4.2 Required, optional and defaults

JSON Schema's default is that every property is optional; Nish's is that every
field is required. The generator writes every property not in `required` into
`optional`, so the generated class means what the schema says. A property in
`required` with a `default` keeps `required`: the default is documentation.

### 4.3 The dialect, and what OpenAPI 3.1 gives for free

Draft 2020-12, because `nish/json-format` already implements its §7.3 formats
and OpenAPI 3.1's Schema Object *is* 2020-12. A `$schema` naming another
draft is refused, except draft-07 when it uses only keywords whose meaning did
not change (`items` as one schema, no `$defs`/`definitions` conflict), which
the generator accepts with a note.

What comes free from OpenAPI 3.1: the generator reads a document whose
`components.schemas` is a map of schemas, resolves `#/components/schemas/X`
the same way as `#/$defs/X`, and takes `discriminator.propertyName` and
`discriminator.mapping` as the tag. Paths, operations and parameters are not
read: this generates types, not a server (that is WP43's router).

## 5. Constraints in the class

### 5.1 The option

`constraints` maps a field name to an object of keywords. `checkJsonOptions`
(`src/json-typed.ts:507`) admits it in the whitelist at `:542` and reads it in a
new `jsonReadConstraints`, beside `jsonReadRename` (`:267`). Every value is a
literal: a number literal for a bound, a string literal for `pattern` and
`format`, an array literal of string or integer literals for `enum`, `true`
for `uniqueItems`. Each keyword is checked against its field's type where the
class is declared:

| Keyword | Field types | Check emitted after the read |
| --- | --- | --- |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` | integers | two `icmp`s against constants |
| | `f64` | `fcmp` against the bound's `f64`, when the bound's literal is exactly an `f64`; otherwise refused unless the field is `JsonNumber` |
| | `JsonNumber` | `jsonNumberCompare(text, bound)` (`std/json-number.ts:295`) on the number's text, exact |
| `multipleOf` | integers | `srem` against a constant |
| | `JsonNumber`, `f64` | `jsonNumberMultipleOf` (`std/json-number.ts:445`) on the token's text, exact; its own error codes (`:51` to `:57`) are the constraint's failure |
| `minLength`, `maxLength` | `string` | the decoded string's length in code points, as JSON Schema counts it: the count of its bytes that are not UTF-8 continuation bytes |
| `pattern` | `string` | the module's compiled `Regex`, `test` (`std/regex.ts:4626`) |
| `format` | `string` | `jsonFormatCheck(id, s)` (`std/json-format.ts:1151`), with `id` folded to a constant at build time |
| `enum` | `string`, `i32`, `i64` | a `switch`: on length then bytes for strings, on value for integers |
| `minItems`, `maxItems` | arrays | the decoded array's length |
| `uniqueItems` | arrays of integers, strings, booleans | a `Set` over the elements as they are read (§5.3) |
| `minProperties`, `maxProperties` | `Map<string, V>` | the map's size |

A keyword on a field of a type it does not apply to, a bound that is not a
literal of the right kind, `minLength` greater than `maxLength`, a pattern
`regexCompile` refuses, a format `jsonFormatId` does not know, and an `enum`
value not of the field's type are each a diagnostic at the keyword. The codes
are new; they take the next free numbers in `src/codes.ts` when S1 lands
(NL2786 onward at `798636cb`). NL2494's message lists `constraints` and, in
S2, `coerce` among the options.

The option is a literal for the reason the others are: the compiler needs its
values while it writes the code. A constraint computed at run time is the
program's own check, written after the decode as today.

### 5.2 Where the check goes, and the error

`emitJsonDecodeValue` (`src/emit-json.ts:1054`) writes, for a field with
constraints, its read as today and then the checks, in the order of the table
above, each a branch to one block that calls a new `@internal` method:

```ts
/** `JSON_DECODE_CONSTRAINT` at the current token, unless a read failed already. */
constraintFailed(): void {
  this.fail(JSON_DECODE_CONSTRAINT, this.tok.tokStart)
}
```

the twin of `wrongType` (`std/json-typed.ts:673`). Because `fail` keeps the
first error only and every read after a failure returns at once (`take`,
`:683`), the decode stops being useful at the first failed constraint and
`errorAt` is the first byte of the value that broke it. The decode is not
aborted early: it runs on through cheap no-op reads as it does after any
failure today, which is what keeps the generated code free of an error path.

For an array, `minItems`/`maxItems` are checked once the array closes, and
`errorAt` is the array's `[`: the read leaves `tokStart` at its last token, so
the array part saves its opening offset first, one `i32` local. The same holds
for a `Map`'s `minProperties`/`maxProperties`.

**Which keyword failed.** `failed` and `errorAt` say what and where.
Recommended: one more `i32` field on `JsonDecoder`, `failedKeyword`, set by
`constraintFailed`, which then takes the keyword as an argument, to a
`JSON_KEYWORD_*` constant, so a server can
answer "`age`: maximum" without the program re-checking. It costs a store on
the failure path only. Owner's decision (§10, question 2).

### 5.3 One walk, and what "one walk" allows

Every check reads the value the field read just produced, or the token that
produced it. None reads the document again, and none walks the decoded object
after the decode. Two checks read bytes of a value a second time, bounded by
that value: `minLength`/`maxLength`, `pattern` and `format` read the decoded
string (once each; S1 folds the length count into `text()`'s copy where
`string(cur)` already copies), and `uniqueItems` hashes each element as it is
read. Neither is a pass over the document: their cost is proportional to the
constrained value, which is the bar §8 sets.

`uniqueItems` on an array of scalars or strings inserts each element into a
`Set` the array part owns and resets per decode; a repeat fails at the
repeated element's first byte, so this one check fails *during* the array, not
after it. `uniqueItems` on an array of objects is refused: equality of two
decoded objects is a deep compare the class does not have, and doing it over
a `JsonDocument` would be the second walk the owner ruled out.

### 5.4 The pattern, compiled once

A `pattern` is a string literal, so the compiler knows it. It checks it with
the same `regexCompile` the program would call (refusing a pattern the module
refuses), and the module that decodes the class gets one module-scoped `Regex`
per distinct pattern, compiled on the first decode that needs it and kept.
JSON Schema's patterns are ECMA-262 and unanchored; `nish/regex` is JavaScript
syntax (`std/regex.ts:19`) and `test` searches, so a pattern means
the same in both. Its cost is bounded in §11.

### 5.5 `format`

`jsonFormatId` (`std/json-format.ts:1046`) runs at build time on the literal;
the generated check is `jsonFormatCheck(<constant>, s) !== JSON_FORMAT_VALID`.
A format the module answers `JSON_FORMAT_UNKNOWN` for is refused in the class
(§4.1 says what the generator does with one).

## 6. Coercion

### 6.1 Strict is the default

With no `coerce` option a class decodes exactly as today: `{"id":"7"}` into
`id: i32` fails with `JSON_DECODE_TYPE` at byte 6. That stays true in every
stage, and S2's tests pin it beside each coercion they add.

### 6.2 How it is asked for: per field, in the literal

Three places were considered:

- **A decoder flag** (`d.coerce = true`). Rejected: every read would test it,
  so a strict decode would pay a branch per value, and the same class would
  accept different bodies depending on which decoder a caller made. The class
  would no longer be the contract.
- **Per class** (`coerce: true`). Simple, but coarse: the common case is one
  or two fields (a query-string-shaped `"7"`, a form's `"true"`) in a class
  that otherwise must stay strict.
- **Per field, in the literal** (`coerce: ["id", "active"]`), the shape of
  `optional`. **Recommended.** It is the class saying exactly which fields
  accept which spellings; a reader sees it; a field not listed is strict; the
  compiler writes a coercing read only for listed fields, so the rest of the
  class, and every class without the option, is byte-identical (§8).

The generator writes `coerce` only when asked (`--coerce=<field paths>`), since
JSON Schema has no coercion keyword.

### 6.3 What is coerced

Exactly these, and only for a field listed in `coerce`:

| Field type | Also accepted | Rule |
| --- | --- | --- |
| `i32`, `u32`, `i64`, `u64` | a string | its contents, with no escapes and no whitespace, are one JSON number that the strict read would accept, with the same range check (`RANGE`) and the same constraints. `"7"` → 7; `"7.0"`, `" 7"`, `"0x7"`, `"+7"`, `""` fail. |
| `f64`, `JsonNumber` | a string | its contents are one JSON number. `"NaN"`, `"Infinity"` fail. |
| `boolean` | a string | `"true"` or `"false"`, exactly. `"1"`, `"yes"`, `"True"` fail. |

A coerced read that fails is `JSON_DECODE_TYPE` at the string's first byte, as
the strict read's would have been, so turning coercion on never changes where
an error is reported. The number inside the string is read by the tokenizer's
own number scanner over the string's bytes (a second `JsonTokenizer` the
decoder owns, `reset` over `[tokStart + 1, tokEnd − 1)`, `std/json-tokenizer.ts:698`,
which allocates nothing), so a coerced number and a bare one are parsed by one
piece of code.

**Never coerced**, in any mode: a number to a string (the text a peer sent as
a number has no single string spelling: `1e2` and `100`); `null` to anything
(that is `| null`, or `optional`); an object or array to or from a scalar; a
boolean to a number or back; a string with escapes or surrounding whitespace to
a number; and a value of the right type, which is read strictly whatever the
option says.

`jsonEncode` writes the field's own type: a coerced `"7"` is written back as
`7`. That is what the class says; a program that must echo the string keeps a
`string` field.

## 7. The generator

### 7.1 Where it lives

Recommended: **a `nish schema` subcommand**, beside `run` and `upgrade`
(`helpText`, `src/cli-style.ts:35`):

```
nish schema <schema.json> -o <out.ts> [--check] [--root <Name>] [--exact-numbers] [--coerce <paths>] [--unknown-format=ignore]
```

Why a subcommand and not `std/` plus a script: the generator must ship with the
compiler whose options it writes (a generated `constraints` key is refused by an
older compiler), and every Nish user has `nish`; a script would need Node and a
path into the package. It is written in Nish in `src/` like the rest of the CLI,
reads the schema with `nish/json-value`, resolves `$ref` with
`nish/json-pointer`, and checks each `pattern` and `format` with the same
`regexCompile` and `jsonFormatId` the compiler later uses, so a schema the
generator accepts is a class the compiler accepts. The alternative, a
`nish/json-schema-gen` module and a script, is §10 question 3.

### 7.2 Its output

- **Deterministic.** Classes in the order of a depth-first walk of the schema
  from the root, `$defs` in key order after; fields in `properties` order;
  every option key in one fixed order. The same schema gives the same bytes,
  on every host, so the output can be committed and diffed.
- **A header** naming it generated, the schema's path, its `$id`, and a hash
  of its bytes (SHA-256, `std/crypto/sha256.ts`), and saying not to edit it.
- **`--check`** regenerates in memory and exits non-zero, writing nothing, when
  the file differs or its header's hash is not the schema's: the CI step a
  project runs, as this repository runs `gen-reference.mjs --check`.
- Per root class, a `decodeX(bytes)` helper that makes the decoder with the
  `ignoreUnknown` the schema's `additionalProperties` asks for and returns a
  `Result`.

### 7.3 Rolling freeze and the guide

The generator *writes* `constraints` and `coerce`; `src/` itself never *uses*
them, since the compiler's own JSON (its `--json` lines, `std/json.ts`) is not
decoded through `jsonDecode`. S3's new `src/` code uses only constructs the
seed (the last release) has, which CI's `bootstrap` job checks. If S3 lands in
the same release as S1, the generator's tests compile its output with
`build/nish`, not the seed.

Each stage is a change a user of Nish sees, so each updates the guide in the
same PR (S1 the constraints, S2 coercion, S3 the subcommand on `cli.md` and its
`--help`), and S4 gives the topic its own page (§12).

## 8. Zero cost when unused, and the performance target

**Byte-identical IR.** A class with no `constraints` and no `coerce` generates
exactly today's IR: the new code in `emitJsonDecodeValue` is behind a test of
the field's constraint list, which is empty. Each stage lands a golden that
pins it: the IR of `tests/cases/json_typed_*` classes without the options does
not move, which `tests/self/goldens/checked/` and the nish-cmp corpus
(`tests/nish-cmp.js`) already catch. This is how the `presence` option landed.
`JsonDecoder` gains fields (`failedKeyword`, the coercion tokenizer); a new
field moves the class's layout, so the S1 PR states the move in nish-cmp's
`DECLARED` entries if any corpus program's IR changes because of it, and the
coercion tokenizer is made only when a class with `coerce` is decoded.

**Today's figures** (citm, 4-core Xeon, 7 interleaved rounds, ms per document,
minimum):

| | Decode | Serialize |
| --- | --- | --- |
| Nish typed `jsonDecode` / `jsonEncode` | 1.81 | 0.438 |
| Bun 1.4.4 `JSON.parse` alone | 1.84 | |
| Bun `JSON.parse` + a hand-written type check | 2.54 | |
| Bun `JSON.stringify` (byte-identical output) | | 0.695 |

**The bar.** Validation adds cost proportional to the constraints declared and
stays one pass: citm decoded with no constraints stays within noise of 1.81;
a schema with constraints on every field costs what those checks cost and no
more, and is compared with Bun's `JSON.parse` plus the equivalent hand checks,
the program a TypeScript service writes today.

**The bench.** S4 adds to `bench/json-compare/run.mjs`, whose rows today are
simdjson, yyjson, RapidJSON, serde and Go over twitter, citm and canada:

- `bun` and `node` rows: `JSON.parse` alone, `JSON.parse` plus a hand-written
  type check, and `JSON.stringify`, skipped with a line when the runtime is not
  installed;
- a constrained workload: citm's classes with the constraints its published
  shape implies (id ranges, non-empty names, the enum of area ids), against
  the hand-checked Bun program;
- an instructions-per-document gate (`Ir/doc`, valgrind's count, which is
  stable where wall time is not) for the unconstrained and constrained decode,
  checked into the bench's expected file, so a change that slows the
  unconstrained decode fails without timing noise.

## 9. Semantics at the edges

- **Node and `--emit-ts`.** The three calls already end the program under
  Node; nothing changes. The options literal is erased with the class's other
  statics.
- **`jsonDecodeUnion`.** A variant's constraints are checked as its fields are
  read, after the tag has chosen it, so they cost nothing for the variants not
  taken.
- **`ignoreUnknown`.** Unchanged: a key that names no field is stepped over and
  no constraint applies to it.
- **Reuse.** A decode that fails a constraint leaves the object as a failed
  decode does today: it "leaves what it read" (the header,
  `std/json-typed.ts:312`), and the program checks `d.failed` before using it. A constraint never makes the decode allocate
  more than a successful decode would.
- **Encode.** `jsonEncode` does not check constraints: the program's own values
  are trusted, as `JsonNumber`'s are (JSON-14). Whether a debug build should
  assert them is §10 question 6.

## 10. Decisions for the owner

1. **The option's shape.** One `constraints` map (recommended) or per-keyword
   keys in the literal (`minLength: { name: 1 }`). The map keeps a field's rules
   together and copies the schema's own nesting.
2. **`failedKeyword`.** Record which keyword failed (recommended, one `i32`), or
   only the code and offset.
3. **Where the generator lives.** `nish schema` (recommended) or a `std` module
   plus a script.
4. **Coercion's granularity.** Per field (recommended), per class, or both.
5. **Recursive `$ref`.** Refuse (this note's default), or generate a class whose
   self-typed field is `| null` with a `null` initializer, which the decoder
   takes today and which recurses one native frame per level under `maxDepth`.
6. **Encode.** Should a `-g` build check constraints on encode too?
7. **draft-07.** Accept the compatible subset (recommended) or 2020-12 only.

## 11. Security

The decoder reads attacker input; `docs/security/json.md`'s typed-layer record
covers `std/json-typed.ts`, `src/json-typed.ts` and `src/emit-json.ts` (its
index row, `docs/security/README.md:50`). The S1 and S2 PRs each update it in
the same PR, with a finding row per new surface and the test that pins it.

**Patterns.** A schema's `pattern` is chosen by whoever wrote the schema,
and a pattern that backtracks is a denial of service on every body. The
patterns here are compiled by `nish/regex`, which:

- refuses backreferences and lookaround at compile time (`std/regex.ts:38`),
  the features that force backtracking;
- never backtracks: a lazy DFA, a reverse DFA, and a Pike VM only for
  captures, which `test` does not track (`:47`, `:82`);
- costs O(pattern × input) at worst, so `(a+)+$` is as quick as `a+$` (`:56`);
- bounds the pattern itself: a repeat at most `REGEX_MAX_REPEAT` = 1,000
  (`:168`), at most `REGEX_MAX_INSTRUCTIONS` = 100,000 instructions once
  repeats are written out (`:166`), nesting at most `REGEX_MAX_DEPTH` = 250
  (`:170`).

The input a pattern is run on is a decoded string, itself bounded by the
caller's `JsonLimits`; so a pattern's cost per body is at most 100,000 × the
body's string bytes, linear in the input for a fixed schema. The pattern is
fixed at build time, so a peer cannot supply one. The S1 record states that
bound with a test that runs the classic catastrophic patterns over a long
input in time linear in it, and what the lazy DFA's state cache costs in
memory (`docs/security/regex.md`).

**Coercion** widens what a body may say, so S2's record entry names each
accepted spelling and pins the refusals of §6.3 (`"0x7"`, `" 7"`, `"True"`),
since a coercion that accepts more than one component downstream does is the
shape of the duplicate-key bypass JSON-3 fixed.

**`uniqueItems`** hashes peer-chosen strings into a `Set`, which uses the keyed
SipHash JSON-13 put in place; its size is the array's, bounded by the caller's
limits.

## 12. Docs gaps to close

- A dedicated guide page, `docs/guide/using-nish/typed-json.md`, with a
  `scalar.config.json` route, lifted from the long typed-JSON section of
  `docs/guide/using-nish/standard-library.md`, which keeps a short pointer.
- An error-code table in the guide: every `JSON_DECODE_*` code and the
  tokenizer codes it can surface, with what `errorAt` points at for each. Today
  the table lives only in the module header (`std/json-typed.ts:314` to `:335`).
- A note in the reference that `jsonEncodeI32Array` (`std/json-typed.ts:1730`)
  and its kin, and `jsonEncodeStringOrNull`, `jsonEncodeU64` and
  `jsonEncodeNumber`, are the helpers the generated encoder calls, not an API
  a program is meant to call.
- The header says a class's options are "three" (`std/json-typed.ts:175`) and
  lists four (`rename`, `optional`, `presence`, `tag`); S1 rewrites the
  sentence as it adds `constraints`.

## 13. Stages

Each stage is a PR, ticked on [the roadmap page](roadmap/wp61-json-schema.md)
when it lands. A stage that adds a construct follows
[ARCHITECTURE.md → "How to add a construct"](ARCHITECTURE.md): a golden `.ll`,
an `llvm-as` pass, a native round trip with expected stdout, at least one
negative test, its LANGUAGE.md rule, a cookbook entry and the guide.

### S1: constraints in decode

**What lands:** the `constraints` option (§5): the checker's
`jsonReadConstraints` and its diagnostics; the emitted checks for every keyword
in §5.1; `JSON_DECODE_CONSTRAINT = -27` and `constraintFailed`;
`failedKeyword` if the owner takes it; the module-scoped compiled patterns;
LANGUAGE.md's "Typed JSON" rule (`docs/LANGUAGE.md:13382`) and the guide; the
`docs/security/json.md` and `regex.md` updates of §11.

**Tests:** a golden `.ll` per keyword family (integer bound, `f64` and
`JsonNumber` bound, string length, pattern, format, enum, array length,
`uniqueItems`); the zero-cost golden (§8); a round trip per keyword with a
passing body and a failing one, printing `failed` and `errorAt`; negative tests
for each diagnostic; the linear-time pattern test.

**Exit:** every keyword of §5.1 checked in the one pass, at the value's offset,
with unconstrained IR unmoved.

### S2: coercion

**What lands:** the `coerce` option (§6), the coercing reads, LANGUAGE.md and
the guide, the `json.md` entry.

**Tests:** the strict `{"id":"7"}` → `JSON_DECODE_TYPE` at byte 6 kept beside
`coerce: ["id"]` accepting it; every refusal in §6.3; a coerced value held to
its range and constraints; a golden `.ll` of a coercing read; the zero-cost
golden for classes without the option.

**Exit:** the coercions of §6.3, and only those, on listed fields.

### S3: the generator

**What lands:** `nish schema` (§7): the mapping of §4, every refusal of §4.1,
`--check`, the header, `cli.md` and `--help`.

**Tests:** a corpus of schemas with their expected `.ts` (each refusal with its
pointer and message); the generated code compiled and run on valid and invalid
bodies; determinism (two runs, one output); `--check` failing on a stale file;
an OpenAPI 3.1 document with a discriminator.

**Exit:** a 2020-12 schema within §4 becomes classes the compiler accepts, and
one outside it is refused, never weakened.

### S4: the guide page and the benchmarks *(owner's decisions)*

**What lands:** the "Typed JSON" guide page and its route, the error-code
table, the generated-code helper note (§12); the Bun and Node rows, the
constrained workload and the `Ir/doc` gate (§8); the measured figures written
into this note.

**Exit:** the figures against the bar of §8, and the owner's answers to §10's
seven questions recorded here.

## 14. Not planned

A runtime schema interpreter; validating a `JsonDocument` against a schema; a
second pass of any kind; untagged unions by trial decoding; string enums as a
language feature; generating servers or clients from OpenAPI paths; JSON
Schema's annotation output format; `$dynamicRef`.
