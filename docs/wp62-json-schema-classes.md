# WP62: Nish classes from a JSON Schema, keeping everything the schema says

**Status: proposed, design only.** Nothing here is built. The stages are in
§12 and on [the roadmap page](roadmap/wp62-json-schema-classes.md). S4 waits
on the owner (§10). The plan that tracks the stages is
[`.claude/plans/wp62-json-schema-classes.plan.md`](../.claude/plans/wp62-json-schema-classes.plan.md).

Every claim about today's code is anchored at commit `798636cb`, on `main`.
Read [Typed JSON](LANGUAGE.md#typed-json-nishjson-typed) first: it is what the
generated classes are for.

**WP61 (proposed)** — `docs/wp61-json-schema.md`, on its own branch while this
note is written — puts a schema's validation keywords into a class's
`static readonly json` literal as a `constraints` option, checked inside
`jsonDecode`'s one pass, and adds an opt-in `coerce` option. It also sketches a
generator (its §4 and §7, and its stage S3). This package is that generator,
designed in full: WP61 decides what the class can *say*; WP62 decides how a
schema becomes the class, keyword by keyword, and what of the schema survives.
Where the two overlap, this note follows WP61's spelling (`constraints`,
`coerce`, `nish schema`) and its refusals, and §10 question 1 asks the owner to
let WP62's stages replace WP61's S3.

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
    (`std/json-typed.ts:178`, read at `src/json-typed.ts:266`);
  - `optional` lists fields whose key may be missing; a missing one is set back
    to its initializer, and an optional field with no initializer is NL2498
    (`docs/LANGUAGE.md:13578`);
  - `presence` names a `boolean` field that records whether a key was given
    (`std/json-typed.ts:190`, `docs/LANGUAGE.md:13605`);
  - `tag` replaces a union variant's member name on the wire
    (`std/json-typed.ts:285`, `docs/LANGUAGE.md:13675`).
- **Decoding is strict**: every field required unless `optional`, an unknown
  key an error unless `d.ignoreUnknown` (`docs/LANGUAGE.md:13497`), a
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
| keeps the keywords it enforces in one explicit set, `ENFORCED_KEYWORDS`, everything else being annotation (`validation/src/validators/generators/enforced-keywords.ts:16`) | two sets in the generator, the typed-or-checked keywords and the kept ones, and a test that every row of §4 is in exactly one (S1) |
| normalises before it maps: draft-07 upgraded to 2020-12 (`helpers/src/upgrade-draft07-schema.ts:143`), OpenAPI 3.0's `nullable: true` folded into the type (`helpers/src/fold-nullable.ts:23`) | the normalising pass of §4.1 and §4.6 |
| finds a union's discriminator structurally: a property that is a `const` or one-value `enum` in every branch, the values distinct (`validation/src/parsers/helpers/find-discriminator.ts:8`); OpenAPI's `discriminator` is only an annotation there | §4.5, which reads the keyword as well |
| one shared type per `$ref`, a stable name per reference, a cycle guard, collisions and non-identifier names refused (`validation/src/validators/generators/assert-generatable-refs.ts:35`, `helpers/src/ref-to-name.ts:100`) | §6 and §11 |
| JSDoc of `description` alone (`$comment` as its fallback), escaping `*/` as `*\/` (`helpers/src/generate-type-definition.ts:463`) | the escaping of §9.3; WP62 also keeps `title`, `examples`, `deprecated`, `default`, `externalDocs` and `x-*` (§4.2), the gap this package closes |
| a field's fallback value in a fixed order — a `default` only if it is an instance of the type, then `const`, the first `enum` value, the first example of the right type, then the type's zero moved into its bounds (`helpers/src/get-default-value.ts:206`) | the derivation of §5.1, stricter: a `default` of the wrong type is an error, not skipped |
| `format` an annotation unless the caller asks for formats to be enforced, and then only the formats the schema names (`validation/src/validators/generators/emit-format-checks.ts`) | the `format` row of §4.4 |
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
which case it is kept as a comment. The one way to lose a keyword is to ask by
name (`--omit <pointer>`, §9.2), which the header then records.

## 4. The keyword table

