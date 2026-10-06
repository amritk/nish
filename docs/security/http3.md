# Security record: HTTP/3 — frames, the connection and its UDP carrier

The record of WP34's lane R1 past QPACK: `nish/net/http3-frame` (the frames,
stream types, settings and error codes of RFC 9114), `nish/net/http3` (the
server side of a connection, on the streams of a `QuicConnection`) and
`nish/net/http3-server` (the connection over one UDP socket, with ALPN `h3`,
in a pool of slots). It says what each refuses and with what, what it caps and
where the cap is set, what it keeps in memory and for how long, and the test
that pins each property. QPACK itself is `nish/net/qpack` (#464), the header
model `nish/net/http-fields` ([http2.md](http2.md)), and the transport
`nish/net/quic` ([quic.md](quic.md)); what each of those costs this lane is
named where it does. It is written with the code rather than after an audit,
so that the audit of the protocol stack starts from evidence.

**Result.** Every connection error RFC 9114 and RFC 9204 name is made with the
code they name, as an application CONNECTION_CLOSE, and every stream error
resets the one request both ways; none is a panic, and a panic is only ever
the program's own mistake (a window outside its buffer, a cap out of range).
Every cap is a number the program fixes at start-up and is checked against
the buffer it bounds. A warm connection serving request after request
allocates nothing, and neither does anything a connection does after its
handshake, connection after connection through one slot; a datagram an
established connection reads, and every datagram it sends, allocates nothing
in the carrier. Three findings are open, each Low: H3-1, what a handshake
still keeps per connection now that QUIC keeps its state in the slot (the
caller's P-256 signature and `TlsServer`'s copy of the client's transport
parameters, each outside this lane); H3-3, what a datagram no slot owns can
still cost the listener; and H3-5, no clock at the HTTP/3 layer. H3-2,
the copies of a field section, is bounded and closed here; H3-4 is accepted.
H3-6 and H3-7, two ways a slot could wait for the client before sending what
it had, are closed in the carrier.

## Scope

| File | Functions |
| --- | --- |
| `std/net/http3-frame.ts` | `h3ReadFrameHeader`, `h3ReadSettings` and `Http3Settings` (`take`, `unknown`), `h3ReadIdPayload`, `h3ReadVarint`, the writers (`h3PutVarint`, `h3PutFrameHeader`, `h3PutSettings`, `h3PutIdFrame`), `h3ReservedHttp2Frame`, `h3Greased` |
| `std/net/http3.ts` | `Http3Connection`: `next`, `step`, `open`, `start`, `ownStream`, `uniStep`, `typed`, `controlStep`, `controlFrame`, `requestStep`, `requestFrame`, `fieldSection`, `copyFields`, `copyOf`, `ended`, `abandon`, `streamError`, `answerTooLarge`, `writable`, `drain`, `arm`, `writeHead`, `respond`, `writeTrailers`, `writeData`, `reset`, `goaway`, `restart` |
| `std/net/http3-server.ts` | `Http3Server` (`receive`, `datagram`, `unowned`, `worthListening`, `takeAnswer`, `serve`, `refile`, `flush`, `release`, `tick`, `timeout`), `Http3CidIndex`, `Http3Wheel` |

Out of scope: QPACK's decoder and encoder (`nish/net/qpack`), the field model
(`nish/net/http-fields`), QUIC and its listener (`docs/security/quic.md`,
whose QUIC-1 to QUIC-7 this lane inherits), TLS (`docs/security/tls.md`,
TLS-3 above all) and `nish:net`. Extended CONNECT, HTTP datagrams and
WebTransport are R2's. The external suites — the quic-interop-runner's `http3`
case, `curl --http3`, Chrome — run in S2's interop job, not here; aioquic 1.3's
HTTP/3 client was pointed at `net_http3_server`'s `serve` mode by hand while
this lane was written (a GET, a 300,000-byte paced response checked byte for
byte, a 150,000-byte upload, twenty requests at once, a clean close), which
is evidence, not a test.

## Threat model

The attacker is the client: every byte after the QUIC handshake is theirs, on
any stream they may open, split anywhere, and they may open streams, reset
them, stop reading them, send frames in any order or on the wrong stream,
close or reset the critical streams, and hold the connection open. Before the
handshake, anyone may send the carrier datagrams from any address. A win is a
panic, memory or time a client can make the server spend without bound, a
request the program sees that RFC 9114 calls malformed, a frame accepted that
a rule forbids, a stream whose state outlives it, a cap a peer can outgrow,
or QPACK state that drifts from the peer's. The program driving the
connection is trusted; its mistakes panic, and what it writes is checked so
that its strings cannot become fields or frames it did not mean.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| H3-1 | Low | `std/net/http3-server.ts` (`unowned`, `serve`), through `std/net/quic.ts` and `std/net/tls.ts` | **Each new connection's handshake leaves memory in the arena.** The slot is made once and `reset` for the next client, and nothing HTTP/3 does after the handshake allocates; but the QUIC handshake kept 89,288 bytes of server calls a connection under this lane's test configuration, measured after #467 with `NqMeter`, which reads only the chunk a call ends in; read across every chunk, about 100 KB (#489: 100,216 to 103,768 bytes a connection over loopback). A client that connects in a loop drives it. **N9's QUIC stage** moved the QUIC handshake's state into the slot (QUIC-3's remainder in [quic.md](quic.md)): one `TlsServer` a slot, restarted; every level's keys derived in place into key slots the connection made once; the Initial secrets, reset tokens and connection IDs computed in arena blocks; the transport parameters encoded and parsed in place. Through one `QuicConnection` slot a connection now keeps 56 or 96 bytes where it kept 87,328 to 127,312 (`net_quic_memory`). **What remains, named** (`net_http3_server`, `loopback.ts`, every server call metered across chunks, five connections through a one-slot carrier with real entropy): **10,912 to 11,040 bytes a handshake**, made of (1) the CertificateVerify signature `serve` makes with `tlsSignEcdsaP256`, 9,248 to 9,376 bytes as its DER length is 70 to 72: `p256SignSha256` (`std/crypto/p256.ts`) stores what it allocates, so the compiler refuses an arena block around it (NL2424), and a caller-owned scratch for P-256 signing is a `std/crypto` change outside this stage; (2) the carrier's copy of the client's first Initial and the listener's parse of it, about 1.5 KB (H3-3); and (3) `TlsServer`'s copy of the client's transport parameters, 56 bytes here (TLS-3, in `std/net/tls.ts`). | **Open, narrowed** from about 100 KB to about 11 KB a connection. What is left is the P-256 signer's (a scratch the caller owns, in `std/crypto/p256.ts`), the listener's (H3-3) and `TlsServer`'s copy (TLS-3); each goes with its own module, and until then a program serving untrusted clients resets the arena while no connection is open, as TLS-3 already requires of it. |
| H3-2 | Low | `std/net/http3.ts` (`copyFields`, `copyOf`) | **A field section is copied, and the copies are kept.** `nish/net/http-fields` reads a section as one `u8[]` per name and value, and `nish/net/qpack` answers windows into one buffer, so each decoded name and value is copied into an array the connection keeps and reuses. Kept one per line, a client could grow every line's array in turn, request by request, to the section cap — about 16 MiB a connection at the default 16,384 — though no single request was large. They are kept by size class instead: class *j* holds arrays made with room for 2^*j* bytes, for strings at least half that long, and a section takes each class's arrays in order. A class grows only when one section needs more of its size than any before it, and since a section is at most `maxFieldSectionSize` bytes counting 32 per field (§4.2.2), the most it can ever hold is about 44 times the cap: 720 KiB at the default, reached only by a client that sends section after section shaped to fill each class. Seven sections, each with a 3,000-byte field on a different line, keep 0 bytes after the first (`net_http3`). | **Closed** (bounded). A decoder that wrote into storage the connection owns, and a field model that read windows, would remove the copies; neither module is this lane's. |
| H3-3 | Low | `std/net/http3-server.ts` (`unowned`, `worthListening`, `takeAnswer`), through `std/net/quic-listener.ts` (`QuicListener.handle`) | **What a datagram no slot owns can cost.** `QuicListener.handle` takes a whole `u8[]` and allocates as it parses and answers, so the carrier copies such a datagram and the listener keeps memory for it: 3,128 bytes for one answered with a stateless reset, 1,720 for a Version Negotiation, 456 for one it parses and drops. The carrier first drops, with no copy, everything the listener would drop unanswered — a short header of 21 bytes or less, a long header under 1,200 bytes, version 0, a version 1 packet that is not an Initial or whose DCID is under 8 bytes — and an Initial when no slot is free; and it holds stateless resets and Version Negotiation together to a budget of 16 at once and one per 100 ms, past which each is dropped before the listener sees it. A flood of garbage therefore costs 0 bytes a datagram past the budget (`net_http3_server`), and at most about 31 KB a second within it. What is left allocates per datagram without a budget: an Initial that takes a free slot (and starts a handshake, H3-1), and, under `retry`, a Retry for each Initial without a token. | **Open.** `QuicListener` reading a window and answering into caller-owned scratch would make all of it free; that is the QUIC lane's module, which this stage may not edit, so the request is recorded in its pull request. A program that turns `retry` on and fears a Retry flood can watch `accepted` and the arena. |
| H3-4 | Low | `std/net/http3.ts` (`requestFrame`, `uniStep`, `controlStep`), `std/net/http3-server.ts` (`Http3CidIndex`) | **Work that costs only CPU, and the index's hash.** Frames of an unknown or reserved type (§9, §7.2.8), empty DATA frames, a unidirectional stream of an unknown type (asked to stop, then read and dropped, §6.2) and a stream that ends before its type each allocate nothing and are read once, so the work is in proportion to the bytes the client sends, which QUIC's flow control already bounds; none is counted. The connection-ID index hashes an ID with eight bytes of the listener's entropy mixed in, by shifts and exclusive-or, not by a keyed PRF: a client that learned the salt could choose original DCIDs that collide, and a probe run is at most every ID of every slot (five a slot). | **Accepted.** A budget per frame type would refuse conforming clients that grease; the program owns the loop and may close a connection that sends much and asks little. A SipHash over the ID is the follow-up if a measurement shows probe runs growing. |
| H3-5 | Low | `std/net/http3.ts`, `std/net/http3-server.ts` | **No clock at the HTTP/3 layer.** QUIC's idle timeout closes a connection that has gone quiet, but a client that keeps trickling bytes keeps its slot, and one that opens request streams and never finishes their HEADERS keeps up to `maxStreamsBidi` of them. A slot whose connection closed is freed once its CONNECTION_CLOSE is out, so a client that missed it is answered with a stateless reset rather than the close again (RFC 9000 §10.2.1's closing state is not kept). Memory stays bounded either way, since nothing grows with time. | **Open, the program's to decide.** The program owns `pollWait`'s timeout and may `reset` requests, send GOAWAY or close a slot that has gone on too long, as TLS-4 and H2-3 say for the other carriers. |
| H3-6 | Low | `std/net/http3-server.ts` (`flushSlot`) | **A slot the pacer held back was woken long after the pacer's time.** `quicListenerPaceTime` answers an absolute time, `now + pacerDelay`, but `flushSlot` took it for a delay and added `now` again, after narrowing it to an i32. On a clock near 0 that filed the wake about `2 × now` away; on a real clock, milliseconds since the epoch past 2^31, the `toI32` (a `trunc`, which wraps and does not panic) left a value with no relation to either, negative about half the time, so the pacer's time was dropped, or else up to 24 days out. Either way the slot slept to its next QUIC deadline, which with everything acknowledged is the idle timeout. A client that acknowledges every packet woke it with each datagram (aioquic), so nothing showed; curl's quiche goes quiet once everything is acknowledged, and a 100 KB GET stalled at 21,875 bytes until the 30 s idle timer closed the connection (found by the interop run, #487). | **Closed.** The pacer's time is taken as a time, in i64, and the slot is filed at the earlier of it and `quic.deadline()`. A client on an epoch-milliseconds clock that only acknowledges what arrives, with time moved only to the server's `timeout`, gets a 300,000-byte response whole in under a second of the server's clock, and a held-back slot is filed at exactly `now + pacerDelay` (`net_http3_server`, `_f64`, "quiet"). |
| H3-7 | Low | `std/net/http3-server.ts` (`flushSlot`), through `std/net/quic-stream.ts` (`QuicStreams.putNextChunk`, `putResend`) | **A flight could come back empty with bytes to send.** When every byte of a stream's resend range has been acknowledged since it was queued again, `putResend` clears the range and answers nothing, and `putNextChunk` moves on without offering that stream's new bytes; with no other stream to send, the datagram, and so the flight, is empty, and `flushSlot` filed the slot under its deadline with the bytes unsent until the next datagram from the client. Exposed once H3-6 let the pacer's wakes through: in the carrier's echo, bytes declared lost and queued again were then acknowledged, and the 100,000-byte echo waited on the client. | **Closed in the carrier**: an empty flight is asked for once more before the slot is filed, which cannot spin (at most once after each flight sent, inside `flushSlot`'s 64). The carrier's checks pin it: without the second ask the echo stops at 32,969 bytes when the client's acknowledgement leaves nothing in flight (`net_http3_server`, `_f64`, "a POST of 100,000 bytes echoed whole"). `putNextChunk` offering the stream's new bytes after a cleared resend range is the fix at the source, in the QUIC lane's module, which this stage may not edit; the request is recorded in its pull request. Another caller of `quicListenerTakeFlight` or `takeDatagramInto` that stops at the first empty answer is exposed the same way until then. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**Every frame, both ways** (`tests/link/net_http3_frame`, `_f64`). RFC 9114
prints no vectors, so each frame is written out by hand from the layouts of
§7.1 and §7.2 — DATA, HEADERS with a two-byte length, CANCEL_PUSH, SETTINGS of
the three pairs this endpoint sends (16,384 as the four-byte varint
`80 00 40 00`), PUSH_PROMISE, GOAWAY, MAX_PUSH_ID, a reserved type of four
bytes, a length of 2^62 − 1 — read from its bytes and written back to them. A
header cut at any byte is not a header yet; a writer answers -1 for a frame
that does not fit or a value no varint holds, and leaves the buffer alone.
SETTINGS: an identifier twice, or one HTTP/2 used with no HTTP/3 setting (0x00,
0x02 to 0x05), is H3_SETTINGS_ERROR; a payload that ends inside a pair is
H3_FRAME_ERROR; unknown identifiers are kept for an extension, the first eight,
and counted past them without being compared. A one-identifier payload of the
wrong length is -1, H3_FRAME_ERROR's case. The error codes are §8.1's table, in
order. A window outside its buffer panics (`net_http3_frame_bad_window`).

**Every connection error, with its code** (`tests/link/net_http3_errors`,
`_f64`, 55 checks, each on a fresh connection, each asserting the code of the
CONNECTION_CLOSE the client receives and that the program was told with
H3_ERROR): a second control, encoder or decoder stream, and a push stream from
a client (H3_STREAM_CREATION_ERROR, §6.2.1, §6.2.2); a control stream whose
first frame is not SETTINGS, unknown or not (H3_MISSING_SETTINGS); the client's
control, encoder or decoder stream ended or reset, and STOP_SENDING for any of
the server's three (H3_CLOSED_CRITICAL_STREAM); DATA, HEADERS, a second
SETTINGS, PUSH_PROMISE or an HTTP/2 type on the control stream, and DATA
before HEADERS, PUSH_PROMISE, SETTINGS, GOAWAY, MAX_PUSH_ID, CANCEL_PUSH or an
HTTP/2 type on a request stream, and HEADERS or DATA after trailers
(H3_FRAME_UNEXPECTED); SETTINGS with a reserved or repeated identifier
(H3_SETTINGS_ERROR); a SETTINGS, GOAWAY or MAX_PUSH_ID payload of the wrong
length, and a DATA, HEADERS or unknown frame or a frame header cut short by
its stream's end (H3_FRAME_ERROR, §7.1); a client's GOAWAY push ID that rises,
a MAX_PUSH_ID that falls, a CANCEL_PUSH past the push IDs allowed (H3_ID_ERROR,
§5.2, §7.2.7, §7.2.3); SETTINGS past `H3_CONTROL_FRAME_MAX`
(H3_EXCESSIVE_LOAD); a Set Dynamic Table Capacity above 0 or an Insert on the
encoder stream (QPACK_ENCODER_STREAM_ERROR), a Section Acknowledgment or an
Insert Count Increment on the decoder stream (QPACK_DECODER_STREAM_ERROR), and
a field section with a Required Insert Count, a static index past 98 or no
prefix (QPACK_DECOMPRESSION_FAILED). Requests before the client's SETTINGS are
served, as §6.2.1 allows.

**Every stream error, and the connection lives** (`tests/link/net_http3`,
`refusals.ts`). A malformed request — no `:path`, an uppercase name,
`connection`, `transfer-encoding`, a pseudo-header after a field, `:protocol`
without extended CONNECT, `:status` in a request, a `host` that disagrees, a
bad `content-length`, `te` but `trailers`, `:method` twice — is reset both
ways with H3_MESSAGE_ERROR and never reaches the program (§4.1.2, §4.3); a body
shorter or longer than its `content-length` is H3_MESSAGE_ERROR, which the
program, holding the request, sees as H3_RESET; so are trailers with a
pseudo-header. A request stream that ends before HEADERS, empty or after an
unknown frame, is H3_REQUEST_INCOMPLETE (§4.1.1). Trailers past the
field-section cap, in the frame or once decoded, are H3_EXCESSIVE_LOAD. A
request on a stream at or past the GOAWAY this side sent is H3_REQUEST_REJECTED
both ways, unseen by the program, and only its response is refused when it
arrived whole (§5.2). Unknown and reserved frames before HEADERS, between DATA
frames and at the end are skipped, and a unidirectional stream of an unknown
type is asked to stop with H3_STREAM_CREATION_ERROR (§6.2, §9).

**A field section past the cap is answered with a 431** (`net_http3`): one
whose HEADERS frame is longer than `maxFieldSectionSize` is skipped unread,
and one that fits its frame but decodes past it (QPACK's own count, §4.2.2),
are each answered with a 431 and the FIN, the rest of the request asked to
stop with H3_NO_ERROR (§4.1.2), and neither reaches the program. The cap is
advertised in SETTINGS, so a conforming client never sends one.

**Cancellation** (`net_http3`): a request the client cancels mid-body with
RESET_STREAM and STOP_SENDING reaches the program as H3_RESET with
H3_REQUEST_CANCELLED, and the server's half ends with the same code; RESET_STREAM
alone abandons the response the same way (§4.1.1); STOP_SENDING alone on a
held response is H3_RESET, answered by QUIC's RESET_STREAM.

**GOAWAY** (`net_http3`): it names the first stream the client has not opened,
so every request in flight finishes; a second never raises the ID; a request
past it is refused; with every request finished and every response byte
acknowledged the connection is done, and the carrier closes it with
H3_NO_ERROR and frees the slot (`net_http3_server`). A client's GOAWAY and
MAX_PUSH_ID are checked and otherwise ignored, since this server never pushes.

**What the program writes is checked** (`net_http3`, `refusals.ts`): a status
outside 200 to 599, a field name that is not a lowercase token, a
connection-specific field, names and values that do not pair, a second head,
DATA or trailers before the head, the FIN or trailers inside a DATA frame the
last write did not finish — each H3_INVALID, and nothing is sent; a stream
that is not an open request of the client's, or one already finished or reset,
is H3_CLOSED; a head past the client's SETTINGS_MAX_FIELD_SECTION_SIZE (as
§4.2.2 counts it) or past a stream's buffer is H3_TOO_LARGE. `set-cookie`,
`cookie`, `authorization` and `proxy-authorization` go as never-indexed
literals (RFC 9204 §7.1.3), and the encoder never inserts.

**Back-pressure** (`net_http3`): a 200,000-byte POST in DATA frames of 50,000
bytes reaches the program at most 16,384 bytes at a time while the client
never sends past the credit QUIC gave it, and comes back whole through a
32 KiB send buffer, in DATA frames of at most `writeChunk`, H3_WRITABLE
naming the stream each time acknowledgements free room. One `writeData` of
20,000 bytes goes as two frames and is taken whole: a call answers short only
when the buffer filled, so the event the program waits for always comes. A
HEADERS frame that must go whole and does not fit pads the buffer with a
reserved frame the client skips, sized to fill the room exactly — its length
written in a longer varint where the shortest would leave a byte over, as
RFC 9000 §16 allows — so that QUIC names the stream once there is room
(`arm`); trailers on streams with 0, 1, 66 and 300 bytes of room all arrive
after their body, the padding skipped (66 is where the shortest length would
have left a stray byte in the stream). A GOAWAY goes whole or not at all, and
not again when its ID has not fallen.

**Concurrency** (`net_http3`): twelve requests open at once, ended in reverse;
two large responses interleaved; each whole.

**The carrier** (`tests/link/net_http3_server`, `_f64`): a handshake across
loopback through the listener into a slot; requests, a 100,000-byte echo and
a 300,000-byte response the pacer lets out over time, in GSO flights; a client
whose handshake chose another ALPN closed with CRYPTO_ERROR
no_application_protocol (0x0178) before any HTTP/3 byte, and its slot freed
(RFC 9114 §3.1); an Initial when every slot is taken dropped and counted; the
datagrams of H3-3 dropped for nothing. The connection-ID index keeps every ID
found across removals in the middle of probe runs, never files one twice or
one over 20 bytes; the timer wheel answers the earliest deadline, files one
past its horizon at the horizon and again when it comes round (a whole turn
away after a tick, never "due now", so the loop does not spin), and runs at
most its 2,048 buckets in one `tick`, from a turn ago when it is called late.
A connection closed while its pacer has no credit still sends its
CONNECTION_CLOSE before the slot is freed. A client on a clock in epoch
milliseconds that sends only to acknowledge what arrived, with time moved
only to the server's `timeout`, gets a 300,000-byte paced response whole, and
a slot the pacer holds back is filed at `now + pacerDelay` (H3-6).

**Caps, all fixed at start-up** (`Http3Config`, the QUIC configuration, the
pool's size): the field section (`maxFieldSectionSize`, 16,384, which must fit
half a QUIC stream buffer with a frame header — checked when the connection
is made, since a HEADERS frame is read once all of it is in and QUIC raises a
stream's credit only once half a buffer is read, so a larger frame could stall
— and sizes the section buffer and the decoder's limit; the QUIC
connection's window must likewise hold one such frame on every request
stream twice over), the body chunk
(`bodyChunk`, 16,384, the `data` buffer), the DATA frame written
(`writeChunk`, 16,384), a control frame (`H3_CONTROL_FRAME_MAX`, 1,024 bytes),
the unknown settings kept (`H3_SETTINGS_KEEP`, 8), the client's unidirectional
streams and this side's own (at least 3 each, checked), the slots, the
datagrams one `receive` reads (`H3_SERVER_RECEIVE_BURST`, 256) and the answers
to unowned datagrams (`H3_SERVER_ANSWER_BURST`, 16, one per
`H3_SERVER_ANSWER_INTERVAL`, 100 ms). A cap out of range panics
(`net_http3_bad_config`, `net_http3_server_bad_config`), as does a write's
window outside its buffer (`net_http3_write_window`). Every counter a peer
drives saturates: requests rejected, sections answered 431, stream errors,
connections accepted, Initials refused, answers limited, sends failed, unknown
settings dropped.

**No lookup grows with a table.** A stream's state is found through the QUIC
connection's own hash index (`QuicStreams.slotOf`), a datagram's slot through
the carrier's connection-ID index, and a timer through the wheel's bitmap;
nothing scans the slots or the streams per frame or per datagram.

**Nothing on the request path allocates** (`net_http3`, `arena.ts`, every
server call measured on its own with `Arena.used()`): 200 requests on a warm
connection — HEADERS and 1,000 bytes of DATA in, a 200 with two fields and
1,000 bytes out, ACKs and credit — keep 0 bytes; six connections through one
slot keep 0 bytes for the reset and 0 for everything after each handshake
(the client's streams, SETTINGS, ten requests, the close), from the second
on; through the carrier, five connections in one slot keep 0 bytes after each
handshake (`net_http3_server`). The slot itself, made once: HTTP/3 adds 34,112
bytes of buffers at the defaults (the body chunk, the section, the control
frame, scratch) and 108 bytes per QUIC stream slot to the QUIC slot's own
(QUIC-3), plus the decoder's and the field copies' growth to the largest
section seen (H3-2).

## What is and is not wiped

HTTP/3 holds no key material: the packet keys are QUIC's and TLS's
(`docs/security/quic.md`, QUIC-1, QUIC-2). The carrier takes the signing key
as a `Secret` on each `receive` and keeps nothing of it; its per-connection
entropy is wiped by `QuicConnection` as soon as it is copied. The
connection-ID index keeps eight bytes of the listener's entropy as its salt
for the server's life, unwiped, beside the listener's own seed (QUIC-5). What
the connection holds is application data — request field sections in
`section`, the decoder's buffer and the field copies, bodies in `data` — which
may carry credentials (`cookie`, `authorization`). None of it is wiped: each
buffer is overwritten by the next section or chunk and zeroed by nothing. A
credential the server sends is never indexed, and the dynamic table is never
used, so none sits in a compression table where a peer could probe it.
