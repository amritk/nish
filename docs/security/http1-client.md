# Security record: HTTP/1.1 — the client's request writer and response parser

The record of the sans-IO HTTP/1.1 client, `nish/net/http1-client`: the
request writer (`http1WriteRequestHead`, `http1RequestHead`) and the
incremental response parser (`Http1ResponseParser`). It says what each
refuses and with which code, what it caps and where the cap is set, what it
keeps in memory, and the test that pins each property. It is written with the
code rather than after an audit, so that the audit of the protocol stack
starts from evidence. Anchors are at `7417fbe`, on `main` at `2cdef4f`.

**Result.** Every response-smuggling shape RFC 9112 names is refused, never
repaired, with its own `HTTP1_E_` code, and a refusal is final. The events,
the de-chunked body and the error code are the same however the input is cut.
A panic is only ever the program's own mistake (a `feed` window outside its
buffer, more than 2^30 bytes fed and not read). Every cap is a number the
program passes to the constructor, or a constant of the module. The writer
counts and checks the whole head before it writes a byte, so a caller's
string cannot end a line or frame the body. One finding is open: HC-1 (Low),
the memory each response's fields leave in the arena.

## Scope

| File | Functions |
| --- | --- |
| `std/net/http1-client.ts` | `http1WriteRequestHead`, `http1RequestHead` and their helpers (`http1ClientRequestNeed`, `http1ClientTargetOk`, `http1ClientPutField`, `http1ClientPutHead`, `http1ClientListHas`); `Http1ResponseParser` (`expect`, `feed`, `finish`, `next`, `keepAlive`, `header`, `buffered`, `tunnelBytes`) and its helpers (`http1ClientReserve`, `http1ClientClamp`, `http1ClientFail`, `http1ClientStartHead`, `http1ClientStartResponse`, `http1ClientTakeLine`, `http1ClientStatusLine`, `http1ClientFieldLine`, `http1ClientDigitAt`, `http1ClientLengthList`, `http1ClientTally`, `http1ClientConnectionHas`, `http1ClientEndOfHead`, `http1ClientChunkSize`, `http1ClientBodyWindow`, `http1ClientCloseBody`, `http1ClientNext`) |

Out of scope: `std/net/http1.ts`, whose byte classes, text helpers and chunk
writers the client imports and whose record is
[`http1.md`](http1.md); the exports this module added to it change no
behaviour. The socket, TLS and the URL a request is made from belong to the
stages that drive this parser, not to it.

## Threat model

The attacker is the server, or anything on the path to it: every byte of the
response is theirs, split anywhere, and they may send interim responses
without end, a body slowly or never, more than one response for one request,
and close the connection at any byte. A win is a panic, memory or time a
server can make the client spend without bound, a response the program sees
that a proxy on the path would frame differently (so that the next response
on the connection is one the attacker wrote), a cut-short body taken for a
whole one, or a request split by a caller's string. The program driving the
parser is trusted; its mistakes panic or are refused, and what it asks the
writer to send is checked so that its strings cannot end a line.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| HC-1 | Low | `std/net/http1-client.ts` (`http1ClientFieldLine`, `http1ClientStartHead`, `Http1ResponseParser.reason` and `errorText`) | Each response's field names and values, and its reason phrase, are kept as strings, and the arrays that hold them are made again for each response, so they stay in the arena until the program resets it. Measured at 59,392 bytes over 1,000 kept-alive responses of 83 bytes with three fields. It is bounded for each response by `maxHeaderBytes` (and by `HTTP1_MAX_INFORMATIONAL` interim heads for each request), and the number of responses is the number the program reads: a server that sends responses nobody asked for is read only by a program that keeps calling `next()` past the response it awaited. | **Open, accepted for now.** A per-connection arena closes it, as for H1-3 and TLS-3; so would spans into the input, as the server parser keeps with `keepText` off, at the price of a `header()` that answers a window instead of a string. |

## Fuzzing

