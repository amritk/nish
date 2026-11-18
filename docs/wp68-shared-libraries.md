# WP68: Shared libraries, layered like atomic design

**Status: proposed, design only.** Nothing under `std/`, `src/`, `tests/` or
`runtime/` changes here. The stages are in §11 and on
[the roadmap page](roadmap/wp68-shared-libraries.md). Six decisions wait on
the owner (§9).

Every claim about today's code is anchored at commit `0eefa5e9`, on `main`.
The survey (§3) is `node bench/wp68-survey.mjs`, rerunnable on any commit.
The benchmarks (§4) are `bench/wp68-*.ts`, committed at `dd735298`. They were
built with the released 0.42.0 compiler (`build/seed`), run on x86-64 Linux
(4 cores, Intel Xeon @ 2.10GHz), and pinned to one core with `taskset -c 2`.

The owner set the order of priorities:

1. **Performance first.** A shared copy is the fastest copy that exists today,
   or a faster one, and both are measured.
2. **Tiers named after atomic design**: atoms, molecules, organisms and pages.
3. **Modern Nish.** A copy moved into a shared tier is rewritten in the
   language as it is now, within the seed freeze.

## 1. The problem

`std/` keeps a private copy of every small helper it needs, under the module's
prefix. The decoder from a hex digit to its value has 15 copies. One of them is
`http1HexValue`, another is `jwtHexValue`, and the rest follow the same
pattern. A predicate for ASCII digits has nine copies. Code that checks UTF-8
has nineteen copies across encoders, validators and widths. `src/` adds its own
copies: `isDigit` in the lexer, `fnv1a` in the map, `jsonIsUtf8` and
`addJsonQuoted`.

The habit has reasons. A module that imports nothing is easy to audit, gives
nish-cmp a small IR, and can be read alone. But it has three costs, which §3
and §4 measure:

- **The copies are not equally fast.** Each was written for its own module,
  and no one chose among them. In two of the five benched clusters a copy
  std/ already has beats the one `std/bytes.ts` or most modules use, outside
  the noise band: 1.5 times on big-endian loads, 4.4 times on long JSON
  strings. In the other three a candidate does: a table 7.1 times on hex, two
  digits a step 5 to 8% on decimals, and an ASCII word skip 1.3 times on
  ASCII text only (§4).
- **A fix reaches one copy.** `std/bytes.ts` already holds shared byte loads
  and runs. Its header lists five modules that keep their own copy anyway:
  "None of them is replaced by this module." A defect or a speed-up found in
  one copy stays in that copy.
- **The copies have drifted.** Some hex decoders answer -1 for a byte that is
  not a digit, and others trust the caller. The JSON quoter in `src/debug.ts`
  does not escape control bytes, while the other seven quoters do. A reader
  cannot tell whether a difference is deliberate without reading every caller.

This package proposes shared tiers with an import rule that can be checked.
It extracts one cluster per stage, ordered by measured gain, and each stage
starts from the fastest copy.

## 2. What exists today

- **`std/` modules import each other only sparingly.** `std/bytes.ts`
  (`nish/bytes`) is the one module meant as a shared byte layer. It has
  big-endian and little-endian loads and stores, and the runs a parser walks
  (`skipBlank`, `skipDigits`, `skipJsonPlain`, `copyBytes`). Every declaration
  in it is public and documented, so it is in `docs/reference/`.
- **`src/` already imports `std/`.** It does so through `nish/…`
  (`nish/term`, `nish/term-pixels`, `nish/text` and others) and through
  relative paths (`../std/raster`, `../std/cli`). The seed compiles those
  modules together with the compiler. Whatever tier `src/` imports is
  therefore under the rolling freeze, because the seed must compile it.
- **The one import rule today says that shipped code imports no test code.**
  In `biome.json`, `noRestrictedImports` on `src/**` and `std/**` refuses
  `tests/`, `scripts/`, `bench/` and `examples/`. Within `std/`, nothing
  orders who may import whom.
- **The reference documents every `std/**/*.ts` module.**
  `scripts/gen-reference.mjs` runs TypeDoc with `excludeInternal: true`, so a
  declaration tagged `@internal` is left out of the pages. That tag is in use
  today, for example on fields in `std/net/quic-recovery.ts`.

## 3. The survey

### 3.1 Method

`node bench/wp68-survey.mjs [cluster ...]` walks every `.ts` file under `std/`
and `src/`, leaving out `.d.ts` files. It matches each line against each
cluster's marker:

