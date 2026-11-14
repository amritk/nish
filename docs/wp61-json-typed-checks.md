# WP61: Typed JSON, constraints and coercion in one pass

**Status: proposed, design only.** Nothing here is built. This note proposes
three stages:

- S1: constraints checked inside `jsonDecode`.
- S2: a coercion mode in which a decode always yields a correct instance of
  its class.
- S3: the guide page, the error-code table and the benchmarks.

Every claim about today's compiler is anchored at commit `798636cb`. A citation
is a function name and `file:line` at that commit. [LANGUAGE.md](LANGUAGE.md)
stays normative.

**The generator is WP62.** A JSON Schema or OpenAPI 3.1 document becomes Nish
classes in WP62 (`docs/wp62-json-schema-classes.md`), which a separate proposal
covers. WP62 targets the constraint and default spelling this WP defines: the
`constraints` keywords of §4, the initializers and constructor rule of §5.4,
and the `coerce` option of §5. This note maps a schema to a type only where a
keyword's meaning needs it (§4.3).

The owner has decided the following, and this note does not reopen it:

1. **The class is the single source of truth.** Constraints and coercion are
   options in the class's `static readonly json` literal, beside `rename`,
   `optional`, `presence` and `tag`. The compiler writes the decoder from the
   class, as it does today. There is no runtime schema interpreter.
2. **One walk.** Validation and coercion happen inside `jsonDecode`'s single
   pass. A constraint is checked, and a value converted or defaulted, as each
   value is read. Nothing runs in a second pass over the object or over a
   `JsonDocument` tree built first.
3. **Coercion never fails** (§5). In coercion mode, `jsonDecode` always
   answers `JSON_DECODE_OK` with a correct instance of the class:
   - a value is converted when a lossless conversion exists;
   - otherwise the field takes the class's own default;
   - malformed JSON and a limit stop the reading, but they do not fail the
     decode;
   - what went wrong stays readable after the `OK`.

   Strict stays the default.
4. **The repair log is decided by measurement** (§5.6): always on, unless
   keeping it costs more than the stated threshold.

## 1. The problem

A Nish program that receives JSON from a peer writes a class and calls
`jsonDecode` (`std/json-typed.ts:1626`). The decoder the compiler writes for
it checks the *shape*:

- every key names a field (`JSON_DECODE_UNKNOWN`, `:419`);
- no key is given twice (`DUPLICATE`, `:425`);
- no required field is missing (`MISSING`, `:427`);
- every value has its field's type (`TYPE`, `:411`) and fits it (`RANGE`,
  `:417`).

It checks nothing else that a published contract says. Examples: a `name`
that must be 1 to 64 characters, an `age` from 0 to 150, a `role` that must be
one of three strings, an `email` that must be an email. Today the program
checks those after the decode, by hand and field by field, or not at all. A
check written after the decode is a second walk, separated from the bytes
that produced the value, so its error has no offset.

The second gap is input that is nearly right: a `"7"` where the class says
`i32`, a missing key, a stray `null`. Some programs read such input from forms,
query strings, config files or a peer they do not control. They want the best
instance the input allows, not a refusal. Today each one writes that
leniency by hand: it decodes into a `JsonDocument` and walks it, which is the
second pass the owner ruled out.

The comparison the owner set is Bun. There, `JSON.parse` gives an untyped
value, and a TypeScript program checks or coerces it by hand or with a
validator, which is a second walk over the tree. Nish's strict decode refuses
`{"id":"7"}` for `id: i32`: `d.i32()` reads the token, finds a string, and
fails with `JSON_DECODE_TYPE` at byte 6, the string's first byte. The read is
`integer` (`std/json-typed.ts:1077`), which calls `wrongType` (`:673`), which
fails at `this.tok.tokStart`. That stays the default.

## 2. What exists today

### 2.1 The typed layer

`nish/json-typed` is two halves, a library and the compiler's lowering.

**The library**, `std/json-typed.ts`:

- `jsonDecode(d, out)` (`:1626`), `jsonDecodeUnion(d, prev)` (`:1647`) and
  `jsonEncode(w, v)` (`:1662`) are generic functions. The compiler lowers each
  in place, per module, into one internal function (a "part") per class,
  array, map and union it meets. Under Node, where the types are erased, the
  three end the program with an error.
- `JsonDecoder` (`:584`) holds the tokenizer, two sticky fields (`failed` and
  `errorAt`), `ignoreUnknown` (`:600`) and the map-key budget `maxMapKeys`.
  `fail(code, at)` (`:659`) records only the first error. After a failure,
  `take` (`:683`) returns at once, so every later read is a no-op.
- `wrongType()` (`:673`) and `unknownField()` (`:844`) are `@internal` and
  called by name by the generated decoder. `unknownField()` steps over an
  unknown key's value with the tokenizer's `skipValue` when `ignoreUnknown` is
  set (`:852`).
- The value reads are methods: `i32()` (`:1103`), `u32()`, `i64()` (`:1131`),
  `u64()`, `number(n)` (`:1166`), `f64()` (`:1199`), `boolean()` (`:1215`),
  `string(cur)` (`:1233`), and the array and `| null` variants after them. The
  four integer reads share `integer(lo, hi, bounded)` (`:1077`). It already
  compares a value with a range and fails with `JSON_DECODE_RANGE` at
  `tok.tokStart`.
- The codes are `JSON_DECODE_OK = 0` (`:404`) and `TYPE = -20` through
  `TAG = -26` (`:411` to `:442`). **The next free code is -27.** The
  tokenizer's own codes are -1 to -13 (`std/json-tokenizer.ts:132` to `:156`).
  Its limits, `JsonLimits`, are nesting depth, bytes in one string, bytes in
  one number and bytes in the whole window (`std/json-tokenizer.ts:182`).

**The checker half**, `src/json-typed.ts`:

- `checkJsonOptions` (`:507`) reads the `static readonly json` literal. Its
  whitelist is one line, `src/json-typed.ts:542`: `option !== "rename" &&
  option !== "optional" && option !== "presence" && option !== "tag"`.
  Anything else is NL2494.
- Each option has its own reader: `jsonReadRename` (`:267`),
  `jsonReadOptional` (`:317`), `jsonReadPresence` (`:383`) and `jsonReadTag`
  (`:467`).
- `jsonReadOptional` refuses an optional field that has no initializer
  (NL2498, `:338`).

**The emitter half**, `src/emit-json.ts`:

- Its header (`:1` to `:59`) shows the decode a class gets:
  - `beginObject`;
  - a `while (nextField)` loop with a `switch` on the key's length and
    `keyIs`;
  - a `seen` flag per field for the duplicate check;
  - `out.x = d.i32()`;
  - the checks after the loop.

  The generated code "has no error path of its own".
