---
name: Open issues — thirteen fixes for the actionable backlog
overview: A sweep of the open issues on main @ 0209668 (2026-10-22) that one session can fix in one pull request with no owner decision outstanding. Each stage fixes one issue. Three touch the compiler (src/), the rest std/net, examples, bench, tests and docs. Left out — waiting on an owner decision (#800, #783, #744, #710, #696, #662, #661, #591, #461), blocked on hardware or upstream (#807, #732, #700), epics (#485, #483, #481, #480, #479, #472), needing toolchains or a quiet machine to measure (#475, #699, #477), and closeable as already done (#503, #389, #357, #447, #382).
stages:
  - id: parallel-fresh-dest
    title: "fix(checker): accept a fresh parallelMapInto destination beside captured arrays (#612)"
    goal: parallelMapInto accepts a fresh `const` destination that is never stored, passed or captured before the call, even beside a captured fresh array or a captured object holding an array; every way the destination could alias a capture stays refused
    verification: node tests/run.js parallel green with the new cases; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: pfd-rule
        content: In src/parallel.ts (with an escape fact from src/statements.ts if needed), treat a fresh `const` destination with no store, pass or capture before the call as disjoint from every capture
        status: pending
      - id: pfd-negatives
        content: One negative case per way in — the destination stored into a captured object, passed to a helper, aliased by another const, captured by the arrow, assigned from a captured array — each run after churn() natively
        status: pending
      - id: pfd-positives
        content: Positive tests/cases/par_into_* cases for #612's two programs, with goldens and native output equal to Node's; update the docs/LANGUAGE.md parallelMapInto rule and the threads guide page
        status: pending
  - id: c-symbols-libm
    title: "fix(codegen): reserve libm's C99/C23 names in c-symbols past LLVM 18's table (#651)"
    goal: A Nish function named after a libm C99/C23 function that LLVM 19+ recognises (tgamma, erf, ilogb, …) is renamed like the LLVM 18 ones, and the list says where it comes from
    verification: node tests/run.js c-symbols (the section running tests/c-symbols) green; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: csl-list
        content: Add the libm C99/C23 set to src/c-symbols.ts wholesale, and document in its header which sources the list tracks and how to refresh it
        status: pending
      - id: csl-tests
        content: Extend tests/c-symbols with a function named after one of the added names, checked to be renamed in the IR and to run natively with its own result
        status: pending
  - id: h2-reset-budget
    title: "fix(net): count the resets an HTTP/2 server sends against its reset budget (#805)"
    goal: Resets the server itself sends (stream errors, refused streams, a client-provoked RST_STREAM — MadeYouReset) are charged to the same reset budget as client resets, and a client that exhausts it gets GOAWAY ENHANCE_YOUR_CALM
    verification: node tests/run.js link (or the section running tests/link/net_http2*) green with the new adversarial case; npm run check, npm run lint green
    status: pending
    todos:
      - id: h2r-charge
        content: In std/net/http2.ts, charge every server-sent RST_STREAM (resetStream, streamError, refused streams) to resetCredit and send GOAWAY ENHANCE_YOUR_CALM when it runs out
        status: pending
      - id: h2r-tests
        content: Add a tests/link case whose client provokes server resets (malformed frames, flow-control errors) past the budget and expects GOAWAY; a client under budget is not cut off
        status: pending
      - id: h2r-record
        content: Update docs/security/http2.md with the MadeYouReset finding and its closure
        status: pending
  - id: relay-validated-peers
    title: "fix(net): cap relay peers by a validated address only (#806)"
    goal: The relay example counts a peer against its per-address cap only once QUIC has validated the address, so forged-source Initials cannot use up another address's places
    verification: node tests/run.js link (the section running tests/link/net_relay*) green with a forged-Initial case; npm run check, npm run lint green
    status: pending
    todos:
      - id: rvp-fix
        content: In examples/relay/relay.ts, claim the per-peer place only after addressValidated (or require retry), and say so in std/net/http3-server.ts's doc comment
        status: pending
      - id: rvp-tests
        content: Add a tests/link/net_relay_* case where forged-source Initials do not consume a real address's places, and a validated peer past the cap is still refused
        status: pending
      - id: rvp-docs
        content: Update docs/security/quic.md (or http3.md) and the networking guide page
        status: pending
  - id: secret-inferred-pins
    title: "test(checker): pin an unannotated secret(...) of a class written as a const alias or a call result (#791)"
    goal: tests/cases/secret_inferred pins a `secret(...)` whose class comes through a `const` alias and through a call result, so the inferred `Secret<T>` cannot regress for either
    verification: node tests/run.js cases (the section running tests/cases/secret_inferred) green; node tests/differential/goldens.js --update run; npm run check, npm run lint green
    status: pending
    todos:
      - id: sip-cases
        content: Extend tests/cases/secret_inferred.ts (and its .ll/.out) with the const-alias and call-result forms from #791, regenerating the golden with the repo's tooling
        status: pending
  - id: ct-docs-anchors
    title: "docs(security): correct the safegcd changelog's ct_asm claim and the off-main anchors in ct-verification.md (#799)"
    goal: Every commit anchor in docs/security/ct-verification.md resolves on main, and the 0.19.0 changelog no longer claims a ct_asm check that does not exist
    verification: every commit SHA cited in docs/security/ct-verification.md is an ancestor of origin/main (git merge-base --is-ancestor); npm run lint green
    status: pending
    todos:
      - id: cda-anchors
        content: Replace the off-main SHAs in docs/security/ct-verification.md (74c2716, a7cfdb7, c29cd40, d835d40) with their squash-merged equivalents on main
        status: pending
      - id: cda-changelog
        content: Correct the safegcd entry's ct_asm claim in CHANGELOG.md and changelog/0.19.0.json
        status: pending
  - id: crypto-bench-band
    title: "test(bench): print the noise band per crypto row and pin the --validate mismatch (#790)"
    goal: bench/crypto prints each row's noise band beside its figure, and a test proves --validate fails on a checksum mismatch
    verification: node tests/run.js crypto-bench green with the new check; npm run check, npm run lint green
    status: pending
    todos:
      - id: cbb-band
        content: In bench/crypto/run.mjs, print a per-row noise band column and document it in bench/crypto/README.md
        status: pending
      - id: cbb-validate
        content: Add a check to tests/run.js's crypto-bench block that runs --validate against a temp copy with a wrong expected.txt and expects failure
        status: pending
      - id: cbb-x25519-gate
        content: Make the crypto-bench "portable columns are portable" gate robust — on CI it fails curves openssl-portable at x25519@32 at 1.029x-1.046x against portableMinRatio 1.050x (PR runs 39749371728, 39754369094) because OpenSSL's x25519 is nearly the same code with and without the asm mask; prove portability for that kernel some other way (a kernel whose asm and portable paths actually differ, a band from repeated runs, or a documented per-kernel exemption) without weakening the check for the other families
        status: pending
  - id: quic-ecn
    title: "feat(net): use ECN counts in QUIC recovery (#474)"
    goal: QUIC recovery reads ACK_ECN counts and treats a rise in ECN-CE as a congestion signal (RFC 9002 §7.1), and validates ECN per RFC 9000 §13.4.2
    verification: node tests/run.js link (the section running tests/link/net_quic_recovery*) green with ECN cases; npm run check, npm run lint green
    status: pending
    todos:
      - id: qe-recovery
        content: Feed ACK_ECN's ECT0/ECT1/CE counts from std/net/quic-frame.ts into std/net/quic-recovery.ts, entering recovery on a CE increase and disabling ECN when validation fails
        status: pending
      - id: qe-tests
        content: Add net_quic_recovery cases for a CE increase shrinking the window once per round trip, and for ECN validation failure
        status: pending
      - id: qe-record
        content: Close the ECN part of #474 in docs/security/quic.md
        status: pending
  - id: lazy-slots-records
    title: "test(net): close the lazy-slot acceptance gaps left after #786 (#789)"
    goal: The records and tests #789 lists as open after the lazy-slot work match main — the TLS and HTTP/3 records cite the merged commits and check strings, the HTTP/2 TLS server's bad-config path is driven, and HTTP/3's per-slot arena delta is pinned
    verification: node tests/run.js link green with the new and changed cases; npm run check, npm run lint green
    status: pending
    todos:
      - id: lsr-records
        content: Fix the stale anchors and check strings #789 names in docs/security/tls.md and docs/security/http3.md
        status: pending
      - id: lsr-tests
        content: Drive Http2TlsServer in tests/link/net_http2_bad_config, and pin the arena delta per slot in tests/link/net_http3
        status: pending
  - id: nl8001-offsets
    title: "fix(checker): carry NL8001 into data-parallel arrows and offset uses (#629)"
    goal: A UTF-8 byte offset produced inside a data-parallel arrow, or used as an index, a call argument or a loop bound, draws NL8001 like the direct cases do; an offset only compared with another offset stays quiet
    verification: node tests/run.js portability (the section holding the new cases) green; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: nlo-arrow
        content: In src/portability-strings.ts, walk a data-parallel arrow's own body so an offset produced inside it is seen
        status: pending
      - id: nlo-uses
        content: Extend NL8001 to an offset used as an index, passed as an argument, used as a loop bound, or returned from a helper — each of #629's paths
        status: pending
      - id: nlo-tests
        content: One warning case per path in #629, and a quiet case for offset-vs-offset comparison; update the NL8001 rule in docs/LANGUAGE.md
        status: pending
  - id: hpack-caller-storage
    title: "fix(net): decode HPACK into caller-owned storage and bound the HTTP/2 header bomb (#473)"
    goal: HPACK decoding writes into storage the connection owns and bounds, so a small header block cannot expand ~1000:1 into fresh allocations (H2-1), and a refused stream is covered adversarially
    verification: node tests/run.js link (the sections running tests/link/net_http2*) green with the bomb and refused-stream cases; npm run check, npm run lint green
    status: pending
    todos:
      - id: hcs-decode
        content: Make std/net/hpack.ts decodeFields write into caller-owned, bounded storage and adapt http2.ts endBlock to it
        status: pending
      - id: hcs-tests
        content: Add the "HTTP/2 Bomb" worst case and a refused-stream adversarial case from #473's comments
        status: pending
      - id: hcs-record
        content: Close H2-1 in docs/security/http2.md with the measured bound
        status: pending
  - id: prefork
    title: "feat(net): run an HTTP server on every core with a prefork supervisor (#478)"
    goal: A Nish server can fork N workers sharing one SO_REUSEPORT port under a supervisor that restarts a dead worker, with an example and a bench measurement, per docs/wp42-multicore-server.md
    verification: node tests/run.js link (the section running the new net_prefork case) green; the example serves requests from more than one worker; npm run check, npm run lint green
    status: pending
    todos:
      - id: pf-module
        content: Add std/net/prefork.ts on top of tcpListenFlags and the non-blocking spawn/waitPid from #742, following the prefork stage of docs/wp42-multicore-server.md
        status: pending
      - id: pf-example
        content: Add examples/prefork-server.ts and a tests/link/net_prefork case that requests from several workers and kills one to see it restarted
        status: pending
      - id: pf-bench
        content: Measure bench/http1-server.ts across cores with the existing --cores flag and record it in bench/README.md; document the module in the networking guide page
        status: pending
  - id: ed25519
    title: "feat(std): Ed25519 signatures (RFC 8032) in std/crypto (#788)"
    goal: std/crypto signs and verifies Ed25519 per RFC 8032, passing its test vectors, with the private seed held as a Secret and every secret intermediate wiped
    verification: the new tests pass RFC 8032 §7.1 vectors natively; node tests/run.js crypto-bench green with the curves family; npm run check, npm run lint green
    status: pending
    todos:
      - id: ed-impl
        content: Add std/crypto/ed25519.ts reusing the field arithmetic of std/crypto/x25519.ts and std/crypto/sha512.ts, the seed a Secret computed inside expose and wiped
        status: pending
      - id: ed-tests
        content: RFC 8032 vectors, a rejected non-canonical signature and S >= L, and the wipe pin for the new secret intermediates
        status: pending
      - id: ed-bench-record
        content: Add Ed25519 to bench/crypto/curves and write its record in docs/security/crypto-ecc.md; document it in the standard-library guide page
        status: pending
---

# Open issues — thirteen fixes for the actionable backlog

Triaged on 2026-10-22 against main @ 0209668. The previous sweep (#763) ran
four of its eight stages and stalled; its remaining #612, #629 and #651 are
here, and its #503 is already fixed by #549.

## Shared and generated files

- **Generated** — regenerate, never edit or hand-merge: `tests/self/goldens/**`
  (`node tests/self/goldens.js --update`), `tests/differential/**`
  (`node tests/differential/goldens.js --update`), each stage's own
  `tests/cases/*.ll`, and `docs/IR_COOKBOOK.md`'s runtime prelude
  (`docs/cookbook/regen.sh`).
- **Shared, section-local** — a stage edits only its own rule, row or section
  and never another's: `tests/run.js` (append rows and checks beside your own
  section), `docs/LANGUAGE.md`, `docs/guide/**`, `docs/security/quic.md`,
  `docs/security/http3.md`, `docs/security/http2.md`. A textual conflict there
  at merge time is the merging stage's to resolve, keeping both sides.
- Every other path is owned by exactly one stage, below.

## parallel-fresh-dest (#612)

**Owns:** `src/parallel.ts`, `src/statements.ts`, `tests/cases/par_into_*`, `tests/cases/reject_par_*`, shared: `docs/LANGUAGE.md`, `docs/guide/using-nish/threads.md`, `tests/run.js`

A rule that lets a value through pins what it leaves out: one negative per way
the destination could alias a capture, run after `churn()`.

## c-symbols-libm (#651)

**Owns:** `src/c-symbols.ts`, `tests/c-symbols/**`, shared: `docs/LANGUAGE.md`, `tests/run.js`

## h2-reset-budget (#805)

**Owns:** `std/net/http2.ts`, `tests/link/net_http2_errors*`, `tests/link/net_http2_reset*`, shared: `docs/security/http2.md`, `tests/run.js`

## relay-validated-peers (#806)

**Owns:** `examples/relay/**`, `std/net/http3-server.ts`, `tests/link/net_relay*`, shared: `docs/security/quic.md`, `docs/security/http3.md`, `docs/guide/using-nish/networking.md`, `tests/run.js`

## secret-inferred-pins (#791)

**Owns:** `tests/cases/secret_inferred*`
**Model:** sonnet

## ct-docs-anchors (#799)

**Owns:** `docs/security/ct-verification.md`, `CHANGELOG.md`, `changelog/0.19.0.json`
**Model:** sonnet

## crypto-bench-band (#790)

**Owns:** `bench/crypto/run.mjs`, `bench/crypto/README.md`, `bench/crypto/lib/**`, shared: `bench/crypto/curves/family.json` (the portable-ratio fields only), `tests/run.js`

## quic-ecn (#474)

**Owns:** `std/net/quic-recovery.ts`, `std/net/quic.ts`, `std/net/quic-frame.ts`, `std/net/quic-conn-ack.ts`, `tests/link/net_quic_recovery*`, shared: `docs/security/quic.md`, `tests/run.js`

## lazy-slots-records (#789)

**Owns:** `docs/security/tls.md`, `tests/link/net_http2_bad_config*`, `tests/link/net_http3`, `tests/link/net_http3_f64`, shared: `docs/security/http3.md`, `docs/security/quic.md`, `tests/run.js`

## nl8001-offsets (#629)

**Owns:** `src/portability-strings.ts`, `tests/cases/port_utf8_offset_*`, shared: `docs/LANGUAGE.md`, `tests/run.js`

Starts after parallel-fresh-dest merges, so a hook it needs in `src/parallel.ts`
is made against the merged rule; it may touch only that hook there.

## hpack-caller-storage (#473)

**Owns:** `std/net/hpack.ts`, `std/net/http2.ts`, `tests/link/net_http2`, `tests/link/net_http2_f64`, `tests/link/net_http2_hpack*`, shared: `docs/security/http2.md`, `tests/run.js`

Shares `std/net/http2.ts` with h2-reset-budget, so it starts once that merges.

## prefork (#478)

**Owns:** `std/net/prefork.ts`, `examples/prefork-server.ts`, `tests/link/net_prefork*`, `bench/http1-server.ts`, `bench/README.md`, `docs/wp42-multicore-server.md`, shared: `docs/guide/using-nish/networking.md`, `tests/run.js`

## ed25519 (#788)

**Owns:** `std/crypto/ed25519.ts`, `std/crypto/x25519.ts`, `std/crypto/sha512.ts`, `tests/cases/*ed25519*`, `tests/link/*ed25519*`, `bench/crypto/curves/**`, `docs/security/crypto-ecc.md`, shared: `docs/guide/using-nish/standard-library.md`, `tests/run.js`

Crypto: the run opens it green and reviewed but does not merge it — the merge
gate escalates every crypto diff to a human.

## Merge order

Free among the stages, one at a time as they converge, except nl8001-offsets
after parallel-fresh-dest and hpack-caller-storage after h2-reset-budget (both
start after that merge). Every src/ merge moves the checked goldens, so the
next stage to merge merges `main` and regenerates them first (`npm run
sync-main`).