- **A marker finds a copy by its shape where the shape is distinctive.** The
  lower-case hex step `- 87`, the FNV prime `16777619`, and a byte shifted by
  24 and OR'd are such shapes.
- **Where there is no such shape, the marker finds a copy by the names copies
  carry**, for example `…IsDigit` or `…Utf8…`.
- **A match counts its whole enclosing top-level `const` when that is the
  copy.** It is the copy when it is at most 16 lines long, or when the match is
  in its first six lines.
- **Otherwise the copy is inline in a larger function.** The script then counts
  the unbroken lines around the match that match the cluster's `run` pattern,
  and counts them once.

The script prints each site as `file:line name (n lines)`, then the totals.
Its counts are a lower bound, because a copy that no marker matches is not
counted. For example, `src/manifest.ts:349` `manifestHexDigit` takes the
value from the low bits (`& 15`) and carries no `- 87`, so the `hex` count
leaves it out. §4 benches it all the same. Rerun it after any stage: the stage's cluster should fall to one
site and the cluster's callers.

### 3.2 What it found

At `0eefa5e9` it found 87 sites and 1,212 lines in eight clusters:

| Cluster | Sites | Lines | Copies agree? |
| --- | ---: | ---: | --- |
| `hex`: hex digit → value | 15 | 136 | **Diverge.** Eleven answer -1 for a byte that is not a digit. `tlsHexNibble`, `pixelsHex` and `yamlJsonHexValue` trust that their caller has already checked the byte, and return a wrong value otherwise. The checks come in two orders, lower case first or upper case first. |
| `be-load`: big-endian `u32` load | 15 | 75 | **Agree in range.** The types differ: `u32` in most copies, `i64` in `http2FrameU32` and `i32` in some inline copies. `poly1305Le64` is the little-endian twin. Outside the range they differ, as `std/bytes.ts` records. |
| `decimal`: decimal writer and its digit count | 8 | 159 | **Diverge.** `http1` writes non-negative `i32` values. `pg` writes signed `i64` values two digits at a time. `jsonWriterPutDigits` handles the sign and writes a suffix. Each counts digits its own way. |
| `json-escape`: JSON string quoter and escape table | 8 | 254 | **Diverge.** `src/debug.ts` `quote` does not escape control bytes; its comment says only paths and identifiers reach it. `src/` quotes into a `string` and `std/` into bytes. `jsonWriterPutRuns` copies whole runs where `jsonWriterPutString` copies byte by byte. |
| `utf8`: encode, validate and measure UTF-8 | 19 | 440 | **They agree on what is well formed, but the interfaces diverge.** Every validator is RFC 3629 strict: no overlong form, no surrogate, nothing past U+10FFFF. They differ in what they answer. `urlIsUtf8` checks a whole range. `websocketUtf8Run` is resumable. `bytesUtf8Length` answers a sequence length. `termUtf8At` replaces bad input with U+FFFD. `x509IsUtf8Name` also refuses NUL. |
| `digit`: ASCII digit predicate | 9 | 9 | **Agree.** Each is `c >= 48 && c <= 57`. Some spell the bounds as named constants. |
| `grow`: byte-buffer grow and reserve | 8 | 122 | **Diverge on policy.** Some double from 64 bytes with a 1 GiB cap. Some grow to exactly the size asked for. The `http1` copies also compact live bytes to the front. `quicFrameGrow` calls `quicPacketGrow` rather than copying it. |
| `fnv`: FNV-1a 32-bit hash | 5 | 17 | **Agree** on the hash. The callers differ in what they hash: a `string` by its UTF-16 code units in `src/map.ts`, and bytes in the `std/` copies. |

The sites, at `0eefa5e9`:

- **hex**:
  - std/crypto/jwt.ts:622, std/crypto/pki.ts:344, std/json.ts:353
  - std/math.ts:1221, std/net/dns-config.ts:224, std/net/http1-codec.ts:1615
  - std/net/router.ts:1081, std/net/tls/codec.ts:1258, std/net/url.ts:127
  - std/regex.ts:378, std/term-pixels.ts:143, std/yaml-json.ts:1190
  - std/yaml.ts:1136, src/constants.ts:168 (inline), src/emit-ts-strings.ts:152