- `emitJsonDecodeBody` (`:911`) writes that body. After the loop, a missing
  optional field is stored its initializer (`:1005`), through
  `initializerConstant` (`src/emit-classes.ts:128`). The checker admits only
  literals and enum members as initializers (LANGUAGE.md, "Classes": "An
  initializer must be a literal"), so an initializer is always a constant. An
  array, map or nested-class field is set in the constructor
  (`examples/merge-patch.ts`, `Profile`).
- `emitJsonDecodeValue` (`:1054`) writes one field's read. An enum field is
  read with `d.i32()` and checked by a `switch` on its members
  (`emitJsonEnumCheck`, `:1029`), whose other arm calls `wrongType`
  (`:1070`).

**The key fact for this note:** every read takes exactly one token. After
`d.i32()` or `d.string(cur)` returns, `tok.tokStart` still points at the first
byte of the value just read. A check placed straight after the read can
therefore act at the value's offset, in the same pass, with no new state.
`emitJsonEnumCheck` already does this for enums. A coercing read uses the
same fact, and the same per-field `seen` flags and after-the-loop block that
`optional` uses.

### 2.2 The pieces already in `std/`

| Module | What it gives | Where |
| --- | --- | --- |
| `nish/json-format` | draft 2020-12 §7.3 formats. `jsonFormatId(name)` resolves a name once; `jsonFormatCheck(id, s)` checks each instance. | `std/json-format.ts:1046`, `:1151` |
| `nish/json-number` | exact decimal comparison and `multipleOf`, never through `f64` | `jsonNumberCompare`, `std/json-number.ts:295`; `jsonNumberMultipleOf`, `:445` |
| `nish/regex` | a compiled regex that never backtracks | `regexCompile`, `std/regex.ts:4940`; `test`, `:4626` |

`JsonNumber` (`std/json-typed.ts:467`) already keeps a number's text exactly.

## 3. The decision

Each rule the class cannot already state is written in the class's options
literal, under the keyword's JSON Schema name:

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
  name: string = "anonymous";
  age: i32 = 0;
  email: string | null = null;
  role: string = "member";
  tags: string[];

  constructor() {
    this.tags = [];
  }
}
```

The compiler writes the check for each constraint straight after its field's
read. A failed constraint fails the decode in strict mode (§4.2). In coercion
mode, written `coerce: true`, it gives the field its default (§5).

A class with neither option is decoded by exactly the code it has now (§6).

Why the class literal:

- **One place.** It is where a class's wire contract already lives. It is
  checked where the class is declared, whether or not anything decodes the
  class (the header, `std/json-typed.ts:169`), so a reader of the class sees
  the rule.
- **Known at build time.** The option is a literal, so the compiler knows
  every bound, pattern, format and default while it writes the code. A
  pattern is compiled once, a format's id is resolved once, and an integer
  bound becomes two `icmp`s.
- **The schema's names.** The keyword names are JSON Schema's. WP62's
  generator copies a keyword across without translation, and a person writing
  a class by hand uses the names that the schema documentation uses.
- **No new syntax.** There is no decorator and no type-level annotation, and
  `src/` never uses the options itself (§7).

## 4. Constraints

### 4.1 The option

`constraints` maps a field name to an object of keywords.

- **Checker.** `checkJsonOptions` (`src/json-typed.ts:507`) admits it in the
  whitelist at `:542` and reads it in a new `jsonReadConstraints`, beside
  `jsonReadRename` (`:267`).
- **Values.** Every value is a literal:
  - a number literal for a bound;
  - a string literal for `pattern` and `format`;
  - an array literal of string or integer literals for `enum`;
  - `true` for `uniqueItems`.
- **Type check.** Each keyword is checked against its field's type where the
  class is declared:

| Keyword | Field types | Check emitted after the read |
| --- | --- | --- |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` | integers | two `icmp`s against constants |
| | `f64` | `fcmp` against the bound, when the bound's literal is exactly an `f64`; otherwise refused unless the field is `JsonNumber`. Each bound is emitted as the negation of an ordered pass test (`!(x >= min)` fails), so `NaN` fails every bound |
| | `JsonNumber` | `jsonNumberCompare(text, bound)` on the number's text, exact |
| `multipleOf` | integers | `srem` against a constant |
| | `JsonNumber`, `f64` | `jsonNumberMultipleOf` on the token's text, exact |
| `minLength`, `maxLength` | `string` | the length in code points, as JSON Schema counts it: the bytes that are not UTF-8 continuation bytes |
| `pattern` | `string` | the module's compiled `Regex`, `test` |
| `format` | `string` | `jsonFormatCheck(id, s)`, with `id` folded to a constant at build time |
| `enum`, `const` | `string`, `i32`, `i64` | a `switch`: on length and then bytes for strings, as key dispatch is (`emitJsonDispatch`, `src/emit-json.ts:858`); on value for integers |
| `minItems`, `maxItems` | arrays | the decoded array's length |
| `uniqueItems` | arrays of integers, strings, booleans | a `Set` over the elements as they are read |
| `minProperties`, `maxProperties` | `Map<string, V>` | the map's size |

**Diagnostics.** Each of these is a diagnostic at the keyword:

- a keyword on a field type it does not apply to;
- a bound that is not a literal of the right kind;
- `minLength` greater than `maxLength`;
- a pattern that `regexCompile` refuses;
- a format that `jsonFormatId` does not know;
- an `enum` value not of the field's type.

The codes take the next free numbers in `src/codes.ts` when S1 lands (NL2786
onward at `798636cb`). NL2494's message adds `constraints` and, in S2,
`coerce` to its list of options.

A constraint computed at run time is not an option. It is the program's own
check, written after the decode as today.

### 4.2 Where the check goes, and the strict error

For a field with constraints, `emitJsonDecodeValue` (`src/emit-json.ts:1054`)
writes the read as today and then the checks, in the order of the table. Each
check branches to one block. In strict mode that block calls a new
`@internal` method:

```ts
/** `JSON_DECODE_CONSTRAINT` at the current token, unless a read failed already. */
constraintFailed(keyword: i32): void
```

This is the twin of `wrongType` (`std/json-typed.ts:673`). It records
`JSON_DECODE_CONSTRAINT = -27` at `tok.tokStart` through the same sticky
`fail`, so a program that checks `d.failed` needs no change.

- **The keyword.** It also sets a new `failedKeyword` field to a
  `JSON_KEYWORD_*` constant. A server can then answer "`age`: maximum" without
  re-checking. The store is on the failure path only.
- **Arrays and maps.** For an array, `minItems` and `maxItems` are checked
  once the array closes, with `errorAt` at the array's `[`. The array part
  saves that offset first in one `i32` local. The same holds for a `Map`'s
  `minProperties` and `maxProperties`.
