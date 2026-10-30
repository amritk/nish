# Security record: compression and HTTP content coding

The record of `nish/compress/*` — DEFLATE (RFC 1951), its gzip (RFC 1952) and
zlib (RFC 1950) framings and their checksums — and of `nish/net/http-compress`,
the `Accept-Encoding` negotiation and `Content-Encoding: gzip` responses, with
the two `Http1Connection` methods that use them. A server decompresses bodies
its clients send and parses the `Accept-Encoding` they send, so both are
attacker-facing. It says what each refuses, what bounds a hostile stream's
cost, what is read and written without a check and why that is safe, and the
test that pins each property. It is written with the code rather than after an
audit, so that an audit starts from evidence.

Anchors are function and method names in the files below at the last commit to
change them on the head that merges this record.

**Result.** Every malformed stream answers a negative `DEFLATE_ERR_*`,
`GZIP_ERR_*` or `ZLIB_ERR_*` code; none panics, and nothing a stream holds is
read or written outside the caller's windows. Output is bounded by the
caller's `limit` and the end of `out`, so a small input cannot expand without
bound, and a stream's cost is linear in its input and output. A gzip or zlib
stream whose bytes were corrupted does not decompress to other bytes: its
checksum refuses it. The `Accept-Encoding` parser reads any bytes in one pass
and allocates nothing. Two findings were fixed after the record was first
written, each with a test that failed before the fix: `respondEncoded` could
queue stale bytes for the wire after `H1_AGAIN` (COMP-11), and `GzipWriter`
could panic on incompressible input written into exactly `bound(len)`
(COMP-12). The CRC-32 kernels read only the window `Crc32.update` checked
and answer what the tables answer; a review of their first version found the
AArch64 path reading four bytes past it, fixed before it shipped (COMP-13).
Which kernel runs is decided once per process from the CPU alone: CPUID leaf
1, ECX bits 1 (PCLMULQDQ) and 19 (SSE4.1), on x86-64; `getauxval(AT_HWCAP)`
bit 7 (`HWCAP_CRC32`) on Linux AArch64, and
`sysctlbyname("hw.optional.armv8_crc32")` on Darwin. Any other OS, and a
big-endian or 32-bit target, gets the tables. The one input from outside is
`NISH_CRC32`, compared with the exact string `soft` and otherwise ignored,
so whoever sets a process's environment can only send it to the tables,
which answer the same.
Two properties are accepted: compressing a response that mixes a
secret with attacker-chosen bytes leaks the secret through the length
(COMP-9, the BREACH class), and a stream of many small dynamic blocks makes
the decoder rebuild its tables for each (COMP-8).

## Scope

