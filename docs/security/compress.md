# Security record: compression and HTTP content coding

The record of `nish/compress/*` — DEFLATE (RFC 1951), its gzip (RFC 1952) and
zlib (RFC 1950) framings and their checksums — and of `nish/net/http-compress`,
the `Accept-Encoding` negotiation, `Content-Encoding: gzip` responses and the
decoding of a gzip or deflate request body under a limit, with the two
`Http1Connection` methods that use them. A server decompresses bodies
its clients send and parses the `Accept-Encoding` they send, so both are
attacker-facing. It says what each refuses, what bounds a hostile stream's
cost, what is read and written without a check and why that is safe, and the
test that pins each property. It is written with the code rather than after an
audit, so that an audit starts from evidence.

Anchors are function and method names in the files below at the last commit to
change them on the head that merges this record.

**Result.** Every malformed stream answers a negative `DEFLATE_ERR_*`,
`GZIP_ERR_*` or `ZLIB_ERR_*` code; none panics, and nothing a stream holds is
read or written outside the caller's windows. Output is bounded by the caller's
`limit` and the end of `out`, so a small input cannot expand without bound, and
a stream's cost is linear in its input and output. A gzip or zlib stream whose
bytes were corrupted does not decompress to other bytes: its checksum refuses
it. The `Accept-Encoding` parser reads any bytes in one pass and allocates
nothing. A request body is decoded under a limit its caller sets, and a
decompression bomb costs fewer than three times that limit in bytes inflated
to refuse (COMP-18).

Three findings were fixed after the record was first written, each with a test
that failed before the fix: `respondEncoded` could queue stale bytes for the
wire after `H1_AGAIN` (COMP-11), `GzipWriter` could panic on incompressible
input written into exactly `bound(len)` (COMP-12), and `GzipWriter.bound`,
`gzipFixedBound` and a `GzipWriter` used after `finish` panicked where they now
answer an error code (COMP-19).

The CRC-32 kernels read only the window `Crc32.update` checked
and answer what the tables answer; a review of their first version found the
AArch64 path reading four bytes past it, fixed before it shipped (COMP-13).
Which kernel runs is decided once per process from the CPU alone: CPUID leaf
1, ECX bits 1 (PCLMULQDQ) and 19 (SSE4.1), on x86-64; `getauxval(AT_HWCAP)`
bit 7 (`HWCAP_CRC32`) on Linux AArch64, and
`sysctlbyname("hw.optional.armv8_crc32")` on Darwin. Any other OS, and a
big-endian or 32-bit target, gets the tables.

The Adler-32 kernels sit behind the same seam and read only the window
`adler32Update` checked (COMP-16). The x86-64 one runs where CPUID leaf 1,
ECX bit 9 (SSSE3) says it can; the AArch64 one is NEON, which every
little-endian AArch64 has, so it asks nothing. Every other target runs the
Nish loop.

The inputs from outside are `NISH_CRC32` and `NISH_ADLER32`, each compared with
the exact string `soft` and otherwise ignored, so whoever sets a process's
environment can only send it to the Nish code, which answers the same. Two properties are accepted:
compressing a response that mixes a secret with attacker-chosen bytes leaks the
secret through the length (COMP-9, the BREACH class), and a stream of many
small dynamic blocks makes the decoder rebuild its tables for each (COMP-8).

## Scope

