---
name: Close the open security findings
overview: Close JSON-13 (seeded string hash for every Map/Set), H1-1 (HTTP/1 head deadline), H2-1 (HPACK into caller-owned storage), H1-3 and QUIC-10 (small Lows), and correct the stale CLI-7/CLI-9 index rows — each with a regression test shown failing before and passing after, and each moved to fixed in its record and the index.
stages:
  - id: seeded-hash
    title: "fix(runtime): seed the string hash of every Map and Set (JSON-13)"
    goal: A Map<string, V> / Set<string> hashes strings with a keyed hash under a per-process random seed, so attacker keys cannot be chosen to collide; insertion order unchanged.
    verification: npm run check && node tests/run.js map && node tests/run.js json && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && npm test
    todos:
      - id: sh-runtime-seed
        content: Add a per-process hash seed to the runtime (native from getrandom/getentropy, wasm32 from WASI random_get / the JS host's crypto), declared in nish.h — see Seeded hash
        status: pending
      - id: sh-emit
        content: Replace the unseeded FNV-1a string hash in src/emit-map.ts (and the hashKey contract comment in std/collections.ts) with a seeded keyed hash (SipHash-1-3 or equivalent) — see Seeded hash
        status: pending
      - id: sh-tests
        content: Add the regression test (a fixed set of keys that collide under the old hash no longer collide / the hash differs across two runs) shown failing on the base, plus golden .ll, llvm-as pass, native round trip, a negative test — see Seeded hash
        status: pending
      - id: sh-measure
        content: Measure the performance section before and after and record a Measured trailer with its noise band — see Seeded hash
        status: pending
      - id: sh-docs
        content: Move JSON-13 to fixed in docs/security/json.md (anchors at the stage's commit), note the wasm32 seeding caveat, and update LANGUAGE.md / the guide where the hash is described — see Seeded hash
        status: pending
  - id: http-hardening
    title: "fix(std): a deadline for an HTTP/1 head and HPACK decoding into caller storage (H1-1, H2-1)"
    goal: A slowloris client cannot hold an HTTP/1 slot past a whole-head deadline, and an HTTP/2 request loop no longer grows the arena per header block.
    verification: npm run check && node tests/run.js net_http1 && node tests/run.js net_hpack && node tests/run.js net_http2 && npm test
    todos:
      - id: hh-h1-deadline
        content: Add a whole-head deadline to Http1Server.expire, Http1TlsServer.expire and Http1Connection (std/net/http1-server.ts), configurable beside idleTimeout — see HTTP hardening
        status: pending
      - id: hh-h2-storage
        content: Make HpackDecoder.decode (std/net/hpack.ts) decode into storage the caller owns and reuse it from http2.ts endBlock/trailers so a request loop allocates nothing per block — see HTTP hardening
        status: pending
      - id: hh-h1-3
        content: Close H1-3 (acceptWebSocket's 58 bytes per upgrade) if it is small with the same caller-owned-storage approach; otherwise leave it open and say why in the record — see HTTP hardening
        status: pending
      - id: hh-tests-docs
        content: Regression tests in tests/link/ (slowloris head past the deadline is closed; N requests leave the arena flat) shown failing on the base; move H1-1, H2-1 (and H1-3 if closed) to fixed in http1.md / http2.md; update the guide pages — see HTTP hardening
        status: pending
  - id: quic-ecn
    title: "fix(std): mark ECT on QUIC datagrams the carriers send (QUIC-10)"
    goal: http3-server.ts and quic-listener.ts send each datagram with the connection's datagramEcn and set ecnMarking where the platform reports ECN, so ACK_ECN validation and CE response work in production.
    verification: npm run check && node tests/run.js net_quic && node tests/run.js net_http3 && npm test
    todos:
      - id: qe-wire
        content: Wire std/net/http3-server.ts and std/net/quic-listener.ts to pass datagramEcn to udpSendTo and set ecnMarking — see QUIC ECN
        status: pending
      - id: qe-tests-docs
        content: A regression test shown failing on the base (a carrier-driven connection marks ECT(0) and validates); move QUIC-10 to fixed in quic.md; guide page if one describes ECN — see QUIC ECN
        status: pending
  - id: security-index
    title: "docs(security): move the closed findings to fixed in the audit index"
    goal: docs/security/README.md's Areas counts, Total row and Open findings table say what is true on main after the three fix stages, and the stale CLI-7/CLI-9 rows (fixed in #486) leave the open table.
    verification: npm run lint && node tests/run.js security
    todos:
      - id: si-index
        content: Recompute the Areas counts and Total from the records on main, drop the closed rows from Open findings, and correct CLI-7/CLI-9 (fixed by #486) and its footnote — see Security index
        status: pending
---

# Close the open security findings

## Context

`docs/security/README.md` → "Open findings" lists three Mediums (JSON-13, H1-1,
H2-1) and several Lows. CLI-7 and CLI-9 are already **fixed** in
`docs/security/cli.md` (#486: `refuseCacheRoot`, `distrustOf`, `programOnPath`
taking the first executable `nish`, all in `src/compile.ts` today); only the
index still lists them open (Areas row "CLI and `nish run`" shows 0/0/0/2 open).
So requirement 4 needs no code and no seed check: it becomes an index correction
in `security-index`. H1-3 and QUIC-10 name concrete fixes and are included;
`udpSendTo` already takes an `ecn` argument (`runtime/runtime-net.c`), so
QUIC-10 is wiring only.

## Seeded hash

**Owns:** `src/emit-map.ts`, `std/collections.ts`, `runtime/runtime.c`,
`runtime/runtime-host.c`, `runtime/runtime-wasm.c`, `runtime/nish.h`,
`runtime/shim.mjs`, `runtime/core/**`, `runtime/core.mjs`, `runtime/node.mjs`,
`runtime/browser.mjs`, `runtime/nish.mjs`, `runtime/*.d.ts`, `src/runtime.ts`,
`tests/run.js`, `tests/runtime-test.c`, `tests/cases/map_hash_*`,
`tests/link/map_hash_*`, `tests/bench/**`, `docs/security/json.md`,
`docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/guide/language/**`
(generated: `tests/self/goldens/checked/**`, `tests/cases/**/*.ll`, `tests/differential/**`)

- The string hash is emitted inline as FNV-1a (`emitStringHash`-area of
  `src/emit-map.ts`, ~line 165) and documented in `std/collections.ts`
  (`hashKey`). Replace it with a keyed hash (SipHash-1-3, or a keyed
  alternative with a stated rationale if SipHash costs too much on the
  performance section) keyed by a per-process seed read from the runtime.
- Seed: drawn once at startup (or lazily, once) from `getrandom`/`getentropy`
  natively; on wasm32 from WASI `random_get` or the JS host. If a wasm32 host
  can supply no entropy, say so in the record as the wasm32 caveat.
- Emitted IR calling a new runtime symbol is not a use of a new builtin in
  `src/`'s own source, so the rolling freeze is not crossed; confirm it with
  `bootstrap` (`scripts/bootstrap.sh --verify`).
- Insertion order must stay LANGUAGE.md's promise (`docs/LANGUAGE.md` ~8560):
  only bucket placement changes.
- Integer/float key hashes are out of scope.
- Measure: `node tests/run.js performance` before and after; `Measured:`
  trailer per `.claude/testing.md`.

## HTTP hardening

**Owns:** `std/net/http1-server.ts`, `std/net/http1.ts`, `std/net/websocket.ts`,
`std/net/http2.ts`, `std/net/http2-tls.ts`, `std/net/hpack.ts`,
`tests/link/net_http1*/**`, `tests/link/net_hpack*/**`, `tests/link/net_http2*/**`,
`tests/link/net_websocket*/**`, `docs/security/http1.md`, `docs/security/http2.md`,
`docs/guide/using-nish/**` (the net pages), `std/README.md`
(generated: `tests/self/goldens/checked/**`, `tests/differential/**`)

- H1-1: a deadline for a whole request head, counted from the head's first
  byte, read from the clock `expire` already receives; a head not complete by
  then closes the slot. Default and knob beside `idleTimeout`.
- H2-1: `HpackDecoder.decode` writes into a caller-owned buffer/field list that
  `http2.ts` keeps per connection and reuses across blocks; measure the arena
  over N requests flat (the record's 664 bytes/request goes to 0).
- H1-3: only if the same approach closes it in-scope; else stays open with the
  reason.

## QUIC ECN

**Owns:** `std/net/http3-server.ts`, `std/net/quic-listener.ts`,
`tests/link/net_quic_ecn*/**`, `tests/link/net_http3_ecn*/**`, `docs/security/quic.md`
(generated: `tests/self/goldens/checked/**`, `tests/differential/**`)

Depends (development and merge) on nothing; runs once a slot frees
(`--max-slices 2`). Pass `datagramEcn` to `udpSendTo` and set `ecnMarking`
where the socket reports ECN (Linux; not Darwin per `runtime-net.c`).

## Security index

**Owns:** `docs/security/README.md` · **Model:** sonnet

Depends on `seeded-hash`, `http-hardening`, `quic-ecn` (merged or escalated).
Recompute from the records on `main`, never by hand-merging a table; the
sibling `security-process` run also edits this file.

## Out of scope

Other Lows (H1-2, H2-3, H3-5, WT-2, TLS-4, AEAD-4, X509-6, CT-16, JSON-2,
SC-16); fuzzing (sibling run); `SECURITY.md` (sibling `security-process`).

## Verification

`npm run check`, `npm run lint`, `node tests/run.js <section>`, and an
undegraded `npm test` (read the skip count). `src/` changes also run
`WASI_SYSROOT=/usr node tests/run.js wasi` and `node tests/run.js performance`.
Goldens regenerated with `node tests/self/goldens.js --update`.
