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
regular expression — so `nish/text` is where you look first. `Map` and `Set`
need no import at all ([Maps and sets](../language/maps-and-sets.md)), and the
built-in modules that wrap the operating system (`nish:fs`, `nish:process`,
`nish:io`, `nish:net`) are part of the language rather than this library; see
[Builtin modules](../../LANGUAGE.md#builtin-modules-nish).

| Module | What it gives you |
| --- | --- |
| [`nish/testing`](#nishtesting) | `Suite`, a test runner whose report is the exit code |
| [`nish/text`](#nishtext) | `splitLines`, `splitWhitespace`, `trim`, `trimStart`, `trimEnd`, `contains`, `replaceAll`, `firstDifference`, `indexOfAny` |
| [`nish/json`](#nishjson) | `jsonField` and `jsonFields` to read the fields of one flat JSON object; `JsonWriter` to write JSON into a byte buffer |
| [`nish/json-tokenizer`](#nishjson-tokenizer) | `JsonTokenizer`, which checks any JSON text and reads it one token at a time, with limits |
| [`nish/json-typed`](#nishjson-typed) | `jsonDecode` and `jsonEncode`: read a JSON object into a class and write one back, with renamed and optional keys and lossless numbers |
| [`nish/pair`](#nishpair) | `Pair<A, B>`, for a function that returns two values |
| [`nish/map`](#nishmap) | `getOrInsert` and `reserve` for `Map` |
| [`nish/threads`](#nishthreads) | `parallelMapInto`, `parallelReduce`, `scope`, `Mutex`, `Channel` |
| [`nish:secret`](#nishsecret) | `Secret<T>`: key material the compiler keeps from leaking, and wipes |
| [`nish/crypto/*`](#nishcrypto) | SHA-2, HMAC, HKDF, ChaCha20-Poly1305, AES-GCM, X25519, P-256 ECDSA, X.509, base64url |
| [`nish/net/*`](#nishnet) | TLS 1.3, QUIC, HTTP/1.1, HTTP/2, HTTP/3, WebSocket |

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
and the field keeps the member it held. A `Map<string, V>` is a JSON object
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

A key is matched to a field by its length first and then by one of its bytes,
so a class with many fields decodes about as fast per key as a class with few.

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

## `nish/threads`

Running work on several threads: `parallelMapInto` and `parallelReduce` for
one function over an array, `scope()` for a few different tasks at once, and
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
a compile error. The rules are in
[Secrets](../../LANGUAGE.md#secrets-nishsecret).

## `nish/crypto`

One module per primitive, each imported by its own name, each written in Nish
from its specification and checked against that specification's published
test vectors. A byte string is a `u8[]`.

| Module | Main exports |
| --- | --- |
| `nish/crypto/sha256` | `sha256(data)`, and `Sha256`, a streaming hasher (`update`, `copy`, `digest`) |
| `nish/crypto/sha512` | `sha512`, `sha384`, and the streaming `Sha512` and `Sha384` |
| `nish/crypto/hmac` | `hmacSha256`, `hmacSha384`, `hmacSha512`, their streaming classes, and `hmacSha256Verify` and its siblings, which compare in constant time |
| `nish/crypto/hkdf` | `hkdfExtractSha256`, `hkdfExpandSha256` and their SHA-384 forms; TLS 1.3's `hkdfExpandLabelSha256` |
| `nish/crypto/ct` | `timingSafeEqual(a, b)`, a comparison that reads every byte |
| `nish/crypto/base64url` | `base64urlEncode` and a strict `base64urlDecode`, unpadded |
| `nish/crypto/chacha20poly1305` | `chacha20Poly1305Seal` and `chacha20Poly1305Open` |
| `nish/crypto/aes` | `aesKey` for AES-128 and AES-256, `aesGcmSeal` and `aesGcmOpen` |
| `nish/crypto/x25519` | X25519 key exchange |
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
use it. The modules that hold a private key (`p256`, `x25519`, `x509`,
`x509-random`) take and give it as a `Secret<u8[]>`. Every module but `sha1`,
which came later, has been through a security audit; the records are in
[docs/security/](../../security/README.md).

## `nish/net`

The protocol stack written on `nish/crypto`: TLS 1.3 (`nish/net/tls`), QUIC
(`nish/net/quic` and its parts), HPACK and QPACK, HTTP/1.1
(`nish/net/http1`, `nish/net/http1-server`), HTTP/2 (`nish/net/http2`),
HTTP/3 (`nish/net/http3`), WebSocket (`nish/net/websocket`) and WebTransport.
Most of these modules are *sans-IO*: they take bytes and answer bytes, and
never read a socket or a clock themselves, so you drive them from your own
loop over [`nish:net`](../../LANGUAGE.md#builtin-modules-nish). The ones
that sit on sockets are `nish/net/tls-tcp`, `nish/net/http1-server` (its
`Http1Server` and `Http1TlsServer` pools), `nish/net/http2-tls` and
`nish/net/http3-server`; like `nish:net` itself, they are native only. The
HTTP/1.1 and WebSocket modules were written with a security record of their
own ([docs/security/http1.md](../../security/http1.md)) rather than audited
after the fact.

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

The [library's README](../../../std/README.md) lists every module, every
export and the specification each one reproduces. How `nish/` imports
resolve is in [`export` and `import`](../../LANGUAGE.md#export-and-import),
and [Modules](../language/modules.md) covers importing your own files.
