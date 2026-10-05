# Security record: HTTP/2 — frames, the connection and its TLS carrier

The record of WP34's lane H2 past HPACK: `nish/net/http-fields` (the header
model HTTP/2 and HTTP/3 share), `nish/net/http2-frame` (the frames of RFC 9113
§6), `nish/net/http2` (the server side of a connection) and
`nish/net/http2-tls` (the connection over `nish/net/tls-tcp` with ALPN `h2`).
It says what each refuses and with what, what it caps and where the cap is
set, what it keeps in memory and for how long, and the test that pins each
property. HPACK itself is `nish/net/hpack` (#406), which has no record of its
own yet; what it costs this lane is H2-1 below. It is written with the code
rather than after an audit, so that the audit of the protocol stack starts
from evidence.

**Result.** Every refusal RFC 9113 names is made, as the connection error
(GOAWAY) or the stream error (RST_STREAM) the RFC classes it as, and none is
a panic; a panic is only ever the program's own mistake (a window outside its
buffer, a cap out of range, a frame no peer may accept). Every cap is a number
the program fixes at start-up. The data path — DATA in, DATA out,
WINDOW_UPDATE, PING, SETTINGS, RST_STREAM — allocates nothing, measured both
by `Arena.used()` and by resident memory. Three findings are open: H2-1
(Medium), the memory each request's header block leaves behind; H2-2 (Low),
frames that cost only CPU; and H2-3 (Low), no clock in the connection or the
carrier.

## Scope

| File | Functions |
| --- | --- |
| `std/net/http-fields.ts` | `httpFieldNameValid`, `httpFieldValueValid`, `httpFieldConnectionSpecific`, `httpFieldSensitive`, `httpFieldsCheckOutgoing`, `HttpFields` (`readSection`, `takePseudo`, `readRequest`, `readResponse`, `readTrailers`) |
| `std/net/http2-frame.ts` | `http2ReadHeader`, `http2ParseFrame` and its helpers (`http2FrameUnpad`, `http2FramePriority`), `http2SettingError`, the eleven writers |
| `std/net/http2.ts` | `Http2Connection`: `feed`, `next`, `handleFrame` and the handler of each type, `gather`, `endBlock`, `trailers`, `tooLarge`, `credit`, `streamError`, `resetStream`, `fail`, `sendHead`, `respond`, `writeData`, `writeTrailers`, `reset`, `goaway`, `restart` |
| `std/net/http2-tls.ts` | `Http2TlsServer`: `accept`, `readable`, `writable`, `next`, `flush`, `refused`, `close` |

Out of scope: HPACK's decoder and encoder (`nish/net/hpack`), TLS
(`docs/security/tls.md`, whose TLS-3 and TLS-4 this carrier inherits), and
`nish:net`. The external suites — `h2spec`, `curl --http2`, Chrome — run in
S2's interop job, not here.

## Threat model