Draft 2020-12's vocabularies in order, then OpenAPI 3.1's additions. "S*n*" is
the stage that lands the row (§12).

### 4.1 Core (`$`-keywords)

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `$schema` | typed | must name draft 2020-12 or be absent. A draft-07 schema is first upgraded to 2020-12 by a normalising pass (`definitions` to `$defs`, array `items` to `prefixItems`, `dependencies` split), as mjst does, for the subset WP61 accepts (its §10 question 7); a keyword the upgrade cannot carry is refused at its original pointer. Other drafts are refused. Written in the header. S1 |
| `$id` | kept | the header's `Schema id:` line. S1 |
| `$defs` (and `definitions`) | typed | one class (or union) per entry, named by its key (§6). S2 |
| `$ref` to `#/$defs/X`, `#/components/schemas/X` | typed | the shared class `X`; one class however often it is referenced. Annotations beside the `$ref` (2020-12 allows siblings) go on the *field's* JSDoc; a validation keyword beside it is refused, since it would constrain one use of a shared class. S2 |
| `$ref` to another document, `$dynamicRef`, `$dynamicAnchor`, `$anchor`, `$recursiveRef` | refused | a reference the generator cannot resolve inside the one document. `$anchor` could be resolved later (§10 question 8) |
| `$vocabulary` | refused | a custom vocabulary means keywords this table does not know |
| `$comment` | kept | a `//` line above the class or field, never in the JSDoc: draft 2020-12 says it is for maintainers, not users. S1 |

### 4.2 Annotations (meta-data vocabulary)

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `title` | kept | the JSDoc's first line; a blank line follows when there is a `description`. S1 |
| `description` | kept | the JSDoc's body, its text as written (Markdown is left as Markdown). S1 |
| `examples` | kept | one `@example` block per entry, the value pretty-printed by `JsonWriter` with `setIndent(2)`. S1 |
| `deprecated: true` | kept | `@deprecated`; an editor strikes the field through. `false` writes nothing. S1 |
| `readOnly: true`, `writeOnly: true` | kept | `@readOnly` and `@writeOnly` tags. Not mapped to TypeScript's `readonly`: decoding assigns every field and a `readonly` one is NL2487. Whether decode and encode should *honour* them is §10 question 3. S1 |
| `default` | typed | the field's initializer (§5). S1 for scalars, strings and arrays of them; S2 for objects |

