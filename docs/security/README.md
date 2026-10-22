# Security audit index

The index of the repository's first security audit (#363). Each area was
audited by its own stage, and each stage left a record in this directory. A
record says what was checked, how, what was found, its severity and what became
of it, and it names the test that pins each property. How to report a
vulnerability, which releases get fixes and the threat model in brief are in
[`SECURITY.md`](../../SECURITY.md).

Every fix landed with a regression test that was shown failing on the stage's
base commit and passing after. An area that found nothing would still have
shipped its record and tests pinning what it checked.

**Severity.** Critical: forgery, key recovery, remote code execution. High:
memory corruption, a verifier that accepts bad input, secret-dependent timing
in a fixture path. Medium: denial of service (a panic, an unbounded loop or
allocation) on attacker input. Low: hardening and documentation drift.

## Writing a record

- **A record states the commit its `file:line` anchors are at.** A row
  rewritten after that base names the commit its own anchors are at, rather
  than moving them silently (#529, CG-5).
- **A record's Tests list names every check it cites by its exact
  `check(...)` string**, templated names as templates, so a grep from the
  record finds the test. Grep each one against `tests/run.js` before pushing
  (#557, rounds 2 and 4).
- **A cache entry's `key`, written last, is its only completeness signal.** A
  hit trusts the stored key alone, equal byte for byte to the computed one; a
  missing or mismatched key is a miss and the entry is rebuilt. Files removed
  by hand from an entry whose key is intact are out of scope for the run cache
  and the runtime cache alike (CLI-5, CLI-11), so a review need not raise
  them: #557's reviewers did in all five rounds, and each was refuted.

## Areas

Counts are by severity, C / H / M / L, and say what is true on `main` now. A
finding one stage left open and a later stage fixed is counted as fixed, under
the record that found it. The notes below the table name each such finding.

| Area | Record | Scope | Fixed (C / H / M / L) | Open (C / H / M / L) |
| --- | --- | --- | ---: | ---: |
| AEADs | [crypto-aead.md](crypto-aead.md) | `std/crypto/chacha20poly1305.ts`, `std/crypto/aes.ts`, `runtime/runtime-aes.c` | 0 / 0 / 0 / 3 | 0 / 0 / 0 / 1 |
| P-256 and X25519 | [crypto-ecc.md](crypto-ecc.md) | `std/crypto/p256.ts`, `std/crypto/x25519.ts`, their constant-time fixtures | 0 / 0 / 0 / 3 | 0 / 0 / 0 / 0 |
| SHA-2, HMAC, HKDF, ct, base64url | [crypto-k1.md](crypto-k1.md) | `std/crypto/sha256.ts`, `sha512.ts`, `hmac.ts`, `hkdf.ts`, `ct.ts`, `base64url.ts` | 0 / 3 / 0 / 4 ¹ | 0 / 0 / 0 / 0 |
| DER, PEM, X.509 | [crypto-x509.md](crypto-x509.md) | `std/crypto/x509.ts` | 0 / 0 / 0 / 8 | 0 / 0 / 0 / 1 |
| Constant-time checks | [ct-verification.md](ct-verification.md) | `tests/ct-asm.js`, `tests/ct-asm-runtime.js`, `tests/ct-timing.js`, the `ct_asm_*` fixtures, the harness in `tests/run.js` | 0 / 0 / 0 / 17 ² | 0 / 0 / 0 / 1 |
| Codegen | [codegen.md](codegen.md) | `src/bounds.ts`, `src/attributes.ts`, `src/escape.ts`, `src/parallel.ts`, `src/emit-arrays.ts` | 0 / 4 / 3 / 4 ³ | 0 / 0 / 0 / 0 |
| C runtime | [runtime.md](runtime.md) | `runtime/*.c`, `runtime/nish.h`; RT-14 to RT-16 and RT-18 anchor in `src/` (`emit-strings.ts`, `escape.ts`, `emit.ts`, `declarations.ts`, `builtins.ts`, `expressions.ts`, `attributes.ts`, `parallel.ts`) | 0 / 2 / 7 / 8 ⁴ | 0 / 0 / 0 / 0 |
| CLI and `nish run` | [cli.md](cli.md) | `src/compile.ts`, `src/run-cache.ts`, `src/compilation.ts` (module resolution) | 0 / 1 / 2 / 5 ⁵ | 0 / 0 / 0 / 2 |
| TLS 1.3 server handshake, records and TCP carrier | [tls.md](tls.md) | `std/net/tls.ts`, `std/net/tls/codec.ts`, `std/net/tls/schedule.ts`, `std/net/tls/record.ts`, `std/net/tls/record-server.ts`, `std/net/tls-tcp.ts` | 0 / 0 / 1 / 3 ⁹ | 0 / 0 / 0 / 1 |
| QUIC packets, connections and listener | [quic.md](quic.md) | `std/net/quic-packet.ts`, `std/net/quic.ts`, `std/net/quic-frame.ts`, `std/net/quic-conn-params.ts`, `std/net/quic-conn-ack.ts`, `std/net/quic-conn-cid.ts`, `std/net/quic-listener.ts` | 0 / 0 / 1 / 8 ¹¹ | 0 / 0 / 0 / 0 |
| Supply chain | [supply-chain.md](supply-chain.md) | `install.sh`, `bin/`, the install, seed and build scripts, `.github/workflows/`, `runtime/nish.mjs` and `shim.mjs`, `web/` | 3 / 0 / 2 / 19 | 0 / 0 / 0 / 1 ⁶ |
| HTTP/1.1 and WebSocket | [http1.md](http1.md) | `std/net/http1.ts`, `std/net/http1-server.ts`, `std/net/websocket.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 1 / 2 ⁷ |
| HTTP/2 | [http2.md](http2.md) | `std/net/http2.ts`, `std/net/http2-tls.ts`, `std/net/hpack.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 1 / 1 ⁷ |
| HTTP/3 | [http3.md](http3.md) | `std/net/http3.ts`, `std/net/http3-server.ts` | 0 / 0 / 0 / 6 | 0 / 0 / 0 / 1 ⁷ |
| WebTransport | [webtransport.md](webtransport.md) | `std/net/webtransport.ts` | 0 / 0 / 0 / 1 | 0 / 0 / 0 / 1 ⁷ |
| JSON | [json.md](json.md) | `std/json-tokenizer.ts`; the typed layer: `std/json-typed.ts`, `src/json-typed.ts`, `src/emit-json.ts`; the dynamic tree: `std/json-value.ts`, `JsonWriter.keyBytes` and `stringBytes` in `std/json.ts` | 0 / 0 / 0 / 2 | 0 / 0 / 1 / 1 ¹⁰ |
| Percent-decoding and query strings | [url.md](url.md) | `std/net/url.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ¹² |
| `nish:secret` checker rules | [secret.md](secret.md) | `src/secret.ts`; `Compilation.checkSecrets` in `src/compilation.ts`; the field rule's `src/structs.ts`, `src/members.ts`, `src/interop-header.ts`, `src/attributes.ts`, `src/codes.ts` and `src/types.ts` | 0 / 0 / 2 / 3 | 0 / 0 / 0 / 0 |
| HTTP router | [router.md](router.md) | `std/net/router.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ¹³ |
| **Total** ⁸ | | | **3 / 10 / 17 / 94** | **0 / 0 / 3 / 13** |

1. K1-6 (High) was found by the K1 stage and fixed by the two after it: `push`
   and `new Array` by the codegen stage, and the file reads and concatenation
   by the runtime stage. The one source left, `join`, was closed with CG-3
   (#427, for #382) and is counted under it.
2. CT-13, High *if real*, is closed as an artefact and is not counted: it did
   not reproduce in 54 later runs on a VM of the same class or in three
   weekly runs on the CI runners, and `ladderStep`'s code on both targets is
   made of instructions whose time does not follow their operands. The host
   and the driver layout that read the 35–42 were never re-measured, so its
   cause is not known. CT-19 (Low), the weekly run failed by one
   reading of `macEqual` that did not repeat, is fixed by the harness's
   re-measure rule and counted as a fixed Low.
3. CG-9 (Low) was fixed by the runtime stage as RT-7; the codegen record
   counts CG-9 and the runtime record counts RT-7. K1-6, which the codegen
   record also lists, is counted once, under K1.
4. RT-9 added the ownership primitives CLI-7 and CLI-9 need; it is counted as
   a fixed Low. RT-10, RT-11, RT-12 and RT-13 (Low) were left open by the
   runtime stage and fixed by #405 (closes #387). The "CG-3 (rest)" row of
   that record is CG-3 and is counted under codegen. RT-14 (Medium), a
   `string` lent to C by a `declare function` (WP27 S3.1), was decided and
   fixed by the stage that found it, and is counted as a fixed Medium; its
   anchors are in `src/`, not in the runtime. RT-15 (Medium), a `string` a
   `declare function` returns (WP27 S3.2), is counted the same way. So is RT-16 (Medium), `readCString` and the literal `null` a `CPtr | null`
   parameter takes (WP27 S3.3), and RT-18 (Medium), a `u8[]` lent to C with its
   count checked (WP40 B1.2).
5. CLI-6 (Medium) was fixed in the runtime as RT-4. The compiler is built by
   the last release, so `nish` itself has the fix from 0.16.0. CLI-8 (Low)
   was left open by the CLI stage and fixed by #425 (for #386): the cache
   entry is named by a SHA-256.
6. SC-17 (Low) is accepted rather than open, and is not counted: `curl … | sh`
   runs `install.sh` unverified, and the record says why that stands.
7. H2-2, H3-4, WT-3, WT-4 and WT-5 (Low) are accepted, with the reason in
   their records, and are not counted, as SC-17 is not. H2-3, H3-5 and WT-2
   are open: the program owns the loop and the clock. WT-1 repeats H3-1 and
   is counted in its own record. H3-1, H3-2, H3-3, H3-6, H3-7, H3-8 and WT-1
   are closed and counted as fixed, and QUIC-9, the microsecond pacer H3-8
   rests on, is closed and counted as a fixed Low in the QUIC row. H1-3 is open: its record says "accepted for now", but it names
   the fix that closes it, so it is counted open and not accepted.
8. A finding that two records both list is counted in each record, except
   K1-6, which is counted once, under K1: CG-9 and RT-7, CLI-6 and RT-4, and
   H3-1 and WT-1. The Total therefore counts those twins twice.
9. TLS-3, QUIC-3's remainder and H3-1 now agree on what a handshake leaves
   behind: nothing. #492 moved the QUIC handshake's state into the slot,
   #512 made the server's P-256 signature in scratch, and #515 made the
   listener read the first Initial in place and answer into scratch, so a
   handshake through a reused slot keeps 0 bytes of arena memory.
   TLS-2, the AES key schedule zeroed by ordinary stores, was closed by
   #430's TLS stage and is counted as a fixed Low.
   TLS-5, the ChaCha20 state each ChaCha20-Poly1305 seal and open left
   unwiped, was found in review of the resumption design, closed by #639,
   and is counted as a fixed Low.
   TLS-1, an open connection's secrets kept in plain fields, was closed by
   #674's secret-fields stage, which made each a `Secret` field, and is
   counted as a fixed Low.
10. JSON-1, JSON-4, JSON-5, JSON-6, JSON-7, JSON-8, JSON-9, JSON-11 and JSON-12 (Low) are accepted, with the reason in
    their record, and are not counted, and so is JSON-14 (Low), a `JsonNumber`'s
    bytes written raw. JSON-2 is open, and so is JSON-13
    (Medium), the map keys a body can make collide: `jsonDecode` (#622)
    bounds the keys of one decoding with `maxMapKeys`, which mitigates it,
    and a seeded string hash for the global `Map` is what would close it. JSON-3, duplicate keys
    reported as tokens, was left open by the tokenizer stage and is fixed for
    `jsonDecode` callers by the typed layer (#573), which refuses a duplicate
    of a field; it is counted as a fixed Low. The tokenizer is unchanged, a
    program reading tokens itself still decides, and the duplicates of a key
    `ignoreUnknown` steps over are the accepted JSON-4. `JsonDocument` (#597)
    closes it for its own callers too, refusing a repeated key unless the
    program asks for `JSON.parse`'s reading. JSON-10, the memory a document
    keeps per value, was found and fixed by the same change (`maxValues`) and
    is counted as a fixed Low.
11. QUIC-2 (Low), what a connection holds between calls, was left open by the
    Q2 stage and closed for #430: every key a connection holds, AES schedules
    included, is wiped with a store no optimiser removes when its level, its
    key generation or the connection ends, the end of the closing or draining
    period included. It is counted as a fixed Low.
    QUIC-5 (Low), the server's static keys and the listener's seed, was
    closed for #430 too: `QuicListener.release` wipes the listener's seed,
    scratch, INVALID_TOKEN keys and last answer, and `Http3Server.stop` the
    configuration's stateless reset and Retry token keys with every
    connection. A copy of a key the caller keeps stays the caller's to wipe,
    and a configuration shared with another server is left keyed with zeros.
    It is counted as a fixed Low.
    QUIC-1 (Low), the `QuicKeys` the one-shot key forms answered, was left
    open by #430's secret-boundary stage and closed by #674's secret-fields
    stage: `quicKeys` and `quicKeysUpdate` now derive into a `QuicKeysSlot`
    the caller passes, leave in the arena only the `HkdfScratch` each makes,
    which wipes its hashers and output blocks before the call returns, and a
    slot the caller owns is the caller's to wipe. It is counted as a fixed Low.
    QUIC-6 (Low), RFC 9001 §6.6's AEAD limits, and QUIC-7 (Low), an
    optimistic ACK, were closed by #784: a write key
    starts a key update at three quarters of its confidentiality limit and
    the connection closes with AEAD_LIMIT_REACHED at it when none can be made
    or past the integrity limit, and the server skips a 1-RTT packet number
    every 128 to 1,024 packets and closes with PROTOCOL_VIOLATION on an ACK
    of one. Each is counted as a fixed Low.
12. URL-1, URL-2 and URL-3 (Low) are accepted, with the reason in their
    record, and are not counted: the byte API's output is not checked as
    UTF-8, a refused decode leaves the bytes before the refusal written, and
    a repeated key is answered by its first value.
13. ROUTE-1 to ROUTE-7 are the shapes an attacker's target can take, checked
    and found to hold, and are not findings. ROUTE-8 (Low), dot segments
    matched as bytes, and ROUTE-9 (Low), the path matched before it is
    decoded, are accepted, with the reason in their record, and are not
    counted, as SC-17 is not.

## Open findings

Every finding still open across the records, most severe first. Where a
follow-up issue exists it is named. The rest are recorded in their records
only.

| Id | Severity | File | What is left | Follow-up |
| --- | --- | --- | --- | --- |
| H1-1 | Medium | `std/net/http1-server.ts` (`Http1Server.expire`, `Http1TlsServer.expire`, `Http1Connection.idle`) | The idle timeout counts from the last byte moved, so a client that sends one byte of its head every `idleTimeout` (slowloris) keeps its slot, and with every slot held new connections are shed. Memory stays bounded. The fix is a deadline for a whole head | — |
| H2-1 | Medium | `std/net/http2.ts` (`endBlock`, `trailers`), `std/net/hpack.ts` (`HpackDecoder.decode`) | Each header block leaves memory in the arena until the program resets it: 664 bytes a request, so a client that sends requests in a loop grows the server. The way out is an HPACK decoder that decodes into storage the caller owns | — |
| H1-2 | Low | `std/net/http1-server.ts` (`fail`, the carriers' `close`) | After a refusal the socket is closed at once, without the lingering close RFC 9112 §9.6 describes, so a client still sending a body may see a reset instead of the 413 or 400 | — |
| H1-3 | Low | `std/net/http1-server.ts` (`acceptWebSocket`) | Accepting a WebSocket leaves 58 bytes in the arena until the program resets it; once a connection, not once a message | — |
| H2-3 | Low | `std/net/http2.ts`, `std/net/http2-tls.ts` | No clock: a client that never acknowledges SETTINGS, or holds a connection idle, keeps its slot. The program owns the timeout | — |
| H3-5 | Low | `std/net/http3.ts`, `std/net/http3-server.ts` | No clock at the HTTP/3 layer: a client that trickles bytes keeps its slot. The program owns the timeout. WT-2 repeats it for sessions | — |
| WT-2 | Low | `std/net/webtransport.ts` | No clock and no rate cap on a session; the program may `close` or `drain` one. As H3-5 | — |
| CLI-7 | Low | `src/compile.ts` (`runProgram`) | A cache hit does not check who owns the cache root. The primitive exists now (RT-9); `src/` may use it from the next release | — |
| CLI-9 | Low | `src/compile.ts` (`programOnPath`, `packageRootCandidates`) | The package root is trusted without an owner check, and `programOnPath` takes the first readable `nish`, where the shell takes the first executable one. Documented in [`docs/INSTALL.md`](../INSTALL.md); the primitives exist now (RT-9) | — |
| AEAD-4 | Low | `runtime/runtime-aes.c` (`nish_aes_schedule`, `nish_aes_ctr`, `nish_aes_ghash`) | On the AES-NI and PMULL path the round keys, H's powers, counter blocks, keystream and GHASH state pass through vector registers and any spill of them, which no store from C or the language can wipe. The two stack buffers the kernels own are wiped by volatile stores, and `rk`, H's powers included, and H by `aesKeyWipe`'s when TLS and QUIC wipe a key (the ends TLS-2 and QUIC-2 list); the registers are recorded rather than reached | — |
| TLS-4 | Low | `std/net/tls-tcp.ts` | No timeout in the carrier: a client may hold a slot as long as it keeps its connection open, and once every slot is held new connections are shed. The program owns the loop's timeout | — |
| X509-6 | Low | `std/crypto/x509.ts` (`x509MintSelfSigned`) | The mint takes its key and serial from the caller. A helper that draws both would have to be a native-only module | — |
| CT-16 | Low | `tests/run.js` | The check reads `clang -O2` for the baseline CPU and `x86-64-v3` (the one level `--cpu` accepts); every other level is unread. Documented in [`docs/LANGUAGE.md`](../LANGUAGE.md#constant-time-ctselect-and-cteq) | — |
| JSON-13 | Medium | `src/emit-json.ts` (`emitJsonDecodeMapBody`), `std/json-typed.ts` (`mapRoom`), `std/collections.ts` and `src/emit-map.ts` (the string hash) | The global `Map` hashes a string with no seed, so a body can give a `Map<string, V>` field keys that all collide. `maxMapKeys` (4,096 by default) bounds the keys of one decoding, and with them its probes; the fix is a seeded hash | — |
| JSON-2 | Low | `std/json-tokenizer.ts` (`reset`, `JSON_TOK_END_CEILING`) | A window ending within 64 bytes of 2^31 − 1 is refused so that no offset can overflow; no test reaches it, since it takes a 2 GiB array | — |
| SC-16 | Low | `.github/workflows/release.yml` | Immutable releases are on from v0.16.0 (`immutable: true`), so its assets and `SHA256SUMS` are fixed once published. Build provenance attestations, the stronger answer, are not: they need `id-token` and `attestations: write` on `release.yml` | #389 |

#382 also tracks the emitter half of CG-6. The codegen stage closed CG-6 by
refusing `orReturn` inside a `scope()` region. Joining before the return in
`src/emit-result.ts` would let that refusal go.

## Corrections still to make

None. The stages listed documentation corrections outside their own files,
and the security-policy stage made every one in `std/README.md`,
`docs/INSTALL.md`, `docs/LANGUAGE.md`, `docs/ARCHITECTURE.md`,
`docs/wp7-runtime.md`, `.claude/selfhost.md`, `codegen.md` and `cli.md`. The
three it left open have been made since: `runtime/shim.mjs` and
`runtime/nish.d.ts` open their writes with `O_NOFOLLOW`, as the native
runtime does for RT-4 (#405, [runtime.md](runtime.md)); `scripts/bootstrap.sh`
no longer needs the working-directory fallback (#425, [cli.md](cli.md)); and
`std/README.md` no longer says a string built by `join` can pass 2^31 − 1
bytes, since #427 closed CG-3.
