# Security record: HTTP/1.1 — the parser, the server and its carriers, WebSocket

The record of WP34's lane H1: `nish/net/http1` (the incremental request parser
and the response writers), `nish/net/http1-server` (the server side of a
connection, and its two carriers: plain TCP on `nish:net` and TLS on
`nish/net/tls-tcp` with ALPN `http/1.1`) and `nish/net/websocket` (RFC 6455
framing and the opening handshake, both the server's accept and the client's
request and check of the server's answer). It says what
each refuses and with what, what it caps and where the cap is set, what it
keeps in memory and for how long, and the test that pins each property. It is
written with the code rather than after an audit, so that the audit of the
protocol stack starts from evidence.

**Result.** Every request-smuggling shape RFC 9112 names is refused, never
repaired, and the refusal is answered with its status and a close; none is a
panic. A panic is only ever the program's own mistake (a window outside its
buffer, a cap out of range). Every cap is a number the program fixes at
start-up. A warmed slot serves request after request — heads, bodies either
way, responses with a length or chunked — with `Arena.used()` flat, over plain
TCP and over TLS. H1-1 (Medium), a client that trickles the bytes of its head
to keep its slot, is fixed by a deadline for the whole head. H1-5 (Medium), a
response written at `H1_END` framed from a head already reset, is fixed by
holding the head until the next request is asked for. Two findings are
open: H1-2 (Low), no lingering close after a refusal over plain TCP (TLS lingers, TLS-6); and H1-3 (Low), the
memory each WebSocket upgrade leaves behind. The client's side of the
handshake refuses every answer RFC 6455 §4.1 tells a client to fail, each
with its own `WS_HS_*` code; it adds no finding.

## Scope

| File | Functions |
| --- | --- |
| `std/net/http1.ts` | `Http1Parser` (`feed`, `next`, `restart`, the span accessors `header`, `headerIndex`, `headerIs`, `methodIs`, `targetIs`, `upgradeIs`, `buffered`, `resting`) and its helpers (`http1TakeLine`, `http1RequestLine`, `http1FieldLine`, `http1EndOfHead`, `http1Tally`, `http1ContentLength`, `http1ChunkSize`, `http1BodyWindow`, `http1HeadAppend`); the writers `http1ResponseHead`, `http1WriteResponseHead`, `http1Chunk`, `http1WriteChunk`, `http1LastChunk` |
| `std/net/http1-server.ts` | `Http1Connection`: `feed`, `inputRoom`, `next`, `nextRequest`, `nextFrame`, `fail`, `respond`, `write`, `end`, `acceptWebSocket`, `sendFrame`, `closeWebSocket`, `sendPong`, `sendClose`, `restart`, `acquire`, `release`, `park`, `unpark`; `Http1OutputPool` (`take`, `give`); `Http1Server` and `Http1TlsServer`: `accept`, `readable`, `writable`, `next`, `flush`, `send`, `close`, `expire`, `refused`; `Http1Server.rearm`; `HttpDate` (`current`, `pin`, `unpin`) |
| `std/net/http-fields.ts` | `httpDateWrite` and its helpers (`httpFieldsPutName`, `httpFieldsPutTwo`) — the date alone; the header model is `docs/security/http2.md`'s |
| `std/net/websocket.ts` | `WsDecoder` (`feed`, `next`, `reset`), `websocketWriteFrame`, `websocketFrame`, `websocketRequestKey`, `websocketUpgradeResponse`, `websocketClosePayload`, `websocketIsUtf8`; the handshake's `websocketAcceptKey`, `websocketKeyIsValid`, `websocketOfferedProtocols`; the client's `websocketClientKey`, `websocketUpgradeRequest`, `WsHandshake`, `websocketCheckResponse` and their helpers (`websocketSpanIs`, `websocketListInto`, `websocketListHas`) |

Out of scope: TLS (`docs/security/tls.md`, whose TLS-3 and TLS-4 the TLS
carrier inherits), `nish:net`, and `nish/crypto/sha1`, which only computes the
accept key. The external suites — `curl`, the Autobahn suite's server cases —
run in S2's interop job against the `serve` mode of
`tests/link/net_http1_server`, not here.

