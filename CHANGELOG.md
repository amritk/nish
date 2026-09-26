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
