# gzip: one-shot compression of a JSON response

`main.ts` gzips `feed.json` (5,221 bytes of feed JSON, written by `feed.mjs`,
which gzip -6 takes to about 1.85 KB) with a reused `GzipCompressor` into a
reused buffer, at level 1 and level 6, and gunzips it back with a reused
`GzipDecompressor` (or, given two gzip streams after the body and the call
count, gunzips those). `gzip.c` does the same with zlib (a reused `z_stream`,
`deflateReset` per call) and libdeflate (a reused compressor). `run.mjs`
builds both, runs them alternately and reports the median of the rounds:

```bash
node bench/gzip/run.mjs --rounds 9 --calls 10000
```

It needs clang, zlib and libdeflate's shared object (`libdeflate.so.0`).

## Result

A 2.3 GHz Xeon virtual machine (4 cores, AVX-512 and PCLMULQDQ present),
clang 18, the system zlib 1.3 and libdeflate; 9 rounds of 10,000 calls. Rounds
on this machine vary by about ±5 %.

| op | level | library | size | µs/call | MB/s | vs libdeflate |
| --- | --- | --- | --- | --- | --- | --- |
| gzip | -1 | nish | 1890 | 16.48 | 317 | 1.33x |
| gzip | -1 | libdeflate | 1888 | 12.37 | 422 | 1.00x |
| gzip | -1 | zlib | 1958 | 20.70 | 252 | 1.67x |
| gzip | -6 | nish | 1863 | 30.26 | 173 | 1.42x |
| gzip | -6 | libdeflate | 1846 | 21.26 | 246 | 1.00x |
| gzip | -6 | zlib | 1864 | 32.27 | 162 | 1.52x |
| gunzip | -1 | nish | 1890 | 8.19 | 638 | 1.35x |
| gunzip | -1 | libdeflate | 1888 | 6.08 | 859 | 1.00x |
| gunzip | -1 | zlib | 1958 | 11.66 | 448 | 1.92x |
| gunzip | -6 | nish | 1863 | 8.23 | 634 | 1.45x |
| gunzip | -6 | libdeflate | 1846 | 5.67 | 921 | 1.00x |
| gunzip | -6 | zlib | 1864 | 11.03 | 473 | 1.95x |

Level 1 writes libdeflate's size (1,890 bytes against 1,888) in 1.33 times its
time, and is 1.25 times faster than zlib's level 1, which writes 70 bytes more.
Level 6 is a little faster than zlib's at zlib's size. Decompression takes 1.35
to 1.45 times libdeflate's time and about 0.7 times zlib's. Everything is pure
Nish: no C kernel, no SIMD.

Where the rest of libdeflate's lead comes from, measured with callgrind on the
same body:

- **CRC-32.** libdeflate picks a PCLMULQDQ (here VPCLMULQDQ) kernel at run
  time and checksums the 5 KB body in 0.16 us; Nish's braided slicing-by-8,
  the fastest table method, takes 0.8 us. That is 0.6 us of every gzip and
  gunzip row, and carry-less multiplication is not something Nish can say.
- **Decompression** runs the same design as libdeflate's (11-bit tables with
  subtables, a lookup ahead of the refill, word copies) in about 1.8 times its
  instructions (107,000 against 60,000 for the raw stream): bounds and
  overflow checks the compiler cannot yet prove away, word loads and stores
  that LLVM splits back into bytes, and table builds about twice as long.
- **Compression** executes about 1.7 times libdeflate's instructions (354,000
  against 210,000 at level 1, 674,000 against 389,000 at level 6): its match
  finder keeps 32-bit positions where libdeflate's keeps 16-bit ones, and
  libdeflate's block writer and Huffman construction are tighter.

## Against other languages