- **be-load**:
  - std/compress/zlib.ts:183, std/crypto/aes.ts:567, std/crypto/bcrypt.ts:310
  - std/crypto/chacha20poly1305.ts:398, std/crypto/p256.ts:4407, std/crypto/sha1.ts:39
  - std/net/http1-server.ts:356, std/net/http2-frame.ts:260, std/net/postgres-async.ts:2210
  - std/net/postgres.ts:1749 and :1983, std/net/tls.ts:2403
  - std/net/tls/codec.ts:926, std/net/websocket.ts:432 and :566
  - The inline copies are those in zlib, http1-server, postgres, postgres-async, tls, tls/codec and websocket.
- **decimal**:
  - std/json.ts:1904 and :1941, std/net/http-compress.ts:166
  - std/net/http1-client-codec.ts:163, std/net/http1-codec.ts:2348 and :2470
  - std/net/postgres.ts:548 and :567
- **json-escape**:
  - std/json-tokenizer.ts:525, std/json.ts:864, :1696 and :1833
  - src/debug.ts:168, src/ice.ts:152, src/strings.ts:133 and :144
- **utf8**:
  - std/bytes.ts:569
  - std/crypto/jwt.ts:636 and :650, std/crypto/x509.ts:1116
  - std/json-tokenizer.ts:458, :498 and :509, std/json.ts:394, :408 and :422
  - std/net/url.ts:531, std/net/websocket.ts:164, :188 and :233
  - std/regex.ts:453, std/term.ts:2036 and :2154
  - src/json-typed.ts:159, src/lexer.ts:336
- **digit**:
  - std/crypto/pki-roots.ts:222, std/json-format.ts:132, std/json-number.ts:78
  - std/json-tokenizer.ts:336, std/net/url.ts:721, std/yaml-json.ts:1178
  - std/yaml-write.ts:85, std/yaml.ts:1135, src/lexer.ts:201
- **grow**:
  - std/net/handler.ts:1659, std/net/http1-client-codec.ts:910
  - std/net/http1-codec.ts:660 and :1006
  - std/net/quic-frame.ts:713, std/net/quic-packet.ts:479
  - std/net/serve.ts:811, std/net/websocket.ts:378
- **fnv**:
  - std/net/postgres.ts:4247 (inline), std/net/router.ts:937
  - std/net/tls/ticket.ts:613 (inline), std/yaml.ts:4595 (the prime alone)
  - src/map.ts:34

Clusters the survey does not count yet are character-class tables, decimal
parsers, and the blank-skipping cursors that predate `skipBlank`. Each one gets
a marker in the stage that takes it up.

## 4. Measured

### 4.1 How

Each bench times every copy of one cluster side by side, on input that changes
every round. A round writes one byte or one value at a position that moves
with the round. Each bench follows the same rules:

- **The first side is the copy most modules repeat**, verbatim apart from its
  name.
- **The second side is a byte-identical twin of the first.** The ratio
  between the two is that run's noise band.
- **Each round starts at a different side**, so that no side always runs first.
- **Every side folds its output into a checksum, and the program prints it.**
  All checksums must agree, and the run fails if they do not.
- **The figure for each side is its minimum over nine rounds**, quoted as a
  ratio to the first side. Below 1 is faster.

```
node bench/wp68-run.mjs --compiler build/seed/bin/nish --runs 2
```

That command builds each `bench/wp68-*.ts` with `--profile speed` into
`build/bench/wp68/`, runs each one twice under `taskset -c 2`, and exits 1 if a
build fails, a program exits non-zero, or the checksums differ. Pass a bench's
name to run it alone, for example `hex` or `utf8`. The figures below are the
range over the two runs at `dd735298`. A side is called faster or slower only
when its ratio is outside the twin's band.

### 4.2 Results

The `x first` column is the side's ratio to the first side, and the twin's row
gives the noise band. For example, 0.14 means the side took 14% of the
first side's time, about 7 times faster.