## Threat model

The attacker is the client: every byte is theirs, split anywhere, and they may
pipeline requests, stop reading, send a body slowly or never, upgrade and send
frames in any order, and hold the connection open. A win is a panic, memory
or time a client can make the server spend without bound, a request the
program sees that a different HTTP/1.1 parser would frame differently (the
shapes that smuggle a second request past an intermediary), a response split
by a caller's string, or a response sent to the wrong request. The program
driving the connection is trusted; its mistakes panic or are refused, and
what it writes is checked so that its strings cannot end a line.

As a WebSocket client (`websocketUpgradeRequest`, `websocketCheckResponse`)
the attacker is the server, or whoever stands between it and a client over
plain TCP: every byte of the answer is theirs. They may answer with another
status (a redirect, a 200 with a body), with HTTP/1.0, without `Upgrade` or
`Connection`, with a forged `Sec-WebSocket-Accept` or one for another key, with
an extension or a subprotocol the client never offered, or with frame bytes
glued to the head. A win is a panic, a connection the client takes for a
WebSocket that the server did not accept for its key, a protocol or extension
it did not ask for, or frame bytes read as HTTP (or HTTP as frames). The
client's randomness is the program's: the module draws none, and takes the
nonce and every mask key from the caller.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| H1-1 | Medium | `std/net/http1-server.ts` (`Http1Server.expire`, `Http1TlsServer.expire`, `Http1Connection.idle`; the fix in `Http1Connection.headArrived`, `headAwaited`, `headLate`, `expired`, `nextRequest`, `Http1Server.readable` and `Http1TlsServer.readable`, written against `main` at `804120e`) | The idle timeout counts from the last byte moved, so a client that sends one byte of its head every `idleTimeout` (slowloris) keeps its slot for as long as it likes, and with every slot held new connections are shed (`H1_POOL_FULL`). Memory stays bounded: the head is capped by `maxHeaderBytes`, the slots by the pool. | **Fixed.** `Http1Config.headTimeout` (30 s by default, checked at start-up beside `idleTimeout`, which refuses 0 or less) is a deadline for a whole head, counted from the clock the carrier reads when the head's first bytes arrive and cleared only when the head is read whole (`nextRequest`) or the slot is restarted, so neither a trickle nor bare CRLFs restart it. `expire(now)` closes a slot that is idle or whose head is past its deadline (`expired`), on both carriers. The plain carrier starts the clock when a read leaves head bytes in the parser (`headArrived`). The TLS carrier starts it on any ciphertext once the handshake is done (`headAwaited` in `readable`), since a record trickled a byte at a time hands over no plaintext until it is whole; so a TLS client that finishes its handshake and then sends nothing is closed after `headTimeout`, too. A head pipelined behind an open exchange waits without a clock only while that exchange is open: its clock starts when the exchange ends (`nextRequest`). Tests: `a head still unfinished past headTimeout closes its slot, though the slot is not idle`, `and its client sees the end, while the kept-alive client's slot stays open`, `a second piece of a head leaves its clock where the first piece started it`, `a head finished in pieces within headTimeout is answered`, `and the pipelined head, still unfinished past headTimeout, closes the slot`, `a TLS head still unfinished past headTimeout closes its slot`, `a TLS record still unfinished past headTimeout closes its slot, though it has handed over no plaintext` in `tests/link/net_http1_server` and `_f64` (run as `link/net_http1_server: exits with 0 and stdout matches expected.out` and its `_f64` twin), and `tests/link/net_http1_server_bad_head_timeout`; the first two fail on the base, and the pipelined one and the TLS record one fail on a clock started only where plaintext is read. An alert or `close_notify` after the handshake starts the clock too, harmlessly, since the slot closes on it anyway; so does a post-handshake message such as a `KeyUpdate` on a kept-alive slot, which then has `headTimeout` rather than `idleTimeout` to send its next head, a shorter wait only where `headTimeout` is set below `idleTimeout`. What it does not bound: a body sent slowly (the idle timeout still restarts on each of its bytes; `nish/net/handler` bounds it with `bodyTimeout`, HANDLER-5 in `docs/security/handler.md`), and the TLS handshake itself, which `idleTimeout` alone bounds (TLS-4). |
| H1-2 | Low | `std/net/http1-server.ts` (`fail`, the carriers' `close`) | After a refusal the response is sent and the socket closed at once, without the lingering close RFC 9112 §9.6 describes. A client still sending a body when the socket closes may get a TCP reset that discards the error response before it reads it. Nothing is accepted that should not be: the effect is a client that sees a reset instead of a 413 or 400. | **Open** for `Http1Server` (plain TCP). Over TLS, `Http1TlsServer`'s carrier lingers after every close the server makes, a refusal's included: TLS-6 in [`tls.md`](tls.md), its wait bounded by `idleTimeout`. The same half-close (`netShutdown` for writing) and a short drain before `close` is the follow-up for plain TCP. |
| H1-3 | Low | `std/net/http1-server.ts` (`acceptWebSocket`), through `std/net/websocket.ts` (`websocketRequestKey`, `websocketUpgradeResponse`) | Accepting a WebSocket leaves 58 bytes in the arena (the key and the accept key as strings, measured over 1,000 upgrades of one connection) until the program resets it. It is once a connection, not once a message, and bounded by the connection rate the pool allows — the shape of TLS-3 at a thousandth of its size. | **Open, accepted for now.** The same per-connection arena that closes TLS-3 closes it; the frames themselves allocate nothing. Writing the accept key into storage the connection owns, as `HpackDecoder` does for H2-1, does not close it alone: the key is hashed by `sha1` in `nish/crypto/sha1`, which answers a new array, and base64-encoded by a helper that answers a string, so the fix needs a SHA-1 and a base64 that write into a caller's buffer, outside this record's files. |
| H1-4 | Low | `std/net/http1-server.ts` (`Http1Connection.expiresNoSooner`, read by `Http1Server.expire` and `Http1TlsServer.expire`) | `expire` walks every slot only when the soonest one can be due, but that bound counted a head clock not yet started from the slot's last move, so a kept-alive slot quiet for longer than `headTimeout` (30 s by default) put it in the past and every `expire` walked every slot. Clients that hold quiet keep-alives, a few hundred of 30,000 in a benchmark with 7 s think times, made the work of each turn of the loop grow with the number of connections: about a third of a server's CPU there. Nothing is closed that should not be. | **Fixed.** `expiresNoSooner(now)` counts a head clock not yet started from `now`, since one started later starts no sooner, and keeps `lastActive + idleTimeout` and a started clock's `headSince + headTimeout`. While an exchange is open it counts from `lastActive`, since `nextRequest` starts a pipelined head's clock there when the exchange ends, which can be before `now`; a slot quiet past `headTimeout` with its exchange still open (a slow handler) still makes `expire` walk every slot, which is rare and no worse than the base. Tests: `a kept-alive slot quiet past headTimeout is due no sooner than later` and `a head pipelined behind an open exchange is due no later than its bound says` in `tests/link/net_http1_server` and `_f64`; the base cannot build the first (`expiresNoSooner` took no `now`) and its bound there is past, and the second fails on a clock not yet started counted from `now` alone. |
| H1-5 | Medium | `std/net/http1.ts` (`Http1Parser.next`, `resting`, `http1StartRequest`, the field `headHeld`), read through `std/net/http1-server.ts` (`Http1Connection.respond`, `acceptEncoding`, `respondEncoded`) | On a kept-alive request the parser reset its head (method, target, version, fields, keep-alive) as it reported `HTTP1_END`, before the program had answered. A response written at `H1_END` was framed from the reset head: a `HEAD` request was answered with a body, which a client or a proxy sharing the connection reads as the start of the next response, and an HTTP/1.0 keep-alive client was answered with chunked framing it cannot read, since the reset version was 1.1. `acceptEncoding()` and `targetIs` read nothing there either. | **Fixed** (option 1: keep the head, copy nothing). At the keep-alive `HTTP1_END` the parser moves to the request line but holds the head (`headHeld`); the next `next()` resets it before it reads any byte of the next request. The server calls `next()` again only once the response is done (`nextRequest`), so the head stays this request's for its whole response whatever pipelined bytes are fed behind it, and nothing is copied or allocated. `resting()` is false while a head is held, so a slot is not taken for idle with a request still unanswered. Tests: every line of `tests/link/std_http1_end_head` (run as `link/std_http1_end_head: exits with 0 and stdout matches expected.out`); against the base std, 14 of its 49 checks fail, among them `HEAD: no body is owed`, `HEAD: the output is the head alone`, `HTTP/1.0: not chunked`, `pipelined: acceptEncoding at H1_END is the first's gzip`, `fed after: the held head is still the first's` (the next request's bytes fed after `H1_END`, enough to grow the input buffer) and `router: at H1_END the first's route, not a 404`. |

