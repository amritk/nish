# Security record: HTTP/2 over cleartext TCP (h2c)

The record of WP39 G7: `nish/net/http2-cleartext`, HTTP/2 over plain TCP
with prior knowledge (RFC 9113 §3.3). It is `nish/net/http2-tls`'s carrier
with a TCP socket in place of TLS and the connection preface checked by the
carrier before HTTP/2 sees a byte. It says what the carrier refuses and how,
what it holds before and after the preface, and the test that pins each
property. Written with the code, from RFC 9113 §3, at commit `7d7fdd8e`
(functions are cited by name).

**Result.** One finding, H2C-1 (Low), accepted by design: cleartext has no
confidentiality and no integrity. A peer that does not send the preface is
closed at the first byte that differs, having been sent nothing; one that
sends part of it holds one slot and 24 bytes until `prefaceTimeout`, and no
frame buffer. Past the preface the slot is `Http2Connection`'s, whose record
is [http2.md](http2.md).

## Scope

| File | Functions |
| --- | --- |
| `std/net/http2-cleartext.ts` | `Http2CleartextServer`: the constructor, `accept`, `admit`, `readable`, `writable`, `next`, `flush`, `expire`, `close`, `rest`, `holds`, `prefaced`, `live` |

Out of scope: `Http2Connection`, `Http2Pools`, HPACK and the frames
([http2.md](http2.md), whose H2-2 and H2-3 this carrier inherits once the
preface is whole), and `nish:net`'s sockets. The carrier calls the
connection's `@internal` `inputTail`, `received` and `endInput` exactly as
`http2-tls.ts` does; a change to their contract is a change to both carriers.

## Threat model

The attacker is anyone who can open a TCP connection to the listening port,
and, since nothing is encrypted, anyone on the path between client and
server. Every byte is theirs, split anywhere; they may open connections and
leave them idle, send part of the preface, send HTTP/1.1, or send garbage.

A win is a panic, memory or a slot a peer can hold without bound, a byte the
server sends to a peer that never proved it speaks HTTP/2, or a frame buffer
borrowed before the preface. The program driving the loop is trusted: its
mistakes (a pool of no slots, a preface timeout below one millisecond)
panic in the constructor.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| H2C-1 | Low | `std/net/http2-cleartext.ts` | h2c is plain TCP: anyone on the path reads every request and response, cookies and `authorization` included, and may change, inject or drop frames. Nothing in the carrier can detect it. | **Accepted, by design.** The module's doc comment and the user guide say it first: serve h2c only behind a TLS-terminating proxy, on loopback or on a private network; `nish/net/http2-tls` is the carrier for an open network. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

| Property | How | Test |
| --- | --- | --- |
| A peer that sends anything but the preface is closed at the first byte that differs, and is sent nothing: not `Http2Connection`'s SETTINGS and GOAWAY, which it would queue on a bad preface | `admit` compares each byte as it is read with `H2C_PREFACE` and calls `close` at the first mismatch; `flush` writes nothing while the preface is not whole (`live`) | `link/net_http2_cleartext: exits with 0 and stdout matches expected.out` ("an HTTP/1.1 request line is closed at its first byte, with nothing written", "an Upgrade: h2c request is closed, with nothing written", "and an eleventh that differs closes it, with nothing written") |
| No `Upgrade: h2c` (RFC 9113 §3.1 deprecates it) and no HTTP/1.1 fallback on the port | as above: `GET` differs from `PRI` at its first byte | as above |
| A slow preface holds one slot and its 24-byte array, and only until `prefaceTimeout` milliseconds after accept | `accept` stamps `since`; `expire(now)` closes every slot past its deadline whose preface is not whole, and walks nothing while none is waiting | `link/net_http2_cleartext: exits with 0 and stdout matches expected.out` ("ten bytes of the preface and silence wait no more than prefaceTimeout", "and are closed, with nothing written") |
| Before the preface no frame buffer is borrowed, so a pool filled mid-preface costs `size` × 24 bytes | the preface is read into the slot's own array; `accept` calls `restart`, which gives every buffer back, and nothing is fed to the connection until the preface is whole | `link/net_http2_cleartext: exits with 0 and stdout matches expected.out` ("and none of it has made a frame buffer (0 made)", "a server of 1024 slots and no connection has made no frame buffer (0) and one connection, slot 0's (1)") |
| Slot exhaustion sheds new connections at once rather than queueing them | `accept` closes the socket it took and answers `H2C_POOL_FULL` when every slot is held | `link/net_http2_cleartext: exits with 0 and stdout matches expected.out` ("two clients mid-preface fill the pool and a third is shed (1 shed)") |
| A peer that hangs up mid-preface frees its slot | `admit` closes the slot when `netRead` answers 0 or an error | `link/net_http2_cleartext: exits with 0 and stdout matches expected.out` ("ten bytes of the preface and a hang-up free the slot") |
| The data path allocates nothing, and an idle slot holds no frame buffer | the socket is read straight into the connection's input and written from its output; `rest` after each call | `link/net_http2_cleartext: exits with 0 and stdout matches expected.out` ("and the server's calls moved the arena not at all (0 bytes)", "and with every frame sent, the idle slot holds none of its frame buffers (0 lent)") |
| A pool of no slots, or a preface timeout below 1 ms, is the program's mistake and panics in the constructor | the two checks at the top of the constructor | `link/net_http2_cleartext_bad_slots: exits with 1 and stdout matches expected.out`, `link/net_http2_cleartext_bad_timeout: exits with 1 and stdout matches expected.out` |
| A third-party client and load generator interoperate | curl with `--http2-prior-knowledge`, and h2load, over loopback | `net_http2_cleartext: curl --http2-prior-knowledge GETs the page over HTTP/2, 200 with the short body`, `net_http2_cleartext: h2load -n 1000 -c 4 over prior knowledge: every request succeeds with a 2xx`, `` net_http2_cleartext: the server closes all ${connections} connections, each with no error, and exits 0 `` |

## What it does not bound

Past the preface there is no clock in the carrier: a client that has sent
the preface and then goes quiet keeps its slot (H2-3, as TLS-4 for the TLS
carrier). The program owns `pollWait`'s timeout and may `close` a slot it
judges idle. `expire` walks every slot while any preface is pending, which is
in proportion to `size`.