| File | Functions |
| --- | --- |
| `std/compress/deflate.ts` | `Inflater` (`decompress`, `inflate`, `step`, `huffman`, `lookup`, `readDynamic`, `build`, `slowDecode`, `entryOf`, `fill`, `take`, `unread`, `reset`), `InflateTable`, `inflateDouble`, `inflateCopy16`, `inflateFill16`; `Deflater` (`compress`, `compressRange`, `collectGreedy`, `collectLazy`, `longest`, `insert`, `writeBlock`, `writeSymbols`, `writeStored`, `storedBits`, `buildRle`, `putBits`, `alignBits`, `flushBits`, `begin`, `finish`, `slide`, `rebase`), `deflateLengths`, `deflateCanonical`, `deflateBound`, `compressBound`, and the loaders `deflateLoad32`, `deflateLoad64`, `deflateStore64`, `deflateMatchLength`, `deflateCtz64` |
| `std/compress/gzip.ts` | `GzipDecompressor`, `GzipReader`, `gzipReadHeader`; `GzipCompressor`, `GzipWriter` |
| `std/compress/zlib.ts` | `ZlibDecompressor`, `ZlibCompressor` |
| `std/compress/checksum.ts` | `Crc32`, `crc32`, `adler32`, `adler32Update` |
| `runtime/runtime-checksum.c` | `nish_crc32_hw`, `nish_crc32_update`, `nish_crc32_path`, `nish_crc32_cpu`, `nish_crc32_sysctl`, `nish_crc32_clmul`, `nish_crc32_fold`, `nish_crc32_bytes`, `nish_crc32_arm`, `nish_crc32_insn`: the CRC-32 kernels `Crc32.update` runs where the CPU has them |
| `src/kernels.ts`, `src/emit.ts` | `isCrc32Seam`, `emitCrc32KernelArm`: the call that hands `crc32Walk`'s window to the kernel |
| `std/net/http-compress.ts` | `httpAcceptEncoding`, `httpQValue`, `httpCodingIs`, `HttpCompressor` |
| `std/net/http1-server.ts` | `Http1Connection.acceptEncoding`, `Http1Connection.respondEncoded` (the rest of the file is `http1.md`'s) |

Out of scope: what a program does with decompressed bytes, and the carriers
that hand it a body or a field value (`http1.md`, `http2.md`, `http3.md`).

## Threat model

The attacker sends the compressed bytes — a request body, a WebSocket payload,
a file — and the `Accept-Encoding` field: any bytes, any length, as many times
as the carrier allows. A win is a panic, a read or write outside the windows
the program passed, output past `limit`, time or memory beyond a constant
times the input and output, a corrupted gzip or zlib stream accepted as other
bytes, or a field value that makes the server send a coding the client did not
accept. The program's own arguments are trusted: a window outside its array,
a negative `limit` or a level outside 0 to 9 panics, as caller misuse.

## Findings

COMP-1 to COMP-7 and COMP-10 are the shapes an attacker's input can take,
each checked and found to hold; they are recorded so that an audit can see
what was tried. COMP-8 and COMP-9 are accepted. COMP-11, COMP-12 and COMP-13 were
found by a review of the first version and fixed; they are the three counted
as fixed in the index, and none is open.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| COMP-1 | High if it failed | `Inflater.huffman`, `inflate`, `GzipDecompressor.decompress`, `GzipReader.advance` | A small stream must not expand without bound: a megabyte of zeros is under 2 KB of gzip. | **Holds.** Every literal and match is checked against `outEnd` before it is written, `outEnd` is `at + min(limit, out.length - at)`, and a stream that would pass it answers `DEFLATE_ERR_OUTPUT_LIMIT`. `GzipReader` counts every byte it hands out against its `limit` across members. |
| COMP-2 | High if it failed | `Inflater.huffman` | A match must not copy from before the start of the output (or before the member's start in a multi-member stream). | **Holds.** `dist > op - histStart` is `DEFLATE_ERR_DISTANCE` before any byte is copied; `histStart` is the call's `at` for a one-shot call and the member's first byte for gzip. |
| COMP-3 | High if it failed | `Inflater.build`, `readDynamic` | A dynamic header must not build a table that decodes out of bounds: over-subscribed, incomplete, too many lengths, a repeat with nothing before it or past the end, no end-of-block code. | **Holds.** Each is `DEFLATE_ERR_HUFFMAN` before the table is used; an incomplete set is allowed only for a single one-bit literal/length or distance code, as zlib allows, and its unused half decodes as `DEFLATE_ERR_SYMBOL`. Literal/length 286 and 287 and distance 30 and 31 decode as `DEFLATE_ERR_SYMBOL`. |
| COMP-4 | High if it failed | the `uncheckedGet` / `uncheckedSet` sites in `deflate.ts` and `checksum.ts` | The hot loops read and write without bounds checks. | **Holds.** Every unchecked index is one of: a table entry below a length the constructor allocated and a `readonly` field keeps (each loop re-checks the lengths it relies on before it starts); a subtable entry, at a start and a masked offset that `build` placed inside the table's capacity (`INF_LIT_ENOUGH` and `INF_DIST_ENOUGH`, the most entries any complete code of up to 15 bits needs, as zlib's `enough` computes them), and `build` panics rather than write past it; a position inside a window checked before the loop (`inflate` checks `ip <= inEnd <= src.length` and `histStart <= op <= outEnd <= out.length`, `build` checks `lens[from .. from + n)`; the fast loop runs only while `ip <= inEnd - 8` and `op <= outEnd - 290`, and enters each position into its `integer<0, 2147483639>` parameter with a checked compare); or a match candidate, which `longest` and `collectGreedy` check lies in `[histStart, p)` before reading. The decoder's sixteen-byte copy runs past the match by at most fifteen bytes, inside `outEnd`, and the next symbol overwrites them. The fast loop looks up the next symbol before refilling, from bits a refill put in the buffer: a refill leaves 64 bits of input, the longest iteration consumes 48, and a lookup reads 11. The bit writer's stores are checked by `deflateRoom` against `out` itself, and a block is written only once its exact size in bits fits the room. `Crc32`'s braided table is built at the slicing table's length and read the same way. |
| COMP-5 | Medium if it failed | `Inflater.inflate`, `huffman`, `readDynamic` | A stream cut anywhere — in a header, inside a symbol, inside a stored block, in the trailer — must answer, not read past its input or hang. | **Holds.** One-shot calls answer `DEFLATE_ERR_TRUNCATED`; `inflate` with `more` rewinds to the symbol, block header or stored length it could not finish and answers `INFLATE_NEED_INPUT`, so a resumed call starts from whole bytes (`inPos` gives back what the bit buffer read ahead). Every prefix of a stream in each framing is refused, and a `GzipReader` fed 333 bytes at a time decodes every Node-written gzip stream. |
| COMP-6 | Medium if it failed | `GzipDecompressor.decompress`, `ZlibDecompressor.decompress`, `gzipReadHeader` | Corrupted framing must be refused, not skipped: trailing garbage, a header field running past the input, a wrong header CRC, a wrong CRC-32, Adler-32 or length, a preset dictionary. | **Holds.** Bytes after the last gzip member that do not start another are `GZIP_ERR_HEADER` (Node's gunzip ignores them; this refuses them); after a zlib or raw stream `DEFLATE_ERR_TRAILING`. `FEXTRA`'s length and the `FNAME` / `FCOMMENT` terminators are bounded by the input; `FHCRC` is checked; `FDICT` is `ZLIB_ERR_DICTIONARY`. Of 600 randomly corrupted gzip and zlib streams none decompresses to other bytes. |
| COMP-7 | Medium if it failed | `GzipReader` | Streaming must not buffer without bound. | **Holds.** The reader's input (16 KB) and output window (96 KB) are allocated once; a header longer than the input buffer is `GZIP_ERR_HEADER`, and decoding stops at a full window until the program reads (`INFLATE_NEED_OUTPUT`). |
| COMP-8 | Low | `Inflater.build` | Every dynamic block rebuilds its tables: about 2,500 table stores (an 11-bit literal/length table, an 8-bit distance table, their subtables and the 7-bit code-length table), for a header that can be under 20 bytes. A stream of such blocks costs some tens of operations per input byte. | **Accepted.** The cost stays linear in the input, so a client gains a constant factor at most; zlib and libdeflate build per block too. A server that takes compressed bodies bounds their size as it bounds any body. |
| COMP-9 | Medium | `HttpCompressor.compress`, `Http1Connection.respondEncoded` | Compressing a response that holds a secret beside bytes an attacker chooses lets the attacker learn the secret from the compressed length (CRIME, BREACH). | **Accepted, by design.** Compression is opt-in per response: the program decides what to compress, and the guide says not to compress a response that reflects attacker input next to a secret (a CSRF token, a session id). The compressor's running time depends on the data too; it is not for secrets. |
| COMP-11 | Medium | `Http1Connection.respondEncoded` | A response that does not fit behind a half-sent one must leave the output as it was. `respondEncoded` saved `outputEnd`, then called `respond`, whose `room()` moves what is still unsent to the front of the buffer; on `H1_AGAIN` it put the saved end back over the moved bytes, so the connection queued for the wire bytes it had already sent and part of the head it withdrew. On a connection a proxy shares between clients, that desynchronises the responses. | **Fixed.** `respondEncoded` makes the room before it saves anything, so the end it puts back is one nothing moved. Before the fix, `h1 half sent: only the unsent rest is queued` failed (1,633 bytes queued where 633 were unsent); after it, it and `h1 half sent: and it is those bytes` pass. |
| COMP-12 | Medium | `GzipWriter.bound`, `write`, `flush`, `finish` | A program that sizes each call's output by `bound(len)`, as the guide shows, must never be refused or panic. `bound` assumed at most 64 KB pending, but the writer compressed its first window only once 96 KB were pending, and one call over many 64 KB windows needs each window's framing; incompressible input written 1,000 bytes at a time panicked on about the 98th write (`GzipWriter.write: a block larger than its bound`), and `flush` and `finish` went on with the failed drain's -1. A server streaming an attacker's body through a `GzipWriter` could be stopped. | **Fixed.** The writer compresses whenever 64 KB are pending, the first window too; `bound` adds the framing of every compression one call makes; `flush` and `finish` check the drain. Before the fix, `writer: noise at level 0 into exactly bound` (and 1, 6, 9) panicked; after it, they and `writer: noise at level 6 comes back` pass. |
| COMP-13 | Medium | `runtime/runtime-checksum.c` `nish_crc32_insn` | The kernels take `Crc32.update`'s window after `checksumWindow` has checked it, and must read no byte outside it: a read past the end of an array's storage can fault, or fold a neighbouring allocation's bytes into nothing the caller sees but the timing. The x86-64 path loads 16 bytes only while 16 remain and its tail is byte at a time. The AArch64 CRC32 path folded a 4-byte tail with a masked 8-byte load, reading up to four bytes past the window. The answer was right, so every agreement test passed. Nothing a CRC-32 covers is secret, so the kernels are not wiped or held to constant time. | **Fixed.** The tail loads exactly four bytes. `simd: crc32 native ${arch}` now runs every path on every length 0..256 ending against a no-access page; an over-read by one byte in the x86-64 tail made it fail (`the agreement driver`), and it passes on the fixed file. The AArch64 path before the fix was found by review and not run on ARM64 hardware; CI's `simd-arm64` job runs the test there on every push. |
| COMP-10 | Medium if it failed | `httpAcceptEncoding`, `Http1Connection.acceptEncoding` | A field value must not pick a coding the client refused, nor panic or allocate on any bytes. | **Holds.** `gzip;q=0`, `*;q=0` and `identity;q=0` are honoured; a malformed q-value or parameter skips its element only; the answer for a client that takes nothing offered and refuses identity is `HTTP_CODING_NONE`. One pass over the window, no allocation. A missing field answers identity. |

## Properties verified

Each property is pinned by a test that fails if it stops holding. The
modules' checks are lines of each program's `expected.out`, compared byte for
byte by `link/std_compress: exits with 0 and stdout matches expected.out`,
`link/std_compress_node: exits with 0 and stdout matches expected.out` and
`link/std_http_compress: exits with 0 and stdout matches expected.out`.

- **COMP-1** (`std_compress`): `limit: 64 KB of it is refused`, `limit: an
  output buffer shorter than the limit is the limit`, `reader: the limit stops
  it`, and every round trip's `a limit of n - 1` refusal.
- **COMP-2, COMP-3** (`std_compress`, `std_compress_node`): the hand-built
  streams `deflate: a distance before the start of the output`, `deflate:
  literal/length 286 is refused`, `deflate: distance 30 is refused`, `deflate:
  an over-subscribed code is refused`, `deflate: a repeat with no length before
  it`, `deflate: a code with no end-of-block`, and the Node-checked fixtures
  `raw: a distance before the start`, `raw: an over-subscribed code-length
  code`, `raw: an incomplete literal/length code`, which
  `link/std_compress_node: Node's zlib refuses each of the ${refused.count} malformed fixtures`
  confirms Node refuses too.
- **COMP-4, COMP-5** (`std_compress`): `truncated raw/gzip/zlib: every prefix
  is refused`, `corrupted raw: 300 corrupted streams decompressed without a
  panic`, the 1,500-input fuzz, and `reader: input that ends inside the
  stream`; (`std_compress_node`) every gzip fixture through a `GzipReader` fed
  333 bytes at a time.
- **COMP-6** (`std_compress`): `gzip: a wrong CRC-32`, `gzip: a wrong length`,
  `gzip: trailing bytes after the member`, `gzip: a wrong header CRC`, `zlib:
  a wrong Adler-32`, `zlib: a preset dictionary is refused`, `zlib: trailing
  bytes`, `raw: trailing bytes`, `corrupted gzip/zlib: no corrupted stream
  decompresses to other bytes`.
- **COMP-7** (`std_compress`): `reader: a header longer than the input buffer
  is refused`.
- **COMP-10** (`std_http_compress`): the `accept:` lines.
- **COMP-11** (`std_http_compress`): `h1 half sent: only the unsent rest is
  queued`, `h1 half sent: and it is those bytes`.
- **COMP-12** (`std_compress`): `writer: noise at level ${level} into exactly
  bound` and `writer: noise at level ${level} comes back`, at levels 0, 1, 6
  and 9.
- **COMP-13** (`tests/simd/crc32.c`, through `tests/run.js`): `simd: crc32
  native ${arch}: N cases agree across <paths>`, which holds every kernel to a
  bit-at-a-time reference on the check value, the empty input, lengths
  0..4,096 at offsets 0..15, 1 to 16 MiB, streamed pieces and a stream split
  once around each fold boundary, and lengths 0..256 ending at a guard page
  and starting just after one; `crc32 kernel: ${program} prints the same
  bytes with NISH_CRC32 unset and with NISH_CRC32=soft, and they are its
  expected.out` for `std_compress_crc_paths`, `std_compress_crc_diff` and
  `std_compress_gzip_files` (the system `gzip`'s files read, and Nish's read
  back by it); `crc32 kernel: ${program} under NISH_CRC32=soft calls no
  kernel`; and `simd: --profile wasi links runtime-checksum.c, and
  nish_crc32_hw answers 0 there`. The targets CI does not run are compiled
  instead: `crc32 kernel: runtime-checksum.c for ${label} selects the kernel,
  asking the C library for ...` on x86-64 and arm64 Darwin, and `crc32
  kernel: runtime-checksum.c for ${label} is the stub, nish_crc32_hw and
  nish_crc32_update and nothing it asks for` on i686, ARMv7, big-endian
  AArch64, and x86-64 and AArch64 with the intrinsics headers hidden.
- Interoperability: `link/std_compress_node: each of the ${judged.lines} streams Nish compresses (every level, raw, gzip, zlib and GzipWriter) inflates under Node's zlib to its input`.

Not fuzzed with libFuzzer yet: the corruption and prefix loops above are the
fuzzing so far. An `inflate` target in `tests/fuzz/targets/` is the next step.
