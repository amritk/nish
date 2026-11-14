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
4. **The coerced/defaulted record is decided by measurement** (§5.6): always
   on, unless keeping it costs more than the stated threshold.

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
  one number and bytes in the whole window (`:90`).

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
| | `f64` | `fcmp` against the bound, when the bound's literal is exactly an `f64`; otherwise refused unless the field is `JsonNumber` |
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
  (`std/regex.ts:19`) and `test` searches, so a pattern means the same in
  both.
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

The mode is per class, and it is **transitive**. A field of a class type, an
array element, or a map value of a coerce class must itself be of a coerce
class, or the class is refused with a new diagnostic. A part is written once
per class and shared by every caller. A strict nested class under a coerce
class would make the outer decode fail after all, which breaks the guarantee.

A coerce class may not hold a union field (a diagnostic). A union's default
would have to pick a variant, and its tag failures would need their own rule.
That is left to a later WP (§12).

**One walk.** Each conversion and each default happens at the value or the
object it concerns:

- a conversion inside the read;
- a field's default in the existing after-the-loop block, where a missing
  `optional` field takes its initializer today (`src/emit-json.ts:1005`);
- a constraint's default straight after the check.

Nothing reads the document twice or walks the decoded object.

### 5.2 The conversion table

A value of the wrong type is converted only when the conversion is defined
here and is lossless. The converted value then passes through the same range
check and constraints that a value of the right type would.

| Field type | Value given | Converted when | Example |
| --- | --- | --- | --- |
| `i32`, `u32`, `i64`, `u64`, a numeric enum | a string | its raw bytes, with no escapes and no whitespace, are one JSON number that the strict read would accept for the field | `"7"` → 7 |
| the same | a number with a fraction or exponent | its exact value is an integer, decided on the token's text by `nish/json-number`, never through `f64` | `7.0`, `7e0`, `1.5e1` → 7, 7, 15 |
| `f64` | a string | its raw bytes are one JSON number | `"2.5"` → 2.5 |
| `JsonNumber` | a string | its raw bytes are one JSON number; the text is kept exactly | `"1e400"` → `1e400` |
| `boolean` | a string | it is exactly `"true"` or `"false"` | `"true"` → true |
| `string` | a number | always: the string is the number's text exactly as written | `1e2` → `"1e2"`, `7.50` → `"7.50"` |
| `string` | a boolean | always | `true` → `"true"` |

Nothing else is converted. In particular:

- `"7.0"` → `i32` is not converted: the string's number must be one the strict
  read accepts.
- These strings never convert to a number: `" 7"`, `"+7"`, `"0x7"`, `""`,
  `"NaN"`, `"Infinity"`, and `"7"` (an escape).
- `"1"`, `"yes"` and `"True"` never convert to a boolean.
- A number never converts to a boolean, and a boolean never converts to a
  number.
- `null` never converts to anything.
- An object or array never converts to or from a scalar.

A value that has no conversion takes the field's default.

**How a string's number is read.** The decoder runs the tokenizer's own
number scanner over the string's bytes: a second `JsonTokenizer` that the
decoder owns, `reset` over `[tokStart + 1, tokEnd − 1)`
(`std/json-tokenizer.ts:698`). It allocates nothing, so a converted number and
a bare one are parsed by the same code.

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
6. **An array element or a map value has a problem** with no conversion: the
   whole array or map field takes its default. The rest of the array or map is
   stepped over. The field is the unit of default. Elements have no
   initializers of their own, and dropping one silently would shift every
   index after it.

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
  later read is a no-op, as after a strict failure today.
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
- **a `| null` field:** its initializer, which is usually `null`;
- **an array field:** empty. Its length is set to 0 and its buffer kept, so
  no allocation is made;
- **a `Map` field:** cleared, keeping its storage;
- **a nested-class field:** its object, reset in place to its own class's
  defaults by the same rule, one level down. This allocates nothing, and it
  is bounded by the class's declared depth, not by the input.

The array, map and nested-class defaults are what the constructor sets, as
the owner put it: `[]`, `new Map()`, `new C()`. Each is applied in place, so
the value is equal to the constructor's and no allocation is made.

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
- an initializer that fails its own field's constraints: `age: i32 = -1` with
  `minimum: 0`, or an empty-array default with `minItems: 1`. The compiler
  checks each default against the field's constraints at build time. This is
  what makes "a correct instance" include the constraints, not just the
  types.

### 5.5 What went wrong stays readable

An `OK` answer in coercion mode does not mean that the body matched the
class. Two new fields on `JsonDecoder` say what happened. `reset` clears both,
and neither costs anything on the path where nothing goes wrong:

- `reason: i32` is the first problem's code: the code the strict decode would
  have failed with. That is `JSON_DECODE_TYPE`, `RANGE`, `CONSTRAINT`,
  `MISSING` or `DUPLICATE` for a value-level problem, and a `JSON_TOK_ERR_*`
  code or `JSON_DECODE_MAP_LIMIT` for a stop. It is `JSON_DECODE_OK` when the
  body needed no conversion and no default.
- `errorAt` is the offset of the first problem, as in strict mode.
  `failedKeyword` is set as in §4.2 when that problem is a constraint.

