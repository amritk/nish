# Security record: `nish/net/url` — percent-decoding, path segments, query strings, URL parsing

The record of `nish/net/url` (#717): percent-decoding (RFC 3986 §2.1, the
WHATWG URL Standard's percent-decode), splitting a request target's path into
segments (RFC 3986 §3.3) and reading its query as
`application/x-www-form-urlencoded` pairs; and parsing an absolute URL into
its parts and resolving a reference against one (RFC 3986 §3 and §5, #994).
It says what the module refuses and with what, what it caps and where the cap
is set, what it allocates, and the test that pins each property. It is written
with the code, against `main` at `7611faf` (the byte API) and `b116907` (the
URL parser), and cites functions rather than lines.

**Result.** Nothing a peer sends panics or allocates in the byte API: a
malformed escape, `%00`, too little room in the output and too many pairs are
each a negative code the program answers, and only a window outside its array
— the program's own mistake — panics. The one cap, `maxPairs`, is a number the
program fixes, 100 by default. Three properties are recorded as accepted
rather than open (URL-1 to URL-3): decoded bytes are not checked for UTF-8,
a refused decode leaves what it wrote before the refusal, and a repeated key
is answered by its first value. The URL parser answers null, never a panic,
for anything it refuses, and refuses every host two readers could take for
different hosts: a percent-encoded or non-unreserved byte, a second `@`, a
numeric host that is not strict dotted-decimal IPv4, an IPv6 zone. Four
properties are accepted (URL-4 to URL-7): IPv6 hosts are compared as written,
`user:@` writes back as `user@`, an empty path stays empty, and the input's
length is the caller's to bound.

## Scope

| File | Functions |
| --- | --- |
| `std/net/url.ts` | `urlQueryStart`, `percentDecode`, `percentDecodeErrorAt`, `percentDecodePathSegment`; `UrlPathSegments` (`reset`, `next`); `UrlQueryLimits`; `UrlQuery` (`reset`, `next`); `urlQueryFind`; the string forms `urlDecode` and `urlQueryGet`; the helpers `urlCheckWindow`, `urlHexValue`, `urlEscapeAt`, `urlDecodeRun`, `urlKeyEquals`, `urlIsUtf8`, `urlBytesOf`, `urlDecodeString` |
| `std/net/url.ts` (URL parser) | `Url`; `urlParse`, `urlResolve`, `urlSerialize`, `urlDefaultPort`, `urlOrigin`; the helpers `urlLowerString`, `urlFind`, `urlIsAlpha`, `urlIsDigit`, `urlIsUnreserved`, `urlIsIpv4`, `urlIsIpv6`, `urlLooksNumeric`, `urlReadAuthority`, `urlReadReference`, `urlDotAt`, `urlDotSegment`, `urlSlashFrom`, `urlRemoveDotSegments`, `urlFinish`, `urlMerge` |

Out of scope: the HTTP/1.1 parser that hands the target over
(`docs/security/http1.md`); the WHATWG URL Standard's lenient parse (a
backslash read as `/`, tabs and newlines stripped, a host percent-decoded,
`127.1` and `0x7f.1` read as IPv4), which `urlParse` refuses rather than
repairs; IDNA, so a non-ASCII host is refused and a program passes the
punycode `xn--` form; and name resolution, so what a host resolves to (a
private address behind a public name) is the connecting code's to check. In
the byte API a path is split, not normalised: `..` and `.` are segments like
any other, and a program that maps segments to files decides what they mean.
`urlParse` and `urlResolve` remove dot segments, as RFC 3986 §5.2.4 does.

## Threat model

The attacker writes the request target: every byte of the path and the query,
in any length the HTTP layer admits. A win is a panic, memory or time the
program spends without a bound it set, a byte read outside the window, a
decoded value two readers of the same target disagree on without the program
having chosen the reading (`%2F` splitting a segment, `+` read as a space in a
path, a malformed escape silently repaired), or a NUL byte reaching a program
that never asked for one. The program calling the module is trusted; its
mistakes (a window outside its array, an `at` outside `out`) panic.

For the URL parser the attacker writes the URL string: one a user pastes, a
`Location` header, a link in a page. A win is a panic, a host or port the
parser answers that another reader of the same string (a browser, Node's
`URL`, a proxy, the resolver) would answer differently (`http://a@b@c/`,
`http://127.1/`, `http://evil.com%2f@good.com/`, `http://a\b/`), a host
that is a number in disguise and slips past a check that compared strings, a
resolved reference that climbs above the root with `..` or `%2e%2e`, or a
serialized URL that reads back as a different one.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| URL-1 | Low | `std/net/url.ts` (`percentDecode`, `percentDecodePathSegment`) | The byte API decodes `%FF` to the byte 0xFF where `decodeURIComponent` throws: what it writes need not be UTF-8. A program that hands the bytes to something reading text without checking them may see invalid UTF-8. | **Accepted.** A segment or a value may be binary, and the reader that treats it as text is the one that knows to check. `urlDecode` and `urlQueryGet`, which answer a string, refuse anything that is not UTF-8. |
| URL-2 | Low | `std/net/url.ts` (`percentDecode`) | A refused decode answers its code after writing the bytes before the refusal into `out`: `a%41b` into two bytes writes `aA` and answers `URL_DECODE_ERR_SPACE`. A program that reads `out` after a negative answer reads a prefix. | **Accepted.** Checking every escape and the room before writing would scan the window twice; the answer is negative, `percentDecode`'s doc says the bytes before the error have been written, and no byte past `out`'s end is. |
| URL-3 | Low | `std/net/url.ts` (`urlQueryFind`, `urlQueryGet`) | A key written twice (`k=1&k=2`) is answered by its first value, as `URLSearchParams.get` answers. A proxy in front that reads the last occurrence would see a different value (HTTP parameter pollution). | **Accepted.** First-wins is the reading Node's own API gives; a program that must refuse duplicates iterates with `UrlQuery.next` and sees every pair in order. |
| URL-4 | Low | `std/net/url.ts` (`urlParse`, `urlOrigin`) | An IPv6 host is kept as written, lower-cased: `[::1]`, `[0::1]` and `[::ffff:127.0.0.1]` are three hosts and three origins. A program that refuses a host by comparing its string with `::1` misses the other two. | **Accepted.** For an origin check the split errs toward "different origin", the safe side. A deny list of addresses is only sound after name resolution in any case, since a DNS name can answer `::1`; the module's doc and `urlOrigin`'s say the comparison is as written. |
| URL-5 | Low | `std/net/url.ts` (`urlSerialize`) | `http://u:@h/` writes back as `http://u@h/`: an empty password and no password are one `Url`. | **Accepted.** The two carry the same credentials; the WHATWG serializer drops the `:` too. The written form parses to itself. |
| URL-6 | Low | `std/net/url.ts` (`urlParse`) | `http://g` keeps an empty path, as RFC 3986 parses it; an HTTP client that writes the path as the request target sends an empty one. | **Accepted.** The parser answers what was written; RFC 9112 §3.2.1 has the client send `/` for an empty path, and that belongs to the client that builds the request. |
| URL-7 | Low | `std/net/url.ts` (`urlParse`, `urlResolve`) | No length cap: the work and the `Url` allocated are linear in the string, and a host is not checked against DNS's 253-byte or 63-byte-label limits. | **Accepted.** The string is already in memory when it is parsed, so the program that read it set its size (an HTTP header's cap, a config file's); every scan is linear and none repeats. A host longer than DNS allows fails at resolution. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**RFC 3986 §5.4, every example** (`tests/link/net_url_parse`, and
`tests/link/net_url_parse_f64` running the same checks under
`--number-mode f64`): each normal and abnormal reference resolved against
`http://a/b/c/d;p?q` writes back as the RFC lists, `../../../g` and
`/./g` included, so `..` never climbs above the root. `http:g` is resolved
strictly and is refused, since an http URL needs a host. `%2e` and `%2E` are
read as dots in a dot segment (`http://a/b/%2e/c/%2E%2e/.%2e/d` is
`http://a/d`), so an encoded `..` does not survive where the plain one would
not; inside a longer segment `%2e` is kept (`/b%2ec/%2e%2e%2e`).
A path that starts `//` under no authority writes back after `/.` and reads
back as itself.

