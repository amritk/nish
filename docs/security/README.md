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
| SHA-256 block kernel | [crypto-sha256-hw.md](crypto-sha256-hw.md) | `runtime/runtime-sha256.c`; its lowering (`isSha256Seam` in `src/kernels.ts`, `emitKernelArm` in `src/emit.ts`) | 0 / 0 / 0 / 1 | 0 / 0 / 0 / 1 |
| P-256 and X25519 | [crypto-ecc.md](crypto-ecc.md) | `std/crypto/p256.ts`, `std/crypto/x25519.ts`, `std/crypto/ed25519.ts`, their constant-time fixtures | 0 / 0 / 0 / 3 | 0 / 0 / 0 / 0 |
| RSA signatures | [crypto-rsa.md](crypto-rsa.md) | `std/crypto/rsa.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ²³ |
| SHA-2, HMAC, HKDF, ct, base64url | [crypto-k1.md](crypto-k1.md) | `std/crypto/sha256.ts`, `sha512.ts`, `hmac.ts`, `hkdf.ts`, `ct.ts`, `base64url.ts` | 0 / 3 / 0 / 6 ¹ | 0 / 0 / 0 / 0 |
| DER, PEM, X.509 | [crypto-x509.md](crypto-x509.md) | `std/crypto/x509.ts` | 0 / 0 / 1 / 11 | 0 / 0 / 0 / 2 |
| Constant-time checks | [ct-verification.md](ct-verification.md) | `tests/ct-asm.js`, `tests/ct-asm-runtime.js`, `tests/ct-timing.js`, the `ct_asm_*` fixtures, the harness in `tests/run.js` | 0 / 0 / 0 / 18 ² | 0 / 0 / 0 / 1 |
| Codegen | [codegen.md](codegen.md) | `src/bounds.ts`, `src/attributes.ts`, `src/escape.ts`, `src/parallel.ts`, `src/emit-arrays.ts` | 0 / 5 / 3 / 4 ³ | 0 / 0 / 0 / 0 |
| C runtime | [runtime.md](runtime.md) | `runtime/*.c`, `runtime/nish.h`; RT-14 to RT-16 and RT-18 anchor in `src/` (`emit-strings.ts`, `escape.ts`, `emit.ts`, `declarations.ts`, `builtins.ts`, `expressions.ts`, `attributes.ts`, `parallel.ts`) | 0 / 2 / 15 / 14 ⁴ | 0 / 0 / 0 / 2 |
| CLI and `nish run` | [cli.md](cli.md) | `src/compile.ts`, `src/run-cache.ts`, `src/compilation.ts` (module resolution), `std/cli.ts` (the terminal and colour probe) | 0 / 1 / 2 / 7 ⁵ | 0 / 0 / 0 / 0 |
| TLS 1.3 server and client handshakes, records and TCP carrier | [tls.md](tls.md) | `std/net/tls.ts`, `std/net/tls/codec.ts`, `std/net/tls/schedule.ts`, `std/net/tls/record.ts`, `std/net/tls/record-server.ts`, `std/net/tls/client.ts`, `std/net/tls/record-client.ts`, `std/net/tls/verify.ts`, `std/net/tls-tcp.ts` | 0 / 0 / 1 / 5 ⁹ | 0 / 0 / 0 / 3 |
| QUIC packets, connections and listener | [quic.md](quic.md) | `std/net/quic-packet.ts`, `std/net/quic.ts`, `std/net/quic-frame.ts`, `std/net/quic-conn-params.ts`, `std/net/quic-conn-ack.ts`, `std/net/quic-conn-cid.ts`, `std/net/quic-listener.ts`, `std/net/quic-recovery.ts` | 0 / 0 / 1 / 9 ¹¹ | 0 / 0 / 0 / 0 |
| Supply chain | [supply-chain.md](supply-chain.md) | `install.sh`, `bin/`, the install, seed and build scripts, `.github/workflows/`, `runtime/nish.mjs` and `shim.mjs`, `web/` | 3 / 0 / 4 / 21 | 0 / 0 / 0 / 0 ⁶ |
| HTTP/1.1 and WebSocket | [http1.md](http1.md) | `std/net/http1.ts`, `std/net/http1-server.ts`, `std/net/websocket.ts` | 0 / 0 / 2 / 0 | 0 / 0 / 0 / 2 ⁷ |
| HTTP/1.1 client | [http1-client.md](http1-client.md) | `std/net/http1-client.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 1 |
| Blocking HTTP client | [http-client.md](http-client.md) | `std/net/http-client.ts` | 0 / 0 / 0 / 7 | 0 / 0 / 0 / 2 |
| HTTP/2 | [http2.md](http2.md) | `std/net/http2.ts`, `std/net/http2-tls.ts`, `std/net/hpack.ts` | 0 / 0 / 2 / 0 | 0 / 0 / 0 / 1 ⁷ |
| HTTP/3 | [http3.md](http3.md) | `std/net/http3.ts`, `std/net/http3-server.ts` | 0 / 0 / 0 / 6 | 0 / 0 / 0 / 1 ⁷ |
| WebTransport | [webtransport.md](webtransport.md) | `std/net/webtransport.ts` | 0 / 0 / 0 / 1 | 0 / 0 / 0 / 1 ⁷ |
| JSON | [json.md](json.md) | `std/json-tokenizer.ts`; the typed layer: `std/json-typed.ts`, `src/json-typed.ts`, `src/emit-json.ts`; the dynamic tree: `std/json-value.ts`, `JsonWriter.keyBytes` and `stringBytes` in `std/json.ts` | 0 / 0 / 1 / 2 | 0 / 0 / 0 / 1 ¹⁰ |
| Percent-decoding, query strings and URL parsing | [url.md](url.md) | `std/net/url.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ¹² |
| YAML into a JsonDocument | [yaml.md](yaml.md) | `std/yaml-json.ts` | 0 / 0 / 2 / 2 | 0 / 0 / 1 / 0 |
| `nish:secret` checker rules | [secret.md](secret.md) | `src/secret.ts`; `Compilation.checkSecrets` in `src/compilation.ts`; the field rule's `src/structs.ts`, `src/members.ts`, `src/interop-header.ts`, `src/attributes.ts`, `src/codes.ts` and `src/types.ts` | 0 / 0 / 2 / 3 | 0 / 0 / 0 / 0 |
| HTTP router | [router.md](router.md) | `std/net/router.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ¹³ |
| Regular expressions | [regex.md](regex.md) | `std/regex.ts`; the `nish_regex_scan` kernel in `runtime/runtime-simd.c`, its contract in `runtime/nish.h` and its lowering in `src/kernels.ts` | 0 / 0 / 1 / 4 | 0 / 0 / 0 / 0 ¹⁴ |
| `nish:term` and `std/term` | [term.md](term.md) | `runtime/runtime-term.c`, `std/term.ts`; the `nish:term` builtins' checker rules in `src/` | 0 / 0 / 1 / 4 | 0 / 0 / 0 / 0 |
| `nish/bytes` runs and `copyBytes` | [bytes.md](bytes.md) | `runtime/runtime-bytes.c`, `std/bytes.ts`; their lowering in `src/kernels.ts` and `src/emit-arrays.ts`; the N-API array argument in `src/interop-napi.ts` | 0 / 0 / 0 / 2 | 0 / 0 / 0 / 0 |
| Browser host | [runtime-browser.md](runtime-browser.md) | `runtime/browser.mjs`, `runtime/browser.d.ts`, `runtime/core/host.mjs` | 0 / 0 / 1 / 1 | 0 / 0 / 0 / 0 ¹⁵ |
| `--sandbox` | [sandbox.md](sandbox.md) | `runtime/runtime-sandbox.c`; the wrapper and the scope constants in `src/emit.ts`; the flag, its refusals and the directory scopes in `src/compile.ts`, `src/options.ts`; the `ffi` widening in `src/compilation.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| SQLite amalgamation and `nish/sqlite` | [sqlite.md](sqlite.md) | `runtime/sqlite/sqlite3.c`, `runtime/sqlite/sqlite3.h`, `runtime/sqlite/nish-sqlite.c`, `std/sqlite.ts` | 0 / 0 / 0 / 1 | 0 / 0 / 0 / 1 |
| A dependency's capabilities | [capabilities.md](capabilities.md) | `src/compilation.ts` (`readCapabilityPolicy`, `refuseDependencyCapabilities`), `src/capability-report.ts` (`dependencyPackages`, `dependencyMasks`, `dependencyWitness`), `src/manifest.ts` (`manifestReadGrants`) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ¹⁶ |
| PostgreSQL client | [postgres.md](postgres.md) | `std/net/postgres.ts` | 0 / 0 / 2 / 3 | 0 / 0 / 0 / 0 ¹⁷ |
| bcrypt | [crypto-bcrypt.md](crypto-bcrypt.md) | `std/crypto/bcrypt.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ¹⁸ |
| Compression and HTTP content coding | [compress.md](compress.md) | `std/compress/deflate.ts`, `gzip.ts`, `zlib.ts`, `checksum.ts`, `runtime/runtime-checksum.c`, `std/net/http-compress.ts`, `Http1Connection.acceptEncoding`, `acceptEncodingOf`, `identityRefused`, `respondEncoded` and `unrespond` in `std/net/http1-server.ts` | 0 / 0 / 3 / 0 | 0 / 0 / 0 / 0 ¹⁹ |
| P-384 ECDSA verification | [crypto-p384.md](crypto-p384.md) | `std/crypto/p384.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ²⁰ |
| PKI trust anchors | [crypto-pki.md](crypto-pki.md) | `std/crypto/pki-roots.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 ²¹ |
| PKI path validation and hostnames | [crypto-pki.md](crypto-pki.md) | `std/crypto/pki.ts` | 0 / 0 / 1 / 4 | 0 / 0 / 1 / 9 ²⁴ |
| DNS stub resolver, its codec, `resolv.conf` and `hosts` | [dns.md](dns.md) | `std/net/dns.ts`, `std/net/dns-resolver.ts`, `std/net/dns-message.ts`, `std/net/dns-config.ts` | 0 / 0 / 1 / 0 | 0 / 0 / 0 / 0 ²² |
| **Total** ⁸ | | | **3 / 10 / 46 / 142** | **0 / 0 / 2 / 29** |

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
   count checked (WP40 B1.2), and RT-20 (Medium), the C resource a `using`
   owns (#861). RT-21 (Low), `nish_argv_init` testing `malloc`'s answer for
   null only after computing from it, was found by #888's harness stage while
   building the runtime under UBSan, fixed there, and is counted as a fixed
   Low. RT-24 and RT-25 (Medium), the mode race and the link a secret's
   write could follow, and RT-26 (Low), the umask on `mkdirSyncMode`, were
   decided and fixed by the stage that added the mode-taking writes (#992),
   and are counted as fixed. RT-27, RT-28 and RT-30 (Medium) and RT-29
   (Low), `spawnPiped`'s deadlock, output cap, pipe descriptors and SIGPIPE,
   were found and fixed by the stage that added it, and are counted as
   fixed; RT-30's Darwin window is recorded in the row and is not counted.
   RT-31, the stdin channel itself, is a decision and is not counted, and so
   is RT-32, how `netMss` reads the kernel's reply (#1094).
   RT-33 and RT-35 (Medium) and RT-36 (Low), the Unix path copy, the socket
   file's mode window and the error paths of the Unix-domain calls, were
   found and fixed by the stage that added them, and are counted as fixed.
   RT-34 (Low), the stale-socket unlink racing another binder, is counted as
   an open Low: its boundary is the socket's directory. RT-37 (Low), the
   descriptors `recvFd` closes and the family check, and RT-40 (Low),
   `spawnWithFds`' self-dups and collisions, were found and fixed by the stage
   that added descriptor passing, and are counted as fixed. RT-38 (Low), the
   window on Darwin before a received descriptor is close-on-exec, is counted
   as an open Low. RT-39, what `peerCredentials` reads and when, is a
   decision and is not counted. RT-17 and RT-19 were amended there, not
   reopened.
5. CLI-6 (Medium) was fixed in the runtime as RT-4. The compiler is built by
   the last release, so `nish` itself has the fix from 0.16.0. CLI-8 (Low)
   was left open by the CLI stage and fixed by #425 (for #386): the cache
   entry is named by a SHA-256. CLI-7 and CLI-9 (Low) were fixed by #486 once
   the release carrying RT-9's primitives seeded the compiler, and are counted
   as fixed Lows.
6. SC-17 (Low) is accepted rather than open, and is not counted: `curl … | sh`
   runs `install.sh` unverified, and the record says why that stands.
   SC-16 (Low), left open by the supply-chain stage, was fixed by #389's
   build provenance attestation and is counted as a fixed Low. SC-28
   (Medium) is counted as fixed: its Linux rows gate, and its macOS rows
   report rather than gate, for the reason its record gives.
7. H2-2, H3-4, WT-3, WT-4 and WT-5 (Low) are accepted, with the reason in
   their records, and are not counted, as SC-17 is not. H2-3, H3-5 and WT-2
   are open: the program owns the loop and the clock. WT-1 repeats H3-1 and
   is counted in its own record. H3-1, H3-2, H3-3, H3-6, H3-7, H3-8 and WT-1
   are closed and counted as fixed, and QUIC-9, the microsecond pacer H3-8
   rests on, is closed and counted as a fixed Low in the QUIC row. H1-1
   (Medium), the slowloris head, was closed by #895 (`headTimeout`), H2-1
   (Medium), the arena a header block left, by #473, and H2-4 (Medium), the
   resets the server sent for the client, by #805; each is counted as a fixed
   Medium. H1-3 is open: its record says "accepted for now", but it names
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
   The client (#480) adds three Lows. TLS-8, a secp256r1 share the client
   could not complete, was closed by `p256Ecdh` and is counted as a fixed
   Low. TLS-7, no TLS 1.2, client certificates, 0-RTT or client-side
   resumption, is open by design, and TLS-9, a refusal in the ServerHello's
   own `receive` sealed under the clear state, is open; both are counted as
   open Lows, beside the carrier's TLS-4.
10. JSON-1, JSON-4, JSON-5, JSON-6, JSON-7, JSON-8, JSON-9, JSON-11 and JSON-12 (Low) are accepted, with the reason in
    their record, and are not counted, and so is JSON-14 (Low), a `JsonNumber`'s
    bytes written raw. JSON-2 is open. JSON-13 (Medium), the map keys a body
    can make collide, was bounded by `jsonDecode` (#622, `maxMapKeys`) and
    closed by #900, which seeds the global `Map`'s string hash; it is counted
    as a fixed Medium. JSON-3, duplicate keys
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
    QUIC-10 (Low), ECN counts parsed and ignored, was closed by #914, which
    has the carriers mark ECT(0); it is counted as a fixed Low.
12. URL-1 to URL-8 (Low) are accepted, with the reason in their record, and
    are not counted: the byte API's output is not checked as UTF-8, a
    refused decode leaves the bytes before the refusal written, a repeated
    key is answered by its first value, an IPv6 host is compared as written,
    `user:@` writes back as `user@`, an empty http path stays empty, the
    URL parser leaves the input's length to its caller, and a host's
    trailing dot is kept, so `a.com.` is its own origin.
13. ROUTE-1 to ROUTE-7 are the shapes an attacker's target can take, checked
    and found to hold, and are not findings. ROUTE-8 (Low), dot segments
    matched as bytes, and ROUTE-9 (Low), the path matched before it is
    decoded, are accepted, with the reason in their record, and are not
    counted, as SC-17 is not.
14. REGEX-4 (Medium), iterating matches in time quadratic in the subject when
    a preferred branch reads to the end before a short one wins, is accepted,
    with the reason in its record, and is not counted: one search is linear,
    and the docs now say iterating may not be.
15. BROWSER-2 (Low), the module's state outliving a `NishExit`, and BROWSER-4
    (Low), a lone surrogate the core reads as U+FFFD, are accepted, with the
    reason in their record, and are not counted. The guide says what a
    caller does about each.
16. CAPS-1 to CAPS-4 are the ways a dependency could hide a capability,
    checked and found to hold, and are not findings. CAPS-5 to CAPS-8 (Low),
    the limits of a compile-time check (install scripts, the C behind a
    granted `ffi`, a function argument blamed on its template, nothing
    confined at run time), are accepted, with the reason in their record,
    and are not counted.
17. PG-1 to PG-8 are the shapes a hostile server's bytes can take, checked
    and found to hold, and are not findings. PG-9 (Medium), no TLS, PG-10
    (Low), no way to require SCRAM, and PG-11 (Low), MD5 and cleartext
    refused, are accepted, with the reason in their record, and are not
    counted. PG-12 (Low), ClientKey left in a hasher, and PG-13 (Low), an
    unbounded send buffer, were found by the module's first review and fixed
    before it merged. PG-14, the batcher's check of the ordinal a server
    routes rows by, holds and is not a finding. PG-15 (Medium), a late or
    repeated server event panicking on or reaching a reused run, PG-16
    (Medium), one bad text key failing its whole batch, and PG-17 (Low),
    collidable key hashing, were found by the batcher's first review and
    fixed before it merged.
18. BCRYPT-1 to BCRYPT-4, BCRYPT-6 and BCRYPT-7 (Low) are accepted, with the
    reason in their record, and are not counted: each is the reference's
    behaviour or the algorithm's, kept so a hash verifies wherever `crypt_r`
    does. BCRYPT-10 (Low), the calibrated width following a clock, is
    accepted too: the width changes only the speed, never a hash. BCRYPT-8
    (Low), accepted when found, is superseded, since the kernel is now as
    wide as the lanes given; BCRYPT-9 was a limitation of the language, since
    lifted. BCRYPT-5 is a property checked and found to hold, not a finding.
19. COMP-11, COMP-12 and COMP-13 (Medium), stale bytes queued by
    `respondEncoded` after `H1_AGAIN`, a `GzipWriter` panic inside its own
    bound, and the AArch64 CRC-32 kernel reading four bytes past its window,
    were found by a review of the first version and fixed. COMP-8 (Low) and COMP-9
    (Medium), a stream of small dynamic blocks rebuilding the decoder's
    tables and the BREACH class of length leaks, are accepted, with the reason
    in their record, and are not counted. COMP-1 to COMP-7 and COMP-10 are
    properties checked and found to hold.
20. P384-1 to P384-3 are properties checked and recorded, not findings: high
    `s` accepted, variable time on public input, and digest truncation.
21. PKI-R6 and PKI-R7 (Low) are accepted, with the reason in their record, and
    are not counted: the size cap and file-type check that a descriptor-based
    builtin would tighten, and the macOS Keychain the loader does not read.
    PKI-R1 to PKI-R5 are properties checked and found to hold.
22. DNS-1 to DNS-4 (Low) are accepted, with the reason in their record, and
    are not counted: DNS-1 to DNS-3 are the trust a stub resolver places in
    its recursive server, as glibc's and musl's do, and DNS-4 is the second
    literal reader a module that compiles on `wasm32` needs. DNS-5 (Medium),
    a datagram flood holding the caller's loop inside `DnsClient.ready`, was
    found and fixed by the resolver stage.
23. RSA-1, RSA-3 and RSA-4 (Low), the DigestInfo without its NULL refused,
    the key-size and exponent caps, and a message over 2^31 − 1 bytes
    panicking in the hash, are accepted, with the reason in their record, and
    are not counted. RSA-2 and RSA-5 are properties checked and found to hold.
24. PKI-18 (Medium) and PKI-21 to PKI-24 (Low) were found by running the
    module against x509-limbo and are fixed: a root's own constraints, a
    root checked as an issuer, key identifiers, the leaf's server profile and
    its key. PKI-17 (Medium) and PKI-19, PKI-20, PKI-25 to PKI-28 and PKI-30
    to PKI-32 (Low) are open and counted: no revocation, no policy
    processing, Names compared byte for byte, chains limbo accepts refused,
    criticality not read, two extensions' parts not decoded, no Public
    Suffix List, a leaf without extKeyUsage accepted as RFC 5280 reads it, a
    leading-period dNSName subtree read rather than refused, and a root
    without a subjectKeyIdentifier accepted, as one Mozilla ships is. #1028
    tracks PKI-26 to PKI-28.
    PKI-29 (Informational), a common name not checked against the SANs, is
    not counted. PKI-1 to PKI-16 are properties checked and found to hold.

## Fuzzed

Each parser below is a libFuzzer target in `tests/fuzz/targets/` (how to
build, run and replay one: [`tests/fuzz/README.md`](../../tests/fuzz/README.md)),
and its record says what fuzzing found. The TLS, QUIC, HTTP/1, WebSocket,
HPACK and X.509 targets each ran for at least 30 minutes from their seed
corpora and found no crash, sanitizer report, timeout or OOM, except
`tls-server-flight` and `websocket-client`, which have not yet had their
run; CI replays every
corpus on each PR and runs each target for 30 minutes weekly. RT-21 was found
building the runtime for the harness, not by a target.

| Record | Targets |
| --- | --- |
| [json.md](json.md) | `json-tokenizer`, `json-typed`, `json-value` |
| [url.md](url.md) | `url` |
| [regex.md](regex.md) | `regex` |
| [tls.md](tls.md) | `tls-client-hello`, `tls-record`, `tls-server-flight` |
| [quic.md](quic.md) | `quic-header`, `quic-frame` |
| [http1.md](http1.md) | `http1`, `websocket`, `websocket-client` |
| [http1-client.md](http1-client.md) | `http1-client` |
| [http2.md](http2.md) | `hpack` |
| [crypto-x509.md](crypto-x509.md) | `x509-der`, `x509-pem` |

## Not yet audited

Files of the attacker-facing surface (`std/net/**/*.ts`, `std/crypto/*.ts`,
`runtime/*.c`) that no record's `## Scope` table names yet.
`node scripts/security-scope.mjs` (run by `npm test` and CI) fails on a file
of that surface that is in no scope and not listed here, and on a row here
whose file is now in a scope or gone, so this list only shrinks: a new module
ships with its record (CLAUDE.md, "Definition of done"), and an audit that
takes a file in deletes its row.

| File | Why it is not in a record yet |
| --- | --- |
| `std/crypto/sha1.ts` | Reached only from WebSocket's `Sec-WebSocket-Accept`, where SHA-1 is a fixed RFC 6455 transform of a public key, not a security primitive; `http1.md` names it but no Scope table does. |
| `std/crypto/x509-random.ts` | The private key and serial `x509MintSelfSigned` needs, drawn from the OS CSPRNG; `crypto-x509.md` (X509-6) and `secret.md` cover it in their bodies, not in a Scope table. |
| `std/net/buffer-pool.ts` | Holds no parser: it lends fixed-size buffers and zeroes what a borrower used on give-back. No record has reviewed that zeroing yet. |
| `std/net/prefork.ts` | A supervisor over `spawn` and signals that reads no network input; its descriptor hygiene is RT-17 and RT-19 in `runtime.md`, and RT-40 covers `spawnWithFds`, which a supervisor may use to hand workers one listener instead (`prefork.ts` does not yet). |
| `std/net/qpack.ts` | HTTP/3's field decoder, which `http3.md` audits through its callers (the refusals of a field section) but does not list in its Scope table. |
| `std/net/tls/ticket.ts` | The session-ticket seal, open and strike register; `tls.md`'s Resumption section and its ticket-seal stage record the design and tests, but its Scope table does not list the file. |

## Open findings

Every finding still open across the records, most severe first. Where a
follow-up issue exists it is named. The rest are recorded in their records
only.

| Id | Severity | File | What is left | Follow-up |
| --- | --- | --- | --- | --- |
| PKI-17 | Medium | `std/crypto/pki.ts` | Revocation is not checked: no CRL, OCSP or stapled response is read, so a revoked certificate chains until it expires | — |
| H1-2 | Low | `std/net/http1-server.ts` (`fail`, the carriers' `close`) | After a refusal the socket is closed at once, without the lingering close RFC 9112 §9.6 describes, so a client still sending a body may see a reset instead of the 413 or 400 | — |
| H1-3 | Low | `std/net/http1-server.ts` (`acceptWebSocket`) | Accepting a WebSocket leaves 58 bytes in the arena until the program resets it; once a connection, not once a message | — |
| HC-1 | Low | `std/net/http1-client.ts` (`http1ClientFieldLine`) | Each response's fields and reason are kept as strings, about 59 bytes a response of three fields, until the program resets its arena; bounded for each response by `maxHeaderBytes` | — |
| H2-3 | Low | `std/net/http2.ts`, `std/net/http2-tls.ts` | No clock: a client that never acknowledges SETTINGS, or holds a connection idle, keeps its slot. The program owns the timeout | — |
| H3-5 | Low | `std/net/http3.ts`, `std/net/http3-server.ts` | No clock at the HTTP/3 layer: a client that trickles bytes keeps its slot. The program owns the timeout. WT-2 repeats it for sessions | — |
| WT-2 | Low | `std/net/webtransport.ts` | No clock and no rate cap on a session; the program may `close` or `drain` one. As H3-5 | — |
| AEAD-4 | Low | `runtime/runtime-aes.c` (`nish_aes_schedule`, `nish_aes_ctr`, `nish_aes_ghash`) | On the AES-NI and PMULL path the round keys, H's powers, counter blocks, keystream and GHASH state pass through vector registers and any spill of them, which no store from C or the language can wipe. The two stack buffers the kernels own are wiped by volatile stores, and `rk`, H's powers included, and H by `aesKeyWipe`'s when TLS and QUIC wipe a key (the ends TLS-2 and QUIC-2 list); the registers are recorded rather than reached | — |
| SHA256HW-2 | Low | `runtime/runtime-sha256.c` (`nish_sha256_compress`) | On the SHA-NI and ARMv8 SHA-256 path the state, the message words and every round's intermediates pass through vector registers, and on x86-64 seven spills of them, which no store from C or the language can wipe; the kernel keeps no buffer and writes only the new state to `h`, which HMAC wipes (K1-7). Recorded rather than reached, as AEAD-4 | — |
| RT-38 | Low | `runtime/runtime-net.c` (`nish_recv_fd`) | On Darwin a descriptor `recvFd` keeps is made close-on-exec by an `fcntl` after `recvmsg`, so a child another thread spawns in between inherits it; Linux marks it in the receive. The window RT-30 records for pipes, recorded rather than reached | — |
| TLS-4 | Low | `std/net/tls-tcp.ts` | No timeout in the carrier: a client may hold a slot as long as it keeps its connection open, and once every slot is held new connections are shed. The program owns the loop's timeout | — |
| TLS-7 | Low | `std/net/tls/client.ts` | TLS 1.2 and below are refused by design (`protocol_version`, or `illegal_parameter` for the downgrade sentinel); client certificates, 0-RTT and client resumption are not offered | — |
| TLS-9 | Low | `std/net/tls/record-client.ts` (`fail`, `pump`) | A handshake that fails within the `receive` that delivered the ServerHello seals its fatal alert in the clear, before the client's handshake write keys are installed | — |
| CT-16 | Low | `tests/run.js` | The check reads `clang -O2` for the baseline CPU and `x86-64-v3` (the one level `--cpu` accepts); every other level is unread. Documented in [`docs/LANGUAGE.md`](../LANGUAGE.md#constant-time-ctselect-and-cteq) | — |
| JSON-2 | Low | `std/json-tokenizer.ts` (`reset`, `JSON_TOK_END_CEILING`) | A window ending within 64 bytes of 2^31 − 1 is refused so that no offset can overflow; no test reaches it, since it takes a 2 GiB array | — |
| SQL-2 | Low | `std/sqlite.ts` (`columnText`) | `sqlite3_column_text` answers NULL both for SQL `NULL` and when converting the value to text runs out of memory, and `columnText` reads either as `null`. A program can take a value it failed to read for an empty column. `columnInto` tells the two apart and answers `SQLITE_NOMEM`. | — |
| X509-12 | Low | `std/crypto/x509.ts` (`x509NameEqual`, `x509NameIsPrefix`) | Names compare as DER byte for byte, not after RFC 5280 §7.1's stringprep, so a re-encoded issuer Name does not chain and a re-encoded directoryName constraint does not match. Fails closed | — |
| X509-13 | Low | `std/crypto/x509.ts` (`x509DerNameSound`) | DER's SET OF order inside a multi-valued RDN is not checked: an unsorted RDN is a sound Name that matches only itself, never its sorted spelling. Fails closed | — |
| PKI-19 | Low | `std/crypto/pki.ts` | Certificate policies are not processed: no policy tree, so a chain is not refused for its policies | — |
| PKI-20 | Low | `std/crypto/pki.ts` | Names chain by DER byte for byte, as X509-12. Fails closed | — |
| PKI-25 | Low | `std/crypto/pki.ts` | Six chains x509-limbo accepts are refused, each under a check kept on purpose. Fails closed | — |
| PKI-26 | Low | `std/crypto/pki.ts` | An extension's criticality is not read, so a known extension marked against RFC 5280 §4.2 is accepted; each binds whichever way it is marked | #1028 |
| PKI-27 | Low | `std/crypto/pki.ts` | The authorityKeyIdentifier's issuer and serial and the authorityInfoAccess extension are not decoded, so a root's malformed AKI or a malformed AIA is accepted | #1028 |
| PKI-28 | Low | `std/crypto/pki.ts` | A wildcard over a public suffix, such as `*.co.uk`, is accepted: no Public Suffix List ships | #1028 |
| PKI-30 | Low | `std/crypto/pki.ts` | A leaf without extKeyUsage is accepted, as RFC 5280 reads it, where the BRs require one | — |
| PKI-31 | Low | `std/crypto/pki.ts` | A dNSName subtree with a leading period is read as the names below it, not refused; an excluded one leaves the apex allowed | — |
| PKI-32 | Low | `std/crypto/pki.ts` | A root without a subjectKeyIdentifier anchors a path, since one root Mozilla ships lacks it | — |

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