| Bench | Side | x first | Reading |
| --- | --- | ---: | --- |
| `hex`, 4 MiB × 20 passes | `chainA`, the `http1HexValue` chain | 1 | the copy most modules repeat |
| | twin | 1.011–1.029 | noise band |
| | `lower`, `math.ts` with `\| 32` | 0.697–0.710 | 1.4x faster |
| | `mask`, `manifest.ts` `& 15` | 1.175–1.198 | slower |
| | `table`, a 256-entry `readonly u8[]` | 0.138–0.141 | **7.1x faster** |
| `be-load`, every offset of 4 MiB × 10 | `bytesA`, `getU32BE` | 1 | top byte multiplied in |
| | twin | 0.997–0.999 | noise band |
| | `shifts`, `sha1LoadWord` (`aesLoad32` has the same shape) | 0.655–0.663 | **1.5x faster** |
| | `wide`, `http2FrameU32` in `i64` | 0.667 | 1.5x faster |
| `utf8`, mixed text | `urlA`, `urlIsUtf8` | 1 | |
| | twin | 1.036–1.041 | noise band |
| | `bytesWalk`, `bytesUtf8Length` | 1.036–1.053 | inside the band |
| | `jsonTokWalk` | 0.938–0.963 | 4–6% faster, as far from 1 as the twin |
| | `wordSkip`, an 8-byte ASCII skip | 1.21–1.23 | slower |
| `utf8`, ASCII text | `urlA` | 1 | |
| | twin | 0.808–0.828 | noise band: 17–19% |
| | `bytesWalk` | 0.915–0.933 | inside the band |
| | `jsonTokWalk` | 0.897–0.920 | inside the band |
| | `wordSkip` | 0.607–0.619 | 1.3x faster than the twin |
| `json-escape`, 64-byte strings | `byteA`, the `jsonWriterPutString` shape | 1 | |
| | twin | 0.979–1.024 | noise band |
| | `runs`, `jsonWriterPutRuns` | 1.22–1.33 | slower |
| | `builder`, `src/strings.ts` `addJsonQuoted` | 12.7–14.4 | builds a `string` |
| `json-escape`, 1 KiB strings | `byteA` | 1 | |
| | twin | 0.983–1.053 | noise band |
| | `runs` | 0.221–0.234 | **4.4x faster** |
| | `builder` | 21.5–22.8 | builds a `string` |
| `decimal`, 1 Mi values of 1 to 10 digits | `http1A`, `http1PutDecimal` | 1 | |
| | twin | 0.983–0.988 | noise band |
| | `pg`, `pgPutDecimal` | 1.28–1.30 | slower |
| | `json`, `jsonWriterPutDigits` | 1.44–1.45 | slower |
| | `template`, `` `${v}` `` and `join` | 2.80–2.84 | how `src/` writes numbers |
| | `pairs`, two digits a step from a table | 0.918–0.934 | 5–8% faster |

Every bench's checksums agree:

| Bench | Checksum |
| --- | --- |
| `hex` | `724140149` |
| `be-load` | `314966957` |
| `utf8` | `273227811` |
| `json-escape` | `331584373` (short), `107877605` (long) |
| `decimal` | `579990990` |

The clusters with no bench are `digit`, `grow` and `fnv`. The first and last
have a single shape, so there is no faster copy to choose. `grow` copies differ
in policy, not in speed per byte. For character-class tables,
`bench/const-table.ts` already measures a table against a chain of compares.

What the figures do not say:

- **Why `getU32BE` is slower.** The two sides differ only in the multiply and
  the add where `sha1LoadWord` has a shift and an OR. S3 reads the IR.
- **That the table is faster in every program.** A 256-byte table costs a
  cache line or four the first time it is touched. S2's non-regression benches
  check the effect on real callers.
- **That `wordSkip` should replace a validator.** It wins on ASCII text and
  loses on mixed text, so S5 decides by input.

### 4.3 Ranking

The clusters are ranked by measured gain, then by sites × lines, then by risk:

1. **hex**: 7.1x, 15 sites and 136 lines. The risk is low except where a
   crypto caller decodes secret bytes (§10).
2. **json-escape**: 4.4x on long strings but slower on short ones, 8 sites
   and 254 lines. It needs a length threshold. The `src/` copies are under the
   freeze.
3. **be-load**: 1.5x, 15 sites and 75 lines. It touches crypto modules and
   their records. The shared copy must still give the same answer under Node
   (§8).
4. **utf8**: up to 1.3x on ASCII and slower on mixed text, 19 sites and 440
   lines. It has the most lines and the most security-relevant callers
   (`x509`, `websocket`, `url`).
5. **decimal**: 5–8%, 8 sites and 159 lines.
6. **digit, grow, fnv**: no gain to take, 22 sites and 148 lines. These are
   for consolidation only.

## 5. The tiers