**Host confusion refused** (`net_url_parse`): each of 57 refusals is a line
of `expected.out` (`refused: …`) that answers null — no scheme, or one that
starts with a digit or is empty; a tab, CR LF, NUL, a space, DEL, a backslash and
a byte past 0x7F anywhere (so `http://evil.com\@good.com/`, where a WHATWG
parser ends the host at `\`, and the reference `/\evil.com`, which it reads
as a network path); a `%` without two hex digits; two `@`; `[` or `]` in the
userinfo; a host byte outside ALPHA, DIGIT and `-._~` (so `%61`, `!`);
an empty host under http, https, ws or wss; a port that is signed, has a letter,
repeats or passes 65535; an IPv6 literal that is unclosed, empty, of seven
groups without `::` or eight with it, with two `::` or `:::`, a group of five
digits, a dangling `:`, a non-hex digit, a zone (`%25eth0`), an IPvFuture
form, a bad IPv4 tail or one too many, or bytes between `]` and the port; an
IPv4 octet above 255, of three or five parts, with a leading zero or a
trailing dot; a host that is one decimal number; a host whose last label is
hex or a number. 11 IPv6 forms and the IPv4 and reg-name forms either side of
each refusal parse (`0.0.0.0`, `1.a`, `a.b.`, `a.0xg`).

**What parses writes back to itself** (`net_url_parse`): each accepted case
is dumped part by part and written back — an escape in the case it was
written (`%4a%4A`), `http://u:@a/` as `http://u@a/` (URL-5), `http://a:80/`
with its port — and 4,000 seeded strings over the
alphabet `aZ09:/?#@[].%2eEf+-~!\`, a space and `xv` (the bytes the parser
splits on, hex digits and some it refuses), after one of eight prefixes, are each parsed and resolved against the §5.4 base with no panic;
every one of the 1,872 answers that parse writes back to a string that parses
to the same string (`0 broken, 1872 parsed`).

**Origins** (`net_url_parse`): `urlDefaultPort` is 80 for http and ws, 443
for https and wss, and -1 otherwise; `urlOrigin` writes the port always, so
`HTTP://A.com/x` and `http://a.com:80/y` are the one origin
`http://a.com:80`, a different port, scheme or host is a different one, an
IPv6 host is bracketed, and any other scheme has none (null).