- **`uniqueItems`.** It inserts each element into a `Set` that the array part
  owns and resets per decode. A repeat fails at the repeated element's first
  byte. `uniqueItems` on an array of objects is refused: equality of two
  decoded objects would be a deep compare, which is a second walk.

### 4.3 What a keyword means here

A keyword means what draft 2020-12 says, because WP62 copies a schema's
keyword across unchanged:

- `minLength` and `maxLength` count code points.
- `pattern` is ECMA-262 and unanchored. `nish/regex` is JavaScript syntax
  (`std/regex.ts:19`) and `test` searches, so a pattern it accepts means the
  same in both. It does not accept all of ECMA-262: backreferences and
  lookaround are refused, and `std/regex.ts:27` to `:40` records where `\p{…}`
  and the `i` flag differ. A pattern outside that subset is refused at
  compile time, never run with another meaning. WP62 must likewise refuse a
  schema `pattern` that uses it.
- `exclusiveMinimum` and `exclusiveMaximum` are numbers, not draft-04's
  booleans.
- `format` is checked, not just annotated. A class that names a format asks
  for it, and a format the module does not know is refused, not ignored.

The one type-level rule this WP needs from the mapping: a bound is exact. An
integer bound on an integer field is two `icmp`s. A bound or `multipleOf` that
`f64` cannot hold exactly is refused on an `f64` field and allowed on a
`JsonNumber` field, which compares the text exactly.

### 4.4 The pattern, compiled once

A `pattern` is a string literal. The compiler checks it with the same
`regexCompile` the program would call, refusing any pattern the module
refuses. The module that decodes the class gets one module-scoped `Regex` per
distinct pattern, compiled on the first decode that needs it and then kept.
§8 bounds its cost.

## 5. Coercion: the decode always yields a correct instance

### 5.1 The mode, and the guarantee

`coerce: true` in a class's literal puts the class in coercion mode. Strict
stays the default: a class without the option decodes exactly as today, and
`{"id":"7"}` into `id: i32` is still `JSON_DECODE_TYPE` at byte 6.

In coercion mode, **`jsonDecode` always answers `JSON_DECODE_OK`**, and `out`
is a correct instance of its class. Every field holds one of two things:

- a value read from the input, converted only by §5.2's table, that passed
  its type's range check and its constraints;
- its default (§5.4), which the compiler has checked against the same
  constraints at build time.

Nothing a body says can fail the decode or leave a field out of its type or
its constraints.

The mode is per class, and it is **transitive**. These must themselves be
of a coerce class, or the class is refused with a new diagnostic:

- a field of a class type;
- an array element;
- a map value;
- a union variant.

A part is written once per class and shared by every caller. A strict nested
class under a coerce class would make the outer decode fail after all, which
breaks the guarantee.

**Tagged unions.** A union field of a coerce class must be `U | null`, with
the initializer `null`. A union field without `| null` is refused, because
no variant is the obvious default.

- The tag chooses the variant, as in strict mode. A value is never coerced
  into a different variant from the one its tag names. The tag decides which
  variant the value matches, so the matching variant wins with nothing
  coerced.
- A missing tag, a tag that is not a string, and a tag no variant names all
  give the field its default, `null`, and are recorded as `TAG`.
- A tag that names a variant decodes the object as that variant's coerce
  class. Its own fields then convert and default by the rules below.

**The top-level union entry never fails either.** `jsonDecodeUnion(d, prev)`
(`std/json-typed.ts:1647`) is in coercion mode when the union's variants are
coerce classes. A union mixing coerce and strict variants is refused, by the
transitivity rule above. It answers as follows:

- **A tag that names a variant** decodes as today: into `prev` when it is
  that variant, or into a new object of that variant made by its
  constructor. The fields then coerce.
- **Otherwise it returns `prev`, reset in place to its own variant's
  defaults.** This covers a missing tag, a tag no variant names, a top-level
  value that is not an object, and a stop before the tag was read.
  - `reason` is `TAG`, or the stop's code, with `errorAt` at the problem.
  - Since the tag may be any key, some of `prev`'s fields may already have
    been read when the tag turns out bad. The reset runs after the object
    closes, so none of them survives.

`prev` is the right default for three reasons:

- it is already an instance of one of the variants, so the answer is a
  correct `T`;
- the reset allocates nothing;
- no variant is privileged by its place in the declaration. "The first
  variant's defaults" would make reordering a union change what a bad body
  decodes to.

It is also what `jsonDecode` does with `out`: the caller's object is the
starting point, and a body that says nothing usable resets it.

**One walk.** Each conversion and each default happens at the value or the
object it concerns:

- a conversion inside the read;
- a field's default in the existing after-the-loop block, where a missing
  `optional` field takes its initializer today (`src/emit-json.ts:1005`);
- a constraint's default straight after the check.

Nothing reads the document twice or walks the decoded object.

**The order, per value.** Each value goes through these steps, in this
order:

1. the type check, or a conversion by §5.2;
2. the type's range check;
3. the constraints of §4;
4. the default, if any earlier step failed.

A value that converts and then fails a constraint takes the default. The
field never keeps a half-converted value. Nothing is clamped, rounded or
truncated to fit:

- `200` with `maximum: 150` is the default, not 150;
- `"a long name"` with `maxLength: 4` is the default, not `"a lo"`;
- `7.5` into an `i32` is the default, not 7.

### 5.2 The conversion table

A value of the wrong type is converted only when the conversion is defined
here and is lossless. The converted value then passes through the same range
check and constraints that a value of the right type would.

**A string converts as its contents would.** A string whose raw bytes are
one JSON number is read as that bare number would be. A string whose raw
bytes are `true` or `false` is read as that literal would be. "Raw" means no
escapes, no whitespace and nothing else in the string. So `"7"` behaves as
`7` does, `"7.0"` as `7.0`, and `"1"` into a boolean field as `1`.

| Field type | Value given | Converted when | Example |
| --- | --- | --- | --- |
| `i32`, `u32`, `i64`, `u64`, a numeric enum | a number with a fraction or exponent | its exact value is an integer, decided on the token's text by `nish/json-number`, never through `f64` | `7.0`, `7e0`, `1.5e1` → 7, 7, 15 |
| the same | a string | its raw bytes are one JSON number that converts by the row above or reads as is | `"7"`, `"7.0"` → 7 |
| `f64` | a string | its raw bytes are one JSON number | `"2.5"` → 2.5 |
| `JsonNumber` | a string | its raw bytes are one JSON number; the text is kept exactly | `"1e400"` → `1e400` |
| `boolean` | a string | its raw bytes are exactly `true` or `false` | `"true"` → true |
| `boolean` | a number | its exact value is 0 or 1 | `1` → true, `0` → false |
| `boolean` | a string | its raw bytes are a JSON number whose exact value is 0 or 1 | `"1"` → true, `"0"` → false |
| `string` | a number | always: the string is the number's text exactly as written | `1e2` → `"1e2"`, `7.50` → `"7.50"` |
| `string` | a boolean | always | `true` → `"true"` |

