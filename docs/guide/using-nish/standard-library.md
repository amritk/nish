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
A batch job steps aside for interactive work with `setNice(n)` (the nice value,
0..19, lower-only: `-22` outside that range and `-13` below the current value,
even as root) or, on Linux, `setIdlePriority()` (`SCHED_IDLE`: the CPU only when
nothing else wants it). Each answers 0 or a negative errno and never throws;
`setIdlePriority` is -95 on Darwin. An unprivileged process can never leave
`SCHED_IDLE`, and an idle one can starve on a busy machine, so keep a
normal-priority fallback for work that must finish, and call either at the top
of `main`, before any thread starts. See
[Scheduling](../../LANGUAGE.md#scheduling-setnice-setidlepriority).

`spawnPiped(argv, stdin, stdout, stderr)` runs a child with every stream in
memory: the child reads `stdin`'s bytes and then end of file, and what it
writes is appended to `stdout` and `stderr`. It answers the exit status (128
plus the signal for one killed by a signal), -1 when the child cannot start,
and -2 when either output passes 16 MiB, after which the child is killed. It is
how a program hands a child a secret, since a child's argument vector and
environment are readable by other processes and a file outlives the run:

```ts
const token = "ghp_example"
const request = `protocol=https\nhost=github.com\nusername=bot\npassword=${token}\n\n`
const input: u8[] = []
for (let i = 0; i < request.length; i++) {
  input.push(toU8(request.charCodeAt(i)))
}
const out: u8[] = []
const err: u8[] = []
const status = spawnPiped(["git", "credential", "approve"], input, out, err)
if (status !== 0) {
  console.log(`git credential failed (${status}): ${String.fromBytes(err, 0, err.length)}`)
}
```

It is `process.spawn` in the capability report, and refused when compiling for
WebAssembly. See
[Directories and subprocesses](../../LANGUAGE.md#directories-and-subprocesses).

`nish:fs` is where a program replaces a file in one step: write the new
contents beside the target, then `renameSync` the temporary over it, so a
reader sees the old file or the new one and never half of either.
`renameSync`, `unlinkSync`, `writeFileBytesSync` and the mode-taking writes
below answer a number instead
of exiting: `0` (or the bytes written) on success and a negative errno on
failure, such as `-2` for a missing path or `-18` when the two names are on
different filesystems, so the program decides what to say. Bytes that are
not text, a `u8[]` from `readFileBytesSync` or a codec, go out as they are
through `writeFileBytesSync` and, on stdout, `writeBytes` from `nish:io`; see
[File I/O](../../LANGUAGE.md#file-io). A native string built by
`String.fromBytes` carries any bytes, and `write` and `writeFileSync` send it
as it is, but under `--emit-ts` `String.fromBytes` decodes UTF-8 and an
invalid sequence becomes U+FFFD, so `writeBytes` and `writeFileBytesSync` are
the route that is exact everywhere.

Writing a secret to disk, a key or a token, takes three things
`writeFileSync` does not give. `writeFileSyncMode(path, data, 0o600)` leaves
the file at exactly the mode you name, set before the first byte is written,
so the umask cannot widen it and a file that was `0644` is narrowed before it
holds the secret. A symbolic link at `path` is refused with a negative errno
(`-40` on Linux) and the file it names is left alone, so nobody can point your
write somewhere else. And to replace a secret in one step, write it at `0600`
to a temporary beside the target and `renameSync` the temporary over it: a
reader then sees the old secret or the new one, never half of either.
`createFileExclusiveSync(path, data, mode)` is the same write that fails with
`-17` when the name already exists, so of any number of processes racing for
one path exactly one wins: a lock file, released with `unlinkSync`.
`mkdirSyncMode(path, 0o700)` makes a directory only you can enter; the umask
still applies to a directory, which only ever narrows it. A mode past `0o777`,
the setuid, setgid and sticky bits included, is `-22` and nothing is made. The
numbers are the platform's errno values (Linux's shown).

| Module | What it gives you |
| --- | --- |
| [`nish/testing`](#nishtesting) | `Suite`, a test runner whose report is the exit code |
| [`nish/text`](#nishtext) | `splitLines`, `splitWhitespace`, `trim`, `trimStart`, `trimEnd`, `contains`, `replaceAll`, `firstDifference`, `codePointLength`, `indexOfAny` |
| [`nish/regex`](#nishregex) | `regexCompile`: JavaScript-syntax regular expressions, matched in time linear in the input |
| [`nish/json`](#nishjson) | `jsonField` and `jsonFields` to read the fields of one flat JSON object; `JsonWriter` to write JSON into a byte buffer, minified or indented, with an optional strict mode for NaN and the infinities |
| [`nish/json-tokenizer`](#nishjson-tokenizer) | `JsonTokenizer`, which checks any JSON text and reads it one token at a time, with limits |
| [`nish/json-typed`](#nishjson-typed) | `jsonDecode` and `jsonEncode`: read a JSON object into a class and write one back, with renamed and optional keys and lossless numbers |
| [`nish/json-value`](#nishjson-value) | `JsonDocument`: any JSON document as a tree to read, change and write back, with every number kept exactly as written |
| [`nish/yaml`](#nishyaml) | `parseYaml`: a YAML 1.2 stream as documents, nodes and diagnostics, each with its byte range; `pathNode` to find a key, through aliases and merge keys; `nish/yaml-lines` for `line:column`; `stringifyYaml` in `nish/yaml-write` to write a JSON value as YAML |
| [`nish/pair`](#nishpair) | `Pair<A, B>`, for a function that returns two values |
| [`nish/map`](#nishmap) | `getOrInsert` and `reserve` for `Map` |
| [`nish/base64`](#nishbase64) | `base64Encode` and `base64EncodeInto`: standard base64 with `=` padding, into a string or straight into a byte buffer |
| [`nish/bytes`](#nishbytes) | `getU32LE`, `setU16BE` and the rest: integers and doubles read from and written into a `u8[]` at an offset, in either byte order; `skipBlank`, `skipDigits`, `skipJsonText`, `skipJsonPlain` and `copyBytes` for the runs a parser skips and a writer copies |
| [`nish/random`](#nishrandom) | `Rng`, a seeded generator of random numbers and dice (`nextInt`) that answers the same under Node |
| [`nish/cli`](#nishcli) | `HelpMenu` and `styleFor`: a `--help` menu in the terminal theme's own colours, plain when piped; `nish/cli-flags`' `FlagTable` parses the flags, positionals and subcommand that menu lists |
| [`nish/cli-args`](#nishcli-args) | `Cli` and `parse`: a command tree, its flags and arguments, help and did-you-mean errors |
| [`nish/term`](#nishterm) | `Screen`, `Canvas` and `KeyDecoder`: a terminal UI drawn as cells or half-block pixels, sent as only what changed, and what it reads — keys, mouse, paste, focus and the terminal's replies — decoded as `TermEvent`s; `KeyState` for which keys are held |
| [`nish/term-io`](terminal.md) | `runTerminal` and `openTerminal`: open the terminal, find out what it can draw, and run a frame loop whose rate and detail adapt to the link; `nish/term-probe`, `nish/term-rate` and [`nish/term-pixels`](#nishterm-pixels) are its pure parts |
| [`nish/sqlite`](#nishsqlite) | `openDatabase`, `Database` and `Statement`: a SQLite database, with statements prepared once and rows read without allocating |
| [`nish/threads`](#nishthreads) | `parallelMapInto`, `parallelMap`, `parallelFrom`, `parallelReduce`, `scope`, `Mutex`, `Channel` |
| [`nish:secret`](#nishsecret) | `Secret<T>`: key material the compiler keeps from leaking, and wipes |
| [`nish/crypto/*`](#nishcrypto) | SHA-2, HMAC, HKDF, ChaCha20-Poly1305, AES-GCM, X25519, Ed25519, P-256 ECDSA, X.509, trust anchors, base64url, bcrypt |
| [`nish/net/*`](#nishnet) | TLS 1.3, QUIC, HTTP/1.1, HTTP/2, HTTP/3, WebSocket, an HTTP router, a PostgreSQL client |
| [`nish/compress/*`](compression.md) | gzip, zlib and raw DEFLATE, both ways, into buffers you own or streamed; CRC-32 and Adler-32; `nish/net/http-compress` for `Accept-Encoding` and gzip responses |
| [`nish/net/url`](#nishneturl) | `urlQueryGet` and `urlDecode` for one value; `UrlPathSegments`, `UrlQuery` and `percentDecode` to read a request target in place, allocating nothing; `urlParse`, `urlResolve` and `urlOrigin` for a whole URL |
| [`nish/net/dns-message`](#nishnetdns-message) | `dnsBuildQuery` and `dnsParseReply`: one DNS question as bytes, and the A or AAAA addresses a reply gives it, following its CNAME chain, with every count and pointer bounded |
| [`nish/net/dns-config`](#nishnetdns-config) | `dnsParseResolvConf` and `dnsParseHosts`: `/etc/resolv.conf` and `/etc/hosts` read into fixed tables; `dnsHostsFind` and `dnsParseAddress` |
| [`nish/net/dns-resolver`](#nishnetdns-resolver) | `DnsResolver`: a DNS stub resolver with no I/O of its own, which says what to send and reads what came back; it builds for `wasm32` |
| [`nish/net/dns`](#nishnetdns) | `DnsClient`, the resolver on your own `pollWait` loop, and `resolveHost`, a blocking lookup for a CLI or start-up |

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

`codePointLength(text)` counts Unicode code points, which is what a length
limit on text a person typed usually means (JSON Schema's `minLength` and
`maxLength` count them). `.length` does not: it counts UTF-8 bytes, so
`"é".length` is `2` and `"😀".length` is `4`, where `codePointLength` answers
`1` for each. It answers the same when the program runs under Node, where
`.length` counts UTF-16 units instead, for well-formed text, except text
built from bytes: under Node, `String.fromBytes`, `String.fromCharCode` of a
byte and a `\u` escape that `nish/json` decodes give one unit per byte, so
such a string counts its UTF-8 bytes there.

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

Matching never backtracks, so a pattern cannot make one search slow:
`(a+)+$` against a long run of `a`s takes as long as `a+$`. The price is
that backreferences (`\1`) and lookaround (`(?=…)`, `(?<=…)`) are refused
when the pattern is compiled. So is a pattern past the engine's limits: a
repeat count over 1,000, more than 1,024 capturing groups, more than 10,000
ranges in one class, or more than 100,000 instructions once its repeats are
written out. Offsets are UTF-8 bytes, as `s.length` is, and `\w`, `\d` and
`\b` are ASCII, as they are in JavaScript. The `i` flag folds only ASCII
letters, where JavaScript's folds every letter: `é` does not match `É`.

Finding every match is one search per match, so `findAll`, `count`,
`replaceAll` and `split` are quadratic when a long branch is preferred to a
short one that wins: `<[^>]*>|<` over a run of `<`s reads the rest of the
text at each. Bound the long branch (`<[^<>]*>|<`) or put the short one
first.

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
value costs the document about 46 bytes (66 with ranges, below), kept for as long as the document is,
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

**Where a value came from.** `parseRanged(bytes, off, len)` and
`parseTextRanged(text)` parse as `parse` and `parseText` do, and also record
where each value and each key was in the input, so an error
about a value can point at its line and column. `start(v)` and `end(v)` are
the byte offsets of the value's first byte and one past its last, and
`keyStart(o, i)` and `keyEnd(o, i)` the same for the key of member `i` of
object `o`; a string's and a key's range includes its quotes. The offsets are
into the array you gave `parseRanged`, or into the string `parseTextRanged`
read. Under Node, where `parseTextRanged` reads one byte per UTF-16 code unit, its offsets
count code units, so past the first non-ASCII character they differ from a
native build's, which count UTF-8 bytes.

```ts nish:ok
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDocument } from "nish/json-value";

export const main = (): i32 => {
  const doc = new JsonDocument(new JsonLimits());
  const text = `{"port": "eighty"}`;
  const root = doc.parseTextRanged(text);
  const port = doc.get(root, "port");
  console.log(`${doc.start(port)} ${doc.end(port)}`); // 9 17
  console.log(text.substring(doc.keyStart(root, 0), doc.keyEnd(root, 0))); // "port"
  return 0;
};
```

Ranges cost each value about 20 bytes more, so `parse` and `parseText` keep
none, and after them all four answer `-1`. A value you build with
the `new*` methods, and a key `set` adds, has no range either until you give
it one with `setRange(v, start, end)` or `setKeyRange(o, i, start, end)`, which
is how a loader for another format that builds the tree itself can point back
into its own text. `set` over an existing key keeps the key's range. Every parse and `clear()`
drops the ranges the document held.

The two entry points are separate loops so that a program calling only
`parse` runs the loop it always did. A program that links both, though, can
see `parse` itself run slower, up to 16% on a number-heavy document, because
the second loop changes how the first is laid out. A validator that wants
ranges for its error messages calls `parseRanged` and nothing else, and one
that does not calls `parse`; it should not mix the two to save the ranges'
cost on the documents that turn out valid.

Objects keep their members in order, and `get` looks a key up by scanning
them, so walk a large object once with `keyAt` and `at` rather than calling
`get` for each of many keys. Under Node, where a string is UTF-16,
`parseText` and the builders take one byte per character, so non-ASCII text
differs from the native build there; `parse` over bytes reads the same both
ways. Its security record is
[docs/security/json.md](../../security/json.md).

## `nish/json-number`

A JSON number is text, and some texts say more than a double holds:
`9007199254740993` and `9007199254740992` are one `f64`, and so are `0.1` and
`0.10000000000000001`. JSON Schema's `minimum`, `maximum` and `multipleOf`
compare values, not doubles, and `0.3` is a multiple of `0.1` though
`0.3 / 0.1` is `2.9999999999999996`. This module reads the decimal digits
themselves and never makes an `f64`.

```ts nish:ok
import { JSON_NUMBER_ERR_GAP, jsonNumberCanonical, jsonNumberCompare, jsonNumberMultipleOf } from "nish/json-number";

export const main = (): i32 => {
  console.log(`${jsonNumberCompare("9007199254740993", "9007199254740992")}`); // 1
  console.log(`${jsonNumberCompare("1.0", "1e0")}`); // 0
  console.log(`${jsonNumberMultipleOf("0.3", "0.1")}`); // 1
  console.log(`${jsonNumberMultipleOf("4.5", "2")}`); // 0
  console.log(jsonNumberCanonical("0.0150e3")); // 15e0
  console.log(jsonNumberCanonical("1.50")); // 15e-1
  console.log(`${jsonNumberMultipleOf("1e1000000000", "7") === JSON_NUMBER_ERR_GAP}`); // true
  return 0;
};
```

`jsonNumberCompare(a, b)` answers `-1`, `0` or `1`, and
`jsonNumberMultipleOf(value, divisor)` answers `1` or `0` (signs do not
matter, and zero is a multiple of anything). `jsonNumberCanonical(text)` is
the shortest spelling of the value, digits without trailing zeros and an
exponent (`15e-1` for `1.50`, `15e0` for `0.0150e3`, `0` for `-0`), so two texts are equal values
exactly when their canonical texts are the same string.

Each of them refuses rather than guessing, `jsonNumberCompare` and
`jsonNumberMultipleOf` with a negative code and `jsonNumberCanonical` with
`""`, and the first argument's refusal comes first:

- `JSON_NUMBER_ERR_SYNTAX`: the text is not one JSON number (`01`, `1.`, `+1`,
  a blank around it).
- `JSON_NUMBER_ERR_EXPONENT`: the exponent is past `JSON_NUMBER_MAX_EXPONENT`,
  10^15 either way, and a digit is not zero (`0e9999999999999999` is zero).
- `JSON_NUMBER_ERR_DIVISOR`: `multipleOf` by zero.
- `JSON_NUMBER_ERR_GAP`: `multipleOf` would take more than
  `JSON_NUMBER_MAX_STEPS` (2^20) digit steps. `1e1000000000` is twelve bytes
  of input and a billion digits of dividend, so the bound is what keeps a
  hostile schema or document from costing a billion steps.

A comparison costs the digits of the two texts; `multipleOf` costs the
value's digits from its first to the divisor's last place, times the
divisor's digits past eighteen, and never more than the bound.

## `nish/json-equal`

JSON Schema's `const`, `enum` and `uniqueItems` ask whether two JSON values
are equal, and its rule is not JavaScript's: numbers are equal by value, so
`1` and `1.0` are, objects are equal whatever the order of their members, and
`true` is not `1`.

```ts nish:ok
import { jsonEqual, jsonEqualCanonical, jsonEqualFirstDuplicate } from "nish/json-equal";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDocument } from "nish/json-value";

export const main = (): i32 => {
  const da = new JsonDocument(new JsonLimits());
  const db = new JsonDocument(new JsonLimits());
  const a = da.parseText(`{"id":1,"tags":["x"]}`);
  const b = db.parseText(`{"tags":["x"],"id":1.0}`);
  console.log(`${jsonEqual(da, a, db, b)}`); // true
  console.log(jsonEqualCanonical(da, a)); // o2:2:idn1e0;4:tagsa1:s1:x
  const list = da.parseText(`[1, true, "1", 1e0]`);
  console.log(`${jsonEqualFirstDuplicate(da, list)}`); // 3
  return 0;
};
```

`jsonEqual(da, a, db, b)` compares a value of one document with a value of
another, or of the same one (a document's handles last until it parses again, so two parsed texts take two documents); a handle that names no value is equal to
nothing. `jsonEqualFirstDuplicate(doc, array)` is the position of the first
element equal to an earlier one, `-1` when there is none, so `uniqueItems`
holds exactly when it is `-1`.

`jsonEqualCanonical` is a text that is the same for exactly the values
`jsonEqual` calls equal, which makes it a key for a `Map` or `Set` of JSON
values; it is not JSON. `jsonEqualHash` is a 64-bit FNV-1a hash of it. The
hash is not keyed, so anyone can make values that collide: use the canonical
text, not the hash, as a table's key when the values come from someone else.

A number past the exponent bound of `nish/json-number` is equal only to the
same text. None of the functions recurses, so a document as deep as its
limits allow compares. `jsonEqual` costs the values' sizes, plus sorting each
pair of objects' keys; the canonical text and the first duplicate cost the
canonical text's length.

## `nish/json-pointer`

A JSON Pointer (RFC 6901) names one value inside a document: `/tags/0` is the
first element of the member `tags`. A token is a member's key, with `~1` for a
`/` in it and `~0` for a `~`, or an array index written without a leading
zero.

```ts nish:ok
import { JSON_POINTER_NONE, isRelativeJsonPointer, jsonPointerEscape, jsonPointerParse, jsonPointerResolve } from "nish/json-pointer";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDocument } from "nish/json-value";

export const main = (): i32 => {
  const doc = new JsonDocument(new JsonLimits());
  const root = doc.parseText(`{"a/b":[10,20],"tags":["tea"]}`);
  console.log(`${doc.i64(jsonPointerResolve(doc, root, "/a~1b/1"))}`); // 20
  console.log(`${jsonPointerResolve(doc, root, "/tags/1") === JSON_POINTER_NONE}`); // true
  console.log(`/${jsonPointerEscape("a/b")}/0`); // /a~1b/0
  const tokens = jsonPointerParse("/a~1b//~0");
  console.log(tokens === null ? "refused" : tokens.join("|")); // a/b||~
  console.log(`${isRelativeJsonPointer("1/tags")}`); // true
  return 0;
};
```

`jsonPointerResolve(doc, root, pointer)` answers the value, `root` itself for
the empty pointer, `JSON_POINTER_NONE` when the pointer names nothing there
(a missing key, an index past the end, `-`, a token on a number) and
`JSON_POINTER_ERR_SYNTAX` when the text is not a pointer. `jsonPointerParse`
answers the decoded tokens, or `null`; `jsonPointerEscape` writes one token.
The pointer is the plain string, not a URI fragment: `#/a` is not one.

`isJsonPointer` and `isRelativeJsonPointer` check the form JSON Schema's
`json-pointer` and `relative-json-pointer` formats name, reading the text once
and allocating nothing. A relative pointer (`0#`, `1/tags`) is checked but not
resolved: what it is relative to is the validator's to know. A resolve costs
the pointer's length, and each member step the size of the object it looks
in.

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

**Merge keys.** A path follows `<<` merge keys (a plain `<<`, untagged or
`!!merge`): a key a map does not hold is looked up in the maps its `<<` keys
name — a map, an alias to one, or a sequence of those or an alias to one — in
the order they are written. The map's own keys win,
then the first merged map that has the key, and the node and pair found are
the ones inside that map, so a message points at the line that set it. A
recursive alias ends the search. A `<<` whose value names no map is an error,
`BAD_MERGE`. The nodes themselves are not changed: a map still holds the pairs
it was written with.

```ts nish:ok
import { parseYaml, pathNode, pathPair } from "nish/yaml";
import { YamlLineIndex } from "nish/yaml-lines";

export const main = (): i32 => {
  const text = "defaults: &defaults\n  adapter: postgres\n  host: localhost\n\ndevelopment:\n  <<: *defaults\n  host: dev.local\n";
  const stream = parseYaml(text);
  const root = stream.documentRoot(0);
  const lines = new YamlLineIndex(text);
  const adapter = pathNode(stream, root, ["development", "adapter"]);
  console.log(`${stream.text(adapter)} at ${lines.line(stream.start(adapter))}:${lines.column(stream.start(adapter))}`); // postgres at 2:12
  console.log(stream.text(pathNode(stream, root, ["development", "host"]))); // dev.local
  const pair = pathPair(stream, root, ["development", "adapter"]);
  return pair === pathPair(stream, root, ["defaults", "adapter"]) ? 0 : 1;
};
```

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
`parseYamlWith` panics on it), `uniqueKeys`, `merge` (whether a plain `<<`
key is a merge key: exempt from the duplicate check, checked for `BAD_MERGE`
and followed by paths; on by default), `keepComments` (keep every comment's
range, for `commentCount` and `comment`) and `firstDocumentOnly` (warn
`MULTIPLE_DOCUMENTS` and stop after the first). Tabs are never indentation, as
YAML says.

### Writing YAML

`stringifyYaml(doc, v)` from `nish/yaml-write` writes a `nish/json-value`
value as YAML that `parseYaml` reads back as the same tree: block style with a
two-space indent, `{}` and `[]` for an empty object and array, `null`, `true`
and `false` plain, a number as its JSON text, and a trailing newline. It
answers `""` for a handle that names no value and for a tree deeper than
`JSON_WRITER_MAX_DEPTH`, the limit `stringify` keeps.

```ts nish:ok
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDocument } from "nish/json-value";
import { parseYaml } from "nish/yaml";
import { stringifyYaml } from "nish/yaml-write";

export const main = (): i32 => {
  const doc = new JsonDocument(new JsonLimits());
  const root = doc.parseText(`{"name":"nish","version":"0.24","tags":["yaml","no"],"empty":{}}`);
  const yaml = stringifyYaml(doc, root);
  console.log(yaml);
  return parseYaml(yaml).errorCount();
};
```

It prints:

```yaml
name: nish
version: "0.24"
tags:
  - yaml
  - "no"
empty: {}
```

**Which strings are quoted.** A string is written plain unless YAML would read
it as something else, and then double-quoted: an empty string; `~` and the
words `null`, `true`, `false`, `yes`, `no`, `on`, `off`, `y` and `n` in any
case; anything that starts like a number (an optional sign, then a digit or
`.` and a digit) or is `.inf` or `.nan`, signed or not, in any case; a string
that starts with an indicator (`@`, `` ` ``, `\`, `*`, `&`, `!`, `|`, `>`,
`%`, `'`, `"`, `#`, `,`, `[`, `]`, `{`, `}`), with `-`, `?` or `:` followed
by a space or nothing, or with `---` or `...`; a string with a leading or
trailing space, a trailing `:`, or a `: ` or ` #` inside; a key `<<`, which
would be a merge key; and a string holding a control character, a line break,
U+2028, U+2029, U+FEFF, U+FFFE or U+FFFF, which are escaped. A key longer than
1024 bytes as written is an explicit key, `? key` and then `: value`.

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
Node. `nextInt(lo, hi)` answers a whole number from `lo` to `hi`, both
included, each with equal chance; `nextI32()` answers the next 32 bits as an
`i32`, and `nextF64()` a number in [0, 1). Every seed works, 0 included, and nearby seeds answer
unrelated sequences, so a task or a parallel body can seed its own from its
index. It is not for keys or passwords: those come from
`crypto.getRandomValues`.

```ts nish:ok
import { Rng } from "nish/random";

export const main = (): i32 => {
  const r = new Rng(42);
  const rolls: string[] = [];
  for (let i: i32 = 0; i < 5; i++) {
    rolls.push(`${r.nextInt(1, 6)}`);
  }
  console.log(rolls.join(" ")); // 1 5 6 6 4, every run
  return 0;
};
```

`nextInt(6, 1)`, with `lo` above `hi`, stops the program with
`Rng.nextInt: lo is greater than hi`.

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

## `nish/cli`

`nish/cli` builds a command-line tool's `--help`: a header, usage lines,
sections of flags with their placeholders and descriptions lined up in
columns, and notes. It is what `nish --help` itself is built with.

```ts nish:ok
import { HelpMenu, agentDriven, styleFor } from "nish/cli";

export const main = (): i32 => {
  const menu = new HelpMenu(styleFor(1, agentDriven()), "greet", 24, 30);
  menu.header("1.2.0", "say hello");
  menu.usage("<name> [flags]", "greet someone");
  menu.section("Flags");
  menu.row("--shout", "", "in capitals");
  menu.row("--times", "<n>", "say it n times");
  console.log(menu.text());
  return 0;
};
```

Piped or redirected, that prints:

```text
greet 1.2.0  say hello

usage: greet <name> [flags]   greet someone

Flags
  --shout               in capitals
  --times <n>           say it n times
```

**A `HelpMenu`** is made with a `Style`, the program's name, the column a
row's description starts at and the column a usage line's starts at. Add
lines in order: `header(version, summary)`, `usage(shape, description)` (the
first one says `usage:`, the rest line up under it), `section(title)`,
`row(flag, placeholder, description)`, `note(text)` for a line of prose and
`value(text)` for a path or value to copy. `title(version, summary)` is
`header` without its blank line after, and `line(text)` adds a line exactly
as given, so a menu can put a rule or a banner under its title (paint it with
the same `Style`, and keep it to the menu's width). An empty placeholder or
description is left out. A flag too long for its column keeps two spaces
before its description. `text()` answers the whole menu. Columns are counted
in bytes, so they line up for ASCII text.

**The colours are your terminal's own.** A `Style` paints headings in bold
magenta, flags in cyan, placeholders in yellow and descriptions faint, using
the basic ANSI colours your terminal theme defines, never a fixed shade, so
the menu takes on whatever palette the reader chose. A terminal that declares
no colours (`tput colors` below 8, as for `TERM=vt100`) gets the same
structure in bold and underline instead; forced colour is always the
theme's.

**`styleFor(fd, agent)`** decides for descriptor `fd` (1 for stdout, 2 for
stderr) whether to paint at all, the same way `nish --help` does: colour on a
terminal, plain text in a pipe or a file, `NO_COLOR` always off,
`FORCE_COLOR` or `CLICOLOR_FORCE` on even when piped, and `TERM=dumb` or
`CLICOLOR=0` off ([the CLI page](cli.md#colour-and-when-an-agent-runs-nish)
has the full table). `agentDriven()` says whether a coding agent is running
the program: `NISH_AGENT` decides when it is set, a no (`0`, `false`, `no`,
`off`) for no and anything else for yes, and otherwise `CLAUDECODE` or
`GEMINI_CLI` set to anything but empty or a no means yes. With `agent` true
`styleFor` is always plain: the escapes would only cost the agent tokens.

`HelpMenu` and `Style` reach no
[capability](../../LANGUAGE.md#capabilities). `styleFor` and `agentDriven`
reach `env`, and `styleFor` reaches `process.spawn` too: unless colour is
forced or refused first, it asks a shell whether the descriptor is a terminal
and how many colours it has. To keep a
program free of both, make the style yourself: `new Style(on, colour)`, where
`on` turns painting on and `colour` picks the theme's colours over the
monochrome failsafe.

### Colours

A `Style` also paints any text, not only a menu, with the same policy: plain
when `on` is false, and the theme's colours only when `colour` is true.

| group | methods | under the failsafe |
| --- | --- | --- |
| foreground | `black` `red` `green` `yellow` `blue` `magenta` `cyan` `white`, and `brightBlack` (gray) through `brightWhite` | plain |
| background | `bgBlack` through `bgWhite`, and `bgBrightBlack` through `bgBrightWhite` | plain |
| attributes | `bold` `faint` `italic` `underline` `inverse` `strikethrough` | painted |
| raw | `sgr(text, codes)`, any SGR parameter list: `"1;31"`, `"38;5;208"`, `"38;2;255;128;0"` | plain |

Each answers `text` between its escape and a reset, or `text` unchanged when
it paints nothing. The sixteen colours are the ones your terminal theme
redefines; a 256-colour or truecolor tone ignores the theme, so it goes
through `sgr`, where you ask for it on purpose. The `SGR_` constants
(`SGR_RED`, `SGR_BRIGHT_BLACK`, `SGR_BG_BLUE`, `SGR_BOLD`, ...) spell the
codes, so `` s.sgr(text, `${SGR_BOLD};${SGR_RED}`) `` combines them without
numbers. Nesting works too, but every painter ends with a full reset, so
text after an inner painted part loses the outer marks: join the codes for
anything longer than one part.

**The menu's roles can be recoloured.** Each role a `HelpMenu` paints keeps
two SGR lists, one for the theme and one for the failsafe:
`headingThemed`/`headingMono`, `nameThemed`/`nameMono`,
`flagThemed`/`flagMono`, `metaThemed`/`metaMono` and `dimThemed`/`dimMono`.
Set a pair before you build the menu; an empty list leaves that role plain.
The defaults are the ones described above.

```ts nish:ok
import { HelpMenu, SGR_BOLD, SGR_GREEN, agentDriven, styleFor } from "nish/cli";

export const main = (): i32 => {
  const style = styleFor(1, agentDriven());
  style.flagThemed = `${SGR_BOLD};${SGR_GREEN}`;
  const menu = new HelpMenu(style, "greet", 24, 30);
  menu.header("1.2.0", "say hello");
  menu.row("--shout", "", "in capitals");
  console.log(menu.text());
  console.log(`${style.red("error:")} ${style.bold("no name given")}`);
  return 0;
};
```

### Parsing flags

`nish/cli-flags` reads a command line against a table of flags you declare
once. The same table writes the help rows, so the two cannot drift apart.

```ts nish:ok
import { HelpMenu, Style } from "nish/cli";
import { FlagTable } from "nish/cli-flags";

export const main = (): i32 => {
  const flags = new FlagTable("git-lite");
  flags.command("remote add", "<name> <url>", "add a remote");
  flags.string("output", "<file>", "where to write");
  flags.number("jobs", "<n>", "parallel jobs");
  flags.boolean("verbose", "say more");
  flags.repeatable("include", "<dir>", "search here too");
  const got = flags.parseFrom(process.argv, 1);
  if (!got.ok) {
    got.exitUsage();
  }
  if (got.command === "") {
    const menu = new HelpMenu(new Style(false, true), "git-lite", 28, 30);
    menu.usage("<command> [flags]", "a small git");
    flags.writeHelp(menu);
    console.log(menu.text());
    return 0;
  }
  console.log(`${got.command}: ${got.positionals.join(" ")} jobs ${got.num("jobs")}`);
  return 0;
};
```

`git-lite --jobs 4 remote add origin https://example.org --include a
--include b` runs `remote add` with positionals `origin` and the URL, `jobs`
4 and `include` `a` then `b`. With no arguments it prints:

```text
usage: git-lite <command> [flags]  a small git

Commands
  remote add <name> <url>   add a remote

Flags
  --output <file>           where to write
  --jobs <n>                parallel jobs
  --verbose                 say more
  --include <dir>           search here too
```

**Declare** each flag by its name without the dashes, a placeholder for the
help and a description: `string`, `number` and `repeatable` take a value,
`boolean` does not. `command(path, shape, description)` declares a
subcommand of one or more words, with what follows it in the help. A name
declared twice panics, because the table is your program's own text, and so
does one no command line could match: a flag name with a leading `-`, an `=`
or whitespace, a command word with a leading `-`, or a flag `no-x` beside a
boolean `x`, whose `--no-x` it would be.
`parseFrom(process.argv, 1)` reads the command line after the program's own
path, and `parse(args)` reads every string in `args`.

**The grammar** is the long-option one most tools share, without short
options:

- `--name value` and `--name=value` give a value; `--name=` gives the empty
  string. The next argument is the value whatever it looks like, so
  `--jobs -1` is minus one and `--output --` writes to a file named `--`.
- `--name` sets a boolean and `--no-name` clears it. A boolean takes no
  `=value`.
- A repeatable flag keeps every value in the order given. Any other flag
  given twice is an error.
- `--` ends the flags: everything after it is a positional, even `--verbose`
  and a second `--`. A positional that starts with `-`, such as a negative
  number, needs a `--` before it, or it reads as a flag.
  A lone `-` is an ordinary word, as for a tool that reads `-` as stdin.
- The words that are not flags may come before, between or after them. The
  leading ones choose the command, the longest declared path they spell, and
  the rest are `positionals`. A flag belongs to the whole table, not to one
  command: check `got.command` to refuse one where it does not apply.

**Reading the answer.** `got.command` is the matched path, or `""` when no
words were given. `str`, `num`, `bool` and `all` read a flag of that kind by
name; a flag that was not given reads as `""`, `0`, `false` or no values,
and `has(name)` tells that apart from one given as such. A number is a
finite `f64` written in decimal: an optional sign, digits with an optional
fraction, and an optional exponent (`-2.5`, `.5`, `1e3`), in ASCII. Hex and
binary, `Infinity`, an empty value, spaces round it, and a value too large
for an `f64` (`1e999`) are refused, the same natively as under Node. Asking for a name the table does not declare, or
as the wrong kind, panics.

**A usage error is data.** `parse` stops at the first one: an unknown flag
(any `-x` with one dash is one), a flag missing its value, a number that is
not one, a flag given twice, a value on a boolean, or words that spell no
declared command once any is declared. `got.ok` is false, and `got.code`
(a `FLAG_ERR_*` constant), `got.message` and `got.argument` say what went
wrong, so a program can word it its own way. `got.exitUsage()` is the usual
ending: it writes

```text
git-lite: --jobs needs a number, not "four"
usage: git-lite remote add <name> <url> [flags]
```

to stderr and exits 2, the status `nish` itself uses for a usage error.
`usageError()` answers those two lines without printing them. `exitUsage`
reaches `exit`; the rest of the module reaches no
[capability](../../LANGUAGE.md#capabilities).

## `nish/cli-args`

`nish/cli-args` parses the command line of a tool with many commands
(`api users keys list 42 --limit 5`): you declare the tree once, `parse`
walks the arguments, and the answer is the id of the command they reached
and every flag's value with where it came from. `finish` then prints the
help, the version or an error, the way [`nish/cli`](#nishcli) lays help out.

```ts nish:ok
import { Cli, ROOT, finish } from "nish/cli-args";
import { agentDriven, styleFor } from "nish/cli";

const LIST: i32 = 1;

export const main = (): i32 => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API");
  const raw = cli.globalFlag("-r, --raw-output", "print JSON as it arrives");
  const users = cli.group(ROOT, "users", "Manage users");
  const list = cli.command(users, "list", LIST, "List users");
  const limit = cli.flag(list, "-l, --limit <n>", "at most n users");
  cli.defaultValue(limit, "20");

  const r = cli.parse(process.argv, 1);
  const agent = agentDriven();
  finish(r, styleFor(1, agent), styleFor(2, agent));
  if (r.id === LIST) {
    console.log(`listing ${r.value(limit) ?? ""} users, raw: ${r.flag(raw)}`);
  }
  return 0;
};
```

`api users list -l 5 -r` prints `listing 5 users, raw: true`; `api users`
says `api users: missing command (one of: list)` on standard error and
exits 2.

**A builder, not a table.** A command cannot carry its handler, because Nish
has no function values; instead every declaration answers a handle, an
`i32`, and the program reads a value by the handle it declared rather than
by a name a typo could miss. Each command gets an id you choose, which a
`switch` on `r.id` dispatches on. A mistake in the declarations — a flag
declared twice in one scope, a bad spec, a required argument after an
optional one, a command id used twice or negative, a required flag on a
command that holds commands or with a default, a flag a `--no-` negation
would shadow — panics at the call that made it, naming it. A module constant
can only be a number, a boolean or a string, so build the tree in `main` or
in a class's constructor.

**Declaring.** `new Cli(name, version, description)` is the root, `ROOT`.
`group(parent, name, description)` adds a command that only holds commands;
`command(parent, name, id, description)` adds one the program runs.
`alias(handle, name)` gives either a second name. `flag(cmd, spec,
description)` declares a flag of one command; `globalFlag(spec,
description)` one every command accepts, before, between or after the
verbs. `argument(cmd, spec, description)` declares the next positional
argument. `defaultValue`, `required`, `repeatable` and `negatable` refine a
flag, and `epilog(handle, text)` ends a command's help with a paragraph.
`-h`/`--help` (anywhere before `--`), `-v`/`--version` (at the root) and the word `help`
as the first command are built in; `help users kyes`, naming no command, is
the unknown-command error rather than help.

| Spec | Means |
| --- | --- |
| `--all` | a boolean, given as `--all` |
| `-a, --all` | the same, also as `-a`; short flags cluster (`-ar`) |
| `--limit <n>` | takes a value: `--limit 5`, `--limit=5`, `-l5`, `-l=5`, `-l 5`; `--limit=` and `-l=` give `""` |
| `--format [fmt]` | the value is optional: `--format json`; given none, `""` |
| `--no-color` | on by default; `--no-color` turns it off, `--color` back on; a short (`-C, --no-color`) turns it off |
| `<id>` / `[id]` | a required / optional argument |
| `<file...>` / `[file...]` | every argument left; only the last one |

**Reading the answer.** `parse(argv, start)` reads `argv` from index
`start` (1 for `process.argv`, past the program) and never fails: it answers
a `ParseResult`.

| Member | Answers |
| --- | --- |
| `kind` | `PARSE_OK`, `PARSE_HELP`, `PARSE_VERSION` or `PARSE_ERROR` |
| `id`, `command`, `path` | the reached command's id (-1 for a group), its handle and its command line |
| `flag(f)` | a boolean's value; for a flag with a value, whether it was given |
| `value(f)` | the last value given, else the default, else `null` |
| `values(f)` | every value of a repeatable flag, in order |
| `source(f)` | `SOURCE_ARGV`, `SOURCE_DEFAULT` or `SOURCE_UNSET` |
| `positional(a)`, `positionals(a)` | an argument's value; every value from it on |
| `rest()` | the arguments after `--`, which are also positionals |
| `message`, `exitCode` | the error or version line; 2 for an error, else 0 |
| `hint`, `errorPath` | for an error, the pointer to the help and the command it names |
| `help(style)` | the help of the reached command |

`source` tells a value the user typed from a default, which is what a rule
the tree cannot state reads, such as two flags that may not be given
together. `finish(r, outStyle, errStyle)` prints help or the version on
standard output and exits 0, prints an error and a pointer to the help on
standard error and exits 2, and returns for `PARSE_OK`. The error line is
printed plain; `errStyle` paints only `<path> --help` in the pointer:

```text
api users: unknown command 'kyes' (did you mean 'keys'?)
Run 'api users --help' for usage.
```

The first error wins and names the command it was found at; after a flag
error the walk still goes down the command words, so a later `-h` answers
the deepest command, and only an unknown command stops it. A misspelt
command or long flag gets the nearest declared one within two edits, or a
third of its length if that is more (a swap of two letters is one edit), so
`--lmt` finds `--limit`; an unknown short flag gets no guess. Help lists a
command's arguments, its own flags and the global ones, descriptions lined
up at the widest flag, up to column 32. It appends a default as
`(default: …)`, and `(required)` and `(repeatable)` to the flags declared so,
so a description need not say it.

**What it costs and reaches.** Declaring builds no help text, and parsing
looks each argument up once in a map: on a tree of 500 commands with 8 flags
each, a parse takes about a microsecond. Help, guesses and error wording are
worked out only when they are printed. `parse` reaches no
[capability](../../LANGUAGE.md#capabilities); `finish` writes to standard
output or standard error and exits. Shell completion and man pages are not
generated yet, and nish's own command line does not use this module: `src/`
can only use what a released compiler ships, so it moves onto
`nish/cli-args` once a release carries it. The example under
`examples/api-cli/` is a whole client.

## `nish/term`

`nish/term` is for a program that draws the whole terminal, many times a
second: a game, a dashboard. It does no input or output of its own. A
`Screen` turns what you drew into the string that updates the terminal, and
you print it with `write`. A `KeyDecoder` turns the bytes you read into key
events. The terminal's size and the clock are numbers you pass in. Because
the module reaches no capability, a program that uses it builds under
`--deny` of all of them and prints the same bytes under Node. Reading the
keys, raw mode and the terminal's size come from
[`nish:term`](terminal.md).

To have all of it done for you — opening the terminal, asking it what it can
draw, drawing a framebuffer with kitty graphics, Sixel, half blocks or ASCII,
and slowing the frame rate when the link cannot keep up — use
`runTerminal` from `nish/term-io`, which [Terminal programs](terminal.md)
walks through. This section is the layer underneath, for a program that
wants its own loop.

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
to the terminal. A side is at most 4,096 cells and a screen at most 1,048,576,
with rows dropped to fit, so any size a terminal reports is safe to pass.

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
`poll(nowMs)` once the timeout is up to collect the `KEY_ESCAPE`. An `ESC [`
followed by more than 32 parameter bytes is no key, so the decoder gives the
ESC up as `KEY_ESCAPE` at once rather than holding what follows.

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

**Events.** `feed` knows keys only. `feedEvents(bytes, count, nowMs)` and
`pollEvents(nowMs)` read the same bytes as one stream of `TermEvent`s, which
is what a program that turns on the mouse, bracketed paste, focus reports or
the kitty keyboard protocol needs, and what `nish/term-io` hands `update`. An
event's `type` says which fields mean something:

| `type` | What it is | Its fields |
| --- | --- | --- |
| `EVENT_KEY` | a key, legacy, xterm's modified keys, modifyOtherKeys or the kitty keyboard protocol | `key` (a `KEY_` kind, including `KEY_F1`–`KEY_F12`, `KEY_HOME`, `KEY_END`, `KEY_PAGE_UP`, `KEY_PAGE_DOWN`, `KEY_INSERT`, `KEY_DELETE`), `code`, `modifiers`, `action`, `text` (kitty's associated text) |
| `EVENT_MOUSE` | an SGR mouse report (mode 1006, or 1016 in pixels) | `button` (`MOUSE_NONE`, `MOUSE_LEFT`, `MOUSE_MIDDLE`, `MOUSE_RIGHT`, `MOUSE_WHEEL_UP`, `MOUSE_WHEEL_DOWN`, `MOUSE_WHEEL_LEFT`, `MOUSE_WHEEL_RIGHT`, `MOUSE_BUTTON_8`), `action`, `modifiers`, the cell `x`, `y` and, under 1016, the pixel `px`, `py` (else -1) |
| `EVENT_PASTE` | everything between `ESC [ 200 ~` and `ESC [ 201 ~`, never typed as keys | `text` |
| `EVENT_FOCUS` | `ESC [ I` or `ESC [ O` (mode 1004) | `gained` |
| `EVENT_REPLY` | the terminal answering a query: DA, DSR, a cursor report, DECRPM, XTVERSION, DECRQSS, OSC, APC. Never a key | `introducer` (`[`, `P`, `_`, `]`, `^` or `X`), `prefix` (`?`, `>`, `=`, `<` or 0), `params`, `intermediate`, the final byte `reply`, `text` |
| `EVENT_RESIZE`, `EVENT_QUIT` | never decoded: the code that watches the size makes the first, `KeyState` the second | — |

`modifiers` is a sum of `MOD_SHIFT` (1), `MOD_ALT` (2), `MOD_CTRL` (4),
`MOD_SUPER` (8), `MOD_HYPER` (16) and `MOD_META` (32); `action` is
`ACTION_PRESS`, `ACTION_REPEAT`, `ACTION_RELEASE` or, for the mouse,
`ACTION_MOVE`. `ESC [ row ; col R` is both a cursor position report and F3
with modifiers, so a program that sends `ESC [ 6 n` adds 1 to the decoder's
`cprOutstanding` and the next `R` comes back as the reply.

Only the kitty keyboard protocol reports a key coming up. **A `KeyState`**
says which keys are held whatever the terminal sends:
`apply(events, nowMs)` answers the events with a release made up for a key
that has not repeated for `releaseGapMs` (100 by default) where the terminal
sends none, a held key's repeats marked `ACTION_REPEAT`, and Ctrl-C turned
into `EVENT_QUIT` while `quitOnCtrlC` is set; `tick(nowMs)` answers the
releases that fall due between reads, and `isDown(key, code)` whether a key
is held now. Made-up releases are only as good as the bytes arriving on
time, so `delivered(sentAtMs)` tells it that the answer to a query sent at
`sentAtMs` has come back: a key is then let go only once an answer sent
`releaseGapMs` after its last repeat is in, since a key still held would have
repeated ahead of it.

```ts nish:ok
import { EVENT_KEY, EVENT_REPLY, KeyDecoder } from "nish/term";

export const main = (): i32 => {
  const keys = new KeyDecoder(toF64(30));
  // `a`, then a DA1 answer: ESC [ ? 6 2 c
  const bytes: u8[] = [toU8(97), toU8(27), toU8(91), toU8(63), toU8(54), toU8(50), toU8(99)];
  const events = keys.feedEvents(bytes, toI32(bytes.length), toF64(0));
  const key = events[0];
  const reply = events[1];
  console.log(`${key.type === EVENT_KEY} ${key.code} ${reply.type === EVENT_REPLY} ${reply.params[0]}`); // true 97 true 62
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

## `nish/term-pixels`

`nish/term-pixels` is the part of [`nish/term-io`](terminal.md) that turns
pixels into terminal output. It is pure, with no capability and no I/O, so a
program that wants to write its own loop, or test what it draws, can use it
alone.

- **`Framebuffer(width, height)`** is a grid of `0xRRGGBB` pixels, black when
  made, with `set`, `get`, `fill`, `clear` and `resize`. A pixel set off the
  edge is not drawn. `scaleFramebuffer(src, divisor, dst)` shrinks one by a
  whole divisor.
- **`GRAPHICS_ASCII`, `GRAPHICS_HALFBLOCK`, `GRAPHICS_SIXEL` and
  `GRAPHICS_KITTY`** (0 to 3) name the backends, from worst to best, so a
  terminal's backend and a cap combine with `Math.min`.
- **`fitFramebuffer(fbW, fbH, cols, rows, cellW, cellH, backend)`** answers
  the `PixelRect` to draw in: the cells the picture covers, centred in a
  `cols × rows` area with the aspect ratio kept, and its size in the backend's
  pixels. A cell size of 0 means "unknown" and takes a usual one.
- **The four encoders** draw a framebuffer into a rect, sampling it
  nearest-neighbour; none of them clears the letterbox around it:
  - `kittyFrame(fb, rect, imageId, out)` writes kitty graphics commands into a
    `PixelBytes`. Each frame resends the same image id, which the terminal
    swaps in whole; `kittyDelete(imageId)` frees it at the end.
  - `sixelFrame(fb, rect, dither, out)` writes one Sixel image in a fixed
    palette of `SIXEL_REGISTERS` colours, ordered-dithered when `dither` is
    true.
  - `drawHalfBlocks(fb, canvas, rect)` draws onto a [`Canvas`](#nishterm), two
    pixels to a cell.
  - `drawAscii(fb, screen, rect, colors)` draws onto a `Screen`, one
    luminance character to a cell.

A `PixelBytes` keeps the kitty and Sixel encoders' output and working arrays,
grown once to the largest frame, so a program that keeps one encodes frame
after frame without allocating. `out.text()` is the bytes to write and
`out.reset()` empties it for the next frame.

```ts nish:ok
import { GRAPHICS_KITTY, Framebuffer, PixelBytes, fitFramebuffer, kittyFrame } from "nish/term-pixels";

export const main = (): i32 => {
  const fb = new Framebuffer(64, 32);
  fb.fill(0x203040);
  fb.set(10, 5, 0xffcc00);
  // A 64×32 picture in 40×20 cells of 10×20 pixels.
  const rect = fitFramebuffer(fb.width, fb.height, 40, 20, 10, 20, GRAPHICS_KITTY);
  console.log(`cells ${rect.col},${rect.row} ${rect.cols}x${rect.rows}, ${rect.width}x${rect.height} px`);
  // cells 0,5 40x10, 400x200 px: letterboxed top and bottom
  const out = new PixelBytes(0);
  kittyFrame(fb, rect, 1, out);
  console.log(`${out.length > 0}`); // true: out.text() is ready to write
  return 0;
};
```

## `nish/base64`

`nish/base64` writes standard base64 (RFC 4648 §4): the alphabet
`A-Z a-z 0-9 + /`, four characters for every three bytes and a short last
group filled out with `=`. It is what kitty's graphics protocol carries an
image in. `base64Encode(bytes)` answers a string;
`base64EncodeInto(src, off, len, dst, at)` writes the encoding of
`src[off..off+len)` into `dst` from `at`, allocating nothing, and answers the
index after the last character, for a program that builds its output in one
buffer. `base64EncodedLength(n)` is how many characters `n` bytes take, so the
buffer can be sized first. A range outside its array panics before anything
is written. The module only encodes; the URL-safe, unpadded decoder for
tokens and keys is `nish/crypto/base64url`.

```ts nish:ok
import { base64Encode, base64EncodeInto, base64EncodedLength } from "nish/base64";

export const main = (): i32 => {
  const bytes: u8[] = [toU8(110), toU8(105), toU8(115), toU8(104)]; // "nish"
  console.log(base64Encode(bytes)); // bmlzaA==
  const out: u8[] = new Array<u8>(base64EncodedLength(3));
  const end = base64EncodeInto(bytes, 0, 3, out, 0);
  console.log(`${end} ${out[3]}`); // 4 122, the "z" of "bmlz"
  return 0;
};
```

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

### Runs and copies

A parser spends its time skipping: the blanks between tokens, the digits of a
number, the plain text inside a string; a writer skips the bytes it can copy
without an escape. Four functions answer where such a
run ends — the first index in `[from, to)` whose byte is not in the class, or
`to` if every byte is:

| Function | Skips |
| --- | --- |
| `skipBlank(b, from, to)` | JSON's blanks: space, tab, newline, carriage return |
| `skipDigits(b, from, to)` | the ASCII digits `0` to `9` |
| `skipJsonText(b, from, to)` | what a JSON string holds as itself: printable ASCII other than `"` and `\`, and well-formed UTF-8 |
| `skipJsonPlain(b, from, to)` | what a JSON writer copies as it is: every byte from 0x20 up other than `"` and `\`, with no UTF-8 check |

`copyBytes(dst, at, src, from, count)` copies `count` bytes of `src` from
`from` into `dst` at `at`. The two arrays may be the same one, and the ranges
may overlap.

```ts nish:ok
import { copyBytes, skipBlank, skipDigits } from "nish/bytes";

export const main = (): i32 => {
  const text: u8[] = [32, 10, 52, 50, 44]; // " \n42,"
  const start = skipBlank(text, 0, 5);
  const end = skipDigits(text, start, 5);
  console.log(`${start} ${end}`); // 2 4
  const digits: u8[] = [0, 0];
  copyBytes(digits, 0, text, start, end - start);
  console.log(`${digits[0]} ${digits[1]}`); // 52 50
  return 0;
};
```

The runs never panic: `to` is clamped to the array and `from` to `to`, so a
range past the end answers the end. `copyBytes` panics with
`copyBytes: the range lies outside an array` if either window does not fit,
before it writes anything. `skipJsonText` stops at a quote, a backslash, a
control byte or the first byte of a malformed UTF-8 sequence — the byte your
decoder has to look at next. `skipJsonPlain` stops at a quote, a backslash or a
control byte — the byte your writer has to escape.

Natively each run reads 16 or 32 bytes at a time and the copy is one block
move; under Node they are plain loops with the same answers. The runs take
longer the longer the run is, so they are for text, never for secret data.

## `nish/sqlite`

A SQLite database in a file or in memory: `openDatabase` for a `Database`,
`exec` and `prepare` for a `Statement` you bind, step and reset as often as you
like, and every failure a `Result`. SQLite itself is compiled into your
program, so there is nothing to install. It has a page of its own,
[SQLite](sqlite.md).

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
| `nish/crypto/hmac` | `hmacSha256`, `hmacSha384`, `hmacSha512`, their streaming classes, and `hmacSha256Verify` and its siblings, which compare in constant time; and `pbkdf2HmacSha256(password, salt, iterations, dkLen)`, PBKDF2 (RFC 8018), which takes the password as a `Secret<u8[]>`, answers the key as one, and answers `null` for fewer than one iteration or a `dkLen` below one |
| `nish/crypto/hkdf` | `hkdfExtractSha256`, `hkdfExpandSha256` and their SHA-384 forms; TLS 1.3's `hkdfExpandLabelSha256`; and a `Secret` form of each (`hkdfExtractSha256Secret`, `hkdfExpandLabelSha256Secret`, …), which takes the key as a `Secret<u8[]>`, answers one, and wipes what it derives on the way; and `hkdfExpandLabelSha256Held(dst, prk, label, context)` and its SHA-384 form, which derive into a `Secret` you already hold, as many bytes as it holds, in place — `dst` may be `prk`, a ratchet |
| `nish/crypto/ct` | `timingSafeEqual(a, b)`, a comparison that reads every byte |
| `nish/crypto/bcrypt` | `bcryptHash(password, salt, cost)` and `bcryptVerify(password, hash)`, and `bcryptHash4`/`bcryptVerify4` for up to four at once: bcrypt password hashes that other implementations read, with the password a `Secret<u8[]>`; see [Password hashing](password-hashing.md) |
| `nish/crypto/base64url` | `base64urlEncode` and a strict `base64urlDecode`, unpadded; `base64StdPadEncode` and a strict `base64StdPadDecode`, padded, in the standard alphabet, constant-time (`nish/base64` encodes the same alphabet for pixels, without the constant-time guarantee) |
| `nish/crypto/chacha20poly1305` | `chacha20Poly1305Seal` and `chacha20Poly1305Open` |
| `nish/crypto/aes` | `aesKey` for AES-128 and AES-256, `aesGcmSeal` and `aesGcmOpen` |
| `nish/crypto/x25519` | X25519 key exchange |
| `nish/crypto/ed25519` | Ed25519 signatures (RFC 8032): `ed25519PublicKey(seed)`, `ed25519Sign(seed, msg)` and `ed25519Verify(pub, msg, sig)`; the seed is a 32-byte `Secret<u8[]>`, and a message longer than 2^31 − 1 bytes panics; verification does not refuse a public key of small order |
| `nish/crypto/p256` | P-256 ECDSA signing and verification |
| `nish/crypto/p384` | P-384 ECDSA verification |
| `nish/crypto/rsa` | RSA signature verification, PKCS#1 v1.5 and PSS over SHA-256/384/512, under a PKCS#1 public key: `rsaParsePublicKey`, `rsaVerifyPkcs1v15`, `rsaVerifyPss` |
| `nish/crypto/x509` | DER and PEM, X.509 certificates read with their signature algorithm, key type and v3 extensions, and self-signed P-256 certificates |
| `nish/crypto/x509-random` | a random P-256 key and certificate serial for `x509`; native only, so a program that imports it does not build for WebAssembly |
| `nish/crypto/pki-roots` | `pkiLoadSystemRoots()`, the root certificates to trust, parsed: those `SSL_CERT_FILE` and `SSL_CERT_DIR` name when either is set, with no fallback, and otherwise the first system bundle (`pkiSystemBundles()`) and `/etc/ssl/certs`. A block or file it cannot use is counted in `skipped`, never fatal, and only regular files are read; on macOS it reads `/etc/ssl/cert.pem`, not the Keychain, so roots and trust settings added there are missed. Native only |
| `nish/crypto/pki` | `pkiVerifyServer(chain, hostname, nowMs, store)`, whether a TLS server's chain leads to a root of `pkiTrustStore(roots)` and names the host, as a `PkiResult` of a `code` (`PKI_OK` or a `PKI_ERR_` reason, `pkiReason(code)` its sentence) and the `path`. Checks signatures, validity, CA and path-length rules, key usages, name constraints and the hostname, never the common name; revocation is not checked. [Verifying TLS certificates](./tls-certificates.md) |
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

A password-derived key is a `Secret` on both sides of `pbkdf2HmacSha256`, and
the program wipes both:

```ts nish:ok
import { pbkdf2HmacSha256 } from "nish/crypto/hmac";
import { Secret, secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const passwordBytes: u8[] = [112, 97, 115, 115, 119, 100]; // "passwd"
  const password: Secret<u8[]> = secret(passwordBytes);
  const salt: u8[] = [115, 97, 108, 116]; // "salt"
  const key: Secret<u8[]> | null = pbkdf2HmacSha256(password, salt, 4096, 32);
  wipe(password);
  if (key === null) {
    return 1;
  }
  console.log("derived 32 bytes");
  wipe(key);
  return 0;
};
```

A function that returns `u8[] | null` answers `null` for an input it refuses —
a bad key length, a tag that does not verify — so narrow the result before you
use it. The modules that hold a private key (`p256`, `x25519`, `ed25519`,
`x509`, `x509-random`) take and give it as a `Secret<u8[]>`. Every module but `sha1` and
`ed25519`, which came later, has been through a security audit (`ed25519` is
recorded as a change after its area's audit, and `pki-roots` and `pki` have
a record written with their code); the records are in
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
an idle connection costs a few KiB, not `outputSize`. Set
`Http1Config.idleInput` and a slot lends its input and head buffers back too,
whenever it has answered a request and holds no byte of the next: a server
holding tens of thousands of keep-alive connections that each send a request
now and then keeps those buffers only for the connections mid-request, for two
pool operations a request. It is off by default. An `Http1Server` builds
a slot's connection on the first accept into it and keeps it for the next, so
a pool sized for 16,384 connections costs some 16 KiB until they come;
`bench/http.mjs` load-tests that loop on one core. Call `expire(now)` on an
`Http1Server` or `Http1TlsServer` from your loop, with `monotonicNanos()`, now
and then: it closes a slot that has moved no byte for `idleTimeout`
milliseconds, and one whose request head has been arriving for longer than
`headTimeout` (30 s by default), so a client that trickles its head a byte at
a time cannot hold a slot. Over TLS the head's clock starts with the first
bytes after the handshake, so a client that finishes its handshake and then
sends nothing is closed after `headTimeout` too. Both are `Http1Config`
fields, and a value of 0 or less stops start-up. Calling `expire` on every
turn of the loop is cheap: it walks the slots only when one can be due, about
once per the shorter of the two timeouts, and `expireScans` counts the walks. `TlsTcpServer`,
`Http1TlsServer`, `Http2TlsServer` and `Http3Server` build a slot the same
way, on the first connection accepted into it (an `Http2TlsServer` builds slot
0 in its constructor), so a pool's size is a ceiling on its connections. What
start-up still takes grows with it: the tables sized from the cap, such as an
`Http3Server`'s connection-ID index, timer wheel and rings.

`nish/net/tls/client` and `nish/net/tls/record-client` are the client side of
TLS 1.3, sans-IO like the server. `nish/net/tls/verify` checks the server for
them (`tlsClientAuthenticate`), and `nish/net/tls-tcp`'s `TlsTcpClient` and
blocking `tlsConnect` put the client on a TCP socket and check the server
themselves, against the system's roots or ones you name.
[TLS client](tls-client.md) shows them.

`nish/net/router` maps a request's method and path to a route you added, on
any of the three HTTP versions, without allocating; [HTTP routing](http-router.md)
shows it.

`nish/net/http-compress` reads `Accept-Encoding` and gzips a response body,
and `Http1Connection.respondEncoded` sends one with `Content-Encoding` and
`Content-Length` set; [Compression](compression.md) shows it.

`nish/net/http1-client` is the client side of HTTP/1.1: `http1RequestHead`
writes a request's head and `Http1ResponseParser` reads the response, fed
any slice, refusing every response-smuggling shape RFC 9112 names; [HTTP client](http-client.md)
shows it.

`nish/net/http-client` is a blocking client for command-line programs:
`httpFetch(request, options)` answers the response with a reader for its
body, and an `HttpClient` keeps a connection alive between fetches. Every
wait has a timeout, every body a cap, and redirects and proxies are followed
only as `HttpOptions` says; [HTTP client](http-client.md) shows it.

`nish/net/postgres` is a PostgreSQL client that leaves the socket to your
loop: prepared statements, pipelined groups, SCRAM-SHA-256, and rows read in
place from the receive buffer; [PostgreSQL](postgres.md) shows it.

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

When a `TlsTcpServer` slot ends a connection itself (`shutdown`, or an HTTP
carrier above it after its answer), it does not close the socket at once:
it shuts the write side, wipes the slot's keys and answers
`TLS_RECORD_WANT_READ` until the client hangs up, then `TLS_RECORD_DONE`.
Closing a socket the client is still writing to resets the connection, and a
browser can report that reset instead of the response. Keep reading the slot
until its interest says done, and close slots that stay quiet from your own
loop's timeout.

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
units, so a non-ASCII name answers differently on the two. The byte API never
looks for a `#`, which is never part of a request target.

### Whole URLs

A client handed a URL by a user, a redirect or a link needs its parts:
`urlParse(s)` splits an absolute URL into a `Url` (`scheme`, `username`,
`password`, `host`, `port`, `path`, `query`, `fragment`), and
`urlResolve(base, ref)` resolves a reference against one, as a browser does
for a link, removing `.` and `..` so a path never climbs above `/`.
`urlSerialize` writes a `Url` back. The scheme and host are lower-cased;
everything else is kept as written, still percent-encoded. `port` is -1 when
the URL names none; `urlDefaultPort(scheme)` is 80 or 443, and
`urlOrigin(u)` writes `scheme://host:port` with the port always there, so
origins compare as plain strings. A host is compared as written, so
`http://a.com./` (a trailing dot) and `http://[0::1]/` are different origins
from `http://a.com/` and `http://[::1]/`: an equal string is the same origin,
and a split errs toward "different".

```ts nish:ok
import { Url, urlOrigin, urlParse, urlResolve, urlSerialize } from "nish/net/url";

const show = (base: Url, ref: string): void => {
  const u: Url | null = urlResolve(base, ref);
  if (u === null) {
    console.log(`${ref} is refused`);
    return;
  }
  console.log(`${ref} -> ${urlSerialize(u)}, host ${u.host}, port ${u.port}`);
};

export const main = (): i32 => {
  const base: Url | null = urlParse("https://Example.com/docs/guide/index.html?v=2");
  if (base === null) {
    return 1;
  }
  show(base, "../api/url.html#parse");
  show(base, "/../../etc/passwd");
  show(base, "?v=3");
  show(base, "//cdn.example.com:8443/app.js");
  show(base, "http://127.1/");
  show(base, "http://good.com%2f@evil.com/");
  show(base, "http://a@b@c/");
  const origin: string | null = urlOrigin(base);
  console.log(origin === null ? "no origin" : origin);
  return 0;
};
```

```console
$ nish run links.ts
../api/url.html#parse -> https://example.com/docs/api/url.html#parse, host example.com, port -1
/../../etc/passwd -> https://example.com/etc/passwd, host example.com, port -1
?v=3 -> https://example.com/docs/guide/index.html?v=3, host example.com, port -1
//cdn.example.com:8443/app.js -> https://cdn.example.com:8443/app.js, host cdn.example.com, port 8443
http://127.1/ is refused
http://good.com%2f@evil.com/ -> http://good.com%2f@evil.com/, host evil.com, port -1
http://a@b@c/ is refused
https://example.com:443
```

**A URL two readers could disagree on is refused**, with null, not repaired:
a byte outside printable ASCII (a space, a tab, a non-ASCII letter), a
backslash anywhere (a browser reads it as `/`), a `%` not followed by two hex
digits, a second `@`, a host byte other than a letter, a digit and `-._~`
(so a percent-encoded byte), an IPv6
zone, a port past 65535, and a host that looks
like a number but is not four decimal parts (`127.1`, `0x7f.0.0.1`,
`2130706433`, `010.0.0.1`). An http, https, ws or wss URL needs a host. What does
parse is always one host: in `http://good.com%2f@evil.com/`, everything
before the `@` is the username.

Resolution is RFC 3986's, strictly: `http:g` against an http base is an
absolute URL with no host, so it is refused, where a browser reads it as the
relative `g`. A non-ASCII host is refused, so pass an
international name in its punycode `xn--` form. An IPv6 host is
compared as written, so `[::1]` and `[0::1]` are different origins; check
an address after you resolve the name, never the string, before you trust it.

## `nish/net/dns-message`

A DNS lookup is one UDP datagram out and one back. `nish/net/dns-message` writes
the first and reads the second; it opens no socket, so you send and receive
the bytes yourself. `dnsBuildQuery(out, id, name, qtype)` writes a question for
`name` of type `DNS_TYPE_A` or `DNS_TYPE_AAAA`, with recursion asked for, and
answers its length: `out` of `DNS_QUERY_MAX_BYTES` (271) always has room. A
name that is not one (an empty label, a label over 63 bytes, a name over 253,
a byte outside printable ASCII) answers a negative `DNS_ERR_*` instead. Pick
`id` at random for each query: it is half of what keeps a forged reply out.

`dnsParseReply(msg, len, query, queryLen, port, reply)` reads a reply into a
`DnsReply` you make once and reuse. It answers the reply's RCODE
(`DNS_NOERROR`, `DNS_NXDOMAIN`, `DNS_SERVFAIL`, `DNS_REFUSED`) or a negative
`DNS_ERR_*`: a reply whose ID, question or flags do not match your query is
refused before a record is read, so read it as "not my answer" and keep
waiting. On `DNS_NOERROR`, `reply.count` addresses are in `reply.addresses`,
18 bytes each, the form `nish:net` connects to, with `port` written in; at
most `DNS_MAX_ANSWERS` (8) are kept and `reply.dropped` counts the rest. When
`reply.truncated` is set, nothing was read: ask again over TCP.

```ts nish:ok
import {
  DNS_ERR_NOT_REPLY,
  DNS_QUERY_MAX_BYTES,
  DNS_TYPE_A,
  DnsReply,
  dnsBuildQuery,
  dnsParseReply,
} from "nish/net/dns-message";

export const main = (): i32 => {
  const query: u8[] = new Array<u8>(DNS_QUERY_MAX_BYTES);
  const n: i32 = dnsBuildQuery(query, 0x1234, "example.com", DNS_TYPE_A);
  console.log(`${n} bytes`);
  // A reply that is only an echo of the query has QR clear: not a reply.
  const reply = new DnsReply();
  const status: i32 = dnsParseReply(query, n, query, n, 443, reply);
  console.log(`${status === DNS_ERR_NOT_REPLY ? "not a reply" : "read"}`);
  return 0;
};
```

```console
$ nish run lookup.ts
29 bytes
not a reply
```

**A CNAME chain is followed inside the one reply.** An address is kept only
when its owner is the name you asked, or the last name a CNAME record before
it pointed to; a record for any other name is read past. Compression pointers
must point backwards, at most 16 deep, and a name never grows past 255 bytes,
so no reply makes the parser loop or read outside `msg[0, len)`.

## `nish/net/dns-config`

`nish/net/dns-config` reads `/etc/resolv.conf` and `/etc/hosts` from bytes you
have already read, into tables of fixed size. `dnsParseResolvConf(b, off, len,
config)` fills a `DnsConfig`: up to three `servers` (18 bytes each, on port
53), up to six `search` domains in 256 bytes, and `ndots`, `timeout` and
`attempts` from `options`, each clamped (0 to 15, 1 to 30, 1 to 5). A file
with no usable `nameserver` gives 127.0.0.1 and ::1, as glibc does.
`dnsParseHosts(b, off, len, hosts)` fills a `DnsHosts`, and
`dnsHostsFind(hosts, name, qtype, port, out, max)` writes the addresses it
gives `name`, without case, in file order, and answers how many.

```ts nish:ok
import { DnsHosts, dnsHostsFind, dnsParseHosts } from "nish/net/dns-config";
import { DNS_TYPE_A } from "nish/net/dns-message";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const file = bytesOf("127.0.0.1 localhost\n::1 localhost\n192.0.2.7 Build.Lan build # CI\n");
  const hosts = new DnsHosts();
  dnsParseHosts(file, 0, toI32(file.length), hosts);
  const out: u8[] = new Array<u8>(4 * 18);
  console.log(`${dnsHostsFind(hosts, "BUILD", DNS_TYPE_A, 22, out, 4)} address, ${out[15]}`);
  return 0;
};
```

```console
$ nish run hosts.ts
1 address, 7
```

Neither file is trusted to be small: what does not fit a table is dropped and
counted (`droppedServers`, `droppedSearch`, `droppedEntries`, `droppedNames`),
and a line over 1024 bytes is skipped whole and counted in `skippedLines`. An
address is a strict literal: `010.0.0.1` and `fe80::1%eth0` are refused, not
read as octal or with a zone. `dnsParseAddress` is the same reader, for a
literal anywhere in your own bytes.

## `nish/net/dns-resolver`

`DnsResolver` is a stub resolver: it asks the servers in a `DnsConfig` for a
name's A and AAAA records and gives you the addresses. It opens no socket,
reads no clock and reads no file, so it builds for `wasm32` too; you, or
[`nish/net/dns`](#nishnetdns), move its bytes. `new DnsResolver(config, hosts,
maxLookups)` makes every buffer it will need, for up to `maxLookups` lookups at
once (1 to 64), so a lookup allocates only the sixteen bytes an address
literal is parsed into.

`start(name, port, nowNanos)` begins a lookup and answers its slot.
`nextOutgoing(out, to, meta, id)` says what to do next, a query to send over
UDP or TCP or a socket to close, with `id` a fresh random 16-bit number each
time; `receive` and `receiveStream` take what came back; `tick(nowNanos)` moves
on from a server that did not answer by `nextDeadlineNanos()`. `result(lookup,
out, ttls)` answers `DNS_RESOLVE_PENDING` while the lookup runs, then the
address count, A first, 18 bytes each with `port` written in, and each TTL in
seconds: the smallest TTL of the address records, not of the CNAMEs that led to
them. A failure is `DNS_RESOLVE_NOT_FOUND` (the name has no address: NXDOMAIN,
or NODATA, a name with no A or AAAA record), `DNS_RESOLVE_NO_ANSWER` (no server
answered) or `DNS_RESOLVE_CNAME` (an alias chain ran past 8, or led back to
the name asked across replies; a loop inside one reply is
`DNS_RESOLVE_NOT_FOUND`). `start` itself answers a negative code when it
cannot begin: `DNS_RESOLVE_BUSY` when every slot is taken, or the `DNS_ERR_*`
code of `nish/net/dns-message` for a name that is not one, such as `""` or a
label over 63 bytes. Check it before you pass it to `result`, which panics on a
number that is not a lookup.

`localhost`, an address literal and a name your hosts table has answer at once,
with no packet sent:

```ts nish:ok
import { DnsResolver } from "nish/net/dns-resolver";
import { DnsConfig, dnsParseResolvConf } from "nish/net/dns-config";
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message";

export const main = (): i32 => {
  const config = new DnsConfig();
  dnsParseResolvConf(new Array<u8>(0), 0, 0, config);
  const resolver = new DnsResolver(config, null, 1);
  const lookup: i32 = resolver.start("localhost", 443, toI64(0));
  const out: u8[] = new Array<u8>(16 * DNS_ADDRESS_BYTES);
  const ttls: i32[] = new Array<i32>(16);
  console.log(`${resolver.result(lookup, out, ttls)} addresses, 127.0.0.${out[15]} first`);
  return 0;
};
```

```console
$ nish run local.ts
2 addresses, 127.0.0.1 first
```

**A forged reply cannot end a lookup.** A reply from another address or port
than the server's, or with another ID or question, is dropped and counted
(`droppedSource`, `droppedId`, `droppedQuestion`), and the lookup keeps
waiting for the true one. A truncated reply is asked again over TCP, once; a
server that does not answer in `timeout` seconds gives way to the next, for
`attempts` rounds; a name with fewer dots than `ndots` is tried with each
`search` domain. When one family answers NXDOMAIN and the other reached no
server, the next candidate is tried, and if none answers the lookup ends with
the unreachable family's error. Every counter stops at 2,147,483,647 rather
than wrapping. Every lookup ends.

## `nish/net/dns`

`nish/net/dns` drives a `DnsResolver` over `nish:net` sockets on the loop your
program already runs, so a lookup never stops a server from serving. `new
DnsClient(resolver, loop, tokenBase)` joins your `pollCreate` loop under the
tokens `tokenBase` to `tokenBase + client.tokens() - 1`. Start a lookup with
`client.start(name, port, now)`, pass `client.timeoutMs(now, yours)` to
`pollWait`, hand every ready token `client.owns(token)` claims to
`client.ready(token, events, now)`, call `client.tick(now)` after each wake,
and read `client.result(lookup, out, ttls)` until it is not
`DNS_RESOLVE_PENDING`. Each query goes out on a fresh socket with a random ID,
and one `ready` reads at most `DNS_CLIENT_MAX_DATAGRAMS` (32) datagrams, so a
flood on the port cannot keep your loop inside the client.

```ts nish:ok
import { DnsClient } from "nish/net/dns";
import { DNS_RESOLVE_PENDING, DnsResolver } from "nish/net/dns-resolver";
import { DnsConfig, dnsParseResolvConf } from "nish/net/dns-config";
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message";
import { pollCreate, pollWait } from "nish:net";
import { monotonicNanos } from "nish:process";

export const main = (): i32 => {
  const config = new DnsConfig();
  const conf: u8[] = [];
  const text = "nameserver 192.0.2.53\n";
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    conf.push(toU8(text.charCodeAt(i)));
  }
  dnsParseResolvConf(conf, 0, toI32(conf.length), config);
  const loop: i32 = pollCreate();
  const client = new DnsClient(new DnsResolver(config, null, 4), loop, 100);
  const lookup: i32 = client.start("example.com", 443, monotonicNanos());
  if (lookup < 0) {
    console.log(`not started: ${lookup}`);
    return 1;
  }
  const out: u8[] = new Array<u8>(16 * DNS_ADDRESS_BYTES);
  const ttls: i32[] = new Array<i32>(16);
  const ready: i32[] = new Array<i32>(16);
  let status: i32 = client.result(lookup, out, ttls);
  while (status === DNS_RESOLVE_PENDING) {
    // Your own sockets share this loop; -1 means you have no timer of your own.
    const count: i32 = pollWait(loop, ready, client.timeoutMs(monotonicNanos(), -1));
    const now: i64 = monotonicNanos();
    for (let k: i32 = 0; k < count; k++) {
      if (client.owns(ready[2 * k])) {
        client.ready(ready[2 * k], ready[2 * k + 1], now);
      }
    }
    client.tick(now);
    status = client.result(lookup, out, ttls);
  }
  console.log(`${status}`);
  return 0;
};
```

`resolveHost(name, timeoutMs, port, out, ttls)` is the same lookup with
`/etc/resolv.conf` and `/etc/hosts` read for you, on a loop of its own: **it
blocks** until the lookup ends or `timeoutMs` passes
(`DNS_RESOLVE_TIMEOUT`), so it is for a command-line tool or a program's
start-up, not a server's loop. It waits for both the A and the AAAA answer, so
a family that answered is not returned on its own when `timeoutMs` passes. A
`pollWait` that fails cancels the lookup and its negative errno is the answer;
a name `start` refuses answers `start`'s code. `dnsLookupWith` is the same with a
configuration you give it.

```ts nish:ok
import { resolveHost } from "nish/net/dns";
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message";

export const main = (): i32 => {
  const out: u8[] = new Array<u8>(16 * DNS_ADDRESS_BYTES);
  const ttls: i32[] = new Array<i32>(16);
  console.log(`${resolveHost("localhost", 2000, 80, out, ttls)} addresses`);
  return 0;
};
```

```console
$ nish run host.ts
2 addresses
```

A program that uses `DnsClient` reports `net` and `entropy` under
`--emit-capabilities`, the IDs being random; `resolveHost` adds `fs.read` for
the two files and `clock` for its deadline. Both are native only, as every
`nish:net` call is.

The [library's README](../../../std/README.md) lists every module, every
export and the specification each one reproduces. How `nish/` imports
resolve is in [`export` and `import`](../../LANGUAGE.md#export-and-import),
and [Modules](../language/modules.md) covers importing your own files.
