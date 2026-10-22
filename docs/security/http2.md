# Security record: HTTP/2 — frames, the connection and its TLS carrier

The record of WP34's lane H2 past HPACK: `nish/net/http-fields` (the header
model HTTP/2 and HTTP/3 share), `nish/net/http2-frame` (the frames of RFC 9113
§6), `nish/net/http2` (the server side of a connection) and
`nish/net/http2-tls` (the connection over `nish/net/tls-tcp` with ALPN `h2`).
It says what each refuses and with what, what it caps and where the cap is
set, what it keeps in memory and for how long, and the test that pins each
property. HPACK itself is `nish/net/hpack` (#406), which has no record of its
own yet; what it cost this lane is H2-1 below. It is written with the code
rather than after an audit, so that the audit of the protocol stack starts
from evidence.

**Result.** Every refusal RFC 9113 names is made, as the connection error
(GOAWAY) or the stream error (RST_STREAM) the RFC classes it as, and none is
a panic; a panic is only ever the program's own mistake (a window outside its
buffer, a cap out of range, a frame no peer may accept). Every cap is a number
the program fixes at start-up. The data path — DATA in, DATA out,
WINDOW_UPDATE, PING, SETTINGS, RST_STREAM — allocates nothing, measured both
by `Arena.used()` and by resident memory. Two findings are open: H2-2 (Low),
frames that cost only CPU; and H2-3 (Low), no clock in the connection or the
carrier. Two are fixed: H2-1 (Medium), the memory each request's header block
left behind; and H2-4 (Medium), resets the server sent at the client's
prompting, which the reset budget did not count (MadeYouReset).

## Scope