Nothing else is converted. In particular:

- **Number grammar.** A string's number is JSON's grammar, scanned by the
  tokenizer itself. So `"+7"`, `"007"`, `".5"`, `"1."`, `" 7"`, `"0x7"`,
  `""`, `"NaN"`, `"Infinity"` and `"\u0037"` (an escape) never convert to a
  number. `"7.5"` into an `i32` has a number but no integer, so it takes the
  default.
- **Boolean spellings.** `"yes"`, `"no"`, `"on"`, `"off"`, `"y"`, `"n"`,
  `"True"`, `" true "` and `""` never convert to a boolean. Neither does `2`,
  and nothing is ever converted by truthiness.
- **No numbers from booleans.** A boolean never converts to a number.
- **`null`** never converts to anything. It means "not set": a field that is
  not `| null` takes its default, never `0`, `""`, `false` or `"null"`. A
  `| null` field keeps `null`, which is a value of its type.
- **No wrapping or unwrapping.** An object or array never converts to or from
  a scalar. In particular, `"a"` into a `string[]` field is not wrapped as
  `["a"]`, and `["a"]` into a `string` field is not unwrapped.
- **Enums.** A value that is not a member, after any conversion, takes the
  default. A field with a `const` constraint can default only to its `const`
  (§5.4), so any problem leaves it holding the `const`.

A value that has no conversion takes the field's default.

**Why these spellings and no more.** mjst's coercing parser (§5.7) also
accepts these:

- `+`, leading zeros and a bare leading `.` in a numeric string;
- `yes`, `y`, `on`, `no`, `n`, `off` and `""` for a boolean, case-folded and
  trimmed.

Those spellings suit its inputs, YAML and environment variables, where they
are ordinary. Nish decodes JSON from a peer. Each extra spelling is another
place where this decoder and some other parser of the same body can disagree
(§8), and a JSON producer writes JSON's own literals.

The recommendation is the table above:

- JSON's number grammar, so a quoted number and a bare one are read by one
  scanner;
- `true`, `false`, `1` and `0` for a boolean, the encodings a JSON producer
  actually emits for a flag.

The wider boolean set is §9, question 5.

**How a string's number is read.** The decoder runs the tokenizer's own
number scanner over the string's bytes: a second `JsonTokenizer` that the
decoder owns, `reset` over `[tokStart + 1, tokEnd − 1)`
(`std/json-tokenizer.ts:698`). It allocates nothing, and it is JSON's grammar
by construction, so a converted number and a bare one are parsed by the same
code.

**A number into a string keeps its text.** The text is kept as written, not
re-printed in a canonical form. A canonical form would go through `f64` and
lose digits (`0.10000000000000001`, `1e400`). Kept as written, the conversion
is lossless. The string's own constraints then apply to that text, as to any
string: `1e2` into a field with `pattern: "^[0-9]+$"` takes the default.

**Encode.** `jsonEncode` writes each field's own type, so a converted `"7"` is
written back as `7`.

### 5.3 When a field takes its default

In coercion mode, a field takes its default (§5.4) when any of these happens:

1. **The value has no conversion.** The value is stepped over with the same
   `skipValue` that `unknownField` uses (`std/json-typed.ts:852`). Its cost is
   bounded by the same limits.
2. **Out of range.** A number, or a converted string, is out of the field's
   range: `RANGE` in strict mode.
3. **A constraint fails** (§4).
4. **`null` arrives** for a field that is not `| null`.
5. **A key is missing.** For an `optional` field this is not a problem and is
   not recorded. That is what `optional` already means.
6. **An array element or a map value has a problem.** Elements and values
   convert one at a time, by the table. An element or value that still has a
   problem gives the whole array or map field its default, and the rest of the
   array or map is stepped over. The field, not the element, is the unit of
   default, for three reasons:
   - an element has no initializer of its own to fall back to;
   - dropping an element would shift every index after it, so `points[3]`
     would silently be a different point;
   - a dropped element could break the array's own `minItems` or
     `uniqueItems`, so the result would not be a correct instance.
7. **A union's tag is missing or unknown** (§5.1).

Two key-level rules also hold in coercion mode:

- **Unknown keys are ignored**, as under `ignoreUnknown`, whatever the
  decoder's own `ignoreUnknown` says. They are not recorded as a problem.
- **A duplicate key** keeps the first value, which has already passed its
  checks. The repeat is stepped over like an unknown key and recorded
  (`DUPLICATE`). §8 explains why this choice is recorded and not hidden.

**Reading stops, the decode does not fail.** This happens on malformed JSON
(any `JSON_TOK_ERR_*`), a `JsonLimits` limit, the depth limit, or
`maxMapKeys`.

- **What stops.** The decoder records the stop and reads no further. Every
  later read is a no-op, by the same sticky `failed` that ends a strict
  decode today. §5.5 gives the mechanism.
- **Which fields keep their values.** Each open object then runs its
  after-the-loop block, which gives every field not yet read its default. The
  field whose value was cut off takes its default too. Fields already read
  keep their values.
- **Malformed JSON keeps the prefix.** The owner asked that this case be
  picked and argued; it is not an open question. **Keeping what was read is
  no weaker than all-defaults.** Any instance a cut-off or malformed body can
  produce, a well-formed body can also produce, by omitting the keys after
  the break: in coercion mode a missing key takes its default. So the prefix
  rule gives a peer no instance it could not already get, while all-defaults
  would throw away correct values. It is also the same rule the limit stop
  needs, and it costs nothing: it is the after-the-loop block that exists
  today. The stop stays readable (§5.5), so a caller who wants all-or-nothing
  rejects on it.
- **A top-level value that is not an object** leaves nothing to read. Every
  field of `out` takes its default, which resets a reused object completely.

### 5.4 The default, and the constructor rule

**The class's defaults are the coercion policy.** There is no separate
fallback syntax. The default of a field is:

- **a scalar, string or enum field:** its initializer, the constant
  `initializerConstant` already gives a missing `optional` field;
- **a `| null` field, including a `| null` class or union field:** its
  initializer, which must be `null` for a class or union;
- **an array field:** empty. Its length is set to 0 and its buffer kept, so
  no allocation is made;
- **a `Map` field:** cleared, keeping its storage;
- **a nested-class field:** its object, reset in place to its own class's
  defaults by the same rule, one level down. A missing required nested object
  is therefore what its constructor builds.

The array, map and nested-class defaults are what the constructor sets, as
the owner put it: `[]`, `new Map()`, `new C()`. Each is applied in place, so
the value is equal to the constructor's and no allocation is made.