## Fuzzing

Fuzzed by `tests/fuzz/targets/http1.ts`, `tests/fuzz/targets/websocket.ts`,
`tests/fuzz/targets/websocket-client.ts`.

| Target | What it drives | Executions |
| --- | --- | ---: |
| `http1` | the HTTP/1.1 parser fed in pieces under small or default limits, chunked bodies, an upgrade declined or taken, checking every refusal is a 4xx or 5xx | 57,537,869 |
| `websocket` | the WebSocket frame reader with masking required or not and a message cap of 0, 16, 125 or 65,536 bytes, checking text is UTF-8, every frame round-trips through `websocketFrame`, and pong and close payloads | 117,903,219 |
| `websocket-client` | a server's answer to the client's upgrade, offering none, either or both of `chat` and `superchat`, fed whole or in pieces of 1 to 255 bytes through `Http1ResponseParser` told to expect the upgrade, then `websocketCheckResponse` and a client's `WsDecoder` over the bytes past the head; checking that only a 101 to HTTP/1.1 is accepted, that its accept never matches another key, that its protocol is one offered, and that text frames are UTF-8 | not yet run |

`websocket-client` has not run under libFuzzer: the session that wrote it had
no `libclang-rt`. Its 18 seeds in `tests/fuzz/corpus/websocket-client/` (an
accepted 101 with and without a protocol and with a frame glued on, and each
refusal, a missing `Sec-WebSocket-Accept` among them) were replayed through `fuzzOne` linked natively against
`tests/fuzz/harness.c`, with 4,000 mutations of them besides, without a crash;
its 31-minute run is owed with the next fuzzing pass.