### 4.3 Types and structure (applicator and validation vocabularies)

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `type: "integer"` | typed | `i64`; `i32`, `u32` or `u64` when `minimum` and `maximum` are both given and fit, compared exactly with `jsonNumberCompare` (WP61 §4's narrowing rule, followed as written). `JsonNumber` under `--exact-numbers`, so an integer past `i64` is not a `RANGE` error. S1 |
| `type: "number"` | typed | `f64`; `JsonNumber` under `--exact-numbers`, or when a `multipleOf`, bound or `default` is not exactly an `f64` (WP61 §4). S1 |
| `type: "string"` | typed | `string`. S1 |
| `type: "boolean"` | typed | `boolean`. S1 |
| `type: "null"` alone | refused | a field that can only be `null` has no Nish type. S1 |
| `type: [T, "null"]`, `oneOf`/`anyOf` of `S` and `{type: "null"}` | typed | `string \| null`, `C \| null`, `T[] \| null`, `Map<…> \| null`, initializer `null`. A nullable integer or number is `JsonNumber \| null`, the one scalar the decoder takes with `\| null`; a nullable `boolean` is refused (§10 question 5). S2 |
| `type` with two non-null types | refused | an untagged union (§4.5) |
| `type: "array"`, `items: S` | typed | `S'[]`, the array made in the constructor. An array of arrays, an array of maps and an array of nullable elements are refused, as the decoder refuses them. S1 |
| `prefixItems`, `items: false`, `contains`, `minContains`, `maxContains`, `unevaluatedItems` | refused | a tuple or a containment rule the class cannot hold |
| `type: "object"` with `properties` | typed | a class, one field per property in `properties` order (§6). S1 |
| `required` | typed | a property not listed goes into `optional` (§5.2). A name in `required` that `properties` does not declare is refused: the class would accept an object the schema rejects. S1 |
| `additionalProperties: false` | typed | today's strict decode |
| `additionalProperties` absent or `true` beside `properties` | typed | the class decodes with `ignoreUnknown`, which the generated `decodeX` helper sets (§9.3); a decoder the program makes itself must set it too, which the class's JSDoc says. S1 |
| `additionalProperties: S` with no `properties` | typed | `Map<string, S'>`. With `properties` as well, refused: a class with a map of "the rest" is not a field type. S2 |
| `propertyNames`, `patternProperties` | refused | a rule on keys the decoder has no place for; `propertyNames: {pattern}` on a `Map` could become a WP61 key constraint later (§10 question 8) |
| `dependentRequired`, `dependentSchemas`, `unevaluatedProperties`, `minProperties`/`maxProperties` on a class | refused | rules across fields; `min`/`maxProperties` on a `Map` are WP61 constraints. S3 |

### 4.4 Validation keywords → WP61's `constraints`

Each is copied under its own name into the field's entry in `constraints`, so
the generator translates nothing (WP61 §3). All land in S3, after WP61's S1.

| Keyword | On | Note |
| --- | --- | --- |
| `minLength`, `maxLength`, `pattern` | `string` | a `pattern` `nish/regex` refuses is refused here, with the regex error |
| `format` | `string` | an annotation by default, as draft 2020-12 reads it: kept as a `@format` tag. Under `--assert-formats` (§10 question 10) each format the schema names becomes a constraint checked with `nish/json-format`, and a name `jsonFormatId` answers `JSON_FORMAT_UNKNOWN` for is refused |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` | integers, `f64`, `JsonNumber` | a bound equal to the narrowed type's own range is the type's `RANGE` check and is not repeated (WP61 §4); the reverse generator writes it back from the type (§8.1) |
| `minItems`, `maxItems`, `uniqueItems` | arrays | `uniqueItems` on an array of objects is refused (WP61 §5.3) |
| `minProperties`, `maxProperties` | `Map` | |
| `enum` | `string`, integers | the field keeps its type and gains an `enum` constraint: Nish has no string enums (NL1043, `docs/LANGUAGE.md:13485`). A mixed `enum` (strings and numbers, or objects) is refused. Before S3 the values are kept as a `@enum` tag and the field is refused unless `--before-constraints` (§9.2) |
| `const` | `string`, integers | an `enum` constraint of one value, or a union's tag (§4.5) |
| `contentEncoding`, `contentMediaType`, `contentSchema` | `string` | kept as `@contentEncoding`, `@contentMediaType` tags; the field stays a `string`. `contentSchema` is refused: it is a schema for the decoded content, which the class does not decode |

### 4.5 Combining schemas

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `oneOf`/`anyOf` of objects, each with a `const` or a one-value `enum` on one shared property, the values distinct across branches (found structurally, as mjst does), or with OpenAPI's `discriminator.propertyName` | typed | a tagged union: a numeric `enum` with a member per tag, one class per variant with `readonly kind: Tag.X = Tag.X`, `tag: "<wire string>"`, and a `rename` when the property is not called `kind` (`docs/LANGUAGE.md:13675`). `discriminator.mapping` names each variant's tag. S2 |
| `oneOf`/`anyOf` of `S` and `{type: "null"}` | typed | `S' \| null` (§4.3). S2 |
| `allOf` of a `$ref` and an object, or of objects whose properties do not overlap | typed | one class with the properties of each in order: the one merge WP61 §4 accepts. S2 |
| `allOf` beyond that | refused | overlapping or conflicting branches |
| `oneOf`/`anyOf` without a tag ("untagged") | refused | it would need trial decoding, a second walk. A union whose branches differ by JSON type (a string or an object, as `package.json`'s `exports`) needs no trial — the first token decides — but the decoder has no field kind for it (§10 question 5) |
| `not`, `if`/`then`/`else` | refused | no place in a class |

### 4.6 OpenAPI 3.1 additions

OpenAPI 3.1's Schema Object is draft 2020-12 plus these:

| Keyword | Outcome | Where it goes |
| --- | --- | --- |
| `discriminator` | typed | the union's tag (§4.5). S2 |
| `externalDocs` | kept | `@see <url> <description>`. S1 |
| `example` (singular, deprecated in 3.1) | kept | one `@example`, as `examples`. S1 |
| `xml` | kept | a `@xml` tag holding the object as compact JSON, so the reverse generator can restore it; nothing in Nish reads XML. S1 |
| `nullable: true` (OpenAPI 3.0) | typed | folded by the normalising pass into `type: [T, "null"]` (or a `oneOf` with `null` beside a `$ref`), then mapped as §4.3. The rest of a 3.0 document is not read. S2 |

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
  2^31 − 1 — is refused. S2
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

### 5.1 The initializer is the default

Every generated field has an initializer, because an optional field must have
one (NL2498) and because WP61's coercion falls back on it. That fallback must
be a value the schema accepts, so the initializer is derived in mjst's order
(`helpers/src/get-default-value.ts:206`), with `null` moved ahead of the
examples; the first that applies wins:

1. the schema's `default`;
2. the `const`;
3. the first `enum` value;
4. `null`, when the schema allows it;
5. the first entry of `examples` that the field's type and constraints accept;
6. the type's zero, moved into the field's constraints: `0` raised to
   `minimum` and onto `multipleOf`, `""` padded to `minLength`, an empty
   array or map (which `minItems` and `minProperties` refuse — see below), a
   new object of the field's class, whose own fields are derived the same way,
   a new `JsonNumber`, or for a union field its first variant in `oneOf`
   order.

The value chosen is checked against the field's type and every constraint
the generator writes for it; when none of the six gives one — a `pattern` no
padded string meets, a `minItems: 1` array with no `default` — the field is
refused unless it is required, where the initializer is never seen after a
successful decode and the zero is written with a comment saying so.

A scalar or `string` default is written as a literal; an array default as an
array literal assigned in the constructor; an object default as a private
factory function in the generated module that makes the class and sets the
fields the default gives (S2). A `default` the field cannot hold is a
generator error naming its pointer: `default: "7"` on an integer, `-1` on a
narrowed `u32`, `1.5` on an integer, `null` on a non-nullable field, a string
that is not valid UTF-8, a default that breaks the field's own constraints
(`default: ""` with `minLength: 1`), and an object default with a key its class
does not have. mjst skips such a default and falls through to the next rule;
WP62 refuses, because a stale `default` in the schema is a bug its author
should see. The `default` is also the field's `@default` JSDoc tag, so a
reader sees it where the type is.

### 5.2 How this meets `required`

| Property | Generated |
| --- | --- |
| in `required`, no `default` | a required field (not in `optional`); its initializer is derived as §5.1 and is never seen after a successful decode |
| in `required`, with a `default` | still required, as WP61 §4.2 says: the decoder must refuse a body that leaves it out. The initializer is the default, which is what a program sees on an object it makes with `new`, and what a WP61 coercion falls back on |
| not in `required`, with a `default` | in `optional`; a missing key decodes to the default, as the schema says |
| not in `required`, no `default` | in `optional`; a missing key decodes to the value §5.1 derives: `null` when the schema allows it, else a value the schema accepts. `--presence` adds a `hasX` field per such property, recorded in `presence`, for a program that must tell "missing" from "given the zero" (§10 question 6) |

### 5.3 What encoding writes back

`jsonEncode` writes every field (`std/json-typed.ts:368`), so an optional key
the input left out is written back holding its initializer. Because §5.1
derives an initializer the schema accepts, and refuses an optional field it
cannot derive one for, the re-encoded document is always valid against the
schema; it is only longer than the input. The JSDoc of an optional field
without a `default` says it is written even when it was absent. Leaving
absent keys out of the encoding is a typed JSON change, not a generator one
(§11, "Not planned").

### 5.4 Recursion

A class that reaches itself through an array, a map or a nullable field is
generated (S2): its initializer is `[]`, an empty map or `null`, and the
decoder recurses one frame per level, bounded by `JsonLimits.maxDepth`. One
that reaches itself through a required, non-nullable object field is refused:
no finite JSON value satisfies such a schema, and the zero of §5.1 would
construct forever. An *optional*, non-nullable self-reference is refused too,
since its zero is the same infinite object and a `| null` initializer would
encode a `null` the schema forbids. This answers WP61's §10 question 5 for
the generator's side.

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
    "display-name": { "type": ["string", "null"], "$comment": "added in v2" },
    "role": { "type": "string", "enum": ["admin", "member"], "default": "member" },
    "tags": { "type": "array", "items": { "type": "string" }, "deprecated": true }
  },
  "x-owner": "accounts-team"
}
```

`nish schema user.json -o user.ts`, once S3 has landed:

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
 * Decode with `ignoreUnknown`: the schema allows other keys.
 * @x-owner "accounts-team"
 */
export class User {
  static readonly json = {
    rename: { displayName: "display-name" },
    optional: ["displayName", "role", "tags"],
    constraints: {
      name: { minLength: 1 },
      role: { enum: ["admin", "member"] },
    },
  };
  id: u32 = 0;
  /**
   * @example
   * "ada"
   */
  name: string = "ada";
  // added in v2
  displayName: string | null = null;
  /** @default "member" */
  role: string = "member";
  /** @deprecated */
  tags: string[];
  constructor() {
    this.tags = [];
  }
}
```

