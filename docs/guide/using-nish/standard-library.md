# The standard library

Nish ships a standard library of modules written in Nish. You import one by
its `nish/` name:

```ts
import { Suite } from "nish/testing";
```

`nish/<module>` always means the library that came with the compiler you are
running, whatever directory your file is in. A library module is source, not a
prebuilt library: it is compiled with your program, under the same rules, and
what you import but never call is dropped from the binary. A name the library
does not have is an error that lists the modules it does.

The language itself has few string helpers — there is no `split`, `trim` or
`RegExp` — so `nish/text` is where you look first, and `nish/regex` when a
pattern is what you need. `Map` and `Set`
need no import at all ([Maps and sets](../language/maps-and-sets.md)), and the
built-in modules that wrap the operating system (`nish:fs`, `nish:process`,
`nish:io`, `nish:net`) are part of the language rather than this library; see
[Builtin modules](../../LANGUAGE.md#builtin-modules-nish).

`nish:process` is where a program starts a child without waiting for it
(`spawn`), signals it (`kill`) and reaps it (`waitPid`), and where it asks how
many cores and bytes of memory the machine has (`availableParallelism`,
`totalMemory`) to size a pool of workers; see
[Children and the machine](../../LANGUAGE.md#children-and-the-machine-spawn-kill-waitpid-availableparallelism-totalmemory).

| Module | What it gives you |
| --- | --- |
| [`nish/testing`](#nishtesting) | `Suite`, a test runner whose report is the exit code |
| [`nish/text`](#nishtext) | `splitLines`, `splitWhitespace`, `trim`, `trimStart`, `trimEnd`, `contains`, `replaceAll`, `firstDifference`, `indexOfAny` |
| [`nish/regex`](#nishregex) | `regexCompile`: JavaScript-syntax regular expressions, matched in time linear in the input |
| [`nish/json`](#nishjson) | `jsonField` and `jsonFields` to read the fields of one flat JSON object; `JsonWriter` to write JSON into a byte buffer, minified or indented, with an optional strict mode for NaN and the infinities |
| [`nish/json-tokenizer`](#nishjson-tokenizer) | `JsonTokenizer`, which checks any JSON text and reads it one token at a time, with limits |
| [`nish/json-typed`](#nishjson-typed) | `jsonDecode` and `jsonEncode`: read a JSON object into a class and write one back, with renamed and optional keys and lossless numbers |
| [`nish/json-value`](#nishjson-value) | `JsonDocument`: any JSON document as a tree to read, change and write back, with every number kept exactly as written |
| [`nish/yaml`](#nishyaml) | `parseYaml`: a YAML 1.2 stream as documents, nodes and diagnostics, each with its byte range; `pathNode` to find a key; `nish/yaml-lines` for `line:column` |
| [`nish/pair`](#nishpair) | `Pair<A, B>`, for a function that returns two values |
| [`nish/map`](#nishmap) | `getOrInsert` and `reserve` for `Map` |
| [`nish/bytes`](#nishbytes) | `getU32LE`, `setU16BE` and the rest: integers and doubles read from and written into a `u8[]` at an offset, in either byte order |
| [`nish/random`](#nishrandom) | `Rng`, a seeded generator of random numbers that answers the same under Node |
| [`nish/term`](#nishterm) | `Screen`, `Canvas` and `KeyDecoder`: a terminal UI drawn as cells or half-block pixels, sent as only what changed, and the keys it reads decoded |
| [`nish/threads`](#nishthreads) | `parallelMapInto`, `parallelMap`, `parallelFrom`, `parallelReduce`, `scope`, `Mutex`, `Channel` |
| [`nish:secret`](#nishsecret) | `Secret<T>`: key material the compiler keeps from leaking, and wipes |
| [`nish/crypto/*`](#nishcrypto) | SHA-2, HMAC, HKDF, ChaCha20-Poly1305, AES-GCM, X25519, Ed25519, P-256 ECDSA, X.509, base64url |
| [`nish/net/*`](#nishnet) | TLS 1.3, QUIC, HTTP/1.1, HTTP/2, HTTP/3, WebSocket, an HTTP router |
| [`nish/net/url`](#nishneturl) | `urlQueryGet` and `urlDecode` for one value; `UrlPathSegments`, `UrlQuery` and `percentDecode` to read a request target in place, allocating nothing |

## `nish/testing`

A `Suite` collects named checks and turns them into a report and an exit
code. A function cannot be a value in Nish, so there is no
`test("name", () => ...)`: you call one assertion per check, and each answers
whether it passed.

```ts nish:ok
import { Suite } from "nish/testing";

const sumOf = (xs: i32[]): i32 => {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};

export const main = (): i32 => {
  const t = new Suite("sums");
  t.eqI32("four numbers", sumOf([3, 9, 4, 9]), 25);
  t.eqI32("no numbers", sumOf([]), 0);
  return t.done();
};
```

```console
$ nish run sums.ts
PASS  four numbers
PASS  no numbers
sums: 2 passed, 0 failed, 0 skipped
```

`done()` prints the summary and answers 0 when nothing failed and 1 otherwise,
so returning it from `main` makes the program's exit status the verdict. There
is one assertion per type — `eqI32`, `eqI64`, `eqBool`, `eqStr` and the rest —
plus `ok(name, condition)`, `contains`, `containsAll`, `eqLines` for two
arrays of lines, and `skip(name, reason)`. Because an assertion returns a
`boolean`, a test can stop before a read that would panic:
`if (!t.eqI32("length", xs.length, 3)) { return t.done(); }`.

## `nish/text`

The string operations a program would otherwise write by hand.

```ts nish:ok
import { contains, replaceAll, splitLines, splitWhitespace, trim } from "nish/text";

export const main = (): i32 => {
  for (const line of splitLines("first line\n  second  line \n")) {
    console.log(`[${trim(line)}] has ${splitWhitespace(line).length} words`);
  }
  console.log(replaceAll("a-b-c", "-", "+"));
  console.log(`${contains("haystack", "st")}`);
  return 0;
};
```

```console
$ nish run text.ts
[first line] has 2 words
[second  line] has 2 words
a+b+c
true
```

`indexOfAny(text, bytes, from)` finds the first byte at or after `from` that
is one of up to 16 ASCII characters, and is compiled to a vectorised search;
it is not constant-time, so it is never for secret data
([Byte search](../../LANGUAGE.md#byte-search-indexofany-in-nishtext)).
`firstDifference(left, right)` answers the index of the first line where two
arrays of lines differ.

## `nish/regex`

Regular expressions in JavaScript's syntax. `regexCompile(pattern, flags)`
answers a `Result`: the `Regex`, or the reason the pattern is refused.

```ts nish:ok
import { Regex, RegexMatch, regexCompile } from "nish/regex";

export const main = (): i32 => {
  const compiled = regexCompile("(?<year>\\d{4})-(?<month>\\d\\d)", "");
  if (compiled.isErr()) {
    console.log(compiled.error);
    return 1;
  }
  const date: Regex = compiled.value;
  const m = new RegexMatch();
  if (date.exec("due 2026-10, paid 2026-11", 0, m)) {
    console.log(`${m.text()} at ${m.start()}, month ${m.named("month")}`);
  }
  console.log(date.findAll("due 2026-10, paid 2026-11").join(" "));
  console.log(date.replaceAll("2026-10", "$<month>/$<year>"));
  const bad = regexCompile("(a", "");
  if (bad.isErr()) {
    console.log(bad.error);
  }
  return 0;
};
```

```console
$ nish run regex.ts
2026-10 at 4, month 10
2026-10 2026-11
10/2026
regex: missing ) at byte 0
```

A `Regex` has `test`, `exec` (into a `RegexMatch` you reuse), `find`,
`findAll`, `count`, `replace`, `replaceAll` and `split`. A replacement
template reads `$&`, `$1` to `$99`, `$<name>`, `` $` ``, `$'` and `$$`, as
in JavaScript. `regexEscape(text)` makes a pattern that matches `text`
exactly. The flags are `i` (ASCII letters), `m` and `s`; there is no `g`,
since `findAll` and `replaceAll` are the global forms.

Matching never backtracks, so a pattern cannot make it slow: `(a+)+$` against
a long run of `a`s takes as long as `a+$`. The price is that backreferences
(`\1`) and lookaround (`(?=…)`, `(?<=…)`) are refused when the pattern is
compiled. Offsets are UTF-8 bytes, as `s.length` is, and `\w`, `\d` and
`\b` are ASCII, as they are in JavaScript. The `i` flag folds only ASCII
letters, where JavaScript's folds every letter: `é` does not match `É`.

A search runs a lazy DFA, a table of states built as the text needs them,
and falls back to a slower engine only to fill in groups or when a pattern
would need more states than the table holds (about 1 MiB). A `Regex` keeps
that table and its other scratch memory between calls, so repeated searches
allocate little beyond their answers — which also means one `Regex` is used
by one thread at a time.

## `nish/json`

`jsonField(object, name)` answers the value of one field of a flat JSON
object, or `null` when the field is not there. It is a reader, not a parser:
it does not validate, and a nested value is stepped over rather than searched.
It reads exactly the shape `nish --json` prints, which is what it was written
for ([The CLI](cli.md#--json-for-tools)).

```ts nish:ok
import { jsonField } from "nish/json";

export const main = (): i32 => {
  const line = `{"file":"p.ts","line":3,"code":"NL1047","message":"Loose equality is forbidden"}`;
  const code = jsonField(line, "code");
  if (code !== null) {
    console.log(`code ${code}`);
  }
  console.log(`${jsonField(line, "fix") === null}`);
  return 0;
};
```

```console
$ nish run json.ts
code NL1047
true
```

A string value comes back unquoted; any other value comes back as written, so
`parseInt` reads a number. `jsonFields(object, names)` reads several fields in
one pass.

`JsonWriter` goes the other way: it writes any JSON value into a `u8[]` you
own, placing every comma and colon itself, byte for byte what
`JSON.stringify` writes. You say only what the value is:

```ts nish:ok
import { JsonWriter } from "nish/json";

export const main = (): i32 => {
  const out = new Array<u8>(256);
  const w = new JsonWriter(out, 0);
  w.beginObject();
  w.key("message");
  w.string("Hello, \"World\"");
  w.key("count");
  w.i32(3);
  w.endObject();
  if (w.complete()) {
    console.log(w.text()); // {"message":"Hello, \"World\"","count":3}
  }
  return 0;
};
```

The JSON is `out[0 .. w.end)`, and `text()` copies it into a string. A full
buffer or a call out of order — a value where a key belongs, say — does not
panic: it sets a negative `JSON_WRITE_*` code in `w.failed`, and every later
call does nothing, so you write the whole value and check once at the end.
`jsonStringifyString(s)` answers one string as a JSON string literal.

When your text is already bytes — a window of a request body, or what a
[`JsonDocument`](#nishjson-value) holds — `w.stringBytes(bytes, off, len)` and
`w.keyBytes(bytes, off, len)` write `bytes[off .. off + len)` exactly as
`string` and `key` write a string of those bytes, without making the string.
A window that is not inside `bytes` is `JSON_WRITE_BAD_WINDOW`, and nothing
is written.

The writer has two modes, both off until you ask for them. Each is a
setting of the writer rather than of one text: `reset` keeps it, so you set
it once, and it stays until you set it again.

- `w.setIndent(n)` writes what `JSON.stringify(v, null, n)` writes: one
  member or element a line, a space after each colon, and an empty `{}` or
  `[]` left on one line. `n` is clamped to 10, and 0 or a negative `n` is the
  minified text, the default. `w.setIndentTab()` indents with a tab. A `raw`
  fragment goes in as it is and is not re-indented.
- `w.setStrict(true)` makes NaN and the infinities an error,
  `JSON_WRITE_NON_FINITE` (-8), with nothing written, where the default writes
  `null` as `JSON.stringify` does. A misuse before it, such as a value where a
  key is due, keeps its own code.

```ts nish:ok
import { JSON_WRITE_NON_FINITE, JsonWriter } from "nish/json";

export const main = (): i32 => {
  const out = new Array<u8>(256);
  const w = new JsonWriter(out, 0);
  w.setIndent(2);
  w.beginObject();
  w.key("tags");
  w.beginArray();
  w.string("a");
  w.endArray();
  w.key("none");
  w.beginObject();
  w.endObject();
  w.endObject();
  console.log(w.text());
  w.setIndent(0);
  w.setStrict(true);
  w.reset(out, 0);
  w.f64(toF64(0) / toF64(0));
  console.log(`${w.failed === JSON_WRITE_NON_FINITE}`);
  return 0;
};
```

```console
$ nish run pretty.ts
{
  "tags": [
    "a"
  ],
  "none": {}
}
true
```

`jsonEncode` from `nish/json-typed` writes through the writer you give it, so
an indented or strict writer encodes a class indented or strictly too.

## `nish/json-tokenizer`

`jsonField` trusts its input. When the JSON comes from someone else — a
request body, a file a user hands you — read it with `JsonTokenizer`, which
checks every byte against the JSON grammar and gives you the document one
token at a time: an object or array opening or closing, a key, a string, a
number, `true`, `false` or `null`. It reads a window of a `u8[]` and
allocates nothing per token, so one tokenizer, `reset` for each new body,
serves a whole connection.

```ts nish:ok
import { JSON_TOK_END, JSON_TOK_KEY, JSON_TOK_NUMBER, JsonLimits, JsonTokenizer } from "nish/json-tokenizer";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const body = bytesOf(`{"item":"tea","qty":3,"price":2.5}`);
  const t = new JsonTokenizer(body, 0, toI32(body.length), new JsonLimits());
  let total: f64 = 1;
  let k: i32 = t.next();
  while (k > 0) {
    if (k === JSON_TOK_KEY && (t.keyEquals("qty") || t.keyEquals("price"))) {
      if (t.next() === JSON_TOK_NUMBER) {
        total = total * t.numberF64();
      }
    }
    k = t.next();
  }
  if (k !== JSON_TOK_END) {
    console.log(`refused: code ${t.failed} at byte ${t.errorAt}`);
    return 1;
  }
  console.log(`${total}`); // 7.5
  return 0;
};
```

`next()` answers each token's kind, then `JSON_TOK_END` once the whole
document has been read and nothing but whitespace follows it. A malformed
document answers a negative `JSON_TOK_ERR_*` code instead; the code stays in
`failed`, with the byte it was found at in `errorAt`, and every later call
answers it again. Nothing in the input can make it panic or read outside the
window you gave it.

- **Strings.** `stringInto(out, at)` copies the current key or string into
  your array with its escapes decoded, and `keyEquals(name)` compares it
  without copying. Strings must be valid UTF-8, and a `\u` escape of half a
  surrogate pair on its own is refused, so what you copy out is always valid
  UTF-8.
- **Numbers.** `numberF64()` reads the current number as `JSON.parse` would,
  correctly rounded. `isInteger()` and `numberI64()` read one that fits in an
  `i64`, and `isU64()` and `numberU64()` read one written in digits alone, with
  no minus sign, that fits in a `u64`, up to `18446744073709551615`.
  Those go by how the number is written, so `1.0` and `1e2` are not
  integers to them. `isIntegral()` asks whether the value is whole however it
  is written: `1.0`, `1e2`, `100e-2` and `1e400` are, `1.5` and `10e-2` are
  not. That is JSON Schema's "integer". It reads the text, not a double, so it
  holds at any size and any exponent.
- **Skipping.** `skipValue()` steps over whatever value comes next, however
  deeply it nests: use it for a field you do not want.
- **Limits.** `JsonLimits` caps nesting depth (128), the bytes in one string
  (1 MiB), in one number (256) and in the whole input (16 MiB). Each limit
  has its own error code, and you can lower or raise each field before you
  make the tokenizer.
- **Duplicate keys.** `{"a":1,"a":2}` is two keys. The tokenizer reports
  both, and what to do with the second is your decision.

Its security record is [docs/security/json.md](../../security/json.md).

## `nish/json-typed`

`jsonDecode(d, out)` reads one JSON object into an object of a class you
declare, and `jsonEncode(w, value)` writes one back. There is nothing to
register and no schema to write: the compiler writes the code from the class's
fields at each call. A field can be an `i32`, `u32`, `i64`, `u64`, `f64`,
`boolean`, `string`, a numeric `enum`, another class, an array of any of those,
a `Map` with `string` keys whose values are any of those, or a `string`, a
class, an array or a map with `| null`; and a `JsonNumber`, which keeps a
number's text exactly.

```ts nish:ok
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Player {
  name: string = "";
  score: i32 = 0;
}

class Team {
  players: Player[];
  captain: Player | null = null;

  constructor() {
    this.players = [];
  }
}

const bytesOf = (text: string): u8[] => {
  const out = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(text.length); i += 1) {
    out[i] = toU8(text.charCodeAt(i));
  }
  return out;
};

export const main = (): i32 => {
  const body = bytesOf(`{"players":[{"name":"Ann","score":3}],"captain":null}`);
  const d = new JsonDecoder(body, 0, toI32(body.length), new JsonLimits());
  const team = new Team();
  const code = jsonDecode(d, team);
  if (code !== 0) {
    console.log(`error ${code} at byte ${d.errorAt}`);
    return 1;
  }
  const w = new JsonWriter(new Array<u8>(256), 0);
  jsonEncode(w, team);
  console.log(w.text()); // {"players":[{"name":"Ann","score":3}],"captain":null}
  return 0;
};
```

Decoding is strict. Every field must be there, each key may appear once, a
number must fit its field (`1.5` is not an `i32`), and `null` goes only into a
field declared `| null`. A key the class has no field for is an error too,
unless you set `d.ignoreUnknown = true` before decoding. Nothing panics: the
first problem sets a negative code in `d.failed` and the byte it was found at
in `d.errorAt`, and `jsonDecode` returns it. The tokenizer's limits in
`JsonLimits` — nesting depth, string, number and body size — apply as they
would to any JSON you read. The depth limit is also how deep the decoder
recurses, so keep it to a few thousand at most; and the writer stops at 64
levels, so an object decoded from deeper than that cannot be encoded back.

Decoding into the same object again reuses what it already holds: nested
objects, arrays and any string that has not changed. A server can keep one
decoder and one object per connection, call `d.reset(body, 0, length)` per
request, and allocate nothing for a request that looks like the last. A class
the decoder has to create — an array element past the end of the array, or a
`| null` field that was `null` — is made with `new C()`, so its constructor
takes no parameters. Encoding writes the fields in the order the class declares
them, exactly as `JSON.stringify` would.

A `u64` keeps every digit up to 2^64 - 1, which a JavaScript number cannot,
and a negative number is a range error for it. An enum is read and written as
its number: a number that is not one of its members' values is a type error,
and the field keeps the member it held. An enum whose members are strings is
not something the language has, so it cannot be a field either; use a
`string` field and check its value yourself. A `Map<string, V>` is a JSON object
whose keys you do not know in advance: decoding empties the map and fills it
in the order the keys arrive, a key given twice is an error, and encoding
writes the entries in the map's order.

```ts nish:ok
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

enum Level {
  Low = 0,
  High = 9,
}

class Inventory {
  serial: u64 = 0;
  level: Level;
  stock: Map<string, i32>;

  constructor() {
    this.level = Level.Low;
    this.stock = new Map<string, i32>();
  }
}

const bytesOf = (text: string): u8[] => {
  const out = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(text.length); i += 1) {
    out[i] = toU8(text.charCodeAt(i));
  }
  return out;
};

export const main = (): i32 => {
  const body = bytesOf(`{"serial":18446744073709551615,"level":9,"stock":{"apples":3,"pears":0}}`);
  const inv = new Inventory();
  const code = jsonDecode(new JsonDecoder(body, 0, toI32(body.length), new JsonLimits()), inv);
  const w = new JsonWriter(new Array<u8>(256), 0);
  jsonEncode(w, inv);
  console.log(w.text()); // the same text back
  console.log(`${inv.stock.get("apples") ?? 0}`); // 3
  return code;
};
```

In a class of three or more fields, a key is matched to a field by its length
first and then, where three or more field names share that length, by its
byte at one position, before the whole key is compared, so a key is usually
compared with one name rather than with each in turn. All the maps of one
decode take at most `d.maxMapKeys` keys between them, 4,096 unless you set it;
a body with more is refused with `JSON_DECODE_MAP_LIMIT` rather than left to
slow the maps down, and `d.reset` starts the count again. Set it to `0` (or
below) and no map may take a key at all: `{}` is then the only map value
accepted.

When the JSON's keys are not the names you want for your fields, or some keys
may be left out, say so in one `static readonly json` object literal in the
class. `rename` gives a field the key it has on the wire, and `optional` lists
the fields whose key may be missing: a missing one sets the field back to its
initializer, so an optional field needs one. Every other key is still
required. The literal is read by the compiler and is not a field. A name that
is not one of the class's fields, two fields with the same key, or anything
that is not written out as a literal, is a compile error.

A `JsonNumber` field keeps a number exactly as it was written, so a number
wider than a `u64` or with more digits than an `f64` comes back byte for byte.
Read it with `text()`, `isI64()` and `i64()`, `isU64()` and `u64()`, or
`f64()`, and set it with `setText`.

```ts nish:ok
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, JsonNumber, jsonDecode, jsonEncode } from "nish/json-typed";

class Payment {
  static readonly json = { rename: { userId: "user_id" }, optional: ["note"] };
  amount: JsonNumber;
  note: string = "";
  userId: i32 = 0;

  constructor() {
    this.amount = new JsonNumber();
  }
}

const bytesOf = (text: string): u8[] => {
  const out = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(text.length); i += 1) {
    out[i] = toU8(text.charCodeAt(i));
  }
  return out;
};

export const main = (): i32 => {
  const body = bytesOf(`{"user_id":7,"amount":12345678901234567890.123456789}`);
  const p = new Payment();
  const code = jsonDecode(new JsonDecoder(body, 0, toI32(body.length), new JsonLimits()), p);
  const w = new JsonWriter(new Array<u8>(256), 0);
  jsonEncode(w, p);
  console.log(w.text()); // {"amount":12345678901234567890.123456789,"note":"","user_id":7}
  console.log(`${p.userId} ${p.amount.isU64()}`); // 7 false
  return code;
};
```

Both calls need the compiler: under Node, where the types are erased, they end
the program with an error. The rules in full are in
[Typed JSON](../../LANGUAGE.md#typed-json-nishjson-typed).

## `nish/json-value`

`nish/json-typed` needs a class that says what the JSON looks like. When you
do not know — a configuration file, a body you pass on after changing one
field, a tool that prints whatever it is given — parse the document into a
`JsonDocument` and walk it.

```ts nish:ok
import { JsonLimits } from "nish/json-tokenizer";
import { JSON_VALUE_NUMBER, JsonDocument } from "nish/json-value";

export const main = (): i32 => {
  const doc = new JsonDocument(new JsonLimits());
  const root = doc.parseText(`{"id":12345678901234567890,"price":0.1000000000000000055511151231257827,"tags":["tea"]}`);
  if (root < 0) {
    console.log(`refused: code ${doc.failed} at byte ${doc.errorAt}`);
    return 1;
  }
  const id = doc.get(root, "id");
  console.log(`${doc.kind(id) === JSON_VALUE_NUMBER} ${doc.isI64(id)} ${doc.isU64(id)}`); // true false true
  console.log(`${doc.u64(id)}`); // 12345678901234567890
  console.log(`${doc.f64(doc.get(root, "price"))}`); // 0.1
  console.log(doc.string(doc.at(doc.get(root, "tags"), 0))); // tea

  doc.set(root, "tags", doc.newString("changed"));
  console.log(doc.stringify(root));
  // {"id":12345678901234567890,"price":0.1000000000000000055511151231257827,"tags":"changed"}
  return 0;
};
```

A value is a `JsonValue`, a handle into the document that made it, and every
reader is a method of the document: `kind`, then `boolean`, `string`,
`numberText`, `length`, `at` (an element, or an object's member by position),
`keyAt` and `get` (a member by key). A handle that names nothing answers an
empty value rather than panicking: `get` of a missing key is `-1`, and `kind(-1)`
is `JSON_VALUE_NONE`.

**Numbers are kept as they were written.** This is where it differs from
JavaScript. `JSON.parse` turns every number into a double, so the program
above would see `12345678901234567000` and `0.1`, and `JSON.stringify` would
write those back. A `JsonDocument` keeps the text and reads it as what you
ask for: `isI64` and `i64`, `isU64` and `u64` for an integer that fits,
`f64` for the nearest double, and `numberText` for the digits themselves.
`isIntegral` asks whether the value is whole however it is written, so `1.0`
and `1e2` are, though `isI64` says no to both: they are not written as
integers.
Writing the document back writes the text, so an ID wider than any integer
type, or a price with more digits than a double holds, comes out exactly as it
came in.

**Building.** `newNull`, `newBoolean`, `newString`, `newI64`, `newU64`,
`newF64`, `newNumber` (any JSON number, as text), `newArray` and `newObject`
make values; `push(array, v)` appends and `set(object, key, v)` replaces a
member in place or appends a new one. A value lives in at most one container,
so adding one that is already in a container, or a container to itself, is
refused with `JSON_VALUE_ERR_ATTACHED` and changes nothing.

**Writing.** `stringify(v)` answers minified text. `write(v, w)` writes into a
`JsonWriter` you set up, so the buffer, its reuse and its error codes are the
writer's, as in [`nish/json`](#nishjson).

**Errors and limits are the tokenizer's.** `parse(bytes, off, len)` and
`parseText(s)` answer the root, or a negative code: one of the
[`nish/json-tokenizer`](#nishjson-tokenizer) codes, with the same `JsonLimits`
and the byte in `doc.errorAt`. Nothing in the input can make it panic. The
nesting depth is capped at 64, the writer's own limit, so every document a
parse accepts can be written back. A document holds at most `doc.maxValues`
values, 262,144 unless you raise it; one more is `JSON_VALUE_ERR_VALUES`. Each
value costs the document about 46 bytes, kept for as long as the document is,
so that cap, with the input's own size limit for the text the document
copies, is what bounds a long-lived server's memory.

**Duplicate keys are refused.** `{"a":1,"a":2}` is `JSON_VALUE_ERR_DUPLICATE`,
because two programs that read different members of one text can disagree
about what it says. If you need to accept what `JSON.parse` accepts, set
`doc.duplicates = JSON_VALUE_DUPLICATE_LAST` before parsing, and you get its
answer: one member, at the place of the first, with the value of the last.

**One document, many parses.** Each `parse` replaces what the document held,
and every handle from before it is gone: a handle kept from the last request
reads as `JSON_VALUE_NONE` in this one, even when the two have the same shape.
The check counts in a cycle of 511 steps — one for each `clear`, one for
each parse, two for a parse that fails — so do not keep handles across
parses; it is there to catch the mistake. The document keeps its memory, so a
server that keeps one document and parses each request into it stops
allocating once it has seen its largest request. `clear()` empties it for
building from scratch.

Objects keep their members in order, and `get` looks a key up by scanning
them, so walk a large object once with `keyAt` and `at` rather than calling
`get` for each of many keys. Under Node, where a string is UTF-16,
`parseText` and the builders take one byte per character, so non-ASCII text
differs from the native build there; `parse` over bytes reads the same both
ways. Its security record is
[docs/security/json.md](../../security/json.md).

## `nish/yaml`

`parseYaml(text)` reads a YAML 1.2 stream — a configuration file, a CI
workflow, a Kubernetes manifest — and answers a `YamlStream`: every document,
every node, and every problem found, each with the byte range of the source it
is about. A parse never fails and never panics on its input; a stream that is
not valid YAML still answers its nodes, as the parser's best reading of it,
beside the errors that say why.

```ts nish:ok
import { YAML_INT, YAML_MAP, keyText, parseYaml, pathNode, yamlErrorName } from "nish/yaml";
import { YamlLineIndex } from "nish/yaml-lines";

export const main = (): i32 => {
  const text = "name: tea\nport: 8080\ntags: [green, black]\n";
  const stream = parseYaml(text);
  const root = stream.documentRoot(0);
  if (stream.kind(root) === YAML_MAP) {
    let i: i32 = 0;
    while (i < stream.count(root)) {
      const pair = stream.child(root, i);
      console.log(`${keyText(stream, stream.key(pair))} = ${keyText(stream, stream.value(pair))}`);
      i += 1;
    }
  }
  // name = tea
  // port = 8080
  // tags = [ green, black ]

  const port = pathNode(stream, root, ["port"]);
  console.log(`${stream.type(port) === YAML_INT} ${stream.intValue(port)}`); // true 8080
  console.log(stream.text(pathNode(stream, root, ["tags", "1"]))); // black
  console.log(`bytes ${stream.start(port)}..${stream.end(port)}`); // bytes 16..20

  const bad = parseYaml("a: 1\nb: [1,,2]\na: 3\n");
  const lines = new YamlLineIndex(bad.source);
  let d: i32 = 0;
  while (d < bad.diagnosticCount()) {
    const at = bad.diagnosticStart(d);
    console.log(`${lines.line(at)}:${lines.column(at)} ${yamlErrorName(bad.diagnosticCode(d))} ${bad.diagnosticMessage(d)}`);
    d += 1;
  }
  // 2:7 UNEXPECTED_COMMA Missing value before ","
  // 3:1 DUPLICATE_KEY Map key "a" is duplicated
  return bad.errorCount() === 2 ? 0 : 1;
};
```

**A node is an `i32` handle** into the stream, and `-1` is no node. Its
`kind` is `YAML_SCALAR`, `YAML_MAP`, `YAML_SEQ`, `YAML_ALIAS` or `YAML_PAIR`.
`count(n)` and `child(n, i)` walk a collection: a map's children are its
pairs, in the order they were written, and a pair's `key` and `value` are
nodes; a sequence's children are its items. An empty value (`a:`) is no node,
so its `value` is `-1` and reads as null. An alias's `target` is the node its
anchor named, and `resolved(n)` follows an alias to it. `anchor`, `tag` and
`style` answer what was written; a `!!` tag is kept without its prefix
(`"int"`).

**Scalars are read when you ask.** `text(n)` decodes a scalar — quotes,
escapes, folding and block scalars — and `type(n)` resolves it against the
core schema: `YAML_NULL`, `YAML_BOOL`, `YAML_INT`, `YAML_FLOAT` or
`YAML_STRING`, with `boolValue`, `intValue` and `floatValue` to read it. YAML
1.1's `yes` and `on` are strings, as 1.2 says. Nothing is decoded until it is
read, so a program that wants one key pays for one key.

**Paths.** `pathNode(stream, root, path)` follows a path of map keys and
sequence indices (`"0"`, never `"01"`) through aliases, and answers the node
the last matching step reached; `pathMatch` says how many steps matched and
`pathPair` answers the last pair it stepped through, whose `key` is where a
message about that setting should point. A key is matched by `keyText`, the
text it was written as, so `1` and `01` are different keys and a null key
(`~`, `null`) is matched by `""`. When a map repeats a key, the last one
wins. A step onto an empty value (`a:`) matches, so `pathMatch` counts it and
`pathPair` names its pair, but it reaches no node: `pathNode` answers `-1`.

**A read never panics.** A handle that names no node, or a read that does
not fit the node — `count` of a scalar, `intValue` of a string — answers a
default: `-1` for a node or an offset, and `0`, `false` or `""` otherwise.

**Ranges and lines.** `start(n)` and `end(n)` are byte offsets into
`stream.source`, as are a diagnostic's `diagnosticStart` and
`diagnosticEnd`. `new YamlLineIndex(text)` from `nish/yaml-lines` turns an
offset into a 1-based `line` and `column` (in characters; `byteColumn` counts
bytes); a line break is LF, CR LF or a lone CR.

**Diagnostics.** `diagnosticCount`, `errorCount` and `warningCount` count
them; each has a `YAML_ERR_*` code, named by `yamlErrorName` the way other
YAML tools name it, `diagnosticIsWarning`, a message and its range, sorted by
where it starts. An error means the text is not valid YAML; a warning means it
is valid and probably not what was meant, such as `!!int x`. A map that
repeats a key is an error, `DUPLICATE_KEY`.

**Options.** `parseYamlWith(text, options)` takes a `YamlOptions`:
`maxDepth` (how deeply collections nest before `DEPTH_LIMIT`, 1000 by
default; a value outside 1 to 1000 is a mistake in the program, so
`parseYamlWith` panics on it), `uniqueKeys`, `merge` (whether a `<<` key is exempt from the
duplicate check), `keepComments` (keep every comment's range, for
`commentCount` and `comment`) and `firstDocumentOnly` (warn
`MULTIPLE_DOCUMENTS` and stop after the first). Merge keys are not applied: a
map holds the pairs it was written with. Tabs are never indentation, as YAML
says.

## `nish/pair`

`Pair<A, B>` is an interface with two fields, `first` and `second`, and
nothing else. It is how a function answers two values: you return an object
literal and the annotation gives it its type.

```ts nish:ok
import { Pair } from "nish/pair";

const minMax = (xs: i32[]): Pair<i32, i32> => {
  let lo = xs[0];
  let hi = xs[0];
  for (const x of xs) {
    if (x < lo) {
      lo = x;
    }
    if (x > hi) {
      hi = x;
    }
  }
  return { first: lo, second: hi };
};

export const main = (): i32 => {
  const r = minMax([4, -2, 9, 3]);
  console.log(`${r.first} ${r.second}`); // -2 9
  return 0;
};
```

Import it with a plain `import`: `import type` is not supported. Use `Pair` to
return two values, not to store them side by side — a class with named fields
says more.

## `nish/map`

Two helpers for the global `Map`. `getOrInsert(m, key, value)` answers the
value at `key`, first storing `value` there if the key was missing, in one
lookup. `reserve(m, n)` makes room for `n` entries up front, so filling the
map never has to grow it.

```ts nish:ok
import { getOrInsert, reserve } from "nish/map";

export const main = (): i32 => {
  const counts = new Map<string, i32>();
  reserve(counts, 8);
  for (const word of ["a", "b", "a", "c", "a"]) {
    counts.set(word, getOrInsert(counts, word, 0) + 1);
  }
  for (const word of counts.keys()) {
    const n = counts.get(word);
    if (n !== undefined) {
      console.log(`${word} ${n}`);
    }
  }
  return 0;
};
```

```console
$ nish run words.ts
a 3
b 1
c 1
```

`Map` itself is described in [Maps and sets](../language/maps-and-sets.md).

## `nish/random`

`new Rng(seed)` makes a generator of pseudo-random numbers from an `i32`
seed: the same seed always answers the same sequence, natively and under
Node. `nextI32()` answers the next 32 bits as an `i32`, and `nextF64()` a
number in [0, 1). Every seed works, 0 included, and nearby seeds answer
unrelated sequences, so a task or a parallel body can seed its own from its
index. It is not for keys or passwords: those come from
`crypto.getRandomValues`.

```ts nish:ok
import { Rng } from "nish/random";

export const main = (): i32 => {
  const r = new Rng(2024);
  let inside: i32 = 0;
  for (let i: i32 = 0; i < 1000; i++) {
    const x = r.nextF64();
    const y = r.nextF64();
    if (x * x + y * y < 1.0) {
      inside = inside + 1;
    }
  }
  console.log(`${inside > 700 && inside < 870}`); // true: about 785 of 1000
  return 0;
};
```

A generator is an ordinary object you step, so a task or a parallel body that
makes its own may use it freely; one shared between tasks would be a write
they all see, and is refused. See [Random numbers](../../LANGUAGE.md#random-numbers-rng-in-nishrandom)
in the reference.

## `nish/term`

`nish/term` is for a program that draws the whole terminal, many times a
second: a game, a dashboard. It does no input or output of its own. A
`Screen` turns what you drew into the string that updates the terminal, and
you print it with `write`. A `KeyDecoder` turns the bytes you read into key
events. The terminal's size and the clock are numbers you pass in. Because
the module reaches no capability, a program that uses it builds under
`--deny` of all of them and prints the same bytes under Node.

```ts nish:ok
import { ATTR_BOLD, COLOR_DEFAULT, Canvas, Screen, hideCursor, rgb, showCursor } from "nish/term";
import { write } from "nish:io";

export const main = (): i32 => {
  const screen = new Screen(20, 4, false);
  const canvas = new Canvas(screen); // 20 x 8 pixels, two to a cell
  canvas.fillRect(2, 2, 6, 2, rgb(0, 160, 255)); // a brick
  canvas.line(0, 7, 19, 7, rgb(90, 90, 90)); // the floor
  screen.text(11, 0, "score 0", rgb(255, 255, 0), COLOR_DEFAULT, ATTR_BOLD);
  write(hideCursor());
  write(screen.flush()); // the first frame: every cell
  screen.text(17, 0, "5", rgb(255, 255, 0), COLOR_DEFAULT, ATTR_BOLD);
  write(screen.flush()); // the next one: a cursor move and the "5"
  write(`${showCursor()}\n`); // a flush ends in the default style
  return 0;
};
```

**A `Screen`** is `width × height` cells, each a code point, a foreground
colour, a background colour and the attributes `ATTR_BOLD` and
`ATTR_INVERSE`. Draw with `set(x, y, codePoint, fg, bg, attrs)` and
`text(x, y, s, fg, bg, attrs)`, which returns the column after the text, and
blank the frame with `clear(background)`. A code point the terminal cannot
show in one cell, such as a control character (C0 or C1, so U+009B cannot
open an escape) or a surrogate, is sent as U+FFFD, and attribute bits other than those two are dropped. The screen also remembers what it
last sent. `flush()` answers only the difference: it moves the cursor to the
cells that changed and sends a style only where it differs from the cell
before. An empty answer means nothing changed. On a 200 × 60 screen,
rewriting every cell flushes in about 0.1 ms, and one changed cell in about
0.03 ms. After `resize(width, height)` the next flush redraws everything, and
so does one after `invalidate()`: call that when something else has written
to the terminal.

**A `Canvas`** puts pixels on a screen, two to a cell, one above the other.
It draws with the half-block character "▀": the foreground is the top pixel's
colour and the background is the bottom pixel's. A cell is about twice as
tall as it is wide, so the pixels come out roughly square. It has
`setPixel(x, y, colour)`, `pixel(x, y)`, `fillRect(x, y, w, h, colour)`,
`line(x0, y0, x1, y1, colour)`, `clear(colour)`, and
`text(column, row, s, fg)`, which writes over the pixels in cell
coordinates. Anything drawn off the edge is dropped.

**Colour** is `rgb(r, g, b)`, a 24-bit `i32`, or `COLOR_DEFAULT` for the
terminal's own colour. Some terminals cannot show 24-bit colour; for them,
make the screen with `new Screen(w, h, true)` and every colour is sent as its
nearest entry in the 256-colour palette (`paletteIndex`). Most terminals set
`COLORTERM` to `truecolor` or `24bit` when they can, and reading it is up to
your program. The other escapes are plain functions that answer a string:
`enterAltScreen` and `leaveAltScreen`, `hideCursor` and `showCursor`,
`clearScreen`, `resetStyle`, `moveCursor(x, y)`, and `beginSync` and
`endSync`, described below.

**A `KeyDecoder`** reads the bytes a terminal in raw mode sends.
`feed(bytes, count, nowMs)` answers a `KeyEvent[]`, each with a `kind` (one
of `KEY_UP`, `KEY_DOWN`, `KEY_LEFT`, `KEY_RIGHT`, `KEY_ENTER`, `KEY_SPACE`,
`KEY_ESCAPE`, `KEY_CTRL_C`, `KEY_TAB`, `KEY_BACKSPACE`, `KEY_CHAR`,
`KEY_CONTROL`, `KEY_UNKNOWN`) and a `code`, which for `KEY_CHAR` is the
character's code point; bytes that are not valid UTF-8, and a C1 control
(U+0080–U+009F), come out as U+FFFD.
A read can stop in the middle of an arrow key's
`ESC [ A`; the decoder holds the start and finishes the key on the next
`feed`. The ESC key sends a lone ESC, which is also how an arrow key begins.
So the decoder holds an ESC until either the rest of a sequence arrives or
the timeout you gave the constructor passes. While `waiting()` is true, call
`poll(nowMs)` once the timeout is up to collect the `KEY_ESCAPE`.

```ts nish:ok
import { KEY_LEFT, KeyDecoder } from "nish/term";

export const main = (): i32 => {
  const keys = new KeyDecoder(toF64(30)); // give up on a lone ESC after 30 ms
  const first: u8[] = [toU8(27), toU8(91)]; // ESC [, and the read ends
  const rest: u8[] = [toU8(68)]; // D
  const none = keys.feed(first, 2, toF64(0));
  const left = keys.feed(rest, 1, toF64(4));
  console.log(`${none.length} ${left.length} ${left[0].kind === KEY_LEFT}`); // 0 1 true
  return 0;
};
```

**At 120 or 240 Hz**, two things matter. The first is that the terminal
never shows a frame half drawn. Set `screen.sync = true` and every flush
that changes something is wrapped in `beginSync()` and `endSync()`
(synchronized output, mode 2026). A terminal that supports the mode holds
the frame and paints it in one go; kitty, foot, WezTerm and iTerm2 do, and
one that does not ignores the escapes. An unchanged frame
stays an empty string. The second is that the game runs at the same speed
whatever the display does. A `FixedStep` clock turns the time between frames
into whole steps: `new FixedStep(stepsPerSecond, maxSteps)`, then
`advance(nowMs)` answers how many steps to run and keeps the remainder for
next time. `alpha()` is that remainder as a fraction of a step, for drawing
between the last two positions. A clock that falls more than `maxSteps`
behind, after a stall, drops the backlog instead of trying to catch up. The
same clock with `maxSteps` 1 paces the drawing: it answers 1 when a frame is
due. The first `advance` only starts the clock, and answers 0.

```ts nish:ok
import { COLOR_DEFAULT, Canvas, FixedStep, Screen, rgb } from "nish/term";
import { write } from "nish:io";
import { monotonicNanos } from "nish:process";

export const main = (): i32 => {
  const screen = new Screen(40, 12, false);
  screen.sync = true; // each frame is painted whole
  const canvas = new Canvas(screen); // 40 x 24 pixels
  const logic = new FixedStep(240, 8); // the game moves 240 times a second
  const draw = new FixedStep(120, 1); // and is drawn 120 times a second
  const start = monotonicNanos();
  let x = 0;
  let nowMs = toF64(0);
  while (nowMs < toF64(2000)) {
    nowMs = toF64(monotonicNanos() - start) / toF64(1000000);
    const steps = logic.advance(nowMs);
    for (let k = 0; k < steps; k++) {
      x = (x + 1) % 480; // one pixel every 6 steps
    }
    if (draw.advance(nowMs) > 0) {
      canvas.clear(COLOR_DEFAULT);
      canvas.fillRect((x / 6) | 0, 10, 4, 4, rgb(255, 120, 0));
      write(screen.flush());
    }
  }
  return 0;
};
```

The loop above spins between frames to stay short; a real one waits on its
keyboard input until the next frame is due. A frame of a game like this
flushes in well under a millisecond, so the budget at 240 Hz, about 4 ms,
goes to the terminal, which has its own pacing. kitty waits `repaint_delay`
milliseconds (10 by default) before it paints; `repaint_delay 2` and
`sync_to_monitor yes` in `kitty.conf` let it keep up. foot paints on the
compositor's frame callback, so it follows the monitor's refresh rate by
itself.

## `nish/bytes`

A file header, a network packet or a hash's input is a `u8[]` with numbers
laid out in it. `nish/bytes` reads one from, or writes one into, the array at
an offset, in either byte order: `LE` (little-endian) puts the least
significant byte at the offset, `BE` (big-endian, network order) the most
significant.

| Width | Read | Write |
| --- | --- | --- |
| `u16` | `getU16LE`, `getU16BE` | `setU16LE`, `setU16BE` |
| `u32` | `getU32LE`, `getU32BE` | `setU32LE`, `setU32BE` |
| `u64` | `getU64LE`, `getU64BE` | `setU64LE`, `setU64BE` |
| `i32` | `getI32LE`, `getI32BE` | `setI32LE`, `setI32BE` |
| `i64` | `getI64LE`, `getI64BE` | `setI64LE`, `setI64BE` |
| `f64` | `getF64LE`, `getF64BE` | `setF64LE`, `setF64BE` |

A signed width is the same bytes read as two's complement, and an `f64` is
its IEEE 754 bits. There is no `f32`.

```ts nish:ok
import { getU16LE, getU32BE, setU32LE } from "nish/bytes";

export const main = (): i32 => {
  const b: u8[] = [0, 0, 1, 0, 0, 0, 0, 0];
  console.log(`${getU32BE(b, 0)}`); // 256
  setU32LE(b, 4, toU32(513));
  console.log(`${b[4]} ${b[5]}`); // 1 2
  console.log(`${getU16LE(b, 4)}`); // 513
  return 0;
};
```

Every access is an ordinary index. An offset whose bytes do not all lie in the
array panics with `index out of range`, naming the first byte that is not
there. A guard in your own loop, such as `off + 3 < b.length`, does not yet
remove these checks, so a hot loop that needs them gone indexes the bytes
itself.

Natively every function answers for every value. Under Node the `u16` and
`u32` functions are expected to answer the same, but the 64-bit ones, the
`i32` ones and `f64` do not yet: the Node prelude's conversions saturate where native ones wrap.

## `nish/threads`

Running work on several threads: `parallelMapInto`, `parallelMap`,
`parallelFrom` and `parallelReduce` for one function over an array, `scope()` for a few different tasks at once, and
`Mutex<T>` and `Channel<T>` for sharing between them. Importing the module is
all it takes to build a threaded program. It has a page of its own,
[Threads](threads.md).

## `nish:secret`

`nish:secret` is written with a colon because it is a builtin module, but it
ships beside the library and the cryptography uses it. A `Secret<T>` holds key
material — an array of integers, or a record of integer fields — and the
compiler refuses every road out of it but one: `expose(s, f)` or
`exposeWith(s, arg, f)` hands the value to a function. `wipe(s)` zeroes it
with a store the optimiser may not remove.

```ts nish:ok
import { Secret, exposeWith, secret, wipe } from "nish:secret";
import { hmacSha256 } from "nish/crypto/hmac";

const tag = (key: u8[], message: u8[]): u8[] => hmacSha256(key, message);

export const main = (): i32 => {
  const keyBytes: u8[] = [1, 2, 3, 4];
  const key: Secret<u8[]> = secret(keyBytes); // `keyBytes` is moved in
  const message: u8[] = [104, 105];
  const mac: u8[] = exposeWith(key, message, tag);
  wipe(key);
  console.log(`${mac.length}-byte tag`); // 32-byte tag
  return 0;
};
```

Printing a `Secret`, putting it in a template, or handing it to any builtin is
a compile error.

The type can be left off: `secret` answers a `Secret` of whatever it is given,
and every rule below holds the same.

```ts nish:ok
import { expose, secret, wipe } from "nish:secret";

const length = (k: u8[]): i32 => toI32(k.length);

export const main = (): i32 => {
  const key = secret(new Array<u8>(32)); // a `Secret<u8[]>`
  console.log(`${expose(key, length)} bytes`); // 32 bytes
  wipe(key);
  return 0;
};
```

`secret(v)` takes a value nothing else holds: a literal, a call that makes a
new array or record, or a local that is the only name for its value. A second
name made before the move would read the key outside the `Secret`, and zeros
once it is wiped, so the compiler refuses it and says where it was made:

```ts nish:err NL2512
import { Secret, secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const alias = raw; // a second name for the same bytes
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
```

Storing the array in a field or an element, pushing it, or handing it to a
function that keeps it is a second name too. To keep the plain bytes as well,
copy them first, and move the copy in:

```ts nish:ok
import { Secret, secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const copy: u8[] = new Array<u8>(raw.length);
  copy.set(raw);
  const key: Secret<u8[]> = secret(copy); // `copy` is the only name for its bytes
  wipe(key);
  console.log(`${raw[0]}`); // 1: `raw` is its own array
  return 0;
};
```

The rules are in [Secrets](../../LANGUAGE.md#secrets-nishsecret).

### Keeping a key in an object

A key that lives as long as a connection or a session can be a field. The
field is `readonly` and exactly `Secret<T>`, the class is not generic, and the
class has a `wipe(): void` that calls `wipe(this.field)` for every such field
on every path: the checker reads that method, and a field it can leave
unwiped is a compile error.

```ts nish:ok
import { Secret, expose, secret, wipe } from "nish:secret";

const count = (k: u8[]): i32 => toI32(k.length);

class Session {
  readonly key: Secret<u8[]>;
  constructor() {
    this.key = secret(new Array<u8>(32)); // set once, from `secret(...)`
  }
  size(): i32 {
    return expose(this.key, count); // lent to `expose`, not copied out
  }
  wipe(): void {
    wipe(this.key);
  }
}

export const main = (): i32 => {
  const s = new Session();
  console.log(`${s.size()}-byte key`); // 32-byte key
  s.wipe();
  return 0;
};
```

The field is set only in the constructor, only from `secret(...)`, and only
once. It may be read only to lend it: as an argument of a call or of `new`, or
as an operand of `===` or `!==`. Copying it into a local, returning it, or
storing it anywhere else is refused:

```ts nish:err NL2544
import { Secret, secret, wipe } from "nish:secret";

class Session {
  readonly key: Secret<u8[]>;
  constructor() {
    this.key = secret(new Array<u8>(32));
  }
  wipe(): void {
    wipe(this.key);
  }
}

export const main = (): i32 => {
  const s = new Session();
  const k = s.key; // a second name for the key, outside the holder
  s.wipe();
  return 0;
};
```

The holder's `wipe()` is the only place the field ends: `wipe(s.key)`
anywhere else is refused, so call `s.wipe()` instead. A function that takes a
`Secret` borrows it, so it may lend it on or `expose` it, but it neither
returns it nor wipes it:

```ts nish:err NL2546
import { Secret, secret, wipe } from "nish:secret";

const same = (k: Secret<u8[]>): Secret<u8[]> => k; // a second name for the caller's key

export const main = (): i32 => {
  const k = secret(new Array<u8>(32));
  const again = same(k);
  wipe(again);
  return 0;
};
```

Up to 0.18.0 a function could return or wipe a `Secret` it was passed; from
the release after it, both are refused. Drop such a return and keep using the
key you passed in, and leave the `wipe` to the code that made the key.

Calling `wipe()` is the program's job: the compiler checks that the method
wipes every field, not that something calls it. The rules are in
[A `Secret` field](../../LANGUAGE.md#a-secret-field).

## `nish/crypto`

One module per primitive, each imported by its own name, each written in Nish
from its specification and checked against that specification's published
test vectors. A byte string is a `u8[]`.

| Module | Main exports |
| --- | --- |
| `nish/crypto/sha256` | `sha256(data)`, and `Sha256`, a streaming hasher (`update`, `copy`, `digest`) |
| `nish/crypto/sha512` | `sha512`, `sha384`, and the streaming `Sha512` and `Sha384` |
| `nish/crypto/hmac` | `hmacSha256`, `hmacSha384`, `hmacSha512`, their streaming classes, and `hmacSha256Verify` and its siblings, which compare in constant time |
| `nish/crypto/hkdf` | `hkdfExtractSha256`, `hkdfExpandSha256` and their SHA-384 forms; TLS 1.3's `hkdfExpandLabelSha256`; and a `Secret` form of each (`hkdfExtractSha256Secret`, `hkdfExpandLabelSha256Secret`, …), which takes the key as a `Secret<u8[]>`, answers one, and wipes what it derives on the way; and `hkdfExpandLabelSha256Held(dst, prk, label, context)` and its SHA-384 form, which derive into a `Secret` you already hold, as many bytes as it holds, in place — `dst` may be `prk`, a ratchet |
| `nish/crypto/ct` | `timingSafeEqual(a, b)`, a comparison that reads every byte |
| `nish/crypto/base64url` | `base64urlEncode` and a strict `base64urlDecode`, unpadded |
| `nish/crypto/chacha20poly1305` | `chacha20Poly1305Seal` and `chacha20Poly1305Open` |
| `nish/crypto/aes` | `aesKey` for AES-128 and AES-256, `aesGcmSeal` and `aesGcmOpen` |
| `nish/crypto/x25519` | X25519 key exchange |
| `nish/crypto/ed25519` | Ed25519 signatures (RFC 8032): `ed25519PublicKey(seed)`, `ed25519Sign(seed, msg)` and `ed25519Verify(pub, msg, sig)`; the seed is a 32-byte `Secret<u8[]>`, and a message longer than 2^31 − 1 bytes panics; verification does not refuse a public key of small order |
| `nish/crypto/p256` | P-256 ECDSA signing and verification |
| `nish/crypto/x509` | DER and PEM, and self-signed P-256 certificates |
| `nish/crypto/x509-random` | a random P-256 key and certificate serial for `x509`; native only, so a program that imports it does not build for WebAssembly |
| `nish/crypto/sha1` | `sha1(data)`, **not for security**: it is here only because the WebSocket handshake is defined on it |

```ts nish:ok
import { base64urlEncode } from "nish/crypto/base64url";
import { sha256 } from "nish/crypto/sha256";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  console.log(base64urlEncode(sha256(bytesOf("abc"))));
  return 0;
};
```

```console
$ nish run digest.ts
ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0
```

A function that returns `u8[] | null` answers `null` for an input it refuses —
a bad key length, a tag that does not verify — so narrow the result before you
use it. The modules that hold a private key (`p256`, `x25519`, `ed25519`,
`x509`, `x509-random`) take and give it as a `Secret<u8[]>`. Every module but `sha1` and
`ed25519`, which came later, has been through a security audit (`ed25519` is
recorded as a change after its area's audit); the records are in
[docs/security/](../../security/README.md).

## `nish/net`

The protocol stack written on `nish/crypto`: TLS 1.3 (`nish/net/tls`), QUIC
(`nish/net/quic` and its parts), HPACK and QPACK, HTTP/1.1
(`nish/net/http1`, `nish/net/http1-server`), HTTP/2 (`nish/net/http2`),
HTTP/3 (`nish/net/http3`), WebSocket (`nish/net/websocket`) and WebTransport.
Most of these modules are *sans-IO*: they take bytes and answer bytes, and
never read a socket or a clock themselves, so you drive them from your own
loop over [`nish:net`](networking.md). The ones
that sit on sockets are `nish/net/tls-tcp`, `nish/net/http1-server` (its
`Http1Server` and `Http1TlsServer` pools), `nish/net/http2-tls` and
`nish/net/http3-server`; like `nish:net` itself, they are native only. Your
loop re-arms an `Http1Server` slot only when `server.rearm(slot, wants)` says
its interest changed, so a keep-alive request costs one `recv` and one `send`
and no `pollModify`. A slot borrows its output buffer only while it writes, so
an idle connection costs a few KiB, not `outputSize`. An `Http1Server` builds
a slot's connection on the first accept into it and keeps it for the next, so
a pool sized for 16,384 connections costs some 16 KiB until they come;
`bench/http.mjs` load-tests that loop on one core. `TlsTcpServer`,
`Http1TlsServer`, `Http2TlsServer` and `Http3Server` build a slot the same
way, on the first connection accepted into it (an `Http2TlsServer` builds slot
0 in its constructor), so a pool's size is a ceiling on its connections. What
start-up still takes grows with it: the tables sized from the cap, such as an
`Http3Server`'s connection-ID index, timer wheel and rings.

`nish/net/router` maps a request's method and path to a route you added, on
any of the three HTTP versions, without allocating; [HTTP routing](http-router.md)
shows it.

`nish/net/prefork` runs a server on every core: `preforkWorkers(process.argv)`
starts the program once per worker, each on its own `SO_REUSEPORT` listener,
restarts the ones that exit and stops them all on SIGTERM. It is native only;
[Networking](networking.md#a-server-on-every-core-nishnetprefork) shows it.

Every final response an `Http1Connection` sends carries a `Date` field, and so
does every final response an `Http2TlsServer` or `Http3Server` slot sends, as
a lowercase `date` field straight after `:status`. A 1xx response and trailers
carry none. Each server's `HttpDate` formats the date at most once a second,
and a pool's slots share one. Set your own `date` field and it is sent
instead: in any case on HTTP/1.1, and lowercase on HTTP/2 and HTTP/3, which
refuse an uppercase field name (`H2_INVALID`, `H3_INVALID`). On HTTP/3 the
date counts against the client's field-section limit like any other field. In
a test that compares the bytes, call `date.pin(unixMs)` on the server, or on a
lone HTTP/1.1 connection; give a lone `Http2Connection` or `Http3Connection`
the bytes to send in its `date`. The formatter itself, `httpDateWrite` in
`nish/net/http-fields`, reads no clock, so a wasm32 build can use it.

When an `Http3Server` shuts down, call its `stop()`: it releases every
connection and wipes the stateless reset and Retry token keys of the
`QuicServerConfig` it was made with, so keep no other copy of them, or wipe
yours with [`secureZero`](../../LANGUAGE.md#wiping-a-secret-securezero) too.
It zeroes those keys in place, so give each server a `QuicServerConfig` of its
own: once one server stops, any other listener, connection or server made with
the same configuration would sign its Retry tokens and stateless resets with a
key of zeros, which anyone can forge. The HTTP/1.1 and WebSocket modules were
written with a security record of their own
([docs/security/http1.md](../../security/http1.md)) rather than audited after
the fact. TLS's one-shot key schedule (`tlsExtract`, `tlsDeriveSecret`,
`tlsTrafficKey` and the rest of `nish/net/tls/schedule`) and QUIC's
`quicKeys`, `quicKeysUpdate` and `quicKeyUpdateSecret` take a traffic secret
as a `Secret<u8[]>` and answer secrets as one; `quicKeys` and `quicKeysUpdate`
write the packet keys into a `QuicKeysSlot` you pass, and that slot is yours to
wipe, so call its `wipe()` (or `quicKeysWipe` on the keys) when you are done.

A `TlsServer` keeps every secret of an open connection as a
[`Secret` field](../../LANGUAGE.md#a-secret-field): the ephemeral key, and the
handshake, traffic, exporter and resumption secrets in the `TlsSecretPool` that
`secrets()` answers, read only through `expose`. `new TlsServer`, `restart`
and `TlsTcpServer.accept` copy the ephemeral key you hand them into the
server's own `Secret` and zero your array, so fill a fresh key into it for
each connection rather than reading it again. When you drive a `TlsServer` or
a `TlsRecordServer` yourself rather than through `nish/net/tls-tcp`, call its
`wipe()` once the connection is done; the carriers call it at every end of a
connection.

A server that lends byte buffers across connections takes them from
`nish/net/buffer-pool`'s `BufferPool`: a pool of fixed-size buffers, up to a
ceiling, whose `give` zeroes the bytes a buffer used before it is lent again,
and whose `giveSecret` wipes the buffer whole.

A TLS server that resumes sessions seals its tickets with
`nish/net/tls/ticket`: `tlsTicketSeal` and `tlsTicketOpen` take the ticket key
as a borrowed `Secret<u8[]>`, so your program keeps the current and previous
keys in locals — draw both with `tlsTicketKeyDraw` at start-up, each into its
own `TlsTicketKeyInfo` — and runs the rotation itself when `tlsTicketKeyDue` says so —
`wipe(previous)`, `previous = current`, `previousInfo.copyFrom(currentInfo)`,
`current = tlsTicketKeyDraw(currentInfo, now)`. Every time it takes is
`monotonicNanos()`, read by you and passed in. The servers strike each
ticket they resume in a `TlsTicketStrikes` you make and lend them: its `take`
answers false for a replay, and for every ticket once the register is full,
so make it as large as the tickets you issue in two hours.

Resumption is off until you turn it on. Call `enableTickets()` on the
`TlsServer` (`conn.tls` of a `TlsRecordServer`) or on the `TlsTcpServer`,
once; it is kept across `restart`. From then on a connection's interest says
`TLS_RECORD_TICKET` (from `nish/net/tls/record-server`) twice. In the
handshake, when the ClientHello offers a ticket, call
`resume(current, currentInfo, previous, previousInfo, strikes, now)`, with
the current key as both if you have only one: the server opens the ticket,
checks its binder, strikes it and answers the hello, resumed with
`psk_dhe_ke` (no certificate, no signature, so no `TLS_RECORD_SIGN`) or as a
full handshake when the ticket is refused. Once the connection is open, call
`issue(current, currentInfo, now)` to send it one ticket, whether or not it
resumed. On a `TlsRecordServer`, `resume` answers 0 or the alert it failed
with, and `issue` whether it sent a ticket; on a `TlsTcpServer` both take the
`slot` first and answer the slot's new interest bits. A ticket the server
cannot use (an unknown or retired key, an expired or replayed ticket, another
suite's hash or another server name, a full register) falls back to a full
handshake; a selected ticket whose binder does not verify fails the
connection with `decrypt_error`. QUIC
never resumes: `enableTickets` on a QUIC connection's `TlsServer` leaves
tickets off. A resumed handshake costs the server about 0.6x a full one
(`tests/link/net_tls_resume_bench`).

```ts
// In the loop, for a slot `poll` says is readable:
let wants: i32 = tcp.readable(slot);
if ((wants & TLS_RECORD_TICKET) !== 0) {
  wants = tcp.connection(slot).state === TLS_RECORD_STATE_OPEN
    ? tcp.issue(slot, current, currentInfo, monotonicNanos())
    : tcp.resume(slot, current, currentInfo, previous, previousInfo, strikes, monotonicNanos());
}
```

```ts nish:ok
import { HTTP1_END, HTTP1_ERROR, HTTP1_HEAD, HTTP1_NEED_MORE, Http1Parser } from "nish/net/http1";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  // limits: target bytes, header bytes, header count, body bytes
  const parser = new Http1Parser(1024, 8192, 32, 65536);
  const request = bytesOf("GET /hello HTTP/1.1\r\nHost: example.com\r\n\r\n");
  parser.feed(request, 0, toI32(request.length));
  let event = parser.next();
  while (event !== HTTP1_NEED_MORE && event !== HTTP1_END && event !== HTTP1_ERROR) {
    if (event === HTTP1_HEAD) {
      const host = parser.header("host");
      if (host !== null) {
        console.log(`${parser.method} ${parser.target} for ${host}`);
      }
    }
    event = parser.next();
  }
  return 0;
};
```

```console
$ nish run request.ts
GET /hello for example.com
```

## `nish/net/url`

A request target is a path and, after a `?`, a query of `key=value` pairs
joined by `&`, both percent-encoded. `nish/net/url` reads them. For one value,
`urlQueryGet(target, name)` answers it decoded, `""` for a key written without
`=`, or null; `urlDecode(s, flags)` decodes a whole string. Both allocate their
answer and answer null for anything malformed or not UTF-8.

A server reads the bytes it received instead, and allocates nothing:
`urlQueryStart` finds the `?`, `UrlPathSegments` splits the path on the raw
`/`, and `UrlQuery` yields the pairs one `next()` at a time, as offsets into
your array. `percentDecode` and `percentDecodePathSegment` decode one window
into a buffer you own and answer how many bytes they wrote. An iterator is made
once and `reset` for each request.

```ts nish:ok
import {
  URL_DECODE_FORM,
  URL_QUERY_PAIR,
  UrlPathSegments,
  UrlQuery,
  UrlQueryLimits,
  percentDecode,
  percentDecodePathSegment,
  urlDecode,
  urlQueryFind,
  urlQueryGet,
  urlQueryStart,
} from "nish/net/url";

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(s.length));
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

const route = (text: string, path: UrlPathSegments, query: UrlQuery): void => {
  const target = bytesOf(text);
  const len = toI32(target.length);
  const out: u8[] = new Array<u8>(len);
  const q = urlQueryStart(target, 0, len); // the `?`, or -1 when there is none
  path.reset(target, 0, q < 0 ? len : q);
  while (path.next()) {
    const n = percentDecodePathSegment(target, path.start, path.length, out, 0, 0);
    if (n < 0) {
      console.log(`bad segment (${n})`); // a URL_DECODE_ERR_* code: answer 400
      return;
    }
    console.log(`segment of ${n} bytes`); // files, a/b (one segment), c
  }
  if (q < 0) {
    console.log("no query");
    return;
  }
  query.reset(target, q + 1, len - q - 1);
  const found = urlQueryFind(query, "name"); // URL_QUERY_PAIR, URL_QUERY_END, or an error code
  if (found !== URL_QUERY_PAIR) {
    console.log(`no name (${found})`);
    return;
  }
  const n = percentDecode(target, query.valueStart, query.valueLength, out, 0, URL_DECODE_FORM);
  if (n < 0) {
    console.log(`bad name (${n})`); // `%zz`: never read out past a negative answer
    return;
  }
  console.log(`name is ${String.fromBytes(out, 0, n)}`); // name is J Doe
};

export const main = (): i32 => {
  // The string API: one call, an allocated answer, null on anything malformed.
  const q0 = urlQueryGet("/search?q=a+b%21&page=2", "q");
  if (q0 !== null) {
    console.log(`q is ${q0}`); // q is a b!
  }
  console.log(`${urlDecode("100%", 0) === null}`); // true: a `%` without two hex digits is refused

  // The byte API: offsets into the target, decoded into a buffer you own.
  const path = new UrlPathSegments();
  const query = new UrlQuery(new UrlQueryLimits()); // at most 100 pairs
  route("/files/a%2Fb/c?name=J%20Doe&flag", path, query);
  route("/files/readme", path, query);
  route("/files/x?name=%zz", path, query);
  route("/files/%zz", path, query);
  return 0;
};
```

```console
$ nish run route.ts
q is a b!
true
segment of 5 bytes
segment of 3 bytes
segment of 1 bytes
name is J Doe
segment of 5 bytes
segment of 6 bytes
no query
segment of 5 bytes
segment of 1 bytes
bad name (-1)
segment of 5 bytes
bad segment (-1)
```

**Decoding is strict by default.** With flags 0, `percentDecode` answers
`URL_DECODE_ERR_ESCAPE` for a `%` not followed by two hex digits and
`URL_DECODE_ERR_NUL` for `%00`, and copies `+` as it is. Add the flags you
want: `URL_DECODE_FORM` reads `+` as a space, as a form or a query does;
`URL_DECODE_LENIENT` copies a malformed escape as it is; `URL_DECODE_ALLOW_NUL`
decodes `%00` to a 0 byte. All three together decode as `URLSearchParams`
does for valid UTF-8; where it replaces an invalid sequence with U+FFFD,
`percentDecode` keeps the bytes. A buffer as long as the input is always big
enough; one shorter than the decoded result answers `URL_DECODE_ERR_SPACE`,
with the bytes before it written. Test every answer before you read `out`:
a peer's `%zz` makes it negative, and `String.fromBytes(out, 0, n)` with a
negative `n` panics. `percentDecodeErrorAt`, called with the same
arguments, answers the offset of the byte an error is at, or -1.

**A path is split before it is decoded**, so `%2F` stays inside its segment:
`/a%2Fb/c` is the two segments `a/b` and `c`, never three. `+` is literal in a
path.

**A query yields at most 100 pairs.** Past `UrlQueryLimits.maxPairs`, `next()`
answers `URL_QUERY_ERR_PAIRS`, and keeps answering it until `reset`, so a
target of a hundred thousand `&`-joined pairs costs one bounded scan. Empty
pairs (`a&&b`) are skipped and not counted. `urlQueryGet` uses the default cap,
and answers null for a key past it.

The byte API does not check that what it decodes is UTF-8: a value may be
binary. The `name` you give `urlQueryFind` or `urlQueryGet` is ASCII: the
native build compares it with the key's bytes and Node with its UTF-16 code
units, so a non-ASCII name answers differently on the two. Nothing here looks
for a `#`, which is never part of a request target.

The [library's README](../../../std/README.md) lists every module, every
export and the specification each one reproduces. How `nish/` imports
resolve is in [`export` and `import`](../../LANGUAGE.md#export-and-import),
and [Modules](../language/modules.md) covers importing your own files.