| Tier | What belongs there | May import | Examples from §3 |
| --- | --- | --- | --- |
| **Atoms** | A function of a byte, a word or a few scalars. No allocation, no state. | builtins only | `hexValue`, `isDigit`, `loadU32BE`, `fnv1aStep`, `decimalDigits` |
| **Molecules** | A walk or a write over a buffer, built from atoms. | atoms | `utf8Valid`, `utf8Length`, `jsonPutQuoted`, `putDecimal`, `grownSize` |
| **Organisms** | A public module, a whole parser or codec: what `std/` is today. | molecules and atoms | `std/json.ts`, `std/net/url.ts`, `std/net/http1-codec.ts`, `std/crypto/jwt.ts` |
| **Pages** | A program: the compiler, a CLI, an example or a user's program. | any lower tier | `src/`, `examples/` |

Where each tier lives (D1):

- **Atoms**: `std/atoms/<topic>.ts`, imported as `nish/atoms/hex`. One file per
  topic: `hex`, `ascii`, `bytes-be`, `hash`, `decimal`.
- **Molecules**: `std/molecules/<topic>.ts`, for example `utf8`,
  `json-escape`, `decimal` and `grow`.
- **Organisms**: the existing `std/` modules, which stay where they are. Users
  import paths such as `nish/json`, and moving those would break them.
- **Pages**: `src/` and `examples/`, unchanged.

**The rule: a module imports only from tiers below its own.** An atom
imports nothing but builtins. Two modules in the same tier do not import each
other, so a tier has no internal order to maintain. The exception would be an
atom that needs another atom; D5 decides whether to allow it.

**How the rule is enforced (D5).** Biome already refuses imports that cross
into test code. Its `noRestrictedImports` takes a per-glob override, so the
rule becomes three new override blocks in `biome.json`:

- `std/atoms/**` refuses imports from `std/molecules/**` and from any other
  `std/` or `nish/` module.
- `std/molecules/**` refuses imports from organisms.
- Organisms do not import `src/`. That holds today, and the rule makes it
  explicit.

`npm run lint` runs the rule in every PR, and S2 adds a fixture that breaks the
rule to show it fires. The other option is a script in `scripts/`. It could
also check that the survey does not grow (§6), but it would be a new tool to
maintain.

## 6. Performance first: the rules for every stage

1. **A shared copy starts from the fastest copy of its cluster** in §4, or from
   a candidate faster than all of them, and in both cases outside the twin's
   band. The stage's PR carries a `Measured:` trailer
   (`.claude/testing.md` → "A `Measured:` trailer"), with:
   - its figure against the copy most modules repeat today;
   - the twin's band from the same run;
   - the commit whose bench produced it.
2. **No caller gets slower.** Each stage names the existing benches of its
   biggest callers and reruns them before and after, interleaved, with a twin.
   For example, `bench/json-writer` and `bench/json-tokenizer` for json-escape,
   and `bench/http1-parse` for hex and decimal. A slower caller blocks the
   stage. The stage may record the caller as an exception only with its own
   figure and the owner's yes.
3. **A divergence is kept, not averaged.** A copy that trusts its caller, such
   as `tlsHexNibble`, is replaced only where the caller is shown to check the
   byte. Otherwise the copy becomes a second, named atom (D4).
4. **The survey only shrinks.** After a stage, `node bench/wp68-survey.mjs
   <cluster>` reports the shared copy and no private copies, apart from those
   the stage lists with a reason. A later stage that adds a copy is a
   regression of that stage.

## 7. Modern Nish on extraction

The copies were written across forty releases, and many predate constructs
that would state them better. Each shared copy uses the constructs the seed
already compiles. A construct marked *frozen* is in `main` but not in the
seed, so a tier that `src/` imports cannot use it until the next release.

