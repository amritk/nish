# WP68: Shared libraries, layered like atomic design

**Status: proposed, design only.** Nothing under `std/`, `src/` or
`runtime/` changes here. Under `tests/`, only the generated goldens of the
`bench/wp68-*` programs (`tests/self/goldens/checked/`) and their `DECLARED`
entries in `tests/nish-cmp.js` change. The stages are in §11 and on
[the roadmap page](roadmap/wp68-shared-libraries.md). Six decisions wait on
the owner (§9).

Every claim about today's code is anchored at commit `0eefa5e9`, on `main`.
The survey (§3) is `node bench/wp68-survey.mjs`, rerunnable on any commit.
The benchmarks (§4) are `bench/wp68-*.ts`, with the bench code from the
working tree on `662f581b`. They were built with the released 0.42.0 compiler
(`build/seed`), run on x86-64 Linux (4 cores, Intel Xeon @ 2.10GHz), and
pinned to one core with `taskset -c 2`.

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
  and no one chose among them. In each of the five benched clusters, on at
  least one input, a copy `std/` already has beats the bench's first side
  outside the noise band:
  - on hex, `lower` in `std/math.ts` is about 1.5 times the `http1HexValue`
    chain on mixed bytes and on mixed code units, and `manifestHexDigit`'s
    `& 15` form is 6% faster on random hex digits;
  - on big-endian loads, the shift form is 1.5 times `std/bytes.ts`
    `getU32BE`, which multiplies in the top byte. That is the load alone:
    `getU32BE`'s one caller outside `std/bytes.ts` loads a DNS TTL once per
    record (`std/net/dns-message.ts:539`);
  - on JSON strings, `jsonWriterPutRuns` is 1.9 to 4.2 times the
    byte-by-byte quoter for strings of 16 bytes or more with 1 byte in 256
    escaped, and slower at 8 bytes, on empty strings, and with 1 byte in 16
    escaped;
  - on UTF-8, the tokenizer's real path, the native `skipJsonText` and then
    `jsonTokUtf8Length`, is 5.8 times `urlIsUtf8` on mixed text and 1.9 times
    on ASCII text;
  - on signed decimals, `jsonWriterPutDigits64` is 9–11% faster than
    `pgPutDecimal`.

  Against the fastest existing copy, two candidates win on some inputs. A
  256-entry hex table is 4.8 times `lower` on mixed bytes and 5.5 times
  `manifestHexDigit` on random hex digits, with no gain established on digits
  alone; on `i32` code units, the table behind a range guard is 1.5 times
  `lower`. Two digits a step is 5–6% faster than `http1PutDecimal` on
  non-negative values, and no faster than `jsonWriterPutDigits64` on signed
  ones (§4).
- **A fix reaches one copy.** `std/bytes.ts` already holds shared byte loads
  and runs. Its header lists five modules that keep their own copy anyway:
  "None of them is replaced by this module." A defect or a speed-up found in
  one copy stays in that copy.
- **The copies have drifted.** Some hex decoders answer -1 for a byte that is
  not a digit, and others trust the caller. The decimal writers each count
  digits their own way. A reader cannot tell whether a difference is
  deliberate without reading every caller.

This package proposes shared tiers with an import rule that can be checked.
It extracts one cluster per stage, in the order §4.4 ranks them by measured
gain, and each stage starts from the fastest existing copy.

## 2. What exists today

- **`std/` modules import each other only sparingly.** `std/bytes.ts`
  (`nish/bytes`) is the one module meant as a shared byte layer. It has
  big-endian and little-endian loads and stores, and the runs a parser walks
  (`skipBlank`, `skipDigits`, `skipJsonText`, `skipJsonPlain`, `copyBytes`).
  It imports nothing. Every exported declaration in it is documented and in
  `docs/reference/`. Its private helpers are not exported: `getU64BEByByte`,
  `bytesRunEnd`, `bytesRunStart`, `skipBlankWalk`, `skipDigitsWalk`,
  `bytesUtf8Length`, `skipJsonTextWalk`, `skipJsonPlainWalk` and
  `copyBytesWalk`.
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
  copy.** The definition starts at the nearest `const` at column 0 at or above
  the match. It ends at the first line after which every bracket is closed
  (strings, comments and regular expressions skipped) and the next line is
  blank, unindented, or the end of the file. The definition is the copy when it
  is at most 16 lines long, or when the match is in its first six lines.
- **Otherwise the copy is inline in a larger function.** The script then counts
  the unbroken lines around the match that match the cluster's `run` pattern,
  and counts them once.

The script prints each site as `file:line name (n lines)`, then the totals.
Its counts are a lower bound, because a copy that no marker matches is not
counted. The known misses and false matches:

- **hex**: `- 87` matches by shape only, so `src/manifest.ts:349`
  `manifestHexDigit`, which takes the value from the low bits (`& 15`), is not
  counted. §4 benches it all the same.