`name`'s initializer is its first example (§5.1), which meets its
`minLength`. `id`'s bounds are exactly `u32`'s range, so they are its `RANGE` check and not
a constraint. Before S3 the same schema is refused at `/properties/name`
(`minLength`) unless `--before-constraints` is given.

## 8. The round trip, and the corpus test

### 8.1 What survives

schema → classes keeps:

- every type, every `required`, every wire name and every `default`;
- every validation keyword (S3), in WP61's literal under its own name, or
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
   `default` or zero (§5.3), so the diff is exactly the keys the schema let the
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
S4 records, per schema, how many keywords were typed, checked, kept and
refused.

## 9. How it runs

### 9.1 A `nish` subcommand

Recommended, as WP61 §7.1 recommends: `nish schema`, beside `run` and
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
and `src/` itself never decodes through them, so S1–S3's `src/` code uses only
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
  [--coerce <pointer>,...]   WP61's coerce option on these properties
  [--omit <pointer>]         leave out one property the class cannot hold
  [--assert-formats]         check each named format in the decode (§4.4)
  [--allow-unknown <name>]   keep one unknown keyword as a tag (§4.7)
  [--drop-vendor]            drop x-* keywords (§4.7)
  [--before-constraints]     before WP61 S1: keep validation keywords as tags