**A nested reset is bounded by the class graph, not the input.** A class
whose constructor builds `new C()` cannot reach itself through such fields,
or `new C()` would never return. A cycle in the class graph must pass
through a `| null` field, whose default is `null` and which stops the reset.
So the deepest reset is the longest chain of non-null class fields, a number
the compiler knows at build time.

**A field the compiler cannot default is a compile error in coercion mode.**
A new diagnostic covers each of these:

- a scalar, string or enum field with no initializer. This extends NL2498's
  rule for `optional` fields to every field of a coerce class.
- a class with a constructor that takes parameters. The defaults must be
  what `new C()` gives.
- a constructor that assigns a field anything but `[]` to an array field,
  `new Map()` to a map field, or `new C()` (no arguments, `C` a coerce class)
  to a class field. Under this rule, "what the constructor sets" and "the
  in-place reset" are the same value by construction. A constructor that set
  a scalar would give a second default the in-place reset could not
  reproduce, and running the constructor itself inside the walk would put
  arbitrary user code inside the walk.
- **a default that fails its own field's constraints.** Examples:
  `age: i32 = -1` with `minimum: 0`, `role: string = "owner"` with an `enum`
  that does not list it, or an empty-array default with `minItems: 1`. The
  compiler checks each default against the field's constraints at build time,
  with the same checks the decoder runs. This is what makes "a correct
  instance" include the constraints, not just the types. mjst's
  `getDefaultValue` makes the same choice: it uses a schema's `default` only
  when that default is an instance of the declared type
  (`helpers/src/get-default-value.ts:211`).

### 5.5 The stop's mechanism, and what stays readable

**Inside the decode, `failed` is still the stop.** Today every read is
bounded by one sticky field:

- `fail` records a code only while `failed` is `OK` (`std/json-typed.ts:659`);
- `take` returns at once once `failed` is not `OK` (`:683`), and so does
  every read built on it;
- the generated code branches on `failed` through `jsonDecoderOk`
  (`src/emit-json.ts:390`), for example in `emitJsonEnumCheck` (`:1040`).

Coercion mode keeps that machinery exactly and changes only what reaches it:

- **A stop goes through `fail`, as today.** A tokenizer error, a
  `JsonLimits` limit, the depth limit and `maxMapKeys` set `failed`. From
  then on `take`, `skipValue` (`:852`) and every generated `failed` branch
  read nothing, as after a strict failure.
- **A value-level problem does not.** A coerce class's parts call a new
  method, `repair(code, at)`, for `TYPE`, `RANGE`, `CONSTRAINT`,
  `DUPLICATE` and `TAG`, in place of `wrongType` and the readers' own
  `fail` calls. `repair` records the problem in `reason` and the log (§5.6),
  and the part steps over the value or defaults the field. `failed` stays
  `OK`, so reading goes on.
- **The answer is translated once, at the return.** The coerce part of
  `jsonDecode` ends with an epilogue that copies `failed` into a new field,
  `stopped`, records the stop as `reason` if no earlier problem was, and
  sets `failed` back to `OK`. Before the epilogue, each open object's
  after-the-loop block has run; in a coerce part it stores the defaults of
  unread fields whatever `failed` says, and it reads nothing.

**Why the strict path does not move.** `fail`, `take` and `skipValue` are
unchanged. `repair` and the epilogue are emitted only into a coerce class's
parts, which a strict class never calls (§5.1, transitivity). A strict
class's IR is byte-identical (§6); only `JsonDecoder`'s layout grows.

After the `OK`, three new fields on `JsonDecoder` say what happened. `reset`
clears them, and none costs anything on the path where nothing goes wrong:

- `reason: i32` is the first problem's code: the code the strict decode would
  have failed with. That is `JSON_DECODE_TYPE`, `RANGE`, `CONSTRAINT`,
  `MISSING`, `DUPLICATE` or `TAG` for a value-level problem, and a
  `JSON_TOK_ERR_*` code or `JSON_DECODE_MAP_LIMIT` for a stop. It is
  `JSON_DECODE_OK` when the body needed no conversion and no default.
- `errorAt` is the offset of the first problem, as in strict mode.
  `failedKeyword` is set as in §4.2 when that problem is a constraint.
- `stopped: i32` is the stop's code, or `OK` when the whole body was read. A
  caller can tell "reading stopped" from "a value was defaulted" without
  decoding `reason`.

`failed` is `JSON_DECODE_OK` when `jsonDecode` returns in coercion mode. A
program that checks `d.failed` sees success, which is the mode's contract. A
program that must reject imperfect input checks `d.reason`, or `d.stopped`
for a cut-off body only.

`reason`, `errorAt` and `stopped` are kept whatever §5.6 decides, so the
first problem and the stop can always be read.

### 5.6 The repair log: its shape, and whether it is always on

`reason` names the first problem only. The repair log records every
conversion and every default, in the order the walk made them. Its shape
follows mjst's repair report (§5.7), where each repair is reported with the
path and keyword it would have been rejected with
(`validation/src/validators/generators/repair-runtime.ts:30`). Here each
entry is four `i32`s:

- `at`: the byte offset of the value. For a missing key, it is the offset of
  the object's `}`.
- `code`: the strict code: `TYPE`, `RANGE`, `CONSTRAINT`, `MISSING`,
  `DUPLICATE` or `TAG`, or the stop's code.
- `keyword`: the `JSON_KEYWORD_*` constant for a constraint, otherwise 0.
- `action`: `JSON_REPAIR_CONVERTED = 1` or `JSON_REPAIR_DEFAULTED = 2`.

**Allocation-free.** The log is a fixed array of the first `maxRepairs`
entries, 16 unless set, plus a count of every repair, including those past
the cap. The decoder allocates the array once, when it is made, not per
decode. `reset` sets the count to 0. A repair past the cap only increments
the count, so a hostile body cannot grow the log.

The program reads it with:

- `d.repairCount`;
- `d.repairAt(i)`, `d.repairCode(i)`, `d.repairKeyword(i)` and
  `d.repairAction(i)` for `i < min(repairCount, maxRepairs)`.

**The path is computed on demand, outside the decode.** mjst's entries carry
a JSON Pointer path. Building a path string per entry inside the walk would
allocate, so the log holds the offset instead.
`jsonPointerAt(text, at): string` turns an offset back into a JSON Pointer
(`/tags/3`) by scanning the text up to that offset. That scan runs only when
the program asks, after the decode, and is bounded by the same limits. It is
not a second validation walk: it answers one question about one offset.

**Clean input writes nothing.** No class layout changes, and the header's
rule that the options take no slot (`std/json-typed.ts:169`) stands. A body
that needs no repair writes nothing to the log.

**Always on, or opt-in.** The log's cost is on the repair path: a compare
against the cap and four stores per repair, plus whatever that branch does to
the code around it. S2 builds the log behind a compiler switch and measures
decode with the log kept against decode without it:

