# WP69: JSON Schema validation at run time, with external references

**Status: proposed, design only; nothing in `runtime/`, `src/` or `std/` is
built.** [LANGUAGE.md](LANGUAGE.md) stays normative. The anchors in this
repository are at `d0f446d1`. The upstream anchors are Spectral at
`16aae2b6f444` (`stoplightio/spectral`) and vacuum at `0c02c44f17cd`
(`daveshanley/vacuum`).

A JSON/YAML style-guide linter is being written in Nish. It takes the inputs
Spectral takes — YAML and JSON rulesets, rules written in Nish, and the
documents they lint — and reports what Spectral reports. Where Spectral and
vacuum disagree, Spectral's behaviour is the default and vacuum's is an option
where it is cheap. The linter's `schema` rule function validates a node of the
linted document against a JSON Schema, and most of the OpenAPI and AsyncAPI
rules are built on it. This note is the validator that function needs. The
rest of what the linter asks of `std/` is [WP70](wp70-linter-surface.md).

## 1. The problem

The schemas a linter validates against are not known when the linter is
compiled. They come from three places:

- a YAML or JSON ruleset's `then.functionOptions.schema`;
- the linted document itself (an OpenAPI `example` against its `schema`, an
  AsyncAPI message payload against its `payload`);
- the published OpenAPI and AsyncAPI meta-schemas, which use draft-04,
  draft-07 and 2020-12 between them.

Nothing in Nish validates a JSON value against a schema read at run time.
The two packages that touch JSON Schema both say so:

- [WP61](wp61-json-typed-checks.md) checks a class's `constraints` inside
  `jsonDecode`, and lists "a runtime schema interpreter" and "validating a
  `JsonDocument` against a schema" as not planned (`docs/wp61-json-typed-checks.md:1096` to `:1097`).
- [WP62](wp62-json-schema-classes.md) writes classes from a schema at compile
  time, and lists the same two as not planned
  (`docs/wp62-json-schema-classes.md:1143`).

Neither could be stretched to cover this:

- **The schema does not exist at compile time.** A class generated from a
  schema needs the schema before the program is built; a ruleset's schema
  arrives with the ruleset.
