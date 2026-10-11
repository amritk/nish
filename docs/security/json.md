# Security record: JSON — the tokenizer

The record of WP34 N11's second stage: `nish/json-tokenizer`
(`std/json-tokenizer.ts`), the validating tokenizer a server runs over a body
it took from a peer. It says what the tokenizer refuses and with which code,
what it caps and where the cap is set, what it allocates, and the test that
pins each property. It is written with the code rather than after an audit, so
that the audit of the JSON layer starts from evidence. The typed layer that
decodes into a class (#573) will extend this record.

**Anchors.** Every `file:line` below is at `814f366`, the module's head in this
change, on top of `main` at `ce9d394`.

**Result.** Every one of JSONTestSuite's 95 `y_` files is accepted with the
token stream `JSON.parse` gives it, numbers bit for bit, and every one of its
188 `n_` files is refused. Nothing an input can hold panics, and no byte
outside the window is read: 20,000 seeded mutants of the corpus each end with
one verdict, alone, after a `reset` and inside a window padded with bytes that
would change the verdict if a read strayed. Every limit has its own code, and
each is checked before the work it bounds. A reused tokenizer keeps the arena
flat. Three findings are open, all Low.

## Scope

| File | Functions |
| --- | --- |
| `std/json-tokenizer.ts` | `JsonLimits`; `JsonTokenizer`: `reset`, `next`, `skipValue`, `stringInto`, `stringLength`, `keyEquals`, `isInteger`, `numberI64`, `numberF64`, and the scanners behind `next` (`value`, `key`, `open`, `close`, `literal`, `number`, `string`, `escape`, `escapeCodePoint`, `numberSlow`); the helpers `jsonTokByteAt`, `jsonTokSkipBlank`, `jsonTokHex4`, `jsonTokUtf8Length`, `jsonTokUtf8Width`, `jsonTokUtf8Byte`, `jsonTokEscapeLength`, `jsonTokMatches`, `jsonTokPowerOfTen` |

Out of scope: `std/json.ts`'s `jsonField` and `jsonFields`, which read the
compiler's own `--json` lines and validate nothing by design, and its writer
(#571); the typed decoding and encoding (#573); `parseFloat` itself, which is
the runtime's `strtod`.

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
| JSON-1 | Low | `std/json-tokenizer.ts:943` (`keyEquals`), `:900` (`stringInto`) | Neither is constant time: `keyEquals` stops at the first byte that differs, so its timing says how long a prefix of the name matched. A key is a field name the program wrote, not a secret, and a value read with `stringInto` is copied in full whatever it holds. | **Accepted.** A program that compares a secret it received in JSON (a token, a password) copies it out with `stringInto` and compares it with `timingSafeEqual` from `nish/crypto/ct`, as it would any secret. |
| JSON-2 | Low | `std/json-tokenizer.ts:256` (`JSON_TOK_END_CEILING`), `:520` (`reset`) | A window that ends within 64 bytes of 2^31 − 1 is refused with `JSON_TOK_ERR_WINDOW`, so that no offset the scanners add up (at most twelve bytes past a checked position) can overflow and panic. No test reaches it: it takes a 2 GiB array. | **Open.** The guard is one compare in `reset`; a test needs a machine that can allocate 2 GiB in CI. |
| JSON-3 | Low | `std/json-tokenizer.ts:564` (`next`) | Duplicate keys are two keys. `{"a":1,"a":2}` tokenizes as both members, and which one a reader keeps decides what it sees: `JSON.parse` keeps the last, a reader that stops at the first match keeps the first, and two components that disagree are a check bypassed (the shape of request smuggling). | **Open, by design.** The tokenizer reports what is there; refusing duplicates is the typed layer's rule (#573, which rejects them). A program reading tokens itself decides, and is told so in the module header. |

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

**Depth bombs** (`std/json-tokenizer.ts:654`, `open`): an opener past
`maxDepth` is refused with `JSON_TOK_ERR_DEPTH` at its byte, before anything is
pushed, and the depth stack is `maxDepth` bytes allocated once in the
constructor, so 100,000 openers cost the same as 129: "DEPTH: a bomb of
100,000 openers is refused at the limit", "DEPTH: 129 levels do not", "DEPTH:
128 levels fit the default". There is no recursion anywhere in the module, and
`skipValue` loops over `next`.

**Huge numbers** (`:722`, `number`; `:1059`, `numberF64`; `:1013`,
`integerOrOverflow`): a number longer than `maxNumberBytes` (256 by default) is
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

**Long strings** (`:780`, `string`): the limit counts raw bytes between the
quotes and is checked before every byte, so an over-long string is refused
where it crosses `maxStringBytes`, not where it ends ("STRING_LIMIT: the fourth
byte is refused where it stands"), and a multi-byte step that jumps past the
limit is caught after the loop ("STRING_LIMIT: a multi-byte character that
steps past the limit"). The limit is clamped to the window before it is added
to an offset, so `maxStringBytes` of 2^31 − 1 cannot overflow.

**Invalid UTF-8** (`:329`, `jsonTokUtf8Length`): RFC 3629 §4's table row by
row, the second byte's range set by the lead, which refuses overlong forms,
surrogates, code points past U+10FFFF and stray or missing continuation bytes
("UTF8: C0, an overlong lead" through "UTF8: a four-byte form the window cuts
short", and each row's edges accepted). A byte of 0x80 or above outside a
string is a syntax error. So `stringInto` only ever hands the caller valid
UTF-8.

**Lone surrogates** (`:851`, `escapeCodePoint`): a `\u` escape of a high
surrogate must be followed at once by a `\u` escape of a low one, and a low
surrogate may not stand alone; anything else is `JSON_TOK_ERR_SURROGATE`
("SURROGATE: a lone high surrogate" and six more). RFC 8259 §8.2 allows them,
and `JSON.parse` accepts them into a UTF-16 string, but they name no character
and decode to no valid UTF-8: a reader that substitutes U+FFFD and one that
refuses would see different strings, which is the disagreement this record's
threat model counts as a win. Refusing is the stricter reading, and it is what
lets `stringInto` promise UTF-8.

**Trailing garbage** (`:564`, `next`): after the top-level value only the four
RFC 8259 blanks may follow; anything else, a second document or a NUL
included, is `JSON_TOK_ERR_TRAILING` at its byte ("TRAILING: a second
document", "TRAILING: a NUL after the value").

**Nothing outside the window, nothing that panics** (`:259`,
`jsonTokByteAt`): every read goes through one function that answers −1 outside
`[off, end)`, and a window outside the array is refused in `reset`. The fuzz
pins it: "fuzz: 20,000 mutants were tokenized, none panicked", "fuzz: every run
stopped within one call per byte", and "fuzz: alone, after a reset and inside a
padded window, every mutant has one verdict", with the seed's totals pinned
("fuzz: the seed's mutants, accepted", "fuzz: the checksum of every verdict
and where it stopped"). Errors are sticky, and an error leaves the token
before it readable ("an error in the string after a string token").

**No allocation per body** (`:520`, `reset`; `:1129`, `numberSlow`): "alloc:
Arena.used() is flat across every one, parseFloat's numbers included" measures
10,000 bodies through one reused tokenizer, each call measured as
`tests/link/net_loopback/common.ts`'s `LbMeter` measures a server's wake; the
one path that allocates, the copy `parseFloat` reads, is inside a
`using a = arena()` block. "alloc: the meter sees a call that keeps a string"
is the control.

## Tests

The checks in `tests/run.js` that hold the above:

- `link/${name}: exits with ${wantCode} and stdout matches expected.out`, for
  `std_json_tokenizer`: every line quoted in this record.
- `link/std_json_tokenizer: the token stream of each of the ${files.size} y_ files of JSONTestSuite is JSON.parse's value, numbers bit for bit`
- `performance gate: ${source} compiles with no performance warning (--number-mode ${mode})`,
  for `std/json-tokenizer.ts` in both number modes: every index the
  scanners read is proven, with no check left in the hot loops.
- `third-party-licence: ${noticesDoc} lists ${rows.length} files, and each exists and carries the notice of its licence`,
  for the vendored corpus.
