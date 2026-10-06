# Security record: HTTP/1.1 — the parser, the server and its carriers, WebSocket

The record of WP34's lane H1: `nish/net/http1` (the incremental request parser
and the response writers), `nish/net/http1-server` (the server side of a
connection, and its two carriers: plain TCP on `nish:net` and TLS on
`nish/net/tls-tcp` with ALPN `http/1.1`) and `nish/net/websocket` (RFC 6455
framing and the opening handshake, as far as the server uses it). It says what
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
TCP and over TLS. Three findings are open: H1-1 (Medium), a client that
trickles bytes keeps its slot; H1-2 (Low), no lingering close after a refusal;
and H1-3 (Low), the memory each WebSocket upgrade leaves behind.

## Scope

| File | Functions |
| --- | --- |
| `std/net/http1.ts` | `Http1Parser` (`feed`, `next`, `restart`, the span accessors `header`, `headerIndex`, `headerIs`, `methodIs`, `targetIs`, `upgradeIs`, `buffered`) and its helpers (`http1TakeLine`, `http1RequestLine`, `http1FieldLine`, `http1EndOfHead`, `http1Tally`, `http1ContentLength`, `http1ChunkSize`, `http1BodyWindow`, `http1HeadAppend`); the writers `http1ResponseHead`, `http1WriteResponseHead`, `http1Chunk`, `http1WriteChunk`, `http1LastChunk` |
| `std/net/http1-server.ts` | `Http1Connection`: `feed`, `inputRoom`, `next`, `nextRequest`, `nextFrame`, `fail`, `respond`, `write`, `end`, `acceptWebSocket`, `sendFrame`, `closeWebSocket`, `sendPong`, `sendClose`, `restart`; `Http1Server` and `Http1TlsServer`: `accept`, `readable`, `writable`, `next`, `flush`, `send`, `close`, `expire`, `refused` |
| `std/net/websocket.ts` | `WsDecoder` (`feed`, `next`, `reset`), `websocketWriteFrame`, `websocketFrame`, `websocketRequestKey`, `websocketUpgradeResponse`, `websocketClosePayload` |

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

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| H1-1 | Medium | `std/net/http1-server.ts` (`Http1Server.expire`, `Http1TlsServer.expire`, `Http1Connection.idle`) | The idle timeout counts from the last byte moved, so a client that sends one byte of its head every `idleTimeout` (slowloris) keeps its slot for as long as it likes, and with every slot held new connections are shed (`H1_POOL_FULL`). Memory stays bounded: the head is capped by `maxHeaderBytes`, the slots by the pool. | **Open.** The fix is a deadline for a whole head (and for a body's progress), which needs the clock the idle timeout already reads passed into the connection; until then the program can close slots by its own rule, and the pool's size is the bound. |
| H1-2 | Low | `std/net/http1-server.ts` (`fail`, the carriers' `close`) | After a refusal the response is sent and the socket closed at once, without the lingering close RFC 9112 §9.6 describes. A client still sending a body when the socket closes may get a TCP reset that discards the error response before it reads it. Nothing is accepted that should not be: the effect is a client that sees a reset instead of a 413 or 400. | **Open.** A half-close (`netShutdown` for writing) and a short drain before `close` is the follow-up; it needs a timer of its own, as H1-1 does. |
| H1-3 | Low | `std/net/http1-server.ts` (`acceptWebSocket`), through `std/net/websocket.ts` (`websocketRequestKey`, `websocketUpgradeResponse`) | Accepting a WebSocket leaves 58 bytes in the arena (the key and the accept key as strings, measured over 1,000 upgrades of one connection) until the program resets it. It is once a connection, not once a message, and bounded by the connection rate the pool allows — the shape of TLS-3 at a thousandth of its size. | **Open, accepted for now.** The same per-connection arena that closes TLS-3 closes it; the frames themselves allocate nothing. |

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

**One exchange at a time, in order** (`net_http1_server`): pipelined requests
are answered in the order they came, because the next head is not read until
the current response has ended and the current body has been read to its end;
a pipelined pair and a refusal behind a good request pin it. Pipelined bytes
wait in the parser's buffer, and once `inputLimit()` of them wait the slot
stops asking to be read.

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

**Caps, all fixed at start-up** (`Http1Config`): the request target
(`maxTarget`, 8,192), the header section and each trailer section
(`maxHeaderBytes`, 16,384) and its fields (`maxHeaders`, 100), a request body
(`maxBody`, 2^30), the most body one `H1_BODY` hands over and one read takes
(`chunkSize`, 16,384), the output (`outputSize`, 64 KiB, of which 256 bytes are
kept for what the connection writes itself), a WebSocket message
(`maxMessage`, 1 MiB) and the idle timeout (`idleTimeout`, 60 s, read by
`expire`). The slots are the pool's size. A cap out of range panics when the
connection is made (`net_http1_server_bad_config`). The input the connection
buffers is the largest of `chunkSize`, a header line and a request line, so
any head the caps allow can be read.

**Nothing per request on a warmed slot.** A hundred GETs and a hundred chunked
POSTs on one plain connection, and fifty of each over TLS, move `Arena.used()`
across the servers' calls and the program's answers by 0 bytes
(`net_http1_server`). The parser keeps the head as spans in a buffer it grows
to the largest head it has seen and keeps; `restart` and `reset` allocate
nothing, so a slot is reused for the next connection as it is.

**ALPN** (`net_http1_server`): a TLS handshake that chose `http/1.1`, or none,
is served; one that chose `h2` is shut down with `close_notify` before any
HTTP/1.1 byte.

**Idle slots** (`net_http1_server`): `expire(now)` closes a slot idle past
`idleTimeout` on either carrier and leaves one that has just moved; the client
sees the end. The pool sheds a connection past its size.

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
request and zeroed by nothing, and it stays in the slot until then.