- **WP62 refuses keywords the meta-schemas use.** Its keyword table
  (`docs/wp62-json-schema-classes.md:220` to `:268`) refuses untagged
  `oneOf`/`anyOf` (OpenAPI's schema-or-reference is one), `not`,
  `if`/`then`/`else`, `patternProperties` (every `^x-` extension),
  `propertyNames`, `prefixItems`, `contains`, `dependentRequired` and the
  `unevaluated*` keywords, because a class has no place for them.
- **`jsonDecode` reads text, not a tree.** The linter validates a node of a
  document it has already parsed, often many nodes of one document.
- **`jsonDecode` keeps one error** (`std/json-typed.ts:673`, `fail` records
  only the first). That is Spectral's default too (§3), but Spectral can report
  every error, and the linter must be able to.

## 2. What exists

The keyword semantics a validator needs are mostly built, each tested against
JSON-Schema-Test-Suite:

| Need | Module |
| --- | --- |
| A document as a tree of handles | `std/json-value.ts` (`JsonDocument`, `kind`, `at`, `keyAt`, `get`) |
| `const`, `enum`, `uniqueItems` equality | `std/json-equal.ts` (`jsonEqual`, `jsonEqualFirstDuplicate`) |
| `minimum`, `maximum`, `multipleOf` on exact number text | `std/json-number.ts` (`jsonNumberCompare`, `jsonNumberMultipleOf`) |
| `format` | `std/json-format.ts` (`jsonFormatId`, `jsonFormatCheck`) |
| `$ref` fragments | `std/json-pointer.ts` (`jsonPointerParse`, `jsonPointerResolve`) |
| `pattern`, `patternProperties` | `std/regex.ts` (`regexCompile`, linear in the subject) |
| `minLength`, `maxLength` | `std/text.ts` (`codePointLength`) |
| YAML resources | `std/yaml.ts`, `std/yaml-json.ts` (`YamlJsonLoader`) |
| HTTPS | `std/net/fetch.ts` (`fetchSync`, `FetchSyncClient`; TLS at `:19` to `:24`) |

What is missing is the part that walks a schema over a value: dialects,
`$ref` and `$id` resolution, the applicators, the error report, and the
loading of resources the schema names but does not hold.

## 3. The reference: Spectral's `schema` function

Spectral validates with ajv 8 (`packages/functions/src/schema/ajv.ts`):

- **One ajv instance per dialect** (`ajv.ts:67` to `:75`): `draft4`
  (`ajv-draft-04`), the default instance (draft-06 and draft-07),
  `draft2019-09` and `draft2020-12`. The dialect is the rule's `dialect`
  option, or `detectDialect` reads it from `$schema`, and is `draft7` when
  neither says (`packages/functions/src/schema/index.ts:74` to `:75`).
- **The first error only, unless asked** (`index.ts:71`:
  `allErrors = false`).
- **Formats are asserted** (`ajv.ts:38`, `addFormats(ajv)`).
- **`strict: false` and `unicodeRegExp: false`** (`ajv.ts:29` to `:37`): an
  unknown keyword is ignored, and a `pattern` is compiled by `new RegExp(p)`
  *without* the `u` flag, so its syntax is JavaScript's Annex B.
- **`ajv-errors` when `allErrors` is on** (`ajv.ts:39` to `:41`), so a schema's
  `errorMessage` keyword replaces ajv's text.
- **The wording is `@stoplight/better-ajv-errors`'** (`index.ts:85`), over
  ajv's error objects: `keyword`, `instancePath`, `schemaPath`, `params`.

vacuum validates with `pb33f/jsonschema/v6` (its `go.mod`), a fork of
`santhosh-tekuri/jsonschema`, whose messages differ from ajv's. vacuum is the
second reference: where the two disagree on whether a value is valid, the
draft's own text decides, and JSON-Schema-Test-Suite is where it is written
down.

## 4. The decisions

### 4.1 A `std/` module, `nish/json-schema`

The validator lives in `std/`, not in the linter. A server checking a request
body against an OpenAPI component, or a tool reading a configuration format,
needs the same thing, and the building blocks in §2 are already there.

### 4.2 Dialects as ajv has them

Each schema is validated under one dialect: draft-04, draft-06, draft-07,
2019-09 or 2020-12. The caller names it, or it is read from the root's
`$schema`, and draft-07 when neither says, as Spectral does. Where the drafts
differ the dialect decides: `$ref` beside other keywords (ignored before
2019-09), `items` as an array and `additionalItems` (before 2020-12),
`exclusiveMinimum` as a boolean, `id` against `$id` and `dependencies`
(draft-04), and `$recursiveRef` (2019-09) against `$dynamicRef` (2020-12).
One interpreter holds every keyword; the dialect is a table of which keywords
are live and what a few of them mean.

### 4.3 The first error, or all of them

`validate` stops at the first error unless the caller asks for all. The
default is Spectral's (§3), and stopping is cheaper. With all errors, the
order is the one ajv reports in, so the linter's findings come out in
Spectral's order.

### 4.4 Formats when asked

`format` is an annotation unless the caller asks for it to be asserted, as
2020-12 specifies. Asserted, each format is `nish/json-format`'s check, and an
unknown format name is ignored, as ajv with `strict: false` ignores it. The
linter always asks.

### 4.5 Errors carry ajv's fields, not its English

An error is a record of what failed: the keyword, the instance location (a
JSON Pointer into the document), the schema location (a JSON Pointer into the
schema, through each `$ref` followed), the keyword's values (the missing
property, the limit, the expected type), and the failing value's handle.
These are the fields of ajv's error object, so the linter turns them into
`better-ajv-errors`' wording and applies `errorMessage` itself. The module
carries no other library's sentences; a `describe(error)` helper gives a short
text of its own for programs that only want one.

