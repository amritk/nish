# Changelog

All notable changes to `nish` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

**This file is generated.** A section is written when a release is cut, from
the commits that release contains: `scripts/changelog-gen.mjs` reads each
commit's subject for the heading and its body for the prose, and writes
`changelog/<version>.json`. That JSON is the record — it is what the website
reads — and the section below is rendered from it. To fix a wording, edit the
JSON in the release pull request and re-render; editing here is overwritten.

A section is an index rather than an account: one line per change, its title
and a link to the pull request it landed in, under the heading its type gives.
The prose each commit wrote is in the JSON and on the website, and the pull
request has the diff and the discussion, so a reader scanning a release sees
what changed and one click to the rest.

The release pull request is where a release is reviewed: every merge to `main`
refreshes it with the version bump, the JSON and this section, and merging it
creates the tag. [docs/wp12-release.md](docs/wp12-release.md) has the
procedure, and `CLAUDE.md` has the commit convention the headings come from.
Between releases `[Unreleased]` is empty, because there is nothing to write by
hand — the git log is the working account until a release turns it into one.

## [Unreleased]

## [0.19.0] - 2026-10-11

### Added

- checker: Warn when a loop drops an allocation on every pass ([#533](https://github.com/amritk/nish/pull/533))
- net: Derive the TLS resumption master secret, completing RFC 8448 §3 ([#539](https://github.com/amritk/nish/pull/539))
- crypto: Run Wycheproof for HMAC and HKDF, and wipe their state ([#542](https://github.com/amritk/nish/pull/542))
- cli: Refuse retained arena memory with --deny-retention ([#544](https://github.com/amritk/nish/pull/544))
- cli: Report where every allocation's memory goes with --emit-arena ([#547](https://github.com/amritk/nish/pull/547))
- checker: Fixes for !xs.length and non-boolean && / || operands, and code-checked nofix cases ([#550](https://github.com/amritk/nish/pull/550))
- crypto: A native-only helper that draws the key and serial for x509MintSelfSigned ([#540](https://github.com/amritk/nish/pull/540))

### Fixed

- codegen: Do not hoist a loop's array header across a new whose constructor resizes it ([#541](https://github.com/amritk/nish/pull/541))
- checker: A method of a non-exported class called from another module links ([#543](https://github.com/amritk/nish/pull/543))
- checker: The diagnostic-fix-2 follow-ups — NL9007 wording, uncheckedGet in the range analysis, one-round migration ([#548](https://github.com/amritk/nish/pull/548))
- checker: NL9007 and NL2457 offer only a guard that compiles and is credited ([#552](https://github.com/amritk/nish/pull/552))
- cli: Check the owner of the run cache root and the package root, and take the first executable nish on PATH ([#546](https://github.com/amritk/nish/pull/546))

### Performance

- std: Skip JSON string bodies with a memchr search ([#532](https://github.com/amritk/nish/pull/532))
- codegen: Release a loop pass whose own string goes to a parts + join callee ([#549](https://github.com/amritk/nish/pull/549))
- cli: Cache the compiled runtime between links ([#557](https://github.com/amritk/nish/pull/557))
- checker: Prove an offset index `xs[i + c]` from a guard on the sum ([#561](https://github.com/amritk/nish/pull/561))

### Documentation

- Record that WP38's --cpu bar is met once the noise is measured ([#527](https://github.com/amritk/nish/pull/527))
- security: Record the readdirSync listing fixes from #520 in CG-5 ([#529](https://github.com/amritk/nish/pull/529))
- Record that WP38's S4, the lexer on indexOfAny, is declined for now ([#530](https://github.com/amritk/nish/pull/530))
- Record WP38 S1's bench/json measurement ([#538](https://github.com/amritk/nish/pull/538))
- interop: Plan WP27 S3, strings across the C boundary ([#545](https://github.com/amritk/nish/pull/545))
- security: Recount the README rows after the sweep ([#551](https://github.com/amritk/nish/pull/551))
- Record six review lessons in CLAUDE.md ([#553](https://github.com/amritk/nish/pull/553))
- Record the issue-sweep-2 review lessons and correct two stale records ([#554](https://github.com/amritk/nish/pull/554))
- Name the wasi section, not the web filter, as the check that links src/ as nish.wasm ([#556](https://github.com/amritk/nish/pull/556))
- Restate WP38's S3 bar after checking a portable-SIMD benchmark against LLVM 18 ([#558](https://github.com/amritk/nish/pull/558))
- threads: Decide WP29 P3, the lock and the channel ([#560](https://github.com/amritk/nish/pull/560))
- Record three review lessons from the runtime cache in CLAUDE.md ([#563](https://github.com/amritk/nish/pull/563))

### Tests

- ct: Hold the x25519 timing to its domain and re-measure CT-13 ([#537](https://github.com/amritk/nish/pull/537))
- std: Compare indexOfAny's non-ASCII byte offset between native and --profile wasi ([#536](https://github.com/amritk/nish/pull/536))

### Build

- Regenerate package-lock.json for v0.18.0 ([#526](https://github.com/amritk/nish/pull/526))


## [0.18.0] - 2026-10-09

### Added

- checker: Add `Math.clz32`, the leading zero bits of a 32-bit integer ([#511](https://github.com/amritk/nish/pull/511))
- runtime: Find the first byte of a set with 16-byte vectors, chosen at run time ([#518](https://github.com/amritk/nish/pull/518))
- runtime: Accept a start position in s.indexOf ([#513](https://github.com/amritk/nish/pull/513))
- std: IndexOfAny in nish/text, lowered onto the runtime kernel ([#519](https://github.com/amritk/nish/pull/519))
- net: The relay in Nish, with N9's soak ([#488](https://github.com/amritk/nish/pull/488))
- std: Read several JSON fields in one scan with jsonFields ([#509](https://github.com/amritk/nish/pull/509))

### Fixed

- cli: Refuse --target together with --fix ([#496](https://github.com/amritk/nish/pull/496))
- cli: Report a missing Nish entry point once per import ([#501](https://github.com/amritk/nish/pull/501))
- runtime: Link Math.min and Math.max of a float on freestanding wasm32 ([#510](https://github.com/amritk/nish/pull/510))
- net: Resend the server's handshake flight on two datagrams per probe, and early when the client shows it lacks it ([#514](https://github.com/amritk/nish/pull/514))

### Performance

- std: Compare JSON keys in place in jsonField ([#499](https://github.com/amritk/nish/pull/499))
- codegen: Keep the per-pass release when a pushed string is only joined ([#500](https://github.com/amritk/nish/pull/500))
- net: Keep nothing per QUIC handshake (H3-1, QUIC-3's remainder) ([#492](https://github.com/amritk/nish/pull/492))
- crypto: Sign P-256 over caller-owned scratch, so a handshake's signature keeps nothing ([#512](https://github.com/amritk/nish/pull/512))
- net: Let the QUIC listener read a window and answer into scratch, so an unowned datagram keeps nothing (H3-3) ([#515](https://github.com/amritk/nish/pull/515))
- codegen: A value stored into a returned fresh array is returned with it ([#520](https://github.com/amritk/nish/pull/520))

### Documentation

- security: Recompute the README rows and Total from the records ([#504](https://github.com/amritk/nish/pull/504))
- Propose WP38, SIMD ([#508](https://github.com/amritk/nish/pull/508))
- Record WP38's decisions and its S0 baselines ([#517](https://github.com/amritk/nish/pull/517))
- Record that WP38's --cpu flag is declined for now ([#521](https://github.com/amritk/nish/pull/521))
- net: Record what the interop job proves in WP34's lane table ([#523](https://github.com/amritk/nish/pull/523))

### Tests

- differential: Retire the two declared IR differences the 0.17.0 seed carries ([#497](https://github.com/amritk/nish/pull/497))
- net: Move net_http1 and net_websocket off Arena.mark/Arena.release ([#502](https://github.com/amritk/nish/pull/502))
- net: A Nish server and a Nish client over loopback, every carrier ([#489](https://github.com/amritk/nish/pull/489))
- net: Retry a failed interop runner case once, and allow the relay soak one arena-sized step ([#525](https://github.com/amritk/nish/pull/525))

### CI

- release: Merge the lockfile pull request from the job that opens it ([#505](https://github.com/amritk/nish/pull/505))
- Split the two slow jobs four ways and stop every job at 15 minutes ([#506](https://github.com/amritk/nish/pull/506))
- The interop job — quic-interop-runner, h2spec, curl and Chrome ([#487](https://github.com/amritk/nish/pull/487))


## [0.17.0] - 2026-10-06

### Breaking changes

- checker: Add `Secret<T>`, key material the checker keeps in and wipes ([#418](https://github.com/amritk/nish/pull/418))
- codegen: Make signed integer overflow a checked panic by default ([#426](https://github.com/amritk/nish/pull/426))

### Added

- std: HKDF-Expand-Label for TLS 1.3 and QUIC ([#398](https://github.com/amritk/nish/pull/398))
- runtime: A secure-wipe builtin the optimiser cannot drop ([#417](https://github.com/amritk/nish/pull/417))
- runtime: Nish:net tcpConnect — the client half of TCP ([#411](https://github.com/amritk/nish/pull/411))
- checker: Add using a = arena(), a checked arena bracket ([#420](https://github.com/amritk/nish/pull/420))
- cli: Carry a machine-applicable fix on a diagnostic, and apply it with nish --fix ([#421](https://github.com/amritk/nish/pull/421))
- checker: Report the capabilities each function, module and package can reach ([#423](https://github.com/amritk/nish/pull/423))
- std: Nish/net/tls — the TLS 1.3 server handshake, reproducing RFC 8448 §3 ([#407](https://github.com/amritk/nish/pull/407))
- checker: Add nish:unsafe and scope the unsafe flags to the entry package ([#422](https://github.com/amritk/nish/pull/422))
- cli: Builtins for the owner checks, and a cryptographic run-cache name (CLI-8) ([#425](https://github.com/amritk/nish/pull/425))
- cli: Fix truthiness, String(n), Map.get and call-site type arguments mechanically ([#431](https://github.com/amritk/nish/pull/431))
- std: Nish/net/quic-packet — QUIC packets, Initial secrets and header protection (WP34 Q1) ([#404](https://github.com/amritk/nish/pull/404))
- cli: Fix export default, export lists, type-only imports and fs imports mechanically ([#429](https://github.com/amritk/nish/pull/429))
- std: Nish/net/hpack — HPACK with Huffman (WP34 H2, first part) ([#406](https://github.com/amritk/nish/pull/406))
- checker: Record every panic site with its kind, and --emit-panics ([#424](https://github.com/amritk/nish/pull/424))
- checker: Deprecate Arena.release and Arena.reset in favour of using a = arena() ([#428](https://github.com/amritk/nish/pull/428))
- std: Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1) ([#399](https://github.com/amritk/nish/pull/399))
- std: Nish/net/tls records over TCP (WP34 T2) ([#437](https://github.com/amritk/nish/pull/437))
- std: Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part) ([#441](https://github.com/amritk/nish/pull/441))
- std: Nish/net/quic — Retry, version negotiation, stateless reset, idle timeout and key update (WP34 Q2, second part) ([#444](https://github.com/amritk/nish/pull/444))
- checker: --deny-panics and noPanic refuse every remaining panic site ([#443](https://github.com/amritk/nish/pull/443))
- checker: Let a nish:unsafe import opt uncheckedGet and uncheckedSet into the no-panic scope ([#455](https://github.com/amritk/nish/pull/455))
- checker: Refuse a program that reaches a capability its policy does not grant (WP36) ([#452](https://github.com/amritk/nish/pull/452))
- cli: Migrate --unchecked-indexing to uncheckedGet and uncheckedSet with nish --fix ([#459](https://github.com/amritk/nish/pull/459))
- cli: Fix an index not proven in range with a panic guard ([#460](https://github.com/amritk/nish/pull/460))
- net: HTTP/2 frames, streams and flow control ([#465](https://github.com/amritk/nish/pull/465))
- net: QUIC loss recovery, PTO, NewReno and pacing ([#466](https://github.com/amritk/nish/pull/466))
- net: QPACK with the static table and dynamic capacity 0 ([#464](https://github.com/amritk/nish/pull/464))
- net: The HTTP/1.1 server on nish:net ([#468](https://github.com/amritk/nish/pull/468))
- net: QUIC streams, DATAGRAM frames and GSO batching ([#469](https://github.com/amritk/nish/pull/469))
- net: HTTP/3 on QUIC streams ([#470](https://github.com/amritk/nish/pull/470))
- net: WebTransport over HTTP/3 ([#471](https://github.com/amritk/nish/pull/471))

### Fixed

- runtime: Build the wasi profile against a libc without realpath ([#396](https://github.com/amritk/nish/pull/396))
- checker: Type an object literal in an `I | null` context as the struct, not the union ([#401](https://github.com/amritk/nish/pull/401))
- checker: Prove a literal receiver's slice in range so NL8002 stays quiet ([#400](https://github.com/amritk/nish/pull/400))
- runtime: Remaining runtime hardening (RT-10..RT-13) and shim O_NOFOLLOW parity ([#405](https://github.com/amritk/nish/pull/405))
- checker: Refuse push and pop on typed arrays reached through Map/Set reads, generics and imported aliases ([#409](https://github.com/amritk/nish/pull/409))
- codegen: Close CG-2, CG-3, CG-4, CG-8 and CG-10 ([#427](https://github.com/amritk/nish/pull/427))
- checker: Read the root package's `nish` field strictly ([#458](https://github.com/amritk/nish/pull/458))
- net: Wake a paced HTTP/3 slot at the pacer's time, not twice it ([#490](https://github.com/amritk/nish/pull/490))
- crypto: Give the minted self-signed certificate the extensions Chrome requires ([#491](https://github.com/amritk/nish/pull/491))

### Performance

- checker: Credit a panic or process.exit guard in the range analysis ([#457](https://github.com/amritk/nish/pull/457))
- net: A TLS handshake that keeps its state in the slot ([#467](https://github.com/amritk/nish/pull/467))

### Documentation

- Add the secret-wipe and generated-golden rules to CLAUDE.md ([#391](https://github.com/amritk/nish/pull/391))
- self: Write down the builtin and mutation-check conventions, and bring the security records up to date ([#449](https://github.com/amritk/nish/pull/449))
- codegen: Describe checked signed overflow where the cookbook and README still said nsw ([#454](https://github.com/amritk/nish/pull/454))
- Condense the landed work-package notes and bring the plans and references up to date ([#462](https://github.com/amritk/nish/pull/462))

### Tests

- Constant-time check plumbing (CT-14, CT-15), a narrower nish-cmp declaration, and record corrections ([#397](https://github.com/amritk/nish/pull/397))
- Declare the HKDF-Expand-Label nish-cmp differences against 0.16.0 ([#403](https://github.com/amritk/nish/pull/403))
- Pin the AWFY Storage and List peak-RSS results ([#408](https://github.com/amritk/nish/pull/408))
- runtime: Exercise nish:net's dual-stack IPv6 path, and correct its error-rule wording ([#402](https://github.com/amritk/nish/pull/402))
- self: Let the stage-1 fuzz differential declare an intended IR change, and run it in CI ([#448](https://github.com/amritk/nish/pull/448))
- Run the wasi checks in CI, pin the shim's symlink refusal, and bound every native run ([#450](https://github.com/amritk/nish/pull/450))

### Build

- Regenerate package-lock.json for v0.16.0 ([#392](https://github.com/amritk/nish/pull/392))


## [0.16.0] - 2026-10-02

### Added

- std: Export x509DerSignatureRS, and run P-256's Wycheproof cases through it ([#361](https://github.com/amritk/nish/pull/361))
- checker: Refuse import.meta by its rule, not NL0001 ([#365](https://github.com/amritk/nish/pull/365))
- checker: Refuse computed keys and object spread by their rule, not NL0001 ([#371](https://github.com/amritk/nish/pull/371))

### Fixed

- checker: Refuse a duplicate type parameter and name the empty statement's rule ([#364](https://github.com/amritk/nish/pull/364))
- crypto: Audit and harden ChaCha20-Poly1305 and AES-GCM ([#372](https://github.com/amritk/nish/pull/372))
- crypto: Audit and harden SHA-2, HMAC, HKDF, ct and base64url ([#375](https://github.com/amritk/nish/pull/375))
- crypto: Audit and harden P-256 ECDSA and X25519 ([#373](https://github.com/amritk/nish/pull/373))
- crypto: Audit and harden the DER, PEM and X.509 parsers ([#376](https://github.com/amritk/nish/pull/376))
- codegen: Audit bounds-check elimination and emitted attributes ([#380](https://github.com/amritk/nish/pull/380))
- cli: Audit nish run's cache and the compiler's file and process handling ([#379](https://github.com/amritk/nish/pull/379))
- runtime: Audit the C runtime for memory safety and OS misuse ([#383](https://github.com/amritk/nish/pull/383))
- build: Audit install, launcher, seed fetch and release workflows ([#381](https://github.com/amritk/nish/pull/381))

### Documentation

- Record the parser run as built, quote NL2038 whole, and make a failed expect stop a parse path ([#359](https://github.com/amritk/nish/pull/359))
- Record what the WP34 crypto lane taught about goldens, provenance, measurements and PR bodies ([#369](https://github.com/amritk/nish/pull/369))
- Add SECURITY.md and the audit index ([#384](https://github.com/amritk/nish/pull/384))

### Tests

- Export NISH_BOOTSTRAP from the session-start hook, so a session's npm test runs nish-cmp ([#366](https://github.com/amritk/nish/pull/366))
- Type-check the interop declarations in one tsc program instead of eight spawns ([#367](https://github.com/amritk/nish/pull/367))
- Run each golden case's whole pipeline in parallel ([#374](https://github.com/amritk/nish/pull/374))
- crypto: Prove the constant-time checks catch what they claim ([#377](https://github.com/amritk/nish/pull/377))

### Build

- Regenerate package-lock.json for v0.15.0 ([#360](https://github.com/amritk/nish/pull/360))

### CI

- Keep the compiler npm test built instead of linking it twice ([#368](https://github.com/amritk/nish/pull/368))
- Delegate the test job's fixed point to the bootstrap row ([#370](https://github.com/amritk/nish/pull/370))


## [0.15.0] - 2026-09-30

### Breaking changes

- checker: Refuse push and pop on the typed-array names ([#335](https://github.com/amritk/nish/pull/335))

### Added

- std: ChaCha20-Poly1305 and ChaCha20 header protection in nish/crypto/chacha20poly1305 ([#332](https://github.com/amritk/nish/pull/332))
- runtime: Nish:net with a runtime-net.c unit and non-blocking TCP (WP34 N5) ([#341](https://github.com/amritk/nish/pull/341))
- std: Bitsliced AES-128 and AES-256 with GCM in nish/crypto/aes ([#340](https://github.com/amritk/nish/pull/340))
- std: P-256 ECDSA with RFC 6979 nonces in nish/crypto/p256 ([#336](https://github.com/amritk/nish/pull/336))
- runtime: Nish:net UDP with GSO, GRO, ECN and SO_REUSEPORT (WP34 N5) ([#343](https://github.com/amritk/nish/pull/343))
- checker: Refuse forbidden import and export forms by their rule, not NL0001 ([#337](https://github.com/amritk/nish/pull/337))
- std: DER, PEM and X.509, and a self-signed P-256 certificate, in nish/crypto/x509 ([#346](https://github.com/amritk/nish/pull/346))
- runtime: Nish:net readiness loop that wakes on sockets and SIGTERM (WP34 N5) ([#349](https://github.com/amritk/nish/pull/349))

### Fixed

- checker: Retire NL8011 and stop NL8008 on a constant shift ([#329](https://github.com/amritk/nish/pull/329))

### Documentation

- Mark WP34 N1, N2, N3 and N6 built and bring MASTER_PLAN §9 up to date ([#328](https://github.com/amritk/nish/pull/328))
- Make the portability rows and wp33's status match the code ([#327](https://github.com/amritk/nish/pull/327))
- checker: Pin readFileBytesSync's refusals and fix the fill and i64-literal rules ([#331](https://github.com/amritk/nish/pull/331))
- Warn against production use and say how early Nish is ([#344](https://github.com/amritk/nish/pull/344))

### Tests

- std: Verify the X25519 ladder by disassembly, pin SHA-384/512's 448-bit vector, and time the constant-time code weekly ([#339](https://github.com/amritk/nish/pull/339))
- std: Run every vector in the f64 twins of chacha20poly1305, aes and p256 ([#350](https://github.com/amritk/nish/pull/350))
- std: Hold P-256's field multiply and window step to the disassembly check ([#354](https://github.com/amritk/nish/pull/354))

### Build

- Regenerate package-lock.json for v0.14.0 ([#319](https://github.com/amritk/nish/pull/319))

### CI

- release: Gate every std/crypto module in the release presence checks, and list the new modules ([#345](https://github.com/amritk/nish/pull/345))


## [0.14.0] - 2026-09-29

### Breaking changes

- checker: Refuse forbidden statements by their rule, not NL0001 ([#292](https://github.com/amritk/nish/pull/292))

### Added

- checker: Export an enum and import it into another module ([#296](https://github.com/amritk/nish/pull/296))
- std: X25519 in nish/crypto/x25519 ([#289](https://github.com/amritk/nish/pull/289))
- std: SHA-384 and SHA-512 in nish/crypto/sha512 ([#291](https://github.com/amritk/nish/pull/291))
- std: A constant-time compare and base64url in nish/crypto ([#294](https://github.com/amritk/nish/pull/294))
- std: SHA-256 in nish/crypto/sha256 ([#288](https://github.com/amritk/nish/pull/288))
- checker: The portability diagnostic class, NL8xxx, behind --warn-portability ([#293](https://github.com/amritk/nish/pull/293))
- std: HMAC and HKDF over SHA-256 and SHA-384 in nish/crypto ([#298](https://github.com/amritk/nish/pull/298))
- checker: Portability warnings for integer and libm divergences ([#301](https://github.com/amritk/nish/pull/301))
- checker: Export a type alias and import it into another module ([#300](https://github.com/amritk/nish/pull/300))
- checker: Portability warnings for record copies into arrays and stores over a live element ([#302](https://github.com/amritk/nish/pull/302))
- checker: Portability warnings where UTF-8 string offsets meet an outside fact ([#304](https://github.com/amritk/nish/pull/304))
- checker: Byte plumbing — u8[] set and fill, readFileBytesSync (WP34 N2) ([#295](https://github.com/amritk/nish/pull/295))
- codegen: Constant-time ctSelect and ctEq behind an optimisation barrier (WP34 N6) ([#310](https://github.com/amritk/nish/pull/310))
- checker: Refuse forbidden expressions by their rule, not NL0001 ([#311](https://github.com/amritk/nish/pull/311))
- checker: Refuse forbidden declarations by their rule, not NL0001 ([#313](https://github.com/amritk/nish/pull/313))
- checker: Refuse forbidden function and binding forms by their rule, not NL0001 ([#314](https://github.com/amritk/nish/pull/314))
- runtime: Date.now, crypto.getRandomValues, statMtimeSync and a signal descriptor (WP34 N3) ([#312](https://github.com/amritk/nish/pull/312))
- checker: Refuse forbidden class, interface and enum forms by their rule, not NL0001 ([#315](https://github.com/amritk/nish/pull/315))

### Fixed

- checker: A refused const reports once, not at every later use ([#290](https://github.com/amritk/nish/pull/290))
- codegen: Fold a negated integer literal into its constant ([#297](https://github.com/amritk/nish/pull/297))

### Documentation

- Make the RUN_UNDER_NODE command call main ([#285](https://github.com/amritk/nish/pull/285))
- std: Document nish/crypto and list it where the library is listed ([#299](https://github.com/amritk/nish/pull/299))
- Agent guidelines for runtime units, self-golden conflicts and reviews ([#318](https://github.com/amritk/nish/pull/318))

### Tests

- checker: Pin the T | null twins of the keeps-proof refusals ([#286](https://github.com/amritk/nish/pull/286))
- std: Hold modules in std/ subdirectories to the same gates as top-level ones ([#287](https://github.com/amritk/nish/pull/287))

### Build

- Regenerate package-lock.json for v0.13.0 ([#284](https://github.com/amritk/nish/pull/284))


## [0.13.0] - 2026-09-28

### Breaking changes

- runtime: Rename every tracked path to kebab-case ([#251](https://github.com/amritk/nish/pull/251))
- Move the compiler from self/ to src/ ([#256](https://github.com/amritk/nish/pull/256))

### Added

- checker: Ranged integer types (WP31) ([#261](https://github.com/amritk/nish/pull/261))
- checker: Threads P2, using s = scope() and s.spawn(fn, arg) ([#262](https://github.com/amritk/nish/pull/262))
- interop: Ranged parameters at the host boundary (WP31) ([#273](https://github.com/amritk/nish/pull/273))

### Fixed

- interop: ParallelReduce under Node, and NL2348 at the call for a non-scalar reduce ([#259](https://github.com/amritk/nish/pull/259))
- checker: A surrogate-pair escape is the code point it spells ([#258](https://github.com/amritk/nish/pull/258))
- checker: A stored Result is not a discard, and Map of Result compiles ([#260](https://github.com/amritk/nish/pull/260))
- checker: A proof never leaves a proof consumer, and an assignment ends a narrowing in an && chain ([#265](https://github.com/amritk/nish/pull/265))
- checker: A misplaced numeric separator is refused in TypeScript's words ([#264](https://github.com/amritk/nish/pull/264))
- codegen: A parameter or local named like an emitter label compiles ([#269](https://github.com/amritk/nish/pull/269))
- checker: A binary, octal, exponent or separated literal reads its true value ([#270](https://github.com/amritk/nish/pull/270))
- checker: A numeric literal with a leading zero is refused in TypeScript's words ([#272](https://github.com/amritk/nish/pull/272))

### Performance

- checker: Prove range entries and index through declared ranges (WP31) ([#268](https://github.com/amritk/nish/pull/268))

### Changed

- Apply Biome's autofixes ([#252](https://github.com/amritk/nish/pull/252))
- Clear the lint backlog by hand, and make every function an arrow ([#253](https://github.com/amritk/nish/pull/253))
- Format the tree with Biome, without semicolons ([#254](https://github.com/amritk/nish/pull/254))

### Documentation

- Open the README with what the name stands for, and mark stage0's src/ citations ([#250](https://github.com/amritk/nish/pull/250))
- wp31: Record the ranged-integer measurements ([#274](https://github.com/amritk/nish/pull/274))
- Plan the round trip between TypeScript and Nish, at zero native cost (WP33) ([#276](https://github.com/amritk/nish/pull/276))
- wp34: Plan hosting cs, starting with its relay on a network stack in std ([#277](https://github.com/amritk/nish/pull/277))

### Build

- Regenerate package-lock.json for v0.12.0 ([#248](https://github.com/amritk/nish/pull/248))
- Make every lint rule an error, and add the checks a clean tree allows ([#255](https://github.com/amritk/nish/pull/255))


## [0.12.0] - 2026-09-26

### Added

- codegen: One probe for has/get/set on one key, and nish/map's reserve and getOrInsert ([#239](https://github.com/amritk/nish/pull/239))
- self: Make semicolons optional, by TypeScript's insertion rule ([#242](https://github.com/amritk/nish/pull/242))
- cli: Nish run, and a shebang line so a program runs as a script ([#245](https://github.com/amritk/nish/pull/245))

### Fixed

- codegen: Store a -0 Map key or Set element as +0, as JavaScript does ([#247](https://github.com/amritk/nish/pull/247))

### Documentation

- bench: Measure Map and Set against Node and the unordered layout ([#244](https://github.com/amritk/nish/pull/244))

### CI

- release: Regenerate the lockfile after publishing the platform packages ([#240](https://github.com/amritk/nish/pull/240))

### Internal

- Set the lint rules and the runbook for the naming cleanup ([#243](https://github.com/amritk/nish/pull/243))


## [0.11.0] - 2026-09-26

### Added

- checker: Compile-time function parameters, monomorphised per callee ([#213](https://github.com/amritk/nish/pull/213))
- checker: ParallelMapInto and parallelReduce from nish/threads ([#219](https://github.com/amritk/nish/pull/219))
- codegen: Allocating parallel bodies, a cost-sized grain and the NL9012 warning ([#223](https://github.com/amritk/nish/pull/223))
- checker: The global Map and Set, backed by std/collections.ts ([#229](https://github.com/amritk/nish/pull/229))
- checker: Map.get, typed V | undefined and narrowed as TypeScript does ([#232](https://github.com/amritk/nish/pull/232))
- codegen: For...of over Map keys() and values() and over a Set ([#237](https://github.com/amritk/nish/pull/237))

### Performance

- codegen: Give a function the arena scope when only its callees allocate ([#210](https://github.com/amritk/nish/pull/210))
- checker: A passed bounds check proves the same index on the same array ([#209](https://github.com/amritk/nish/pull/209))
- codegen: Keep a field array's header live across element stores ([#208](https://github.com/amritk/nish/pull/208))
- codegen: Give array header loads and stores their own TBAA subtree ([#220](https://github.com/amritk/nish/pull/220))
- codegen: Reclaim a loop iteration's temporaries when nothing outlives the pass ([#221](https://github.com/amritk/nish/pull/221))
- self: Fingerprints and stored hashes in StringMap ([#228](https://github.com/amritk/nish/pull/228))
- checker: Prove an index in range from what every call site guarantees ([#222](https://github.com/amritk/nish/pull/222))
- codegen: Store a fixed-length array field inside its object ([#230](https://github.com/amritk/nish/pull/230))
- checker: Cut the call-site ranges pass to the walks that can move a proof ([#236](https://github.com/amritk/nish/pull/236))

### Changed

- codegen: Record the shared write that denies a function purity ([#212](https://github.com/amritk/nish/pull/212))

### Documentation

- bench: The WP32 Map design note and the layout prototypes ([#227](https://github.com/amritk/nish/pull/227))
- Carry the licence of every third-party copy, and make agents keep it ([#231](https://github.com/amritk/nish/pull/231))
- bench: Are We Fast Yet after round 2 ([#238](https://github.com/amritk/nish/pull/238))

### Tests

- bench: The Are We Fast Yet ports as benchmarks and regression cases ([#214](https://github.com/amritk/nish/pull/214))
- bench: Fail the suite when a benchmark executes more instructions than its baseline ([#218](https://github.com/amritk/nish/pull/218))

### Build

- release: Publish to npm by trusted publishing ([#205](https://github.com/amritk/nish/pull/205))


## [0.10.0] - 2026-09-24

### Breaking changes

- compilation: Module and package identity is the real path ([#202](https://github.com/amritk/nish/pull/202))
- checker: Reserve the type name integer for ranged integers ([#201](https://github.com/amritk/nish/pull/201))

### Added

- checker: NL9010 advises reordering the fields a class adds after its interface prefix ([#196](https://github.com/amritk/nish/pull/196))

### Fixed

- checker: Name the instantiation, not the template, in new-expression diagnostics and the checked dump ([#187](https://github.com/amritk/nish/pull/187))
- checker: Same-named interfaces and classes across modules keep their identity ([#191](https://github.com/amritk/nish/pull/191))
- codegen: A function whose unproven charCodeAt can panic is not willreturn ([#189](https://github.com/amritk/nish/pull/189))
- checker: Bounds proofs see continue edges, lazy Result arguments and whole-record stores ([#190](https://github.com/amritk/nish/pull/190))
- checker: Refuse two same-named classes or interfaces in one package ([#197](https://github.com/amritk/nish/pull/197))

### Documentation

- plan: M4, the reference is frozen and 1.0 is next ([#203](https://github.com/amritk/nish/pull/203))
- plan: Nish stays on 0.x until its owner declares 1.0 ([#204](https://github.com/amritk/nish/pull/204))

### Tests

- codes: The registry check counts every fragment line, and wp15 names its benchmark ([#186](https://github.com/amritk/nish/pull/186))
- cmp: Name the squash subject in the break-edge nish-cmp declarations ([#194](https://github.com/amritk/nish/pull/194))

### Build

- release: A Release-As trailer chooses the next version ([#200](https://github.com/amritk/nish/pull/200))

### CI

- Fail a pull request whose body carries a session link or tool attribution ([#188](https://github.com/amritk/nish/pull/188))


## [0.9.0] - 2026-09-23

### Breaking changes

- interop: Export generic instantiations under valid, injective names (WP18 G8) ([#165](https://github.com/amritk/nish/pull/165))

### Added

- checker: Spell an instantiated class as written, in diagnostics and -g (WP18 G8) ([#164](https://github.com/amritk/nish/pull/164))
- checker: Generic methods on classes (WP18 §14 q7) ([#168](https://github.com/amritk/nish/pull/168))
- checker: WP21 S3 — specific diagnostics at the package boundary ([#178](https://github.com/amritk/nish/pull/178))
- std: Pair<A, B> as a standard-library type ([#172](https://github.com/amritk/nish/pull/172))

### Fixed

- checker: Hold a constraint to its declaration, not its name (#161) ([#167](https://github.com/amritk/nish/pull/167))

### Performance

- checker: Key bounds length facts by property path ([#179](https://github.com/amritk/nish/pull/179))

### Documentation

- Record WP18 G8 as landed and close WP18 ([#169](https://github.com/amritk/nish/pull/169))
- Retire the last "no generics" claims and keep WP18 §16 to deferrals ([#177](https://github.com/amritk/nish/pull/177))
- WP31 — ranged integer types, designed for after G8 ([#171](https://github.com/amritk/nish/pull/171))

### Tests

- Teach the fuzzer to emit generic functions and classes ([#163](https://github.com/amritk/nish/pull/163))


### Breaking changes

- interop: Export generic instantiations under valid, injective names (WP18 G8)

### Added

- checker: Spell an instantiated class as written, in diagnostics and -g (WP18 G8)
- checker: Generic methods on classes (WP18 §14 q7)
- std: Pair<A, B> as a standard-library type
- checker: WP21 S3 — specific diagnostics at the package boundary

### Fixed

- checker: Hold a constraint to its declaration, not its name (#161)

### Performance

- checker: Key bounds length facts by property path (#106), and stop proving an index a later `&&` / `||` operand or a stored value invalidates — which also closes those holes for plain locals

### Documentation

- Record WP18 G8 as landed and close WP18
- Retire the last "no generics" claims and keep WP18 §16 to deferrals

## [0.8.0] - 2026-09-23

### Breaking changes

- checker: Constrained type parameters (WP18 G6) ([#157](https://github.com/amritk/nish/pull/157))

### Performance

- checker: Prove bounds through toI32(length) and compile std/text silent ([#154](https://github.com/amritk/nish/pull/154))

### Documentation

- wp19: Record the R6 deletion's measurement ([#151](https://github.com/amritk/nish/pull/151))

### Tests

- self: Let nish-cmp remove each compiler's own version from the DWARF producer ([#156](https://github.com/amritk/nish/pull/156))
- Give each differential run its own working directory ([#159](https://github.com/amritk/nish/pull/159))
- Hold std/ and examples/ to zero performance warnings and ratchet self/ ([#158](https://github.com/amritk/nish/pull/158))


### Breaking changes

- checker: Constrained type parameters (WP18 G6) ([#157](https://github.com/amritk/nish/pull/157))

### Performance

- checker: Prove bounds through toI32(length) and compile std/text silent ([#154](https://github.com/amritk/nish/pull/154))

## [0.7.0] - 2026-09-23

### Breaking changes

- Delete stage0, the TypeScript compiler ([#150](https://github.com/amritk/nish/pull/150))

### Documentation

- Describe one compiler in the rules and the live documents ([#148](https://github.com/amritk/nish/pull/148))

### Tests

- self: Compile every golden with stage1 and stop comparing against stage0 ([#145](https://github.com/amritk/nish/pull/145))
- self: Take the surviving test tools off stage0 ([#147](https://github.com/amritk/nish/pull/147))

### Build

- Fetch a released seed and let every tool take a stage1 compiler ([#146](https://github.com/amritk/nish/pull/146))


## [0.6.0] - 2026-09-22

### Breaking changes

- cli: Refuse on a platform with no prebuilt compiler instead of falling back to Node ([#139](https://github.com/amritk/nish/pull/139))

### Added

- interop: Let the unsigned widths cross as arrays ([#138](https://github.com/amritk/nish/pull/138))

### Fixed

- self: Follow a symlink to find the package root ([#129](https://github.com/amritk/nish/pull/129))
- cli: Name a package module by its package-relative specifier, in both compilers ([#136](https://github.com/amritk/nish/pull/136))
- self: Type a signed or parenthesised numeric literal from the other operand ([#142](https://github.com/amritk/nish/pull/142))

### Documentation

- cli: Measure the `-o dir/` stem collision, which both compilers have ([#135](https://github.com/amritk/nish/pull/135))
- wp19: Re-derive G1 on the deletion head, and tally the nish-cmp cycle ([#137](https://github.com/amritk/nish/pull/137))
- wp19: Pay the parity figure §A9 left owed, over the whole 986-program corpus ([#143](https://github.com/amritk/nish/pull/143))

### Tests

- self: Ask the diagnostic-coverage gate of stage1, not of stage0 ([#131](https://github.com/amritk/nish/pull/131))
- self: Pin one diagnostic per declaration when a class body has two bad members ([#134](https://github.com/amritk/nish/pull/134))
- Port the three ELF-assuming checks that keep macos-latest out of the test matrix ([#133](https://github.com/amritk/nish/pull/133))
- self: Freeze the WP13 differential rewrite as goldens, with a staleness guard ([#141](https://github.com/amritk/nish/pull/141))


## [0.5.0] - 2026-09-20

### Added

- runtime: RealpathSync, the path resolution a symlinked install needs ([#128](https://github.com/amritk/nish/pull/128))

### Fixed

- release: Ship the standard library with the native compiler ([#126](https://github.com/amritk/nish/pull/126))


## [0.4.0] - 2026-09-20

### Added

- checker: Warn when reordering a struct's fields would shrink it ([#103](https://github.com/amritk/nish/pull/103))
- checker: A generic may be exported and instantiated from another module ([#111](https://github.com/amritk/nish/pull/111))
- cli: Install the compiler from npm or from curl, as a prebuilt binary ([#124](https://github.com/amritk/nish/pull/124))

### Fixed

- codegen: Give a `CPtr` its own DWARF type and its own debug-cache entry ([#90](https://github.com/amritk/nish/pull/90))
- checker: Recover from a refused monomorphisation only where the request is a declaration's ([#91](https://github.com/amritk/nish/pull/91))
- test: An empty flag set fails the parity comparison ([#101](https://github.com/amritk/nish/pull/101))
- cli: --json carries a syntax error, and a column counts code units ([#117](https://github.com/amritk/nish/pull/117))
- ci: An apostrophe in a comment truncated the release train's version bump ([#125](https://github.com/amritk/nish/pull/125))

### Performance

- codegen: Hoist an array's header out of the loop that reads it ([#104](https://github.com/amritk/nish/pull/104))

### Changed

- diagnostics: Give the warning list a deliberate report order ([#99](https://github.com/amritk/nish/pull/99))
- test: One shared diagnostic-registry reader ([#102](https://github.com/amritk/nish/pull/102))

### Documentation

- wp15: Close the padding item and re-state how §8 warnings are ordered ([#105](https://github.com/amritk/nish/pull/105))
- wp23: Decide the three proposed rows, and the questions they answer ([#112](https://github.com/amritk/nish/pull/112))
- wp19: Re-measure every gate and state what R6 is still waiting on ([#118](https://github.com/amritk/nish/pull/118))
- wp19: Date every gate state, and correct four stale variation counts ([#119](https://github.com/amritk/nish/pull/119))
- wp12: Decide which compiler the package ships, and correct (b)'s stale cost ([#122](https://github.com/amritk/nish/pull/122))
- wp12: A section that records a decision should not be headed "Open decision" ([#123](https://github.com/amritk/nish/pull/123))

### Tests

- bench: The field-shape program WP15 measures the header hoist on ([#98](https://github.com/amritk/nish/pull/98))
- oracle: Register the cases stage1's parser refuses, and fail when the set moves ([#115](https://github.com/amritk/nish/pull/115))

### CI

- parity: Check parity on the pull request that touches a corpus program ([`7f6e833`](https://github.com/amritk/nish/commit/7f6e833))
- seed: Exercise the aarch64 and darwin rows before a release attaches them ([#114](https://github.com/amritk/nish/pull/114))
- release: Cut the ddc provenance tag from the release that proves it ([#116](https://github.com/amritk/nish/pull/116))

### Internal

- release: Take @amritk/nish as the package name, and keep nish as the command ([#121](https://github.com/amritk/nish/pull/121))


## [0.3.0] - 2026-09-18

### Added

- interop: Run an N-API export on libuv's thread pool with `--emit-napi-async` ([#67](https://github.com/amritk/nish/pull/67))
- checker: Monomorphise generic classes and interfaces ([`9000434`](https://github.com/amritk/nish/commit/9000434))
- checker: Resolve a package by name through the `nish` export condition ([`4bf07f0`](https://github.com/amritk/nish/commit/4bf07f0))
- checker: Add `CPtr`, the opaque pointer a C function hands back ([`50410a5`](https://github.com/amritk/nish/commit/50410a5))
- release: Build and smoke-test a native compiler for each supported target ([`16110e2`](https://github.com/amritk/nish/commit/16110e2))
- runtime: Divide a range of work across threads ([#88](https://github.com/amritk/nish/pull/88))

### Fixed

- self: Let the checker state the member-header rules the parser was eating ([`ca7d4a5`](https://github.com/amritk/nish/commit/ca7d4a5))
- checker: Name a `nish/` module by the package, not by the importer ([`97f0f4e`](https://github.com/amritk/nish/commit/97f0f4e))

### Performance

- tests: Compile the golden cases in one process instead of one each ([`9072355`](https://github.com/amritk/nish/commit/9072355))
- tests: Link the golden cases against a runtime built once per run ([`7b8815f`](https://github.com/amritk/nish/commit/7b8815f))
- checker: Fold a proven `substring` clamp, and warn where the proof did not come off ([`19b4569`](https://github.com/amritk/nish/commit/19b4569))
- codegen: Release the arena scope ahead of a tail call ([#85](https://github.com/amritk/nish/pull/85))
- ci: Stop re-running the whole suite to widen one gate, and cache Node's module compilation ([#87](https://github.com/amritk/nish/pull/87))
- codegen: Mark a scalar-argument tail call `tail` ([#86](https://github.com/amritk/nish/pull/86))

### Changed

- self: Declare every function in the self-hosted compiler as an arrow ([`de62d60`](https://github.com/amritk/nish/commit/de62d60))

### Documentation

- checker: Close contiguous class arrays by costing the migration ([#73](https://github.com/amritk/nish/pull/73))
- codegen: Refute the invariant array header and re-scope item 1b ([#70](https://github.com/amritk/nish/pull/70))
- tests: Record four measurement traps the tooling hides ([`6aadfff`](https://github.com/amritk/nish/commit/6aadfff))

### Build

- self: Add the codemod and the byte-for-byte IR diff stage C's rewrite needs ([`15c663a`](https://github.com/amritk/nish/commit/15c663a))

### CI

- bootstrap: Skip the rolling freeze where no seed can exist, fail where one is missing ([#68](https://github.com/amritk/nish/pull/68))


## [0.2.0] - 2026-09-13

### Added

- runtime: Add readdirSync, spawnSyncTo and monotonicNanos, and the test runner they enable ([#47](https://github.com/amritk/nish/pull/47))
- runtime: Give every thread its own arena behind `--threads` ([#55](https://github.com/amritk/nish/pull/55))
- checker: Give every symbol a package scope ([#57](https://github.com/amritk/nish/pull/57))
- checker: Read a numeric `enum` as a distinct `i32` type ([#54](https://github.com/amritk/nish/pull/54))
- codegen: Add slice, a string cut that checks instead of clamping ([#53](https://github.com/amritk/nish/pull/53))
- codegen: Store an array of records contiguously ([#51](https://github.com/amritk/nish/pull/51))
- checker: Compile generic functions by monomorphisation ([#50](https://github.com/amritk/nish/pull/50))
- checker: Call a C function with `declare function` ([#62](https://github.com/amritk/nish/pull/62))
- checker: Import the runtime builtins from `nish:fs`, `nish:process` and `nish:io` ([#58](https://github.com/amritk/nish/pull/58))
- std: Add std/json, and check the CLI contract from a harness in Nish ([#65](https://github.com/amritk/nish/pull/65))
- self: Let a construct be implemented once, in `self/` ([#66](https://github.com/amritk/nish/pull/66))

### Fixed

- codegen: Measure a -g position from the declaration, and its column in bytes ([#60](https://github.com/amritk/nish/pull/60))
- self: Assert the seed equality only when the seed is stage0 ([#61](https://github.com/amritk/nish/pull/61))
- checker: Key two generic rules on words only they contain ([#64](https://github.com/amritk/nish/pull/64))

### Performance

- checker: Prove an index in range and emit no bounds check ([#56](https://github.com/amritk/nish/pull/56))

### Changed

- runtime: Split the system-call half into runtime_os.c, with a ceiling each ([#59](https://github.com/amritk/nish/pull/59))

### Documentation

- readme: Centred header, status badges and section rules ([#45](https://github.com/amritk/nish/pull/45))
- release: Fix the install links and record the npm name conflict ([#49](https://github.com/amritk/nish/pull/49))
- cli: Add a rules card the compiler's own tests keep honest ([#63](https://github.com/amritk/nish/pull/63))

### Tests

- self: Pin every diagnostic wording a program can provoke ([#52](https://github.com/amritk/nish/pull/52))


## [0.1.1] - 2026-09-12

### Fixed

- release: Start release.yml at the tag the release train pushes ([#43](https://github.com/amritk/nish/pull/43))


## [0.1.0] - 2026-09-12

### Fixed

- tests: Regenerate the stage1 goldens for the corpus WP25 left ([`0d233f4`](https://github.com/amritk/nish/commit/0d233f4))
- release: Build the notes from conventional commits only ([#37](https://github.com/amritk/nish/pull/37))
- release: Unstick the `---` rule and render the notes as an index ([#40](https://github.com/amritk/nish/pull/40))
- checker: Give a concise arrow body the context a `return` has ([#41](https://github.com/amritk/nish/pull/41))

### Performance

- checker: Add arithmetic and arena-drop performance warnings ([#38](https://github.com/amritk/nish/pull/38))
- codegen: Close the last two gaps in the benchmark suite ([#39](https://github.com/amritk/nish/pull/39))

### Documentation

- bench: Regenerate the benchmark report against Go and Rust ([#36](https://github.com/amritk/nish/pull/36))

### Build

- release: Generate releases from commits, on a release train ([`8ac1728`](https://github.com/amritk/nish/commit/8ac1728))

### CI

- release: Give the release pull request a conventional title ([#33](https://github.com/amritk/nish/pull/33))

### Internal

- release: Start at 0.0.0 and stop pinning the version in goldens ([`d17e294`](https://github.com/amritk/nish/commit/d17e294))


[Unreleased]: https://github.com/amritk/nish/commits/main
[0.1.0]: https://github.com/amritk/nish/releases/tag/v0.1.0
[0.1.1]: https://github.com/amritk/nish/releases/tag/v0.1.1
[0.2.0]: https://github.com/amritk/nish/releases/tag/v0.2.0
[0.3.0]: https://github.com/amritk/nish/releases/tag/v0.3.0
[0.4.0]: https://github.com/amritk/nish/releases/tag/v0.4.0
[0.5.0]: https://github.com/amritk/nish/releases/tag/v0.5.0
[0.6.0]: https://github.com/amritk/nish/releases/tag/v0.6.0
[0.7.0]: https://github.com/amritk/nish/releases/tag/v0.7.0
[0.8.0]: https://github.com/amritk/nish/releases/tag/v0.8.0
[0.9.0]: https://github.com/amritk/nish/releases/tag/v0.9.0
[0.10.0]: https://github.com/amritk/nish/releases/tag/v0.10.0
[0.11.0]: https://github.com/amritk/nish/releases/tag/v0.11.0
[0.12.0]: https://github.com/amritk/nish/releases/tag/v0.12.0
[0.13.0]: https://github.com/amritk/nish/releases/tag/v0.13.0
[0.14.0]: https://github.com/amritk/nish/releases/tag/v0.14.0
[0.15.0]: https://github.com/amritk/nish/releases/tag/v0.15.0
[0.16.0]: https://github.com/amritk/nish/releases/tag/v0.16.0
[0.17.0]: https://github.com/amritk/nish/releases/tag/v0.17.0
[0.18.0]: https://github.com/amritk/nish/releases/tag/v0.18.0
[0.19.0]: https://github.com/amritk/nish/releases/tag/v0.19.0