Fuzzed by `tests/fuzz/targets/http1-client.ts`, from its seed corpus in
`tests/fuzz/corpus/http1-client/` (sixteen inputs: both framings, a body read
until close, interim responses, pipelined keep-alives, HEAD, a CONNECT
tunnel, the smuggling shapes, an obs-fold, a 101 and the small limits). The
target's first byte picks small or usual limits, whether the response
answers a HEAD or a CONNECT, whether each piece is fed as its own array and
whether `finish()` follows the last piece; the next four bytes cut the rest
into pieces. It reads the response whole and cut, and panics when the two
digests of the events, statuses, fields, de-chunked body, tunnel and error
code differ, on a status outside 100 to 999, on names and values of
different lengths, on a body window outside its buffer, on more body than
`maxBody`, on `HTTP1_UPGRADE` without a CONNECT, on an error code outside 1
to 17 or an error that leaves bytes buffered, and on an unknown event.

The sanitizer runtimes libFuzzer needs were not installed where this stage
was written, so the target was built against `tests/fuzz/harness.c` with a
plain driver instead: the corpus replays clean, and 15,000,000 inputs mutated
from it (three seeds of 5,000,000) found no panic and no split disagreement.
That is not a libFuzzer campaign. CI's fuzz smoke job builds and replays the
target and its corpus on each PR, and the weekly job fuzzes it for 30 minutes
under the sanitizers, from the directory with no list to edit; a finding
there adds a row to Findings above, with its input kept as a regression.

## Properties verified

Each property below is pinned by a check that fails if it stops holding. The
checks are in `tests/link/net_http1_client/checks.ts`, run by
`tests/link/net_http1_client` and its `_f64` twin as
`link/net_http1_client: exits with 0 and stdout matches expected.out` and
`link/net_http1_client_f64: exits with 0 and stdout matches expected.out`
(the template `link/${name}: exits with ${wantCode} and stdout matches
expected.out` in `tests/run.js`); each check's own line is in
`expected.out`.

**Cut anywhere, framed the same.** A corpus of kept-alive responses with
`Content-Length`, a chunked response with an extension and a trailer, interim
responses, a body read until close, HTTP/1.0 keep-alive, `Connection: close`,
HEAD and 304, a CONNECT tunnel and a 407 to CONNECT, a body cut short and
each smuggling shape is fed whole, cut in two at every byte and fed a byte at
a time, and gives the same transcript every way (`… : the same cut at every
byte and fed a byte at a time`). A refusal is decided by the same byte
wherever the input was cut: a line over its limit is refused before the bare
LF check, so `a status line over the limit, ended in a bare LF past it` is
the same refusal however the LF arrives.

**Response smuggling refused** (RFC 9112 §6.1, §6.3, §7.1): `Transfer-Encoding`
with `Content-Length` (`HTTP1_E_FRAMING`, on a 204 too), two lengths or a
list of lengths that differ, a length that is not a run of digits, signed,
negative or empty (`HTTP1_E_LENGTH`, on a 304 and a response to HEAD too, so
a smuggled field fails where it is ignored), a coding other than one
`chunked` last, `chunked` twice, gzip before chunked, `Transfer-Encoding` in
an HTTP/1.0 response (`HTTP1_E_CODING`), a bare LF anywhere a line ends
(`HTTP1_E_BARE_LF`), an obs-fold, whitespace before the colon, a control
byte in a value (`HTTP1_E_FIELD`), a chunk size with no digits, a `0x`, BWS
with no extension, a control byte in an extension, chunk data longer than
its size or followed by anything but CRLF (`HTTP1_E_CHUNK`), and a 101 the
client never asks for (`HTTP1_E_SWITCH`) — each `refused with N (…)` line.
A 2xx to CONNECT is a tunnel whose framing fields are ignored (RFC 9110
§9.3.6), and any other answer to CONNECT has a body like any response.

**A cut-short body is never whole.** A close inside the status line, the
header section, a chunk, before the last chunk, inside the trailers or after
an interim response is `HTTP1_E_TRUNCATED`; a close after a whole response,
or with nothing fed, is `HTTP1_CLOSED`; a body without framing ends only at
the close.