`compare/compare.mjs` runs the same workload in every language it finds a
toolchain for: C's zlib and libdeflate (`gzip.c`), Go's standard library and
klauspost/compress, Rust's flate2 over miniz_oxide and over zlib-rs, Java's
java.util.zip, Node's and Bun's `node:zlib`, Bun's own `Bun.gzipSync` (which
is libdeflate inside), and Python's zlib, each with the state its library lets
it reuse from call to call. Every decoder decompresses the same two streams
(the body gzipped by Node's zlib at level 1 and level 6), so each does the
same work whatever its own compressor writes; a compressor's output size is in
its row, since a level means something different to each library.

```bash
npm run build && node bench/gzip/compare/compare.mjs --rounds 9 --calls 10000
```

Same machine, 9 rounds of 10,000 calls, the median; Go 1.24, Rust 1.97 (flate2
1.1), OpenJDK, Node 22, Bun 1.4, Python 3.13. Every build is for the baseline
x86-64 instruction set, as Nish's `speed` profile is; libdeflate and zlib-rs
choose SIMD code at run time where the CPU has it, which no build flag here
takes away.

### gzip -1

| rank | library | output bytes | µs/call | MB/s | vs nish |
| --- | --- | --- | --- | --- | --- |
| 1 | rust-zlib-rs | 2595 | 11.30 | 462 | 0.70x |
| 2 | libdeflate | 1888 | 12.42 | 420 | 0.77x |
| 3 | bun-native | 2595 | 13.31 | 392 | 0.82x |
| 4 | **nish** | 1890 | 16.17 | 323 | 1.00x |
| 5 | go-klauspost | 1992 | 16.47 | 317 | 1.02x |
| 6 | java | 1958 | 19.28 | 271 | 1.19x |
| 7 | rust-miniz_oxide | 2053 | 19.50 | 268 | 1.21x |
| 8 | zlib | 1958 | 20.17 | 259 | 1.25x |
| 9 | bun-zlib | 2595 | 25.09 | 208 | 1.55x |
| 10 | go-std | 2037 | 25.16 | 208 | 1.56x |
| 11 | node-zlib | 1909 | 26.51 | 197 | 1.64x |
| 12 | python | 1958 | 46.74 | 112 | 2.89x |

### gzip -6

| rank | library | output bytes | µs/call | MB/s | vs nish |
| --- | --- | --- | --- | --- | --- |
| 1 | libdeflate | 1846 | 21.69 | 241 | 0.74x |
| 2 | go-klauspost | 1853 | 24.44 | 214 | 0.84x |
| 3 | rust-zlib-rs | 1856 | 27.29 | 191 | 0.94x |
| 4 | **nish** | 1863 | 29.13 | 179 | 1.00x |
| 5 | bun-native | 1856 | 29.80 | 175 | 1.02x |
| 6 | java | 1864 | 30.78 | 170 | 1.06x |
| 7 | node-zlib | 1845 | 31.08 | 168 | 1.07x |
| 8 | zlib | 1864 | 32.08 | 163 | 1.10x |
| 9 | rust-miniz_oxide | 1866 | 37.61 | 139 | 1.29x |
| 10 | bun-zlib | 1856 | 43.89 | 119 | 1.51x |
| 11 | go-std | 1849 | 49.48 | 106 | 1.70x |
| 12 | python | 1864 | 59.63 | 88 | 2.05x |

### gunzip -1

| rank | library | input bytes | µs/call | MB/s | vs nish |
| --- | --- | --- | --- | --- | --- |
| 1 | libdeflate | 1909 | 5.89 | 887 | 0.72x |
| 2 | **nish** | 1909 | 8.17 | 639 | 1.00x |
| 3 | rust-zlib-rs | 1909 | 8.44 | 619 | 1.03x |
| 4 | rust-miniz_oxide | 1909 | 9.42 | 554 | 1.15x |
| 5 | java | 1909 | 10.64 | 491 | 1.30x |
| 6 | go-klauspost | 1909 | 11.18 | 467 | 1.37x |
| 7 | zlib | 1909 | 11.77 | 444 | 1.44x |
| 8 | python | 1909 | 12.04 | 434 | 1.47x |
| 9 | bun-native | 1909 | 12.95 | 403 | 1.59x |
| 10 | node-zlib | 1909 | 15.17 | 344 | 1.86x |
| 11 | go-std | 1909 | 17.12 | 305 | 2.10x |
| 12 | bun-zlib | 1909 | 23.92 | 218 | 2.93x |

### gunzip -6

| rank | library | input bytes | µs/call | MB/s | vs nish |
| --- | --- | --- | --- | --- | --- |
| 1 | libdeflate | 1845 | 5.74 | 910 | 0.70x |
| 2 | **nish** | 1845 | 8.18 | 638 | 1.00x |
| 3 | rust-zlib-rs | 1845 | 8.21 | 636 | 1.00x |
| 4 | rust-miniz_oxide | 1845 | 9.11 | 573 | 1.11x |
| 5 | java | 1845 | 10.22 | 511 | 1.25x |
| 6 | go-klauspost | 1845 | 11.04 | 473 | 1.35x |
| 7 | zlib | 1845 | 11.33 | 461 | 1.39x |
| 8 | python | 1845 | 11.63 | 449 | 1.42x |
| 9 | bun-native | 1845 | 12.22 | 427 | 1.49x |
| 10 | node-zlib | 1845 | 14.17 | 368 | 1.73x |
| 11 | go-std | 1845 | 16.54 | 316 | 2.02x |
| 12 | bun-zlib | 1845 | 24.43 | 214 | 2.99x |

Nish decompresses faster than every library here but libdeflate, level with
or ahead of zlib-rs. At level 1 it compresses level with klauspost/compress
and faster than zlib, Go's standard library, miniz_oxide, Java, Node and
Python; zlib-rs and Bun's native gzip are faster but write 37 % more bytes
(2,595 against 1,890), a different trade, so at the same size only libdeflate
is faster. At level 6, libdeflate, klauspost/compress and zlib-rs are faster,
taking 74 %, 84 % and 94 % of Nish's time.
