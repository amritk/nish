# Security record: WebTransport over HTTP/3

The record of WP34's lane R2: `nish/net/webtransport` (sessions, HTTP
datagrams, the session's streams and capsules, over one `Http3Connection`) and
the seam it needs in `nish/net/http3` and `nish/net/http3-frame` (extended
CONNECT, the WebTransport SETTINGS, streams held until the program takes
them). It says which draft it speaks, what it refuses and with what, what it
caps and where the cap is set, what it keeps in memory and for how long, and
the test that pins each property. HTTP/3 itself is [http3.md](http3.md), whose
findings H3-1 to H3-5 this lane inherits; the transport and its datagram rings
are [quic.md](quic.md). It is written with the code rather than after an
audit, so that the audit of the protocol stack starts from evidence.

**Result.** Every rule draft-02, RFC 9220 and RFC 9297 give a code to is
refused with that code — a connection error as an application
CONNECTION_CLOSE, a stream error as a reset of that stream — and every other
refusal is a status the program never sees or a counted drop; none is a panic,
and a panic is only the program's own mistake (a cap out of range, a window
outside its buffer, WebTransport turned on over a connection that takes no
datagrams). Every cap is a number fixed at start-up and checked against the
array it sizes. A warm session echoing datagrams and streams allocates
nothing, session after session through one table slot allocates nothing, and
connection after connection through one QUIC slot allocates nothing past the
QUIC handshake. No lookup — of a session, a stream or a datagram's session —
grows with a table: each is one probe of the QUIC connection's stream index,
and the streams waiting for a session are filed in a salted hash. Five
findings, each Low: WT-1 (what a handshake still keeps, H3-1's), WT-2 (no clock,
and no rate cap on a session), WT-3 (what a client can hold within the caps),
WT-4 (datagrams copied, and one that overtakes its session dropped), and WT-5
(the waiting room's hash).

## The draft

WebTransport over HTTP/3 has no RFC yet. This lane speaks
**draft-ietf-webtrans-http3-02**, the version Chrome negotiates, with the
identifiers checked against the `wtransport` 0.7.0 crate (BiagioFesta/wtransport,
the one cs's relay runs on) by reading its source and by recording a live
exchange with it (below):

| What | Value | Where |
| --- | --- | --- |
| SETTINGS_ENABLE_CONNECT_PROTOCOL | 0x08 = 1 | RFC 9220 §5 |
| SETTINGS_H3_DATAGRAM | 0x33 = 1 | RFC 9297 §2.1.1 |
| SETTINGS_ENABLE_WEBTRANSPORT | 0x2b603742 = 1 | draft-02 §3.1; wtransport's `SETTINGS_ENABLE_WEBTRANSPORT` |
| SETTINGS_WEBTRANSPORT_MAX_SESSIONS | 0xc671706a = `webtransportSessions` | draft-07 §3.1; wtransport sends it beside the draft-02 one, as 1 |
| `:protocol` | `webtransport` | draft-02 §3.2 |
| Unidirectional stream type | 0x54, then the session ID | draft-02 §4.1 |
| Bidirectional stream signal | 0x41, then the session ID | draft-02 §4.2 |
| HTTP datagram | the quarter stream ID (session ID / 4), then the payload | RFC 9297 §2.1 |
| CLOSE_WEBTRANSPORT_SESSION | capsule 0x2843: a 32-bit code, a UTF-8 reason of at most 1024 bytes | draft-02 §5 |
| DRAIN_WEBTRANSPORT_SESSION | capsule 0x78ae, empty | later drafts; Chrome sends it |
| WT_BUFFERED_STREAM_REJECTED | 0x3994bd84 | draft-02 §4.5 |
| WT_SESSION_GONE | 0x170d7b68 | draft-02 §4.5 |
| Application error codes on streams | 0x52e4a40fa8db + n + n / 0x1e | Chrome's mapping; wtransport 0.7 sends them unmapped |
| Response header | `sec-webtransport-http3-draft: draft02` | what Chrome's draft-02 client checks for |

The server sends both WebTransport settings, so a client of either draft
finds what it looks for, and takes a session from a client that sent
SETTINGS_H3_DATAGRAM 1 and either one. It does not require Chrome's
`sec-webtransport-http3-draft02: 1` request header, which wtransport 0.7 does
not send.

**The recording.** `tests/link/net_webtransport/golden.ts` holds what a
wtransport 0.7.0 client sent, recorded on 2026-10-06 from the test program's
`record` mode (the Nish server on a real socket with a tap on QUIC's receive
buffers) and built with cargo in the container this lane was written in: its
SETTINGS, its CONNECT, a datagram, a bidirectional and a unidirectional
stream, and its answer to the server's CLOSE. A Nish client replays it byte
for byte against the Nish server inside `npm test`, and what the server sends
back is pinned byte for byte. Three runs differed only in the order of the
client's SETTINGS (it builds them from a hash map) and the port in
`:authority`. What it showed: wtransport opens no QPACK streams, sends no
`origin`, and answers CLOSE_WEBTRANSPORT_SESSION by closing the whole QUIC
connection with H3_NO_ERROR. Chrome through Playwright is S2's interop job.

## Scope

| File | Functions |
| --- | --- |
| `std/net/webtransport.ts` | `WebTransport` (`next`, `receiveDatagram`, `route`, `connectEvent`, `asked`, `answer`, `accept`, `refuse`, `release`, `end`, `dropPending`, `close`, `drain`, `capsules`, `capsule`, `malformed`, `arrived`, `adoptWaiting`, `adopt`, `link`, `settle`, `unlink`, `openStream`, `write`, `resetStream`, `stopSending`, `maxDatagramPayload`, `sendDatagram`), `WebTransportWaiting`, `wtCodeToHttp3`, `wtCodeFromHttp3` |
| `std/net/http3.ts` (the seam) | `Http3Connection`: the settings sent, `takeAgain`, `stepAgain`, `reject`, `held`, `wtStep`, `wtSlot`, `acceptStream`, `refuseStream`, `stopReading`, `openStream`, `writeStream`, `resetStream`, `stopStream`, `writeDataWhole`, `awaitsRequest`, `discardRequest`, `dropped` (H3_DROPPED), and the changes to `step`, `open`, `typed`, `controlFrame`, `requestStep` and `requestFrame` |
| `std/net/http3-frame.ts` (the seam) | `Http3Settings.take`'s four extension settings, and the WebTransport constants |

Out of scope: HTTP/3 and QPACK ([http3.md](http3.md)), QUIC and its datagram
rings ([quic.md](quic.md)), TLS ([tls.md](tls.md)). WebTransport over HTTP/2,
the later drafts' flow control (WT_MAX_STREAMS, WT_MAX_DATA) and their
`wt-available-protocols` header are not implemented. The QUIC server does not
follow NAT rebinding, so `Http3Server` keeps a client's address from accept
time; that is A1's to record, not this lane's.

## Threat model

The attacker is the client: every byte after the QUIC handshake is theirs.
They may ask for sessions, send datagrams for any quarter stream ID, open
streams naming any session — one that exists, has gone, was never one, or has
not arrived yet — send capsules of any type and length split anywhere, close
or reset a CONNECT stream at any point, and send their SETTINGS late, wrong or
not at all. A win is a panic, memory or time the server spends without bound,
a session the program sees that the draft would refuse, a stream or datagram
delivered to the wrong session, a session's state that outlives it, a lookup a
client can make cost the size of a table, or a cap a client can outgrow. The
program is trusted; its mistakes panic.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| WT-1 | Low | `std/net/webtransport.ts` through `std/net/quic.ts` and `std/net/tls.ts` | **The QUIC handshake's memory.** Nothing WebTransport does after a handshake allocates (`net_webtransport`, `arena.ts`); the handshake itself keeps what H3-1 measures. N9's QUIC stage moved the QUIC handshake's state into the slot, so a connection through one `QuicConnection` slot keeps 0 bytes where it kept 87,328 to 127,312 (`net_quic_memory`), and a handshake through the HTTP/3 carrier about 11 KB where it kept about 100 KB (#489 measured 100,176 to 100,240 bytes a WebTransport connection): the caller's P-256 signature and the listener's copy of the first Initial, as H3-1 names them. `Http3Server.serve` now signs in a `TlsP256Signer`, which keeps nothing, so a WebTransport connection over loopback keeps 1,600 bytes Initial to close (`net_loopback`, 20 runs; 3,072 more in some, around the close): the listener's copy alone. | **Open, narrowed**, as H3-1. |
| WT-2 | Low | `std/net/webtransport.ts` | **No clock, and no rate cap.** A session has no idle timeout and no limit on its datagrams a second, and a session asked for stays asked until the program answers it. QUIC's idle timeout ends a connection that goes quiet; a client that keeps sending keeps its sessions. Each session counts its datagrams both ways (`datagramsIn`, `datagramsOut`, saturating) so a program can cap a rate, as the relay caps 256 a second. | **Open, the program's to decide**, as H3-5: the program owns the loop and the clock, and may `close` a session or `drain` it. |
| WT-3 | Low | `std/net/webtransport.ts` (`asked`, `arrived`, `close`) | **What a client can hold within the caps.** A session this side closed keeps its slot until the client ends its half of the CONNECT stream, as draft-02 §5 has the client do; a stream waiting for a session that never comes keeps its place in the waiting room, unread, so QUIC's flow control holds its sender; a session's streams count against `maxStreams` until both their sides are done. A stream that names a session past what the client's MAX_STREAMS lets it open does not wait at all, and one waiting for a request that ends before it reaches the program — malformed, past the field-section cap, reset, refused after GOAWAY — is let go when `nish/net/http3` reports it (`H3_DROPPED`). One case leaves state behind until the slot is used again: QUIC frees a stream's slot without an event when the client's STOP_SENDING and the acknowledgement of the RESET_STREAM answering it are both read before the program next calls `next` (the carrier's loop always serves a slot between the two), and the layer then lets go of the stream, or of a session, when the slot is next claimed — a session before the session cap counts it, so a CONNECT on that slot is never answered 429 for a session that is gone. Every one of these is bounded by a cap fixed at start-up (`webtransportSessions`, `maxPending`, `maxStreams`, and QUIC's stream limits) and costs no memory past what the constructor made. | **Accepted.** A program that wants them back sooner resets the stream or closes the connection (WT-2). |
| WT-4 | Low | `std/net/webtransport.ts` (`receiveDatagram`, `sendDatagram`) | **Datagrams are copied, and one that overtakes its session is lost.** A datagram is copied out of QUIC's ring into the layer's buffer, and a sent one is put together (quarter stream ID, payload) in the layer's buffer and copied into QUIC's ring: two copies a datagram each way, neither allocating. A datagram that arrives before its session's 200 is dropped and counted (`datagramsDropped`), as RFC 9297 §2.1.1 allows, so a client that sends one with its CONNECT loses it. | **Accepted.** QUIC's `sendDatagram` taking a prefix beside the payload, or handing out a window onto its ring, would remove one copy each way; that is the QUIC lane's module (`std/net/quic*.ts`), which this lane may not edit, so it is recorded here and in the pull request. Buffering early datagrams would cost memory per session for a case the draft lets a server drop. |
| WT-5 | Low | `std/net/webtransport.ts` (`WebTransportWaiting`) | **The waiting room's hash.** Streams waiting for a session are filed by the session ID they name in a hash salted with 32 bits of entropy and mixed by multiplication, so a request, an accept or a close probes one bucket rather than the room. A client that learned the salt could put every waiting stream in one bucket; the walk is then bounded by `maxPending` (16 by default), once a request or a session's start or end, never a datagram or a frame, and skipped when nothing waits. The layer draws the salt itself, where `Http3Server` takes its index's from the caller. | **Accepted.** A keyed PRF is the follow-up if a measurement ever shows a bucket growing. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**The settings, both ways** (`tests/link/net_webtransport`, `sessions.ts`,
`golden.ts`): with `webtransportSessions` set, the server's SETTINGS are
QPACK 0 and 0, the field-section cap, SETTINGS_ENABLE_CONNECT_PROTOCOL 1,
SETTINGS_H3_DATAGRAM 1, SETTINGS_ENABLE_WEBTRANSPORT 1 and
SETTINGS_WEBTRANSPORT_MAX_SESSIONS, byte for byte; with `extendedConnect`
alone only 0x08 is added and a CONNECT with `:protocol` reaches the program;
with neither, `:protocol` is malformed, H3_MESSAGE_ERROR (RFC 9220 §3,
`refusals.ts`). The client's four are read and recorded even past eight other
unknown ones; each twice, or 0x08 or 0x33 above 1, is H3_SETTINGS_ERROR.

**Sessions** (`sessions.ts`, `refusals.ts`): an extended CONNECT with
`:protocol` `webtransport` and `:scheme` `https` from a client that offered
HTTP datagrams and WebTransport is a session, answered 200 with
`sec-webtransport-http3-draft: draft02` when the program accepts it; a request
before the client's SETTINGS waits for them (draft-02 §3.1); two sessions
share a connection, each datagram and stream reaching its own. Answered here
and never seen by the program: SETTINGS without SETTINGS_H3_DATAGRAM, or
without either WebTransport setting (400); another `:protocol` (501, RFC 8441
§4); another `:scheme` (400); a session past `webtransportSessions` (429). An
extended CONNECT without `:path` is malformed, reset both ways with
H3_MESSAGE_ERROR. A session the program refuses gets its status and the
client is asked to stop with H3_NO_ERROR.

**Datagrams** (`sessions.ts`, `refusals.ts`): a datagram is echoed with its
quarter stream ID first; at the largest payload the server may send (1,167
bytes after the quarter stream ID, in a 1,200-byte packet) it goes whole, and
one byte more is refused with H3_TOO_LARGE; a datagram whose QUIC frame is the
server's `max_datagram_frame_size` exactly arrives, and one byte over is QUIC's
PROTOCOL_VIOLATION. An empty datagram, or one whose quarter stream ID names a
stream past 2^62, is H3_DATAGRAM_ERROR; one for an unknown session, a session
not yet answered or a session gone is dropped and counted; a ninth while
QUIC's eight wait to go is H3_AGAIN.

**Streams** (`sessions.ts`, `refusals.ts`, `closing.ts`): 24 bidirectional
streams on one session (more than QUIC lets be open at once) and 12
unidirectional ones are each echoed, a unidirectional one on a stream of the
server's that starts 0x4054, then the session ID; the server opens a
bidirectional stream of its own (0x4041, then the session ID) and reads the
client's answer on it. A stream for a session whose CONNECT has not arrived,
or that is not yet answered, waits unread and is taken, in arrival order, once
the session is accepted; past `maxPending` it is refused with
WT_BUFFERED_STREAM_REJECTED; past `maxStreams` with H3_REQUEST_REJECTED, and
the server may not open one past it (WT_LIMIT); a stream naming a session that
is gone, refused or a plain request is refused with WT_SESSION_GONE. A session
ID that is no client-initiated bidirectional stream is H3_ID_ERROR, and the
signal 0x41 after a request's HEADERS is H3_FRAME_ERROR. After this side's
GOAWAY a session's new stream is still taken while a request is refused with
H3_REQUEST_REJECTED; a stream naming a session at or past the GOAWAY's ID,
which can never come, is refused as gone (WT_SESSION_GONE), is not counted as
a request in flight and does not wait. A reset or STOP_SENDING from the client reaches the
program with its HTTP/3 code and the application code it maps to (or -1, as
wtransport's unmapped codes are); the server's own carry the mapped code, and
its STOP_SENDING leaves its own side to write and finish. A stream naming a
session past the client's MAX_STREAMS is refused at once, and one waiting for
a request that turns out malformed is let go with WT_SESSION_GONE.

**Close and drain** (`closing.ts`, `refusals.ts`): the client's CLOSE reaches
the program with its code and reason, the server finishes its half, and every
stream of the session is reset with WT_SESSION_GONE; a FIN or a reset alone
closes with code 0 and no reason; the session's slot is free once both halves
of its CONNECT stream are done. The server's `close` writes the capsule whole
(0x6843, the length, the code, the reason) and the FIN, refuses a reason past
1,024 bytes (H3_INVALID), and the client's CLOSE in answer ends the session
quietly. DRAIN both ways, and an unknown capsule skipped. A CLOSE before the program
answered the session ends it at once, the CONNECT stream reset both ways and
the slot free; a close HTTP/3 itself made (a CONNECT whose DATA overruns its
`content-length`) is not reported as the client's. Malformed, each
resetting the CONNECT stream and ending the session: a CLOSE shorter than its
code or with a reason past 1,024 bytes, a DRAIN with a payload, the stream
ending inside a capsule (H3_DATAGRAM_ERROR, RFC 9297 §3.3), and anything after
a CLOSE (H3_MESSAGE_ERROR, draft-02 §5; with this side's half finished
already, as STOP_SENDING). A CLOSE of exactly 1,024 bytes of reason is read.

**Each call's refusals** (`refusals.ts`): `accept` and `refuse` of a session
not asked for, `refuse` with a status outside 400 to 599, a datagram, stream or
close for a session not accepted, a write, reset or STOP_SENDING for no
stream or after the connection failed, a write to the client's unidirectional stream, and the HTTP/3 layer's
`acceptStream`, `refuseStream`, `writeStream`, `resetStream`,
`discardRequest`, `writeDataWhole` (H3_INVALID before the head, H3_TOO_LARGE
past a buffer) and `openStream` with WebTransport off.

**The program's mistakes panic**, each in its own program: a
`webtransportSessions` past 256 (`net_webtransport_bad_sessions`);
WebTransport over a QUIC connection that takes no datagrams
(`net_webtransport_bad_datagrams`), and QUIC datagrams advertised with
WebTransport off (`net_webtransport_bad_datagrams_off`); a `WebTransport` over
a connection with WebTransport off (`net_webtransport_bad_layer`);
`maxStreams` of 0 or past 4,096 (`net_webtransport_bad_streams`,
`_bad_streams_high`); `maxPending` negative or past 4,096
(`net_webtransport_bad_pending`, `_bad_pending_high`); and a window outside its buffer for
`sendDatagram`, `close`, `writeStream` and `writeDataWhole`
(`net_webtransport_datagram_window`, `_close_window`, `_stream_window`,
`_whole_window`).

**Nothing allocates per datagram, stream or session** (`arena.ts`, every
server call measured on its own with `Arena.used()`): 200 rounds on a warm
session, each a 300-byte datagram and a bidirectional and a unidirectional
stream in, each echoed, keep 0 bytes; 100 sessions through one session slot —
CONNECT, a 200, a datagram each way, a CLOSE with a 40-byte reason, both FINs
— keep 0 bytes; five connections through one QUIC slot keep 0 bytes for the
reset and 0 for everything after each handshake, the layer forgetting its
sessions when the connection restarts (`Http3Connection.generation`). The
`_f64` twin runs every check under `--number-mode f64` with the same output.

**The recording** (`golden.ts`): wtransport 0.7's SETTINGS, CONNECT,
datagram, streams and close, replayed byte for byte; the server's SETTINGS,
200, echoes and CLOSE capsule pinned byte for byte.

## Caps

All fixed at start-up and checked when the object is made:

| Cap | Where | Default | Bounds | What it sizes |
| --- | --- | --- | --- | --- |
| Sessions at once | `Http3Config.webtransportSessions` | 0 (off) | 0 to 256 | the session table; advertised as SETTINGS_WEBTRANSPORT_MAX_SESSIONS |
| Streams of one session | `WebTransportConfig.maxStreams` | 64 | 1 to 4,096 | refusal past it; the streams themselves are QUIC's slots |
| Streams waiting for a session | `WebTransportConfig.maxPending` | 16 | 0 to 4,096 | the waiting room and its hash |
| Datagrams queued | `QUIC_CONN_DATAGRAM_QUEUE` | 8 each way | fixed | QUIC's rings |
| Datagram size | the QUIC configuration's `maxDatagramFrameSize` | — | 1 to 1,500 | the layer's datagram buffer, and QUIC's ring entries |
| A CLOSE reason | `WT_REASON_MAX` | 1,024 | fixed | each session's capsule buffer |

What the layer makes, once: per session, 1,028 bytes for a CLOSE capsule's
payload, 16 for a capsule header and 68 of state; per QUIC stream slot, 28;
per waiting place, 24 and two buckets of 4; and a datagram buffer each way and
a capsule buffer (the datagram size twice, and 1,044 bytes). The HTTP/3 seam
adds 16 bytes per QUIC stream slot (the streams to step again, and those
waiting for SETTINGS).

## What is and is not wiped

WebTransport holds no key material; the packet keys are QUIC's and TLS's. What
it holds is application data — a datagram, a stream's bytes in HTTP/3's
`data`, a CLOSE reason — in buffers that are overwritten by the next and zeroed
by nothing. The waiting room's salt (four bytes of entropy) is kept for the
layer's life, unwiped.