| File | Functions |
| --- | --- |
| `std/compress/deflate.ts` | `Inflater` (`decompress`, `inflate`, `step`, `huffman`, `lookup`, `readDynamic`, `build`, `slowDecode`, `entryOf`, `fill`, `take`, `unread`, `reset`), `InflateTable`, `inflateDouble`, `inflateCopy16`, `inflateFill16`; `Deflater` (`compress`, `compressRange`, `collectGreedy`, `collectLazy`, `longest`, `insert`, `writeBlock`, `writeSymbols`, `writeStored`, `storedBits`, `buildRle`, `putBits`, `alignBits`, `flushBits`, `begin`, `finish`, `slide`, `rebase`), `deflateLengths`, `deflateCanonical`, `deflateBound`, `compressBound`, and the loaders `deflateLoad32`, `deflateLoad64`, `deflateStore64`, `deflateMatchLength`, `deflateCtz64`; `FixedDeflater`, `fixedDeflateBound` |
| `std/compress/gzip.ts` | `GzipDecompressor`, `GzipReader`, `gzipReadHeader`; `GzipCompressor`, `GzipWriter`, `GzipFixedCompressor`, `gzipFixedBound` |
| `std/compress/zlib.ts` | `ZlibDecompressor`, `ZlibCompressor` |
| `std/compress/checksum.ts` | `Crc32`, `crc32`, `adler32`, `adler32Update` |
| `runtime/runtime-checksum.c` | `nish_crc32_hw`, `nish_crc32_update`, `nish_crc32_path`, `nish_crc32_cpu`, `nish_crc32_sysctl`, `nish_crc32_clmul`, `nish_crc32_fold`, `nish_crc32_bytes`, `nish_crc32_arm`, `nish_crc32_insn`: the CRC-32 kernels `Crc32.update` runs where the CPU has them; `nish_adler32_hw`, `nish_adler32_update`, `nish_adler32_path`, `nish_adler32_cpu`, `nish_adler32_ssse3`, `nish_adler32_neon`, `nish_adler32_hsum`, `nish_adler32_tail`: the Adler-32 kernels `adler32Update` runs |
| `src/kernels.ts`, `src/emit.ts` | `isCrc32Seam`, `isAdler32Seam`, `emitSumKernelArm`, `joinSumArms`: the call that hands `crc32Walk`'s or `adler32Walk`'s window to the kernel |
| `std/net/http-compress.ts` | `httpAcceptEncoding`, `httpQValue`, `httpCodingIs`, `httpIdentityRefused`, `httpSegments`, `HttpCompressor`; `httpContentEncoding`, `HttpBodyDecoder` (`decode`): a request body's `Content-Encoding` and its decoding under a limit |
| `std/net/http1-server.ts` | `Http1Connection.acceptEncoding`, `acceptEncodingOf`, `identityRefused`, `respondEncoded`, `unrespond` (the rest of the file is `http1-codec.md`'s) |

Out of scope: what a program does with decompressed bytes, and the carriers
that hand it a body or a field value (`http1-codec.md`, `http2.md`, `http3.md`).

## Threat model

The attacker sends the compressed bytes — a request body, a WebSocket payload,
a file — and the `Accept-Encoding` field: any bytes, any length, as many times
as the carrier allows.

A win is a panic, a read or write outside the windows
the program passed, output past `limit`, time or memory beyond a constant
times the input and output, a corrupted gzip or zlib stream accepted as other
bytes, or a field value that makes the server send a coding the client did not
accept. The program's own arguments are trusted: a window outside its array,
a negative `limit` or a level outside 0 to 9 panics, as caller misuse.

## Findings

COMP-1 to COMP-7, COMP-10, COMP-14, COMP-15 and COMP-16 are the shapes an attacker's input can take,
each checked and found to hold; they are recorded so that an audit can see
what was tried. COMP-8, COMP-9 and COMP-17 are accepted. COMP-11, COMP-12 and COMP-13 were
found by a review of the first version and fixed, and COMP-19 by WP84's sweep
of the panic sites in `checksum.ts`, `zlib.ts` and `gzip.ts`; they are the four
counted as fixed in the index. COMP-20 is open.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| COMP-1 | High if it failed | `Inflater.huffman`, `inflate`, `GzipDecompressor.decompress`, `GzipReader.advance` | A small stream must not expand without bound: a megabyte of zeros is under 2 KB of gzip. | **Holds.** Every literal and match is checked against `outEnd` before it is written, `outEnd` is `at + min(limit, out.length - at)`, and a stream that would pass it answers `DEFLATE_ERR_OUTPUT_LIMIT`. `GzipReader` counts every byte it hands out against its `limit` across members. |
| COMP-2 | High if it failed | `Inflater.huffman` | A match must not copy from before the start of the output (or before the member's start in a multi-member stream). | **Holds.** `dist > op - histStart` is `DEFLATE_ERR_DISTANCE` before any byte is copied; `histStart` is the call's `at` for a one-shot call and the member's first byte for gzip. |
| COMP-3 | High if it failed | `Inflater.build`, `readDynamic` | A dynamic header must not build a table that decodes out of bounds: over-subscribed, incomplete, too many lengths, a repeat with nothing before it or past the end, no end-of-block code. | **Holds.** Each is `DEFLATE_ERR_HUFFMAN` before the table is used; an incomplete set is allowed only for a single one-bit literal/length or distance code, as zlib allows, and its unused half decodes as `DEFLATE_ERR_SYMBOL`. Literal/length 286 and 287 and distance 30 and 31 decode as `DEFLATE_ERR_SYMBOL`. |
| COMP-4 | High if it failed | the `uncheckedGet` / `uncheckedSet` sites in `deflate.ts` and `checksum.ts` | The hot loops read and write without bounds checks. | **Holds.** Every unchecked index is one of: a table entry below a length the constructor allocated and a `readonly` field keeps (each loop re-checks the lengths it relies on before it starts); a subtable entry, at a start and a masked offset that `build` placed inside the table's capacity (`INF_LIT_ENOUGH` and `INF_DIST_ENOUGH`, the most entries any complete code of up to 15 bits needs, as zlib's `enough` computes them), and `build` answers `DEFLATE_ERR_HUFFMAN` rather than write past it; a position inside a window checked before the loop (`inflate` checks `ip <= inEnd <= src.length` and `histStart <= op <= outEnd <= out.length`, `build` checks `lens[from .. from + n)`; the fast loop runs only while `ip <= inEnd - 8` and `op <= outEnd - 290`, and enters each position into its `integer<0, 2147483639>` parameter with a checked compare); or a match candidate, which `longest` and `collectGreedy` check lies in `[histStart, p)` before reading. The decoder's sixteen-byte copy runs past the match by at most fifteen bytes, inside `outEnd`, and the next symbol overwrites them. The fast loop looks up the next symbol before refilling, from bits a refill put in the buffer: a refill leaves 64 bits of input, the longest iteration consumes 48, and a lookup reads 11. The bit writer stores a word only after checking it fits `out` itself; a store that would not is skipped and sets `overrun`, which makes the call answer `DEFLATE_NO_ROOM` (-1) instead of an end, and a block is written only once its exact size in bits fits the room, so no store a call checked the room for sets it. The one other setter is `Deflater.begin` with a negative `start`, which no stream has: it sets `overrun` without writing, and the next writing call answers -1 (`std_compress_deflate_bounds` drives it). `Crc32`'s braided table is built at the slicing table's length and read the same way. |
| COMP-5 | Medium if it failed | `Inflater.inflate`, `huffman`, `readDynamic` | A stream cut anywhere — in a header, inside a symbol, inside a stored block, in the trailer — must answer, not read past its input or hang. | **Holds.** One-shot calls answer `DEFLATE_ERR_TRUNCATED`; `inflate` with `more` rewinds to the symbol, block header or stored length it could not finish and answers `INFLATE_NEED_INPUT`, so a resumed call starts from whole bytes (`inPos` gives back what the bit buffer read ahead). Every prefix of a stream in each framing is refused, and a `GzipReader` fed 333 bytes at a time decodes every Node-written gzip stream. |
| COMP-6 | Medium if it failed | `GzipDecompressor.decompress`, `ZlibDecompressor.decompress`, `gzipReadHeader` | Corrupted framing must be refused, not skipped: trailing garbage, a header field running past the input, a wrong header CRC, a wrong CRC-32, Adler-32 or length, a preset dictionary. | **Holds.** Bytes after the last gzip member that do not start another are `GZIP_ERR_HEADER` (Node's gunzip ignores them; this refuses them); after a zlib or raw stream `DEFLATE_ERR_TRAILING`. `FEXTRA`'s length and the `FNAME` / `FCOMMENT` terminators are bounded by the input; `FHCRC` is checked; `FDICT` is `ZLIB_ERR_DICTIONARY`. Of 600 randomly corrupted gzip and zlib streams none decompresses to other bytes. |
| COMP-7 | Medium if it failed | `GzipReader` | Streaming must not buffer without bound. | **Holds.** The reader's input (16 KB) and output window (96 KB) are allocated once; a header longer than the input buffer is `GZIP_ERR_HEADER`, and decoding stops at a full window until the program reads (`INFLATE_NEED_OUTPUT`). |
| COMP-8 | Low | `Inflater.build` | Every dynamic block rebuilds its tables: about 2,500 table stores (an 11-bit literal/length table, an 8-bit distance table, their subtables and the 7-bit code-length table), for a header that can be under 20 bytes. A stream of such blocks costs some tens of operations per input byte. | **Accepted.** The cost stays linear in the input, so a client gains a constant factor at most; zlib and libdeflate build per block too. A server that takes compressed bodies bounds their size as it bounds any body. |
| COMP-9 | Medium | `HttpCompressor.compress`, `Http1Connection.respondEncoded` | Compressing a response that holds a secret beside bytes an attacker chooses lets the attacker learn the secret from the compressed length (CRIME, BREACH). | **Accepted, by design.** Compression is opt-in per response: the program decides what to compress, and the guide says not to compress a response that reflects attacker input next to a secret (a CSRF token, a session id). The compressor's running time depends on the data too; it is not for secrets. The policy (`minSaving`, `minSavingPercent`, `segmentMode`) makes whether a body is sent compressed depend on how well it compresses, which `Content-Encoding` shows: one more view of the same length signal, not a new one. |
| COMP-11 | Medium | `Http1Connection.respondEncoded` | A response that does not fit behind a half-sent one must leave the output as it was. `respondEncoded` saved `outputEnd`, then called `respond`, whose `room()` moves what is still unsent to the front of the buffer; on `H1_AGAIN` it put the saved end back over the moved bytes, so the connection queued for the wire bytes it had already sent and part of the head it withdrew. On a connection a proxy shares between clients, that desynchronises the responses. | **Fixed.** `respondEncoded` makes the room before it saves anything, so the end it puts back is one nothing moved. Before the fix, `h1 half sent: only the unsent rest is queued` failed (1,633 bytes queued where 633 were unsent); after it, it and `h1 half sent: and it is those bytes` pass. |
| COMP-12 | Medium | `GzipWriter.bound`, `write`, `flush`, `finish` | A program that sizes each call's output by `bound(len)`, as the guide shows, must never be refused or panic. `bound` assumed at most 64 KB pending, but the writer compressed its first window only once 96 KB were pending, and one call over many 64 KB windows needs each window's framing; incompressible input written 1,000 bytes at a time panicked on about the 98th write (`GzipWriter.write: a block larger than its bound`), and `flush` and `finish` went on with the failed drain's -1. A server streaming an attacker's body through a `GzipWriter` could be stopped. | **Fixed.** The writer compresses whenever 64 KB are pending, the first window too; `bound` adds the framing of every compression one call makes; `flush` and `finish` check the drain. Before the fix, `writer: noise at level 0 into exactly bound` (and 1, 6, 9) panicked; after it, they and `writer: noise at level 6 comes back` pass. |
| COMP-13 | Medium | `runtime/runtime-checksum.c` `nish_crc32_insn` | The kernels take `Crc32.update`'s window after `checksumWindow` has checked it, and must read no byte outside it: a read past the end of an array's storage can fault, or fold a neighbouring allocation's bytes into nothing the caller sees but the timing. The x86-64 path loads 16 bytes only while 16 remain and its tail is byte at a time. The AArch64 CRC32 path folded a 4-byte tail with a masked 8-byte load, reading up to four bytes past the window. The answer was right, so every agreement test passed. Nothing a CRC-32 covers is secret, so the kernels are not wiped or held to constant time. | **Fixed.** The tail loads exactly four bytes. `simd: crc32 native ${arch}` now runs every path on every length 0..256 ending against a no-access page; an over-read by one byte in the x86-64 tail made it fail (`the agreement driver`), and it passes on the fixed file. The AArch64 path before the fix was found by review and not run on ARM64 hardware; CI's `simd-arm64` job runs the test there on every push. |
| COMP-16 | Medium if it failed | `runtime/runtime-checksum.c` `nish_adler32_update`, `nish_adler32_ssse3`, `nish_adler32_neon`, `nish_adler32_tail` | The Adler-32 kernels take `adler32Update`'s window after `checksumWindow` has checked it, read it without bounds checks, and keep 32-bit sums that must not overflow before they are reduced. A read past the window can fault or fold in a neighbour's bytes; an overflow answers a wrong checksum, which a zlib stream would then refuse or, worse, accept. | **Holds.** Both kernels load 32 bytes only while 32 remain, and the tail reads byte at a time. Each stretch is at most 173 blocks (5,536 bytes, under zlib's NMAX of 5,552), so s2 stays under 2^32 even from an unreduced start of 65,535 in each half. An empty window returns the start as it came, as the walk does. Nothing an Adler-32 covers is secret, so nothing is wiped or held to constant time. |
| COMP-19 | Low | `GzipWriter.bound`, `write`, `flush`, `finish`; `gzipFixedBound` | A length or a call order must be answered, not panic: a program streaming a body sizes its output by `bound(len)` for whatever `len` it was handed, and may call the writer again after `finish` on an error path. `bound` added `len` to its window and framing in checked `i32`, so a `len` over 2,146,009,977 overflowed and panicked; `gzipFixedBound` did the same for an `n` over 1,908,874,323; and `write`, `flush` and `finish` after `finish` panicked (`GzipWriter.write: the body has been finished`). | **Fixed.** Both bounds widen to `i64` and answer `DEFLATE_NO_ROOM` past the largest size an `i32` holds (`bound` from a `len` over 2,145,000,000, a little below its overflow, `gzipFixedBound` exactly at it); the writer answers `GZIP_ERR_FINISHED` (-20) after `finish`, takes and writes nothing, and `start` begins another body. The drain that could not fit its bound, unreachable since COMP-12, ends the body with `GZIP_ERR_FINISHED` instead of panicking. The `GzipReader` and decompressor panics that remain are the caller-misuse ones the threat model names: a window outside its array, a negative `limit`, a `GzipReader.commit` of an `n` outside `0 .. inputRoom()` and a `GzipReader.read` of a `max` under 1. |
| COMP-20 | Low | `HttpCompressor` constructor (`std/net/http-compress.ts`) | The constructor sizes its output buffer once, by `compressBound(maxLength)`. Since WP84 S2, `compressBound` answers -1 for an input over 2,146,664,726 bytes, the largest whose bound fits in `i32`, where main's checked `i32` add panicked. A compressor built with a `maxLength` past that therefore gets an empty output, so the encoder has no room for any body it would compress: `compress` records `HTTP_COMPRESS_FAILED` and the body goes as it is, uncompressed and not refused. | **Open.** It is a silent decline, not a panic or a wrong byte. The fix belongs to `std/net/http-compress.ts` (WP80): refuse such a `maxLength` in the constructor, as it already refuses lengths out of order. Untested. |
| COMP-10 | Medium if it failed | `httpAcceptEncoding`, `Http1Connection.acceptEncoding` | A field value must not pick a coding the client refused, nor panic or allocate on any bytes. | **Holds.** `gzip;q=0`, `*;q=0` and `identity;q=0` are honoured; a malformed q-value or parameter skips its element only; the answer for a client that takes nothing offered and refuses identity is `HTTP_CODING_NONE`. One pass over the window, no allocation. A missing field answers identity. |
| COMP-14 | High if it failed | `FixedDeflater.compress`, `GzipFixedCompressor.compress` | The small-body encoder writes and reads without bounds checks, and is handed incompressible bodies on purpose, with a room smaller than they are, to be abandoned part way. | **Holds.** Every store is a four-byte flush made only after `o <= at + room - 4` is checked, or one of the last bytes made only after they are checked to fit; `room` is inside `out` (`deflateWindow`). An output that does not fit answers `DEFLATE_NO_ROOM` and leaves nothing past `at + room` written; one that fits exactly is accepted. Input loads read eight bytes only at positions up to `off + len - 8`, a candidate is used only when it lies in `[off, p)` within the 16 KB window, and a match is measured to at most `off + len`. The hash table is cleared before each call, so nothing of one body reaches the next. |
| COMP-15 | Medium if it failed | `Http1Connection.respondEncoded`, `unrespond`, `HttpCompressor.compressAnyway`, `HttpCompressor.oneSegment` | The policy must not send gzip or deflate to a client that refused it, nor identity, for a body within `maxLength`, to a request answered gzip that refused identity, nor leave the output half-changed when segment mode takes a compressed head back, nor send gzip or deflate without the fields that say so. | **Holds.** Every path sends gzip or deflate only when the coding passed is that one, as `httpAcceptEncoding` chose it, and `addFields` names the coding of the body last sent (a deflate body is the gzip encoders' member reframed in place as zlib, a 2-byte header and an Adler-32 trailer, so `http1IdentityHead` subtracts that coding's field length, not gzip's). `respondEncoded` sets `required` when the coding passed is gzip and the request refuses identity (`coding === HTTP_CODING_GZIP && identityRefused()`), and only then: with it set, the one-segment skip and segment mode's withdrawal are both off, and the body goes through `compressAnyway`, which answers gzip whatever the saving or segment count. `compressAnyway` still answers -1 for a body over `maxLength` (`HTTP_COMPRESS_TOO_LARGE`), and that body goes out as identity: RFC 9110 §12.5.3 lets a server send identity when it does not compress, and `maxLength` is the bound on the encoder's work and output buffer, so forcing past it is not offered. `required` is gzip's alone; deflate with identity refused takes every path below (COMP-17). Segment mode withdraws the compressed head, gzip or deflate, with `unrespond`, which restores the `outputEnd` and `closeAfter` saved after `room()` (so, as for COMP-11, nothing moved under them), and writes the identity head in its place before any body byte is queued. `Vary` follows whether the request decided the form, never the body's contents alone. The one-segment skip (`HttpCompressor.oneSegment`) runs only when `required` is not set, so never for gzip with identity refused; it sends identity without running the encoder when the coding is gzip or deflate, the body is within `minLength` and `maxLength`, and the identity head and body together, as written, fit one segment. `oneSegment` checks no identity flag of its own. A head that turns out longer is withdrawn with `unrespond` the same way and the response goes through the compress-then-compare path. Whether it skips depends on lengths alone, never on the body's bytes. |
| COMP-17 | Low | `Http1Connection.respondEncoded`, `HttpCompressor.compress`, `HttpCompressor.oneSegment` | `respondEncoded` forces compression through `compressAnyway` only when the coding passed is gzip and the request refuses identity (`coding === HTTP_CODING_GZIP && identityRefused()`). For deflate with `identity;q=0` it takes the ordinary policy, so the body goes out as identity, the form the client refused, on every path that answers identity: under `minLength` (`compress` gives -1, `HTTP_COMPRESS_TOO_SMALL`), over `maxLength` (`HTTP_COMPRESS_TOO_LARGE`), saving less than `minSaving` and `minSavingPercent` ask (`HTTP_COMPRESS_TOO_LITTLE_SAVED`), kept as it is by the one-segment skip without running the encoder (`HTTP_COMPRESS_NO_FEWER_SEGMENTS`), or withdrawn by segment mode because the deflate body takes no fewer segments (`HTTP_COMPRESS_NO_FEWER_SEGMENTS`). | **Accepted.** RFC 9110 §12.5.3 lets a server send identity when it does not compress. The response is identity and carries no `Content-Encoding`, so its fields do not mislabel it. A program that must answer such a client with deflate calls `HttpCompressor.compressAnyway` itself, as the guide says. `h1 deflate refused: 100 bytes sent as they are` (under `minLength`), `h1 deflate refused noise: too little saved, sent as it is`, `h1 deflate refused segment: one segment, sent as it is` and `h1 deflate refused long: over maxLength, sent as it is` pin the identity answers, against `h1 gzip refused segment: gzipped all the same` for gzip; `h1 deflate refused: compressAnyway sends deflate` pins the program's way out. A change that forces deflate too must change these and this row. |
| COMP-18 | High if it failed | `HttpBodyDecoder.decode`, `httpContentEncoding` | A request body is the attacker's: a few KB of gzip or zlib that inflates to gigabytes (a decompression bomb) must be refused once the decoder's `limit` is reached, at a cost bounded by the limit, not by what the body would inflate to; and no `Content-Encoding` value may make the decoder run a coding it was not built for. | **Holds.** Every call decompresses with `limit` as the decompressor's own limit, so no call writes more than `limit` bytes (COMP-1). The output array starts at four times the body, at least 4 KB and at most `limit`, and doubles on `DEFLATE_ERR_OUTPUT_LIMIT` until it is `limit` long; `DEFLATE_ERR_OUTPUT_LIMIT` with an array of `limit` or more is `HTTP_DECODE_TOO_LARGE`. A pass writes no more than its array's length. The array before the last is under `limit` (it would have been refused otherwise) and each one before that is half the next, so a bomb costs fewer than three times `limit` in bytes written: a first array of 0.4 `limit` grows to 0.8 and then to `limit`, 2.2 times in all. It takes at most `max(1, ceil(log2(limit / 4096)) + 1)` passes (one for a `limit` of 4096 or less, whose first array is `limit` long; nine for the handler's one MiB), each reading no more than the body. Growing allocates the new array while the old one is still held, so at the peak a decode holds under twice `limit` in output arrays beside the encoded body; once a body is decoded the handler swaps the arrays, the request taking the decoded one and the decoder keeping the request's encoded one to write into next. Every other error is `HTTP_DECODE_MALFORMED`. `httpContentEncoding` answers gzip only for one `gzip` or `x-gzip` and deflate (zlib) only for one `deflate`, ignoring case, whitespace, empty elements and `identity`; any other token, a byte outside a token, or two codings is `HTTP_CODING_NONE`, which `decode` is never asked to run (it panics on it, a bug in the caller). |

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
- **COMP-14** (`std_http_compress`): `fixed: random JSON of 0 to 30000
  bytes gunzips back`, `fixed: random bytes gunzip back`, `fixed: long runs
  gunzip back`, `fixed: a window at an offset`, `fixed: a match 16000 back`,
  `fixed: too little room is DEFLATE_NO_ROOM`, `fixed: room under the gzip
  framing is DEFLATE_NO_ROOM`, `fixed: exactly the room it needs` (the first
  version kept eight bytes of slack and refused this one), `policy: random
  bytes save nothing`; (`std_compress_node`) the `fixed` raw and gzip streams,
  JSON of 700 bytes and 16 KB among them, inflate under Node's zlib.
- **COMP-15** (`std_http_compress`): `h1 refused: 100 bytes gzipped all the
  same`, `h1 q0: sent as it is, with vary`, `h1 none acceptable: identity,
  with vary`, `h1 one segment: sent as it is`, `h1 one segment: no vary`,
  `h1 one segment: http1IdentityHead is the head written`, `h1 behind: the
  second is whole, as it is`, `policy: which does not vary`, `skip one: sent
  as it is`, `skip one: no vary`, `skip one: and no encoder ran`, `skip exact:
  no encoder ran`, `skip over: one encoder run`, `skip not accepted: as it is,
  with vary`, `skip refused: gzipped`, `h1 gzip refused segment: gzipped
  all the same`, `refused: but not past maxLength`, `h1 gzip refused long:
  over maxLength, gzip too is sent as it is`, `deflate fields: content-encoding:
  deflate`, `deflate fields: then gzip again`, `h1 deflate: content-encoding:
  deflate`, `h1 deflate: the body inflates to the JSON`, `h1 deflate wide:
  http1IdentityHead is the head written`, `deflate level: and its bytes,
  header and Adler-32 alike`.
- **COMP-12** (`std_compress`): `writer: noise at level ${level} into exactly
  bound` and `writer: noise at level ${level} comes back`, at levels 0, 1, 6
  and 9.
- **COMP-19** (`link/std_compress_gzip_errors: exits with 0 and stdout
  matches expected.out`): `gzip fixed: a bound past the largest`, `writer: a
  bound past the largest`, `writer: the largest bound is a size`, `writer:
  write after finish`, `writer: flush after finish`, `writer: finish after
  finish`, `writer: start begins a new body` and `writer: the new body
  decodes`; each of the first, second and the three after-finish lines
  panicked before the fix. The same program pins the answers the sweep left
  in place for truncated and corrupted streams: `zlib: every prefix is
  truncated`, `gzip: every prefix is an error`, `gzip: every prefix ended by
  endInput is an error to the reader`, `zlib: every flipped byte is an error
  or a decode whose Adler-32 matched` (one flip in its stream is a genuine
  Adler-32 collision, so the check allows a decode that returns the whole
  length) and `gzip: every checked byte flipped is an error or the data
  itself`.
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
  nish_crc32_hw answers 0 there`.

  The targets CI does not run are compiled
  instead: `crc32 kernel: runtime-checksum.c for ${label} selects the kernel,
  asking the C library for ...` on x86-64 and arm64 Darwin, and `crc32
  kernel: runtime-checksum.c for ${label} is the stub, nish_crc32_hw and
  nish_crc32_update and nothing it asks for` on i686, ARMv7, big-endian
  AArch64, and x86-64 and AArch64 with the intrinsics headers hidden.
- **COMP-16** (`tests/simd/adler32.c`, through `tests/run.js`): `simd:
  adler32 native ${arch}: N cases agree across <paths>`, which holds the
  kernel to a byte-at-a-time reference on the check value, unreduced starts,
  every length around the 32-byte block and the 5,536-byte stretch, long runs
  of 0xff, and lengths 0..256 ending at a guard page and starting just after
  one; `adler32 kernel: ${program} prints the same bytes with NISH_ADLER32
  unset and with NISH_ADLER32=soft, and they are its expected.out` for
  `std_compress_adler_paths` and `std_compress_adler_diff`; `adler32 kernel:
  ${program} under NISH_ADLER32=soft calls no kernel`; `simd: --profile wasi
  links runtime-checksum.c, and nish_adler32_hw answers 0 there`; and, for
  the targets CI does not run, `adler32 kernel: runtime-checksum.c for
  ${label} selects the kernel, ...` on x86-64 and arm64 Darwin and `... is the
  stub, nish_adler32_hw and nish_adler32_update and no other nish_adler32_
  symbol` on i686, ARMv7, big-endian AArch64, and x86-64 and AArch64 with the
  intrinsics headers hidden.
- **COMP-18** (`net_handler_bomb`): in
  `link/net_handler_bomb: exits with 0 and stdout matches expected.out`,
  "a body decoding to exactly the cap is taken", "one byte past the cap is
  answered 413", "the bomb is a thousandth of what it inflates to", "the gzip
  bomb is answered 413", "a deflate bomb is answered 413", "a gzip body with
  a wrong CRC is answered 400", "a zlib body cut short is answered 400", "a
  plain body sent as gzip is answered 400", "an x-gzip body in capitals is
  taken", "two codings in one field are taken", "as they arrived".
- Interoperability: `link/std_compress_node: each of the ${judged.lines} streams Nish compresses (every level, raw, gzip, zlib and GzipWriter) inflates under Node's zlib to its input`.

Not fuzzed with libFuzzer yet: the corruption and prefix loops above are the
fuzzing so far. An `inflate` target in `tests/fuzz/targets/` is the next step.