```

Every flag that keeps less than the schema says (`--omit`, `--drop-vendor`,
`--before-constraints`) is written into the header's `Flags:` line, so the weakening is visible in the file a reviewer
reads. `--omit` on a property of a class that does not already ignore unknown
keys is refused: the omitted key would then fail every decode.

Exit codes are the compiler's (`helpText`'s "Exit codes"): `0` written or up
to date, `1` the schema refused or `--check` stale, `2` usage.

### 9.3 Its output

- **One module per schema**: the classes in a depth-first walk from the root,
  then each remaining `$defs` entry in key order; fields in `properties`
  order; option keys in the fixed order `rename`, `optional`, `presence`,
  `tag`, `constraints`, `coerce`. One file means one header, one `--check` and
  one import; a schema too large for one file is better split at its source.
- **Deterministic**: the same schema and flags give the same bytes on every
  host; nothing depends on the time, the path it was run from or a hash
  table's order.
- **A header**: `Generated by nish schema from <file>; do not edit.`, as
  `banner` writes (`src/interop-abi.ts:1357`), the schema's `$id`, the
  SHA-256 of its bytes, and the flags. `--check` compares the whole file, so
  an edit by hand, a changed schema or a different flag all fail it.
- **Exports**: every class and enum, and per root class a
  `decodeX(bytes: u8[]): X | i32`-shaped helper (its exact form is S1's
  choice, a `Result` per WP17 or a code) that makes the decoder with the
  `ignoreUnknown` the schema asks for.
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
PR: S1 adds `nish schema` to `docs/guide/using-nish/cli.md` and `--help`; S2
and S3 extend that section; S4 gives the topic its own page, "Classes from a
JSON Schema", with a route in `scalar.config.json`, and links it from the
`nish/json-typed` section of `docs/guide/using-nish/standard-library.md:710`.
`docs/reference/command-line.md` is regenerated from `helpText` by
`scripts/gen-reference.mjs`.

## 10. Decisions for the owner

1. **Who owns the generator.** WP62's stages replace WP61's S3 (recommended),
   so the mapping lives in one note; WP61 keeps the decoder side.
2. **A reverse generator.** Build `nish schema --emit-schema` in S4
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
10. **`format`.** An annotation unless `--assert-formats` (recommended: it is
    draft 2020-12's reading and mjst's), or checked by default as WP61's
    generator sketch has it, with `--unknown-format=ignore` for names
    `nish/json-format` does not know.

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

### S1: `nish schema` for plain objects

**Goal:** a schema of objects, scalars, strings and arrays becomes classes
with every annotation and default kept.

**What lands:** the subcommand, `--check`, the header, determinism; §4.1's
`$schema`, `$id`, `$comment`; §4.2 whole; §4.3's scalar, array and object
rows; `required` and `optional` (§5.1, §5.2) and the encode warning (§5.3);
names (§6); the x-* and unknown-keyword rule (§4.7); every refusal outside
this scope, with its pointer; `cli.md` and `--help`.

**Tests:** the test that the typed-or-checked and kept keyword sets cover every row of §4 exactly once; a corpus directory per §4.2 keyword and per step of §5.1's derivation; a
refusal per out-of-scope keyword; a default the field cannot hold; the JSDoc
escaping (`*/`, a leading `@`); two runs giving one output; `--check` failing
on a stale and on a hand-edited file.

**Exit:** a schema inside this scope compiles to classes that decode its
valid instances and refuse its invalid ones on type, `required` and unknown
keys; one outside it is refused, never weakened.

### S2: `$ref`, maps, nullables and unions

**Goal:** shared definitions and every structure the decoder takes.

**What lands:** `$defs`/`$ref` and `components.schemas`; `Map` from
`additionalProperties`; nullables (§4.3); tagged unions from `const` and
`discriminator`; the flat `allOf` merge; recursion (§5.4); object defaults;
`--omit`.

**Tests:** one class for a `$ref` used twice; a recursive tree through an
array and through `| null`; the refused required self-reference; an OpenAPI
3.1 document with a `discriminator` and `mapping`; a reference cycle refused.

**Exit:** a schema built from `$defs`, maps, nullables and tagged unions
generates and decodes; the refusals of §4.5 hold.

### S3: validation keywords onto WP61's `constraints`

**Goal:** the rules travel with the class. Starts after WP61's S1 lands (and
`--coerce` after its S2).

**What lands:** §4.4 whole; `--coerce`; `--assert-formats`; the
`--before-constraints` path kept for older compilers.

**Tests:** a corpus directory per keyword family, each instance's
`JSON_DECODE_CONSTRAINT` and offset; a bound equal to the type's range not
repeated; a refused pattern and format; the JSON Schema Test Suite's
2020-12 cases for these keywords.

**Exit:** every validation keyword of §4.4 checked in the decode, and the
suite's verdicts matched for each.

### S4: the corpus, the guide page and the round trip *(owner's decisions)*

**What lands:** the vendored corpus of §8.2 with its notices; the per-schema
counts of typed, checked, kept and refused keywords, written into this note;
the guide page and its route; the reverse generator if §10 question 2 is
taken; the owner's answers to §10 recorded here.

**Exit:** the corpus green under steps 1–6 of §8.2, and the figures here.

## 13. Not planned

A runtime schema interpreter or validating a `JsonDocument` against a schema;
untagged unions by trial decoding; string enums as a language feature;
leaving absent optional keys out of the encoding (a typed JSON change); one
file per `$defs` entry; JSON Schema drafts before 2020-12 beyond what WP61
accepts; OpenAPI 3.0 beyond folding `nullable`; generating servers or clients from OpenAPI paths; a
schema fetched over the network.
