# Security record: JSON — the tokenizer and the typed layer

The record of WP34 N11's second stage: `nish/json-tokenizer`
(`std/json-tokenizer.ts`), the validating tokenizer a server runs over a body
it took from a peer. It says what the tokenizer refuses and with which code,
what it caps and where the cap is set, what it allocates, and the test that
pins each property. It is written with the code rather than after an audit, so
that the audit of the JSON layer starts from evidence. The typed layer that
decodes into a class (#573) is the last section, [The typed layer](#the-typed-layer),
with its own scope, anchors and findings.

**Anchors.** Every `file:line` below is at `4411ea9`, the module's head in this
change, on top of `main` at `ce9d394`.

**Result.** Every one of JSONTestSuite's 95 `y_` files is accepted with the
token stream `JSON.parse` gives it, numbers bit for bit, and every one of its
188 `n_` files is refused. Nothing an input can hold panics, and no byte
outside the window is read: 20,000 seeded mutants of the corpus each end with
one verdict, alone, after a `reset` and inside a window padded with bytes that
would change the verdict if a read strayed. Every limit has its own code, and
each is checked before the work it bounds. A reused tokenizer keeps the arena
flat. One finding is open, one is accepted, and JSON-3 is fixed by the typed
layer, all Low.

## Scope

| File | Functions |
| --- | --- |
| `std/json-tokenizer.ts` | `JsonLimits`; `JsonTokenizer`: `reset`, `next`, `skipValue`, `stringInto`, `stringLength`, `keyEquals`, `isInteger`, `numberI64`, `numberF64`, and the scanners behind `next` (`value`, `key`, `open`, `close`, `literal`, `number`, `string`, `escapeCodePoint`, `integerScan`, `numberSlow`); the helpers `jsonTokByteAt`, `jsonTokSkipBlank`, `jsonTokHex4`, `jsonTokUtf8Length`, `jsonTokUtf8Width`, `jsonTokUtf8Byte`, `jsonTokEscapeLength`, `jsonTokPowerOfTen` |

Out of scope: `std/json.ts`'s `jsonField` and `jsonFields`, which read the
compiler's own `--json` lines and validate nothing by design, and its writer
(#571); `parseFloat` itself, which is the runtime's `strtod`. The typed layer
has its own scope, in [The typed layer](#the-typed-layer).

## Threat model

The attacker writes the body: every byte is theirs, and they choose its length
up to the caller's total limit. A win is a panic, a read outside the window,
memory or time the tokenizer spends beyond what the limits allow, a token
stream that differs from what another conforming parser reads (so that a
check made on one reading is bypassed on the other), or bytes handed to the
caller that are not valid UTF-8. The program driving the tokenizer is trusted:
it chooses the limits and the buffers, and a window outside its array is
answered with `JSON_TOK_ERR_WINDOW` rather than a panic.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| JSON-1 | Low | `std/json-tokenizer.ts:933` (`keyEquals`), `:875` (`stringInto`) | Neither is constant time: `keyEquals` stops at the first byte that differs, so its timing says how long a prefix of the name matched. A key is a field name the program wrote, not a secret, and a value read with `stringInto` is copied in full whatever it holds. | **Accepted.** A program that compares a secret it received in JSON (a token, a password) copies it out with `stringInto` and compares it with `timingSafeEqual` from `nish/crypto/ct`, as it would any secret. |
| JSON-2 | Low | `std/json-tokenizer.ts:255` (`JSON_TOK_END_CEILING`), `:505` (`reset`) | A window that ends within 64 bytes of 2^31 − 1 is refused with `JSON_TOK_ERR_WINDOW`, so that no offset the scanners add up (at most twelve past a position below the end) can overflow and panic. The guard's other arm, that `off + len` is not added before `off <= src.length - len` has proven it fits, is pinned by "WINDOW: an offset and a length of 2^31 - 1, refused without overflow" and "WINDOW: a length of 2^31 - 1 from 0": with a naive `off + len > src.length` the first panics with `attempt to add with overflow`. The ceiling arm itself is not reached by any test: a window passes the first test only inside its array, so ending past 2,147,483,583 takes an array of at least that many bytes. The language allows such a `u8[]` (`NISH_ARRAY_MAX` in `runtime/runtime.c` is 2^31 − 1 elements), but it is 2 GiB of memory on the host that runs the suite, which is the reason, not a limit of the language. | **Open.** The ceiling is one compare in `reset`; a test of it would allocate 2 GiB. |
| JSON-3 | Low | `std/json-tokenizer.ts:542` (`next`) | Duplicate keys are two keys. `{"a":1,"a":2}` tokenizes as both members, and which one a reader keeps decides what it sees: `JSON.parse` keeps the last, a reader that stops at the first match keeps the first, and two components that disagree are a check bypassed (the shape of request smuggling). | **Fixed for `jsonDecode` callers** (#573). The tokenizer itself is unchanged: it still reports what is there, and a program reading tokens itself still decides, as its module header says. `jsonDecode` refuses a duplicate of a field with `JSON_DECODE_DUPLICATE` before the second value is read, at every depth (`std/json-typed.ts`, `duplicateField`; [The typed layer](#the-typed-layer); "a duplicate key: code" and "nested: a duplicate key in an element" in `tests/link/std_json_typed`). The one exception is a key `ignoreUnknown` steps over, whose duplicates are not refused: that is JSON-4. |

## Properties verified

Each property is pinned by a line of `tests/link/std_json_tokenizer`'s
`expected.out` (named below in quotes) unless another check is named, and fails
if it stops holding.

**Conformance** (`tests/json-suite/test-parsing.txt`, JSONTestSuite's
`test_parsing/` at `1ef36fa`): "JSONTestSuite: every y_ file is accepted",
"JSONTestSuite: every n_ file is refused", and "JSONTestSuite: every i_
verdict is the one i-verdicts.txt records", which holds each of the 35
implementation-defined files to the verdict and byte offset
`tests/json-suite/i-verdicts.txt` records, so a change shows up as a diff. The
`i_` files are read strictly: the ten number files are accepted (a huge
exponent is an infinity or zero, an integer past `i64` is read only as a
double); every lone or inverted surrogate escape, invalid UTF-8 sequence,
overlong form and code point past U+10FFFF is refused; UTF-16 input and a
byte-order mark are refused as syntax; and 500 nested arrays pass the default
depth of 128 and are refused at the 129th opener. The Node check holds every
`y_` file's token stream, strings as UTF-8 and numbers as `numberF64`'s bits,
to a walk of `JSON.parse`'s value.

**Depth bombs** (`std/json-tokenizer.ts:630`, `open`): an opener past
`maxDepth` is refused with `JSON_TOK_ERR_DEPTH` at its byte, before anything is
pushed, and the depth stack is `maxDepth` bytes allocated once in the
constructor, so 100,000 openers cost the same as 129: "DEPTH: a bomb of
100,000 openers is refused at the limit", "DEPTH: 129 levels do not", "DEPTH:
128 levels fit the default". There is no recursion anywhere in the module, and
`skipValue` loops over `next`.

**Huge numbers** (`:703`, `number`; `:1037`, `numberF64`; `:1007`,
`integerScan`): a number longer than `maxNumberBytes` (256 by default) is
refused with `JSON_TOK_ERR_NUMBER_LIMIT` ("NUMBER_LIMIT: 257 do not"); within
it, an exponent stops being added up at 100,000 and the text goes to
`parseFloat`, so `1e9999999999` is an infinity without overflow ("numberF64 of
an exponent past the cap"). `numberI64` answers only when `isInteger` holds,
whose overflow test accumulates negatively and so reaches −2^63 exactly
("isInteger(9223372036854775808)", "numberI64(-9223372036854775808)").
`numberF64` is correctly rounded: Clinger's fast path for at most 15
significant digits and a decimal exponent within ±22, `strtod` otherwise
("numberF64(9007199254740993) rounds to even", "numberF64(5e-324), the
smallest subnormal", and the Node check's bitwise comparison over the corpus).

**Long strings** (`:769`, `string`): the limit counts raw bytes between the
quotes and is checked before every byte, so an over-long string is refused
where it crosses `maxStringBytes`, not where it ends ("STRING_LIMIT: the fourth
byte is refused where it stands"), and a multi-byte step that jumps past the
limit is caught after the loop ("STRING_LIMIT: a multi-byte character that
steps past the limit"). The limit is clamped to the window before it is added
to an offset, so `maxStringBytes` of 2^31 − 1 cannot overflow.

**Invalid UTF-8** (`:329`, `jsonTokUtf8Length`): RFC 3629 §4's table row by
row, the second byte's range set by the lead, which refuses overlong forms,
surrogates, code points past U+10FFFF and stray or missing continuation bytes
("UTF8: C0, an overlong lead" through "UTF8: an invalid byte in a key", and
each row's edges accepted). A sequence that is well formed as far as the
window goes is cut short, not invalid: "TRUNCATED: a four-byte form the window
cuts short". A byte of 0x80 or above outside a
string is a syntax error. So `stringInto` only ever hands the caller valid
UTF-8.

**Lone surrogates** (`:823`, `escapeCodePoint`): a `\u` escape of a high
surrogate must be followed at once by a `\u` escape of a low one, and a low
surrogate may not stand alone; anything else is `JSON_TOK_ERR_SURROGATE`
("SURROGATE: a lone high surrogate" and eight more). RFC 8259 §8.2 allows them,
and `JSON.parse` accepts them into a UTF-16 string, but they name no character
and decode to no valid UTF-8: a reader that substitutes U+FFFD and one that
refuses would see different strings, which is the disagreement this record's
threat model counts as a win. Refusing is the stricter reading, and it is what
lets `stringInto` promise UTF-8.

**Trailing garbage** (`:542`, `next`): after the top-level value only the four
RFC 8259 blanks may follow; anything else, a second document or a NUL
included, is `JSON_TOK_ERR_TRAILING` at its byte ("TRAILING: a second
document", "TRAILING: a NUL after the value").

**Nothing outside the window, nothing that panics** (`:258`,
`jsonTokByteAt`): every read goes through one function that answers −1 outside
`[off, end)`, and a window outside the array is refused in `reset`. The fuzz
pins it: "fuzz: 20,000 mutants were tokenized, none panicked", "fuzz: every run
stopped within one call per byte", and "fuzz: alone, after a reset and inside a
padded window, every mutant has one verdict", with the seed's totals pinned
("fuzz: the seed's mutants, accepted", "fuzz: the checksum of every verdict
and where it stopped"). Errors are sticky, and an error leaves the token
before it readable ("an error in the string after a string token").

**No allocation per body** (`:505`, `reset`; `:1112`, `numberSlow`): "alloc:
Arena.used() is flat across every one, parseFloat's numbers included" measures
10,000 bodies through one reused tokenizer, each call measured as
`tests/link/net_loopback/common.ts`'s `LbMeter` measures a server's wake; the
one path that allocates, the copy `parseFloat` reads, is made in a function
that answers a number, whose own arena scope releases it on return (not a
`using` block, which Node 22 cannot parse). "alloc: the meter sees a call that
keeps a string" is the control.

## Tests

The checks in `tests/run.js` that hold the above:

- `link/${name}: exits with ${wantCode} and stdout matches expected.out`, for
  `std_json_tokenizer`: every line quoted in this record.
- `link/std_json_tokenizer: the token stream of each of the ${files.size} y_ files of JSONTestSuite is JSON.parse's value, numbers bit for bit`
- `performance gate: ${source} compiles with no performance warning (--number-mode ${mode})`,
  for `std/json-tokenizer.ts` in both number modes: every index the
  scanners read is proven, with no check left in the hot loops.
- `link/std_json_tokenizer: nish/json-tokenizer loads under the Node prelude and tokenizes as it does natively`
  and `link/std_json_tokenizer: the same node.ts, built natively, prints the line the Node run is held to`:
  the module runs under `runtime/nish.mjs`, through `parseFloat` and `numberI64`.
- `third-party-licence: ${noticesDoc} lists ${rows.length} files, and each exists and carries the notice of its licence`,
  for the vendored corpus.

## The typed layer

`nish/json-typed` (#573): `jsonDecode(d, out)` and `jsonEncode(w, value)`,
whose code the compiler writes at each call from the class's fields, over the
tokenizer above and `JsonWriter`.

**Anchors.** Every `file:line` in this section is at `d6373ec1` on
`feature/json-complete/typed`, after `main` at `035aba5` was merged into it and the tokenizer at `4fdc9d7`.

**Result.** Every key of every object the code reads is matched against the
fields of its class: an unknown key, a key given twice and a field not given
are each refused with their own sticky code, at every depth, and no value is
taken as a type it is not. The recursion is the data's, so the tokenizer's
depth limit bounds it, and an encoding of an object that holds itself stops at
the writer's depth limit. Nothing an input holds panics. Four findings are
accepted, all Low.

### Scope

| File | What |
| --- | --- |
| `std/json-typed.ts` | `JsonDecoder`: `take`, `beginObject`, `nextField`, `keyIs`, `unknownField`, `duplicateField`, `missingField`, `finish`, `takeNull`, `beginArray`, `nextElement`, `integer` and the scalar readers, `string`, the array readers; the encoding helpers |
| `src/json-typed.ts` | `jsonFieldOf`, `jsonClasses`, `jsonRefusal`: which classes a call reaches and what it refuses |
| `src/emit-json.ts` | the code written per class: `emitJsonDecodeBody`, `emitJsonDecodeArrayBody`, `emitJsonStopIfFailed` |
| `src/attributes.ts`, `src/inline-arrays.ts` | `markJsonRoute`, the facts every call is given; `spoilJsonRoutes`, which keeps the arrays the code reaches out of the inline layout |

### Threat model

The tokenizer's: the attacker writes the body. A win here is a value stored
into a field of the wrong type, a field left holding something its type cannot
hold, two components reading one body differently (duplicate keys), a key the
program never declared changing what it decodes, or a panic, an unbounded
recursion or an allocation the limits do not bound. The program is trusted: it
chooses the class, the limits and `ignoreUnknown`.

### Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| JSON-4 | Low | `std/json-typed.ts:193` (`unknownField`) | With `ignoreUnknown` set, a key that names no field is stepped over without being remembered, so a duplicate of such a key is not refused. Its value is checked by the tokenizer and never read, so no reading of it can differ between two components of this program. | **Accepted.** Remembering every unknown key would cost an allocation per key; a program that forwards the raw body to another parser leaves `ignoreUnknown` off. |
| JSON-5 | Low | `src/emit-json.ts:454` (`emitJsonDecodeArrayBody`) | A nested object is decoded into the object its field already holds, and an array's elements into the objects it has, so two fields that hold one object are decoded into it twice and the second wins. | **Accepted.** It is what reuse costs, and it is in the rule (docs/LANGUAGE.md, "Typed JSON"); a program that shares an object between fields owns the sharing. |
| JSON-6 | Low | `std/json-typed.ts:344` (`string`) | A string that changes is a new arena string on every decode, so a server decoding a stream of distinct bodies into one object grows the arena by the strings it keeps, bounded by the bodies' size under `maxTotalBytes`. The bytes a string is decoded through are reclaimed at the call. | **Accepted.** Strings are immutable; a server that wants the arena flat releases per request what it decoded. |
| JSON-7 | Low | `src/emit-json.ts:275` (`emitJsonDecodeBody`), `:532` (`emitJsonStopIfFailed`) | Decoding recurses one native frame per level of nesting, bounded only by the caller's `JsonLimits.maxDepth` (128 by default): a caller that raises it into the hundreds of thousands can overflow the stack on a deep enough body. And the writer refuses past 64 levels, so a value decoded at 65 to 128 levels does not encode back (`JSON_WRITE_TOO_DEEP`). | **Accepted.** The default is safe and the limit is the program's; docs/LANGUAGE.md ("Typed JSON") and the guide say to keep it to a few thousand, and name the 64-level writer limit. |

The layer closes the tokenizer's JSON-3: a duplicate of a field is
`JSON_DECODE_DUPLICATE` at `std/json-typed.ts:208`, before the second value is
read.

### Properties verified

Each is pinned by a line of `tests/link/std_json_typed`'s `expected.out`
(quoted) unless another check is named.

**Duplicate keys** are refused for a field at the top, in an array's element
and with `ignoreUnknown` on: "a duplicate key: code", "nested: a duplicate key
in an element", "ignoreUnknown: a duplicate field is still refused". The
code written per class keeps one flag per field (`src/emit-json.ts:275`).

**Unknown fields** are refused by default at the key's byte ("an unknown key:
code", "an unknown key: errorAt", "nested: an unknown key in an element"),
and with `ignoreUnknown` stepped over whole, nested containers included, and
still checked ("ignoreUnknown: unknown keys and their values are stepped
over", "ignoreUnknown: what is stepped over is still checked"), inside an
array's element and a `| null` field's object too, with every key after a
skipped one still read ("ignoreUnknown: keys stepped over in an element and in
a | null object", "ignoreUnknown: every key after a skipped one is still
read").

**Missing fields** are refused at the object's closing brace, at every depth
("a missing key: errorAt", "an empty object: code", "nested: a missing key in
an element", "nested: a missing key in a | null object").

**Type confusion.** Each value is read by the reader of its field's type,
which refuses every other token (`std/json-typed.ts:145`, `take`): a string
for an integer, an array for a scalar or a class, an object for an array, a
number for a string, `null` for a field that is not `| null`, and a top-level
value that is not an object ("a string for an i32: code" through "null at the
top: code", "nested: an element that is not an object", "nested: an object
where the array is", "nested: null for an array that is not | null"). An
integer field takes only an integer written without a fraction or an exponent,
in its range (`std/json-typed.ts:277`): "a fraction for an i32", "an exponent
for an i32", "2^31 for an i32", "-2^31 - 1 for an i32", "-1 for a u32", "2^32
for a u32", "2^63 for an i64", "-2^63 - 1 for an i64". `null` inside an array
is a type error too ("null in an array of i32: code", "null in an array of
objects: code", "null in an array of strings: code"). Which field types may be read at all is the compiler's rule, held at
the call over every class the call reaches (`src/json-typed.ts:197`), with a
negative case per way in: `tests/cases/json_reject_field_type`,
`json_reject_nested_field`, `json_reject_nullable_field`,
`json_reject_nested_array`, `json_reject_generic_field`,
`json_reject_enum_field`, `json_reject_readonly_array`,
`json_reject_nullable_elements`, `json_reject_interface`,
`json_reject_not_class` and `json_reject_through_generic`. A `readonly` field
is refused for decoding (`json_reject_readonly`), and so is a class the
decoder makes whose constructor takes parameters
(`json_reject_constructor`, `json_reject_constructor_nullable`).

**Depth.** The decoding recurses only into a container the tokenizer has
opened, so `maxDepth` bounds it: "limits: depth", and "limits: a depth bomb"
over 1,000 nested objects. An encoding stops at the writer's first failure
(`src/emit-json.ts:532`), so an object that holds itself ends at the writer's
depth limit instead of the stack: "encode: an object that holds itself ends at
the writer's depth", "encode: and through an array".

**The other limits** reach the decoder as the tokenizer's codes: "limits: a
string's bytes", "limits: a number's bytes", "limits: the whole input",
"limits: invalid UTF-8".

**Errors are sticky and nothing panics**: "sticky: a second decode answers the
same code", "sticky: at the same byte", "sticky: reset clears it". After an
error every field still holds a value of its type, because a reader that fails
answers the value the field held or its type's zero.

**What the code may do is what its callers are told.** A decoding is given
facts that say it writes through both arguments, keeps them, allocates and
lets the allocation escape (`src/attributes.ts:2547`), so no caller's arena
scope, loop pass or `using a = arena()` block reclaims what a decode stored
(`tests/cases/json_reject_arena_block`, NL2424). An encoding hands the
writer to the writer's methods and the helpers, whose own facts the
fixpoint carries, and reads `value` only, which is what lets one run inside
such a block ("encode: inside a using arena() block, every pass writes the
same text"). No array a route reaches is laid out inline
(`src/inline-arrays.ts:752`), and a constructor the decoder calls in another
module is made callable there rather than linked `internal`
(`src/generics.ts:1642`).

**The arena** is flat over 1,000 decodes of one body into one object ("reuse:
Arena.used() is flat over 1,000 decodes into one object"), and 100 decodes of
changed strings keep the strings and nothing else ("reuse: 100 changed
strings keep only the strings").

### Tests

- `link/${name}: exits with ${wantCode} and stdout matches expected.out`, for
  `std_json_typed`: every line quoted in this section.
- `link/std_json_typed: each of the ${lines.length} lines decoded and encoded natively is JSON.stringify(JSON.parse(line))`
- `link/std_json_typed: under Node, jsonDecode panics naming the erased types (class C)`
- `link/std_json_typed: JsonDecoder's readers run under Node and print the expected lines`
  and `link/std_json_typed: readers.ts built natively prints the same lines`:
  each integer reader at both ends of its range, under Node too, where an
  `i64` is a BigInt.
- `${name}: rejected with ${needles.map((n) => `"${n}"`).join(", ")}`, for
  each `tests/cases/json_reject_*` case named above.
- `performance gate: ${source} compiles with no performance warning (--number-mode ${mode})`,
  for `std/json-typed.ts` in both number modes.