The attacker is the client: every byte after the TLS handshake is theirs,
split anywhere, and they may open streams, reset them, stop reading, send
frames in any order, and hold the connection open. A win is a panic, memory or
time a client can make the server spend without bound, a request the program
sees that RFC 9113 calls malformed (the shapes that smuggle a second request
through an HTTP/1.1 intermediary), a frame accepted that a rule forbids, a
stream that outlives its state, or HPACK state that drifts from the peer's.
The program driving the connection is trusted; its mistakes panic, and what it
writes is checked so that its strings cannot become fields or frames it did
not mean.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| H2-1 | Medium | `std/net/http2.ts` (`endBlock`, `trailers`), through `std/net/hpack.ts` (`HpackDecoder.decode`) | Each header block leaves memory in the arena until the program resets it. `HpackDecoder.decode` answers every field as fresh arrays, and three fresh lists, on every call; the connection reads them (keeping references, not copies) and nothing frees them. Measured by resident memory over a connection restarted and fed the same thousand GETs of four fields (`:path /index.html`) each round: 664 bytes a request, 66.9 MB after 100,000 requests and 715.7 MB after 1,100,000. A client that sends requests in a loop drives it — denial of service on attacker input, the shape of TLS-3. One request's share is bounded by `maxHeaderBlock` and `maxHeaderListSize`; what is not bounded is the count. `HttpFields` reusing its own two lists, rather than making new ones per read, took the figure from 712 bytes. Everything else a request costs is in the connection's slot, made once. | **Open.** The way out is an HPACK decoder that decodes into storage the caller owns (a fixed field buffer per connection) — `nish/net/hpack`'s change, outside this lane. Until then a program serving untrusted clients resets the arena while no connection is open, on a schedule of its own, as TLS-3 already requires of it. |
| H2-2 | Low | `std/net/http2.ts` (`next`, `handlePriority`, `handleData`, `handleWindowUpdate`) | Frames that need no answer cost only CPU and are not counted: PRIORITY, an empty DATA without END_STREAM, a WINDOW_UPDATE, a frame of an unknown type, and an empty CONTINUATION up to `H2_MAX_FRAGMENTS` (64) a block. Each allocates nothing and is read once, so the work is in proportion to the bytes the client sends, as it is for any traffic; CVE-2019-9518's "empty frames" flood costs the server no memory here. Frames that do need an answer (PING, SETTINGS) are read only while the output has room for it, so a client that never reads its acknowledgements stops being read (CVE-2019-9512, -9515). What a frame costs to find its stream grows with `maxStreams`: the slots are scanned, and a frame for a stream the connection does not hold also scans the memory of reset and closed streams (`maxStreams` + 16 each). At the default 100 that is a few hundred comparisons a frame. | **Accepted.** A budget per frame type would refuse conforming clients that send PRIORITY or WINDOW_UPDATE in bursts; the program owns the loop and may close a connection that sends much and asks little. A program that raises `maxStreams` far past the default buys the scan with it; an index from stream to slot is the follow-up if one needs to. |
| H2-3 | Low | `std/net/http2.ts`, `std/net/http2-tls.ts` | Neither has a clock. A client that never acknowledges the server's SETTINGS is never sent SETTINGS_TIMEOUT (§6.5.3), and one that holds a connection idle, or a stream half-open, keeps its slot; when every slot is held new connections are shed at once (TLS-4). Memory stays bounded, since nothing grows with time. | **Open, the program's to decide.** The program owns `pollWait`'s timeout and closes slots that have gone quiet; a timeout in the connection needs a clock argument the API does not take yet, as TLS-4 says for the carrier. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**Every frame type, both ways** (`tests/link/net_http2_frame`, `_f64`): each
of the ten types of §6 read from bytes built by hand from §4.1 and §6 —
padding, priority fields, the reserved bits of a stream identifier and an
increment, an unknown 32-bit error code, a frame type the module does not
know — and written back to the same bytes; a writer answers -1 for a frame
that does not fit and leaves the buffer alone.

**What a frame may not be** (`net_http2_frame`): a frame past the reader's
SETTINGS_MAX_FRAME_SIZE (refused from its header, before the payload is
waited for), a frame on the wrong stream for its type, a frame too short for
its fixed fields or of the wrong length, padding as long as its frame, a
WINDOW_UPDATE of zero — each the error RFC 9113 names, connection or stream;
and every setting value §6.5.2 and RFC 8441 bound. A writer cannot produce
what its reader refuses: a frame on the wrong stream, padding past 255, a
weight outside 1 to 256 or a setting out of range panics, as a window
outside its buffer does; DATA on stream 0 (`net_http2_frame_bad_write`) and
the window (`net_http2_frame_bad_window`) pin the two kinds.

**Every connection error** (`tests/link/net_http2_errors`, `_f64`): a bad
preface; a first frame that is not SETTINGS, or is its acknowledgement; each
codec refusal through the connection; a frame inside a header block, a
CONTINUATION outside one or on another stream; a block HPACK cannot decode
(COMPRESSION_ERROR); a block past `maxHeaderBlock` or in more than 64 frames
(ENHANCE_YOUR_CALM, the CONTINUATION flood of CVE-2024-27316); an even stream
identifier, one below a stream never opened (PROTOCOL_ERROR) and HEADERS on a
stream that closed or that the peer reset (STREAM_CLOSED); DATA, RST_STREAM
and WINDOW_UPDATE on an idle stream; a PUSH_PROMISE from a client; DATA past
the connection's window, a window past 2^31 − 1 by WINDOW_UPDATE or by a new
SETTINGS_INITIAL_WINDOW_SIZE (FLOW_CONTROL_ERROR); every bad setting value;
and more resets from the peer than `resetBudget` allows (ENHANCE_YOUR_CALM,
the rapid reset of CVE-2023-44487), with a finished stream earning one back.
Each sends GOAWAY naming the last stream the peer opened, the program sees
H2_ERROR, every later call answers it again, input is dropped, and the
program's writes answer H2_CLOSED.

**Every stream error** (`net_http2_errors`): every refusal of the field model
on a request or trailers, a `content-length` that a request ending with its
headers, its body or its trailers disagrees with, trailers without
END_STREAM or past the header-list cap (PROTOCOL_ERROR); DATA or HEADERS
after the peer ended a stream, DATA on a closed stream (STREAM_CLOSED); DATA
past a stream's window, a stream window past 2^31 − 1 (FLOW_CONTROL_ERROR); a
WINDOW_UPDATE of zero, a self-dependency in PRIORITY or HEADERS, a PRIORITY of
the wrong length; a stream past `maxStreams` (REFUSED_STREAM). Each sends
RST_STREAM once, tells the program with H2_RESET when it held the stream, and
leaves the connection answering. A header block whose stream is reset is
still decoded, so HPACK stays in step with the peer (§4.3). Frames still in
flight for a stream the server reset are ignored (§5.4.2), for as many as
`maxStreams` + 16 of the most recent resets — the program may reset every
stream at once (`net_http2`, twenty at once) — and so is anything on a stream
opened after the server's GOAWAY, DATA and trailers alike (§6.8); a later
connection error's GOAWAY never names a higher stream than the first did. An
even stream identifier is idle for as long as the connection lives, since a
server without push never opens one.

