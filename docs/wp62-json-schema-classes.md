# WP62: Nish classes from a JSON Schema, keeping everything the schema says

**Status: proposed, design only.** Nothing here is built. The stages are in
§12 and on [the roadmap page](roadmap/wp62-json-schema-classes.md). S5 waits
on the owner (§10). The plan that tracks the stages is
[`.claude/plans/wp62-json-schema-classes.plan.md`](../.claude/plans/wp62-json-schema-classes.plan.md).

Every claim about today's code is anchored at commit `798636cb`, on `main`.
Read [Typed JSON](LANGUAGE.md#typed-json-nishjson-typed) first: it is what the
generated classes are for.

**WP61 (proposed)**, ["Typed JSON, constraints and coercion in one
pass"](wp61-json-typed-checks.md), is the design this note builds on. It adds
two options to a class's `static readonly json` literal:

- `constraints`, a schema's validation keywords under their own names,
  checked inside `jsonDecode`'s one pass;
- `coerce: true`, a per-class mode in which the decode always answers `OK`
  with a correct instance. Its "The mode, and the guarantee" also defines
  the mode's transitivity and how `jsonDecodeUnion` coerces; its "The stop's
  mechanism, and what stays readable" defines `stopped` and
  `repair(code, at)`. A
  generated class uses all of these as WP61 defines them and adds nothing to
  them.

WP61 names this package as its generator and has no generator stage of its
own. WP61 decides what the class can *say*; WP62 decides how a schema becomes
the class, keyword by keyword, and what of the schema survives. WP61 is cited
here by **section heading**, not number, because its numbering may still
move. Every
rule this note relies on that WP61 does not state is stated here, as WP62's
own:

- integer narrowing (§4.3);
- a bound equal to the type's range not repeated (§4.4);
- the `allOf` merge (§4.5);
- which drafts are read (§4.1).

WP62 also needs two typed JSON changes that WP61 does not make. Its first
stage, S1, makes them (§5.0):

- an optional field with a constructor-assigned default;
- a per-class unknown-key option.

## 1. The problem

A program that reads JSON defined by someone else's schema (an OpenAPI
component, a configuration format, a webhook payload) writes its classes by
hand today. The hand-written class says the shape: field types, which keys are
`optional`, each wire name's `rename`. Everything else the schema says is lost
on the way:

- **its prose** — `title`, `description`, `examples`, `deprecated` — which a
  reader of the class, and an editor's hover, would want beside the field;
- **its defaults** — the value a missing property means, which today becomes
  whatever initializer the author happened to write;
- **its rules** — `minLength`, `pattern`, `enum`, `minimum` — which WP61 can
  hold but nobody copies across by hand without mistakes;
- **its names** — the `$defs` a schema shares, which a hand-written port
  duplicates per use.

And when the schema changes, nothing says the class is stale.

The owner's direction for this package:

1. The class stays the single source of truth the compiler writes the decoder
   from. The schema is an *input* that generates Nish source. There is no
   runtime schema interpreter.
2. Keep as much of the schema as the class can hold, and say for every
   keyword where it goes, or why it cannot.

## 2. What exists today

### 2.1 What a class can say

The typed layer is in [`std/json-typed.ts`](../std/json-typed.ts) and the
compiler half in [`src/json-typed.ts`](../src/json-typed.ts):

- **Field types** are the table at `docs/LANGUAGE.md:13456`: `i32`, `u32`,
  `i64`, `u64`, a numeric `enum`, `f64`, `boolean`, `string` and
  `string | null`, a declared class and `C | null`, `T[]` and `T[] | null` of
  any of those, `Map<string, V>`, a tagged union of classes, and `JsonNumber`
  (`std/json-typed.ts:467`), which keeps a number as its text. Refused: arrays
  of arrays, arrays of maps, `Set`, interfaces (`docs/LANGUAGE.md:13474` to
  `:13490`). A scalar has no `| null` at all:
  `` `i32 | null` is not supported `` (`docs/LANGUAGE.md:319`).
- **The options literal**, `static readonly json = { ... }`
  (`std/json-typed.ts:125`, rules at `docs/LANGUAGE.md:13539`), read by
  `checkJsonOptions` (`src/json-typed.ts:507`), which admits exactly `rename`,
  `optional`, `presence` and `tag` (`src/json-typed.ts:542`):
  - `rename` maps a field to its wire key, any UTF-8 string
    (`std/json-typed.ts:178`, read at `src/json-typed.ts:267`);
  - `optional` lists fields whose key may be missing; a missing one is set back
    to its initializer, and an optional field with no initializer is NL2498
    (`src/json-typed.ts:338` to `:345`, `docs/LANGUAGE.md:13578`). An
    initializer must be a literal (`docs/LANGUAGE.md:3017`), so **an optional
    array, `Map`, class or `JsonNumber` field cannot be written today** unless
    it is `| null`, as `examples/merge-patch.ts:63` does on purpose. §5.0
    proposes the fix;
  - `presence` names a `boolean` field that records whether a key was given
    (`std/json-typed.ts:190`, `docs/LANGUAGE.md:13605`);
  - `tag` replaces a union variant's member name on the wire
    (`std/json-typed.ts:285`, `docs/LANGUAGE.md:13675`).
- **Decoding is strict**: every field required unless `optional`, an unknown
  key an error unless `d.ignoreUnknown` (`docs/LANGUAGE.md:13497`). That flag
  belongs to the *decoder* (`std/json-typed.ts:131`), not to a class, so it
  holds for every class one decode reaches. §5.0 proposes a per-class option.
  Also: a
  `readonly` field refused because decoding assigns it (NL2487,
  `docs/LANGUAGE.md:13757`), and a class the decoder makes itself built with
  `new C()`, so its constructor takes no parameters (NL2488,
  `docs/LANGUAGE.md:13754`).
- **Encoding writes every field** in declaration order, presence fields
  excepted (`std/json-typed.ts:368` to `:372`). So an optional key absent from
  the input comes back out holding its initializer (§5.3).
- **A class with options cannot be extended**: `extends` on one is refused
  (`json_reject_options_subclass`, `docs/LANGUAGE.md:13590`).

### 2.2 The pieces in `std/` the generator reads a schema with

| Module | What the generator uses |
| --- | --- |
| [`nish/json-value`](../std/json-value.ts) | `JsonDocument`: the schema as a tree, every number kept as its text (`std/json-value.ts:1`), so a `default` of `1e400` or a `minimum` of `0.1` is read exactly |
| [`nish/json-pointer`](../std/json-pointer.ts) | `jsonPointerResolve` (`:246`) for `$ref`, and `jsonPointerEscape` (`:195`) to name the schema location in every diagnostic |
| [`nish/json-number`](../std/json-number.ts) | `jsonNumberCompare` (`:295`) to decide whether `minimum`/`maximum` fit `i32`, `u32` or `u64`, and whether a `default` fits its field |
| [`nish/json-format`](../std/json-format.ts) | `jsonFormatId` (`:1046`) to refuse a `format` the decoder could not check |
| [`nish/json-equal`](../std/json-equal.ts) | the corpus test's comparison (§8) |

### 2.3 Doc comments today

The compiler drops comments as trivia (`skipTrivia`, `src/lexer.ts:483`), so a
JSDoc block in a generated file costs nothing in the build. Its readers are an
editor's TypeScript language service, which shows a field's `/** ... */` on
hover and strikes through a `@deprecated` one, and, for `std/` only,
`scripts/gen-reference.mjs`, which reads doc comments through TypeDoc
(`scripts/gen-reference.mjs:20`). A generated-file header has a precedent:
`banner` writes `Generated by nish <flag> from <entry>; do not edit.`
(`src/interop-abi.ts:1357`) at the top of `--emit-dts` output.

### 2.4 Prior art: mjst

[mjst](https://github.com/amritk/mjst) (MIT, by this project's author)
generates TypeScript types, parsers and validators from a JSON Schema. Its
`validation` and `helpers` packages have already settled most of the
questions this package faces, and WP62 follows them where they fit, citing
`mjst/packages/...` at commit `f549612`. This note takes ideas only; code
copied in later keeps its notice under
[`.claude/licensing.md`](../.claude/licensing.md).

| mjst does | WP62 takes it as |
| --- | --- |
| refuses a narrowing keyword its output cannot enforce, naming the keyword and its schema path, and scans only schema positions, not the values under `const`, `enum`, `examples` or `default`, nor property names (`validation/src/parsers/generators/assert-supported-keywords.ts`) | the refusal rule of §3 and §4.7 |
| keeps the keywords it enforces in one explicit set, `ENFORCED_KEYWORDS`, everything else being annotation (`validation/src/validators/generators/enforced-keywords.ts:16`) | two sets in the generator, the typed-or-checked keywords and the kept ones, and a test that every row of §4 is in exactly one (S2) |
| normalises before it maps: draft-07 upgraded to 2020-12 (`helpers/src/upgrade-draft07-schema.ts:143`), OpenAPI 3.0's `nullable: true` folded into the type (`helpers/src/fold-nullable.ts:23`) | the normalising pass of §4.1 and §4.6 |
| finds a union's discriminator structurally: a property that is a `const` or one-value `enum` in every branch, the values distinct (`validation/src/parsers/helpers/find-discriminator.ts:8`); OpenAPI's `discriminator` is only an annotation there | §4.5, which reads the keyword as well |
| one shared type per `$ref`, a stable name per reference, a cycle guard, collisions and non-identifier names refused (`validation/src/validators/generators/assert-generatable-refs.ts:35`, `helpers/src/ref-to-name.ts:100`) | §6 and §11 |
| JSDoc of `description` alone (`$comment` as its fallback), escaping `*/` as `*\/` (`helpers/src/generate-type-definition.ts:463`) | the escaping of §9.3; WP62 also keeps `title`, `examples`, `deprecated`, `default`, `externalDocs` and `x-*` (§4.2), the gap this package closes |
| a field's fallback value in a fixed order — a `default` only if it is an instance of the type, then `const`, the first `enum` value, the first example of the right type, then the type's zero moved into its bounds (`helpers/src/get-default-value.ts:206`) | the derivation of §5.1, in the same order. A `default` the field cannot take is skipped as mjst skips it, but WP62 also warns and keeps the value as a `@default` tag |
| `format` an annotation unless the caller asks for formats to be enforced, and then only the formats the schema names (`validation/src/validators/generators/emit-format-checks.ts`) | not taken: WP62 checks `format` by default, as WP61 does, and `--formats-as-tags` is the opt-out (§4.4) |
| an `x-mjst` keyword carrying hints for the TypeScript it writes | `x-nish` (§4.7) |
| the JSON Schema Test Suite run against an exact expected-failures list that fails on a stale entry as well as a new failure (`validation/src/parsers/generators/json-schema-conformance.test.ts:124`); a test that generated output compiles with every type declared once (`validation/src/emits-what-it-composes.test.ts`) | steps 3, 7 and 8 of §8.2 |

## 3. The decision

`nish schema <schema.json> -o <out.ts>` reads a draft 2020-12 schema (or an
OpenAPI 3.1 document's `components.schemas`) and writes one Nish module of
classes. Every keyword the generator meets lands in exactly one of four
places:

| Outcome | Meaning |
| --- | --- |
| **typed** | it decides a field's type, its optionality or its wire name |
| **checked** | it becomes a WP61 `constraints` entry, checked in the decode |
| **kept** | it becomes a comment: JSDoc on the class or field, or a `//` line |
| **refused** | the generator stops with a diagnostic naming the keyword and its JSON Pointer, and writes nothing |

There is no fifth outcome. **Nothing is silently dropped or weakened**: a
keyword the class cannot check is refused unless it is pure annotation, in
which case it is kept as a comment.

The only ways to keep less are the flags that ask for it by name: `--omit`,
`--drop-vendor`, `--allow-unknown`, `--formats-as-tags` and
`--before-constraints` (§9.2). The header's `Flags:` line records each one.

A `default` the class cannot hold (§5.1) is not a refusal. JSON Schema's
`default` is an annotation: no validator accepts or refuses an instance
because of it. Such a default is kept as a `@default` tag, and the generator
warns, naming its pointer.

## 4. The keyword table

Draft 2020-12's vocabularies in order, then OpenAPI 3.1's additions. "S*n*" is
the stage that lands the row (§12).

### 4.1 Core (`$`-keywords)

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `$schema` | typed | must name draft 2020-12 or be absent. A draft-07 schema (`$schema` naming `draft-07`) is read too. This is WP62's own rule; WP61 says only that a keyword means what draft 2020-12 says. A normalising pass first upgrades the draft-07 schema to 2020-12, as mjst does: `definitions` becomes `$defs`, an array-form `items` becomes `prefixItems` (then refused, §4.3), `additionalItems` becomes `items`, and `dependencies` is split into `dependentRequired` and `dependentSchemas` (both refused). A keyword the upgrade cannot carry is refused at its original pointer. Drafts 04 and 06 are refused: their `exclusiveMinimum` and `exclusiveMaximum` are booleans in 04, and neither draft is common enough to carry. Written in the header. S2 |
| `$id` | kept | the header's `Schema id:` line. S2 |
| `$defs` (and `definitions`) | typed | one class (or union) per entry, named by its key (§6). S3 |
| `$ref` to `#/$defs/X`, `#/components/schemas/X` | typed | the shared class `X`; one class however often it is referenced. Annotations beside the `$ref` (2020-12 allows siblings) go on the *field's* JSDoc; a validation keyword beside it is refused, since it would constrain one use of a shared class. S3 |
| `$ref` to `#` | typed | the root class: a schema that refers to itself, under the recursion rules of §5.4. S3 |
| `$ref` to any other pointer inside the document (`#/properties/address`, `#/$defs/X/properties/y`, `#/items`), resolved with `jsonPointerResolve`, `~0`, `~1` and percent-escapes included | typed | if it lands on an object schema, that object's class, named where the object stands (§6) and shared with it. If it lands on any other schema, that schema's type and constraints are mapped again at the referring field, as if they were written there. A pointer that resolves to nothing, or into the values under `const`, `enum`, `default` or `examples`, is refused. S3 |
| `$ref` to another document, `$dynamicRef`, `$dynamicAnchor`, `$anchor`, `$recursiveRef` | refused | a reference the generator cannot resolve inside the one document. `$anchor` could be resolved later (§10 question 8) |
| `$vocabulary` | refused | a custom vocabulary means keywords this table does not know |
| `$comment` | kept | a `//` line above the class or field, never in the JSDoc: draft 2020-12 says it is for maintainers, not users. S2 |

### 4.2 Annotations (meta-data vocabulary)

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `title` | kept | the JSDoc's first line; a blank line follows when there is a `description`. S2 |
| `description` | kept | the JSDoc's body, its text as written (Markdown is left as Markdown). S2 |
| `examples` | kept | one `@example` block per entry, the value pretty-printed by `JsonWriter` with `setIndent(2)`. S2 |
| `deprecated: true` | kept | `@deprecated`; an editor strikes the field through. `false` writes nothing. S2 |
| `readOnly: true`, `writeOnly: true` | kept | `@readOnly` and `@writeOnly` tags. Not mapped to TypeScript's `readonly`: decoding assigns every field and a `readonly` one is NL2487. Whether decode and encode should *honour* them is §10 question 3. S2 |
| `default` | typed | the field's initializer and a `@default` tag when the field can hold it; otherwise a warning naming its pointer, the `@default` tag alone, and a default derived from `const`, `enum`, `examples` or the type's zero (§5.1). S2 for scalars, strings and arrays of them; S3 for objects |

### 4.3 Types and structure (applicator and validation vocabularies)

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `type: "integer"` | typed | `i64`; `i32`, `u32` or `u64` when `minimum` and `maximum` are both given and fit, compared exactly with `jsonNumberCompare`. **The narrowing rule is WP62's own:** take the first of `u32`, `i32`, `u64`, `i64` whose range holds `[minimum, maximum]`. An `exclusiveMinimum` or `exclusiveMaximum` counts as the next integer inward. A bound on one side only gives `i64` (or `u64` when the minimum is 0 or more and there is no maximum). An `enum` or `const` of integers narrows the same way, by its smallest and largest value. `x-nish` may pick a wider type, never a narrower one (§4.7). `JsonNumber` under `--exact-numbers`, so an integer past `i64` is not a `RANGE` error. S2 |
| `type: "number"` | typed | `f64`; `JsonNumber` under `--exact-numbers`, or when a `multipleOf` or bound is not exactly an `f64`. WP61 refuses such a bound on an `f64` field and checks it exactly on a `JsonNumber` one (its "What a keyword means here"). An `f64` field loses what a double cannot hold (§8.1). S2 |
| `type: "string"` | typed | `string`. S2 |
| `type: "boolean"` | typed | `boolean`. S2 |
| `type: "null"` alone | refused | a field that can only be `null` has no Nish type. S2 |
| `type: [T, "null"]`, `oneOf`/`anyOf` of `S` and `{type: "null"}` | typed | `string \| null`, `C \| null`, `T[] \| null`, `Map<…> \| null`, initializer `null`. A nullable integer or number is `JsonNumber \| null`, the one scalar the decoder takes with `\| null`; a nullable `boolean` is refused (§10 question 5). S3 |
| `type` with two non-null types | refused | an untagged union (§4.5) |
| `type: "array"`, `items: S` | typed | `S'[]`, the array made in the constructor. An array of arrays, an array of maps and an array of nullable elements are refused, as the decoder refuses them. S2 |
| `prefixItems`, `items: false`, `contains`, `minContains`, `maxContains`, `unevaluatedItems` | refused | a tuple or a containment rule the class cannot hold |
| `type: "object"` with `properties` | typed | a class, one field per property in `properties` order (§6). S2 |
| `required` | typed | a property not listed goes into `optional` (§5.2). A name in `required` that `properties` does not declare is refused: the class would accept an object the schema rejects. S2 |
| `additionalProperties: false` | typed | `unknown: "error"` in the class's literal (§5.0): an unknown key fails the decode with `JSON_DECODE_UNKNOWN`, whatever the decoder's `ignoreUnknown` says. S2 |
| `additionalProperties` absent or `true` beside `properties` | typed | `unknown: "ignore"` (§5.0): an unknown key is stepped over, in this class only. A nested class that says `additionalProperties: false` keeps refusing unknown keys in the same decode. S2 |
| `additionalProperties: S` with no `properties` | typed | `Map<string, S'>`. With `properties` as well, refused: a class with a map of "the rest" is not a field type. S3 |
| `propertyNames`, `patternProperties` | refused | a rule on keys the decoder has no place for; `propertyNames: {pattern}` on a `Map` could become a WP61 key constraint later (§10 question 8) |
| `dependentRequired`, `dependentSchemas`, `unevaluatedProperties`, `minProperties`/`maxProperties` on a class | refused | rules across fields; `min`/`maxProperties` on a `Map` are WP61 constraints. S4 |

### 4.4 Validation keywords → WP61's `constraints`

Each is copied under its own name into the field's entry in `constraints`, so
the generator translates nothing: WP61's "The decision" takes JSON Schema's keyword names, and its "What a keyword means here" gives each its draft 2020-12 meaning. All land in S4, which starts after WP61's stage "S1: constraints in decode" lands. WP61's "The option" table says which field types take each keyword. A keyword on a type that table does not list is refused here; this note does not widen the table.

| Keyword | On | Note |
| --- | --- | --- |
| `minLength`, `maxLength`, `pattern` | `string` | a `pattern` `nish/regex` refuses is refused here, with the regex error |
| `format` | `string` | **checked by default**, as WP61 checks it ("What a keyword means here"). Each format the schema names becomes a constraint checked with `nish/json-format`, and a name that `jsonFormatId` answers `JSON_FORMAT_UNKNOWN` for is refused. This is stricter than a 2020-12 validator in its default configuration, which treats `format` as an annotation. Under `--formats-as-tags` (§10 question 10), a weakening the header records, every format is kept as a `@format` tag instead and nothing is checked |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` | integers, `f64`, `JsonNumber` **WP62's own rule:** a bound equal to the narrowed type's own range (`minimum: 0` on a `u32`, `maximum: 4294967295` on a `u32`) is already the type's `RANGE` check and is not written as a constraint. A bound inside the range is written. The reverse generator writes the dropped bound back from the type (§8.1) |
| `minItems`, `maxItems`, `uniqueItems` | arrays | `uniqueItems` on an array of objects is refused, as WP61's "Where the check goes, and the strict error" refuses it |
| `minProperties`, `maxProperties` | `Map` | |
| `enum` | `string`; integers, which narrow to `i32` or `i64` (WP61 takes `enum` on `string`, `i32` and `i64` only) | the field keeps its type and gains an `enum` constraint: Nish has no string enums (NL1043, `docs/LANGUAGE.md:13485`). An integer `enum` with a value past `i64` is refused. Before S4 the values are kept as a `@enum` tag and the field is refused unless `--before-constraints` (§9.2) |
| `const` | `string`, integers as `enum` | an `enum` constraint of one value, or a union's tag (§4.5) |
| `enum` or `const` on anything else | refused, except one case | refused on a `boolean`, a non-integer `number`, an object or an array, on a mixed `enum` (strings and numbers), and on an `enum` holding `null`. WP61 has no constraint for any of them, and a tag would let the class accept what the schema refuses. The one case kept: `enum: [true, false]` on a `boolean`, which is the type itself and is typed |
| `contentEncoding`, `contentMediaType`, `contentSchema` | `string` | kept as `@contentEncoding`, `@contentMediaType` tags; the field stays a `string`. `contentSchema` is refused: it is a schema for the decoded content, which the class does not decode |

### 4.5 Combining schemas

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `oneOf`/`anyOf` of objects, each with a `const` or a one-value `enum` on one shared property, the values distinct across branches (found structurally, as mjst does), or with OpenAPI's `discriminator.propertyName` | typed | a tagged union: a numeric `enum` with a member per tag, one class per variant with `readonly kind: Tag.X = Tag.X`, `tag: "<wire string>"`, and a `rename` when the property is not called `kind` (`docs/LANGUAGE.md:13675`). `discriminator.mapping` names each variant's tag. **An empty tag is refused**: `tag: ""` means "use the member's name" (`std/json-typed.ts:191` to `:193`), so a `const: ""` cannot be written as a tag. S3 |
| `oneOf`/`anyOf` of `S` and `{type: "null"}` | typed | `S' \| null` (§4.3). S3 |
| `allOf` of a `$ref` and an object, or of objects whose properties do not overlap | typed | one class with the properties of each branch, branch by branch, in order. **This flat merge is WP62's own rule.** `required` is the union of the branches' lists. Class-level keywords (`additionalProperties`, `title`, `description`) are taken from the branch that is not a `$ref`. If two branches both set the same class-level keyword, the merge is refused. The `$ref`'s class is copied into the merged class, not extended: a class with options cannot be extended (`json_reject_options_subclass`). S3 |
| `allOf` beyond that | refused | overlapping or conflicting branches |
| `oneOf`/`anyOf` without a tag ("untagged") | refused | it would need trial decoding, a second walk. A union whose branches differ by JSON type (a string or an object, as `package.json`'s `exports`) needs no trial — the first token decides — but the decoder has no field kind for it (§10 question 5) |
| `not`, `if`/`then`/`else` | refused | no place in a class |

### 4.6 OpenAPI 3.1 additions

OpenAPI 3.1's Schema Object is draft 2020-12 plus these:

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `discriminator` | typed | the union's tag (§4.5). S3 |
| `externalDocs` | kept | `@see <url> <description>`. S2 |
| `example` (singular, deprecated in 3.1) | kept | one `@example`, as `examples`. S2 |
| `xml` | kept | a `@xml` tag holding the object as compact JSON, so the reverse generator can restore it; nothing in Nish reads XML. S2 |
| `nullable: true` (OpenAPI 3.0) | typed | folded by the normalising pass into `type: [T, "null"]` (or a `oneOf` with `null` beside a `$ref`), then mapped as §4.3. The rest of a 3.0 document is not read. S3 |

The rest of an OpenAPI document — paths, operations, parameters, security —
is not read. This package generates types, not a server (WP43's router) or a
client.

### 4.7 Keywords no vocabulary defines

- **`x-*`, vendor extensions** (OpenAPI's rule, and common in plain schemas:
  `schemas/package.schema.json` carries `x-mjst`): **kept**, as one JSDoc tag
  per keyword, `@x-name` followed by the value as compact JSON, so nothing is
  lost and the reverse generator can restore it. `--drop-vendor` drops them
  all, recorded in the header.
- **`x-nish`**, this generator's own keyword, as `x-mjst` is mjst's:
  **typed**, and not kept as a tag. It carries hints for the Nish type where
  the schema leaves a choice: `{"x-nish": {"type": "i32"}}` on an integer the
  schema does not bound, `"JsonNumber"` on one number, a class `name`. A hint
  that would accept what the schema refuses — `i32` under a `maximum` past
  2^31 − 1 — is refused. `{"x-nish": {"coerce": true}}` on a `$defs` entry
  or the root makes that class a WP61 coerce class (§5.5). The type hints land in S3, `coerce` in S4.
- **Any other unknown keyword** — `minLenght`, a keyword of a draft the
  dialect does not have: **refused**, naming it and its pointer. Draft 2020-12
  calls an unknown keyword an annotation, but here a misspelt constraint would
  become a comment and the class would accept what the schema's author meant to
  refuse. `--allow-unknown <name>` keeps one as an `@name` tag (§10 question 4).

The scan reads schema positions only: the values under `const`, `enum`,
`default` and `examples` are data, and the keys of `properties`, `$defs` and
`dependentRequired` are names, so a property called `minLenght` is a field,
not a typo.

## 5. Defaults, required and zero values

### 5.0 Two typed JSON changes first (S1)

In two places, today's options cannot keep a schema's meaning. Both fixes are
typed JSON changes. WP62's first stage, S1, makes them, before any generator
code lands. They go in WP62, not WP61, for two reasons:

- WP62 is their first user;
- WP61's scope is constraints and coercion, and its design has already merged as a proposal.

§10 question 1 asks the owner whether to move them into WP61 instead. Each
follows the checklist of `docs/ARCHITECTURE.md` → "How to add a construct":

- a golden `.ll` and an `llvm-as` pass;
- a native round trip with expected stdout;
- a negative test per diagnostic;
- its `docs/LANGUAGE.md` rule, beside NL2498 (`docs/LANGUAGE.md:13578`);
- the `std/json-typed.ts` doc comment of the options;
- the typed JSON page of the user guide.

**1. An optional field whose default the constructor makes.** Today an
`optional` field needs a literal initializer (NL2498). An array, `Map`, class
or `JsonNumber` field cannot have one, so such a field can be optional only as
`| null`. That `| null` breaks the schema twice:

- it would accept a `null` the schema forbids;
- it would re-encode as `null` (§5.3).

So the generator never writes it. The new rule: an `optional` field with no
initializer is accepted when the class's no-argument constructor assigns it
exactly once, unconditionally and at the constructor's top level, one of:

- `[]`, to an array field;
- `new Map()`, to a `Map` field;
- `new C()`, to a field of class `C`. `C`'s constructor takes no parameters,
  and `C` meets this rule for every field it has: each scalar and `string`
  field has a literal initializer, and each other field is assigned one of
  these forms. So `C`'s defaults are known at build time.
- `new JsonNumber()`, to a `JsonNumber` field. This is the `new C()` case; a
  new `JsonNumber` holds `0` (`std/json-typed.ts:475`).

A missing key then resets the field in place to that value, in the
after-the-loop block where a missing `optional` field takes its initializer
today (`src/emit-json.ts:1005`):

- an array's length is set to 0 and its buffer kept;
- a map is cleared;
- an object is reset field by field to its own class's defaults, by the same
  rule, one level down;
- a `JsonNumber` is set back to `0`.

No allocation is made, and no constructor runs inside the decode. This is the
same rule, and the same reset, that WP61's "The default, and the constructor
rule" gives a coerce class's fields. Whichever of WP61's coercion stage and
WP62's S1 lands first builds the reset, and the other reuses it. The reset is
bounded by the class graph, not by the input: `new C()` cannot build a cycle
of non-null class fields, because it would never return.

A union field is not covered: no variant is the obvious default. An optional
union field stays refused unless it is `| null`. NL2498's message becomes:

> `` `C.json` makes `f` optional, and the field has no default: a missing
> optional key sets its field to its default, a literal initializer or `[]`,
> `new Map()` or `new C()` assigned in the constructor ``

New diagnostics, taking the next free codes in `src/codes.ts` when S1 lands:

- the constructor assigns anything else (`["a"]`, a call, a parameter);
- the constructor assigns the field inside a branch or a loop, or twice;
- `C`'s constructor takes parameters;
- one of `C`'s fields has no default by this rule.

**Tests:** a positive case with a golden `.ll` and a native round trip. It
decodes `{}` into a reused object whose array held elements, whose map held
keys and whose nested object held values. Expected: an empty array, an empty
map, a reset object and a `JsonNumber` holding `0`. The case then re-encodes
the object. There is one negative case per diagnostic.

**2. Unknown keys per class.** Today `d.ignoreUnknown` is a flag of the
decoder (`std/json-typed.ts:131`). It holds for every class one decode
reaches. Take a schema whose outer object allows other keys and whose nested
object says `additionalProperties: false`. That schema has no faithful
decoder today:

- setting the flag lets the nested class accept unknown keys;
- leaving it unset refuses valid documents.

The new rule: a class's literal may say `unknown: "ignore"` or
`unknown: "error"`. The generated key dispatch reads the option. Its no-match
branch calls `unknownField` today (`src/emit-json.ts:977`,
`std/json-typed.ts:844`):

- `"ignore"` steps over the value, as `ignoreUnknown` does;
- `"error"` fails with `JSON_DECODE_UNKNOWN` at the key.

A class without `unknown` keeps today's behaviour: the decoder's flag decides.
NL2494's list of options adds `unknown`, and any other value is a new
diagnostic. WP61's coercion ignores unknown keys whatever the decoder says
("When a field takes its default"), so `unknown: "error"` on a coerce class
is refused, and `"ignore"` there is allowed and changes nothing.

**Tests:** an outer class with `"ignore"` that holds an inner class with
`"error"`, run with `d.ignoreUnknown` both false and true. An unknown key in
the outer object passes, and one in the inner object fails at its byte. There
is a negative case for a bad value, and one for `"error"` with `coerce` once
WP61's coercion lands.

**A program's own decoder.** Every generated class carries `unknown`. So a
program that calls `jsonDecode` with a decoder it made gets the schema's rule,
whatever that decoder's `ignoreUnknown` says. The flag still decides for
hand-written classes, which carry no `unknown`. A program cannot loosen a
generated class by setting the flag; to accept more keys, it changes the
schema. A coerce class (§5.5) is the exception, as WP61 designs it: it drops
unknown keys, and what it yields is still an instance the schema accepts.

**Before S1 lands.** Every generator stage comes after S1, so a released
`nish schema` always has both changes. The owner may order the generator
first instead (§10 question 1). Then, until S1 lands, the generator refuses
each of these with a diagnostic naming the pointer:

- an optional, non-null array, `Map`, class or `JsonNumber` field;
- a schema whose classes differ on `additionalProperties`.

It never writes `| null` for the first, and never leans on the decoder's flag
for the second.

### 5.1 The default

Every generated field has a default. It is what a missing optional key
decodes to and what a `new` object holds:

- a scalar, `string` or `| null` field gets a literal initializer;
- any other field gets a constructor value (§5.0).

**A schema `default` that the field can hold becomes its default**, and is
also written as the field's `@default` tag, so the reverse generator can tell
a given default from a derived one. "Can hold" means all three of these:

- it is of the field's type: an integer in the narrowed range on an integer
  field, a string on a `string`, and `null` only on a `| null`;
- it meets every constraint the generator writes for the field;
- the class can write it:
  - a literal, for a scalar, `string` or `null`;
  - for an array, `[]`;
  - for a map, `{}`;
  - for an object, the value that `new C()`'s reset gives, so every key of
    the default must equal its field's own default;
  - for a `JsonNumber`, `0`.

**A default the field cannot hold is not refused.** Examples: `default: "7"`
on an integer, `-1` on a `u32`, `""` with `minLength: 1`, `["a"]` on an array,
`{"x": 1}` where `x` defaults to `0`, and `5` on a `JsonNumber`. The
generator:

1. warns on stderr, naming the pointer and the reason. The exit status stays
   0;
2. keeps the value as the field's `@default` tag, as compact JSON, so the
   value is not lost and the reverse generator can restore it;
3. derives the default as though the schema gave none.

No validation is lost: in draft 2020-12, `default` is an annotation. What
changes is what a missing optional key decodes to, and the warning says so.

**The derivation** follows mjst's order (`helpers/src/get-default-value.ts:206`).
The first step that gives a value the field can hold wins:

1. the `const`;
2. the first `enum` value;
3. the first entry of `examples` that the field can hold;
4. the type's zero, nudged into its bounds:
   - `null`, for a `| null` field;
   - `0`, raised to `minimum` (or to the next integer above
     `exclusiveMinimum`) and then onto the first multiple of `multipleOf`;
   - `false`;
   - `""`, padded with `a` to `minLength`;
   - `[]`, or an empty map;
   - `new C()`, whose own fields are derived the same way;
   - `0` for a `JsonNumber`.

   A required union field gets a new object of its first variant, in `oneOf`
   order.

**When nothing can be derived:** for example, a `pattern` the padded string
fails, `minItems: 1`, or `minimum: 1` on a `JsonNumber`. Then:

- **an optional field is refused.** A missing key would decode to a value the
  schema refuses, and the re-encode would write that value out;
- **any field of a coerce class is refused.** WP61's "The default, and the
  constructor rule" refuses a default that fails its own field's constraints,
  so the class would not compile;
- **a required field of a strict class** gets its type's plain zero, with a
  line saying `// not valid against the schema; a successful decode always
  replaces it: <reason>`. The decode refuses a body that leaves the field out,
  so only an object made with `new` ever holds that value.

### 5.2 How this meets `required`

| Property | Generated |
| --- | --- |
| in `required`, no `default` | a required field (not in `optional`); its default is derived as §5.1 says, and a successful decode always replaces it |
| in `required`, with a `default` | still required: the decode refuses a body that leaves it out, since `required` is an assertion and `default` only an annotation. The default is what a program sees on an object it makes with `new`, and what a WP61 coercion falls back on |
| not in `required`, with a `default` | in `optional`; a missing key decodes to the default when the field can hold it, else to the derived value, with the warning and the `@default` tag (§5.1) |
| not in `required`, no `default` | in `optional`; a missing key decodes to the value §5.1 derives, which is `null` when the schema allows it and a value the schema accepts otherwise. `--presence` adds a `hasX` field per such property, recorded in `presence`, for a program that must tell "missing" from "given the zero" (§10 question 6) |

### 5.3 What encoding writes back

`jsonEncode` writes every field (`std/json-typed.ts:368`), so an optional key
the input left out is written back holding its default. The re-encoded
document is always valid against the schema, for three reasons:

- §5.1 gives every optional field a default the schema accepts;
- §5.1 refuses an optional field it cannot give one;
- §5.0 means no `| null` is ever added.

The output is only longer than the input. The JSDoc of an optional field
without a `default` says the field is written even when it was absent.
Leaving absent keys out of the encoding is a typed JSON change, not a
generator one (§13, "Not planned").

### 5.4 Recursion

A class that reaches itself through an array, a map or a nullable field is
generated (S3). Its default there is `[]`, an empty map or `null`, and the
decoder recurses one frame per level, bounded by `JsonLimits.maxDepth`.

A class that reaches itself through a non-nullable object field is refused,
whether the field is required or optional:

- no finite JSON value satisfies such a schema when the field is required;
- either way, the field's default, `new C()`, would construct forever;
- a `| null` default would let the class encode a `null` the schema forbids.

### 5.5 Coerce classes

WP61's `coerce: true` is per class. The generator writes it into a class's
literal in either of two ways:

- `--coerce` marks every class in the module;
- `{"x-nish": {"coerce": true}}` on a `$defs` entry or the root marks that
  class.

**It respects transitivity.** WP61's "The mode, and the guarantee" requires
each of these, reached from a coerce class, to be a coerce class too:

- a class field;
- an array element;
- a map value;
- a union variant.

The generator checks this closure. A coerce class that reaches an unmarked
class is refused, naming both pointers and the path between them; the fix is
to mark that class too. The generator does not mark it silently: the reached
class may also serve strict classes, which would then repair a bad nested
value instead of failing.

WP61's other coerce rules hold too:

- **A union field** of a coerce class must be `U | null`. A non-nullable union
  there is refused.
- **Every field needs a default** that the class can hold and that meets the
  field's constraints. Under §5.1, a field with nothing derivable is refused.
  A non-empty array `default`, or an object `default` that differs from
  `new C()`'s reset, is kept only as a `@default` tag, with the warning, as in
  a strict class. The constructor assigns only `[]`, `new Map()` or `new C()`,
  as WP61's constructor rule requires.
- **`unknown` is not written** on a coerce class: coercion ignores unknown
  keys (§5.0).

Coerce lands in S4, after WP61's stage "S2: coercion".

## 6. Names

- **A class** is named by its `$defs` (or `components.schemas`) key, turned
  into PascalCase (`user_profile` and `user-profile` → `UserProfile`). An
  inline object is named by the class that holds it and the property
  (`User.address` → `UserAddress`; an array's element `User.tags[]` →
  `UserTag`, singularized only by dropping a final `s`). The root is named by
  `--root <Name>`, else its `title` in PascalCase, else the file's base name.
  `title` names only the root: everywhere else it is prose and goes to the
  JSDoc, because titles collide and change more often than keys.
- **A field** keeps its property's name when that is a Nish identifier, so the
  common case needs no `rename`. A property that is not one (`user-id`,
  `@type`, `$ref`, `2fa`, `""`) gets a legal name — characters outside
  identifiers dropped with the next letter capitalized, a leading `_` before a
  digit, `field` for an empty name — and a `rename` back to its wire key.
  `--camel` also renames `snake_case` properties to `camelCase` fields
  (§10 question 7).
- **A tag enum** is the union's name and `Tag` (`EventTag`), its members the
  tag values in PascalCase.
- **Collisions** — two classes with one name, two properties mapping to one
  field, a field colliding with a `--presence` flag — are refused, naming both
  pointers, and `--name <pointer>=<Name>` settles one by hand. The generator
  never adds a numeric suffix: a name that changes when an unrelated schema
  entry is added would break every program that uses it.

## 7. A worked example

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/user.json",
  "title": "User",
  "description": "An account on the service.",
  "type": "object",
  "required": ["id", "name"],
  "properties": {
    "id": { "type": "integer", "minimum": 0, "maximum": 4294967295 },
    "name": { "type": "string", "minLength": 1, "examples": ["ada"] },
    "email": { "type": "string", "format": "email", "examples": ["ada@example.com"] },
    "display-name": { "type": ["string", "null"], "$comment": "added in v2" },
    "role": { "type": "string", "enum": ["admin", "member"], "default": "member" },
    "score": { "type": "number", "multipleOf": 0.01 },
    "tags": { "type": "array", "items": { "type": "string" }, "deprecated": true }
  },
  "x-owner": "accounts-team"
}
```

`nish schema user.json -o user.ts`, once S4 has landed:

```ts
// Generated by nish schema from user.json; do not edit.
// Schema id: https://example.com/user.json
// Schema sha256: 3f1c…
// Flags: (none)

/**
 * User
 *
 * An account on the service.
 *
 * @x-owner "accounts-team"
 */
export class User {
  static readonly json = {
    rename: { displayName: "display-name" },
    optional: ["email", "displayName", "role", "score", "tags"],
    unknown: "ignore",
    constraints: {
      name: { minLength: 1 },
      email: { format: "email" },
      role: { enum: ["admin", "member"] },
      score: { multipleOf: 0.01 },
    },
  };
  id: u32 = 0;
  /**
   * @example
   * "ada"
   */
  name: string = "ada";
  /**
   * @example
   * "ada@example.com"
   */
  email: string = "ada@example.com";
  // added in v2
  displayName: string | null = null;
  /** @default "member" */
  role: string = "member";
  score: JsonNumber;
  /** @deprecated */
  tags: string[];
  constructor() {
    this.score = new JsonNumber();
    this.tags = [];
  }
}
```

What each field shows:

- **`id`**: its bounds are exactly `u32`'s range, so they are its `RANGE`
  check and not a constraint (§4.4).
- **`name`**: required with no `default`, so its initializer is derived from
  its first example (§5.1). `"ada"` meets its `minLength`.
- **`email`**: optional with no `default`. `""` is not an email, so §5.1
  takes its first example. Without one, nothing valid could be derived and
  the optional field would be refused at `/properties/email`. Its `format` is
  checked, as WP61 checks it; `--formats-as-tags` would weaken that and say so
  in `Flags:` (§9.2).
- **`role`**: its `default` fits, so it is the initializer and the
  `@default` tag.
- **`score`**: `0.01` is not exactly an `f64`, so the field is a
  `JsonNumber` and its `multipleOf` is checked exactly (§4.3). A missing key
  decodes to `0` under S1's constructor rule (§5.0).
- **`tags`**: optional and not nullable, so its default is the `[]` the
  constructor assigns (§5.0). It is never written as `string[] | null`.
- **`unknown: "ignore"`**: the schema allows other keys, and this class
  ignores them whatever the decoder's `ignoreUnknown` says (§5.0).

Before S4, the same schema is refused at `/properties/name` (`minLength`)
unless `--before-constraints` is given, which `Flags:` then records. Should
the owner order the generator before S1 (§10 question 1), `score` and `tags`
are refused until it lands (§5.0).

## 8. The round trip, and the corpus test

### 8.1 What survives

schema → classes keeps:

- every type, every `required` and every wire name;
- every `default`, as the field's initializer and its `@default` tag, or as
  the tag alone, with a warning, when the field cannot hold it (§5.1);
- every validation keyword (S4), in WP61's literal under its own name, or
  implied by the field's type (§4.4);
- every annotation, as JSDoc text or a tag;
- every `x-*` keyword, as a tag holding its value's JSON;
- the order of `properties` (the field order, which is also `jsonEncode`'s key
  order) and the `$defs` names.

It loses, by design:

- the schema's own layout: whitespace and the order of keywords inside a
  schema object;
- `type: "integer"`'s width when no bounds narrow it: an `i64` field refuses
  an integer past 2^63 − 1 that the schema allows (`--exact-numbers` keeps
  it);
- `type: "number"`'s range and precision on an `f64` field:
  - a number past the double range, such as `1e400`, decodes to infinity,
    and the encode writes infinity as `null` (`docs/LANGUAGE.md:13461`). The
    round trip turns a valid number into a `null` the schema refuses;
  - a number with more digits than a double holds decodes to the nearest
    double. `0.1` comes back as `0.1`, but `12345678901234567890` comes back
    as `12345678901234567000`.

  `--exact-numbers` keeps both, as `JsonNumber`, at the cost of arithmetic
  on the field; a `multipleOf` or bound that is not exactly an `f64` already
  forces `JsonNumber` (§4.3);
- which spelling a nullable used (`type: [T, "null"]` or a `oneOf` with
  `null`), and whether a merged class came from an `allOf`.

classes → schema again (a reverse generator, `nish schema --emit-schema`,
§10 question 2) would read only the generated module — its types, options,
constraints and tags — and write a 2020-12 schema. The test of fidelity is
that it is *equivalent*: the reverse of the generated module, generated again,
is byte-identical to the generated module; and the reverse schema accepts and
refuses the same instances as the original on every corpus instance (§8.2).

### 8.2 The corpus

`tests/schema-corpus/`, one directory per schema: the schema, its expected
`.ts`, and instances, each marked valid or invalid. A run:

1. generates the module and diffs it with the expected `.ts` (the golden);
2. generates it again and checks the bytes are identical (determinism);
3. compiles it with `build/nish` and links a driver that decodes each
   instance: a valid one must decode to `JSON_DECODE_OK` and an invalid one
   must fail, with the expected code and offset;
4. encodes each valid instance back and compares it with `nish/json-equal`
   against the input with every absent optional key filled in by its
   default (§5.1, §5.3), so the diff is exactly the keys the schema let the
   input leave out;
5. decodes every `examples` entry the schema itself holds, which must all be
   valid;
6. holds each refusal's diagnostic — keyword, pointer, wording — to a
   `.err`, as `tests/cases/` holds the compiler's;
7. runs the JSON Schema Test Suite's 2020-12 cases against an exact list of
   expected failures, each with its reason (a refused keyword, an `i64`
   bound), which fails on a stale entry as well as on a new failure, as mjst's
   conformance test does;
8. compiles every generated module of the corpus together, so a class
   generated twice or a name declared twice fails the build.

The generator itself is pure: it takes the schema's bytes and the flags and
returns the module's text, writing no file until it has succeeded, so steps 1
and 2 run it in memory.

The schemas, in the order they are vendored:

| Schema | Licence | Why |
| --- | --- | --- |
| `schemas/package.schema.json`, `schemas/capabilities-lock.schema.json` | this repository's (MIT): nothing to vendor | real schemas with `x-mjst`, `$ref`, `examples`, `pattern`; `package.schema.json`'s `exports` is an untagged `anyOf` and `propertyNames`, so it is the corpus's first expected refusal until `--omit` (§9.2) |
| JSON Schema Test Suite, `tests/draft2020-12/` | MIT, to be confirmed when vendored | every keyword with valid and invalid instances, the reference for steps 3 and 6 |
| an OpenAPI 3.1 example with a `discriminator` | Apache-2.0, to be confirmed when vendored | `components.schemas`, a tagged union, `externalDocs` |
| one SchemaStore schema (a `tsconfig.json`- or `.prettierrc`-sized one) | Apache-2.0, to be confirmed when vendored | a large real-world schema, to count how much is refused |

A vendored schema is a copy under [`.claude/licensing.md`](../.claude/licensing.md):
it keeps its upstream notice beside it and gets a row in
`THIRD_PARTY_NOTICES.md`, which `node tests/run.js third-party-licence` checks.
S5 records, per schema, how many keywords were typed, checked, kept and
refused.

## 9. How it runs

### 9.1 A `nish` subcommand

Recommended: `nish schema`, beside `run` and
`upgrade` (`helpText`, `src/cli-style.ts:35`). The generator must ship with
the compiler whose options it writes — an older compiler refuses a
`constraints` key with NL2494 — and every user has `nish`, where a script
would need Node and a path into the package. It is written in Nish in `src/`,
which already imports `std/` modules (`src/` imports `../std/input` and
`../std/raster`), and reads the schema with the modules of §2.2.

The alternative, a `std/` module (`nish/json-schema-gen`) and a script that
calls it, keeps the generator out of the compiler's binary and lets a program
generate at run time; it is §10 question 9, not the recommendation, because a
program that generates its own classes at run time cannot compile them.

The rolling freeze: the generator *writes* `constraints` and `coerce` as text,
and `src/` itself never decodes through them, so S2–S4's `src/` code uses only
constructs the seed has, which CI's `bootstrap` job checks. A stage that lands
in the same release as the WP61 option it writes compiles its corpus with
`build/nish`, not the seed.

### 9.2 Flags

```
nish schema <schema.json> -o <out.ts>
  [--check]                  regenerate in memory; exit 1 if <out.ts> differs, writing nothing
  [--root <Name>]            the root class's name (§6)
  [--defs-only]              no root class; for a schema whose root is not an object
  [--name <pointer>=<Name>]  settle a name collision (§6)
  [--exact-numbers]          JsonNumber for every number and integer
  [--presence]               a hasX flag per optional property with no default (§5.2)
  [--camel]                  snake_case properties as camelCase fields
  [--coerce]                 every class a WP61 coerce class (§5.5)
  [--omit <pointer>]         weakens: leave out one property the class cannot hold
  [--allow-unknown <name>]   weakens: keep one unknown keyword as a tag (§4.7)
  [--drop-vendor]            weakens: drop x-* keywords (§4.7)
  [--formats-as-tags]        weakens: keep `format` as a tag, not a check (§4.4)
  [--before-constraints]     weakens: before WP61's "S1: constraints in decode",
                             keep validation keywords as tags
```

The header's `Flags:` line lists every flag the run was given, in this
order, with each weakening flag's arguments, so `--check` and a reviewer see
exactly what the file was made with. A weakening flag keeps less than the
schema says:

- `--omit`;
- `--allow-unknown`;
- `--drop-vendor`;
- `--formats-as-tags`;
- `--before-constraints`.

Every other flag changes only names, types or the coerce mode. `Flags: (none)`
means the file holds everything the schema says. `--omit` on a property of a
class with `unknown: "error"` is refused: the omitted key would then fail
every decode.

Exit codes are the compiler's (`helpText`'s "Exit codes"): `0` written or up
to date, `1` the schema refused or `--check` stale, `2` usage.

### 9.3 Its output

- **One module per schema**: the classes in a depth-first walk from the root,
  then each remaining `$defs` entry in key order; fields in `properties`
  order; option keys in the fixed order `rename`, `optional`, `presence`,
  `tag`, `unknown`, `constraints`, `coerce`. One file means one header, one `--check` and
  one import; a schema too large for one file is better split at its source.
- **Deterministic**: the same schema and flags give the same bytes on every
  host; nothing depends on the time, the path it was run from or a hash
  table's order.
- **A header**: `Generated by nish schema from <file>; do not edit.`, as
  `banner` writes (`src/interop-abi.ts:1357`), the schema's `$id`, the
  SHA-256 of its bytes, and the flags. `--check` compares the whole file, so
  an edit by hand, a changed schema or a different flag all fail it.
- **Exports**: every class and enum, and nothing else. A program decodes
  with `jsonDecode` and any decoder it makes: each class carries its own
  `unknown` (§5.0), so no helper is needed to set the decoder up.
- **Warnings**: a `default` the field cannot hold (§5.1) is a warning on
  stderr, with its pointer and reason. The run still writes the file and
  exits 0.
- **JSDoc escaping**: a `*/` in a description is written `*\/`, a line that
  starts with `@` is written `\@`, so a schema cannot close the comment or
  forge a tag. String literals in options are escaped as `JsonWriter` escapes
  them, so a `pattern` or wire key cannot end its literal.

### 9.4 Extending a generated class

Do not edit the file: `--check` fails, and the next generation erases the
edit. A class with options cannot be extended (`json_reject_options_subclass`),
so a program adds behaviour beside the class, in a hand-written partner
module that imports it: free functions over it (`displayLabel(u: User)`), or a
class of its own that holds a `User`. A field the program needs and the schema
does not have belongs in the schema.

### 9.5 The user guide

Each stage changes what a user sees, so each updates `docs/guide/` in the same
PR. S1 adds the two typed JSON options (§5.0) to the typed JSON section of
`docs/guide/using-nish/standard-library.md`. S2 adds `nish schema` to
`docs/guide/using-nish/cli.md` and `--help`. S3 and S4 extend that section.
S5 gives the topic its own page, "Classes from a
JSON Schema", with a route in `scalar.config.json`, and links it from the
`nish/json-typed` section of `docs/guide/using-nish/standard-library.md:710`.
`docs/reference/command-line.md` is regenerated from `helpText` by
`scripts/gen-reference.mjs`.

## 10. Decisions for the owner

1. **Where the two typed JSON changes land** (§5.0). As WP62's S1, before
   any generator code (recommended: WP62 is their first user, and WP61's
   scope is constraints and coercion). The alternatives:
   - make them a WP61 stage, which WP62's S2 then depends on;
   - order the generator first, refusing the fields and schemas they cover
     until they land.

   Whichever of WP62's S1 and WP61's coercion stage lands first builds the
   in-place reset they share.
2. **A reverse generator.** Build `nish schema --emit-schema` in S5
   (recommended: it is what proves §8.1), or leave the round trip as a test
   of instances only.
3. **`readOnly`/`writeOnly`.** Tags only (recommended for this package), or a
   later typed JSON option by which decoding refuses a `readOnly` key and
   encoding leaves a `writeOnly` field out, which OpenAPI's request and
   response use would want.
4. **Unknown keywords.** Refused unless allowed by name (recommended), or kept
   as tags by default as 2020-12's annotation rule would have it.
5. **Nullable `boolean` and type-discriminated unions.** Refuse (this note), or
   a typed JSON change: `boolean | null` as a field kind, and a union whose
   branches differ by JSON type, decided by the first token without a second
   walk. Both are decoder work, outside this package.
6. **`--presence`** off by default (recommended) or on.
7. **Field names.** Keep a legal property name as written (recommended), or
   camelCase every `snake_case` one by default.
8. **What may follow.** `$anchor` inside the document, and
   `propertyNames: {pattern}` on a `Map` as a WP61 key constraint.
9. **Where it lives.** `nish schema` (recommended) or a `std/` module and a
   script (§9.1).
10. **`format`.** Checked by default, as WP61 checks it, with
    `--formats-as-tags` as a weakening recorded in `Flags:` (recommended: the
    generator never keeps less than the schema says unless the header shows
    it). The alternative is draft 2020-12's default reading, an annotation,
    which mjst takes; it would make a checked format the opt-in.

## 11. Security

The schema is a file the developer chose, read at build time; the generated
module is source the compiler checks like any other. The generator still
bounds what it reads: the schema is parsed with `JsonLimits` (depth, string
and number lengths), `$ref` resolution keeps a visiting set so a cycle of
references is a refusal, not a loop, and a class count limit stops a schema
that would expand without end. The escaping of §9.3 keeps schema text inside
the comments and literals it is written into. The decoder the classes get is
`jsonDecode`'s, whose record is `docs/security/json.md`; a `pattern` it checks
is WP61's, bounded there. No `docs/security/` record is added: the generator
reads no network, terminal or other process.

## 12. Stages

Each stage is a PR, ticked on [the roadmap page](roadmap/wp62-json-schema-classes.md)
when it lands. None adds a construct; each adds diagnostics of the generator,
a corpus directory per behaviour and its guide text.

### S1: typed JSON prerequisites

**Goal:** typed JSON can hold every object schema WP62 maps, without
`| null` and without the decoder's `ignoreUnknown`.

**What lands:** §5.0's two changes, in `src/json-typed.ts`,
`src/emit-json.ts` and `std/json-typed.ts`:

- an optional field whose default the constructor assigns, with NL2498's new
  wording and the new diagnostics;
- the per-class `unknown` option.

Also each one's `docs/LANGUAGE.md` rule, cookbook entry and guide text; the
options' doc comment; and `docs/reference/`, regenerated.

**Tests:** §5.0's positive cases, each with a golden `.ll`, an `llvm-as` pass
and a native round trip with expected stdout; one negative case per new
diagnostic; and the nish-cmp `DECLARED` entries, if the emit moves any corpus
program's IR.

**Exit:** a class with an optional array, map, class and `JsonNumber` field
and no `| null` decodes `{}` to its constructor's values. A strict inner class
inside an ignoring outer class refuses an unknown key under both decoder
settings.

### S2: `nish schema` for plain objects

**Goal:** a schema of objects, scalars, strings and arrays becomes classes
with every annotation and default kept.

**What lands:**

- the subcommand, `--check`, the header and its `Flags:` line, and
  determinism;
- §4.1's `$schema`, `$id` and `$comment`, with draft-07 normalised;
- §4.2 whole;
- §4.3's scalar, array and object rows, with the integer narrowing;
- `additionalProperties` as `unknown` (§5.0);
- `required` and `optional`, the default rule with its warning (§5.1, §5.2),
  and §5.3's encode note;
- names (§6);
- the x-* and unknown-keyword rule (§4.7);
- every refusal outside this scope, with its pointer;
- `cli.md` and `--help`.

**Tests:**

- that the typed-or-checked and kept keyword sets cover every row of §4
  exactly once;
- a corpus directory per §4.2 keyword and per step of §5.1's derivation;
- a default the field cannot hold: the warning on stderr, the `@default` tag
  and the derived initializer;
- an optional field with nothing derivable, refused;
- a refusal per out-of-scope keyword;
- an outer object that allows other keys holding one that does not, decoded
  under both settings of `ignoreUnknown`;
- the JSDoc escaping (`*/`, a leading `@`);
- two runs giving one output;
- `--check` failing on a stale file, on a hand-edited file and on a changed
  flag.

**Exit:** a schema inside this scope compiles to classes that decode its
valid instances and refuse its invalid ones on type, `required` and unknown
keys. One outside it is refused, never weakened.

### S3: `$ref`, maps, nullables and unions

**Goal:** shared definitions and every structure the decoder takes.

**What lands:** `$defs`/`$ref`, `components.schemas`, `#` and other
in-document pointers; `Map` from `additionalProperties`; nullables (§4.3);
tagged unions from `const` and `discriminator`; the flat `allOf` merge;
recursion (§5.4); object defaults; `--omit`.

**Tests:** one class for a `$ref` used twice; a recursive tree through an
array and through `| null`; the refused self-reference through a non-null
field; an OpenAPI 3.1 document with a `discriminator` and `mapping`; a
reference cycle refused; a pointer into an `enum` value refused.

**Exit:** a schema built from `$defs`, maps, nullables and tagged unions
generates and decodes; the refusals of §4.5 hold.

### S4: validation keywords and the coerce switch

**Goal:** the rules travel with the class. It starts after WP61's "S1:
constraints in decode" lands; the coerce switch waits for WP61's "S2:
coercion".

**What lands:** §4.4 whole, with `format` checked by default; the
`--formats-as-tags` and `--before-constraints` weakenings; §5.5's coerce
switch, `--coerce` and `x-nish` `coerce`, with the transitivity check.

**Tests:**

- a corpus directory per keyword family, with each instance's
  `JSON_DECODE_CONSTRAINT` and offset;
- a bound equal to the type's range not repeated;
- a refused pattern and an unknown format;
- the JSON Schema Test Suite's 2020-12 cases for these keywords;
- a coerce class reaching an unmarked class, refused with the path;
- a coerce class with a non-nullable union, refused;
- a non-empty array default in a coerce class, kept only as `@default`.

**Exit:** every validation keyword of §4.4 is checked in the decode, the
suite's verdicts are matched for each, and a coerce schema decodes every
corpus instance to an instance the schema accepts.

### S5: the corpus, the guide page and the round trip *(owner's decisions)*

**What lands:** the vendored corpus of §8.2 with its notices; the per-schema
counts of typed, checked, kept and refused keywords, written into this note;
the guide page and its route; the reverse generator if §10 question 2 is
taken; the owner's answers to §10 recorded here.

**Exit:** the corpus green under steps 1–6 of §8.2, and the figures here.

## 13. Not planned

A runtime schema interpreter or validating a `JsonDocument` against a schema;
untagged unions by trial decoding; string enums as a language feature;
leaving absent optional keys out of the encoding (a typed JSON change); one
file per `$defs` entry; JSON Schema drafts before draft-07; OpenAPI 3.0 beyond folding `nullable`; generating servers or clients from OpenAPI paths; a
schema fetched over the network.