- **Workloads:** a citm-shaped one (many small objects, mostly integers) and
  a json-api-shaped one (nested resources, strings, arrays), each declared
  `coerce: true`. Each is measured twice:
  - **clean**, where the log should cost nothing and the measurement checks
    that it does;
  - **dirty**, with a fixed 5% of values needing a conversion or a default.
- **Measures:** `Ir/doc` under callgrind, and interleaved wall clock, 7 rounds
  or more, reported as minimums. The noise band comes from timing two
  byte-identical copies of the same binary under the same interleaving.
- **Rule.** The owner's rule is that a log which is "reasonably slower" to
  keep becomes an option. This note reads "reasonably slower" concretely:
  - the gate is measured on the **clean** workloads only;
  - keeping the log may not cost **more than 1% `Ir/doc`** on either clean
    workload, nor put a clean wall-clock median outside the
    byte-identical-copy band. The 1% is the proxy for a noise band, since
    callgrind's `Ir` has none.

  If it does, the log is opt-in: `repairs: true` in the class's literal
  compiles the log's stores into that class's parts. Otherwise it is always
  on for every coerce class, and `repairs` is not an option.
- **The dirty workloads are reported, not gated.** Their extra stores are the
  log doing its job: a repair that is recorded costs the stores that record
  it. The figures are written down beside the clean ones.

This rule is part of S2's exit criteria (§11). The measured figures and the
outcome are written into this note.

### 5.7 Prior art: mjst

mjst's `validation` package, in the same author's `amritk/mjst` repository
(MIT), generates validators and a coercing `parseX` from a JSON Schema.
`parseX` has this WP's "never fails" contract: it always returns a value, and
it reports the repairs it made. Paths below are under `mjst/packages/` at
commit `f549612`. Only ideas are taken here, which needs no notice. Code
ported later would be listed in `THIRD_PARTY_NOTICES.md` per
`.claude/licensing.md`.

| mjst | Here |
| --- | --- |
| A coercion is kept only when the coerced value still passes its bounds; otherwise the default. No clamping (`validation/src/parsers/generators/generate-validation-expression.ts:258`, `:350`). | The same: §5.1's order, type then range then constraints then default, and nothing clamped. |
| `getDefaultValue` takes a schema's `default` only when it is an instance of the type (`helpers/src/get-default-value.ts:211`). | Stricter: a default that fails its field's constraints is a compile error (§5.4). |
| A numeric string is scanned by hand against `[+-]?(\d+\|\d*\.\d+)([eE][+-]?\d+)?`; `" 1 "`, `"0x10"`, `"Infinity"` and `"1."` are refused (`helpers/src/coercion-runtime.ts:25`). | JSON's grammar, scanned by the tokenizer, which also refuses `+`, leading zeros and `.5` (§5.2). |
| A boolean is a token table, never truthiness: `true yes y on 1` and `false no n off 0 ""`, trimmed and lower-cased (`generate-validation-expression.ts:293`). | Never truthiness either; only `true`, `false`, `1` and `0` are recommended (§5.2; §9, question 5). |
| A union value that already matches a branch is kept uncoerced (`helpers/src/coercion-runtime.ts:122`). | A tag picks the variant, so the matching variant always wins uncoerced. A bad tag gives the default (§5.1). |
| A repair is reported with the path, keyword and params it would have been rejected with (`repair-runtime.ts:30`). | The repair log: offset, code, keyword and action, with the path computed on demand (§5.6). |
| `validation/src/parse-vs-coerce.differential.test.ts`: wherever `coerceX` accepts a value, `parseX` returns the same value. | S2's differential test: where strict decode accepts, coercion returns the identical object and an empty log (§11). |
| Every bound is emitted as the negated pass condition, so `NaN` fails a constrained number (`validation/src/validators/AGENTS.md:32`). | The same for `f64` bounds (§4.1). |

## 6. Zero cost when unused, and the performance target

**Byte-identical IR.** A class with no `constraints` and no `coerce`
generates exactly today's IR. The new code in `emitJsonDecodeValue` and
`emitJsonDecodeBody` sits behind a test of the field's constraint list and of
the class's mode, both of which are empty for such a class.

- **The golden.** Each stage lands a golden that pins this. The IR of the
  `tests/cases/json_typed_*` classes without the options does not move, which
  `tests/self/goldens/checked/` and the nish-cmp corpus (`tests/nish-cmp.js`)
  already catch. This is how the `presence` option landed.
- **New decoder fields** move `JsonDecoder`'s layout: `failedKeyword`,
  `reason`, `stopped`, the conversion tokenizer and the repair log (§5.5,
  §5.6). The S1 and S2 PRs state any
  corpus program whose IR moves in nish-cmp's `DECLARED` entries. The
  conversion tokenizer is made only when a coerce class is decoded.

**Today's figures** (citm, 4-core Xeon, 7 interleaved rounds, ms per document,
minimum):

| | Decode | Serialize |
| --- | --- | --- |
| Nish typed `jsonDecode` / `jsonEncode` | 1.81 | 0.438 |
| Bun 1.4.4 `JSON.parse` alone | 1.84 | |
| Bun `JSON.parse` + a hand-written type check | 2.54 | |
| Bun `JSON.stringify` (byte-identical output) | | 0.695 |

**The bar.**

- **Unused options.** citm decoded with no constraints and no coercion stays
  within noise of 1.81.
- **Constraints.** A class with constraints on every field costs what those
  checks cost, in the same pass. It is compared with Bun's `JSON.parse` plus
  the equivalent hand checks, which is the program a TypeScript service
  writes today.
- **Clean input.** A coerce class decoding clean input costs no more than its
  strict twin; the repair log writes nothing on clean input (§5.6). Conversions and defaults are
  paid only on the values that need them.

**The bench.** S3 adds to `bench/json-compare/run.mjs`, whose rows today are
simdjson, yyjson, RapidJSON, serde and Go over twitter, citm and canada:

- `bun` and `node` rows: `JSON.parse` alone, `JSON.parse` plus a hand-written
  type check, and `JSON.stringify`. Each is skipped with a line when the
  runtime is not installed.
- a constrained workload: citm's classes with the constraints its published
  shape implies, against the hand-checked Bun program;
- a coercion workload: the json-api-shaped document with a fixed share of
  stringly-typed numbers and missing keys, against Bun's `JSON.parse` plus a
  hand-written coercion;
- an `Ir/doc` gate: valgrind's instruction count, which is stable where wall
  time is not. It covers the unconstrained, constrained and coerced decodes
  and is checked into the bench's expected file, so a change that slows the
  unconstrained decode fails without timing noise.

## 7. Semantics at the edges

- **Node and `--emit-ts`.** The three calls already end the program under
  Node, so nothing changes. The options literal is erased with the class's
  other statics.