**Malformed requests never reach the program** (`tests/link/net_http_fields`,
`_f64`, and through the connection in `net_http2_errors`): an uppercase or
non-token name; NUL, CR or LF in a value, or whitespace at its ends; a
connection-specific field, `te` but `trailers` included; a pseudo-header
unknown, repeated, after a regular field, missing or where the shape forbids
it; a `:method`, `:scheme`, `:path`, `:authority` or `:protocol` of the wrong
syntax; a `host` naming another authority (letters compared without case, as
a host name is); a bad or disagreeing `content-length`. These are the shapes that let one request become two when
it is turned back into HTTP/1.1. `:protocol` is read only where
SETTINGS_ENABLE_CONNECT_PROTOCOL was sent (RFC 8441 §4).

**What the program writes is checked** (`net_http2`): a field name that is not
a lowercase token, a value with CR, LF or NUL, a connection-specific field, a
status outside 100 to 599 or 101 (§8.6), a second final head, a 1xx that ends
a stream, a head no output could hold — each H2_INVALID, and nothing is sent.
A head is encoded only once there is room for all of it, so the HPACK state
never moves for a block that was not sent; Huffman coding is used only where
it lengthens neither the name nor the value, so the room checked is never
less than what is written (a 40,000-byte name of `^`, which Huffman would
nearly double, goes out raw and whole). `set-cookie`, `cookie`, `authorization` and
`proxy-authorization` are sent as never-indexed literals (RFC 7541 §7.1.3), so
no table here or downstream holds them; every other field is a literal
without indexing, so the server's table stays empty.

**Flow control both ways** (`net_http2`): a stream's window and the
connection's each hold `writeData` back and H2_WINDOW says when they open,
including through a larger SETTINGS_INITIAL_WINDOW_SIZE; END_STREAM waits
with the bytes it ends. What the program is handed is credited back with
WINDOW_UPDATE once half a window is owed, the connection's and the stream's
apart, and a stream that has ended is not credited.

**Caps, all fixed at start-up** (`Http2Config`): open streams (`maxStreams`,
100, the stream slots), each stream's receive window (`initialWindowSize`,
65,535), the connection's (`connectionWindowSize`, 1 MiB), the largest frame
read (`maxFrameSize`, 16,384, which sizes the input buffer), the header list
(`maxHeaderListSize`, 16,384, past which a request is answered with a 431 and
never seen) and the compressed header block (`maxHeaderBlock`, 16,384), the
HPACK table (`headerTableSize`, 4,096), the output buffer (`outputSize`, 64
KiB, of which 128 bytes are kept for control frames) and the reset budget
(`resetBudget`, 100). A cap RFC 9113 does not allow panics when the connection
is made (`net_http2_bad_config`). The carrier uses one configuration for every
slot.

**Nothing on the data path allocates.** Over a scripted client, a thousand
DATA frames in with WINDOW_UPDATEs and PINGs, and a hundred out, move
`Arena.used()` by 0 bytes (`net_http2`); a restart allocates nothing; over TLS,
a hundred DATA frames echoed through one stream move it by 0 bytes
(`net_http2_tls`). By resident memory outside the suite, 120 thousand and 1.2
million DATA frames echoed through one stream peak at the same 10,152 KB.

**Back-pressure instead of queues.** A frame is read only while the output has
room for every answer it can need, so a peer that sends PINGs and never reads
stops being read and the TCP window closes (`net_http2`); the input buffer is
one frame, so a connection the program has not drained stops reading TLS.

**ALPN** (`net_http2_tls`): a handshake that chose `h2` serves HTTP/2; one that
chose nothing is shut down with `close_notify` before any HTTP/2 byte is sent
(RFC 9113 §3.2). A client that sends its requests and its `close_notify` in
one write still has every request answered before the server closes its own
side.

## What is and is not wiped

HTTP/2 holds no key material: the record keys are TLS's (`docs/security/tls.md`).
What it holds is application data — header blocks in `block` and the input
buffer, bodies in the input and output buffers — which may carry credentials
(`cookie`, `authorization`). None of it is wiped: each buffer is overwritten
by the next frame and is zeroed by nothing, and HPACK's decoded fields stay in
the arena (H2-1). A credential sent by the server is never indexed, and so
never sits in a compression table where a peer could probe it.