| Cluster | Today's form | Modern form | Shipped in |
| --- | --- | --- | --- |
| hex | an `if` chain on `i32` returning -1 | a `const HEX: readonly u8[]` table of 256 entries, indexed by a `u8`, with 255 for "not a digit" | 0.40.0 |
| be-load | a multiply and shifts on `u32` | shifts and ORs, or a WP65 byte kernel once it ships | shifts: today. WP65 kernels: *frozen* |
| decimal | one digit a step | two digits a step from a pairs table. The count returns `integer<1, 20>`, so callers can drop their bounds guards. | tables 0.40.0, `integer<Lo,Hi>` 0.13.0 |
| json-escape | byte by byte, with a `switch` for short escapes | runs found with `skipJsonPlain` and copied with `copyBytes`, short escapes from a `readonly u8[]` table, and a length threshold below which it walks byte by byte | `skipJsonPlain`: today. Tables 0.40.0 |
| utf8 | a hand-written state machine per module | one RFC 3629 table walk with ASCII words skipped by SIMD (0.28.0, 0.34.0), and a validator that resumes from a state given as a string enum | SIMD 0.34.0, string enums 0.40.0 |
| grow | `new Array<u8>(size)` and a copy | `withCapacity` and `grow` from WP65 | *frozen* |
| string builders in `src/` | `string` concatenation | the WP56 string builder | *frozen* |
| fnv | a `while` loop | a `for…of` over bytes with `u32` wrapping arithmetic, unchanged | today |

The *frozen* rows land in two steps. The stage ships the shared copy in
today's form. A follow-up after the release then changes that one copy to the
new form, and every caller gets the change at once, which is the point of
sharing. The roadmap lists each follow-up under the stage it belongs to.

## 8. Constraints

- **Seed freeze.** An atom or molecule that `src/` imports is compiled by the
  seed, so it uses only what the last release compiles. CI's `bootstrap` job
  checks this. The `std/`-only molecules can use newer constructs, but a tier
  is easier to reason about when it is all on one side. **Recommended:** every
  atom and molecule stays within the freeze (D3).
- **Public std surface.** Every declaration under `std/` is in
  `docs/reference/` unless it is tagged `@internal`, and a public one needs a
  doc comment, a `@param` per parameter and a `@returns`
  (`scripts/gen-reference.mjs --check`). Atoms are tagged `@internal` until the
  owner makes one public (D2). S2 confirms that `--check` leaves `@internal`
  declarations out of its gaps.
- **nish-cmp `DECLARED`.** Moving a helper changes the IR of every corpus
  program that calls it. Each stage runs `node tests/nish-cmp.js` and adds
  narrow `DECLARED` entries (program + file) in `tests/nish-cmp.js`, with the
  PR's release-note words. The squash subject keeps those words.
- **Goldens.** Each stage changes `std/` and, where `src/` calls the copy,
  `src/`, so it regenerates `tests/self/goldens/checked/` with
  `node tests/self/goldens.js --update`, and `docs/reference/` with
  `node scripts/gen-reference.mjs`.
- **Size.** A shared table is emitted once per program, where today each
  module emits its own chain, so binaries should not grow. Each stage records
  the size of `build/nish` and of one `std/net` example before and after.
- **wasm.** Every atom compiles for `--target wasm32-wasi`. A stage that
  touches `src/` runs `node tests/run.js wasi` with `WASI_SYSROOT=/usr` and
  reads its skip line.
- **Under Node.** `std/bytes.ts` multiplies in the top byte of a `u32`
  because under Node `<<` turns bit 31 into a sign. The 1.5x of `shifts`
  (§4.2) must not cost that answer. S3 measures candidates that give the
  native speed and the same answer under Node
  (`docs/RUN_UNDER_NODE.md`), or keeps the multiply.
- **Security records.** A stage that changes a file named in a
  `docs/security/` record's scope updates that record and its row in
  `docs/security/README.md` (§10).
- **The prover.** A `u8` index into a 256-entry table should need no bounds
  check; S2 confirms that in the IR before the hex table lands. A stage that adds an index the prover cannot
  discharge gets an NL9007 warning, and `node tests/run.js performance` fails
  on it.

## 9. Decisions for the owner

- **D1, the directory and the names.** `std/atoms/` and `std/molecules/`,
  imported as `nish/atoms/hex`. Organisms stay where they are and pages are
  `src/`. The alternative is one `std/internal/` directory with the tier in
  the file name (`atom-hex.ts`), which is shorter but hides the rule from the
  path. **Recommended:** the two directories.
- **D2, public or internal.** Tag the atoms and molecules `@internal`, so they
  stay out of the reference and out of the semver promise. Make one public
  only when a user program asks for it, through its own PR. A user can still
  import an `@internal` module. The tag only means it is not promised.
  **Recommended:** internal.
