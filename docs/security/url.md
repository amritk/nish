# Security record: `nish/net/url` — percent-decoding, path segments, query strings

The record of `nish/net/url` (#717): percent-decoding (RFC 3986 §2.1, the
WHATWG URL Standard's percent-decode), splitting a request target's path into
segments (RFC 3986 §3.3) and reading its query as
`application/x-www-form-urlencoded` pairs. It says what the module refuses and
with what, what it caps and where the cap is set, what it allocates, and the
test that pins each property. It is written with the code, against `main` at
`7611faf`, and cites functions rather than lines.

**Result.** Nothing a peer sends panics or allocates in the byte API: a
malformed escape, `%00`, too little room in the output and too many pairs are
each a negative code the program answers, and only a window outside its array
— the program's own mistake — panics. The one cap, `maxPairs`, is a number the
program fixes, 100 by default. Three properties are recorded as accepted
rather than open (URL-1 to URL-3): decoded bytes are not checked for UTF-8,
a refused decode leaves what it wrote before the refusal, and a repeated key
is answered by its first value.

## Scope

| File | Functions |
| --- | --- |
| `std/net/url.ts` | `urlQueryStart`, `percentDecode`, `percentDecodeErrorAt`, `percentDecodePathSegment`; `UrlPathSegments` (`reset`, `next`); `UrlQueryLimits`; `UrlQuery` (`reset`, `next`); `urlQueryFind`; the string forms `urlDecode` and `urlQueryGet`; the helpers `urlCheckWindow`, `urlHexValue`, `urlEscapeAt`, `urlDecodeRun`, `urlKeyEquals`, `urlIsUtf8`, `urlBytesOf`, `urlDecodeString` |

Out of scope: the HTTP/1.1 parser that hands the target over
(`docs/security/http1.md`), and the full WHATWG URL parser (scheme, host,
port, IDNA, `..` resolution), which this module does not implement. A path is
split, not normalised: `..` and `.` are segments like any other, and a program
that maps segments to files decides what they mean.

## Threat model

The attacker writes the request target: every byte of the path and the query,
in any length the HTTP layer admits. A win is a panic, memory or time the
program spends without a bound it set, a byte read outside the window, a
decoded value two readers of the same target disagree on without the program
having chosen the reading (`%2F` splitting a segment, `+` read as a space in a
path, a malformed escape silently repaired), or a NUL byte reaching a program
that never asked for one. The program calling the module is trusted; its
mistakes (a window outside its array, an `at` outside `out`) panic.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| URL-1 | Low | `std/net/url.ts` (`percentDecode`, `percentDecodePathSegment`) | The byte API decodes `%FF` to the byte 0xFF where `decodeURIComponent` throws: what it writes need not be UTF-8. A program that hands the bytes to something reading text without checking them may see invalid UTF-8. | **Accepted.** A segment or a value may be binary, and the reader that treats it as text is the one that knows to check. `urlDecode` and `urlQueryGet`, which answer a string, refuse anything that is not UTF-8. |
| URL-2 | Low | `std/net/url.ts` (`percentDecode`) | A refused decode answers its code after writing the bytes before the refusal into `out`: `a%41b` into two bytes writes `aA` and answers `URL_DECODE_ERR_SPACE`. A program that reads `out` after a negative answer reads a prefix. | **Accepted.** Checking every escape and the room before writing would scan the window twice; the answer is negative, `percentDecode`'s doc says the bytes before the error have been written, and no byte past `out`'s end is. |
| URL-3 | Low | `std/net/url.ts` (`urlQueryFind`, `urlQueryGet`) | A key written twice (`k=1&k=2`) is answered by its first value, as `URLSearchParams.get` answers. A proxy in front that reads the last occurrence would see a different value (HTTP parameter pollution). | **Accepted.** First-wins is the reading Node's own API gives; a program that must refuse duplicates iterates with `UrlQuery.next` and sees every pair in order. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**Strict by default, every repair asked for** (`tests/link/std_url`, and the
seeded differential `tests/link/std_url/fuzz.ts`). With no flags
`percentDecode` refuses a `%` not followed by two hex digits
(`URL_DECODE_ERR_ESCAPE`, at the `%`) and `%00` (`URL_DECODE_ERR_NUL`), and
copies `+` as it stands. `URL_DECODE_LENIENT` copies a malformed escape
unchanged, as the WHATWG percent-decode does; `URL_DECODE_FORM` reads `+` as a
space; `URL_DECODE_ALLOW_NUL` is the only way `%00` decodes, so lenient alone
still refuses it. On 3,000 seeded inputs over an alphabet heavy in `%`, hex
digits, `+`, `&` and `=`, mixed with UTF-8 sequences valid and invalid
(2-, 3- and 4-byte, overlong, a surrogate, past U+10FFFF, a lone continuation,
truncated, `0xFF`), each escaped in either case or written as raw bytes, the
strict answer's code agrees with a regex of the rule, and its bytes with a
model decoder and with `decodeURIComponent`: that throws exactly where the
bytes are not UTF-8, and elsewhere its answer, multi-byte included, is the
same bytes (one such value is pinned in `std_url`:
`multibyte -> 13 636166c3a920e282acf09f9880`);
the three flags together agree with the model decoder reading `+` as a space,
and the pairs, each decoded so, with `URLSearchParams`'s entries — run under
Node and, built natively, printing the same lines byte for byte. The refusal as a handler
meets it: `tests/link/std_url_escape` exits 1 on `%zz`.

