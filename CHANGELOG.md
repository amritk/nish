# Changelog

All notable changes to Nish, newest release first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Nish is on 0.x, where a breaking
change moves the minor version.

Each release lists one line per change, under the heading its kind gives,
with a link to the pull request that holds the full description and the diff.
The same entries with their full descriptions are in
[`changelog/`](https://github.com/amritk/nish/tree/main/changelog), one JSON
file per release, and each release's notes and downloads are on the
[releases page](https://github.com/amritk/nish/releases).

<!-- Generated: scripts/changelog-gen.mjs writes each section from changelog/<version>.json when a release is cut. Fix a wording in the JSON and re-render; edits here are overwritten. -->

## [Unreleased]

## [0.46.0] - 2026-11-24

### Added

- runtime: PollWaitBatch and the direct ring wait for ring-only loops ([#2256](https://github.com/amritk/nish/pull/2256))

### Performance

- runtime: A nish/sqlite cursor call looks its handle up once ([#2255](https://github.com/amritk/nish/pull/2255))
- runtime: Coalesce a ring slot's queued sends into one SEND, from a per-ring buffer pool ([#2252](https://github.com/amritk/nish/pull/2252))
- runtime: Integer index seeks reuse one key, and Cursor.countRange counts an index's keys in one walk ([#2257](https://github.com/amritk/nish/pull/2257))
- runtime: Cursor.readRow decodes the columns selectRow chose in one call ([#2259](https://github.com/amritk/nish/pull/2259))
- runtime: Batched ring waits on HttpHandler, measured on bench/handler-ring ([#2261](https://github.com/amritk/nish/pull/2261))
- runtime: Send large ring writes from pool buffers, print ring stats, attribute the PSS rise ([#2271](https://github.com/amritk/nish/pull/2271))

### Documentation

- plan: Add WP89, GPU graphics and a 2D game layer in std/ ([#2246](https://github.com/amritk/nish/pull/2246))
- guide: Link the language reference on the docs site, not GitHub ([#2254](https://github.com/amritk/nish/pull/2254))
- runtime: SQLite's unix-excl VFS is opt-in through openDatabase's URI route ([#2253](https://github.com/amritk/nish/pull/2253))
- bench: Ring sends per response, packets per response and CPU at 18k and 96k ([#2251](https://github.com/amritk/nish/pull/2251))
- self: Every property a security row states has its own failing check ([#2264](https://github.com/amritk/nish/pull/2264))
- CLAUDE.md names the bench goldens and the sqlite adapter's size check ([#2265](https://github.com/amritk/nish/pull/2265))
- Pin the runtime budget to a runtime change and BENCHMARKS commits to main ([#2266](https://github.com/amritk/nish/pull/2266))
- plan: Reopen WP38 with fast-math, simd128, v4 and recipe stages ([#2234](https://github.com/amritk/nish/pull/2234))

### Tests

- runtime: Derive the per-target runtime layout asserts from ARENA_TYPE and ARRAY_TYPE ([#2258](https://github.com/amritk/nish/pull/2258))


## [0.45.1] - 2026-11-24

### Fixed

- runtime: Prove deflate and inflate's panic sites ([#2217](https://github.com/amritk/nish/pull/2217))

### Documentation

- plan: File the router prover performance plan ([#2227](https://github.com/amritk/nish/pull/2227))
- guide: Space code blocks inside steps and details ([#2228](https://github.com/amritk/nish/pull/2228))

### CI

- release: Grant ci-gate's statuses: write to the release run ([#2229](https://github.com/amritk/nish/pull/2229))


## [0.45.0] - 2026-11-23

### Added

- net: Add nish/net/protobuf, protobuf's wire format, with its security record ([#2106](https://github.com/amritk/nish/pull/2106))
- runtime: Trailers on the nish/net/http-server façade's HTTP/2 answers ([#2110](https://github.com/amritk/nish/pull/2110))
- runtime: Add nish/net/grpc, unary gRPC calls on the HTTP/2 listeners, with its security record (WP72 S3) ([#2117](https://github.com/amritk/nish/pull/2117))
- checker: Lend(x) reads a spawner's object in place (design B) ([#2118](https://github.com/amritk/nish/pull/2118))
- runtime: Answer Accept-Encoding: deflate with a zlib body ([#2127](https://github.com/amritk/nish/pull/2127))
- checker: A mulHigh builtin for the 64×64→128 high product ([#1808](https://github.com/amritk/nish/pull/1808))
- net: WP43 S5 — middleware, steps that run before and after route bodies ([#2165](https://github.com/amritk/nish/pull/2165))
- cli: Nish proto writes message classes from a .proto file (WP72 S5) ([`60cdbc1`](https://github.com/amritk/nish/commit/60cdbc1))
- runtime: Serve static files with MIME types, ETag, Range and traversal refused ([#2166](https://github.com/amritk/nish/pull/2166))
- net: Streaming request bodies on the façade's HTTP/2 listeners (WP72 S6a) ([#2167](https://github.com/amritk/nish/pull/2167))
- runtime: Decode request bodies under a decompression-bomb limit ([#2169](https://github.com/amritk/nish/pull/2169))
- net: Streaming gRPC calls on the façade's HTTP/2 listeners (WP72 S6) ([#2170](https://github.com/amritk/nish/pull/2170))

### Fixed

- runtime: Make std/ panic-free for strict modules ([#2103](https://github.com/amritk/nish/pull/2103))
- runtime: Make json-typed, cli-args, cli-flags and cli panic-free (WP80 S1) ([#2186](https://github.com/amritk/nish/pull/2186))
- runtime: Make the std/net QUIC wire layer panic-free ([#2189](https://github.com/amritk/nish/pull/2189))
- crypto: WP83 S1 — hashes, MACs and key derivation ([#2182](https://github.com/amritk/nish/pull/2182))
- runtime: Std/ panic-free for strict modules: std/sync, bytes, buffer-pool and prefork ([#2183](https://github.com/amritk/nish/pull/2183))
- runtime: Make the std/net TLS codec and record layer panic-free ([#2192](https://github.com/amritk/nish/pull/2192))
- runtime: Make the std/net TLS, fetch and outbound client side panic-free ([#2190](https://github.com/amritk/nish/pull/2190))
- runtime: Make the std/net QUIC engine and relay panic-free ([#2194](https://github.com/amritk/nish/pull/2194))
- runtime: WP81 S1 — postgres-carrier and postgres-async panic-free ([#2178](https://github.com/amritk/nish/pull/2178))
- runtime: Make the std/net HTTP/3 stack panic-free ([#2196](https://github.com/amritk/nish/pull/2196))
- runtime: Make the HTTP/1 wire layer panic-free (WP80 S3) ([#2193](https://github.com/amritk/nish/pull/2193))
- self: Match nish-cmp's changelog words as the generator renders them ([#2201](https://github.com/amritk/nish/pull/2201))
- runtime: Make the std/net HTTP/2 stack and HPACK panic-free ([#2199](https://github.com/amritk/nish/pull/2199))
- runtime: Make the HTTP/1 server panic-free (WP80 S4) ([#2187](https://github.com/amritk/nish/pull/2187))
- runtime: Make handler, serve and static panic-free for http-app (WP80 S5) ([#2198](https://github.com/amritk/nish/pull/2198))
- runtime: WP83 S2 — ciphers, curves, signatures and password hashing ([#2184](https://github.com/amritk/nish/pull/2184))
- runtime: WP83 S3 — P-256, P-384, RSA and JWT ([#2188](https://github.com/amritk/nish/pull/2188))
- runtime: Make std/net/router.ts panic-free (WP80 S6) ([#2210](https://github.com/amritk/nish/pull/2210))
- runtime: Bound the DNS query deadline and record what WP82 S9 leaves (WP82 S9) ([#2211](https://github.com/amritk/nish/pull/2211))
- runtime: WP83 S4 — X.509 and the PKI ([#2185](https://github.com/amritk/nish/pull/2185))
- runtime: Make WebTransport, WebSocket, gRPC and OIDC panic-free (WP82 S8) ([#2212](https://github.com/amritk/nish/pull/2212))
- runtime: WP81 S2 — postgres panic-free ([#2200](https://github.com/amritk/nish/pull/2200))
- runtime: Make checksum, zlib and gzip panic-free ([#2216](https://github.com/amritk/nish/pull/2216))

### Performance

- runtime: Read emit-ts strings without re-encoding them per byte ([#2108](https://github.com/amritk/nish/pull/2108))
- codegen: Inline integer conversions under --emit-ts ([#2121](https://github.com/amritk/nish/pull/2121))
- runtime: Count std/net instructions and extend std/ panic-free for strict modules to DNS ([#2181](https://github.com/amritk/nish/pull/2181))

### Documentation

- Record the cookbook regen check and nish-cmp --no-sidecars for wasm32 in CLAUDE.md ([#1752](https://github.com/amritk/nish/pull/1752))
- Plan WP74 to WP79, the std and toolchain gaps a generated API CLI meets ([#2098](https://github.com/amritk/nish/pull/2098))
- Check a record's cited checks and figures against their source before the PR ([#1719](https://github.com/amritk/nish/pull/1719))
- guide: Find the Threads page for multithreading searches and wrap code headings on phones ([#2173](https://github.com/amritk/nish/pull/2173))
- Require a test for every bound a security record lists ([#2175](https://github.com/amritk/nish/pull/2175))
- Replace the vibe-coded badge with a built-with-Claude badge ([#2191](https://github.com/amritk/nish/pull/2191))
- plan: Bring the refined WP72 plan to main ([#2195](https://github.com/amritk/nish/pull/2195))

### Tests

- std: Pin vector 0.6.0 and regenerate the spec tests ([#2109](https://github.com/amritk/nish/pull/2109))
- std: Cover the HMAC and HKDF Secret exports in their RFC contracts ([#2112](https://github.com/amritk/nish/pull/2112))
- std: State the PBKDF2 and SCRAM laws and record why their vectors keep commands ([#2113](https://github.com/amritk/nish/pull/2113))
- std: Record why the RFC 8439 quarter-round positions stay uncited ([#2111](https://github.com/amritk/nish/pull/2111))
- std: Specify base64 and base64url from RFC 4648 ([#2114](https://github.com/amritk/nish/pull/2114))
- std: Specify P-256 ECDSA signing from RFC 6979 ([#2116](https://github.com/amritk/nish/pull/2116))
- std: Specify SHA-1 and SHA-2 from RFC 6234 ([#2115](https://github.com/amritk/nish/pull/2115))
- self: Std/ panic ratchet, kept-panic rule and caller-proven spawn slots ([#2164](https://github.com/amritk/nish/pull/2164))
- self: Match the panic ratchet's nish-cmp declarations to its release note ([#2174](https://github.com/amritk/nish/pull/2174))
- runtime: Pin the date in net_handler_steps' warm arena rounds ([#2197](https://github.com/amritk/nish/pull/2197))
- Refuse a new inline function program in the test harnesses ([#2215](https://github.com/amritk/nish/pull/2215))

### CI

- Delete the Release PR's runs that wait for approval ([#2099](https://github.com/amritk/nish/pull/2099))
- Report the dispatched CI gate as a ci-gate commit status ([#2101](https://github.com/amritk/nish/pull/2101))
- interop: Call the gRPC server with pinned grpcurl and ghz over TLS and h2c (WP72 S4) ([#2119](https://github.com/amritk/nish/pull/2119))

### Internal

- Name break-web's build as a --help input, and refresh apt before the compiler-rt install ([#1806](https://github.com/amritk/nish/pull/1806))


## [0.44.0] - 2026-11-21

### Breaking changes

- cli: Hold the root package to no panic by default; --allow-panics relaxes it ([#2004](https://github.com/amritk/nish/pull/2004))

### Added

- cli: Profile-guided builds with nish --link --pgo-generate and --pgo-use ([#1764](https://github.com/amritk/nish/pull/1764))
- runtime: Read SQLite tables and indexes through B-tree cursors ([#1771](https://github.com/amritk/nish/pull/1771))
- checker: Accept optional chaining and nullish coalescing under --compat ([#1770](https://github.com/amritk/nish/pull/1770))
- codegen: Accept string switch and for...of over a string under --compat ([#1788](https://github.com/amritk/nish/pull/1788))
- checker: Accept optional parameters, non-constant defaults and overload signatures under --compat ([#1789](https://github.com/amritk/nish/pull/1789))
- cli: A package links a C library or its own C sources ([#1796](https://github.com/amritk/nish/pull/1796))
- checker: Opaque declare classes C can return ([#1795](https://github.com/amritk/nish/pull/1795))
- checker: Pair a C buffer with its count by name, at any unsigned width ([#1794](https://github.com/amritk/nish/pull/1794))
- checker: Fixed-length array fields in a declare class ([#1803](https://github.com/amritk/nish/pull/1803))
- cli: Nish c-import writes a Nish module from a C header ([#1798](https://github.com/amritk/nish/pull/1798))
- cli: Nish c-import emits opaque classes, array fields and named buffer pairs ([#1810](https://github.com/amritk/nish/pull/1810))
- interop: A compact class crosses --emit-header as an opaque handle (WP48 stage 2c) ([#1781](https://github.com/amritk/nish/pull/1781))
- checker: Two modules may each keep a private function or generic of one name ([#1812](https://github.com/amritk/nish/pull/1812))
- runtime: Add nish/crypto/scram and move the Postgres SCRAM arithmetic onto it ([#1814](https://github.com/amritk/nish/pull/1814))
- codegen: Give a compact class's links their own TBAA node, debug type and debugger printers ([#1782](https://github.com/amritk/nish/pull/1782))
- codegen: The compiler picks compact classes, with implements Wide and --compact off ([#1786](https://github.com/amritk/nish/pull/1786))
- checker: Allow [] and new expressions as class field initializers ([#1829](https://github.com/amritk/nish/pull/1829))
- cli: Add --allow-panics and pass it wherever the repository builds a program that may panic ([#1848](https://github.com/amritk/nish/pull/1848))
- checker: Read named constants, masks, charCodeAt and down-counting loops in the panic prover ([#1999](https://github.com/amritk/nish/pull/1999))

### Fixed

- net: Make the pipelined pool's seats-freed-together check deterministic ([#1766](https://github.com/amritk/nish/pull/1766))
- ci: Say in ci-scope's why= whether any lane is off ([#1815](https://github.com/amritk/nish/pull/1815))
- checker: Record a guarded nish:simd access as a proven panic site ([#1784](https://github.com/amritk/nish/pull/1784))
- checker: Name the template-literal spelling when a number's toString is called ([#1824](https://github.com/amritk/nish/pull/1824))
- runtime: Ring-in-place bench validation, its deadline claims, and single-process ring pins ([#1831](https://github.com/amritk/nish/pull/1831))
- codegen: Lay a Result's pointer payload out in 4 bytes on wasm32 ([#1757](https://github.com/amritk/nish/pull/1757))
- examples: Make the examples panic-free under --deny-panics ([#1989](https://github.com/amritk/nish/pull/1989))
- ci: Honour strict link programs in the Nish runner, and push the Release PR with RELEASE_PR_TOKEN ([#2067](https://github.com/amritk/nish/pull/2067))

### Performance

- ci: Check each golden case's IR on one shard and time crypto-bench on main only ([#1792](https://github.com/amritk/nish/pull/1792))
- ci: Rebalance the test shards around what is left ([#1797](https://github.com/amritk/nish/pull/1797))
- docs: Paint the landing page's hero from the server's HTML ([#1799](https://github.com/amritk/nish/pull/1799))
- interop: Read short Postgres int columns without the overflow test ([#1800](https://github.com/amritk/nish/pull/1800))
- runtime: Cache checked cursor shapes and keep read-transaction statements prepared ([#1801](https://github.com/amritk/nish/pull/1801))
- runtime: Measure the feed through cursors against SQL ([#1787](https://github.com/amritk/nish/pull/1787))
- bench: Measure PGO and the CPU level on the SQLite feed workload ([#1832](https://github.com/amritk/nish/pull/1832))
- runtime: Lend Http1Server connections only to busy slots ([#1785](https://github.com/amritk/nish/pull/1785))
- runtime: Split lines in std/text sixteen positions at a time ([#1834](https://github.com/amritk/nish/pull/1834))

### Changed

- checker: Give each struct a symbol separate from its source name ([#1840](https://github.com/amritk/nish/pull/1840))

### Documentation

- Write code examples as arrow functions and hide the nish:ok test markers from the site ([#1753](https://github.com/amritk/nish/pull/1753))
- interop: Propose WP66, C libraries from their headers ([#1759](https://github.com/amritk/nish/pull/1759))
- self: Pin std/ line moves and nish:simd panic proofs in CLAUDE.md ([#1754](https://github.com/amritk/nish/pull/1754))
- bench: Measure where a minimal HTTP/1.1 GET spends its instructions and bytes ([#1765](https://github.com/amritk/nish/pull/1765))
- Plan WP67, keeping every cause in an error chain ([#1774](https://github.com/amritk/nish/pull/1774))
- Sell Nish's speed in search results and serve a 48px favicon ([#1790](https://github.com/amritk/nish/pull/1790))
- Add a Leaderboards page with the multicore server challenge result ([#1802](https://github.com/amritk/nish/pull/1802))
- roadmap: Settle WP57 S2 as keep refusing and split S3 into stages ([#1816](https://github.com/amritk/nish/pull/1816))
- roadmap: Tick WP39's and WP43's built stages and move finished packages to Landed ([#1819](https://github.com/amritk/nish/pull/1819))
- ForEach on arrays and sets, NL9019's scope, string-enum and stale security lines ([#1825](https://github.com/amritk/nish/pull/1825))
- Tick WP39's merged stages, mark wp60's in-band cells, and fix stale bench lines ([#1828](https://github.com/amritk/nish/pull/1828))
- self: Propose WP68, shared libraries layered like atomic design ([#1779](https://github.com/amritk/nish/pull/1779))
- codegen: Say what the compact rule picks in the tree benches and the memory guide (WP48 stage 4) ([#1844](https://github.com/amritk/nish/pull/1844))
- interop: NL4020 also reaches the methods of an exported class ([#1845](https://github.com/amritk/nish/pull/1845))
- Say that CI's lint job runs more than npm run lint ([#1841](https://github.com/amritk/nish/pull/1841))
- Recheck diagnostic codes and roadmap counts after syncing main ([#1842](https://github.com/amritk/nish/pull/1842))
- Track the open roadmap as issues, specified by plan files, with the workflow skills vendored ([#1998](https://github.com/amritk/nish/pull/1998))
- Plan #2000 and the leftovers of five finished feature runs ([#2003](https://github.com/amritk/nish/pull/2003))
- Require a bench side to be the code it names ([#1807](https://github.com/amritk/nish/pull/1807))
- Plan WP71 to WP73 for HttpArena, and retire the TechEmpower submission ([#1809](https://github.com/amritk/nish/pull/1809))
- Plan WP39 G7's TLS, WebSocket and h2c-by-preface on the façade, retire the TechEmpower submission ([#2058](https://github.com/amritk/nish/pull/2058))
- self: Propose WP69 and WP70, what a Spectral-compatible linter needs from std ([#1805](https://github.com/amritk/nish/pull/1805))
- Plan WP43's static-file needs from WP71, br responses and middleware ([#2060](https://github.com/amritk/nish/pull/2060))
- plans: File the overload and Postgres write-order plans, and fix four plan-issue drifts ([#2063](https://github.com/amritk/nish/pull/2063))
- plans: File the overload-queue and Postgres write-order plans ([#2064](https://github.com/amritk/nish/pull/2064))
- Regenerate break-web on a --help change, and back every-site sweeps with a check ([#2066](https://github.com/amritk/nish/pull/2066))
- Require exit DECLARED entries and an old-rule grep when a refusal flips ([#1839](https://github.com/amritk/nish/pull/1839))

### Tests

- Link a wasm32 link case natively in the Nish runner too ([#1768](https://github.com/amritk/nish/pull/1768))
- cli: Pin that --cpu reaches the SQLite unit, and record why --cpu native is refused ([#1783](https://github.com/amritk/nish/pull/1783))
- interop: Pin the N-API refusals of compact classes, and say which code appears when ([#1823](https://github.com/amritk/nish/pull/1823))
- Pin constant tables, the recursion loop's panics, and the long-path cleanup ([#1826](https://github.com/amritk/nish/pull/1826))

### CI

- Cancel a main run once the next merge lands, pinning release merges and re-runs ([#1772](https://github.com/amritk/nish/pull/1772))
- cli: Keep each test shard's results in the step summary ([#2005](https://github.com/amritk/nish/pull/2005))
- Start the Release PR's checks by dispatch, with no token ([#2068](https://github.com/amritk/nish/pull/2068))
- Refit the test shard costs and cancel superseded Release PR runs ([#2069](https://github.com/amritk/nish/pull/2069))

### Internal

- Plan WP41's open stages and PR 1808's two follow-ups ([#2059](https://github.com/amritk/nish/pull/2059))


## [0.43.0] - 2026-11-18

### Added

- runtime: Echo ECN counts in the QUIC server's ACKs ([#1711](https://github.com/amritk/nish/pull/1711))
- bench: Measure Nish's crypto against OpenSSL, Go, Rust and Node, portable and with assembly ([#1716](https://github.com/amritk/nish/pull/1716))
- runtime: Give netShutdown and netMss a slot path ([#1715](https://github.com/amritk/nish/pull/1715))
- runtime: Carve the arena from a reserved range when a program has a compact class ([#1707](https://github.com/amritk/nish/pull/1707))
- cli: Report which classes the compact-class rule picks, with --explain-layout ([#1736](https://github.com/amritk/nish/pull/1736))
- codegen: Lay out an implements Compact class's links as 32-bit offsets ([#1744](https://github.com/amritk/nish/pull/1744))
- checker: Report generic class instantiations in --explain-layout ([#1756](https://github.com/amritk/nish/pull/1756))

### Fixed

- runtime: Free an idle ring slot's receive queue ([#1712](https://github.com/amritk/nish/pull/1712))
- runtime: Accept a WebSocket without leaving bytes in the arena ([#1714](https://github.com/amritk/nish/pull/1714))
- runtime: Raise strbuild and map-proto-ordered-fp32 instruction baselines ([#1738](https://github.com/amritk/nish/pull/1738))
- codegen: Lay out a class pointer field in 4 bytes on wasm32 ([#1740](https://github.com/amritk/nish/pull/1740))
- codegen: Widen narrow C arguments and results with zeroext ([#1758](https://github.com/amritk/nish/pull/1758))

### Performance

- runtime: Grow arrays in place; Copy a push loop over an array range in one memcpy ([`c391e09`](https://github.com/amritk/nish/commit/c391e09))
- codegen: Test a counted loop's x + i for overflow once, before the loop ([#1710](https://github.com/amritk/nish/pull/1710))
- ci: Link the compiler under test once per compiler input ([#1735](https://github.com/amritk/nish/pull/1735))
- self: Split the test runner's lines sixteen positions at a time with nish:simd, and add simd variants checked against scalar ([#1713](https://github.com/amritk/nish/pull/1713))
- ci: Deal the test shards by today's costs ([#1739](https://github.com/amritk/nish/pull/1739))
- ci: Run the side jobs only when their inputs change, behind one gate ([#1746](https://github.com/amritk/nish/pull/1746))

### Documentation

- site: Give every page a canonical link, its own titles and a theme-color ([`1fe3ce5`](https://github.com/amritk/nish/commit/1fe3ce5))
- runtime: Record the ring's p99 as a queue on one core, and measure 300,000 connections ([#1717](https://github.com/amritk/nish/pull/1717))
- runtime: Correct the ring slot's netShutdown and netMss answers and the io_uring counts ([#1730](https://github.com/amritk/nish/pull/1730))
- self: Pin benchmark-table provenance and stale-pointer greps in CLAUDE.md ([#1729](https://github.com/amritk/nish/pull/1729))
- Hold a CI lane's read set to what its commands read ([#1751](https://github.com/amritk/nish/pull/1751))

### Tests

- self: Give net_relay_f64 its own scratch directory ([#1704](https://github.com/amritk/nish/pull/1704))
- spec: Hold the crypto specs to vector 0.4.0's rows instead of transcribed properties ([#1702](https://github.com/amritk/nish/pull/1702))
- spec: Move to vector 0.5.0 ([#1703](https://github.com/amritk/nish/pull/1703))
- codegen: Fail the fnref peak checks only on growth ([#1709](https://github.com/amritk/nish/pull/1709))
- Rewrite the reject_* golden cases to arrow declarations ([#1725](https://github.com/amritk/nish/pull/1725))
- Rewrite the link programs and wording cases to arrow declarations ([#1726](https://github.com/amritk/nish/pull/1726))
- Rewrite the differential corpus and the remaining fixtures to arrow declarations ([#1737](https://github.com/amritk/nish/pull/1737))
- Rewrite the positive golden cases to arrow declarations ([#1723](https://github.com/amritk/nish/pull/1723))
- Refuse a new function definition in the test corpus ([#1741](https://github.com/amritk/nish/pull/1741))
- Spell #1736's inline Nish programs as arrows ([#1743](https://github.com/amritk/nish/pull/1743))
- Spell the last host-importing inline programs as arrows ([#1748](https://github.com/amritk/nish/pull/1748))

### CI

- Run each duplicated check once per push ([#1721](https://github.com/amritk/nish/pull/1721))
- Let knip know prlimit is a system tool ([#1742](https://github.com/amritk/nish/pull/1742))


## [0.42.0] - 2026-11-17

### Added

- cli: Link installed Nish packages' agent skills into .claude/skills ([#1654](https://github.com/amritk/nish/pull/1654))
- runtime: Http1Connection says when it is between requests ([#1655](https://github.com/amritk/nish/pull/1655))
- runtime: WP63 S2 — io_uring slot handles in nish:net ([#1658](https://github.com/amritk/nish/pull/1658))
- runtime: Add --debug-arena, which traps a stale arena reference ([#1676](https://github.com/amritk/nish/pull/1676))
- runtime: WP63 S3 — restricted io_uring rings under --sandbox ([#1679](https://github.com/amritk/nish/pull/1679))
- interop: WP63 S4 — HandlerLimits listen on io_uring rings, and the entry re-measured ([#1678](https://github.com/amritk/nish/pull/1678))
- runtime: Std/net/oidc — OpenID Connect discovery and a rotating JWKS key set ([`afeddde`](https://github.com/amritk/nish/commit/afeddde))

### Fixed

- cli: Stop the docs landing hero playing twice on a first load ([#1670](https://github.com/amritk/nish/pull/1670))
- cli: Link a package's agent skills only when the user accepts them ([#1669](https://github.com/amritk/nish/pull/1669))
- checker: NL9018 warns when a handler the loop calls drops a temporary ([#1675](https://github.com/amritk/nish/pull/1675))
- runtime: Keep each premade ring's number on its ring under --sandbox ([#1695](https://github.com/amritk/nish/pull/1695))

### Performance

- interop: Measure mmap_size and a shared cache on the five-process entry ([#1693](https://github.com/amritk/nish/pull/1693))

### Documentation

- Give the docs site a share card, page metadata and a clearer header ([#1672](https://github.com/amritk/nish/pull/1672))
- Draw one underline under the current header link ([#1685](https://github.com/amritk/nish/pull/1685))
- Keep release-note words in squash subjects, pin new diagnostics, and hold records to their code ([#1691](https://github.com/amritk/nish/pull/1691))
- roadmap: WP65 — the surface a lexer port asked for ([#1673](https://github.com/amritk/nish/pull/1673))
- Add an og:video share card recorded from the hero animation ([#1696](https://github.com/amritk/nish/pull/1696))
- roadmap: Propose WP48 again as 32-bit references for linked classes ([#1687](https://github.com/amritk/nish/pull/1687))
- Code that decides what a package may grant fails closed ([#1677](https://github.com/amritk/nish/pull/1677))

### Tests

- spec: Pin vector 0.2.1 and run the spec tests in CI ([#1659](https://github.com/amritk/nish/pull/1659))
- spec: Hold nish/crypto/chacha20poly1305 to RFC 8439 with a vector contract ([#1660](https://github.com/amritk/nish/pull/1660))
- spec: Hold nish/crypto/hkdf to RFC 5869 with a vector contract ([#1661](https://github.com/amritk/nish/pull/1661))
- spec: Hold nish/crypto/hmac to RFC 4231 with a vector contract ([#1663](https://github.com/amritk/nish/pull/1663))
- spec: Hold nish/crypto/ed25519 to RFC 8032 with a vector contract ([#1668](https://github.com/amritk/nish/pull/1668))
- spec: Hold nish/crypto/x25519 to RFC 7748 with a vector contract ([#1664](https://github.com/amritk/nish/pull/1664))
- spec: Move to vector 0.3.1, restore hex's 96 samples, print the staleness check ([#1681](https://github.com/amritk/nish/pull/1681))
- spec: Hold ChaCha20-Poly1305 to RFC 8439 Appendix A under vector 0.3.1 ([#1683](https://github.com/amritk/nish/pull/1683))
- spec: Add RFC 7748's iterated X25519 vectors under vector 0.3.1 ([#1682](https://github.com/amritk/nish/pull/1682))
- spec: Declare HMAC's and HKDF's untested exports as outOfScope under vector 0.3.1 ([#1688](https://github.com/amritk/nish/pull/1688))
- spec: Hold Ed25519's RFC 8032 signatures to vector rows under vector 0.3.1 ([#1684](https://github.com/amritk/nish/pull/1684))
- spec: Add RFC 8439 A.3's eleven Poly1305 vectors under vector 0.4.0 ([#1692](https://github.com/amritk/nish/pull/1692))

### Internal

- infra: Set custom domain to docs.nishlang.com ([#1662](https://github.com/amritk/nish/pull/1662))


## [0.41.0] - 2026-11-16

### Added

- cli: Compatibility mode's machinery with no feature — the allow-list, nish.compat and the dialect in the IR (WP28 C0) ([#1497](https://github.com/amritk/nish/pull/1497))
- runtime: WP63 S1 — the io_uring ring layer, with no surface ([#1649](https://github.com/amritk/nish/pull/1649))
- std: Nish/temporal, TC39 Temporal's dates, times, instants and durations (WP64 S1) ([#1650](https://github.com/amritk/nish/pull/1650))

### Fixed

- cli: Install.sh recognises its wrapper by its first two lines, so an arm or Apple-silicon compiler that names the marker is not overwritten ([#1645](https://github.com/amritk/nish/pull/1645))
- net: A prefork UDP group on port 0 never joins another reuseport group's port ([#1646](https://github.com/amritk/nish/pull/1646))

### Documentation

- runtime: Re-measure WP49 stage 6's gate after the resume build ([#1636](https://github.com/amritk/nish/pull/1636))
- WP28's spikes and C0 recorded in the note and the roadmap ([#1499](https://github.com/amritk/nish/pull/1499))
- runtime: WP63's note — io_uring direct descriptors for nish:net, measured go ([#1647](https://github.com/amritk/nish/pull/1647))


## [0.40.1] - 2026-11-15

### Fixed

- cli: Rebuild the docs site's break game when the release train bumps the version ([#1641](https://github.com/amritk/nish/pull/1641))
- cli: Rebuild the docs site's break game for 0.40.0 ([#1642](https://github.com/amritk/nish/pull/1642))


## [0.40.0] - 2026-11-15

### Added

- runtime: Add nish/page/frame, a framebuffer presenter and fixed-step loop ([#1512](https://github.com/amritk/nish/pull/1512))
- runtime: Add nish/input, a step input any host can fill ([#1506](https://github.com/amritk/nish/pull/1506))
- checker: A process.spawn grant that lets a program start helpers ([#1515](https://github.com/amritk/nish/pull/1515))
- net: An HTTP/3 server clock (H3-5) and WebTransport's rate-cap decision ([#1513](https://github.com/amritk/nish/pull/1513))
- runtime: Add nish/raster, nish/synth and nish/host/game for browser games ([#1526](https://github.com/amritk/nish/pull/1526))
- runtime: Close the HTTP, WebSocket, YAML and PKI attack paths and pin CI to Node 26 LTS ([#1532](https://github.com/amritk/nish/pull/1532))
- cli: An update notice and `nish upgrade` ([#1530](https://github.com/amritk/nish/pull/1530))
- runtime: Add nish/page/game, a one-call browser game harness, with a starter and a guide ([#1531](https://github.com/amritk/nish/pull/1531))
- codegen: Keep root storage's object graph alive between wasm export calls ([#1538](https://github.com/amritk/nish/pull/1538))
- interop: Let the docs hero terminal take a command ([#1533](https://github.com/amritk/nish/pull/1533))
- cli: Install.sh puts nish on PATH in the shell's startup file ([#1559](https://github.com/amritk/nish/pull/1559))
- checker: Warn when an unbounded loop keeps what each pass allocates (NL9018) ([#1555](https://github.com/amritk/nish/pull/1555))
- checker: Let a discriminated union be a generic's type argument ([#1566](https://github.com/amritk/nish/pull/1566))
- cli: Make the docs site's break game playable by touch ([#1567](https://github.com/amritk/nish/pull/1567))
- checker: Warn when a function keeps per-call memory no scope releases ([#1558](https://github.com/amritk/nish/pull/1558))
- net: CUBIC congestion control for QUIC (WP39 G5) ([#1495](https://github.com/amritk/nish/pull/1495))
- net: One handler for HTTP/1.1, 2 and 3 with Alt-Svc (WP39 G7) ([#1473](https://github.com/amritk/nish/pull/1473))
- checker: ForEach on arrays, Map and Set ([#1589](https://github.com/amritk/nish/pull/1589))
- threads: AtomicI32Array and AtomicI64Array, n atomics in one buffer ([#1598](https://github.com/amritk/nish/pull/1598))
- checker: Destructuring declarations over objects and arrays ([#1593](https://github.com/amritk/nish/pull/1593))
- checker: Add string enums, decoded and encoded by typed JSON ([#1627](https://github.com/amritk/nish/pull/1627))
- checker: Add module-level constant arrays of numeric literals ([#1638](https://github.com/amritk/nish/pull/1638))

### Fixed

- runtime: Reach what the AES kernels leave in vector registers (AEAD-4), and settle --cpu for the kernel path ([#1510](https://github.com/amritk/nish/pull/1510))
- net: A QUIC transfer survives a NAT rebind while one hole fills the stream buffer ([#1511](https://github.com/amritk/nish/pull/1511))
- codegen: ReadCString tests its pointer for NULL and panics with ffi-null ([#1507](https://github.com/amritk/nish/pull/1507))
- runtime: Raise the soft descriptor limit to the hard limit in nish:net ([#1548](https://github.com/amritk/nish/pull/1548))
- runtime: Finish a Content-Length response once its whole body is sent ([#1546](https://github.com/amritk/nish/pull/1546))
- codegen: A reassigned let no longer keeps its values in the arena ([#1553](https://github.com/amritk/nish/pull/1553))
- runtime: Bound the root-storage trace to the arena and the static data ([#1571](https://github.com/amritk/nish/pull/1571))
- cli: Drop internal work-package references from diagnostics and generated files ([#1572](https://github.com/amritk/nish/pull/1572))
- cli: Fit the docs site's break game to a phone and give it one menu ([#1594](https://github.com/amritk/nish/pull/1594))

### Performance

- crypto: P-256's cached table for G and a safegcd scalar inverse for verify (K5) ([#1516](https://github.com/amritk/nish/pull/1516))
- net: Answer static routes from an exact-path table ahead of the trie walk (WP49 stage 6) ([#1491](https://github.com/amritk/nish/pull/1491))
- crypto: P-256 field arithmetic on 64-bit limbs (K5), or the figures that decline it ([#1518](https://github.com/amritk/nish/pull/1518))
- checker: Enum narrowing builds an enum's members once ([#1520](https://github.com/amritk/nish/pull/1520))
- net: Shrink what an idle Http1Server connection holds ([#1552](https://github.com/amritk/nish/pull/1552))
- crypto: HmacSha256.digest allocates only the tag, and digestInto allocates nothing ([#1549](https://github.com/amritk/nish/pull/1549))
- interop: Load YAML into a JsonDocument about a fifth faster ([#1557](https://github.com/amritk/nish/pull/1557))
- runtime: Cheaper string runs past non-ASCII bytes ([#1588](https://github.com/amritk/nish/pull/1588))
- runtime: Parse a JSON number in one pass ([#1590](https://github.com/amritk/nish/pull/1590))
- codegen: Write a typed object's keys as one pre-escaped copy ([#1592](https://github.com/amritk/nish/pull/1592))
- runtime: Less fixed work per JSON token ([#1600](https://github.com/amritk/nish/pull/1600))
- net: Cut Router.match's instructions per request for every route kind ([#1596](https://github.com/amritk/nish/pull/1596))
- codegen: Emit self-recursive checked sums as a loop ([#1597](https://github.com/amritk/nish/pull/1597))
- net: Serve drives the HTTP/1 server directly instead of through HttpHandler (WP49 stage 6) ([#1601](https://github.com/amritk/nish/pull/1601))
- net: Cut serve's answer path and hold a request record only from parse to copy ([#1621](https://github.com/amritk/nish/pull/1621))
- codegen: Emit self-recursive checked-sum methods as a loop ([#1616](https://github.com/amritk/nish/pull/1616))
- codegen: Emit self-recursive checked i64 sums as a loop ([#1626](https://github.com/amritk/nish/pull/1626))
- codegen: Emit self-recursive checked sums with a per-step arena scope as a loop ([#1635](https://github.com/amritk/nish/pull/1635))

### Changed

- self: The AST node kinds become a NodeKind enum ([#1508](https://github.com/amritk/nish/pull/1508))

### Documentation

- benchmarks: Record the WP49 stage 6 gate after task recycling ([#1514](https://github.com/amritk/nish/pull/1514))
- runtime: Re-measure the explicit TFB entry against uWS and go-fasthttp after the codec work ([#1519](https://github.com/amritk/nish/pull/1519))
- Keep the docs site still under the pointer and stop its home page jumping on load ([#1529](https://github.com/amritk/nish/pull/1529))
- Write down the CI-runner rule for spawn checks and the c-symbols and NL9007 gates ([#1536](https://github.com/amritk/nish/pull/1536))
- WP34's roadmap page and design note match main ([#1522](https://github.com/amritk/nish/pull/1522))
- Plan WP56, generators whose memory stays flat ([#1561](https://github.com/amritk/nish/pull/1561))
- roadmap: Propose WP57, module-scoped names ([#1562](https://github.com/amritk/nish/pull/1562))
- Hold the hero terminal still while it is hovered or focused ([#1564](https://github.com/amritk/nish/pull/1564))
- Set inline code as a lightly tinted word, not a ringed chip ([#1569](https://github.com/amritk/nish/pull/1569))
- Clean up the docs for the public site ([#1570](https://github.com/amritk/nish/pull/1570))
- Run the hero once and leave the terminal's prompt waiting ([#1565](https://github.com/amritk/nish/pull/1565))
- Put WP34's phase two on its roadmap page ([#1527](https://github.com/amritk/nish/pull/1527))
- WP54, async on wasm with the page as the executor (design only) ([#1528](https://github.com/amritk/nish/pull/1528))
- Make the README a short tour and drop the owner wording ([#1578](https://github.com/amritk/nish/pull/1578))
- Add object graphs in an arena block to WP56 as S5 ([#1586](https://github.com/amritk/nish/pull/1586))
- roadmap: Propose WP59, the wasm arena in a second, unexported memory ([#1577](https://github.com/amritk/nish/pull/1577))
- cli: Document package.json and the capability lockfile from JSON Schemas ([#1599](https://github.com/amritk/nish/pull/1599))
- runtime: Record the JSON tokenizer result ([#1604](https://github.com/amritk/nish/pull/1604))
- checker: Design and measure dynamic dispatch over interfaces (WP60) ([#1587](https://github.com/amritk/nish/pull/1587))
- runtime: Re-measure WP49 stage 6's gate after the hand-off build ([#1608](https://github.com/amritk/nish/pull/1608))
- codegen: Record main's typed-serialize profile and re-measure #1592 ([#1615](https://github.com/amritk/nish/pull/1615))
- Say that a record type is always a declared name ([#1622](https://github.com/amritk/nish/pull/1622))
- checker: Propose WP61, typed JSON constraints and coercion in one pass ([#1623](https://github.com/amritk/nish/pull/1623))
- checker: Propose WP62, Nish classes from a JSON Schema ([#1625](https://github.com/amritk/nish/pull/1625))

### Tests

- Declare the IR that #1511's QuicConnection field moves ([#1521](https://github.com/amritk/nish/pull/1521))
- runtime: Print async_cancel's lines in an order no clock decides ([#1551](https://github.com/amritk/nish/pull/1551))
- runtime: Pin SQLite's sub-second lock-wait backoff in the default build ([#1545](https://github.com/amritk/nish/pull/1545))
- codegen: Pin every panicking acc_* case against --no-elision byte for byte ([#1614](https://github.com/amritk/nish/pull/1614))
- bench: Commit the tree-sum benchmark with a free-function and a method kernel ([#1619](https://github.com/amritk/nish/pull/1619))

### CI

- Reuse the compiler under test across runs and deal the golden cases across shards ([#1524](https://github.com/amritk/nish/pull/1524))
- Deal the small sections before the link programs across the test shards ([#1537](https://github.com/amritk/nish/pull/1537))


## [0.39.0] - 2026-11-13

### Added

- runtime: Add parent/child regions ([#1357](https://github.com/amritk/nish/pull/1357))
- interop: Examples/wasm-arena and the ten-minute Chromium soak ([#1372](https://github.com/amritk/nish/pull/1372))
- checker: Object spread in object literals, lowered to field copies ([#1373](https://github.com/amritk/nish/pull/1373))
- cli: Explain which loops and functions keep their memory (--explain-memory) ([#1375](https://github.com/amritk/nish/pull/1375))
- checker: Refuse the mistakes every type accepts ([#1380](https://github.com/amritk/nish/pull/1380))
- checker: Read a Map or Set reached through a parallelMapInto element ([#1388](https://github.com/amritk/nish/pull/1388))
- runtime: Add spawnPipedWithin, a captured run with a deadline ([#1387](https://github.com/amritk/nish/pull/1387))
- std: Add toFixed and split with a limit to nish/text ([#1396](https://github.com/amritk/nish/pull/1396))
- runtime: Read a file a window at a time with fileOpen, fileReadAt, fileSize and fileClose ([#1397](https://github.com/amritk/nish/pull/1397))
- checker: Typed JSON decodes and encodes tagged unions ([#1400](https://github.com/amritk/nish/pull/1400))
- checker: References to capture-free top-level functions in fields, locals, arrays and returns ([#1404](https://github.com/amritk/nish/pull/1404))
- checker: Attribute dependency diagnostics and refuse hostless builtins on wasm32 ([#1409](https://github.com/amritk/nish/pull/1409))
- crypto: Expose x509 criticality, AKI issuer/serial and AIA to pki ([#1452](https://github.com/amritk/nish/pull/1452))
- net: Secp256r1 key shares and a carrier idle timeout on the TLS server ([#1449](https://github.com/amritk/nish/pull/1449))
- net: QUIC sends datagrams past 1,200 bytes after path MTU discovery ([#1458](https://github.com/amritk/nish/pull/1458))
- cli: The review tier of fix in --json ([#1453](https://github.com/amritk/nish/pull/1453))
- net: Record_size_limit on the TLS server ([#1467](https://github.com/amritk/nish/pull/1467))
- codegen: Declare class as a C struct layout, passed by pointer ([#1455](https://github.com/amritk/nish/pull/1455))
- checker: Function references as arguments, `| null` and `Map` values ([#1428](https://github.com/amritk/nish/pull/1428))
- net: Cleartext HTTP/2 with prior knowledge ([#1461](https://github.com/amritk/nish/pull/1461))
- net: Postgres over TLS in the carrier ([#1446](https://github.com/amritk/nish/pull/1446))
- net: Steer QUIC packets to the owning process ([#1470](https://github.com/amritk/nish/pull/1470))
- codegen: ReadStruct copies a C-owned struct out of a CPtr ([#1471](https://github.com/amritk/nish/pull/1471))
- cli: A bare --compat that accepts nothing, and the erasure invariant that holds it ([#1489](https://github.com/amritk/nish/pull/1489))
- codegen: CErrno, errno zeroed before and saved after a foreign call ([#1443](https://github.com/amritk/nish/pull/1443))

### Fixed

- runtime: Build the SHA-256 and AES stubs when the intrinsic headers are missing ([#1371](https://github.com/amritk/nish/pull/1371))
- std: Nish/regex no longer hangs under Node on a class or alternation ([#1392](https://github.com/amritk/nish/pull/1392))
- checker: A bodiless instance must state its write facts ([#1394](https://github.com/amritk/nish/pull/1394))
- runtime: A held HTTP/1 write keeps the write bit once a flush empties the output ([#1420](https://github.com/amritk/nish/pull/1420))
- runtime: Refuse a granted program's interpreter as a spawn target under --sandbox (SBX-1) ([#1447](https://github.com/amritk/nish/pull/1447))
- net: A lingering close for HTTP/1.1, SETTINGS and idle timeouts for HTTP/2, a session clock for WebTransport ([#1454](https://github.com/amritk/nish/pull/1454))
- runtime: Hold a granted program's descendants to the exec grant ([#1486](https://github.com/amritk/nish/pull/1486))

### Performance

- bench: Measure the async TFB entry against the explicit one on plaintext, json and db ([#1367](https://github.com/amritk/nish/pull/1367))
- net: Serve answers pipelined requests in one write ([#1378](https://github.com/amritk/nish/pull/1378))
- net: The async Postgres pool pipelines queries across tasks ([#1379](https://github.com/amritk/nish/pull/1379))
- bench: The async TFB entry measured against the explicit one after the serve and pool fixes ([#1399](https://github.com/amritk/nish/pull/1399))
- runtime: Close the async serve gap on plaintext and json ([#1421](https://github.com/amritk/nish/pull/1421))
- net: Close the async Postgres pool gap on /db ([#1419](https://github.com/amritk/nish/pull/1419))
- net: Copy QUIC stream bytes by slice, not by byte ([#1445](https://github.com/amritk/nish/pull/1445))
- net: Serve the TechEmpower json and plaintext entry on every core ([#1448](https://github.com/amritk/nish/pull/1448))
- runtime: Ship the SSSE3 and NEON Adler-32 kernels ([#1451](https://github.com/amritk/nish/pull/1451))
- runtime: Trim the async request path's instructions per request ([#1459](https://github.com/amritk/nish/pull/1459))
- net: Parse an HTTP/1 request head a vector at a time ([#1460](https://github.com/amritk/nish/pull/1460))
- crypto: A safegcd field inversion and a windowed verify for P-256 ([#1469](https://github.com/amritk/nish/pull/1469))
- net: A whole answer drives its connection once ([#1492](https://github.com/amritk/nish/pull/1492))
- runtime: Recycle a finished task's frame and region instead of freeing them ([#1493](https://github.com/amritk/nish/pull/1493))
- net: Build a repeated HTTP/1 response head once per Date tick ([#1457](https://github.com/amritk/nish/pull/1457))
- codegen: Prove vector loads and stores in range and tag them as element data ([#1480](https://github.com/amritk/nish/pull/1480))

### Documentation

- site: The hero unpacks the name into Native Instruction Static Host ([#1369](https://github.com/amritk/nish/pull/1369))
- runtime: One doc source for nish:secret and nish:region, and the platform facts back in LANGUAGE.md ([#1370](https://github.com/amritk/nish/pull/1370))
- roadmap: Publish the roadmap, one page per work package ([#1376](https://github.com/amritk/nish/pull/1376))
- WP51, references to capture-free top-level functions, measured (design only) ([#1351](https://github.com/amritk/nish/pull/1351))
- security: Record why Http3Server.slotAt builds slots 0..k ([#1385](https://github.com/amritk/nish/pull/1385))
- wp46: Give the safe reset and opt-in Rc the regions section's depth ([#1386](https://github.com/amritk/nish/pull/1386))
- Renumber Fast rebuilds for nish run from WP48 to WP52 ([#1393](https://github.com/amritk/nish/pull/1393))
- Show code in page titles, add a changelog RSS feed and a writing-nish agent skill ([#1395](https://github.com/amritk/nish/pull/1395))
- Accept WP48's recommendation and make the lean sibling layout the port convention ([#1398](https://github.com/amritk/nish/pull/1398))
- runtime: Stream a file through an HTTP/1.1 example with flat memory ([#1403](https://github.com/amritk/nish/pull/1403))
- Renumber Buffers and handles across declare function from WP40 to WP53 ([#1413](https://github.com/amritk/nish/pull/1413))
- runtime: Profile the async TFB entry against the explicit one on plaintext, json and db ([#1410](https://github.com/amritk/nish/pull/1410))
- Disable the Ask AI agent on the docs site ([#1424](https://github.com/amritk/nish/pull/1424))
- Print a negative http1-e2e saving as a cost, and name the baseline compiler ([#1427](https://github.com/amritk/nish/pull/1427))
- runtime: Profile the explicit TFB entry against uWS and go-fasthttp on plaintext and json ([#1436](https://github.com/amritk/nish/pull/1436))
- Compile the modules guide's multi-file examples, and split the P-256/P-384 module docs ([#1434](https://github.com/amritk/nish/pull/1434))
- Design note for one handler across HTTP/1.1, 2 and 3 ([#1438](https://github.com/amritk/nish/pull/1438))
- Design note for QUIC on more than one core ([#1439](https://github.com/amritk/nish/pull/1439))
- bench: HTTP/2 and HTTP/3 figures from the h2load harness ([#1462](https://github.com/amritk/nish/pull/1462))
- runtime: Re-measure WP49 stage 6's gate after the serve and pool fixes ([#1465](https://github.com/amritk/nish/pull/1465))
- bench: WP28 spike S5 — the price of --number-mode f64 on the benchmark suite ([#1484](https://github.com/amritk/nish/pull/1484))
- bench: WP28 spike S2 — async by contagion, counted on real TypeScript ([#1481](https://github.com/amritk/nish/pull/1481))
- bench: WP28 spike S6 — try/catch by landing pads against a Result desugaring ([#1482](https://github.com/amritk/nish/pull/1482))
- cli: Record x86-64-v4 and the AArch64 --cpu levels as measured, not built ([#1432](https://github.com/amritk/nish/pull/1432))
- Tick WP34's finished stages and WP39's G1 and G2 ([#1488](https://github.com/amritk/nish/pull/1488))
- bench: WP28 spike S4 — Promise.all as a fork/join against parallelReduce ([#1490](https://github.com/amritk/nish/pull/1490))

### Tests

- Bind the file_open_errors socket by a relative name ([#1412](https://github.com/amritk/nish/pull/1412))
- sync: Close the ring-in-place bench and test gaps ([#1435](https://github.com/amritk/nish/pull/1435))
- Fix the three intermittent failures in the test shards ([#1450](https://github.com/amritk/nish/pull/1450))
- runtime: The sessions server on regions holds memory flat over 2,000,000 requests ([#1444](https://github.com/amritk/nish/pull/1444))
- net: Curl and Autobahn for HTTP/1.1 and WebSocket, Chrome over HTTP/1.1, in the interop job ([#1437](https://github.com/amritk/nish/pull/1437))
- crypto: Read the ChaCha rounds, the bitsliced AES loops and the X25519 ladder by disassembly ([#1464](https://github.com/amritk/nish/pull/1464))
- net: A TLS handshake through a HelloRetryRequest to secp256r1, to completion ([#1479](https://github.com/amritk/nish/pull/1479))
- net: The interop runner's congestion cases ([#1477](https://github.com/amritk/nish/pull/1477))
- net: Compare one worker against one worker in the TechEmpower gate and re-baseline ([#1483](https://github.com/amritk/nish/pull/1483))
- Pin getrlimit through a declare class against ulimit -Sn / -Hn ([#1504](https://github.com/amritk/nish/pull/1504))

### CI

- interop: Check the WebGPU adapter the arena page was given ([#1442](https://github.com/amritk/nish/pull/1442))
- Shorten the critical path to a green ci.yml ([#1456](https://github.com/amritk/nish/pull/1456))
- Give arm64 apt a fallback mirror and install from cache offline ([#1415](https://github.com/amritk/nish/pull/1415))

## [0.38.0] - 2026-11-10

### Added

- net: Async fetch speaks https and resolves names without blocking ([#1314](https://github.com/amritk/nish/pull/1314))
- interop: Strings cross between a wasm module and its page ([#1309](https://github.com/amritk/nish/pull/1309))
- checker: A spawned task may reach the objects its spawner owns ([#1307](https://github.com/amritk/nish/pull/1307))
- net: Serve, one task and one region per request ([#1322](https://github.com/amritk/nish/pull/1322))
- net: The async Postgres pool ([#1321](https://github.com/amritk/nish/pull/1321))
- net: Cancel a task on hang-up, deadline or shutdown ([#1323](https://github.com/amritk/nish/pull/1323))
- codegen: Std/math.ts transcendentals and fmod, the lowering on freestanding wasm ([#1334](https://github.com/amritk/nish/pull/1334))
- bench: The TechEmpower plaintext and json entry as serve handlers ([#1340](https://github.com/amritk/nish/pull/1340))
- checker: A serve handler reaches its spawner's state and awaits the async Postgres pool ([#1343](https://github.com/amritk/nish/pull/1343))
- bench: The TechEmpower database entry on the async Postgres pool ([#1354](https://github.com/amritk/nish/pull/1354))
- std: Split, asciiUpper, asciiLower, padStart and padEnd in nish/text ([#1361](https://github.com/amritk/nish/pull/1361))
- checker: Array methods map, filter, some, every, findIndex and slice ([#1358](https://github.com/amritk/nish/pull/1358))
- cli: --deterministic, the same float bits on every target ([#1363](https://github.com/amritk/nish/pull/1363))

### Fixed

- bench: Build the C twins with the release hardening flags, and three bench reporting gaps ([#1315](https://github.com/amritk/nish/pull/1315))
- net: A DNS search fallback no longer masks a later NODATA, and resolveHost keeps an answered family at its timeout ([#1304](https://github.com/amritk/nish/pull/1304))
- codegen: Keep a Result made in a loop body and stored in an outer let alive past the pass's arena rewind ([#1308](https://github.com/amritk/nish/pull/1308))
- runtime: Give each awaitAll lane its own region (HF-13) ([#1320](https://github.com/amritk/nish/pull/1320))
- test: Prefork reap race, security index totals, and the nish-cmp declaration rule ([#1332](https://github.com/amritk/nish/pull/1332))
- interop: A wasm-size guard that holds with wasm-opt, and nish/vite's two silent failures ([#1336](https://github.com/amritk/nish/pull/1336))
- interop: Host-module tests, nish.host diagnostics and the HostHandle reference ([#1335](https://github.com/amritk/nish/pull/1335))
- codegen: Two awaitAlls whose lanes return arrays no longer crash the compiler ([#1359](https://github.com/amritk/nish/pull/1359))
- runtime: An explicitly set enc.mss wins over the socket MSS ([#1356](https://github.com/amritk/nish/pull/1356))
- site: A solid phone menu that lists the guide on every page ([#1366](https://github.com/amritk/nish/pull/1366))
- runtime: Refuse a response that carries two Date fields ([#1360](https://github.com/amritk/nish/pull/1360))

### Performance

- codegen: Cache TBAA nodes per module ([#1318](https://github.com/amritk/nish/pull/1318))
- codegen: Cache guard-name shadowing and intern metadata refs ([#1342](https://github.com/amritk/nish/pull/1342))
- codegen: Propagate attribute facts over an index worklist ([#1341](https://github.com/amritk/nish/pull/1341))

### Documentation

- plan: Plan the rest of WP49 stage 5 around what a spawned task may reach ([#1298](https://github.com/amritk/nish/pull/1298))
- Restore what npm test covers in AGENTS.md, repoint the PR template, and reconcile the shard notes ([#1310](https://github.com/amritk/nish/pull/1310))
- runtime: Document Number, parseInt, parseFloat and Date.now in nish.d.ts and close its tag gaps ([#1303](https://github.com/amritk/nish/pull/1303))
- plan: Give async fetch https and a non-blocking name lookup, and isolate awaitAll lanes, in WP49 stage 5 ([#1305](https://github.com/amritk/nish/pull/1305))
- guide: A native string carries arbitrary bytes, and two follow-ups from the docs polish ([#1311](https://github.com/amritk/nish/pull/1311))
- net: Qualify PgBatcher's flat per-key cost for colliding int keys, and pin it with a test ([#1313](https://github.com/amritk/nish/pull/1313))
- site: The new Nish mark, a gradient canvas, motion and an animated landing hero ([#1345](https://github.com/amritk/nish/pull/1345))
- site: Make the landing page a home page ([#1355](https://github.com/amritk/nish/pull/1355))
- runtime: One @param per lane on the nish:simd constructors ([#1365](https://github.com/amritk/nish/pull/1365))

### Tests

- std: Specify nish/hex and freeze its contract before the code ([#1288](https://github.com/amritk/nish/pull/1288))
- net: Close the Unix-socket acceptance gaps — fd leaks, a two-process exchange, and seqpacket rows ([#1302](https://github.com/amritk/nish/pull/1302))
- interop: Pin --deny ffi on a string-returning foreign call, and fix three stale FFI lines ([#1312](https://github.com/amritk/nish/pull/1312))
- net: Pin the TLS client's data exchange and close_notify per suite and group against openssl s_server ([#1301](https://github.com/amritk/nish/pull/1301))
- self: Refuse a nish-cmp declaration that names no program, file or undo ([#1319](https://github.com/amritk/nish/pull/1319))
- Pin isIntegral's spellings against Node, the WebTransport rebind's new address, and the rounding edges ([#1317](https://github.com/amritk/nish/pull/1317))
- net: Bound the relay soak's waves by the clock, not by turns of the loop ([#1364](https://github.com/amritk/nish/pull/1364))

### Build

- Regenerate package-lock.json for v0.37.0 ([#1316](https://github.com/amritk/nish/pull/1316))
- release: Pin the platform packages at pack time, not in package.json ([#1329](https://github.com/amritk/nish/pull/1329))

### CI

- Run nish-cmp's compiles in parallel and give its job 30 minutes ([#1306](https://github.com/amritk/nish/pull/1306))
- Fuzz the smoke's targets one per core ([#1344](https://github.com/amritk/nish/pull/1344))

## [0.37.0] - 2026-11-08

### Added

- runtime: The async executor and nish:async readable, writable and sleep ([#1283](https://github.com/amritk/nish/pull/1283))
- cli: Colour diagnostics on a terminal ([#1290](https://github.com/amritk/nish/pull/1290))
- net: Async fetch in nish/net/fetch ([#1293](https://github.com/amritk/nish/pull/1293))
- interop: Module storage, buffer windows and panics a wasm page can read ([#1273](https://github.com/amritk/nish/pull/1273))

### Fixed

- docs: Language index cards and pinned citations after the reference split ([#1294](https://github.com/amritk/nish/pull/1294))

### Performance

- net: Scan HTTP/1 request heads sixteen bytes at a time ([#1287](https://github.com/amritk/nish/pull/1287))

### Documentation

- reference: Generate the diagnostic index and the command-line reference ([#1274](https://github.com/amritk/nish/pull/1274))
- plan: Plan WP49 stage 5 and bring the WP49 plan statuses up to date ([#1279](https://github.com/amritk/nish/pull/1279))
- std: Document or internalise std/net's undocumented public fields ([#1281](https://github.com/amritk/nish/pull/1281))
- reference: Polish the generated pages, split diagnostics and the spec, group the sidebar ([#1292](https://github.com/amritk/nish/pull/1292))
- guide: Fix the hand-written pages' layout on the rendered site ([#1289](https://github.com/amritk/nish/pull/1289))
- site: The Nish logo and a theme built around it ([#1291](https://github.com/amritk/nish/pull/1291))

### Tests

- net: Measure Http1Server CPU per request end to end, 0.34.1 vs 0.35.0 ([#1282](https://github.com/amritk/nish/pull/1282))

### Build

- Regenerate package-lock.json for v0.36.0 ([#1271](https://github.com/amritk/nish/pull/1271))
- docs: Fail gen-reference --check on an undocumented public declaration ([#1280](https://github.com/amritk/nish/pull/1280))
- Let a spec-first module's emitted test sit in test/spec/ ([#1285](https://github.com/amritk/nish/pull/1285))

## [0.36.0] - 2026-11-07

### Added

- interop: Link a wasm module for a page and load it without fetch ([#1243](https://github.com/amritk/nish/pull/1243))
- interop: Import a wasm module's host functions from the page's TypeScript ([#1264](https://github.com/amritk/nish/pull/1264))

### Performance

- runtime: Benchmark a consumer-only in-place ring mode ([#1237](https://github.com/amritk/nish/pull/1237))

### Documentation

- std: Mark regex internals private and document its API ([#1240](https://github.com/amritk/nish/pull/1240))
- std: Mark http client internals private and document its API ([#1246](https://github.com/amritk/nish/pull/1246))
- std: Mark http server internals private and document its API ([#1248](https://github.com/amritk/nish/pull/1248))
- runtime: Document the global builtins in nish.d.ts ([#1245](https://github.com/amritk/nish/pull/1245))
- std: Mark json internals private and document its API ([#1247](https://github.com/amritk/nish/pull/1247))
- crypto: Recommend one bcrypt batcher per process on several cores ([#1256](https://github.com/amritk/nish/pull/1256))
- std: Mark quic internals private and document its API ([#1251](https://github.com/amritk/nish/pull/1251))
- std: Mark tls internals private and document its API ([#1253](https://github.com/amritk/nish/pull/1253))
- std: Mark postgres, dns and sqlite internals private and document their API ([#1255](https://github.com/amritk/nish/pull/1255))
- std: Mark elliptic-curve crypto internals private and document their API ([#1258](https://github.com/amritk/nish/pull/1258))
- std: Mark yaml and term internals private and document their API ([#1260](https://github.com/amritk/nish/pull/1260))
- std: Mark http2 and http3 internals private and document their API ([#1261](https://github.com/amritk/nish/pull/1261))
- std: Mark symmetric crypto and hash internals private and document their API ([#1263](https://github.com/amritk/nish/pull/1263))
- std: Mark pki, x509, rsa and jwt internals private and document their API ([#1262](https://github.com/amritk/nish/pull/1262))
- Generate the library reference from source ([#1242](https://github.com/amritk/nish/pull/1242))
- runtime: Document the nish: modules in JSDoc on nish.d.ts ([#1244](https://github.com/amritk/nish/pull/1244))
- std: Mark core std internals private and document their API ([#1265](https://github.com/amritk/nish/pull/1265))
- std: Close the std API-visibility acceptance gaps ([#1268](https://github.com/amritk/nish/pull/1268))

### Tests

- runtime: Echo WebTransport streams after the client's address changes ([#1239](https://github.com/amritk/nish/pull/1239))

### Build

- Regenerate package-lock.json for v0.35.0 ([#1241](https://github.com/amritk/nish/pull/1241))

## [0.35.0] - 2026-11-07

### Added

- checker: Async and await, the checker ([#1160](https://github.com/amritk/nish/pull/1160))
- checker: Run an entry module's top-level code as `main` ([#1203](https://github.com/amritk/nish/pull/1203))
- codegen: Lower async functions to frame state machines ([#1202](https://github.com/amritk/nish/pull/1202))
- checker: Allow null as the default of a nullable parameter ([#1205](https://github.com/amritk/nish/pull/1205))
- interop: Let a PgBatcher skip the ordinal sort ([#1207](https://github.com/amritk/nish/pull/1207))
- interop: Emit async functions as TypeScript async/await ([#1212](https://github.com/amritk/nish/pull/1212))
- runtime: Shared-region windows and a two-buffer netWrite ([#1214](https://github.com/amritk/nish/pull/1214))
- runtime: Follow a QUIC peer's address change with path validation ([#1218](https://github.com/amritk/nish/pull/1218))
- runtime: Send an Http1Connection body from a caller's buffer ([#1223](https://github.com/amritk/nish/pull/1223))
- runtime: Reserve, commit, peek and release on SpscRing ([#1224](https://github.com/amritk/nish/pull/1224))

### Fixed

- runtime: Let Http1Connection.sendBody take a readonly u8[] ([#1227](https://github.com/amritk/nish/pull/1227))

### Performance

- codegen: Read an arrow's captures as arguments to it ([#1215](https://github.com/amritk/nish/pull/1215))
- net: Fewer cache misses per request on cold Http1Server keep-alive connections ([#1211](https://github.com/amritk/nish/pull/1211))
- runtime: Benchmark ring records copied versus in place ([#1229](https://github.com/amritk/nish/pull/1229))

### Documentation

- Bring the docs up to date with captures, async, top-level code and defaults ([#1216](https://github.com/amritk/nish/pull/1216))
- Add WP50, a WebAssembly module a TypeScript page drives ([#1213](https://github.com/amritk/nish/pull/1213))
- Show every guide section in the Scalar sidebar ([#1220](https://github.com/amritk/nish/pull/1220))
- runtime: Complete the SpscRing in-place notes ([#1228](https://github.com/amritk/nish/pull/1228))
- Publish the install, library and security pages on the docs site ([#1222](https://github.com/amritk/nish/pull/1222))

### Tests

- cli: Bound the wide-tree parse by a same-process ratio, and show stdout when a runner case exits wrong ([#1198](https://github.com/amritk/nish/pull/1198))
- interop: Fix the std_dns port collision, postgres-live's ready line and a stale emit-ts row ([#1217](https://github.com/amritk/nish/pull/1217))

### Build

- Regenerate package-lock.json for v0.34.1 ([#1197](https://github.com/amritk/nish/pull/1197))

### CI

- self: Deal the suite's tail eight ways to keep each shard near ten minutes ([#1200](https://github.com/amritk/nish/pull/1200))

## [0.34.1] - 2026-11-04

### Performance

- crypto: Take bcrypt's lane bytes as low-and-second-byte pairs ([#1190](https://github.com/amritk/nish/pull/1190))
- net: Write the HTTP/1.1 response head with sixteen-byte stores ([#1187](https://github.com/amritk/nish/pull/1187))
- crypto: Decode base64url four characters a step ([#1188](https://github.com/amritk/nish/pull/1188))
- net: Read Postgres int8 columns with one load and a byte swap ([#1191](https://github.com/amritk/nish/pull/1191))
- codegen: Store one-byte parts of a join instead of calling memcpy ([#1192](https://github.com/amritk/nish/pull/1192))
- net: Lowercase and token-check HTTP/1.1 field names sixteen bytes at a time ([#1193](https://github.com/amritk/nish/pull/1193))
- codegen: Box fresh array fields of unknown length as { len, data } ([#1189](https://github.com/amritk/nish/pull/1189))
- net: Write Postgres integer parameters' digits once, two a step ([#1194](https://github.com/amritk/nish/pull/1194))

### Documentation

- runtime: SHA-256 AVX2 message schedule — measured, not built ([#1186](https://github.com/amritk/nish/pull/1186))

### Tests

- self: Measure S3's bar with nish:simd on mat-vec and both depth documents ([#1182](https://github.com/amritk/nish/pull/1182))

### Build

- Regenerate package-lock.json for v0.34.0 ([#1184](https://github.com/amritk/nish/pull/1184))

## [0.34.0] - 2026-11-04

### Added

- checker: Add nish:simd lane operations, masks and constant-count shifts and rotates ([#1171](https://github.com/amritk/nish/pull/1171))

### Fixed

- net: Pin and baseline the Http1Connection benchmark ([#1178](https://github.com/amritk/nish/pull/1178))

### Performance

- net: Keep Http1Connection's per-request path on hot fields ([#1176](https://github.com/amritk/nish/pull/1176))
- net: Scan HTTP/1.1 request heads a vector at a time ([#1179](https://github.com/amritk/nish/pull/1179))
- runtime: ChaCha20 keystream on AVX2 and NEON behind a CPU check ([#1181](https://github.com/amritk/nish/pull/1181))

### Tests

- self: Measure SHA-256's block function against OpenSSL and hold HMAC to it under both NISH_SHA256 settings ([#1174](https://github.com/amritk/nish/pull/1174))

### Build

- Regenerate package-lock.json for v0.33.0 ([#1170](https://github.com/amritk/nish/pull/1170))

## [0.33.0] - 2026-11-03

### Added

- interop: Nish/crypto/bcrypt-batch, a login batcher across cores ([#1168](https://github.com/amritk/nish/pull/1168))

### Documentation

- Drop the self-hosted and GC badges from the README ([#1166](https://github.com/amritk/nish/pull/1166))

### Build

- Regenerate package-lock.json for v0.32.0 ([#1167](https://github.com/amritk/nish/pull/1167))

## [0.32.0] - 2026-11-03

### Added

- checker: Array sort with a comparator ([#1108](https://github.com/amritk/nish/pull/1108))

### Performance

- crypto: Bcrypt batch kernels take two index bytes from one copy ([#1164](https://github.com/amritk/nish/pull/1164))

### Build

- Regenerate package-lock.json for v0.31.0 ([#1163](https://github.com/amritk/nish/pull/1163))

### CI

- Fetch apt packages from mirrors other than Azure's, and cache every install ([#1162](https://github.com/amritk/nish/pull/1162))

## [0.31.0] - 2026-11-02

### Breaking changes

- net: Name the HTTP clients fetchSync and the codecs http1-codec ([#1154](https://github.com/amritk/nish/pull/1154))

### Added

- interop: Binary int4[] and int8[] parameters for nish/net/postgres ([#1150](https://github.com/amritk/nish/pull/1150))
- checker: Nish:region, regions in the language ([#1152](https://github.com/amritk/nish/pull/1152))
- interop: Every TechEmpower test type on the Postgres carrier ([#1157](https://github.com/amritk/nish/pull/1157))
- interop: PgBatchConfig.maxRequests up to 65536 ([#1158](https://github.com/amritk/nish/pull/1158))
- runtime: Pin prefork workers to cores and steer connections by incoming CPU ([#1159](https://github.com/amritk/nish/pull/1159))

### Fixed

- cli: Create the runtime cache's scratch names exclusively, so concurrent links never share one ([#1155](https://github.com/amritk/nish/pull/1155))

### Documentation

- crypto: Bcrypt BMI2 kernel — measured, not built ([#1151](https://github.com/amritk/nish/pull/1151))

### Build

- Regenerate package-lock.json for v0.30.0 ([#1147](https://github.com/amritk/nish/pull/1147))
- ci: Read release.yml's std presence lists from src/std-modules.ts ([#1156](https://github.com/amritk/nish/pull/1156))

## [0.30.0] - 2026-11-02

### Added

- interop: Connect nish/net/postgres through a Unix socket ([#1111](https://github.com/amritk/nish/pull/1111))
- interop: PgCarrier, Postgres queries on the handler's loop ([#1145](https://github.com/amritk/nish/pull/1145))
- runtime: Regions in the runtime ([#1142](https://github.com/amritk/nish/pull/1142))
- interop: Nish/net/upstream, non-blocking outbound HTTP on the handler's loop ([#1143](https://github.com/amritk/nish/pull/1143))

### Fixed

- codegen: Load a nish:simd vector from an array whose header a loop hoisted ([#1144](https://github.com/amritk/nish/pull/1144))

### Performance

- checker: Linear-time declaration lookup, metadata interning and union narrowing ([#1136](https://github.com/amritk/nish/pull/1136))
- net: Parse and answer HTTP/1.1 requests in a third fewer instructions ([#1139](https://github.com/amritk/nish/pull/1139))
- net: Read the clock once per serve call for the Date field ([#1146](https://github.com/amritk/nish/pull/1146))

### Tests

- cli: Time nish break's scripted keys by the clock, not by frames ([#1140](https://github.com/amritk/nish/pull/1140))

### Build

- Regenerate package-lock.json for v0.29.0 ([#1138](https://github.com/amritk/nish/pull/1138))

## [0.29.0] - 2026-10-31

### Breaking changes

- checker: Capability grants with arguments, and fs gated for dependencies ([#1122](https://github.com/amritk/nish/pull/1122))

### Added

- net: Read a connected socket's MSS from nish:net ([#1096](https://github.com/amritk/nish/pull/1096))
- runtime: Start the adaptive frame rate at the best tier on a local terminal ([#1100](https://github.com/amritk/nish/pull/1100))
- net: Http1Server reads each connection's MSS from the socket ([#1103](https://github.com/amritk/nish/pull/1103))
- runtime: Unix stream sockets and socketpair in nish:net ([#1093](https://github.com/amritk/nish/pull/1093))
- runtime: A stack size for scope tasks, with scopeWithStack ([#1102](https://github.com/amritk/nish/pull/1102))
- runtime: Hand, pass and identify descriptors over Unix sockets ([#1112](https://github.com/amritk/nish/pull/1112))
- checker: Arrows passed to function parameters may read the caller's const locals ([#1115](https://github.com/amritk/nish/pull/1115))
- cli: Keep nish break's settings between runs ([#1105](https://github.com/amritk/nish/pull/1105))
- checker: Labelled break/continue and switch fallthrough ([#1106](https://github.com/amritk/nish/pull/1106))
- runtime: Share memory and hand work between processes ([#1121](https://github.com/amritk/nish/pull/1121))
- interop: Supervisor and service channels in nish/net/prefork ([#1119](https://github.com/amritk/nish/pull/1119))
- checker: Typed JSON decode reports which fields were present ([#1125](https://github.com/amritk/nish/pull/1125))
- interop: Nish/net/handler, a request and response layer over the HTTP/1 carrier ([#1123](https://github.com/amritk/nish/pull/1123))
- interop: Nish/crypto/jwt, compact JWS verify and sign with claims checks ([#1134](https://github.com/amritk/nish/pull/1134))
- cli: Nish run --watch rebuilds and swaps the running program ([#1131](https://github.com/amritk/nish/pull/1131))
- interop: An outbound policy for the HTTP client ([#1135](https://github.com/amritk/nish/pull/1135))
- checker: Default parameters and rest parameters ([#1133](https://github.com/amritk/nish/pull/1133))

### Fixed

- runtime: Refuse peerCredentials without a peer, and correct the descriptor-passing docs and records ([#1116](https://github.com/amritk/nish/pull/1116))
- runtime: Keyed integer Map hashes, and a composite-key idiom ([#1107](https://github.com/amritk/nish/pull/1107))

### Performance

- net: Skip gzip when the response already fits one segment ([#1097](https://github.com/amritk/nish/pull/1097))
- runtime: Measure Unix sockets against loopback TCP ([#1117](https://github.com/amritk/nish/pull/1117))
- runtime: Shortest digits from Żmij, written two at a time ([#1124](https://github.com/amritk/nish/pull/1124))
- cli: Fast rebuilds for nish run ([#1126](https://github.com/amritk/nish/pull/1126))
- checker: Compile unions of 200+ variants 5-17% faster ([#1127](https://github.com/amritk/nish/pull/1127))
- runtime: JsonWriter writes an f64 without building a string ([#1128](https://github.com/amritk/nish/pull/1128))

### Documentation

- Compressed 32-bit references, designed and measured ([#1113](https://github.com/amritk/nish/pull/1113))

### Build

- Regenerate package-lock.json for v0.28.0 ([#1099](https://github.com/amritk/nish/pull/1099))

### CI

- Wait half an hour for the registry before giving up on the lockfile ([#1110](https://github.com/amritk/nish/pull/1110))

## [0.28.0] - 2026-10-30

### Added

- runtime: Record each value's source range in JsonDocument with parseRanged ([#1051](https://github.com/amritk/nish/pull/1051))
- runtime: Client side of the WebSocket opening handshake ([#1067](https://github.com/amritk/nish/pull/1067))
- std: JSON Pointer, value equality and exact decimals for JSON Schema ([#1054](https://github.com/amritk/nish/pull/1054))
- std: The JSON Schema format checks ([#1052](https://github.com/amritk/nish/pull/1052))
- std: Load a YAML document into a JsonDocument with its source ranges ([#1072](https://github.com/amritk/nish/pull/1072))
- cli: --sandbox confines a native program to main's capability set ([#912](https://github.com/amritk/nish/pull/912))
- std: Unicode property escapes and case folding in nish/regex ([#1053](https://github.com/amritk/nish/pull/1053))
- checker: Nish:simd's vector types, with load, store, splat and lanes ([#1068](https://github.com/amritk/nish/pull/1068))
- runtime: Add PgBatchClock, an adaptive batch timer for nish/net/postgres ([#1090](https://github.com/amritk/nish/pull/1090))
- cli: Fs.read= and fs.write= scopes under --sandbox ([#1080](https://github.com/amritk/nish/pull/1080))
- net: Compression that pays for itself in nish/net/http-compress ([#1095](https://github.com/amritk/nish/pull/1095))

### Performance

- runtime: CRC-32 on PCLMULQDQ and the ARMv8 CRC32 instructions ([#1062](https://github.com/amritk/nish/pull/1062))
- crypto: Keep P off bcrypt's critical path in the single-hash rounds ([#1083](https://github.com/amritk/nish/pull/1083))
- crypto: SHA-256 on SHA-NI and the ARMv8 Cryptography Extension ([#1055](https://github.com/amritk/nish/pull/1055))
- runtime: Measure syscall entry cost against TCP work per request ([#1085](https://github.com/amritk/nish/pull/1085))
- runtime: Measure the cheaper ways to keep delayed ACKs ([#1088](https://github.com/amritk/nish/pull/1088))
- crypto: Bcrypt at any width from one to six lanes, and a calibrate that picks it ([#1091](https://github.com/amritk/nish/pull/1091))

### Documentation

- wp38: Record S3's decision and surface, and close the open WP38 housekeeping ([#1065](https://github.com/amritk/nish/pull/1065))
- runtime: A measured verdict on SSSE3 and NEON Adler-32 ([#1078](https://github.com/amritk/nish/pull/1078))
- Check a new type kind at every nesting depth ([#1081](https://github.com/amritk/nish/pull/1081))

### Build

- Regenerate package-lock.json for v0.27.2 ([#1075](https://github.com/amritk/nish/pull/1075))
- Let a commit keep itself, or others, out of the changelog ([#1063](https://github.com/amritk/nish/pull/1063))

### CI

- self: Run the Nish golden runner's slices in parallel itself ([#1076](https://github.com/amritk/nish/pull/1076))

## [0.27.2] - 2026-10-30

### Fixed

- cli: Revert the lagging platform pins that blocked 0.27.0 and 0.27.1 ([#1073](https://github.com/amritk/nish/pull/1073))

## [0.27.1] - 2026-10-30

### Fixed

- cli: Install the main package with its pins stamped, as release.yml publishes it ([#1070](https://github.com/amritk/nish/pull/1070))

### Tests

- self: Keep package modules in the program's own golden ([#1060](https://github.com/amritk/nish/pull/1060))

## [0.27.0] - 2026-10-30

### Added

- stdlib: HttpFetch, a blocking HTTP/1.1 client for CLIs ([#1032](https://github.com/amritk/nish/pull/1032))
- net: Read PgBatcher rows and int arrays in binary ([#1046](https://github.com/amritk/nish/pull/1046))

### Fixed

- runtime: SetNice refuses a raise and values outside 0..19 ([`3db5a5d`](https://github.com/amritk/nish/commit/3db5a5d))

### Performance

- codegen: Round on SSE4.1 when the CPU has it ([#960](https://github.com/amritk/nish/pull/960))
- crypto: Tune the portable SHA-256 path ([#1050](https://github.com/amritk/nish/pull/1050))
- self: Link the Nish runner's programs under the suite's profile, in three shards ([#1061](https://github.com/amritk/nish/pull/1061))

### Build

- Regenerate package-lock.json for v0.26.0 ([#1038](https://github.com/amritk/nish/pull/1038))

### CI

- Keep main's platform pins one release behind so every commit agrees with its lockfile ([#1039](https://github.com/amritk/nish/pull/1039))

## [0.26.0] - 2026-10-29

### Added

- runtime: Files and directories with an explicit mode, and exclusive create, in nish:fs ([#1020](https://github.com/amritk/nish/pull/1020))
- runtime: SpawnPiped runs a child with stdin from memory and stdout/stderr captured ([#1025](https://github.com/amritk/nish/pull/1025))
- runtime: A packing dispatch policy for nish/net/postgres's PgPool ([#1036](https://github.com/amritk/nish/pull/1036))
- runtime: Binary result columns for nish/net/postgres ([#1037](https://github.com/amritk/nish/pull/1037))

### Build

- Regenerate package-lock.json for v0.25.0 ([#1035](https://github.com/amritk/nish/pull/1035))
- deps: Bump github.com/klauspost/compress ([#1021](https://github.com/amritk/nish/pull/1021))

## [0.25.0] - 2026-10-29

### Added

- runtime: SetNice and setIdlePriority in nish:process ([#985](https://github.com/amritk/nish/pull/985))
- crypto: ECDSA verification over P-384 ([#1009](https://github.com/amritk/nish/pull/1009))
- crypto: Load trust anchors from SSL_CERT_FILE, SSL_CERT_DIR and the system bundles ([#998](https://github.com/amritk/nish/pull/998))
- runtime: RenameSync, unlinkSync and u8[] output in nish:fs and nish:io ([#1016](https://github.com/amritk/nish/pull/1016))
- cli: ANSI colours and recolourable help roles on Style ([#1001](https://github.com/amritk/nish/pull/1001))
- net: DNS message codec and resolv.conf / hosts parsers ([#1007](https://github.com/amritk/nish/pull/1007))
- std: Write a JSON value as YAML (nish/yaml-write) ([#1000](https://github.com/amritk/nish/pull/1000))
- stdlib: Parse absolute URLs and resolve references in nish/net/url ([#1017](https://github.com/amritk/nish/pull/1017))
- runtime: NetSetOption with a whitelist of socket options ([#1014](https://github.com/amritk/nish/pull/1014))
- std: Parse command-line flags from a declared table (nish/cli-flags) ([#1002](https://github.com/amritk/nish/pull/1002))
- crypto: Read X.509 v3 extensions, names and every signature algorithm a Web PKI chain uses ([#1011](https://github.com/amritk/nish/pull/1011))
- runtime: A wall clock in nish:process ([#1004](https://github.com/amritk/nish/pull/1004))
- net: Nish/net/dns, a stub resolver on the caller's loop ([#1019](https://github.com/amritk/nish/pull/1019))
- cli: Nish/cli-args, a command-tree parser for large CLIs ([#1003](https://github.com/amritk/nish/pull/1003))
- crypto: RSA signature verification, PKCS#1 v1.5 and PSS ([#1006](https://github.com/amritk/nish/pull/1006))
- net: The sans-IO TLS 1.3 client handshake and record layer ([#1018](https://github.com/amritk/nish/pull/1018))
- crypto: RFC 5280 path validation and RFC 6125 hostname matching for TLS servers ([#1027](https://github.com/amritk/nish/pull/1027))
- stdlib: Sans-IO HTTP/1.1 request writer and response parser ([#1013](https://github.com/amritk/nish/pull/1013))
- net: The TLS client over TCP, server authentication and a blocking connect ([#1029](https://github.com/amritk/nish/pull/1029))

### Fixed

- runtime: Linger after a TLS close so a client never sees a reset ([#996](https://github.com/amritk/nish/pull/996))

### Performance

- compress: Faster gunzip, gzip and CRC-32, and two fixes from #984's review ([#1010](https://github.com/amritk/nish/pull/1010))

### Documentation

- Plan WebSocket client opening handshake ([#1015](https://github.com/amritk/nish/pull/1015))

### Tests

- crypto: Run the x509-limbo server-authentication cases against nish/crypto/pki ([#1030](https://github.com/amritk/nish/pull/1030))

### Build

- Regenerate package-lock.json for v0.24.0 ([#999](https://github.com/amritk/nish/pull/999))
- cli: Link ELF binaries with a GNU build-id note ([#997](https://github.com/amritk/nish/pull/997))

### CI

- Deal the slow sections across the test shards and run the Nish runner on every core ([#1026](https://github.com/amritk/nish/pull/1026))

## [0.24.0] - 2026-10-28

### Breaking changes

- checker: Remove Arena.release, Arena.reset, --wrapping and --unchecked-indexing ([#983](https://github.com/amritk/nish/pull/983))

### Added

- compress: Add gzip, zlib and DEFLATE, and gzip HTTP responses ([#984](https://github.com/amritk/nish/pull/984))

### Fixed

- interop: Keep the simulator's last packets in the runner's pcaps ([#979](https://github.com/amritk/nish/pull/979))

### Build

- Regenerate package-lock.json for v0.23.1 ([#981](https://github.com/amritk/nish/pull/981))

## [0.23.1] - 2026-10-28

### Fixed

- std: An idle keep-alive no longer makes every http1 expire walk every slot ([#978](https://github.com/amritk/nish/pull/978))

### Documentation

- Bring the README up to date with the language ([#976](https://github.com/amritk/nish/pull/976))
- bench: Record where nish/net/postgres's client time goes ([#974](https://github.com/amritk/nish/pull/974))

### Build

- Regenerate package-lock.json for v0.23.0 ([#975](https://github.com/amritk/nish/pull/975))

## [0.23.0] - 2026-10-27

### Added

- runtime: Int8[] and incremental text[] parameters for nish/net/postgres ([#972](https://github.com/amritk/nish/pull/972))
- runtime: A sans-IO batching helper for nish/net/postgres ([#973](https://github.com/amritk/nish/pull/973))

### Fixed

- bench: Pin the Conduit submission to nish 0.22.1 ([#968](https://github.com/amritk/nish/pull/968))

### Build

- Regenerate package-lock.json for v0.22.1 ([#967](https://github.com/amritk/nish/pull/967))

### Internal

- bench: Remove the multicore Conduit server, now kept in the challenge fork ([#970](https://github.com/amritk/nish/pull/970))

## [0.22.1] - 2026-10-26

### Fixed

- cli: Ask no attestation of 0.21.0, and drop unpublished pins from the lockfile ([#964](https://github.com/amritk/nish/pull/964))

### Performance

- bench: Coalesce the Conduit server's same-shape reads into one array-parameter statement ([#963](https://github.com/amritk/nish/pull/963))

## [0.22.0] - 2026-10-25

### Added

- cli: Close the --emit-ts oracle: tsc --strict, the known-list pin, fuzz, and the docs ([#917](https://github.com/amritk/nish/pull/917))
- runtime: A connection pool and an epoll carrier for nish/net/postgres ([#929](https://github.com/amritk/nish/pull/929))
- codegen: Harden every native binary the toolchain links ([#916](https://github.com/amritk/nish/pull/916))
- std: Rng.nextInt answers an unbiased integer in a range ([#939](https://github.com/amritk/nish/pull/939))
- cli: Leave a wall of bricks in the help, and a door behind it ([#940](https://github.com/amritk/nish/pull/940))
- net: A Conduit server for the multicore server challenge ([#961](https://github.com/amritk/nish/pull/961))

### Fixed

- checker: A std/threads task may wipe a Secret it made from a fresh value ([#945](https://github.com/amritk/nish/pull/945))
- crypto: Wipe the hash bcrypt verify recomputes ([#959](https://github.com/amritk/nish/pull/959))

### Performance

- crypto: Hash and verify up to four bcrypt passwords at once, interleaved ([#938](https://github.com/amritk/nish/pull/938))
- runtime: Measure nish/net/postgres against libpq pipeline mode ([#941](https://github.com/amritk/nish/pull/941))

### Documentation

- wp38: S6c's callgrind gate, and the maintainer's Q5 decision ([#935](https://github.com/amritk/nish/pull/935))
- Record two --emit-ts conventions in CLAUDE.md ([#951](https://github.com/amritk/nish/pull/951))
- wp38: S6d, the per-value cuts that would let S6c reach its bar ([#954](https://github.com/amritk/nish/pull/954))
- crypto: Name the bcrypt single-path gap as LLVM's xor order ([#957](https://github.com/amritk/nish/pull/957))

### Tests

- self: Fuzz the bounds-check elision with proofgen programs under ASan ([#924](https://github.com/amritk/nish/pull/924))
- runtime: Say a random hash key miscounts map_fingerprint_miss by one or two ([#934](https://github.com/amritk/nish/pull/934))

### Build

- Regenerate package-lock.json for v0.21.0 ([#936](https://github.com/amritk/nish/pull/936))

### CI

- release: Attest build provenance, attach an SBOM, and rebuild releases from their tags ([#898](https://github.com/amritk/nish/pull/898))

## [0.21.0] - 2026-10-24

### Breaking changes

- checker: Refuse a dependency's unsafe, ffi, net and process.spawn unless the root package grants them ([#905](https://github.com/amritk/nish/pull/905))

### Added

- std: Tell an integer-valued JSON number by its value ([#837](https://github.com/amritk/nish/pull/837))
- std: Add nish/term, terminal frames and key decoding with no I/O ([#846](https://github.com/amritk/nish/pull/846))
- runtime: Publish nish/runtime with a browser adapter and declarations ([#851](https://github.com/amritk/nish/pull/851))
- checker: Check the owned foreign handle class ([#850](https://github.com/amritk/nish/pull/850))
- std: Nish/yaml, a YAML parser with byte ranges, lines and paths ([#852](https://github.com/amritk/nish/pull/852))
- cli: Write a program back out as TypeScript with --emit-ts ([#853](https://github.com/amritk/nish/pull/853))
- std: Add nish/regex, a linear-time regex engine with a lazy DFA ([#858](https://github.com/amritk/nish/pull/858))
- std: Count code points in std/text ([#838](https://github.com/amritk/nish/pull/838))
- std: Nish/yaml paths follow merge keys, held to the yaml-test-suite ([#857](https://github.com/amritk/nish/pull/857))
- cli: Group and colour --help, and keep it plain for agents ([#855](https://github.com/amritk/nish/pull/855))
- cli: Translate the string rows in --emit-ts ([#859](https://github.com/amritk/nish/pull/859))
- runtime: Add nish:term, terminal input for real-time terminal programs ([#854](https://github.com/amritk/nish/pull/854))
- cli: Translate the number rows in --emit-ts ([#866](https://github.com/amritk/nish/pull/866))
- cli: Translate orReturn, Result and enums in --emit-ts ([#864](https://github.com/amritk/nish/pull/864))
- codegen: `using` of a handle class closes it at every exit of its block ([#861](https://github.com/amritk/nish/pull/861))
- std: Byte-class runs and copyBytes in nish/bytes, on runtime kernels ([#862](https://github.com/amritk/nish/pull/862))
- runtime: Add PBKDF2-HMAC-SHA256 to nish/crypto/hmac ([#871](https://github.com/amritk/nish/pull/871))
- codegen: Give Math.round, min and max JavaScript's -0 and NaN, and add atan2, tan, hypot, sign, imul and f32ToBits ([#847](https://github.com/amritk/nish/pull/847))
- runtime: Nish:term setTerminalRestore writes a mode reset on exit, panic and signal ([#876](https://github.com/amritk/nish/pull/876))
- std: One event stream from nish/term's KeyDecoder ([#877](https://github.com/amritk/nish/pull/877))
- std: Add nish/cli, and paint --help in the terminal theme's colours ([#879](https://github.com/amritk/nish/pull/879))
- cli: Vendor SQLite and link it when a program uses it ([#870](https://github.com/amritk/nish/pull/870))
- std: Nish/term-rate chooses the refresh rate a machine and link sustain ([#906](https://github.com/amritk/nish/pull/906))
- cli: Translate the array and record rows in --emit-ts ([#867](https://github.com/amritk/nish/pull/867))
- std: Nish/term-probe detects what a terminal can do ([#903](https://github.com/amritk/nish/pull/903))
- std: Framebuffer and the kitty, Sixel, half-block and ASCII backends ([#911](https://github.com/amritk/nish/pull/911))
- runtime: Add nish/sqlite, a SQLite client ([#878](https://github.com/amritk/nish/pull/878))
- std: Nish/term-io opens a terminal and runs a frame loop that adapts to it ([#920](https://github.com/amritk/nish/pull/920))
- cli: A capability lockfile that fails a build when a dependency reaches a new capability ([#923](https://github.com/amritk/nish/pull/923))
- runtime: Add nish/net/postgres, a sans-IO PostgreSQL client ([#891](https://github.com/amritk/nish/pull/891))
- crypto: Bcrypt hash and verify in nish/crypto/bcrypt ([#884](https://github.com/amritk/nish/pull/884))

### Fixed

- checker: Tie NL8001's loop cursor to the string it counts ([#845](https://github.com/amritk/nish/pull/845))
- checker: Bind a declare function in a package to its bare C symbol ([#869](https://github.com/amritk/nish/pull/869))
- checker: A std/threads task may call a function that wipes memory the task allocated ([#894](https://github.com/amritk/nish/pull/894))
- runtime: Audit regex, term, bytes, PBKDF2 and the browser host ([#904](https://github.com/amritk/nish/pull/904))
- std: A deadline for an HTTP/1 head and HPACK decoding into caller storage (H1-1, H2-1) ([#895](https://github.com/amritk/nish/pull/895))
- runtime: Seed the string hash of every Map and Set (JSON-13) ([#900](https://github.com/amritk/nish/pull/900))
- std: Mark ECT on QUIC datagrams the carriers send (QUIC-10) ([#914](https://github.com/amritk/nish/pull/914))
- std: Nish/term-rate keeps its latency and bandwidth estimates apart on small frames ([#925](https://github.com/amritk/nish/pull/925))

### Performance

- codegen: A foreign call does not resize an array ([#836](https://github.com/amritk/nish/pull/836))
- cli: Link the speed profile in parallel ([#907](https://github.com/amritk/nish/pull/907))
- tests: Link most tests/link programs under a cheaper profile ([#909](https://github.com/amritk/nish/pull/909))
- self: Run the tests/link programs through a worker pool ([#913](https://github.com/amritk/nish/pull/913))
- runtime: Measure nish/sqlite against C on the challenge schema ([#921](https://github.com/amritk/nish/pull/921))
- runtime: A JSON-plain byte class, and JsonWriter's byte writers on it ([#892](https://github.com/amritk/nish/pull/892))

### Changed

- runtime: Split the Node runtime into a host-agnostic core and a Node adapter ([#848](https://github.com/amritk/nish/pull/848))

### Documentation

- Add issue forms that ask for what a fix needs ([#860](https://github.com/amritk/nish/pull/860))
- Make CI's test shards the full-suite gate ([#890](https://github.com/amritk/nish/pull/890))
- security: Bring the audit index in line with the records ([#919](https://github.com/amritk/nish/pull/919))

### Tests

- yaml: Vendor the yaml-test-suite as packed test data ([#849](https://github.com/amritk/nish/pull/849))
- bench: Compare nish/yaml with @amritk/yaml ([#856](https://github.com/amritk/nish/pull/856))
- checker: Pin use after close of a handle and its sibling shapes ([#874](https://github.com/amritk/nish/pull/874))
- security: LibFuzzer harness, sanitizer runtime build, CI fuzz jobs, JSON/URL/regex targets ([#908](https://github.com/amritk/nish/pull/908))
- codegen: An elision-off reference build and a soundness differential ([#897](https://github.com/amritk/nish/pull/897))
- runtime: A proof-shaped program generator and an AddressSanitizer build ([#902](https://github.com/amritk/nish/pull/902))
- std: Nish/term-io pins the restore of mouse and focus, the silent probe and the env overrides ([#928](https://github.com/amritk/nish/pull/928))
- security: Fuzz targets for TLS, QUIC, HPACK, HTTP/1, WebSocket and X.509 ([#910](https://github.com/amritk/nish/pull/910))

### Build

- Regenerate package-lock.json for v0.20.0 ([#835](https://github.com/amritk/nish/pull/835))

### CI

- Seed the interop image from a published release ([#840](https://github.com/amritk/nish/pull/840))
- Split runtime-net three ways and run only the platform's checks on macOS ([#841](https://github.com/amritk/nish/pull/841))
- Cache interop's tshark packages and retry them off the Azure mirror ([#863](https://github.com/amritk/nish/pull/863))
- Disable the macOS jobs ([#865](https://github.com/amritk/nish/pull/865))
- Refuse attacker-facing code that ships without its security record ([#893](https://github.com/amritk/nish/pull/893))

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
- cli: --cpu x86-64-v3 links module and runtime at one CPU level ([#660](https://github.com/amritk/nish/pull/660))
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
- bench: Measure S3's bar kernels without a nish:simd surface ([#658](https://github.com/amritk/nish/pull/658))
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
- Plan the HTTP server beyond the relay, from a TechEmpower entry to every version ([#578](https://github.com/amritk/nish/pull/578))
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
- Design streaming file reads ([#764](https://github.com/amritk/nish/pull/764))
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
- std: Nish/net/quic-packet — QUIC packets, Initial secrets and header protection ([#404](https://github.com/amritk/nish/pull/404))
- cli: Fix export default, export lists, type-only imports and fs imports mechanically ([#429](https://github.com/amritk/nish/pull/429))
- std: Nish/net/hpack — HPACK with Huffman ([#406](https://github.com/amritk/nish/pull/406))
- checker: Record every panic site with its kind, and --emit-panics ([#424](https://github.com/amritk/nish/pull/424))
- checker: Deprecate Arena.release and Arena.reset in favour of using a = arena() ([#428](https://github.com/amritk/nish/pull/428))
- std: Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing ([#399](https://github.com/amritk/nish/pull/399))
- std: Nish/net/tls records over TCP ([#437](https://github.com/amritk/nish/pull/437))
- std: Nish/net/quic — QUIC connections, the handshake and stream data ([#441](https://github.com/amritk/nish/pull/441))
- std: Nish/net/quic — Retry, version negotiation, stateless reset, idle timeout and key update ([#444](https://github.com/amritk/nish/pull/444))
- checker: --deny-panics and noPanic refuse every remaining panic site ([#443](https://github.com/amritk/nish/pull/443))
- checker: Let a nish:unsafe import opt uncheckedGet and uncheckedSet into the no-panic scope ([#455](https://github.com/amritk/nish/pull/455))
- checker: Refuse a program that reaches a capability its policy does not grant ([#452](https://github.com/amritk/nish/pull/452))
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
- runtime: Nish:net with a runtime-net.c unit and non-blocking TCP ([#341](https://github.com/amritk/nish/pull/341))
- std: Bitsliced AES-128 and AES-256 with GCM in nish/crypto/aes ([#340](https://github.com/amritk/nish/pull/340))
- std: P-256 ECDSA with RFC 6979 nonces in nish/crypto/p256 ([#336](https://github.com/amritk/nish/pull/336))
- runtime: Nish:net UDP with GSO, GRO, ECN and SO_REUSEPORT ([#343](https://github.com/amritk/nish/pull/343))
- checker: Refuse forbidden import and export forms by their rule, not NL0001 ([#337](https://github.com/amritk/nish/pull/337))
- std: DER, PEM and X.509, and a self-signed P-256 certificate, in nish/crypto/x509 ([#346](https://github.com/amritk/nish/pull/346))
- runtime: Nish:net readiness loop that wakes on sockets and SIGTERM ([#349](https://github.com/amritk/nish/pull/349))

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
- checker: Byte plumbing — u8[] set and fill, readFileBytesSync ([#295](https://github.com/amritk/nish/pull/295))
- codegen: Constant-time ctSelect and ctEq behind an optimisation barrier ([#310](https://github.com/amritk/nish/pull/310))
- checker: Refuse forbidden expressions by their rule, not NL0001 ([#311](https://github.com/amritk/nish/pull/311))
- checker: Refuse forbidden declarations by their rule, not NL0001 ([#313](https://github.com/amritk/nish/pull/313))
- checker: Refuse forbidden function and binding forms by their rule, not NL0001 ([#314](https://github.com/amritk/nish/pull/314))
- runtime: Date.now, crypto.getRandomValues, statMtimeSync and a signal descriptor ([#312](https://github.com/amritk/nish/pull/312))
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

- checker: Ranged integer types ([#261](https://github.com/amritk/nish/pull/261))
- checker: Threads P2, using s = scope() and s.spawn(fn, arg) ([#262](https://github.com/amritk/nish/pull/262))
- interop: Ranged parameters at the host boundary ([#273](https://github.com/amritk/nish/pull/273))

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

- checker: Prove range entries and index through declared ranges ([#268](https://github.com/amritk/nish/pull/268))

### Changed

- Apply Biome's autofixes ([#252](https://github.com/amritk/nish/pull/252))
- Clear the lint backlog by hand, and make every function an arrow ([#253](https://github.com/amritk/nish/pull/253))
- Format the tree with Biome, without semicolons ([#254](https://github.com/amritk/nish/pull/254))

### Documentation

- Open the README with what the name stands for, and mark stage0's src/ citations ([#250](https://github.com/amritk/nish/pull/250))
- wp31: Record the ranged-integer measurements ([#274](https://github.com/amritk/nish/pull/274))
- Plan the round trip between TypeScript and Nish, at zero native cost ([#276](https://github.com/amritk/nish/pull/276))
- wp34: Plan a network stack in std, starting with a relay ([#277](https://github.com/amritk/nish/pull/277))

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
- plan: Nish stays on 0.x until its maintainer declares 1.0 ([#204](https://github.com/amritk/nish/pull/204))

### Tests

- codes: The registry check counts every fragment line, and wp15 names its benchmark ([#186](https://github.com/amritk/nish/pull/186))
- cmp: Name the squash subject in the break-edge nish-cmp declarations ([#194](https://github.com/amritk/nish/pull/194))

### Build

- release: A Release-As trailer chooses the next version ([#200](https://github.com/amritk/nish/pull/200))

### CI

- Fail a pull request whose body carries a session link or tool attribution ([#188](https://github.com/amritk/nish/pull/188))

## [0.9.0] - 2026-09-23

### Breaking changes

- interop: Export generic instantiations under valid, injective names ([#165](https://github.com/amritk/nish/pull/165))

### Added

- checker: Spell an instantiated class as written, in diagnostics and -g ([#164](https://github.com/amritk/nish/pull/164))
- checker: Generic methods on classes ([#168](https://github.com/amritk/nish/pull/168))
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

## [0.8.0] - 2026-09-23

### Breaking changes

- checker: Constrained type parameters ([#157](https://github.com/amritk/nish/pull/157))

### Performance

- checker: Prove bounds through toI32(length) and compile std/text silent ([#154](https://github.com/amritk/nish/pull/154))

### Documentation

- wp19: Record the R6 deletion's measurement ([#151](https://github.com/amritk/nish/pull/151))

### Tests

- self: Let nish-cmp remove each compiler's own version from the DWARF producer ([#156](https://github.com/amritk/nish/pull/156))
- Give each differential run its own working directory ([#159](https://github.com/amritk/nish/pull/159))
- Hold std/ and examples/ to zero performance warnings and ratchet self/ ([#158](https://github.com/amritk/nish/pull/158))

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
[0.21.0]: https://github.com/amritk/nish/releases/tag/v0.21.0
[0.22.0]: https://github.com/amritk/nish/releases/tag/v0.22.0
[0.22.1]: https://github.com/amritk/nish/releases/tag/v0.22.1
[0.23.0]: https://github.com/amritk/nish/releases/tag/v0.23.0
[0.23.1]: https://github.com/amritk/nish/releases/tag/v0.23.1
[0.24.0]: https://github.com/amritk/nish/releases/tag/v0.24.0
[0.25.0]: https://github.com/amritk/nish/releases/tag/v0.25.0
[0.26.0]: https://github.com/amritk/nish/releases/tag/v0.26.0
[0.27.0]: https://github.com/amritk/nish/releases/tag/v0.27.0
[0.27.1]: https://github.com/amritk/nish/releases/tag/v0.27.1
[0.27.2]: https://github.com/amritk/nish/releases/tag/v0.27.2
[0.28.0]: https://github.com/amritk/nish/releases/tag/v0.28.0
[0.29.0]: https://github.com/amritk/nish/releases/tag/v0.29.0
[0.30.0]: https://github.com/amritk/nish/releases/tag/v0.30.0
[0.31.0]: https://github.com/amritk/nish/releases/tag/v0.31.0
[0.32.0]: https://github.com/amritk/nish/releases/tag/v0.32.0
[0.33.0]: https://github.com/amritk/nish/releases/tag/v0.33.0
[0.34.0]: https://github.com/amritk/nish/releases/tag/v0.34.0
[0.34.1]: https://github.com/amritk/nish/releases/tag/v0.34.1
[0.35.0]: https://github.com/amritk/nish/releases/tag/v0.35.0
[0.36.0]: https://github.com/amritk/nish/releases/tag/v0.36.0
[0.37.0]: https://github.com/amritk/nish/releases/tag/v0.37.0
[0.38.0]: https://github.com/amritk/nish/releases/tag/v0.38.0
[0.39.0]: https://github.com/amritk/nish/releases/tag/v0.39.0
[0.40.0]: https://github.com/amritk/nish/releases/tag/v0.40.0
[0.40.1]: https://github.com/amritk/nish/releases/tag/v0.40.1
[0.41.0]: https://github.com/amritk/nish/releases/tag/v0.41.0
[0.42.0]: https://github.com/amritk/nish/releases/tag/v0.42.0
[0.43.0]: https://github.com/amritk/nish/releases/tag/v0.43.0
[0.44.0]: https://github.com/amritk/nish/releases/tag/v0.44.0
[0.45.0]: https://github.com/amritk/nish/releases/tag/v0.45.0
[0.45.1]: https://github.com/amritk/nish/releases/tag/v0.45.1
[0.46.0]: https://github.com/amritk/nish/releases/tag/v0.46.0