`failed` stays `JSON_DECODE_OK` in coercion mode. A program that checks
`d.failed` sees success, which is the mode's contract. A program that must
reject imperfect input checks `d.reason`. A caller can tell "reading stopped"
from "a value was defaulted" by the code alone: a stop is a tokenizer code or
`MAP_LIMIT`.

### 5.6 Which fields were converted or defaulted: decided by measurement

`reason` names the first problem only. The per-field record says, for each
wire field of each decoded object, whether its value was:

- read as given (`JSON_FIELD_READ = 0`);
- converted (`JSON_FIELD_CONVERTED = 1`);
- defaulted (`JSON_FIELD_DEFAULTED = 2`).

It is allocation-free and works like `presence`:

- **Storage.** It is one hidden `u8` slot per wire field, on coerce classes
  only. A class without `coerce` keeps its layout byte for byte. This is the
  one exception to the header's rule that the options take no slot
  (`std/json-typed.ts:169`), and S2 rewrites that sentence.
- **Writes.** The slot is written in the after-the-loop block from the state
  the decoder already holds per field, which is one `store i8` per field.
- **Reads.** A program reads the record with `jsonFieldOutcome(v, "age")`, a
  generic function the compiler lowers to one load, as it lowers
  `jsonDecode`. The field name is a string literal checked against the
  class's wire fields (a diagnostic otherwise).

**Always on, or opt-in.** S2 builds the record behind a compiler switch and
measures decode with the record kept against decode without it:

- **Workloads:** a citm-shaped one (many small objects, mostly integers) and
  a json-api-shaped one (nested resources, strings, arrays), each declared
  `coerce: true` with clean input. Clean input is the case the record's
  stores are pure overhead.
- **Measures:** `Ir/doc` under callgrind, and interleaved wall clock, 7 rounds
  or more, reported as minimums. The noise band comes from timing two
  byte-identical copies of the same binary under the same interleaving.
- **Rule:** if keeping the record costs **more than 1% `Ir/doc` on either
  workload, or a wall-clock median outside the byte-identical-copy band**,
  the record is opt-in, as `outcome: true` in the literal, and the slots
  exist only on classes that ask for them. Otherwise it is always on for every
  coerce class, and `jsonFieldOutcome` needs no option.

This rule is part of S2's exit criteria (§11). The measured figures and the
outcome are written into this note.

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
  `reason` and the conversion tokenizer. The S1 and S2 PRs state any
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
  strict twin beyond the record's stores (§5.6). Conversions and defaults are
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
  as its fields are read, after the tag has chosen the variant. Coercion does
  not apply to unions in this WP (§5.1).
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
accepted spelling of §5.2 and pins the refusals (`"0x7"`, `" 7"`, `"True"`,
`"7"`).

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

The record's default (§5.6) is not a question: the measurement decides it.

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
- the linear-time pattern test.

**Exit:** every keyword of §4.1 is checked in the one pass, at the value's
offset, and unconstrained IR is unmoved.

### S2: coercion

**What lands:**

- the `coerce` option and its diagnostics: transitivity, unions, the
  constructor rule and defaults that fail their own constraints (§5.1,
  §5.4);
- the conversions of §5.2;
- the defaults of §5.3, including the stop on malformed JSON and on limits;
- `reason`;
- the per-field record and `jsonFieldOutcome` (§5.6), with the measurement
  that decides its default;
- LANGUAGE.md, the guide, and the `json.md` entry of §8.

**Tests:**

- **Conversions:** each row of §5.2 with its example, and each listed refusal
  showing the field defaulted and `reason` = `TYPE` at the value's offset.
  The strict `{"id":"7"}` → `JSON_DECODE_TYPE` at byte 6 is kept beside the
  coerce class accepting it.
- **Fallbacks:** each case of §5.3 (no conversion, out of range, a failed
  constraint, `null` into a non-null field, a missing key, an array element
  and a map value problem, a duplicate key) shows the default, `reason` and
  `errorAt`. The reused-object cases show that no value survives from an
  earlier decode.
- **Malformed JSON still never fails:** a truncated body, a syntax error mid
  value and trailing bytes each answer `OK`, with the prefix kept, the rest
  defaulted, and `reason` the tokenizer code at its offset.
- **Limits still bound the work:** depth, string, number and window limits
  and `maxMapKeys` each stop reading at the limit. Each answers `OK` with
  defaults, `reason` the limit's code, and work bounded as in strict mode.
- **Diagnostics:** the new ones of §5.1 and §5.4, each with a negative test.
- **Byte-identical IR:** the golden for classes that do not opt in.

**Exit:**

- every conversion of §5.2, and only those;
- every fallback of §5.3, in the one pass;
- `jsonDecode` of a coerce class never answers anything but `OK`;
- the limits hold;
- unopted IR is unmoved;
- **the record's default settled by §5.6's rule.** If keeping it costs more
  than 1% `Ir/doc` on either workload, or a wall-clock median falls outside
  the byte-identical-copy band, the record ships opt-in (`outcome: true`);
  otherwise it ships always on. The figures are written into §5.6.

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
- coercion of unions;
- conversions beyond §5.2's table, including locale-aware numbers and dates;
- a per-decoder coercion flag: the class is the contract;
- continuing to read past a limit or a syntax error.