**Strict by default, every repair asked for** (`tests/link/std_url`, and the
seeded differential `tests/link/std_url/fuzz.ts`). With no flags
`percentDecode` refuses a `%` not followed by two hex digits
(`URL_DECODE_ERR_ESCAPE`, at the `%`) and `%00` (`URL_DECODE_ERR_NUL`), and
copies `+` as it stands. `URL_DECODE_LENIENT` copies a malformed escape
unchanged, as the WHATWG percent-decode does; `URL_DECODE_FORM` reads `+` as a
space; `URL_DECODE_ALLOW_NUL` is the only way `%00` decodes, so lenient alone
still refuses it. The bytes either side of each hex range are not digits:
`%:1`, `%@1`, `` %`1 `` and `%G1` are each refused at 0 (`strict %:1 -> -1 at 0 -`)
and copied leniently (`` lenient %:1%@1%`1%G1 -> 12 at -1 253a31254031256031254731 ``).
On 3,000 seeded inputs over an alphabet heavy in `%`, hex
digits, `+`, `&` and `=`, with `:`, `@`, `` ` `` and `G` beside the hex ranges, mixed with UTF-8 sequences valid and invalid
(2-, 3- and 4-byte, overlong, a surrogate, past U+10FFFF, a lone continuation,
truncated, `0xFF`, and each unrestricted lead — `E1`, `E3`..`EC`, `EE`,
`F1`..`F3` — well formed and with a byte past the continuation range), each escaped in either case or written as raw bytes, the
strict answer's code agrees with a regex of the rule, and its bytes with a
model decoder and with `decodeURIComponent`: that throws exactly where the
bytes are not UTF-8, and elsewhere its answer, multi-byte included, is the
same bytes (one such value is pinned in `std_url`:
`multibyte -> 13 636166c3a920e282acf09f9880`);
the three flags together agree with the model decoder reading `+` as a space,
and the pairs, each decoded so, with `URLSearchParams`'s entries; `urlDecode`
of each input, flags 0, answers null exactly where `decodeURIComponent` throws
or the strict rule refuses and is otherwise its bytes, and `urlQueryGet` of
`/?v=` and the input answers null exactly where the value is malformed, holds
`%00` or is not UTF-8 and is otherwise `URLSearchParams.get`'s bytes — run
under Node and, built natively, printing the same lines byte for byte. The refusal as a handler
meets it: `tests/link/std_url_escape` exits 1 on `%zz`.

**The string forms check UTF-8 as RFC 3629 does** (`std_url`): `urlIsUtf8`,
behind `urlDecode` and `urlQueryGet`, takes each lead's range and length and
refuses an overlong form, a surrogate, a code point past U+10FFFF, a bad
continuation byte and a sequence cut short. Each edge is a line of
`expected.out`: the first and last of each range decode
(`utf8 %E0%A0%80 -> e0a080`, `utf8 %ED%9F%BF -> ed9fbf`,
`utf8 %F0%90%80%80 -> f0908080`, `utf8 %F4%8F%BF%BF -> f48fbfbf`) and the
byte past it is refused (`utf8 %E0%9F%BF -> null`, `utf8 %ED%A0%80 -> null`,
`utf8 %F0%8F%BF%BF -> null`, `utf8 %F4%90%80%80 -> null`,
`utf8 %F5%80%80%80 -> null`, `utf8 %C1%BF -> null`); a bad continuation in
the second, third or fourth byte is refused (`utf8 %F0%9F%41%80 -> null`);
each unrestricted lead, `E1`, `E3`..`EC`, `EE`, `F1`, `F2` and `F3`, takes
`80`..`BF` and refuses `C0` (`utf8 %E1%80%BF -> e180bf`,
`utf8 %E1%80%C0 -> null`, `utf8 %F1%80%BF%80 -> f180bf80`,
`utf8 %F1%80%C0%80 -> null`, and the same line for each other lead), and
so is a 2-, 3- or 4-byte sequence cut at the end, escaped (`utf8 %F0%9F%98 ->
null`) and as raw bytes, where only the length check stops a read past the
string (`raw f09f98 -> null`). `urlQueryGet` refuses the same
(`get null` for `%F4%90%80%80`). Dropping any range bound, the truncation
check or a continuation check, or refusing every 3- and 4-byte lead, fails
`std_url` or the fuzz.

**A path is split before it is decoded** (`std_url`): `UrlPathSegments` splits
on the raw `/` only, so `/a%2Fb/c` is the two segments `a/b` and `c`, and
`percentDecodePathSegment` keeps `+` literal. Empty segments (`/a//b/`) are
yielded, not merged; a malformed escape in one segment refuses that segment
and the next is still read. A window at a non-zero offset is split on its own
bytes: `XX/a%2Fb/cYY` from 2 for 8 is `a/b` and `c`
(`path window 2 8 XX/a%2Fb/cYY -> [a/b] [c] count 2 again false`), a window
that does not start with `/` is read as it stands (`path window 1 5 /ab/cd ->
[ab] [cd] count 2 again false`: its first segment runs from the window's
start, and the `/` before it is not read), and the `/` and `y` just outside
`x/a/b/y` from 2 for 3 add no segment (`path window 2 3 x/a/b/y -> [a] [b]
count 2 again false`).