### 4.6 Patterns through a caller's translation

Spectral compiles a schema's `pattern` without the `u` flag (§3), so a
pattern such as `{}` (a literal brace) is valid there and refused by
`nish/regex`. The validator takes an optional function reference,
`(source: string) => string`, applied to each `pattern` and
`patternProperties` key before `regexCompile`; it is a capture-free top-level
function, which Nish can hold (LANGUAGE.md, "Function references"). The
linter passes the normaliser it already uses for ruleset patterns
([WP70 §7](wp70-linter-surface.md#7-regex-lookaround-backreferences-and-annex-b-not-planned)).
`nish/regex` itself does not change: a pattern it refuses — lookaround,
backreferences — makes the schema unusable (§4.8), with the pointer and the
regex error.

### 4.7 External references, without I/O in the validator

A schema can name resources it does not hold: `$ref: "./common.yaml#/Pet"`,
`$ref: "https://spec.openapis.org/oas/3.1/schema/2022-10-07"`. The validator
does no I/O of its own:

1. Compiling a schema answers the absolute URIs (resolved against each
   `$id`'s base) that it references and does not hold.
2. The caller loads each one, by any means, and adds it with
   `addResource(uri, document, root)`.
3. Compiling again answers what the added resources reference in turn, until
   nothing is missing. A `$ref` is written in the schema, so every resource a
   validation can reach is known before the first value is validated.

A caller that wants the usual loading uses one of two loaders, each its own
module, so that a program that only validates in-memory schemas reaches no
capability:

- **`nish/json-schema-file`** (`fs.read`): resolves a `file:` URI or a
  relative reference against the referring resource's base and reads it.
  `.yaml`/`.yml` is YAML, `.json` is JSON, and anything else is tried as JSON
  and then as YAML. An optional root refuses a resolved path outside it,
  after `realpathSync`.
- **`nish/json-schema-http`** (`net`, through `nish/net/fetch`): off unless
  the caller enables it. It takes the three options a linter's resolver has
  today: `remote`, `allowedHosts` (a non-empty list implies `remote`), and
  `allowPrivateHosts`. Without the last, a host that resolves to a private,
  loopback or link-local address is refused, checked on the resolved address
  and again on every redirect, so a ruleset or a document cannot make the
  linter call an internal service. It caps the bytes, the time and the
  number of fetches, and fetches each URI once.

A resource that cannot be loaded is not a validation error; it makes the
schemas that reach it unusable (§4.8).

### 4.8 Unusable is not invalid

`validate` answers valid, invalid with its errors, or **unusable** with its
reason: an unresolved `$ref`, a pattern `nish/regex` refuses, a dialect the
module does not know, a limit (§4.9) passed. The linter maps unusable to
silence for a schema taken from the document (its `skipUnusableSchema`) and
to a finding for a schema its ruleset wrote.

### 4.9 Untrusted schemas and values

A schema is as attacker-controlled as a regex pattern: a ruleset or a
document writes it. So:

- **Nothing recurses on the native stack.** The walk keeps its own stack, as
  `jsonEqual` does, and its depth is capped and reported.
- **A `$ref` cycle that consumes no instance** (`{ "$ref": "#" }` at the
  root) is detected at compile time and is unusable, not a hang.
- **Work is bounded per validation**: a budget of keyword evaluations,
  so `oneOf` over `oneOf` over a deep value cannot run away; past it the
  result is unusable.
- **Compile is bounded**: schema size, resources and `$ref` hops.
- **Every failure is a value**: compile answers a `Result`, and no input
  panics.

The core module's limits and their tests go into `docs/security/json.md`. The
HTTP loader reads the network, so it lands with a record of its own under
`docs/security/` and its row in the index, as CLAUDE.md requires for any
module that does.

### 4.10 WP61 and WP62 are unchanged

They are a different feature: typed decoding of a known shape, at compile
time, in one pass over text. Nothing here blocks or replaces them, and their
"not planned" lines now point here.

## 5. The surface, as a sketch

```typescript
import { JsonDocument, JsonValue } from "nish/json-value";
import { SchemaCompiler, SchemaResult, SCHEMA_DIALECT_AUTO } from "nish/json-schema";

const compiler = new SchemaCompiler(SCHEMA_DIALECT_AUTO);
compiler.setAllErrors(false);
compiler.setAssertFormats(true);
compiler.setPatternSource(toStrictPattern); // a top-level (source: string) => string
const compiled = compiler.compile(rulesetDoc, schemaHandle); // Result<Schema, string>
// compiler.missing(): string[] — load each, compiler.addResource(uri, doc, root), compile again
const r: SchemaResult = compiled.value.validate(doc, node);
// r.state: SCHEMA_VALID | SCHEMA_INVALID | SCHEMA_UNUSABLE
// r.errors[i].keyword, .instancePath, .schemaPath, .params, .value
```

The names are the stage's to settle; the shape (a compiler that is told what
it is missing, a compiled schema reused across values, a result with three
states) is the decision.

## 6. How it is tested

- **JSON-Schema-Test-Suite** for draft-04, draft-06, draft-07, 2019-09 and
  2020-12, `optional/format` included; parts are already vendored under
  `tests/json-schema-suite` and `tests/json-schema-suite-format`. A skipped
  file is listed with its reason.
- **A differential against ajv 8 configured as Spectral configures it** (§3),
  over the published OpenAPI 2.0, 3.0, 3.1 and AsyncAPI 2.x and 3.0
  meta-schemas and a document corpus: the same verdict, and with all errors
  the same keyword, instance path and schema path for each error, in the same
  order. Vendoring the meta-schemas keeps their licences
  (`.claude/licensing.md`, `THIRD_PARTY_NOTICES.md`). ajv's answers are
  generated once by a script run by hand and committed beside the corpus,
  with the ajv versions that wrote them; the test reads only those, so ajv
  is not a dependency of this repository (§7).
- **The limits of §4.9**, each with a case that passes it.
- **The loaders** against a local file tree and a local HTTP server: relative
  and absolute references, `$id` bases, the root fence, a private address
  refused, a redirect to one refused, each cap.

## 7. Stages

- **S1: the core validator, 2020-12.** In-memory `$ref`, `$defs`, `$id`,
  `$anchor`, `$dynamicRef`; every applicator and assertion keyword; the first
  error or all; formats when asked; the three-state result; the limits of
  §4.9 and their rows in `docs/security/json.md`.
- **S2: the older dialects.** Draft-04, draft-06, draft-07 and 2019-09 as
  §4.2 describes them, chosen by the caller or by `$schema`; the pattern
  translation of §4.6.
- **S3: external references and the file loader.** §4.7's loop and
  `nish/json-schema-file`.
- **S4: the HTTP loader and its security record.** `nish/json-schema-http`,
  its record and index row.
- **S5: the differential and the docs.** §6's ajv differential, and the
  guide page and `std/README.md` rows completed for all three modules. Each
  earlier stage already updates the guide page and `docs/reference/` for
  what it adds, as CLAUDE.md requires of a `std/` change. The owner chose
  how the differential gets ajv's answers: generated once by a script run by
  hand with ajv outside the repository, and committed beside the corpus with
  a `--check` mode, rather than ajv as a dev dependency run by the test.

## 8. Not planned

- Lookaround and backreferences in `pattern` (refused by `nish/regex`, which
  stays linear: [WP70 §7](wp70-linter-surface.md#7-regex-lookaround-backreferences-and-annex-b-not-planned)).
- `better-ajv-errors`' wording and `ajv-errors`' `errorMessage` keyword: the
  linter's, from the fields of §4.5.
- Generating code or classes from a schema (that is WP62).
- Applying `default`s or coercing a value (ajv's `useDefaults`,
  `coerceTypes`; WP61 coerces at decode).
- `$data` references, custom keywords, and asynchronous schemas (`$async`).