| File | Functions |
| --- | --- |
| `std/net/http-fields.ts` | `httpFieldNameValid`, `httpFieldValueValid`, `httpFieldConnectionSpecific`, `httpFieldSensitive`, `httpFieldsCheckOutgoing`, `HttpFields` (`readSection`, `takePseudo`, `readRequest`, `readResponse`, `readTrailers`) |
| `std/net/http2-frame.ts` | `http2ReadHeader`, `http2ParseFrame` and its helpers (`http2FrameUnpad`, `http2FramePriority`), `http2SettingError`, the eleven writers |
| `std/net/http2.ts` | `Http2Connection`: `feed`, `next`, `handleFrame` and the handler of each type, `gather`, `endBlock`, `trailers`, `tooLarge`, `credit`, `streamError`, `resetStream`, `fail`, `sendHead`, `respond`, `writeData`, `writeTrailers`, `reset`, `goaway`, `restart`, and the borrowed buffers: `lender`, `holdInput`, `holdOutput`, `holdBlock`, `giveInput`, `giveOutput`, `giveBlock`, `rest`, `drop`, `inputTail`, `received`, `consume`, `wantsWrite`; `Http2Pools` |
| `std/net/http2-tls.ts` | `Http2TlsServer`: `accept`, `readable`, `writable`, `signP256`, `next`, `flush`, `refused`, `close`, `rest` |

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
| H2-1 | Medium | `std/net/http2.ts` (`endBlock`, `trailers`), through `std/net/hpack.ts` (`HpackDecoder.decode`) | Each header block leaves memory in the arena until the program resets it. `HpackDecoder.decode` answers every field as fresh arrays, and three fresh lists, on every call; the connection reads them (keeping references, not copies) and nothing frees them. Measured by resident memory over a connection restarted and fed the same thousand GETs of four fields (`:path /index.html`) each round: 664 bytes a request, 66.9 MB after 100,000 requests and 715.7 MB after 1,100,000. A client that sends requests in a loop drives it — denial of service on attacker input, the shape of TLS-3. One request's share is bounded by `maxHeaderBlock` and `maxHeaderListSize`; what is not bounded is the count. `HttpFields` reusing its own two lists, rather than making new ones per read, took the figure from 712 bytes. Everything else a request costs is in the connection's slot, made once. | **Fixed** (#473; anchors at `main` `1fab4c8`, where `hpack.ts`, `http2.ts` and `http-fields.ts` are as at `e5c540b`, cited by function). `HpackDecoder.decode` now answers its fields in storage the decoder owns and reuses: each field is an array taken from a pool by its size class and given back at the next `decode`, so a field is valid only until the next header block on the connection, for any stream, and a program copies what it keeps: the arrays go back emptied and the next block may refill one with another stream's field, and `endBlock` clears `conn.fields` before it decodes, so a stale read of it finds nothing rather than the next block's octets. The literal strings, the cursor and the three lists are made once. The dynamic table keeps its entries' octets in one byte store (`HpackTable.bytes`, compacted as entries are evicted, at most about three times its maximum size) rather than an array per entry. A field past `maxHeaderListSize` is counted from the table and never copied, so the HTTP/2 Bomb — one entry of 4,000 octets named again by 16,000 one-octet indexes, 64.6 MB of fields in a 16 KB block — costs a lookup per index. A literal past the limit copies nothing but its value into the scratch, and a literal without or never indexing copies nothing into the scratch or the table: only the name the program keeps comes out of the table, straight into its field, which the list limit bounds, and nothing past it. A literal with incremental indexing puts its entry into the table, its name copied into the scratch first when the name is an index, since adding the entry may evict the one it names (RFC 7541 §4.4); a block of `7e 00` (incremental, naming index 62, empty value) against a 4,000-octet entry would make each two octets copy 4,000 out and 4,000 back, about 10^8 octets for a 16 KB block. So the decoder charges each literal what the table will copy, in and out, before copying it, and a block that would copy more than `HPACK_COPY_FACTOR` (4) times the larger of the table's maximum size and the block's own length fails with `HPACK_ERR_COPY_BUDGET`, which `endBlock` answers with the connection error ENHANCE_YOUR_CALM, the block being valid HPACK used as a lever (RFC 9113 §10.5) rather than a broken one (COMPRESSION_ERROR): 16,384 octets per block under the default 4,096-octet table and a block of at most 4,096, up to 65,536 for a 16,384-octet `maxHeaderBlock`. `HpackDecoder.tableCopied` counts the octets where they move, in `appendNameAt` and `appendValueAt` from the dynamic table and in `HpackTable.add`, apart from the budget, which is charged before the copies: the 101 blocks of 5,000 without literals, and the 101 of never, copy 1,616,000 octets out of the table, the 4,000-octet names of the four literals each block keeps under the list limit and nothing for the 4,996 past it; two incremental re-adds of the 4,000-octet entry copy 16,000, as measured and as charged, and are answered, and 5,000 of them end the connection with GOAWAY ENHANCE_YOUR_CALM. With the literal path put back to copying every indexed name into the scratch whatever its kind, as `a52df8b`'s did, the without and never batches copy 2,021,616,000 octets each and both checks fail. The copy is a byte at a time, the runtime having no windowed array copy. Storage is bounded per connection: each size class holds at most about twice the header-list limit and only the classes up to log2 of the limit, plus one, hold any (sixteen, about 512 KB at most, under the default 16,384), the table about three times its maximum size, and nothing is allocated once those have grown to the largest block and list seen; the decoder makes all of it on its first block (`HpackWork`), so an idle connection holds none of it. Measured by `Arena.used()` from one `rest` to the next, each batch after a like one that warms the connection: fifty bombs (each a 431), fifty refused streams past `maxStreams` each naming the entry three times, and fifty GETs answered move the arena by 0 bytes each, as do fifty blocks of 5,000 literals naming a 4,000-octet entry by index, for each of without and never indexing; with `main`'s `hpack.ts` and `http2.ts` (`e5c540b`) the same three batches move it by 6,120, −4,152 and 4,856 bytes, and fail. The carrier's five formats over a ticking clock, 3,640 bytes before, are 0, and an HTTP/2 request over loopback keeps 0 bytes where it kept 728. Tests: `link/net_http2_hpack_bomb: exits with 0 and stdout matches expected.out`, `link/net_http2_hpack_bomb_f64: exits with 0 and stdout matches expected.out`, `link/net_http2_hpack_table: exits with 0 and stdout matches expected.out`, `link/net_http2_hpack_table_f64: exits with 0 and stdout matches expected.out`, `link/net_http2_tls: exits with 0 and stdout matches expected.out`, `link/net_loopback: exits with 0 and stdout matches expected.out`. What it does not bound: one block's own cost, which `maxHeaderBlock`, `maxHeaderListSize` and the copy budget cap, and the CPU of reading every index of a block the RFC obliges the decoder to read whole (RFC 9113 §10.5.1), which H2-2's frame costs share; and the octets of a closed or reset stream's fields, `cookie` and `authorization` included, which stay in the scratch, the pools and the table until they are reused ("What is and is not wiped"). |
| H2-2 | Low | `std/net/http2.ts` (`next`, `handlePriority`, `handleData`, `handleWindowUpdate`) | Frames that need no answer cost only CPU and are not counted: PRIORITY, an empty DATA without END_STREAM, a WINDOW_UPDATE, a frame of an unknown type, and an empty CONTINUATION up to `H2_MAX_FRAGMENTS` (64) a block. Each allocates nothing and is read once, so the work is in proportion to the bytes the client sends, as it is for any traffic; CVE-2019-9518's "empty frames" flood costs the server no memory here. Frames that do need an answer (PING, SETTINGS) are read only while the output has room for it, so a client that never reads its acknowledgements stops being read (CVE-2019-9512, -9515). What a frame costs to find its stream grows with `maxStreams`: the slots are scanned, and a frame for a stream the connection does not hold also scans the memory of reset and closed streams (`maxStreams` + 16 each). At the default 100 that is a few hundred comparisons a frame. | **Accepted.** A budget per frame type would refuse conforming clients that send PRIORITY or WINDOW_UPDATE in bursts; the program owns the loop and may close a connection that sends much and asks little. A program that raises `maxStreams` far past the default buys the scan with it; an index from stream to slot is the follow-up if one needs to. |
| H2-3 | Low | `std/net/http2.ts`, `std/net/http2-tls.ts` | Neither has a clock. A client that never acknowledges the server's SETTINGS is never sent SETTINGS_TIMEOUT (§6.5.3), and one that holds a connection idle, or a stream half-open, keeps its slot; when every slot is held new connections are shed at once (TLS-4). Memory stays bounded, since nothing grows with time. | **Open, the program's to decide.** The program owns `pollWait`'s timeout and closes slots that have gone quiet; a timeout in the connection needs a clock argument the API does not take yet, as TLS-4 says for the carrier. |
| H2-4 | Medium | `std/net/http2.ts` (`streamError`, `endBlock`, `handleData`, `handlePriority`, `handleRstStream`) | The reset budget counted only the RST_STREAM frames the client sent (`handleRstStream`). A client that cannot send one itself gets the server to: on a stream it has just opened with a valid request, a WINDOW_UPDATE of zero, a PRIORITY that makes the stream depend on itself, a window past 2^31 − 1, DATA past the stream's window, trailers without END_STREAM, a header list past the cap (the 431), a malformed request, or simply one stream past `maxStreams` (REFUSED_STREAM). Each reset freed the slot at once, so the next stream could open straight away, without limit and without GOAWAY: the program had been handed H2_REQUEST and kept whatever work it started unless it watched for H2_RESET, and each stream left its decoded headers behind (H2-1). This is MadeYouReset (CVE-2025-8671), rapid reset's twin. | **Fixed** (#805). Every RST_STREAM the server sends for a stream error the peer caused, every refused stream and every 431 is charged to the same `resetCredit` as the client's own resets (`chargeReset`, through `refuseStream` and `streamError`), and the one past the budget is the connection error ENHANCE_YOUR_CALM; a stream the server finishes still earns one back. What the program resets itself (`reset`) is its own choice and is not charged. What it does not bound: since a stream the server ends (`localEnd`) earns a credit back, a client that alternates one answered request with one provoked reset keeps its credit indefinitely, at one full response of the server's work per reset; the budget counts resets net of finished streams, as it does for the client's own resets, so this bounds the rate to the server's answers rather than closing it. And the charge falls on conforming clients too: a 431's stream never opens, so it is never refunded, and a client that draws `resetBudget` + 1 431s on one connection (a proxy retrying with an oversized cookie) is cut off with ENHANCE_YOUR_CALM; a program that expects that raises `resetBudget`. Test: `link/net_http2_reset: exits with 0 and stdout matches expected.out` — each trigger once past a budget of two ends in GOAWAY ENHANCE_YOUR_CALM, and up to it leaves the connection answering; measured with the charge removed (`refuseStream` and the 431 not calling `chargeReset`), ten of its 21 checks fail: the nine "once more than resetBudget allows" and the mixed one; "earns the budget back" passes either way, since without the charge nothing is spent. |

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
and more resets than `resetBudget` allows (ENHANCE_YOUR_CALM), whether the
peer sent them (the rapid reset of CVE-2023-44487) or provoked the server into
sending them with a stream error or a stream past `maxStreams` (MadeYouReset,
CVE-2025-8671, H2-4; `tests/link/net_http2_reset`), with a finished stream
earning one back.
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
slot, and makes slot 0's connection in its constructor, so a bad configuration
is refused there with the connection's own words.

**A slot's connection is made by the first accept into it** (`net_http2_tls`,
written against `main` at `c8a00d6`, cited by function). `Http2TlsServer`'s
constructor makes the TLS pool, the shared `Http2Pools` and slot 0's
connection, and no other: `accept` makes a slot's connection the first time
the carrier hands that slot out, and keeps it, restarting it on every later
accept. `size()` stays the cap, and the pool never holds more than `size`
connections, so the memory a full pool holds is what it was when every slot
was made up front; what moves is when it is spent. A slot never accepted into
answers as a free one — no descriptor, `H2_ERROR` to `next`, done to `flush`,
nothing to `rest` and `close` — and `connection(slot)` names slot 0's. A second
accept into slot 0 moves `Arena.used()` by 0 bytes; the first into slot 1
moves it by that slot's connection; a 1,024-slot server has made one
connection, slot 0's.

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

**One date on every final head** (`net_http2`, `net_http2_tls` and their `_f64`
twins; written against `main` at `f8643b9`, cited by function rather than by
line). `encodeStatus` puts the connection's `date` straight after `:status` on
every final head, an error's 431 included, and never on a 1xx or trailers; a
program's own `date` (`http2NamesHoldDate`, which matches any ASCII case) is
sent instead, so a head never carries two. A mixed-case `Date` never reaches it:
`sendHead` refuses an uppercase name with `H2_INVALID` (§8.2.1). The field goes
as a literal without indexing, the static table's name and a value Huffman-coded
when that is shorter, so the dynamic table stays empty: the encoder's table
holds no entry after a dated response. `sendHead` counts the field in its bound
before it checks the output's room, so a head that does not fit waits
(`H2_AGAIN`) or is refused (`H2_INVALID`) whole, with nothing written: a head
whose bound fills a 1,024-byte output's room exactly is sent without the date
and refused with it. The 431 a connection answers past its own
`maxHeaderListSize` carries the date too, inside the control reserve. A bare
`Http2Connection` has no clock and sends none. `Http2TlsServer` points every
slot at its one `HttpDate`, refreshed at `connection(slot)` and `next(slot)`, so
a date is at most one turn of the program's loop stale. Five responses with the
pinned clock a second on before each format it five times and move
`Arena.used()` exactly as five on a still clock do (3,640 bytes, the new
streams' own); two slots answered in one second share one format. Tests:
`link/net_http2: exits with 0 and stdout matches expected.out`,
`link/net_http2_f64: exits with 0 and stdout matches expected.out`,
`link/net_http2_tls: exits with 0 and stdout matches expected.out`,
`link/net_http2_tls_f64: exits with 0 and stdout matches expected.out`.

## What is and is not wiped

HTTP/2 holds no key material: the record keys are TLS's (`docs/security/tls.md`).
What it holds is application data — header blocks in `block` and the input
buffer, bodies in the input and output buffers — which may carry credentials
(`cookie`, `authorization`). HPACK's decoded fields are reused for the next
block (H2-1); they are not wiped. The scratch, pool and table octets of a
closed or reset stream, `cookie` and `authorization` included, stay resident
until they are reused.
A credential sent by the server is never indexed, and so never sits in a
compression table where a peer could probe it.

**The three frame buffers are borrowed, and zeroed on give-back** (written
against `main` at `60f9cb2`, cited by function rather than by line). The input,
output and header-block buffers are not a connection's own: it borrows each
from an `Http2Pools` (`holdInput`, `holdOutput`, `gather`)
and gives it back through `BufferPool.give` once it is empty — the output in
`consume` when drained, the block once its HPACK decode is done, the input in
`rest` when every byte is read — and every one in `drop` and `restart`.
`give` zeroes the buffer as far as the connection wrote it (`inputUsed`,
`outputUsed`, `blockUsed`, each a high-water mark since the take), so the next
connection to borrow it reads none of the last one's requests, bodies or
headers. `Http2TlsServer` shares one `Http2Pools` among its slots, each pool's
ceiling the slot count, and calls `rest(slot)` after `readable`, `writable`,
`signP256` and a `next` that stalls, and `drop` in `close`; a connection on its
own makes a private pool of one buffer each. The zeroing is `give`'s plain
fill, not `giveSecret`'s `secureZero`: the bytes are application data, not
keys, and the buffer stays reachable on the free list, so the fill is not a
dead store. A slot whose TLS handshake is not done holds one output buffer,
its SETTINGS written and waiting, until the handshake ends or the slot closes:
a client that stalls its handshake keeps that one buffer, where it kept the
slot's three before (TLS-4). What is not zeroed: a buffer still lent to an
idle connection that holds unread bytes, the stream slots' and HPACK tables' per-slot state, and
the program's own copies. Tests: `link/net_http2: exits with 0 and stdout
matches expected.out` (section 11, "zeroed, as far as each was written" and
"and reads nothing the first wrote past what it wrote itself", both failing
with `give`'s fill removed), `link/net_http2_tls: exits with 0 and stdout
matches expected.out` and their `_f64` twins.