**Bounded work per query** (`std_url`, `tests/link/std_url_pairs`): a query
yields at most `UrlQueryLimits.maxPairs` pairs (100 by default,
`URL_DEFAULT_MAX_PAIRS`), and past it `next()` answers
`URL_QUERY_ERR_PAIRS`, sets `failed` and stays spent until `reset`. Empty
pairs are skipped and not counted, so `&&&…` costs one scan of the window and
no pair. A negative cap is read as 0. `urlQueryFind` stops at the cap too, so
a key placed after it is not found (`find past cap -> -4`), and `urlQueryGet`
answers null for it. Every scan is linear in the window.

**No byte outside the window, no write outside `out`** (`std_url`,
`tests/link/std_url_space`, `tests/link/std_url_window`): every function
reads `bytes[off, off + len)` only, and a `?` or `%` just past the window is
not seen (`split window -> -1 3`, `window -> 1 41`), even where the bytes
past it would complete an escape: `ab%41` cut after `%` or `%4` is refused at
2 by `percentDecode` and `percentDecodePathSegment` and copied as `%` or `%4`
leniently (`window cut 1 -> -1 at 2 lenient 1 25 segment -1 lenient 1 25`,
`window cut 2 -> -1 at 2 lenient 2 2534 segment -1 lenient 2 2534`), a query
value so cut decodes the same (`window query -> 1 value 2 -1 lenient 2 2534`),
and a key cut before its escape's last digit matches nothing
(`window find kA -> 0`, `window find kA whole -> 1`). Output that does not fit
is `URL_DECODE_ERR_SPACE` at the byte with no room, and nothing is written
past `out`'s end. A window outside its array panics with
`…: the window is outside the array`: `UrlQuery.reset`'s once in each of 50
runs at 2 and at 8 threads (`std_url_window`), and `percentDecode`'s,
`urlQueryStart`'s and `UrlPathSegments.reset`'s each in one program run once
natively and once under Node (`tests/link/std_url/panic-*-window.ts`). A
negative `len` is pinned for `percentDecode` only
(`panic-decode-negative-len.ts`), and an `at` outside `out`, past its end or
negative, panics with `percentDecode: at is outside out` in the same two runs
(`panic-decode-at.ts`, `panic-decode-negative-at.ts`).