**A path is split before it is decoded** (`std_url`): `UrlPathSegments` splits
on the raw `/` only, so `/a%2Fb/c` is the two segments `a/b` and `c`, and
`percentDecodePathSegment` keeps `+` literal. Empty segments (`/a//b/`) are
yielded, not merged; a malformed escape in one segment refuses that segment
and the next is still read.

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
`…: the window is outside the array`, once, at 2 and at 8 threads.

**The byte API allocates nothing** (`tests/link/std_url/alloc.ts`): one
`UrlPathSegments`, one `UrlQuery` and one output buffer, reused across 10,000
targets that change each round, split every segment, decode every pair and
look up a key with `Arena.used()` where it was; a control push the same meter
sees proves the meter is not blind. `urlDecode` and `urlQueryGet` allocate
their answer and are the convenience forms.

**Under Node the same bytes** (`std_url` and its four refusals under
`runtime/nish.mjs`): every program exits as it does natively and prints the
same stdout, and `std_url_window` the same stderr.

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
and, for each of the five programs, the template `link/${name}: under the
Node prelude it exits ${code} and prints expected.out${err === null ? "" : "
and expected.stderr"}`, all in `tests/run.js`.

## Divergences from Node

Each is deliberate and pinned above.

- Strict decoding refuses what `decodeURIComponent` refuses (a malformed
  escape) and also `%00`, which it accepts; `URLSearchParams` repairs both.
  `URL_DECODE_FORM | URL_DECODE_LENIENT | URL_DECODE_ALLOW_NUL` is
  `URLSearchParams`'s reading.
- The byte API does not check UTF-8 (URL-1); the string forms do.
- `urlQueryFind` and `urlQueryGet` expect an ASCII `name`: natively it is
  compared with the key's bytes, under Node with its UTF-16 code units.
- `urlDecode` and `urlQueryGet` expect an ASCII string, as a URL on the wire
  is; under Node a non-ASCII decoded byte comes back as Latin-1 where the
  native build gives UTF-8, as `String.fromBytes` does everywhere.
- `urlQueryGet` decodes strictly and stops at 100 pairs, where
  `URLSearchParams` repairs and has no cap.
- `urlQueryFind` compares `name` with the key decoded strictly in form mode,
  so a key with a malformed escape or `%00` never matches.
- No fragment handling: RFC 9112 §3.2 keeps `#` out of a request target, so a
  `#` is a byte of the path or of the last value.
