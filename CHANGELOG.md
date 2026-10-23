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

## [0.20.0] - 2026-10-23

### Breaking changes

- cli: Publish to npm as nish instead of @amritk/nish ([#830](https://github.com/amritk/nish/pull/830))

### Added

- net: Use ECN counts in QUIC recovery ([#820](https://github.com/amritk/nish/pull/820))
- net: Run an HTTP server on every core with a prefork supervisor (#478) ([#823](https://github.com/amritk/nish/pull/823))
- std: Ed25519 signatures (RFC 8032) in std/crypto (#788) ([#826](https://github.com/amritk/nish/pull/826))

### Fixed

- net: Count the resets an HTTP/2 server sends against its reset budget ([#809](https://github.com/amritk/nish/pull/809))
- codegen: Reserve libm's C99/C23 names in c-symbols past LLVM 18's table ([#813](https://github.com/amritk/nish/pull/813))
- net: Cap relay peers by a validated address only ([#811](https://github.com/amritk/nish/pull/811))
- checker: Accept a fresh parallelMapInto destination beside captured arrays ([#812](https://github.com/amritk/nish/pull/812))
- checker: Carry NL8001 into data-parallel arrows and offset uses (#629) ([#822](https://github.com/amritk/nish/pull/822))
- net: Decode HPACK into caller-owned storage and bound the HTTP/2 header bomb (#473) ([#825](https://github.com/amritk/nish/pull/825))

### Documentation

- security: Correct the safegcd changelog's ct_asm claim and the off-main anchors in ct-verification.md ([#816](https://github.com/amritk/nish/pull/816))

### Tests

- checker: Pin an unannotated secret(...) of a class written as a const alias or a call result ([#814](https://github.com/amritk/nish/pull/814))
- bench: Print the noise band per crypto row and pin the --validate mismatch ([#817](https://github.com/amritk/nish/pull/817))
- net: Close the lazy-slot acceptance gaps left after #786 ([#819](https://github.com/amritk/nish/pull/819))
- ct: Print each runner's CPU fingerprint and time a same-runner A/A pass ([#827](https://github.com/amritk/nish/pull/827))

### Build

- Drop the stale 0.18.0 platform entries from package-lock.json ([#810](https://github.com/amritk/nish/pull/810))
- deps: Bump the go_modules group across 2 directories with 3 updates ([#803](https://github.com/amritk/nish/pull/803))
- deps: Bump golang.org/x/net from 0.54.0 to 0.60.0 in /bench/crypto/handshake/go in the go_modules group across 1 directory ([#818](https://github.com/amritk/nish/pull/818))

### CI

- Cache the test job's apt packages and bound each download ([#821](https://github.com/amritk/nish/pull/821))
- Drop the PR body attribution check ([#824](https://github.com/amritk/nish/pull/824))


## [0.19.0] - 2026-10-22

### Breaking changes

- crypto: TLS and QUIC one-shot key derivations take and answer Secret ([#665](https://github.com/amritk/nish/pull/665))
- checker: A Secret may be a readonly field of a class whose wipe() wipes it ([#685](https://github.com/amritk/nish/pull/685))
- tls: TlsServer and TlsRecordServer hold their secrets in Secret fields ([#705](https://github.com/amritk/nish/pull/705))
- quic: QuicConnection holds its traffic secrets in Secret fields; quicKeys writes into a caller's slot ([#706](https://github.com/amritk/nish/pull/706))
- checker: Switch on a union's tag, with exhaustiveness ([#798](https://github.com/amritk/nish/pull/798))

### Added

- checker: Warn when a loop drops an allocation on every pass ([#533](https://github.com/amritk/nish/pull/533))
- net: Derive the TLS resumption master secret, completing RFC 8448 §3 ([#539](https://github.com/amritk/nish/pull/539))
- crypto: Run Wycheproof for HMAC and HKDF, and wipe their state ([#542](https://github.com/amritk/nish/pull/542))
- cli: Refuse retained arena memory with --deny-retention ([#544](https://github.com/amritk/nish/pull/544))
- cli: Report where every allocation's memory goes with --emit-arena ([#547](https://github.com/amritk/nish/pull/547))
- checker: Fixes for !xs.length and non-boolean && / || operands, and code-checked nofix cases ([#550](https://github.com/amritk/nish/pull/550))
- crypto: A native-only helper that draws the key and serial for x509MintSelfSigned ([#540](https://github.com/amritk/nish/pull/540))
- checker: Mutex<T>, a lock that owns its data, in nish/threads ([#562](https://github.com/amritk/nish/pull/562))
- checker: Channel<T> of scalars, closed when its senders return, in nish/threads ([#566](https://github.com/amritk/nish/pull/566))
- std: A JSON writer that writes into a byte buffer, in nish/json ([#580](https://github.com/amritk/nish/pull/580))
- std: A streaming JSON tokenizer over u8[], in nish/json-tokenizer ([#582](https://github.com/amritk/nish/pull/582))
- std: Decode JSON into a class and encode it back, with code the compiler writes ([#593](https://github.com/amritk/nish/pull/593))
- runtime: Runtime-aes.c, AES-GCM on AES-NI/PCLMULQDQ and ARMv8 AES/PMULL ([#594](https://github.com/amritk/nish/pull/594))
- checker: Accept `??` on a nullable value ([#596](https://github.com/amritk/nish/pull/596))
- checker: Accept a `?.` chain that ends in `??` ([#603](https://github.com/amritk/nish/pull/603))
- codegen: A builtin that makes a string from a byte range in one allocation ([#606](https://github.com/amritk/nish/pull/606))
- std: Pretty-printed output and a strict non-finite mode for JsonWriter ([#604](https://github.com/amritk/nish/pull/604))
- std: JsonValue, a dynamic JSON tree with lossless numbers, in nish/json-value ([#617](https://github.com/amritk/nish/pull/617))
- codegen: U64, enum and Map fields, and key dispatch by length, in typed JSON ([#622](https://github.com/amritk/nish/pull/622))
- codegen: Renamed and optional-with-default fields, and lossless number fields, in typed JSON ([#630](https://github.com/amritk/nish/pull/630))
- checker: ParallelMap, parallelFrom and arrows that read the enclosing function's consts ([#609](https://github.com/amritk/nish/pull/609))
- checker: Arrow tasks with captures, tasks without a destination, and a seeded Rng ([#644](https://github.com/amritk/nish/pull/644))
- cli: --cpu x86-64-v3 links module and runtime at one CPU level (WP38 S2) ([#660](https://github.com/amritk/nish/pull/660))
- checker: AtomicI32 and AtomicI64 in nish/threads ([#654](https://github.com/amritk/nish/pull/654))
- checker: Enum member types such as Kind.Array ([#655](https://github.com/amritk/nish/pull/655))
- checker: Strings and scalar arrays cross threads by copy-at-join ([#669](https://github.com/amritk/nish/pull/669))
- net: HTTP/1.1 responses carry a Date header ([#675](https://github.com/amritk/nish/pull/675))
- checker: Discriminated union types ([#682](https://github.com/amritk/nish/pull/682))
- net: HTTP/2 and HTTP/3 responses carry a date field ([#692](https://github.com/amritk/nish/pull/692))
- crypto: HKDF, TLS schedule and QUIC derivations into a held Secret ([#684](https://github.com/amritk/nish/pull/684))
- checker: Guard helpers, thread diagnostics that say what to write, and --fix for them ([#691](https://github.com/amritk/nish/pull/691))
- bench: POST /json-echo, a JSON request body through std/json ([#689](https://github.com/amritk/nish/pull/689))
- bench: The cross-runtime HTTP twins under bench/http-twins ([#677](https://github.com/amritk/nish/pull/677))
- interop: String parameters on declare function ([#695](https://github.com/amritk/nish/pull/695))
- interop: Copy string results out of declare function ([#701](https://github.com/amritk/nish/pull/701))
- interop: ReadCString in nish:unsafe and the literal-null CPtr parameter ([#704](https://github.com/amritk/nish/pull/704))
- std: Read pre_shared_key and write NewSessionTicket in nish/net/tls ([#683](https://github.com/amritk/nish/pull/683))
- std: Seal and open TLS session tickets under a Secret key in nish/net/tls/ticket ([#680](https://github.com/amritk/nish/pull/680))
- std: Nish/bytes, endian reads and writes of integers and doubles in a byte array ([#690](https://github.com/amritk/nish/pull/690))
- interop: U8[] buffer parameters on declare function, with the run-and-count rule ([#709](https://github.com/amritk/nish/pull/709))
- std: Resume TLS 1.3 sessions with tickets in nish/net/tls ([#712](https://github.com/amritk/nish/pull/712))
- net: TcpListenFlags, SO_REUSEPORT on a TCP listener ([#733](https://github.com/amritk/nish/pull/733))
- net: An HTTP router in nish/net/router ([#730](https://github.com/amritk/nish/pull/730))
- checker: Store null through a guard into a string | null slot ([#736](https://github.com/amritk/nish/pull/736))
- bench: The nish HTTP twin registers its routes on nish/net/router ([#741](https://github.com/amritk/nish/pull/741))
- interop: Pass u8[] buffers to C, with the count checked against the length ([#738](https://github.com/amritk/nish/pull/738))
- runtime: TCP_NODELAY on accepted sockets, as tcpListenFlags flag 2 ([#770](https://github.com/amritk/nish/pull/770))
- bench: A TechEmpower-shaped json and plaintext entry, measured against the HTTP twins ([#785](https://github.com/amritk/nish/pull/785))
- std: Nish/net/url, percent-decoding and query-string parsing ([#729](https://github.com/amritk/nish/pull/729))
- checker: Report the `unsafe` capability for nish:unsafe calls ([#773](https://github.com/amritk/nish/pull/773))
- checker: Narrow a discriminated union by testing its tag ([#716](https://github.com/amritk/nish/pull/716))
- runtime: Non-blocking spawn, kill, waitPid, availableParallelism and totalMemory ([#742](https://github.com/amritk/nish/pull/742))

### Fixed

- codegen: Do not hoist a loop's array header across a new whose constructor resizes it ([#541](https://github.com/amritk/nish/pull/541))
- checker: A method of a non-exported class called from another module links ([#543](https://github.com/amritk/nish/pull/543))
- checker: The diagnostic-fix-2 follow-ups — NL9007 wording, uncheckedGet in the range analysis, one-round migration ([#548](https://github.com/amritk/nish/pull/548))
- checker: NL9007 and NL2457 offer only a guard that compiles and is credited ([#552](https://github.com/amritk/nish/pull/552))
- cli: Check the owner of the run cache root and the package root, and take the first executable nish on PATH ([#546](https://github.com/amritk/nish/pull/546))
- checker: Close the constructor hole in scope regions and admit a task's private writes ([#590](https://github.com/amritk/nish/pull/590))
- checker: Admit a scope region's writes to a function's own Map, Set and array contents ([#608](https://github.com/amritk/nish/pull/608))
- codegen: Give a hidden function a symbol C cannot spell ([#616](https://github.com/amritk/nish/pull/616))
- build: Make the size report print the ceilings the runtime-budget gate applies ([#636](https://github.com/amritk/nish/pull/636))
- checker: Let a scoped task read a shared Map or Set, and let only the first panic of a process print ([#621](https://github.com/amritk/nish/pull/621))
- crypto: Wipe AES key schedules, H and ChaCha state with the volatile wipe ([#639](https://github.com/amritk/nish/pull/639))
- checker: Refuse an exported function that takes a C symbol, and spell private ones apart ([#640](https://github.com/amritk/nish/pull/640))
- checker: A moved secret's aliases are moved too ([#642](https://github.com/amritk/nish/pull/642))
- tls: Wipe every key a TLS connection holds when it ends ([#652](https://github.com/amritk/nish/pull/652))
- quic: Wipe a connection's packet keys and AES schedules when a level, generation or connection ends ([#653](https://github.com/amritk/nish/pull/653))
- quic: Wipe the stateless-reset and Retry token keys and the listener seed when the server is released ([#664](https://github.com/amritk/nish/pull/664))
- checker: Every thread refusal ends with the code to write ([#702](https://github.com/amritk/nish/pull/702))
- interop: The wasi host turns off V8 fast API calls itself ([#720](https://github.com/amritk/nish/pull/720))
- checker: Build thread refusal remedies from the program ([#722](https://github.com/amritk/nish/pull/722))
- checker: Reclaim a frame that spawns into a scope, and accept an arena's array handed to its own scope ([#745](https://github.com/amritk/nish/pull/745))
- checker: Refuse an exported function named memory in a wasm build ([#765](https://github.com/amritk/nish/pull/765))
- codegen: Define the struct an imported generic's inferred result names ([#771](https://github.com/amritk/nish/pull/771))
- checker: Refuse an object literal typed as a class with methods ([#774](https://github.com/amritk/nish/pull/774))
- codegen: Keep field-initialiser stores in an empty explicit constructor ([#781](https://github.com/amritk/nish/pull/781))
- checker: Warn NL8003 on a record copy reached through an alias or a helper ([#782](https://github.com/amritk/nish/pull/782))
- checker: Follow aliases of an element reference in NL2290 ([#769](https://github.com/amritk/nish/pull/769))
- net: Enforce QUIC's AEAD limits and detect optimistic ACKs ([#784](https://github.com/amritk/nish/pull/784))
- bench: Prove OpenSSL's portable hash column on SHA-256 first, falling back to SHA-512 ([#795](https://github.com/amritk/nish/pull/795))

### Performance

- std: Skip JSON string bodies with a memchr search ([#532](https://github.com/amritk/nish/pull/532))
- codegen: Release a loop pass whose own string goes to a parts + join callee ([#549](https://github.com/amritk/nish/pull/549))
- cli: Cache the compiled runtime between links ([#557](https://github.com/amritk/nish/pull/557))
- checker: Prove an offset index `xs[i + c]` from a guard on the sum ([#561](https://github.com/amritk/nish/pull/561))
- checker: Warn on an offset index that keeps its bounds check ([#565](https://github.com/amritk/nish/pull/565))
- checker: Prove a computed index from the range of values it can take ([#581](https://github.com/amritk/nish/pull/581))
- runtime: A persistent FIFO worker pool, an affinity-aware core count and NISH_NUM_THREADS ([#586](https://github.com/amritk/nish/pull/586))
- checker: Give a call the length of the fresh array its helper returns ([#595](https://github.com/amritk/nish/pull/595))
- runtime: AES-GCM on AES-NI and PMULL, with the bitsliced path as fallback ([#598](https://github.com/amritk/nish/pull/598))
- checker: Keep a helper's array length through a call that keeps it ([#605](https://github.com/amritk/nish/pull/605))
- codegen: Retune the parallel map's grain for the worker pool ([#607](https://github.com/amritk/nish/pull/607))
- std: Scan JSON string bodies, whitespace and numbers in bulk ([#614](https://github.com/amritk/nish/pull/614))
- std: Test dst's length in parallelMapInto's loop condition, so the element loop vectorises ([#645](https://github.com/amritk/nish/pull/645))
- bench: Measure S3's bar kernels without a nish:simd surface (WP38 S3a) ([#658](https://github.com/amritk/nish/pull/658))
- crypto: P-256 multiplies the base point by a precomputed table ([#663](https://github.com/amritk/nish/pull/663))
- std: Two system calls per keep-alive HTTP/1.1 request, and output buffers borrowed from a pool ([#672](https://github.com/amritk/nish/pull/672))
- std: Pace HTTP/3 in microseconds so loopback responses stop waiting for the next millisecond ([#694](https://github.com/amritk/nish/pull/694))
- runtime: A thread's arena adopts what a worker copied out, and keeps freed memory ([#686](https://github.com/amritk/nish/pull/686))
- codegen: A frame that calls parallelMap reclaims its result when it does not escape ([#703](https://github.com/amritk/nish/pull/703))
- std: A shared byte-buffer pool that zeroes what it takes back ([#688](https://github.com/amritk/nish/pull/688))
- std: HTTP/2 connections borrow their frame buffers from the server's pool ([#711](https://github.com/amritk/nish/pull/711))
- std: QUIC streams borrow their buffers on first use and give them back once acknowledged ([#715](https://github.com/amritk/nish/pull/715))
- std: TLS record buffers are borrowed per connection and wiped when given back ([#713](https://github.com/amritk/nish/pull/713))
- codegen: Free a string map handed to a callee that keeps none of it ([#737](https://github.com/amritk/nish/pull/737))
- runtime: Claim a divided region's pieces as threads finish ([#731](https://github.com/amritk/nish/pull/731))
- std: Build Http1Server's connections on first accept ([#734](https://github.com/amritk/nish/pull/734))
- runtime: Keep the chunk a map element's body grew at one thread ([#743](https://github.com/amritk/nish/pull/743))
- std: Build Http2TlsServer's connections on first accept ([#767](https://github.com/amritk/nish/pull/767))
- std: Build Http3Server's slots on first accept ([#779](https://github.com/amritk/nish/pull/779))
- std: Build TlsTcpServer's and Http1TlsServer's slots on first accept ([#777](https://github.com/amritk/nish/pull/777))
- crypto: Invert P-256's nonce by constant-time safegcd instead of Fermat ([#780](https://github.com/amritk/nish/pull/780))
- bench: Bind WebTransport on a slot's first accept, and record what each pool costs at start-up ([#786](https://github.com/amritk/nish/pull/786))

### Changed

- std: Give std/crypto/aes.ts four private seams, each called from one place ([#592](https://github.com/amritk/nish/pull/592))

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
- threads: Mark WP29 P3 built, with a measured example ([#568](https://github.com/amritk/nish/pull/568))
- Name the checker's recurring escape routes, and where a Measured figure comes from ([#569](https://github.com/amritk/nish/pull/569))
- Plan the HTTP server beyond the relay, from a TechEmpower entry to every version (WP39) ([#578](https://github.com/amritk/nish/pull/578))
- guide: Add the user guide skeleton and its Scalar config ([#576](https://github.com/amritk/nish/pull/576))
- guide: Write the error handling, generics, modules and memory pages ([#587](https://github.com/amritk/nish/pull/587))
- guide: Write the CLI, standard library, interop and threads pages ([#583](https://github.com/amritk/nish/pull/583))
- Require the user guide to move with the language ([#585](https://github.com/amritk/nish/pull/585))
- guide: Write the getting-started pages ([#589](https://github.com/amritk/nish/pull/589))
- simd: Measure AES-GCM and write WP38's S5 row with its bar ([#584](https://github.com/amritk/nish/pull/584))
- guide: Write the language basics pages ([#588](https://github.com/amritk/nish/pull/588))
- Mark the optional-chain stage of the nullish plan completed ([#623](https://github.com/amritk/nish/pull/623))
- bench: Re-record json-compare on main after the json-parity stages ([#632](https://github.com/amritk/nish/pull/632))
- bench: Nish/threads against Rust and Go on the same parallel kernels ([#615](https://github.com/amritk/nish/pull/615))
- simd: Plan S6, the JSON tokenizer on vectors and Eisel-Lemire ([#634](https://github.com/amritk/nish/pull/634))
- Record the AES-GCM kernel run's conventions in CLAUDE.md ([#633](https://github.com/amritk/nish/pull/633))
- wp38: Measure what reading every --cpu level costs, and recommend S2, S3a and S7 ([#638](https://github.com/amritk/nish/pull/638))
- bench: Re-time the bitsliced AES fallback against the ce9d394 baseline ([#637](https://github.com/amritk/nish/pull/637))
- Record the worker pool's ceiling, the AES fallback's drift caveat, and the moved-fact rule ([#647](https://github.com/amritk/nish/pull/647))
- wp38: Take Q7 to Q9, record S7 as built by #561, and plan S3a and the --cpu flag ([#650](https://github.com/amritk/nish/pull/650))
- crypto: P-256's share of a TLS 1.3 handshake, the baseline and the bar ([#641](https://github.com/amritk/nish/pull/641))
- crypto: P-256's fixed-base table against the bar ([#666](https://github.com/amritk/nish/pull/666))
- security: Anchor the P-256 comb's record at 6e11fa6 ([#667](https://github.com/amritk/nish/pull/667))
- security: Threat model for TLS 1.3 session resumption ([#635](https://github.com/amritk/nish/pull/635))
- perf: Measure a 64x64-to-128 multiply on Poly1305; the bar is missed on wasm32 ([#687](https://github.com/amritk/nish/pull/687))
- guide: Which thread tool to reach for, and the finished thread surface ([#697](https://github.com/amritk/nish/pull/697))
- bench: Every HTTP server through every scenario, interleaved ([#698](https://github.com/amritk/nish/pull/698))
- security: Cite the link-test check by its template in QUIC-1 ([#707](https://github.com/amritk/nish/pull/707))
- interop: Design u8[] buffers and owned handles across declare function ([#679](https://github.com/amritk/nish/pull/679))
- WP42, a multi-core server from pre-forked processes ([#726](https://github.com/amritk/nish/pull/726))
- interop: Point the WASI host's fast-call flag at its tracking issue ([#735](https://github.com/amritk/nish/pull/735))
- Extend the guide-update rule in testing.md and ARCHITECTURE.md past constructs ([#747](https://github.com/amritk/nish/pull/747))
- Design streaming file reads (WP44) ([#764](https://github.com/amritk/nish/pull/764))
- WP45, name resolution for nish:net — getaddrinfo, a stub resolver, or both ([#766](https://github.com/amritk/nish/pull/766))
- Write WP37's note, the OS sandbox ([#755](https://github.com/amritk/nish/pull/755))
- plan: Stage WP33 R3 and R4, the runtime split by host and --emit-ts ([#778](https://github.com/amritk/nish/pull/778))
- runtime: Weigh regions, arena reset and refcounting for long-running servers ([#768](https://github.com/amritk/nish/pull/768))
- perf: Record the handshake-time baseline and the bar for P-256's scalar inversion ([#772](https://github.com/amritk/nish/pull/772))
- perf: Read the P-256 inversion bar on main ([#796](https://github.com/amritk/nish/pull/796))
- self: Trim CLAUDE.md to the rules every session needs ([#804](https://github.com/amritk/nish/pull/804))

### Tests

- ct: Hold the x25519 timing to its domain and re-measure CT-13 ([#537](https://github.com/amritk/nish/pull/537))
- std: Compare indexOfAny's non-ASCII byte offset between native and --profile wasi ([#536](https://github.com/amritk/nish/pull/536))
- std: Test262- and V8-derived JSON conformance, and the JSONTestSuite round trip through the writer ([#600](https://github.com/amritk/nish/pull/600))
- std: JSON against serde_json, simdjson, yyjson, RapidJSON and Go on the same machine ([#601](https://github.com/amritk/nish/pull/601))
- std: Hold the JSON conformance corpus's indented cases to JSON.stringify, and render the json-value cookbook entry ([#631](https://github.com/amritk/nish/pull/631))
- checker: Pin that a guard on one array's length does not prove an offset access into another ([#659](https://github.com/amritk/nish/pull/659))
- std: An h2load harness for HTTP/3 latency, and the cause of the 1 ms stalls ([#676](https://github.com/amritk/nish/pull/676))
- interop: --slots sizes every pool, and the harness that measures memory and throughput ([#693](https://github.com/amritk/nish/pull/693))
- bench: Time the bun-http-framework-benchmark routes, Elysia, Hono and startup ([#723](https://github.com/amritk/nish/pull/723))
- checker: Pin every route by which sibling scopes share a lock, an atomic or a destination ([#727](https://github.com/amritk/nish/pull/727))
- interop: Curl and Chromium resume a TLS 1.3 session ([#725](https://github.com/amritk/nish/pull/725))
- bench: A --cores mode for bench/http.mjs and N-core twins ([#728](https://github.com/amritk/nish/pull/728))
- interop: The loopback client sends nothing after a CONNECTION_CLOSE ([#739](https://github.com/amritk/nish/pull/739))
- std: Pin Http2TlsServer's start-up bytes ([#787](https://github.com/amritk/nish/pull/787))
- bench: Add the crypto twin harness with the hash kernels ([#776](https://github.com/amritk/nish/pull/776))
- bench: Re-take the Rust and Go parallel table and add an atomic par-histogram ([#746](https://github.com/amritk/nish/pull/746))
- self: Keep the checked goldens one file per module, with body-relative lines ([#797](https://github.com/amritk/nish/pull/797))
- bench: Accept any crypto family's main.ts in the --only crypto forwarding check ([#802](https://github.com/amritk/nish/pull/802))
- bench: Time one full TLS 1.3 and one QUIC handshake against the twins ([#792](https://github.com/amritk/nish/pull/792))
- bench: Time X25519, P-256, Ed25519 and X.509 against the twins ([#793](https://github.com/amritk/nish/pull/793))
- bench: Time AES-128/256-GCM and ChaCha20-Poly1305 against the twins ([#794](https://github.com/amritk/nish/pull/794))
- ct: Settle the ladderStep (CT-13) and macEqual timing readings ([#775](https://github.com/amritk/nish/pull/775))

### Build

- Regenerate package-lock.json for v0.18.0 ([#526](https://github.com/amritk/nish/pull/526))

### CI

- test: Deal the test shards by measured cost ([#724](https://github.com/amritk/nish/pull/724))
- Run runtime-net.c's Darwin branch on a macOS runner ([#754](https://github.com/amritk/nish/pull/754))
- Add npm run sync-main and run CI in the merge queue ([#801](https://github.com/amritk/nish/pull/801))

### Internal

- Compact agent sessions at 200k and cut the calls a pull request spends ([#648](https://github.com/amritk/nish/pull/648))


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
[0.20.0]: https://github.com/amritk/nish/releases/tag/v0.20.0