The other targets each ran for 31 minutes (1,861 s, one core each, four at a time) on commit `b52b765`, starting from its seed corpus in `tests/fuzz/corpus/<target>/`, with libFuzzer's `-timeout=1 -rss_limit_mb=2048`; every panic, sanitizer report, timeout and OOM counts as a finding. **None found**: no crash, timeout or OOM (a target's own contract check fails by panicking, so it counts too). The libFuzzer harness these targets build against lands with the harness stage of #888; a new finding adds a row to Findings above, with its input kept as a regression and a link check that replays it.

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**Cut anywhere, framed the same** (`tests/link/net_http1`, `_f64`): a corpus
of pipelined keep-alive requests, both body framings, an upgrade and the
smuggling shapes, fed whole, cut in two at every byte and fed a byte at a
time, gives the same transcript every way — by a parser that keeps the head as
text and by one that keeps only spans (`keepText` off, the server's), whose
heads must describe the same request byte for byte. Over loopback
(`tests/link/net_http1_server`, `_f64`) a chunked POST with an extension cut at
every byte, and sent a byte at a time, is echoed whole every time.

**Request smuggling refused** (`net_http1` for the parser, `net_http1_server`
through the server): `Content-Length` with `Transfer-Encoding` (RFC 9112
§6.1), two `Content-Length` fields, conflicting or not, one that is not a run
of digits, `Transfer-Encoding` in HTTP/1.0 or not ending in `chunked`, an
obs-fold, a bare LF, whitespace before a colon, a malformed chunk size or
chunk terminator — each a 400, never a guess. Through the server each is
answered with its status, `Content-Length: 0` and `Connection: close`, and the
connection ends: 400 (a chunk size that is not hex, both length fields, two
lengths that disagree, an obs-fold, a missing `Host`), 413 (a body past
`maxBody`), 414 (a target past `maxTarget`), 431 (a header section past
`maxHeaderBytes`), 501 (a coding other than `chunked`), 505 (HTTP/2.0 in a
request line). A refusal after a good pipelined request answers the good one
first. A refusal once a response has started (a bad chunk size in a body the
program is echoing) sends no second response and ends the connection.

**A control byte in a field value is refused wherever it falls**
(`net_http1`, `_f64`): the scan for a line's end reads sixteen bytes at a time
while a whole block is field text, then a byte at a time, and it is also the
check of the value: a control byte other than HTAB, or DEL, on a field line
is a 400, with no second pass over the value. NUL, 0x01, 0x1f, DEL and a bare
CR placed at each of the forty bytes of a long value are each refused, and
HTAB and an obs-text byte at each of them are read. At the block boundaries
the stream is also cut at every byte, so a CR that ends what has arrived so
far is read again with the byte after it, never taken as a line end or a
refusal on its own.

**One exchange at a time, in order** (`net_http1_server`): pipelined requests
are answered in the order they came, because the next head is not read until
the current response has ended and the current body has been read to its end;
a pipelined pair and a refusal behind a good request pin it. Pipelined bytes
wait in the parser's buffer, and once `inputLimit()` of them wait the slot
stops asking to be read.

**The head stays the request's until it is answered** (`std_http1_end_head`):
at `HTTP1_END` of a kept-alive request with the next one already fed behind
it, the parser still reports the first request's method, target, fields,
version and keep-alive, and is not resting; the next `next()` reads the second
whole. Through the server, `acceptEncoding()` and `targetIs` at `H1_END` are
the first request's, a `HEAD` answered there gets no body, and an HTTP/1.0
keep-alive request answered there is not sent chunked (H1-5).

**Streaming both ways, bounded** (`net_http1_server`): a 2 MiB body with a
length and three hundred chunks in are echoed through a 4 KiB chunk and an 8
KiB output, and no `H1_BODY` hands over more than `chunkSize`; a 2 MiB chunked
response goes out as the socket drains. A write the output cannot take
answers what it took, the connection reads nothing until half the output is
free (so the window the program writes from stays valid), and `H1_WRITE` says
when to go on. The sans-IO checks drive each held-back path: a head, a chunk,
the last chunk and a frame that do not fit, and the room each waits for.

**What the program writes is checked** (`net_http1`, `net_http1_server`): a
status outside 100 to 599, 101 through `respond`, a field the server decides
(`Connection`, `Upgrade`, `Keep-Alive`, `Transfer-Encoding`,
`Content-Length`), a name that is not a token, a CR, LF or other control
character in a value or the reason, no body on a response that needs one, a
head larger than the output, a second response, more body than the length,
`end` while the length is owed — each `H1_INVALID` or `H1_CLOSED`, and nothing
is written. `http1WriteResponseHead` counts the whole head before it writes a
byte, so `HTTP1_NO_ROOM` and `HTTP1_REFUSED` leave the buffer untouched. A
response to HEAD, a 204 and a 304 carry no body whatever the program writes; a
chunked response to HTTP/1.0 goes unframed and ends with the connection.

**One Date, from one clock read a second** (`net_http_date`, `_f64`;
`net_http1`, `net_http1_server` and their `_f64` twins; written against `main`
at `249cbe9`, cited by function rather than by line). Every final response,
an error included, carries a `Date` (RFC 9110 §6.6.1) and a 1xx carries none;
a program's own `date` field, in any case, is sent instead of the server's, so
a response never carries two. On a final status `http1WriteResponseHead`
refuses a date that is not field text, so the date cannot split the head (a
1xx never sends it, so there it is not read), and counts its 37 bytes
before it writes, so `HTTP1_NO_ROOM` still leaves the buffer untouched. The
largest head `fail` writes — 431's status line, the date, `Content-Length: 0`
and `Connection: close` — is 123 bytes, inside the 256 kept for what the
connection writes itself. `httpDateWrite` agrees with a calendar counted a
day at a time on every day from 1970 to 2399 and refuses, writing nothing, a
second it cannot name in four digits or a buffer without the room. `HttpDate`
formats once a second however often it is read, in either direction of a
clock step, with `Arena.used()` flat; a pool's slots share one. Tests:
`link/net_http_date: exits with 0 and stdout matches expected.out`,
`link/net_http_date_f64: exits with 0 and stdout matches expected.out`,
`link/net_http1: exits with 0 and stdout matches expected.out`,
`link/net_http1_f64: exits with 0 and stdout matches expected.out`,
`link/net_http1_server: exits with 0 and stdout matches expected.out`,
`link/net_http1_server_f64: exits with 0 and stdout matches expected.out` —
each the template `link/${name}: exits with ${wantCode} and stdout matches
expected.out` in `tests/run.js`.

**Connection management** (`net_http1_server`): `Connection: close` in a
request is answered with it, and the connection closes; HTTP/1.0 closes unless
it asked for keep-alive, which is then answered with `Connection: keep-alive`;
an upgrade the program answers without switching leaves the connection reading
HTTP; `Expect: 100-continue` may be answered with a 100 before the body. A
request cut short by the end of the stream ends the connection; a client gone
in the middle of a response fails the write and frees the slot.

**WebSocket** (`net_websocket`, `net_http1_server`): the opening handshake is
accepted only when `websocketRequestKey` finds one (GET, HTTP/1.1, exactly
`Upgrade: websocket` with `Connection: upgrade`, version 13, a valid key),
and the 101 carries RFC 6455 §1.3's accept key. Bytes sent with the handshake
are the first frames. A ping is answered with its pong and a close with a
close of its code (an empty close for none), from 256 bytes of output kept for
what the connection writes itself. An unmasked frame is closed with 1002 and a
message past `maxMessage` with 1009, refused from the frame's header. A frame
larger than the output, a close through `sendFrame` and a close code that may
not be sent are refused.

**WebSocket client** (`net_websocket`, `net_http1_client`, `net_loopback`):
`websocketClientKey` makes a key only of a 16-byte nonce (`refused client key:
a 15-byte nonce`, `a 17-byte nonce`, `no nonce`; `the §1.3 nonce gives the §1.3
key`). `websocketUpgradeRequest` writes the request through
`http1UpgradeRequestHead`, so its host, target and protocols cannot end a line,
and refuses an empty host, an invalid key, and a protocol that is empty, not a
token or offered twice (the `refused request: …` checks: `an invalid key`, `a
protocol that is not a token`, `a protocol holding a comma`, `an empty
protocol`, `a protocol offered twice`, `CR LF in the host`, `an empty host`,
`CR LF in the target`, `CR LF in a protocol`). `websocketCheckResponse` checks
RFC 6455 §4.1's list in order and answers the first failure: a status other
than 101, a redirect included, is `WS_HS_STATUS` and never followed (`refused
check 1: a 302 is not followed`, `a 200`); HTTP/1.0 is `WS_HS_VERSION`
(`refused check 2: an HTTP/1.0 101`); `Upgrade` missing, twice or not
`websocket` is `WS_HS_UPGRADE` (`refused check 3: no Upgrade`, `Upgrade: h2c`,
`Upgrade twice`); no `Connection` listing `upgrade` is `WS_HS_CONNECTION`
(`refused check 4: no Connection`, `Connection without upgrade`); an accept
missing, twice, forged or for another key is `WS_HS_ACCEPT`, and an invalid
key matches no accept (`refused check 5: no Sec-WebSocket-Accept`, `a forged
Sec-WebSocket-Accept`, `Sec-WebSocket-Accept twice`, `an accept for another
key`, `an invalid key matches nothing`); any `Sec-WebSocket-Extensions` is
`WS_HS_EXTENSION`, since the client offers none (`refused check 6: a
Sec-WebSocket-Extensions`); and a protocol not offered, a list, the field
twice, or one in another case is `WS_HS_PROTOCOL` (`refused check 7: a
protocol when none was offered`, `a protocol that was not offered`, `a protocol
list`, `Sec-WebSocket-Protocol twice`, `a protocol in another case`). A 101 is
read only by a parser told `expectUpgrade` (in
[`http1-client.md`](http1-client.md)), so frame bytes glued to the head are
handed over by `tunnelBytes` and read as frames, never as HTTP (`glued: the
frame past the head is a message`, `and it says Hello`). Over the loopback,
plain and TLS, each connection draws a fresh nonce and every frame a fresh mask
from `crypto.getRandomValues` (`websocket: websocketCheckResponse accepts the
101 and its accept for the random key`, `websocket: the second connection drew
a key of its own`).

**Caps, all fixed at start-up** (`Http1Config`): the request target
(`maxTarget`, 8,192), the header section and each trailer section
(`maxHeaderBytes`, 16,384) and its fields (`maxHeaders`, 100), a request body
(`maxBody`, 2^30), the most body one `H1_BODY` hands over and one read takes
(`chunkSize`, 16,384), the output (`outputSize`, 64 KiB, of which 256 bytes are
kept for what the connection writes itself; a pool's slots borrow it from one
`Http1OutputPool` while they write, below), a WebSocket message
(`maxMessage`, 1 MiB), the idle timeout (`idleTimeout`, 60 s, read by
`expire`) and the deadline for a whole head (`headTimeout`, 30 s, read by
`expire`; H1-1). The slots are the pool's size. An `Http1Server` builds a slot's
connection on the first accept into it and keeps it, so it never holds more
than `size` connections, each within the caps above, and holds none it has
not needed: a pool of 16,384 takes 16,688 bytes before its first connection
(`HTTP1_SERVER_START_BYTES`, "net_http1_server: a 16,384-slot Http1Server
takes at most HTTP1_SERVER_START_BYTES before its first connection"), and the
connection past `size` busy slots is shed with `H1_POOL_FULL` without one
being built. A slot never accepted into answers like a closed one
(`net_http1_server`). `Http1TlsServer` does the same over a `TlsTcpServer`
that does it too: a slot's `Http1Connection`, `TlsRecordServer` and server
random are built on the first accept into it, so a pool of 16,384 takes
58,296 bytes before its first connection (`HTTP1_TLS_SERVER_START_BYTES`, the
templated "`${unit}: a 16,384-slot ${name} takes at most ${ceilingName}
before its first connection`" run for `Http1TlsServer`), and the
handshake is restarted with real randomness and the key on every accept, as
it was (TLS record, "Slots built on the first accept"). A slot never built
reads as a free one there too: its `connection`, `alpn` and `refused` answer a
connection no slot holds, with no ALPN and not refused, never slot 0's
("TLS: while slot 0 is open, a slot never built reads as a free one: not held,
no descriptor, no ALPN, not refused, not slot 0's connection"). `readable`,
`next` and `flush` act only on a slot `live` names, one `tls` holds with its
connection built, so a slot accepted on `tls` directly reads as free. A cap out of range
panics when the connection is made (`net_http1_server_bad_config`). The input the connection
buffers is the largest of `chunkSize`, a header line and a request line, so
any head the caps allow can be read.

**No cap lets a peer outgrow a buffer.** The buffers a peer's bytes fill —
the parser's input and head, the decoder's input — grow by doubling and stop
at 2^30, where growing further panics. So the constructor refuses a cap whose
buffer could need more: `maxMessage` above 2^30 − 14, since a frame is buffered
whole with its 14-byte header (`net_http1_server_bad_message`), and
`maxTarget + maxHeaderBytes` above 2^30 − 44, since the head holds the request
line beside the header section (`net_http1_server_bad_head`). At the largest
values accepted, an upgraded slot buffers exactly 2^30 bytes and an HTTP slot
less (`net_http1_server`). The review of #468 found the first (R1-1): before
it, a legal `maxMessage` of 2^30 let one frame panic the process.

**Nothing per request on a warmed slot.** A hundred GETs and a hundred chunked
POSTs on one plain connection, and fifty of each over TLS, move `Arena.used()`
across the servers' calls and the program's answers by 0 bytes
(`net_http1_server`). The parser keeps the head as spans in a buffer it grows
to the largest head it has seen and keeps; `restart` and `reset` allocate
nothing, so a slot is reused for the next connection as it is. The output is
borrowed, not kept: a slot holds a buffer only while it has bytes the socket
has not taken, so the plain checks run on one buffer and a slot whose client
stops reading holds one until it drains, then gives it back; fifty
connections in a row leave the pool's buffers all free (`net_http1_server`).

**Lent input, and what a lent buffer holds** (`net_http1_server`). With
`Http1Config.idleInput` a slot gives its parser's input and head buffers to
pools its server's slots share (`Http1Connection.park`, from `Http1Server.flush`
and `Http1TlsServer.flush` and at `restart`) only while it rests: speaking
HTTP, no request open, and `Http1Parser.resting()` (waiting for a request line,
nothing fed and unread). A slot still reading a head, owing a response, holding
pipelined bytes or upgraded keeps both, and `unpark` takes a buffer back in
`feed` before any byte is copied in. A lent buffer is not cleared: it holds the
bytes of the request it last carried, a password in a body included, until the
next slot to take it overwrites them. Nothing reads them, since a parser reads
only the window `[start, end)` it was fed and `park` resets that window to
empty; the bytes stay in the process's memory as they did before the option,
when each slot kept its own buffer with the same bytes in it. Tests: `two slots
served one after the other share one input and one head buffer`, `a
connection with a request open keeps them`, `so do they while a byte of the
next request is unread`, `and once nothing is open or unread both go back`,
`a pipelined pair on a slot that lent its buffers is answered in order`, and
`without idleInput a resting slot keeps its input buffer`.

**ALPN** (`net_http1_server`): a TLS handshake that chose `http/1.1`, or none,
is served; one that chose `h2` is shut down with `close_notify` before any
HTTP/1.1 byte.

**Idle slots** (`net_http1_server`): `expire(now)` closes a slot idle past
`idleTimeout` on either carrier and leaves one that has just moved; the client
sees the end. It closes a slot whose head is past `headTimeout`, on either
carrier, though bytes keep the slot from being idle — a head in pieces, a
head pipelined behind an exchange, a TLS record trickled a byte at a time —
and leaves a kept-alive slot whose exchange is over and a slow head that
finishes in time (H1-1). A kept-alive slot quiet past `headTimeout` is not yet
due, so it does not make every `expire` walk every slot (H1-4). The pool sheds
a connection past its size.

**The program's mistakes panic** (one program each): a window outside its
buffer in `Http1Connection.feed` (`net_http1_server_feed_window`), `write`
(`net_http1_server_write_window`) and `sendFrame`
(`net_http1_server_frame_window`), `http1WriteChunk`
(`net_http1_write_chunk_window`), `websocketWriteFrame`
(`net_websocket_write_window`), and the parser's and decoder's own `feed`
(`net_http1_feed_window`, `net_websocket_feed_window`).

## What is and is not wiped

HTTP/1.1 holds no key material: over TLS the record keys are TLS's
(`docs/security/tls.md`). What it holds is application data — the head in the
parser's `head` and input buffers, bodies in the input and output buffers,
WebSocket messages in the decoder's — which may carry credentials (`cookie`,
`authorization`). None of it is wiped: each buffer is overwritten by the next
request and zeroed by nothing, and it stays in the slot until then. An output
buffer is the exception to staying in its slot: a pool's slots borrow it from
an `Http1OutputPool` and give it back once sent, so the next connection to
write, on any slot, writes over the last one's response from the start. A
carrier sends only `output[outputStart .. outputEnd)`, the bytes this
connection wrote, so what lies past `outputEnd` is never sent; it is in the
process's memory as it was before, in a buffer that moves between slots.