- **`jsonDecodeUnion`.** In strict mode, a variant's constraints are checked
  as its fields are read, after the tag has chosen the variant. In coercion
  mode a union field must be `| null`, and a bad tag gives it `null`. A
  top-level `jsonDecodeUnion` returns `prev` reset to its variant's defaults
  (§5.1).
- **Reuse.**
  - Strict mode: a decode that fails a constraint leaves the object as a
    failed decode does today: it "leaves what it read" (the header,
    `std/json-typed.ts:312`).
  - Coercion mode: no field keeps a value from an earlier decode. Every field
    is either read or defaulted, which is stronger than today's `optional`
    alone.
- **Encode.** `jsonEncode` does not check constraints. The program's own
  values are trusted, as `JsonNumber`'s are (JSON-14). This is a decision for
  the owner (§9, question 3).
- **The rolling freeze.** `src/` never uses `constraints` or `coerce`: the
  compiler's own JSON is not decoded through `jsonDecode`. So no stage waits
  on a release.

## 8. Security

The decoder reads attacker input. The typed-layer record,
`docs/security/json.md`, covers `std/json-typed.ts`, `src/json-typed.ts` and
`src/emit-json.ts` (its index row, `docs/security/README.md:50`). The S1 and S2
PRs each update it in the same PR, with a finding row per new surface and the
test that pins it.

**Patterns.** Whoever writes the class chooses a `pattern`. A pattern that
backtracks would be a denial of service on every body. `nish/regex`:

- refuses backreferences and lookaround at compile time (`std/regex.ts:38`),
  the features that force backtracking;
- never backtracks. It uses a lazy DFA and a reverse DFA, plus a Pike VM only
  for captures, which `test` does not track (`:47`, `:82`);
- costs O(pattern × input) at worst, so `(a+)+$` is as quick as `a+$` (`:56`);
- bounds the pattern itself:
  - a repeat at most `REGEX_MAX_REPEAT` = 1,000 (`:168`);
  - at most `REGEX_MAX_INSTRUCTIONS` = 100,000 instructions once repeats are
    written out (`:166`);
  - nesting at most `REGEX_MAX_DEPTH` = 250 (`:170`).

A pattern runs on a decoded string, which the caller's `JsonLimits` bounds. A
pattern's cost per body is therefore at most 100,000 × the body's string
bytes: linear in the input for a fixed class. The pattern is fixed at build
time, so a peer cannot supply one. The S1 record states that bound and pins
it with a test: the classic catastrophic patterns run over a long input in
time linear in it.

**"Never fails" does not mean "reads without bound."** This is S2's central
security property, and the record states it as one:

- **Limits are unchanged.** Coercion relaxes no limit: `JsonLimits` (depth,
  string bytes, number bytes, window), `maxMapKeys` and the depth bound all
  hold. Coercion changes what happens *at* a limit. The decode stops reading
  and answers `OK` with defaults where strict would answer the error. It
  never continues past the limit, never resynchronises, and never scans
  ahead for the next well-formed key.
- **Malformed JSON is the same.** Reading stops at the first byte the
  tokenizer refuses.
- **Stepping over a value has the same bound.** A value with no conversion is
  stepped over by the tokenizer's `skipValue`, under the same limits as an
  `ignoreUnknown` key. A body that defaults every field costs no more to
  decode than one that is read in full.
- **Defaults are bounded.** A nested-class reset is bounded by the class's
  declared nesting, and the reset allocates nothing.
- **The tests.** S2's tests pin each limit in coercion mode: the stop's
  offset, the `reason`, the defaults after the stop, and the work done.

**`OK` no longer means "valid".** A service that turns coercion on and then
forwards the *raw body* to another component has two parsers that disagree.
That is the shape of JSON-3's duplicate-key bypass. Two choices make this
visible rather than silent:

- the first duplicate wins and is recorded as `DUPLICATE` in `reason`;
- every conversion and default can be read back (§5.5, §5.6).

The record's guidance: forward the decoded instance, re-encoded with
`jsonEncode`, never the raw body, and check `reason` where any downstream
component re-parses.

**Conversions** widen what a body may say. S2's record entry names each
accepted spelling of §5.2 and pins the refusals (`"0x7"`, `" 7"`, `"+7"`,
`"True"`, `"yes"`, `"\u0037"`). Each spelling the owner adds to the boolean
set (§9, question 5) gets its own row.

**`uniqueItems`** hashes peer-chosen strings into a `Set`, which uses the
keyed SipHash that JSON-13 put in place. The set's size is the array's, which
the caller's limits bound.

## 9. Decisions for the owner

1. **The option's shape.** One `constraints` map (recommended) or per-keyword
   keys in the literal (`minLength: { name: 1 }`). The map keeps a field's
   rules together and mirrors the schema's own nesting, which WP62 copies.
2. **`failedKeyword`.** Record which keyword failed (recommended, one `i32`),
   or only the code and the offset.
3. **Encode.** Should a `-g` build check constraints on encode too?
4. **Transitivity.** Should a coerce class reaching a strict class be refused
   (recommended, §5.1)? The alternative is to write a second, coercing part
   for the strict class, which gives two decoders for one class.

5. **Boolean spellings.** Only `true`, `false`, `1` and `0`, exactly
   (recommended, §5.2), or mjst's wider set, trimmed and case-folded:
   `yes`, `y`, `on`, `no`, `n`, `off` and `""`. The narrow set is what a JSON
   producer writes; each extra spelling is another place where two parsers
   of one body disagree (§8).
6. **Unions in coercion mode.** Allow a union field only as `U | null`,
   defaulting to `null` on a missing or unknown tag (recommended, §5.1), or
   refuse unions in coerce classes for this WP and leave them to a later
   one.

The repair log's default (§5.6) is not a question: the measurement decides it.

## 10. Docs gaps to close

- **A guide page.** A dedicated page, `docs/guide/using-nish/typed-json.md`,
  with a `scalar.config.json` route. It is lifted from the long typed-JSON
  section of `docs/guide/using-nish/standard-library.md`, which keeps a short
  pointer.
- **An error-code table in the guide.** It lists every `JSON_DECODE_*` code
  and the tokenizer codes it can surface, and what `errorAt` points at for
  each. It also covers coercion mode: which codes can appear in `reason`
  after an `OK`. Today the table lives only in the module header
  (`std/json-typed.ts:314` to `:335`).
- **The encode helpers.** A note in the reference says that
  `jsonEncodeI32Array` (`std/json-typed.ts:1730`) and its kin,
  `jsonEncodeStringOrNull`, `jsonEncodeU64` and `jsonEncodeNumber` are the
  helpers the generated encoder calls, not an API a program is meant to call.