**The byte API allocates nothing** (`tests/link/std_url/alloc.ts`): one
`UrlPathSegments`, one `UrlQuery` and one output buffer, reused across 10,000
targets that change each round, split every segment, decode every pair and
look up a key with `Arena.used()` where it was; a control push the same meter
sees proves the meter is not blind. `urlDecode` and `urlQueryGet` allocate
their answer and are the convenience forms.

**Under Node the same bytes** (`std_url` and its four refusal programs, `std_url_escape`, `std_url_pairs`,
`std_url_space` and `std_url_window`, under `runtime/nish.mjs`): every
program exits as it does natively and prints the same stdout, and
`std_url_window` the same stderr. The six `panic-*.ts` programs are run under
Node and natively apart from these.

Tests:
`link/std_url: exits with 0 and stdout matches expected.out`,
`link/std_url_escape: exits with 1 and stdout matches expected.out`,
`link/std_url_pairs: exits with 1 and stdout matches expected.out`,
`link/std_url_space: exits with 1 and stdout matches expected.out`,
`link/std_url_window: exits with 1 and stdout matches expected.out` — each the
template `link/${name}: exits with ${wantCode} and stdout matches
expected.out`;
`link/std_url_window: every one of 50 runs at 2 and 8 threads prints
expected.stderr once and exits 1` — the template `link/${name}: every one of
${PANIC_ONCE_RUNS} runs at 2 and 8 threads prints expected.stderr once and
exits ${wantCode}`;
`link/std_url: 10,000 targets split, decoded and searched leave Arena.used() where it was`;
`link/std_url: 3,000 seeded inputs under Node decode as decodeURIComponent, URLSearchParams and the strict rule say`;
`link/std_url: the same 3,000 inputs, built natively, print the Node run's lines byte for byte`;
`link/std_url: panic-decode-window.ts under the Node prelude exits 1 with "percentDecode: the window is outside the array"`,
`link/std_url: panic-decode-at.ts under the Node prelude exits 1 with "percentDecode: at is outside out"`,
`link/std_url: panic-start-window.ts under the Node prelude exits 1 with "urlQueryStart: the window is outside the array"`,
`link/std_url: panic-segments-window.ts under the Node prelude exits 1 with "UrlPathSegments: the window is outside the array"`,
`link/std_url: panic-decode-negative-len.ts under the Node prelude exits 1 with "percentDecode: the window is outside the array"`,
`link/std_url: panic-decode-negative-at.ts under the Node prelude exits 1 with "percentDecode: at is outside out"`
and the same six `… built natively exits 1 with …` — the templates
`link/std_url: ${file}.ts under the Node prelude exits 1 with "${message}"` and
`link/std_url: ${file}.ts built natively exits 1 with "${message}"`;
and, for each of the five programs, the template `link/${name}: under the
Node prelude it exits ${code} and prints expected.out${err === null ? "" : "
and expected.stderr"}`, all in `tests/run.js`;
`link/net_url_parse: exits with 0 and stdout matches expected.out` and
`link/net_url_parse_f64: exits with 0 and stdout matches expected.out`, the
same `link/${name}` template.