**Final states.** An error, a close and `Connection: close` repeat their event
on every later call and drop what is fed after them (`an error is final`,
`and the bytes fed after it are dropped`, `bytes fed after the close are
dropped`); `keepAlive()` is false after an error, a body read until close and
a tunnel. `expect` takes effect only while the parser waits for a response's
first status line and is forgotten after its end (`expect inside a response
does nothing: its body still comes`, `expect is forgotten after HTTP1_END:
the next 200 has a body again`, `expect after an interim response does
nothing: HEAD still holds`).

**Caps, all fixed at construction.** The status line (`maxStatusLine`), the
header section (`maxHeaderBytes`), the fields of a response, its trailers
included (`maxHeaders`), the body however it is framed (`maxBody`, checked
against a declared length before a byte of it is read), the trailer section
(`maxTrailerBytes`), each pinned exactly at its limit and one past it, and
a body exactly at `maxBody` handed out whole however it is framed (`… at the
limit, whole`); a
chunk-size line (`HTTP1_MAX_CHUNK_LINE`, 4,096 bytes) and the interim
responses to one request (`HTTP1_MAX_INFORMATIONAL`, 32, counted again for
each request). Negative limits are clamped to 0, each `i32` limit to 2^30 and
`maxBody` to 2^53, so that no sum the parser makes overflows: with every
`i32` limit at 2^31 - 1 and `maxBody` at 2^62 an ordinary response is read,
a `Content-Length` of 2^53 is a head and one of 2^53 + 1 is over the body
limit (`the largest limits read an ordinary response`, `one of 2^53 + 1 is
over it`). A length past 2^63 or a chunk size past 64 bits is over the body
limit, not wrapped. A `Content-Length` past 2^53 given more than once is
refused as values that differ, whatever the values, since two saturated
values cannot be compared, on a 304 too. A
`Content-Length` over `maxBody` on a response to HEAD is not refused, since
no body is read. What is buffered is the input fed and not yet read: a line
in progress is held only up to its limit, body bytes are handed out as they
arrive, and the program decides how much it feeds before it reads; a tunnel
keeps what is fed after it for `tunnelBytes()` until the program stops
feeding. A feed that outgrows the buffer while a head is part-read moves the
live bytes into the larger one (`a head left part-read when a feed outgrows
the buffer`).

**OWS is trimmed before a field is judged.** A `Content-Length`,
`Transfer-Encoding` or `Connection` value is trimmed at both ends, and each
element of its list too, before its framing or the connection's fate is
decided (`read: OWS …`).

**What the program writes is checked** (`refused: …`). The writer refuses,
with `HTTP1_REFUSED` and nothing written, a method that is not a token, a
target that is not a form the method may send (origin-form or absolute-form,
authority-form for CONNECT with a port of at most five digits and no
userinfo, `*` for OPTIONS; a `host:port` with another method is well-formed
absolute-form, the host its scheme, and is sent) or that holds a space, a control byte, DEL, a
non-ASCII byte or a `#`; a field name that is not a token; a value holding CR,
LF or another control byte; not exactly one `Host`; the caller's own
`Content-Length` or `Transfer-Encoding`; a `Connection` that lists `upgrade`;
names and values of different lengths; a body length below -2. The head is
counted in 64 bits before a byte is written, so `HTTP1_NO_ROOM` (one byte
short, a negative offset, an offset past the end) and `HTTP1_REFUSED` leave
the buffer untouched (`and writes nothing`). The server parser of
`nish/net/http1` reads what the writer writes (`the server parser reads the
head`).

**A window outside the buffer panics.** `feed` with a window outside its
array is the program's mistake and panics before anything is read:
`tests/link/net_http1_client_feed_window`, run as
`link/net_http1_client_feed_window: exits with 1 and stdout matches
expected.out`.

**What no check reaches.** Every branch of `std/net/http1-client.ts` is run
by the checks above but these, measured with V8 coverage on the module's
`--emit-ts` output. The panic when more than 2^30 bytes are fed and not read
would need a feed past 1 GiB. The rest are invariant guards that no input
can reach and that let the compiler drop a bounds check: the
return of `http1ClientPutField` for a field index out of range, whose
callers pass only indexes they loop over, and the `: buf.length` arm of the
line-end clamps in `http1ClientStatusLine`, `http1ClientFieldLine` and
`http1ClientChunkSize`, whose line end the parser found inside the buffer.