- **D3, whether `src/` imports the lower tiers directly.** If it does, the
  compiler shares the fastest copy, but every atom is then under the freeze.
  If it does not, `src/` keeps its copies and the tiers can use new constructs
  as soon as they land. **Recommended:** directly, with every atom and
  molecule within the freeze (§7's two-step rows).
- **D4, divergent copies.** Unify where every caller of a divergent copy is
  shown to give the same answer through the shared one. Otherwise keep the
  difference as a second, named atom, for example `hexValueTrusted` beside
  `hexValue`. Never widen a lenient copy silently. **Recommended:** as stated.
  The `src/debug.ts` `quote` becomes the shared quoter, which also escapes
  control bytes, because a stricter answer to a path is harmless.
- **D5, enforcement.** Use `noRestrictedImports` overrides in `biome.json`
  (§5) rather than a new script, with a fixture that shows the rule fires.
  Also decide whether an atom may import another atom. **Recommended:** biome;
  atoms import nothing.
- **D6, crypto.** A table lookup indexed by a secret byte is a cache-timing
  channel, so constant-time crypto code keeps its arithmetic copies.
  `tests/ct-asm.js` does not pin any of these loads or decoders today, so a
  stage that moves one adds a `ct-asm` spec for it. The shared hex table is
  for non-secret input only. **Recommended:** as stated, with each crypto caller's input recorded as
  secret or public in its stage.

## 10. Security

The extraction changes no attacker-facing behaviour by design: each stage
proves that every caller gets the same answers, or records a difference
under D4. Three points need a record, all in the stage that touches them:

- **Constant time.** `jwt`, `pki`, `aes`, `sha1`, `bcrypt`, `p256` and
  `chacha20poly1305` hold copies. A stage that replaces one checks whether its
  input is secret. `aes`, `bcrypt`, `p256` and `chacha20poly1305` have loads on
  key or state words. `jwt` and `pki` hex-decode public text. A copy on secret
  input keeps its arithmetic copy, or moves to an atom covered by a `ct-asm`
  spec (`docs/security/ct-verification.md`).
- **One defect, many callers.** A shared validator puts a defect in every
  caller at once. S5 therefore lands with the RFC 3629 corner tests (overlong,
  surrogate, past U+10FFFF, cut short) run against every former caller's
  entry point, not only the molecule.
- **Scope.** `node scripts/security-scope.mjs` refuses a file that no record's
  scope names. A new `std/atoms/*.ts` or `std/molecules/*.ts` that a network
  or crypto module calls is named in the scope of the records whose code
  moved into it.

## 11. Stages

S1 is this note. Each later stage takes one cluster:

- **The sites** are §3.2's list.
- **The baseline** is §4's fastest copy, rerun on the stage's base commit.
- **The optimisation** is the faster candidate, if there is one.
- **The modern form** is the matching row of §7.
- **The acceptance test** shows that every former caller gives the same
  answers, and §3's survey reports the cluster as one copy.
- **The non-regression measurement** is a `Measured:` trailer from §6 rules 1
  and 2.

| | Cluster | Baseline → candidate | Non-regression benches | Depends on |
| --- | --- | --- | --- | --- |
| S2 | hex, and the tier directories, the biome rule and its fixture | `chainA` → `table`, 7.1x | `bench/http1-parse`, `bench/json-tokenizer` | D1, D2, D5 |
| S3 | be-load | `getU32BE` → `shifts` or a Node-safe equal, 1.5x | `bench/chacha20.ts`, `bench/aes-gcm.ts` | S2, D6 |
| S4 | json-escape | `byteA` → `runs` above a length threshold, 4.4x on 1 KiB strings | `bench/json-writer` | S2, D4 |
| S5 | utf8 | `urlIsUtf8` → a table walk with an ASCII word skip | `bench/json-tokenizer`, `bench/jwt-verify` | S2, S4 |
| S6 | decimal | `http1PutDecimal` → `pairs`, 5–8% | `bench/http1-request`, `bench/json-writer` | S2 |
| S7 | digit, grow, fnv | the shared shape, with no gain claimed and none lost | the callers' benches as above | S2 |

S2 goes first, because it creates the directories and the rule. After it, S3,
S6 and S7 do not depend on one another and can run in parallel. S4 and S5 both
edit `std/json.ts` and `std/json-tokenizer.ts`, so S5 follows S4. Each
*frozen* row of §7 adds a follow-up after the next release, to the stage that
owns its cluster.

### Not planned here

- Moving or renaming any public `std/` module.
- Merging `std/bytes.ts` into the atoms. It stays public, and its functions
  call atoms where an atom is faster.
- Sharing code between `runtime/*.c` and Nish.
- A tier above pages.