- **be-load**: the marker misses the multiply form (`std/bytes.ts`
  `getU32BE`, the bench's first side) and a load split across lines. It also
  counts `std/crypto/chacha20poly1305.ts:398` `poly1305Le64`, a little-endian
  64-bit load. Without it, be-load is 14 sites and 46 lines.
- **Name matches that are not copies** inflate two counts. In utf8,
  `std/net/websocket.ts:164` `websocketUtf8Reset` resets a validator's state.
  In grow, `std/net/quic-frame.ts:713` `quicFrameGrow` calls `quicPacketGrow`
  rather than copying it. Without them, utf8 is 18 sites and grow 7.

Rerun it after any stage: the stage's cluster should fall to one site plus the
cluster's callers.

### 3.2 What it found

At `0eefa5e9` it found 86 sites and 1,181 lines in eight clusters:

| Cluster | Sites | Lines | Copies agree? |
| --- | ---: | ---: | --- |
| `hex`: hex digit → value | 15 | 136 | **Diverge.** Eleven answer -1 for a byte that is not a digit. `tlsHexNibble`, `pixelsHex` and `yamlJsonHexValue` trust that their caller has already checked the byte, and return a wrong value otherwise. The checks come in two orders, lower case first or upper case first. |
| `be-load`: big-endian `u32` load | 15 | 59 | **Agree in range.** The types differ: `u32` in most copies, `i64` in `http2FrameU32` and `i32` in some inline copies. `poly1305Le64` is a little-endian 64-bit load that the marker counts (§3.1). Outside the range they differ, as `std/bytes.ts` records. |
| `decimal`: decimal writer and its digit count | 8 | 159 | **Diverge.** `http1` writes non-negative `i32` values. `pg` writes signed `i64` values two digits at a time. `jsonWriterPutDigits` handles the sign and writes a suffix. Each counts digits its own way. |
| `json-escape`: JSON string quoter and escape table | 7 | 239 | **Diverge in interface.** `src/` quotes into a `string` and `std/` into bytes. `jsonWriterPutRuns` copies whole runs where `jsonWriterPutString` copies byte by byte. `src/debug.ts` `quote` is not in this cluster: it quotes LLVM metadata strings, not JSON. |
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
  - src/ice.ts:152, src/strings.ts:133 (`jsonQuote`) and :144 (`addJsonQuoted`)
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

Each bench times the copies it names as its sides, side by side, on input
that changes every round. It does not time every copy in its cluster: §4.3
lists, cluster by cluster, which copies are timed, which are not, and what
input their callers pass. A round writes one byte or one value at a position
that moves with the round. Each bench follows the same rules:

- **The first side is a copy `std/` ships**, verbatim apart from its name, and
  every ratio is to it. It is not always the fastest existing copy, and not
  always the one most modules repeat. In `be-load` it is `std/bytes.ts`
  `getU32BE`, which multiplies in the top byte, while every surveyed site
  shifts. §4.4 quotes each cluster's gain against its fastest existing copy.
- **The second side is a byte-identical twin of the first.** The ratio
  between the two is that run's noise band.
- **A bench with more than one input** gives each input its own twin band and
  its own checksums, and every figure below is quoted with its input.
- **Each round starts at a different side**, so that no side always runs first.
- **Every side folds its output into a checksum, and the program prints it.**
  All checksums must agree, and the run fails if they do not.
- **The figure for each side is its minimum over the rounds** (nine, or twelve
  in `utf8`, one for each ill-formed case it writes), quoted as a ratio to the
  first side. Below 1 is faster.

```
node bench/wp68-run.mjs --compiler build/seed/bin/nish --runs 2
```

That command builds each `bench/wp68-*.ts` with `--profile speed` into
`build/bench/wp68/`, runs each one twice under `taskset -c 2` where that runs,
and exits 1 if a build fails, a program exits non-zero, or the checksums
differ. After each run it prints a WARN line for every side whose ratio is no
further from 1 than the twin's. Pass a bench's name to run it alone, for
example `hex` or `utf8`. The figures below are the range over the two runs of
one invocation of that command, with the bench code from the working tree on
`662f581b`. A side is called faster or slower only when its ratio is outside
the twin's band in both runs, and no side the run WARNs about is called a
gain.

### 4.2 Results

The `x first` column is the side's ratio to the first side, and the twin's row
gives the noise band. For example, 0.14 means the side took 14% of the first
side's time, about 7 times faster.

**hex**, 4 MiB × 20 passes. `chainA` is the `http1HexValue` chain, `lower`
is `std/math.ts` `hexDigit` with `| 32`, `mask` is `src/manifest.ts`
`manifestHexDigit` with `& 15`, and `table` is a 256-entry `readonly u8[]`
indexed by a `u8` (a candidate). On `i32` code units the table is `guarded`:
it answers -1 for anything outside `[0, 256)` before it indexes.

| Input | twin (band) | `lower` | `mask` | `table` or `guarded` |
| --- | ---: | ---: | ---: | ---: |
| **mixed bytes**: `u8`, 32 symbols, 22 of them hex digits, every class at random | 1.081–1.084 (8%) | **0.672–0.674**, 1.5x faster | 1.205–1.207, slower | `table` **0.140–0.141**, 4.8x faster than `lower` |
| **random hex bytes**: lower-case hex digits at random, the shape of a hash | 1.033–1.036 (3–4%) | 0.997–1.004, inside the band | **0.939–0.940**, 6% faster | `table` **0.170**, 5.5x faster than `mask` |
| **digit bytes**: `0` to `9` only, every branch the same way | 0.860–0.910 (9–14%) | **0.784–0.803**, 20–22% faster | 0.998–1.010, inside the band | `table` 0.780–0.781: 0.5–3% below `lower`, no gain established |
| **mixed code units**: `i32`, the 22 hex digits, -1, `/ : @`, 0x00 and five units from 0x100 up | 0.914–0.941 (6–9%) | **0.627–0.646**, 1.5–1.6x faster | 1.130–1.163, slower | `guarded` **0.430–0.438**, 1.5x faster than `lower` |

Mixed input, every class at random, is the worst case for a copy that
branches, so its ratios are a maximum, not a typical gain. On digits alone,
where every branch is predicted, the table gains nothing measurable over
`lower`.

**be-load**, every offset of 4 MiB × 10:

| Side | x first | Reading |
| --- | ---: | --- |
| `bytesA`, `std/bytes.ts` `getU32BE` | 1 | top byte multiplied in; no surveyed site has this form |
| twin | 0.994–1.012 | noise band: 1% |
| `shifts`, `sha1LoadWord` | 0.653–0.661 | fastest existing copy, **1.5x faster than `getU32BE`** in this micro-bench |
| `wide`, `http2FrameU32` in `i64` | 0.654–0.662 | within 0.2% of `shifts`: no difference |

The 1.5x is the load alone. `getU32BE` has one caller outside
`std/bytes.ts`: `std/net/dns-message.ts:539`, which loads a record's TTL once
per resource record. No bench times that caller, so no program-level gain is
claimed.

**utf8**, 4 MiB in 4 KiB segments × 10 passes. `urlA` is `urlIsUtf8`,
`bytesWalk` is `std/bytes.ts` `bytesUtf8Length`, and `wordSkip` is an 8-byte
ASCII skip (a candidate). `jsonTokLoop` is a synthetic driver:
`jsonTokUtf8Length` called from a byte loop of the bench's own, which the
tokenizer does not have. `kernel` is the tokenizer's real path:
`jsonTokSkipPlain` calls `skipJsonText` from `nish/bytes`, and
`jsonTokUtf8Length` runs at the byte where that stopped. Built natively,
`skipJsonText` is the runtime's `nish_bytes_skip_json_text`, and on this host
`nish_run_choose` picked its AVX2 path, 32 bytes a block (`avx2` present,
`NISH_SIMD` unset).

| Input | twin (band) | `bytesWalk` | `jsonTokLoop` | `kernel` | `wordSkip` |
| --- | ---: | ---: | ---: | ---: | ---: |
| **mixed**: 16 of 64 symbols not ASCII | 0.941–0.944 (6%) | 0.894–0.900, 10–11% faster | 0.889–0.897, 10–11% faster | **0.172–0.173**, 5.8x faster | 1.102–1.116, slower |
| **ASCII**: 1 of 64 symbols not ASCII | 0.994–1.000 (under 1%) | 1.640–1.648, slower | 1.642–1.651, slower | **0.516–0.527**, 1.9x faster | 1.195–1.199, slower |

**decimal**, 1 Mi values. `http1A` is `http1PutDecimal`, `pg` is
`pgPutDecimal`, `json` is `jsonWriterPutDigits`, `client` is
`http1ClientPutDecimal`, `compress` is `http1A`'s write with
`httpDecimalDigits` as the count, `template` is `` `${v}` `` and `join`, and
`pairs` and `pairs64` write two digits a step from a table (candidates).

| Input | Side | x first | Reading |
| --- | --- | ---: | --- |
| **non-negative**: `i32` values of 1 to 10 digits | `http1A` | 1 | the fastest existing copy |
| | twin | 0.963–0.968 | noise band: 3–4% |
| | `pg` | 1.303–1.312 | slower |
| | `json` | 1.460–1.469 | slower |
| | `client` | 1.043–1.051 | slower |
| | `compress` | 0.993–0.994 | inside the band |
| | `template` | 2.853–2.873 | how `src/` writes numbers; builds strings |
| | `pairs` | 0.940–0.950 | **5–6% faster** |
| **signed**: `i64` values of 1 to 19 digits, half negative, with 0 and the `i64` minimum | `pgA`, `pgPutDecimal` | 1 | |
| | twin | 0.977–0.990 | noise band: 1–2% |
| | `json64`, `jsonWriterPutDigits64` | **0.895–0.906** | fastest existing copy, 9–11% faster |
| | `pairs64` | 0.917–0.923 | 8% faster than `pgA`, 2% slower than `json64`: no gain over `json64` |

**json-escape** quotes 4 MiB cut into strings of one length, with a given
share of bytes escaped (quotes, backslashes, the five letter escapes and
control bytes that take `\u00xx`; 0x7f and bytes from 0x80 up pass through).
The empty case quotes a million empty strings. The first side, `byteA`, has
the `jsonWriterPutString` shape, byte by byte. `runs` is `jsonWriterPutRuns`,
an existing copy. `builder` is `src/strings.ts` `addJsonQuoted`, which builds
a `string`:

| Strings, escaped | twin (band) | `runs` | `builder` |
| --- | ---: | ---: | ---: |
| empty, a million | 0.965–1.008 | 1.041–1.199, slower | 20.47–22.78 |
| 8 B, 1 in 256 | 1.106–1.112 | 1.213–1.295, slower | 19.56–20.50 |
| 13 B, 1 in 256 | 1.032–1.134 | 1.042–1.055, inside the band | 20.37–21.07 |
| 16 B, 1 in 256 | 1.024–1.081 | **0.520–0.538**, 1.9x faster | 19.86–20.43 |
| 32 B, 1 in 256 | 1.004–1.159 | **0.380–0.438**, 2.3–2.6x faster | 19.77–21.82 |
| 64 B, 1 in 256 | 0.937–1.104 | **0.301–0.336**, 3.0–3.3x faster | 19.34–21.17 |
| 100 B, 1 in 256 | 1.147–1.199 | **0.314–0.322**, 3.1–3.2x faster | 21.60–22.69 |
| 1024 B, 1 in 256 | 1.111–1.151 | **0.237–0.251**, 4.0–4.2x faster | 22.44–22.86 |
| 64 B, 1 in 16 | 1.010–1.056 | 1.197–1.219, slower | 13.75–14.64 |
| 1024 B, 1 in 16 | 1.027–1.033 | 1.044–1.059, slower | 14.23–14.59 |

The `builder` and `template` ratios are not escaper against escaper, or writer
against writer: they time building and joining strings against sides that
write into a byte buffer. The json-escape twins' bands reach 20%, so only the
gains of 1.9x and more are read from that table.

Every bench's checksums agree, in both runs:

| Bench | Checksum |
| --- | --- |
| `hex` | `724140149` (mixed bytes, and mixed code units by design), `518485248` (random hex), `112582234` (digits) |
| `be-load` | `803431694`, every bit of every load kept |
| `utf8` | `940794903` (mixed and ASCII, by design) |
| `json-escape` | `171421394` (empty), `767317795` (8 B), `685581548` (13 B), `188703669` (16 B), `684331899` (32 B), `889065188` (64 B), `298561697` (100 B), `887696390` (1024 B), all at 1 in 256; `809424538` (64 B) and `685572362` (1024 B) at 1 in 16 |
| `decimal` | `579990990` (non-negative), `385357899` (signed) |

What the figures do not say:

- **Why `getU32BE` is slower.** The two sides differ only in the multiply and
  the add where `sha1LoadWord` has a shift and an OR. S5 reads the IR.
- **That the table is faster in every program.** A 256-byte table costs a
  cache line or four the first time it is touched, and on predictable input
  it gains nothing measurable. S2's non-regression benches check the effect
  on real callers.
- **That a UTF-8 candidate beats the kernel.** `wordSkip` is slower than
  `urlA` on both inputs, and no side is faster than `kernel`.
- **Where json-escape should switch.** `runs` wins at 1 byte in 256 from
  16 bytes up, is inside the band at 13 bytes, and loses at 8 bytes, on empty
  strings, and at 1 byte in 16 at both lengths measured. `jsonWriterPutBytes`
  already switches on length, at `JSON_PLAIN_RUN_MIN = 16`
  (`std/json.ts:1759`), but neither that switch nor one on density is a side
  here. So the switch the molecule needs is not measured.
- **Anything that is not a side.** Not measured: an RFC 3629 table walk with
  ASCII words skipped by SIMD; a `readonly u8[]` table for json-escape's short
  escapes; a digit count that returns `integer<1, 20>`; `jsonWriterPutDigits`
  on negative `i32` values with its suffix; and the copies §4.3 lists as not
  timed. A stage that wants one of these benches it first, and claims nothing
  for it until then.

### 4.3 Which copies are timed

Every copy in §3.2, by cluster: the ones a bench times, the ones it does not,
and what their callers pass. A copy that is not timed has no figure, even
where its shape looks like a timed side's.

| Cluster | Timed (side) | Not timed | What callers pass |
| --- | --- | --- | --- |
| `hex` | `http1HexValue` (`chainA`), `hexDigit` in `std/math.ts` (`lower`), `manifestHexDigit` in `src/manifest.ts` (`mask`) | `jwtHexValue`, `pkiHexDigit`, `jsonHexDigit`, `dnsHexValue`, `routerHex`, `tlsHexNibble`, `urlHexValue`, `regexHexValue`, `pixelsHex`, `yamlJsonHexValue`, `yamlHexValue`, `escapeDigit` in `src/emit-ts-strings.ts`, and the inline decoder at `src/constants.ts:168` | A `u8` widened to `i32` or -1: `jwtHexValue`, `dnsHexValue`, `http1HexValue`, `routerHex`, `urlHexValue` (the byte inputs). A `charCodeAt` code unit, which can be 256 or more: `pkiHexDigit`, `jsonHexDigit`, `hexDigit`, `tlsHexNibble`, `regexHexValue`, `yamlJsonHexValue` and `yamlHexValue` (both also -1), `escapeDigit`, `manifestHexDigit`, `src/constants.ts:168` (the code-unit input). A `string`: `pixelsHex` |
| `be-load` | `getU32BE` (`bytesA`), `sha1LoadWord` (`shifts`), `http2FrameU32` (`wide`) | `p256LoadWord`, `bcryptSaltWords`, and the inline loads in zlib, http1-server, tls/codec and `websocket.ts:432`; `aesLoad32`, which is `sha1LoadWord` with its shift counts written as `toU32(24)`; the inline `i32` loads that sign-extend the top byte (`postgres.ts:1749` and `:1983`, `postgres-async.ts:2210`, `websocket.ts:566`); `tls.ts:2403`, an `i64` load narrowed by `toU32`. `poly1305Le64` is little-endian and not a copy | `getU32BE`: one caller outside `std/bytes.ts`, `dns-message.ts:539`, once per resource record. The others: bytes of a frame, block or key, in their own module |
| `decimal` | every site: `http1PutDecimal` and `http1DecimalDigits` (`http1A`), `pgPutDecimal` and `pgDecimalLength` (`pg`, `pgA`), `jsonWriterPutDigits` (`json`), `jsonWriterPutDigits64` (`json64`), `http1ClientPutDecimal` and its count (`client`), `httpDecimalDigits` (`compress`) | `jsonWriterPutDigits` on negative values and with its suffix | Non-negative `i32`: the `http1` writers and `httpDecimalDigits`. Non-negative `i64`: `http1ClientPutDecimal`. Signed `i32` and a suffix: `jsonWriterPutDigits`. Signed `i64`: `jsonWriterPutDigits64`, `pgPutDecimal` |
| `json-escape` | the `jsonWriterPutString` byte loop (`byteA`), `jsonWriterPutRuns` (`runs`), `addJsonQuoted` (`builder`) | `jsonTokShortEscape` and `jsonShortEscape`, the escape tables inside the byte loops; `jsonQuote`, a wrapper over `addJsonQuoted`; the inline quoter in `src/ice.ts` `internalErrorFor` | Bytes in `std/`; a `string` in `src/` |
| `utf8` | `urlIsUtf8` (`urlA`), `bytesUtf8Length` (`bytesWalk`), `jsonTokUtf8Length` (`jsonTokLoop`, and after `skipJsonText` in `kernel`) | The validators `websocketUtf8Run` and `websocketIsUtf8` (resumable), `x509IsUtf8Name` (also refuses NUL), `termUtf8At` (replaces bad input with U+FFFD) and `src/json-typed.ts` `jsonIsUtf8` (over a `string`). The encoders `jwtUtf8Width`, `jwtUtf8Byte`, `jsonTokUtf8Width`, `jsonTokUtf8Byte`, `jsonUtf8`, `jsonUtf8Width`, `jsonUtf8Byte`, `regexPushUtf8`, `termPushUtf8` and `src/lexer.ts` `utf8Encode`. `websocketUtf8Reset` is a name match, not a copy | Bytes, as a range or a stream, in `std/`; a `string` or a code point in `src/` |
| `digit` | none | all nine | A byte or code unit as `i32` |
| `grow` | none | all eight; `quicFrameGrow` calls `quicPacketGrow` rather than copying it | A buffer and the size wanted |
| `fnv` | none | all five | A `string` by code units in `src/map.ts`; bytes in `std/` |

### 4.4 Ranking

The clusters are ranked by measured gain over the cluster's fastest existing
copy. Ties go to the gain that callers of the slower copies get, then to sites
× lines, then to risk:

1. **hex**: the table is 4.8x `lower` on mixed bytes and 5.5x `mask` on
   random hex, with no gain established on digits alone; on code units the
   guarded table is 1.5x `lower`. 15 sites and 136 lines. The risk is low
   except where a crypto caller decodes secret bytes (§10).
2. **decimal**: `pairs` is 5–6% faster than `http1PutDecimal` on non-negative
   values. On signed values `jsonWriterPutDigits64` is the fastest copy, 9–11%
   faster than `pgPutDecimal`, and `pairs64` does not beat it. 8 sites and
   159 lines.
3. **json-escape**: no gain over the fastest existing copy is measured,
   because `runs` and `byteA` each win on part of the inputs. Callers of the
   byte-by-byte quoters gain 1.9x to 4.2x on strings of 16 bytes or more with
   1 byte in 256 escaped. They lose 4–30% where `runs` is slower, unless the
   molecule switches, and that switch is not measured. 7 sites and 239 lines.
   The `src/` copies are under the freeze.
4. **be-load**: no gain over `shifts` is established; `wide` is the same
   speed. The shift form is 1.5x `getU32BE` in the micro-bench, and
   `getU32BE`'s one caller outside `std/bytes.ts` loads a DNS TTL once per
   record, so the measured gain reaches one cold load and no caller bench
   shows it. 15 sites and 59 lines, or 14 and 46 without `poly1305Le64`. It
   touches crypto modules and their records.
5. **utf8**: no candidate beats the fastest existing path, the tokenizer's
   kernel path (5.8x `urlIsUtf8` on mixed text, 1.9x on ASCII). Its gain is
   for callers of the byte-loop validators, if the kernel can serve them.
   19 sites and 440 lines, 18 without `websocketUtf8Reset`. It has the most
   lines and the most security-relevant callers (`x509`, `websocket`, `url`).
6. **digit, grow, fnv**: no bench and no gain claimed, 22 sites and 148 lines.
   These are for consolidation only.

## 5. The tiers

| Tier | What belongs there | May import | Examples from §3 |
| --- | --- | --- | --- |
| **Atoms** | A function of a byte, a word or a few scalars, with no allocation and no state. Also a byte primitive bound to a native kernel, where the kernel is the implementation. | builtins only | `hexValue`, `isDigit`, `getU32BE`, `fnv1aStep`, `decimalDigits`; `skipJsonPlain` and `copyBytes` in `std/bytes.ts` |
| **Molecules** | A walk or a write over a buffer, built from atoms. | atoms | `utf8Valid`, `utf8Length`, `jsonPutQuoted`, `putDecimal`, `grownSize` |
| **Organisms** | A public module, a whole parser or codec: what `std/` is today. | atoms, molecules and other organisms | `std/json.ts`, `std/net/url.ts`, `std/net/http1-codec.ts`, `std/crypto/jwt.ts` |
| **Pages** | A program: the compiler, a CLI, an example or a user's program. | any tier | `src/`, `examples/` |

**Kernel-bound byte primitives are atoms.** `skipBlank`, `skipDigits`,
`skipJsonText`, `skipJsonPlain` and `copyBytes` in `std/bytes.ts` walk a
buffer, but `src/kernels.ts` binds each one's walk to a runtime kernel or to
one `llvm.memmove`, so natively the Nish body is not what runs. They import
nothing. `std/bytes.ts` as a whole therefore sits in the atom tier, at its
public path `nish/bytes`. The json-escape molecule built from `skipJsonPlain`
and `copyBytes` (§7) imports atoms only, as the rule asks. `bytesUtf8Length`,
in the same file, is shaped like a molecule. The rule constrains imports
only, and a file that imports nothing keeps it. S6 decides whether that walk
moves.

Where each tier lives (D1):

- **Atoms**: `std/atoms/<topic>.ts`, imported as `nish/atoms/hex`. One file per
  topic: `hex`, `ascii`, `hash`, `decimal`. `std/bytes.ts` stays where it is
  and counts as an atom file.
- **Molecules**: `std/molecules/<topic>.ts`, for example `utf8`,
  `json-escape`, `decimal` and `grow`.
- **Organisms**: the existing `std/` modules, which stay where they are. Users
  import paths such as `nish/json`, and moving those would break them.
- **Pages**: `src/` and `examples/`, unchanged.

**The rule: a module imports only from tiers below its own, and only
organisms import within their tier.**

- An atom imports nothing but builtins, and no other atom.
- A molecule imports atoms, and no other molecule.
- An organism imports atoms, molecules and other organisms, as `std/` modules
  do today. For example, `std/net/fetch.ts` imports `nish/net/url` and
  `nish/net/dns`.
- A page imports any tier, and other pages: `src/` imports `src/`, and an
  example imports another example's module.

Keeping atoms and molecules apart from their own tier means neither tier has
an internal order to maintain. D5 decides whether to allow an atom that needs
another atom, or a molecule that needs another molecule.

**How the rule is enforced (D5).** Biome already refuses imports that cross
into test code. Its `noRestrictedImports` takes a per-glob override, so the
rule becomes three new override blocks in `biome.json`:

- `std/atoms/**` and `std/bytes.ts` refuse imports from any other `std/` or
  `nish/` module.
- `std/molecules/**` refuses imports from every `std/` module other than
  `std/atoms/**` and `std/bytes.ts`.
- Organisms do not import `src/`. That holds today, and the rule makes it
  explicit.

Pages get no block: `src/**` and `examples/**` keep importing any tier and
each other, as they do today. The one rule that covers them now, that `src/`
imports no `tests/`, `scripts/`, `bench/` or `examples/` module, is the
existing override on `src/**/*.ts` and `std/**/*.ts`, and it stays.

Not verified: whether a later override's `noRestrictedImports` options merge
with an earlier one's for a file both match, or replace them. If they
replace, each new block repeats the existing `patterns` group
(`**/tests/**`, `**/scripts/**`, `**/bench/**`, `**/examples/**`) with its
message, or the new blocks drop that rule for the files they match. S2's
fixture checks both rules on one file.

`npm run lint` runs the rule in every PR, and S2 adds a fixture that breaks the
rule to show it fires. The other option is a script in `scripts/`. It could
also check that the survey does not grow (§6), but it would be a new tool to
maintain.

## 6. Performance first: the rules for every stage

1. **A shared copy starts from the fastest existing copy of its cluster** in
   §4, or from a candidate faster than all of them, and in both cases outside
   the twin's band. A candidate §4 did not bench is benched in the stage
   before it is adopted. The stage's PR carries a `Measured:` trailer
   (`.claude/testing.md` → "A `Measured:` trailer"), with:
   - its figure against the fastest existing copy of its cluster;
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
already compiles. A construct marked *blocked* is in neither `main` nor the
seed: it belongs to a stage of another work package that has not been built,
so no stage here can use it until that stage lands and a release ships it.
A form marked *not measured* is a candidate only: §6 rule 1 benches it before
it replaces the baseline.

| Cluster | Today's form | Modern form | Shipped in |
| --- | --- | --- | --- |
| hex | an `if` chain on `i32` returning -1 | a `const HEX: readonly u8[]` table of 256 entries, indexed by a `u8`, with 255 for "not a digit"; for `i32` code units, the same table behind a guard that answers -1 outside `[0, 256)` (both measured, §4.2) | 0.40.0 |
| digit | `c >= 48 && c <= 57`, some with named bounds | one atom with the same two compares, unchanged | today |
| be-load | shifts and ORs at every surveyed site; a multiply in `std/bytes.ts` `getU32BE` | shifts and ORs (measured) | today |
| decimal | one digit a step | two digits a step from a pairs table (measured; faster on non-negative values only). A count that returns `integer<1, 20>`, so callers can drop their bounds guards (*not measured*) | tables 0.40.0, `integer<Lo,Hi>` 0.13.0 |
| json-escape | byte by byte, with a `switch` for short escapes | runs found with `skipJsonPlain` and copied with `copyBytes` where strings are long and escapes sparse, byte by byte otherwise (both measured; the switch between them *not measured*). Short escapes from a `readonly u8[]` table (*not measured*) | `skipJsonPlain`: today. Tables 0.40.0 |
| utf8 | a hand-written state machine per module | a validator that resumes from a state given as a string enum. The `skipJsonText` kernel with `jsonTokUtf8Length` at each stop, as the tokenizer runs it (measured). One RFC 3629 table walk with ASCII words skipped by SIMD (0.28.0, 0.34.0, *not measured*) | SIMD 0.34.0, string enums 0.40.0 |
| grow | `new Array<u8>(size)` and a copy | `withCapacity` and `grow` in `std/array` | *blocked* on WP65 S2, not built |
| string builders in `src/` | `src/strings.ts:21` `StringBuilder`, which pushes each part onto a `parts: string[]` and joins them; json-escape's `builder` side models it | `builder()` from `nish:string` | *blocked* on WP56 S2, not built |
| fnv | a `while` loop | a `for…of` over bytes with `u32` wrapping arithmetic, unchanged | today |

The *blocked* rows ship in today's form. A stage here does not wait for
WP65 S2 or WP56 S2, and plans no follow-up for them: if one of those stages
is built and released, moving the shared copy to the new form is a change of
its own, benched like any other, and every caller gets it at once, which is
the point of sharing.

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
  because under Node `<<` turns bit 31 into a sign. The 1.5x of `shifts` over
  `getU32BE` in the micro-bench (§4.2) must not cost that answer. S5
  measures candidates that give the native speed and the same answer under
  Node (`docs/RUN_UNDER_NODE.md`), or keeps the multiply.
- **Security records.** A stage that changes a file named in a
  `docs/security/` record's scope updates that record and its row in
  `docs/security/README.md` (§10).
- **The prover.** Whether a `u8` index into a 256-entry table needs a bounds
  check is not established: S2 reads the IR before the hex table lands. Most
  hex callers pass an `i32` code unit, not a `u8` (§4.3), so their table needs
  the explicit guard the `guarded` side has, and its cost is in that side's
  figure. A stage that
  adds an index the prover cannot discharge gets an NL9007 warning, and
  `node tests/run.js performance` fails on it.

## 9. Decisions for the owner

- **D1, the directory and the names.** `std/atoms/` and `std/molecules/`,
  imported as `nish/atoms/hex`, with `std/bytes.ts` counted as an atom file
  where it is. Organisms stay where they are and pages are `src/`. The
  alternative is one `std/internal/` directory with the tier in the file name
  (`atom-hex.ts`), which is shorter but hides the rule from the path.
  **Recommended:** the two directories.
- **D2, public or internal.** Tag the atoms and molecules `@internal`, so they
  stay out of the reference and out of the semver promise. Make one public
  only when a user program asks for it, through its own PR. A user can still
  import an `@internal` module. The tag only means it is not promised.
  `std/bytes.ts` stays public. **Recommended:** internal.
- **D3, whether `src/` imports the lower tiers directly.** If it does, the
  compiler shares the fastest copy, but every atom is then under the freeze.
  If it does not, `src/` keeps its copies and the tiers can use new constructs
  as soon as they land. **Recommended:** directly, with every atom and
  molecule within the freeze.
- **D4, divergent copies.** Unify where every caller of a divergent copy is
  shown to give the same answer through the shared one. Otherwise keep the
  difference as a second, named atom, for example `hexValueTrusted` beside
  `hexValue`. Never widen a lenient copy silently. **Recommended:** as stated.
- **D5, enforcement.** Use `noRestrictedImports` overrides in `biome.json`
  (§5) rather than a new script, with a fixture that shows the rule fires.
  Pages (`src/**`, `examples/**`) get no new block and keep importing each
  other and every tier; the existing block that keeps test code out of
  `src/` and `std/` stays, repeated in each new block if overrides replace
  rather than merge (not verified).
  Also decide whether an atom may import another atom, and a molecule another
  molecule. **Recommended:** biome; atoms import nothing, and molecules import
  atoms only.
- **D6, crypto.** A table lookup indexed by a secret byte is a cache-timing
  channel, so constant-time crypto code keeps its arithmetic copies.
  `tests/ct-asm.js` does not pin any of these loads or decoders today, so a
  stage that moves one adds a `ct-asm` spec for it. The shared hex table is
  for non-secret input only. **Recommended:** as stated, with each crypto
  caller's input recorded as secret or public in its stage.

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
  caller at once. S6 therefore lands with the RFC 3629 corner tests (overlong,
  surrogate, past U+10FFFF, cut short) run against every former caller's
  entry point, not only the molecule.
- **Scope.** `node scripts/security-scope.mjs` refuses a file that no record's
  scope names. A new `std/atoms/*.ts` or `std/molecules/*.ts` that a network
  or crypto module calls is named in the scope of the records whose code
  moved into it.

## 11. Stages

S1 is this note, with the survey and the benches. Each later stage takes one
cluster, and every stage has the same parts:

- **The sites** are §3.2's list.
- **The baseline** is the cluster's fastest existing copy in §4, rerun on the
  stage's base commit.
- **The optimisation** is the measured candidate faster than the baseline, if
  there is one. A candidate §4 did not bench is benched first (§6 rule 1).
- **The modern form** is the cluster's row of §7.
- **The acceptance test** shows that every former caller gives the same
  answers, and §3's survey reports the cluster as one copy.
- **The measurement** is a `Measured:` trailer from §6 rules 1 and 2: the
  shared copy against the baseline, and the callers' benches before and after.

| | Cluster | Baseline | Optimisation, measured gain | Non-regression benches | Depends on |
| --- | --- | --- | --- | --- | --- |
| S2 | hex, and the tier directories, the biome rule and its fixture | `lower` (`std/math.ts` `hexDigit`); `manifestHexDigit` on random hex | `table` on `u8` input: 4.8x `lower` on mixed bytes, 5.5x `manifestHexDigit` on random hex, none established on digits. `guarded` on `i32` code units: 1.5x `lower` | `bench/http1-parse`, `bench/json-tokenizer` | D1, D2, D5 |
| S3 | decimal | `http1PutDecimal` on non-negative values, `jsonWriterPutDigits64` on signed ones | `pairs`: 5–6% on non-negative values; none on signed ones. The `integer<1, 20>` count is not measured | `bench/http1-request`, `bench/json-writer` | S2 |
| S4 | json-escape | `jsonWriterPutRuns` on strings of 16 bytes or more with sparse escapes, the `jsonWriterPutString` byte loop elsewhere | a switch between the two, on length and density: not measured. No gain over the baseline is claimed; callers of the byte loop gain 1.9x to 4.2x on sparse strings from 16 bytes | `bench/json-writer` | S2, D4 |
| S5 | be-load | `shifts` (`sha1LoadWord`), the form every surveyed site has | none established: `wide` is the same speed. In the micro-bench the shift form is 1.5x `getU32BE`, whose one outside caller loads a DNS TTL once per record, if the Node answer holds | none: no existing bench times a caller of these loads | S2, D6 |
| S6 | utf8 | the tokenizer's kernel path, `skipJsonText` and then `jsonTokUtf8Length` | none measured. `wordSkip` is slower on both inputs; the table walk is not measured | `bench/json-tokenizer`, `bench/jwt-verify` | S2, S4 |
| S7 | digit | the one shape every copy has | none: one shape. Not yet measured | `bench/json-tokenizer`, `bench/compiler.mjs` | S2 |
| S8 | grow | not yet measured; the copies differ in policy | none proposed. Which policy the shared copy keeps is a D4 question | `bench/http1-request`, `bench/http1-conn` | S2 |
| S9 | fnv | the one loop every copy has | none: one shape. Not yet measured | `bench/router.ts`, `bench/compiler.mjs` | S2 |

digit, grow and fnv each get their own stage, rather than one shared stage,
because each touches different modules and records its own measurement. For
these three, the measurement is the callers' benches alone, since no
candidate is claimed to be faster.

The stages follow §4.4's ranking. S2 goes first, because it creates the
directories and the rule. After it, S3, S4, S5, S7, S8 and S9 do not depend on
one another and can run in parallel. S4 and S6 both edit `std/json.ts` and
`std/json-tokenizer.ts`, so S6 follows S4. The *blocked* rows of §7 add no
follow-up here.

### Not planned here

- Moving or renaming any public `std/` module.
- Merging `std/bytes.ts` into `std/atoms/`. It stays public at `nish/bytes`
  and counts as an atom file where it is. An atom imports no other atom, so
  where a faster form is found for one of its functions, such as S5's load,
  that function is rewritten in place.
- Sharing code between `runtime/*.c` and Nish.
- A tier above pages.
