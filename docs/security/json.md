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
change, on top of `main` at `ce9d394`, except where a paragraph names another
commit: the bulk scans and `numberU64` (#597's tokenizer-scan stage) are
anchored at `2d9a369f`. The typed layer's section states its own anchors.

**Result.** Every one of JSONTestSuite's 95 `y_` files is accepted with the
token stream `JSON.parse` gives it, numbers bit for bit, and every one of its
188 `n_` files is refused. Nothing an input can hold panics, and no byte
outside the window is read: 20,000 seeded mutants of the corpus each end with
one verdict, alone, after a `reset` and inside a window padded with bytes that
would change the verdict if a read strayed. Every limit has its own code, and
each is checked before the work it bounds. A reused tokenizer keeps the arena
flat. One finding is open, one is accepted, and JSON-3 is fixed by the typed
layer, all Low; the typed layer's own findings follow in its section, where
JSON-13 (Medium) is fixed.

## Scope

| File | Functions |
| --- | --- |
| `std/json-tokenizer.ts` | `JsonLimits`; `JsonTokenizer`: `reset`, `next`, `skipValue`, `stringInto`, `stringLength`, `keyEquals`, `isInteger`, `numberI64`, `isU64`, `numberU64`, `isIntegral`, `numberF64`, and the scanners behind `next` (`value`, `key`, `open`, `close`, `literal`, `number`, `string`, `escapeCodePoint`, `integerScan`, `unsignedScan`, `numberSlow`); the helpers `jsonTokByteAt`, `jsonTokSkipBlank`, `jsonTokSkipDigits`, `jsonTokSkipPlain`, `jsonTokIsPlain`, `jsonTokHex4`, `jsonTokUtf8Length`, `jsonTokUtf8Width`, `jsonTokUtf8Byte`, `jsonTokEscapeLength`, `jsonTokPowerOfTen`, `jsonTokW64`, `jsonTokMulHigh`, `jsonTokLeadingZeros`, `jsonTokEiselLemire`, `jsonTokPowerOfFive`, `jsonTokDigitsExceed` |

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

**Huge numbers** (`:769`, `number`; `:1179`, `numberF64`; `:1079`,
`integerScan`): a number longer than `maxNumberBytes` (256 by default) is
refused with `JSON_TOK_ERR_NUMBER_LIMIT` ("NUMBER_LIMIT: 257 do not"); within
it, an exponent stops being added up at 100,000 and the text goes to
`parseFloat`, so `1e9999999999` is an infinity without overflow ("numberF64 of
an exponent past the cap"). `numberI64` answers only when `isInteger` holds,
whose overflow test accumulates negatively and so reaches −2^63 exactly
("isInteger(9223372036854775808)", "numberI64(-9223372036854775808)").
`numberF64` is correctly rounded: Clinger's fast path for a significand of
at most 2^53 and a decimal exponent within ±22, Eisel–Lemire (`:1414`,
`jsonTokEiselLemire`) for any other of at most 19 significant digits, and
`strtod` past 19 digits or the exponent cap ("numberF64(9007199254740993)
rounds to even", "numberF64(5e-324), the smallest subnormal", "numberF64 of 20
digits goes to parseFloat", "numberF64 just above half the smallest
subnormal", "numberF64(1.7976931348623159e308) rounds up to an infinity", and
the JSONTestSuite check's bitwise comparison). Eisel–Lemire's run time is
bounded per number whatever the text: two reads of the power-of-five table,
at most two 64×64-bit products built from four 32-bit limb products each, and
a fixed number of shifts, with no loop and no fallback, since for 19 digits
Mushtak and Lemire prove the extended product always decides the rounding.
Its table index is `2 × (q + 342)` for a `q` already tested to lie in
[−342, 308], so at most 1301, and `jsonTokPowerOfFive` answers 0 rather than
reading anything past it. The table is generated, not transcribed: "json: the
power-of-five table in std/json-tokenizer.ts is what
scripts/gen-json-pow5.mjs generates" fails on a changed byte. Nothing new is
unbounded: the slow path is the `parseFloat` call it always was.
`numberU64` (at `2d9a369f`: `:1110`, and `:1122`, `unsignedScan`) answers
only when `isU64` holds: digits alone, with no minus sign, `-0` included, and
at most 20 of them. RFC 8259 allows no leading zero, so up to 19 digits is
below 10^19 and always fits; one of 20 fits only when it is a `1` and then 19
digits no greater than 8446744073709551615, which are added up below 10^19
before 10^19 is added, so the sum never wraps ("isU64(18446744073709551615)",
"isU64(18446744073709551616)", "isU64(28446744073709551615)",
"isU64(100000000000000000000)", "isU64(-0)").

**Whole by value** (`isIntegral`, `jsonTokDigitsExceed`): `isIntegral` reads
the token's text and never a double, so it does not round. With F digits
after the point, z of them trailing zeros and an exponent E, a number not all
zeros is whole when E ≥ F − z. F − z is below the number's length, which
`maxNumberBytes` holds in an `i32` whatever the limits (`JsonDocument` sets
it to `i32`'s maximum). E is not added up: `jsonTokDigitsExceed` compares its
digits with that one bound, stopping as soon as the sum passes the bound and
before it would leave an `i32`, so an exponent of any length is answered
exactly, without overflow under Node or natively, and without the 100,000 cap
`numberF64` uses ("isIntegral(1e99999999999)", "isIntegral(1e-99999999999)",
"isIntegral(0e-99999999999)", "isIntegral(1.5e21474836500)", and the 39- and
40-digit exponents, "isIntegral(1.25e000000000000000000000000000000000000002)"
among them). A token that is not a number is not whole ("isIntegral is false on a
string token").

**Long strings** (at `2d9a369f`: `:818`, `string`; `:320`,
`jsonTokSkipPlain`): the limit counts raw bytes between the quotes. A run of
plain bytes is stepped over by `jsonTokSkipPlain`, which stops at the limit,
and every other byte is checked against it before it is read, so an over-long
string is refused where it crosses `maxStringBytes`, not where it ends
("STRING_LIMIT: the fourth byte is refused where it stands", "scan: a run
stops at the string limit", "scan: ...and is refused at its last byte by a
limit of 999"), and a multi-byte step that jumps past the limit is caught
after the loop ("STRING_LIMIT: a multi-byte character that steps past the
limit"). The limit is clamped to the window before it is added
to an offset, so `maxStringBytes` of 2^31 − 1 cannot overflow.

**Whole bodies** (`:527`, `reset`, at `03a2bee`): a window longer than
`maxTotalBytes` (16 MiB by default) is refused with `JSON_TOK_ERR_TOTAL_LIMIT`
before a byte of it is read, at the offset where the limit ends, so a body is
bounded before it is scanned at all ("TOTAL_LIMIT: three bytes fit a total of
3", "TOTAL_LIMIT: four are refused before anything is read", "TOTAL_LIMIT:
even a malformed window is refused for its size").

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

**Nothing outside the window, nothing that panics** (at `2d9a369f`: `:269`,
`jsonTokByteAt`; `:294`, `jsonTokSkipBlank`; `:307`, `jsonTokSkipDigits`;
`:320`, `jsonTokSkipPlain`; `:818`, `string`): a single byte is read through one function that answers −1
outside `[off, end)` or outside the array, and a window outside the array is
refused in `reset`. A run — a string's plain bytes, the blanks between
tokens, a number's digits — is read by a loop whose every pass tests the
index against the window's end and the array's length, from a floor checked
once before it, so the run stops at the byte where `jsonTokByteAt` would have
answered −1. A string's run is bounded by its limit, which is never past the
window's end, so the byte it stops at is judged exactly as before. The
readers of a token already scanned (`numberF64`, `integerScan`,
`unsignedScan`, `stringInto`'s copy of a string with no escape) are bounded
the same way, and `numberSlow` hands `String.fromBytes` the token's own
range only after checking it lies in the array. `reset` already keeps the
window inside the array, so the array bound matters only when the caller
shortens `src` after `next()` read it; "shrunk: ..." pins that case, with a
`pop` that leaves the old bytes in the array's capacity, where a read past
the length would find them: "shrunk: a blank run stops at the array's end",
"shrunk: a digit run stops at the array's end", "shrunk: a string run stops
at the array's end", "shrunk: isU64 is false once the token is past the
array", "shrunk: isInteger is false", "shrunk: numberF64 is 0, through
numberSlow" and "shrunk: stringInto copies only the bytes left". "scan: ..." in
`expected.out` ends each run on the window's edge with a byte past it that
would change the answer if it were read: a quote ("scan: a run of plain
bytes the window cuts short is truncated, not closed by the quote past it"),
blanks and a closer ("scan: blanks that run on past the window are truncated
at its end"), a digit ("scan: an integer that ends on the window's last
byte", "scan: parseFloat reads the token alone, not the digit past the
window"), and the string limit ("scan: a run stops at the string limit").
The fuzz pins it: "fuzz: 20,000 mutants were tokenized, none panicked", "fuzz: every run
stopped within one call per byte", and "fuzz: alone, after a reset and inside a
padded window, every mutant has one verdict", with the seed's totals pinned
("fuzz: the seed's mutants, accepted", "fuzz: the checksum of every verdict
and where it stopped"). Errors are sticky, and an error leaves the token
before it readable ("an error in the string after a string token").

**No allocation per body** (`:505`, `reset`; at `2d9a369f`, `:1250`,
`numberSlow`): "alloc: Arena.used() is flat across every one, parseFloat's
numbers included" measures 10,000 bodies through one reused tokenizer, each
call measured as `tests/link/net_loopback/common.ts`'s `LbMeter` measures a
server's wake; the one path that allocates, the copy `parseFloat` reads (one
`String.fromBytes` of the token), is made in a function that answers a
number, whose own arena scope releases it on return (not a `using` block,
which Node 22 cannot parse). "alloc: the meter sees a call that
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
  the module runs under `runtime/nish.mjs`, through `numberF64`'s three paths, `numberI64`, `numberU64` and `isIntegral`.
- `json: the power-of-five table in std/json-tokenizer.ts is what scripts/gen-json-pow5.mjs generates`.
- `third-party-licence: ${noticesDoc} lists ${rows.length} files, and each exists and carries the notice of its licence`,
  for the vendored corpus.

## The typed layer

`nish/json-typed` (#573): `jsonDecode(d, out)` and `jsonEncode(w, value)`,
whose code the compiler writes at each call from the class's fields, over the
tokenizer above and `JsonWriter`.

**Anchors.** Every `file:line` in this section is at `7bfa0973` on
`feature/json-parity/typed-kinds` (#622), with `main` at `b515c1b9` merged into it.
The rows and paragraphs first written at `d6373ec1` (#573) are re-anchored there.

**Result.** Every key of every object the code reads is matched against the
fields of its class: an unknown key, a key given twice and a field not given
are each refused with their own sticky code, at every depth, and no value is
taken as a type it is not. The recursion is the data's, so the tokenizer's
depth limit bounds it, and an encoding of an object that holds itself stops at
the writer's depth limit. Nothing an input holds panics. Six findings are
accepted, all Low, and JSON-13 (Medium), the map keys a body can make
collide, is fixed by a keyed string hash, with the limit on the keys of one
decoding kept.

### Scope

| File | What |
| --- | --- |
| `std/json-typed.ts` | `JsonDecoder`: `take`, `beginObject`, `nextField`, `keyIs`, `keyLength`, `keyByte`, `key`, `text`, `mapRoom`, `unknownField`, `duplicateField`, `missingField`, `finish`, `takeNull`, `beginArray`, `nextElement`, `integer` and the scalar readers, `string`, `number`, the array readers; the encoding helpers; `JsonNumber` |
| `src/json-typed.ts` | `jsonFieldOf`, `jsonClasses`, `jsonRefusal`: which classes a call reaches and what it refuses; `checkJsonOptions`: what a class's `static readonly json` may say |
| `src/emit-json.ts` | the code written per class: `emitJsonDecodeBody` and the key dispatch (`emitJsonDispatch`), `emitJsonDecodeArrayBody`, `emitJsonEnumCheck`, `emitJsonDecodeMapBody`, `emitJsonEncodeMapBody`, `emitJsonStopIfFailed` |
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
| JSON-4 | Low | `std/json-typed.ts:295` (`unknownField`) | With `ignoreUnknown` set, a key that names no field is stepped over without being remembered, so a duplicate of such a key is not refused. Its value is checked by the tokenizer and never read, so no reading of it can differ between two components of this program. | **Accepted.** Remembering every unknown key would cost an allocation per key; a program that forwards the raw body to another parser leaves `ignoreUnknown` off. |
| JSON-5 | Low | `src/emit-json.ts:1018` (`emitJsonDecodeArrayBody`) | A nested object is decoded into the object its field already holds, and an array's elements into the objects it has, so two fields that hold one object are decoded into it twice and the second wins. | **Accepted.** It is what reuse costs, and it is in the rule (docs/LANGUAGE.md, "Typed JSON"); a program that shares an object between fields owns the sharing. |
| JSON-6 | Low | `std/json-typed.ts:467` (`string`) | A string that changes is a new arena string on every decode, so a server decoding a stream of distinct bodies into one object grows the arena by the strings it keeps, bounded by the bodies' size under `maxTotalBytes`. The bytes a string is decoded through are reclaimed at the call. | **Accepted.** Strings are immutable; a server that wants the arena flat releases per request what it decoded. |
| JSON-7 | Low | `src/emit-json.ts:753` (`emitJsonDecodeBody`), `:1237` (`emitJsonStopIfFailed`) | Decoding recurses one native frame per level of nesting, bounded only by the caller's `JsonLimits.maxDepth` (128 by default): a caller that raises it into the hundreds of thousands can overflow the stack on a deep enough body. And the writer refuses past 64 levels, so a value decoded at 65 to 128 levels does not encode back (`JSON_WRITE_TOO_DEEP`). | **Accepted.** The default is safe and the limit is the program's; docs/LANGUAGE.md ("Typed JSON") and the guide say to keep it to a few thousand, and name the 64-level writer limit. |
| JSON-12 | Low | `src/emit-json.ts:1158` (`emitJsonDecodeMapBody`) | A `Map` field is emptied and filled anew on every decode, so its keys are new strings and its values new objects, arrays or maps each time: a server decoding a stream of bodies into one object grows the arena by the entries it keeps, bounded by the bodies' size under `maxTotalBytes`, as JSON-6's strings are. | **Accepted.** Reusing an entry would need its key found before the entry is kept or dropped, and would keep the old order where the input gives a new one; docs/LANGUAGE.md ("Typed JSON") says a map's entries are made anew. |
| JSON-13 | Medium | `src/emit-json.ts:1208` (`emitJsonDecodeMapBody`), `std/json-typed.ts:360` (`mapRoom`); the hash in `src/emit-map.ts:177` (`emitStringHash`), `src/emit-map.ts:305` (`seedHashKey`) and `std/collections.ts:68` (`hashKey`) | A `Map<string, V>` field takes its keys from the body, and the global `Map` hashes a string with unseeded FNV-1a and probes linearly, so a body can choose keys that all land on one probe chain and make each insert walk every key before it. Measured in review at `a336c929`, before any limit: a 278 KB body of 20,000 colliding keys decoded in 657 ms, against 2.4 ms for 20,000 ordinary keys (274x). | **Fixed.** Every `Map` and `Set` hashes a string with SipHash-1-3 under a 128-bit key the process draws from `getentropy` before `main`, so which keys share a bucket is not something a body can work out: the 4,096 keys of `tests/cases/map_hash_collide.ts`, which share one FNV-1a hash, took 8,386,560 key compares to insert under FNV-1a and take none now ("map_hash_collide: 4096 keys with one FNV-1a hash insert with under 16 key compares (8,386,560 unkeyed)", "map_hash_collide: the hash key is filled before main, and differently in two runs"), and under the key 00..0f the emitted hash and its 32-bit fold agree with a reference SipHash-1-3 checked against SipHash-2-4's published vector ("map_hash_kat: the string hash is SipHash-1-3 folded to 32 bits, as the reference computes it under key 00..0f"). Each module that hashes a string registers a constructor that fills `nish_hash_key` unless another already has, and panics before `main` when the entropy source fails rather than run unkeyed. The limit stays: `maxMapKeys` still bounds one decoding's keys, now as a bound on memory and not the only bound on time. What the key cannot reach: on wasm32 the bytes are whatever the host answers WASI's `random_get` with, and the constructor runs from `_start` or, in a reactor module, from `_initialize`, so an embedder that supplies predictable bytes, or calls an export without `_initialize`, leaves the hash keyed with what it supplied, or with zero. A reactor export that runs before `_initialize` and builds a table hashes it under the zero key, and once `_initialize` fills the key, lookups in that table miss. |
| JSON-14 | Low | `std/json-typed.ts` (`jsonEncodeNumber`), at `18f35868` | A `JsonNumber` is written with `w.raw`, its bytes as they are. What decoding and `setText` put there is one JSON number, checked by the tokenizer, but `bytes` and `count` are fields a program can assign, and bytes it assigns are written unchecked, as anything handed to `w.raw` is. A `count` past `bytes.length` is no overread: `text()` panics on the range, as `String.fromBytes` does, and `jsonEncode` stops with the writer's `JSON_WRITE_BAD_WINDOW` (-7). | **Accepted.** The program is trusted, and the input cannot reach those fields except through `number` and `setText`; docs/LANGUAGE.md ("Typed JSON") names the two ways to set one. |

The layer closes the tokenizer's JSON-3: a duplicate of a field is
`JSON_DECODE_DUPLICATE` at `std/json-typed.ts:310`, before the second value is
read, and so is a duplicate key of a `Map` field, compared once decoded, so an
escape does not hide one (`src/emit-json.ts:1158`, `emitJsonDecodeMapBody`).

### Properties verified

Each is pinned by a line of `tests/link/std_json_typed`'s `expected.out`
(quoted) unless another check is named.

**Duplicate keys** are refused for a field at the top, in an array's element
and with `ignoreUnknown` on: "a duplicate key: code", "nested: a duplicate key
in an element", "ignoreUnknown: a duplicate field is still refused". The
code written per class keeps one flag per field (`src/emit-json.ts:753`).

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
which refuses every other token (`std/json-typed.ts:169`, `take`): a string
for an integer, an array for a scalar or a class, an object for an array, a
number for a string, `null` for a field that is not `| null`, and a top-level
value that is not an object ("a string for an i32: code" through "null at the
top: code", "nested: an element that is not an object", "nested: an object
where the array is", "nested: null for an array that is not | null"). An
integer field takes only an integer written without a fraction or an exponent,
in its range (`std/json-typed.ts:379`): "a fraction for an i32", "an exponent
for an i32", "2^31 for an i32", "-2^31 - 1 for an i32", "-1 for a u32", "2^32
for a u32", "2^63 for an i64", "-2^63 - 1 for an i64". `null` inside an array
is a type error too ("null in an array of i32: code", "null in an array of
objects: code", "null in an array of strings: code"). Which field types may be read at all is the compiler's rule, held at
the call over every class the call reaches (`src/json-typed.ts:344`), with a
negative case per way in: `tests/cases/json_reject_field_type`,
`json_reject_nested_field`, `json_reject_nullable_field`,
`json_reject_nested_array`, `json_reject_generic_field`,
`json_reject_enum_nested_array`, `json_reject_map_key`,
`json_reject_map_key_enum`, `json_reject_map_value`,
`json_reject_map_value_nested`, `json_reject_map_value_class`,
`json_reject_map_array`, `json_reject_set_field`, `json_reject_readonly_array`,
`json_reject_readonly_enum_array`, `json_reject_map_value_readonly_array`,
`json_reject_nullable_elements`, `json_reject_interface`,
`json_reject_not_class` and `json_reject_through_generic`. A `readonly` field
is refused for decoding (`json_reject_readonly`), and so is a class the
decoder makes whose constructor takes parameters
(`json_reject_constructor`, `json_reject_constructor_nullable`), a class a
`Map` holds included (`json_reject_map_value_readonly`,
`json_reject_map_value_constructor`). An enum the language does not declare
never reaches the rule (`json_reject_enum_string`, `json_reject_enum_mixed`,
`json_reject_const_enum`), and neither does `Level | null`, which the checker
refuses as a field and as a map's value (NL2010, `json_reject_enum_nullable`,
`json_reject_map_value_enum_nullable`).

**The kinds after the first.** A `u64` is read through
the tokenizer's `numberU64`, so it is exact to 2^64 - 1 and every number past
it, below 0 (`-0` included) or with a fraction or an exponent is
`JSON_DECODE_RANGE` ("u64: 2^64: code" through "u64: an exponent: code"); it
is written as its digits from an array the call's own arena scope gives back
("u64: Arena.used() is flat over 1,000 encodes past 2^63"). An enum's number
is stored only when it is a member's value, so no enum field or element holds
a value its type cannot ("enum: 1 names no member: code", "enum: and the field
keeps the member it held", "enum array: the members before it are kept"). A
`Map`'s duplicate key is refused raw and through an escape ("map: a duplicate
key: code", "map: a duplicate key through an escape: code", "map: é and \u00e9
are one key"), and its non-ASCII keys of two, three and four bytes are one key
each way ("map: escaped non-ASCII keys decode"). `tests/run.js` holds
`round-trip-kinds.txt`, decoded and encoded natively, to
`JSON.stringify(JSON.parse(line))` with each integer past 2^53 kept exact
(`check("link/std_json_typed: each of the ${kindsLines.length} lines of u64, enums and maps decoded and encoded natively is JSON.stringify(JSON.parse(line)), u64 exact")`).

**A decoding's map keys are bounded** (JSON-13): a key past `maxMapKeys`,
counted over every map of the decoding, is `JSON_DECODE_MAP_LIMIT` at its own
byte ("map limit: one key past it: code", "map limit: one key past it:
errorAt", "map limit: a map of maps counts every key of every map", "map
limit: and one fewer refuses it", "map limit: 819 small maps, 4,095 keys,
decode", "map limit: 820 small maps, 4,100 keys, are refused", "map limit:
reset clears the count", "map limit: 4,096 keys by default", "map limit: and
not 4,097"); at `0` and below a map takes no key and `{}` still decodes ("map
limit: 0 refuses a map's first key", "map limit: -1 still takes {}"); and
`mapRoom` answers the same under Node (`check("link/std_json_typed: JsonDecoder's readers run under Node and print the expected lines")`).
**A map's string hash is keyed** (JSON-13): 4,096 keys sharing one FNV-1a
hash insert with no key compare, against 8,386,560 under FNV-1a, and two runs
draw two keys ("map_hash_collide: 4096 keys with one FNV-1a hash insert with
under 16 key compares (8,386,560 unkeyed)", "map_hash_collide: the hash key is
filled before main, and differently in two runs"); and the hash is SipHash-1-3
bit for bit ("map_hash_kat: the string hash is SipHash-1-3 folded to 32 bits,
as the reference computes it under key 00..0f").
An enum read that fails stores and pushes nothing, so a failed `5.5`, `2^31`
or `"x"` does not leave the member `0` behind ("enum: and the field keeps
High, not Low, after 5.5", "enum array: nothing is pushed for 5.5"), and a
map value whose read fails is not set ("map: and the map holds only the entry
read before it", "map: and nothing is set for it").

**Key dispatch.** A key is sent to a field by its decoded length, then by one
raw byte where names of that length differ, and `keyIs` compares the whole key
before a field is read, so a key that shares a field's length and bytes but
not its name is still unknown ("names: a key of a name's length and first
bytes: code", "wide: a key of a field's length and first byte"). A key with an
escape answers `-1` for its byte and is compared with every name of its length
(`keyByte` in `std/json-typed.ts`), so an escape cannot route a key past its
field or into another ("wide: every key escaped", "names: escaped field names
decode", "names: a duplicate through an escape: code").

**The options and `JsonNumber`** (at `18f35868`). A class's
`static readonly json` is read where the class is declared
(`checkJsonOptions` in `src/json-typed.ts`), and the only thing it changes in
the written code is which key a field is dispatched and written under and
whether its missing key stores the initializer: a key still reaches one field
or none, because two fields with one key are refused at compile time, a rename
to another field's own name included (NL2497,
`tests/cases/json_reject_options_wire_collides`), and a renamed field's own
name is then an unknown key ("rename: the field's own name is unknown: code").
A wire name is dispatched by its decoded bytes like a field name, so an escape
neither hides it nor routes a key past it ("rename: escaped wire names
decode", "rename: a wire name twice, once escaped: code"). An optional key
that is given is read once and by its field's reader ("optional: given twice:
code", "optional: of the wrong type: code"), every other missing key is still
`JSON_DECODE_MISSING` ("optional: a required field missing: code"), and a
missing one sets its field to its initializer, so an object decoded into again
does not keep a value an earlier body gave it ("optional: sets the missing
fields back to their initializers"). A `JsonNumber` takes only a number token
(`number` in `std/json-typed.ts`): a string, `null` and an object are
`JSON_DECODE_TYPE` ("number: a string: code", "number: null for a JsonNumber
that is not | null", "number: an object"), its length is the tokenizer's
`maxNumberBytes` ("number: past maxNumberBytes is the tokenizer's error"), and
its bytes are reused, so the arena is flat over 1,000 decodes ("number:
Arena.used() is flat over them"). It is written back raw (JSON-14). Every
misuse of the options has its own negative case, and each way the literal can
be reached is pinned: a module constant (`json_reject_options_alias`,
`json_reject_options_alias_whole`), a spread and a computed key, which Phase 0
refuses (`reject_json_options_spread`, `json_reject_options_computed`), a
subclass (`json_reject_options_subclass`) and a generic class
(`json_reject_options_generic`).

**Depth.** The decoding recurses only into a container the tokenizer has
opened, so `maxDepth` bounds it: "limits: depth", and "limits: a depth bomb"
over 1,000 nested objects. An encoding stops at the writer's first failure
(`src/emit-json.ts:1237`), so an object that holds itself ends at the writer's
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
lets the allocation escape (`src/attributes.ts:3591`), so no caller's arena
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
- `link/std_json_typed: each of the ${optionsLines.length} lines of JsonNumber fields decoded and encoded natively keeps every number's source text`
- `link/std_json_typed: each of the ${kindsLines.length} lines of u64, enums and maps decoded and encoded natively is JSON.stringify(JSON.parse(line)), u64 exact`
- `link/std_json_typed: under Node, jsonDecode panics naming the erased types (class C)`
- `link/std_json_typed: JsonDecoder's readers run under Node and print the expected lines`
  and `link/std_json_typed: readers.ts built natively prints the same lines`:
  each integer reader at both ends of its range, under Node too, where an
  `i64` is a BigInt, and `JsonNumber`'s readers, `setText` and
  `jsonEncodeNumber`.
- `${name}: rejected with ${needles.map((n) => `"${n}"`).join(", ")}`, for
  each `tests/cases/json_reject_*` case named above.
- `performance gate: ${source} compiles with no performance warning (--number-mode ${mode})`,
  for `std/json-typed.ts` in both number modes.

## The dynamic tree

`nish/json-value` (#617, for #597): `JsonDocument`, which parses any JSON text into a
tree of `JsonValue` handles over the tokenizer above, and writes one back
through `JsonWriter`'s `stringBytes` and `keyBytes`.

**Anchors.** Every `file:line` in this section is at `1000734d` on
`feature/json-parity/json-value`.

**Result.** 93 of JSONTestSuite's 95 `y_` files parse under the default and
are written back as `JSON.stringify` lays out `JSON.parse`'s value, with each
number as it was written, minified and indented. The other two
(`y_object_duplicated_key.json`, `y_object_duplicated_key_and_value.json`)
are refused by the default for their repeated key, and parse to `JSON.parse`'s
value under `JSON_VALUE_DUPLICATE_LAST`. Every other file gets the tokenizer's
own verdict at the same byte, with the depth limit held to the writer's 64. A
repeated key is refused by default, which closes JSON-3 for `JsonDocument`
callers. The parse keeps its own stack, the duplicate check costs n log n
comparisons per object whatever the keys are, a tree built through `push` and
`set` cannot hold itself, a handle from an earlier document reads as nothing,
the document's memory is at most `maxValues` × 46 bytes of arrays plus the
decoded text of what it holds, which is O(input) and bounded by
`maxTotalBytes`, and a reused document keeps
the arena flat across parse, read and write. Nothing an input holds panics.
JSON-10 is fixed; JSON-8, JSON-9 and JSON-11 are accepted, all Low.

### Scope

| File | What |
| --- | --- |
| `std/json-value.ts` | `JsonDocument`: `parse`, `parseText`, `close`, `duplicateKeys`, `repeat`, `sortPending`, `index`, `handle`, `newNode`, the readers (`kind` to `f64`, `unsigned`, `readNumber`), the builders (`new*`, `push`, `set`, `adoptable`, `append`), `write`, `stringify`; the helpers `jsonValueGet`, `jsonValuePut`, `jsonValueRoom`, `jsonValueRoomI32`, `jsonValueCompareBytes` |
| `std/json.ts` | `JsonWriter.keyBytes` and `stringBytes`, `jsonWriterPutBytes`, `jsonWriterBreakBeforeKey` |

### Threat model

The tokenizer's: the attacker writes the body. A win here is a member read
differently from another parser's reading of the same text (duplicate keys, a
number rounded where the text was exact), a handle that reads another value's
memory, a panic, a recursion or an allocation the limits do not bound, or a
write that never ends. The program is trusted: it chooses the limits, the
duplicate policy, and what it builds.

### Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| JSON-8 | Low | `std/json-value.ts:713` (`findKey`) | `get` and `set` find a key by scanning the object's members, so a program that calls `get` once per member of an object the peer sized does work quadratic in that size. The parse itself never scans: its duplicate check sorts. | **Accepted.** It is in the module header and the guide, which say to walk a large object once with `keyAt` and `at`; an index per object would cost every parse an allocation the reuse rule is there to avoid. |
| JSON-10 | Low | `std/json-value.ts:607` (`newNode`) | A document keeps, for its life, 17 bytes of arrays per value (`kinds` 1, `first`, `count`, `room` and `parent` 4 each), 28 per member of a container (three slot arrays and four pending arrays, 4 bytes each), and the decoded bytes of every string, key and number. `[0,0,…]` is 2 bytes of input per element and 17 + 28 + 1 = 46 bytes of document, 23 times its size; the arrays grow by doubling, so their capacity is up to twice what is used and the copies they outgrew stay in the arena, about four times 46 bytes per value at worst. A peer that sends the 16 MiB default `maxTotalBytes` of it could hold some 1.5 GB of a long-lived server's arena. | **Fixed.** `maxValues` caps the values one document holds, `JSON_VALUE_DEFAULT_MAX_VALUES` (262,144: about 12 MB of arrays in use, 48 MB at worst) unless the program sets it, at most `JSON_VALUE_MAX_VALUES` (4,194,304, about 193 MB in use), and one more is `JSON_VALUE_ERR_VALUES` at the byte of the value that does not fit ("values: a fourth is JSON_VALUE_ERR_VALUES at its first byte", "values: a builder past the cap"). The cap bounds the per-value arrays only: a document holds at most `maxValues` × 46 bytes of them, plus the decoded text of its strings, keys and numbers, which is O(input) and bounded by `JsonLimits.maxTotalBytes`, with the same doubling slack. The clamp to `JSON_VALUE_MAX_VALUES` is pinned without building four million values: the check sets the count in use to 2^22 − 1 by hand and holds the next value to `JSON_VALUE_ERR_VALUES` with `maxValues` at 2^31 − 1 ("values: the value at index 2^22 - 1 is made, the one at 2^22 is JSON_VALUE_ERR_VALUES whatever maxValues says"), which fails when the clamp is removed. |
| JSON-11 | Low | `std/json-value.ts:629` (`index`) | A handle carries a 9-bit generation that moves on at every `parse` and `clear`, so a handle kept across documents names nothing in the next one. The generation has 511 values and moves by one at a `clear`, one at a parse and two at a parse that fails ("stale: a clear bumps the generation by one, a parse by one, a failed parse by two"), so a handle kept across exactly a multiple of 511 of those steps names a value of the current document again. | **Accepted.** Keeping a handle across documents is a program error the module header and the guide forbid; the generation catches it in all but one case of 511, and more generation bits would cap a document at fewer values. "stale: 511 generations later it names the new root, as documented" pins where the check stops. |
| JSON-9 | Low | `std/json-value.ts:992` (`append`) | A built container that outgrows its slots moves them to the end of the slot arrays and leaves the old ones unused until `clear` or the next `parse`, so building alternately into many containers holds up to about twice the slots it uses. Parsing does not do this: each container's members are placed once, at its close. | **Accepted.** What a program builds is the program's; the waste is bounded by a constant factor and released by `clear`. |

The tree closes JSON-3 for its callers: a repeated key is
`JSON_VALUE_ERR_DUPLICATE` at `std/json-value.ts:495`, with `errorAt` at
the first key that repeats an earlier one, unless the program sets
`duplicates` to `JSON_VALUE_DUPLICATE_LAST`, which is `JSON.parse`'s reading.

### Properties verified

Each is pinned by a line of `tests/link/std_json_value`'s `expected.out`
(quoted) unless another check is named.

**One reading of a text.** Every `y_` file parsed and written back is the
tokenizer's canonical form of it ("JSONTestSuite: every y_ file parsed and
written is the tokenizer's canonical form of it"), and under Node, `JSON.parse`'s
value with each number as written, minified and indented (`tests/run.js`,
below). Every `n_` and `i_` file gets the tokenizer's code at the tokenizer's
byte ("JSONTestSuite: every n_ and i_ file gets the tokenizer's verdict, code
and offset"), and so does each limit ("errors: the depth limit is the
tokenizer's" and the two after it).

**Duplicate keys** are refused at every depth and through an escape that
decodes to the same key ("duplicates: a repeated key is refused at the
repeat" through "duplicates: an escape that decodes to the same key is a
repeat"), on the sorted path past eight members as on the pairwise one
("duplicates: a repeat of the first key at the end of forty", "duplicates: a
repeat in the middle of forty is named before a later one"). Under
`JSON_VALUE_DUPLICATE_LAST` the answer is `JSON.parse`'s on both paths
("duplicates: LAST keeps the first place and the last value", "duplicates:
LAST past eight members keeps each first place and each last value", and the
two `y_` files, "JSONTestSuite: and merged as JSON.parse merges them under
LAST"); the policy is read at each parse ("duplicates: switching back refuses
again on the next parse").

**Numbers are kept.** A number's text is what is written back
("numbers: every one written back as its text, byte for byte"), and each reader
answers only for text that fits it: `i64` and `u64` at both edges and one past
each ("numbers: i64 max" through "numbers: u64 max + 1 is neither, and keeps
its text"), with `u64` read without wrapping under Node too. `isIntegral` is
the tokenizer's, and false on any other kind and on a handle from an earlier
parse ("numbers: isIntegral is false on a string, a literal, an array and an
object", "numbers: isIntegral is false on a handle from an earlier parse").

**Handles.** A handle from before a `parse` or a `clear`, failed parses
included, reads as no value in every reader and is refused by every builder,
even when the document was refilled with one of the same shape
(`std/json-value.ts:629`, `index`, which every public method goes through;
"stale: the old root names nothing after a same-size refill" through "stale:
and after a larger refill", and "stale: a clear bumps the generation by one, a
parse by one, a failed parse by two"; under Node too, in
`link/std_json_value: every public method of JsonDocument runs under the Node
prelude and prints the expected lines`). So do a negative handle and one past
the last value ("readers: kind of -1 is NONE", "clear: every handle names
nothing", "errors: a failed parse leaves no value"). Where the generation wraps
is JSON-11.

**Depth and termination.** The parse keeps its own stack of open containers,
so the tokenizer's depth limit bounds the work and nothing recurses
(`std/json-value.ts:325`), and that limit is held to the writer's 64, so a
document the parse accepts always writes back ("depth: 64 nested arrays parse
and write back whole", "depth: 65 is the tokenizer's DEPTH at the 65th
bracket", "depth: 128, the tokenizer's own default, is refused at the same
bracket"). A value is in at most one container, and adding
one already in a container, a container to itself, or a container to anything
inside it is `JSON_VALUE_ERR_ATTACHED` (`std/json-value.ts:968`;
"builders: push of an array into itself", "builders: push of the root into its
own grandchild", "builders: set of an object on itself"), so a tree is finite.
`write` recurses one level per container and stops at the writer's first
failure, so a parsed tree deeper than the writer allows ends at
`JSON_WRITE_TOO_DEEP` only for a built tree ("depth: a built tree 65 deep
writes JSON_WRITE_TOO_DEEP"). This holds through `push` and `set`: the
"Internal" `append` skips the check, and Nish has no private members, so the
guarantee is the public methods'.

**Node.** Under `runtime/nish.mjs` a string is UTF-16, and `parseText` and the
builders take one byte per code unit, so non-ASCII text is stored differently
there than natively; `parse` over a `u8[]` reads the same bytes both ways, and
the Node check is ASCII for that reason.

**The sort is n log n.** An object of more than eight members is checked by a
bottom-up merge sort of its keys (`std/json-value.ts:524`), so no choice of
keys makes the check quadratic, as a hash table's collisions could.

**The arena.** Values read back whole after `churn()` has reused whatever a
wrongly released array would have freed ("reuse: a parsed tree reads back
whole after churn" and the four after it), and 10,000 parses, reads and
writes into one reused document and buffer leave `Arena.used()` where they
found it ("alloc: Arena.used() is flat across every one, parseFloat's numbers
and the write included"). The write allocates nothing because strings and keys
go out through `keyBytes` and `stringBytes`, which escape a window of the
document's bytes exactly as `key` and `string` escape a string of them
("JSONTestSuite: every key and string of every y_ file is written by keyBytes
and stringBytes as key and string write it"; `tests/link/std_json_writer`,
"bytes: every byte value, minified, as string and key write it" and the lines
after it). A window outside its array is `JSON_WRITE_BAD_WINDOW` before
anything is written (`std/json.ts:1098`, `:1137`; "bytes: a
negative offset" through "bytes: keyBytes refuses a negative offset").

### Tests

- `link/${name}: exits with ${wantCode} and stdout matches expected.out`, for
  `std_json_value` and `std_json_writer`: every line quoted in this section.
- `link/std_json_value: each of the ${files.size} y_ files of JSONTestSuite parsed and written natively, minified and indented by 2, is its text laid out as JSON.stringify lays it out, numbers as written`
- `link/std_json_value: every public method of JsonDocument runs under the Node prelude and prints the expected lines`
  and `link/std_json_value: the same node.ts, built natively, prints the same lines`.
- `performance gate: ${source} compiles with no performance warning (--number-mode ${mode})`,
  for `std/json-value.ts` and `std/json.ts` in both number modes.