## Divergences from Node

Each is deliberate and pinned above.

- Strict decoding refuses what `decodeURIComponent` refuses (a malformed
  escape) and also `%00`, which it accepts; `URLSearchParams` repairs both.
  `URL_DECODE_FORM | URL_DECODE_LENIENT | URL_DECODE_ALLOW_NUL` is
  `URLSearchParams`'s reading for valid UTF-8; where `URLSearchParams`
  replaces an invalid sequence with U+FFFD, the byte API keeps its bytes.
- The byte API does not check UTF-8 (URL-1); the string forms do.
- `urlQueryFind` and `urlQueryGet` expect an ASCII `name`: natively it is
  compared with the key's bytes, under Node with its UTF-16 code units.
- `urlDecode` and `urlQueryGet` expect an ASCII string, as a URL on the wire
  is; under Node a non-ASCII decoded byte comes back as Latin-1 where the
  native build gives UTF-8, as `String.fromBytes` does everywhere. The input
  half differs too: natively a string's UTF-8 bytes are decoded, while under
  Node each UTF-16 code unit up to 0xFF is read as one byte (Latin-1) and a
  code unit above 0xFF makes the answer null, so `urlDecode("aĀb", 0)` is
  `aĀb` natively and null under Node.
- `urlQueryGet` decodes strictly and stops at 100 pairs, where
  `URLSearchParams` repairs and has no cap.
- `urlQueryFind` compares `name` with the key decoded strictly in form mode,
  so a key with a malformed escape or `%00` never matches.
- The byte API does no fragment handling: RFC 9112 §3.2 keeps `#` out of a
  request target, so a `#` is a byte of the path or of the last value.
  `urlParse` splits the fragment off at the first `#`.
- `urlParse` refuses where Node's `URL` repairs: a backslash, a tab or
  newline, a space, a non-ASCII byte, a malformed `%`, a second `@`, a
  percent-encoded host, and a numeric host that is not four decimal octets
  (`new URL("http://127.1/")` is `127.0.0.1`).
- `urlParse` keeps what Node rewrites: a percent-encoded byte stays in the
  case it was written, an IPv6 host is not compressed (URL-4), an empty http
  path stays empty (URL-6), and a default port written out is kept
  (`http://a:80/` has port 80, where `URL` drops it; `urlOrigin` agrees either
  way).
- `urlResolve` is RFC 3986 strict: `http:g` against an http base is the
  absolute `http:g`, refused for its missing host, where `URL` reads it as
  the relative `g`.