- **The header's count.** The header says a class has "three" options
  (`std/json-typed.ts:175`), then lists four. S1 rewrites the sentence as it
  adds `constraints`, and S2 as it adds `coerce`.

## 11. Stages

Each stage is a PR, ticked on [the roadmap page](roadmap/wp61-json-typed-checks.md)
when it lands. A stage that adds a construct follows
[ARCHITECTURE.md → "How to add a construct"](ARCHITECTURE.md):

- a golden `.ll`;
- an `llvm-as` pass;
- a native round trip with expected stdout;
- at least one negative test;
- its LANGUAGE.md rule;
- a cookbook entry;
- the guide.

### S1: constraints in decode

**What lands:**

- the `constraints` option (§4): the checker's `jsonReadConstraints` and its
  diagnostics;
- the emitted checks for every keyword in §4.1;
- `JSON_DECODE_CONSTRAINT = -27`, `constraintFailed` and, if the owner takes
  it, `failedKeyword`;
- the module-scoped compiled patterns;
- LANGUAGE.md's "Typed JSON" rule (`docs/LANGUAGE.md:13382`) and the guide;
- the `docs/security/json.md` and `regex.md` updates of §8.

**Tests:**

- a golden `.ll` per keyword family;
- the zero-cost golden (§6);
- a round trip per keyword with a passing body and a failing one, printing
  `failed`, `errorAt` and `failedKeyword`;
- negative tests for each diagnostic;
- the linear-time pattern test;
- **`NaN` and bounds:** the golden shows each `f64` bound emitted as the
  negated ordered pass test (`fcmp ult` for a minimum, `fcmp ugt` for a
  maximum), so a `NaN` fails it. JSON cannot spell `NaN`, but the emitted
  form must not depend on that.

**Exit:** every keyword of §4.1 is checked in the one pass, at the value's
offset, and unconstrained IR is unmoved.

### S2: coercion

**What lands:**

- the `coerce` option and its diagnostics: transitivity, a union field
  without `| null`, the constructor rule and defaults that fail their own
  constraints (§5.1, §5.4);
- the conversions of §5.2;
- the defaults of §5.3, including the stop on malformed JSON and on limits;
- `repair`, the coerce epilogue, `reason` and `stopped` (§5.5);
- the repair log and `jsonPointerAt` (§5.6), with the measurement that
  decides whether it is always on;
- LANGUAGE.md, the guide, and the `json.md` entry of §8.

**Tests:**

- **Conversions:** each row of §5.2 with its example, and each listed refusal
  showing the field defaulted and `reason` = `TYPE` at the value's offset.
  Values that convert and then fail a constraint (`"200"` with
  `maximum: 150`, `7.5` into an `i32`) take the default, never a clamped or
  truncated value.
  The strict `{"id":"7"}` → `JSON_DECODE_TYPE` at byte 6 is kept beside the
  coerce class accepting it.
- **Fallbacks:** each case of §5.3 (no conversion, out of range, a failed
  constraint, `null` into a non-null field, a missing key, an array element
  and a map value problem, a duplicate key, a missing or unknown union tag)
  shows the default, `reason`, `errorAt` and, when the log is kept, its
  entry. `null` is
  tested on both sides: a non-null field takes its default, a `| null`
  field keeps `null` and logs nothing. The reused-object cases show that no value survives from an
  earlier decode.
- **Malformed JSON still never fails:** a truncated body, a syntax error mid
  value and trailing bytes each answer `OK`, with the prefix kept, the rest
  defaulted, and `reason` the tokenizer code at its offset.
- **Limits still bound the work:** depth, string, number and window limits
  and `maxMapKeys` each stop reading at the limit. Each answers `OK` with
  defaults, `reason` the limit's code, and work bounded as in strict mode.
- **The differential invariant:** for every body in the strict tests that
  strict decode accepts, the coerce twin returns the identical object, with
  `reason` = `OK`, `stopped` = `OK` and, when the log is kept,
  `repairCount` = 0. Coercion may only change what strict
  refuses. mjst pins the same property between its checking and repairing
  modes (§5.7).
- **A seeded fuzz:** bodies built by a fixed PRNG from valid ones, with
  truncations, wrong types, `null`s, duplicate keys, deep nesting and huge
  strings. Each must answer `OK`; `jsonEncode` of the result must decode
  strictly, so the instance is correct; and the work, counted in tokenizer
  steps, must stay under a bound linear in the body. A failure prints its
  seed.
- **The log, when it is kept:** the cap (`maxRepairs` entries kept, every
  repair counted) and `jsonPointerAt` on each entry of a nested body. If
  §5.6 makes the log opt-in, these tests use a class with `repairs: true`,
  and a class without it is shown to write no entry.
- **The stop is a stop:** for each limit, and for a syntax error, a body
  that goes on well past the stop point answers `OK` with `stopped` set.
  The tokenizer's read offset after the decode is no further than where
  the stop left it: no byte past the stop point was consumed. A field that
  only a later byte could set holds its default.
- **The top-level union:** `jsonDecodeUnion` over a missing tag, an unknown
  tag found after other keys, a non-object and a truncated body each
  returns `prev`, with every field at its variant's default and `reason`
  and `errorAt` set. A tag naming another variant returns a new object of
  that variant, its fields coerced.
- **Diagnostics:** the new ones of §5.1 and §5.4, each with a negative test.
- **Byte-identical IR:** the golden for classes that do not opt in.

**Exit:**

- every conversion of §5.2, and only those;
- every fallback of §5.3, in the one pass;
- `jsonDecode` of a coerce class never answers anything but `OK`;
- the limits hold;
- unopted IR is unmoved;
- **the log's default settled by §5.6's rule.** If keeping it costs more
  than 1% `Ir/doc` on either clean workload, or a clean wall-clock median
  falls outside the byte-identical-copy band, the log ships opt-in
  (`repairs: true`); otherwise it ships always on. The clean and dirty
  figures are both written into §5.6.

### S3: the guide page and the benchmarks

**What lands:**

- the "Typed JSON" guide page and its route;
- the error-code table, including the coercion-mode `reason` codes;
- the encode-helper note (§10);
- the Bun and Node rows, the constrained and coercion workloads, and the
  `Ir/doc` gate (§6);
- the measured figures, written into this note.

**Exit:** the figures stand against the bar of §6, and the owner's answers to
§9's questions are recorded here.

## 12. Not planned

- generating classes from a JSON Schema or OpenAPI document (that is
  WP62, `docs/wp62-json-schema-classes.md`);
- a runtime schema interpreter;
- validating a `JsonDocument` against a schema;
- a second pass of any kind;
- coercion of a union field that is not `| null`, and coercing a value into
  a variant other than the one its tag names;
- conversions beyond §5.2's table, including locale-aware numbers and dates;
- a per-decoder coercion flag: the class is the contract;
- continuing to read past a limit or a syntax error.
