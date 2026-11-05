# LZAV benchmark

`run.mjs` times `nish/compress/lzav` against upstream LZAV 7.1 in C (built
with clang -O3), with raw DEFLATE level 1 from `nish/compress/deflate` and
from libdeflate as the yardstick, in both directions. Every compressor and
decompressor is reused, writing into a reused buffer. Before it times
anything, the runner checks that the port and the C library wrote the same
number of bytes. The port writes LZAV's stream byte for byte.

```bash
npm run build && node bench/lzav/run.mjs
npm run build && node bench/lzav/run.mjs --body docs/LANGUAGE.md --calls 200
```

The figures below come from a 4-core Intel Xeon @ 2.10GHz cloud machine. Each
is the median of 9 rounds. `vs C LZAV` is a row's time divided by C LZAV's
time in the same direction.

## A 5 KB JSON body

`bench/gzip/feed.json` (5,221 bytes), 20,000 calls per round:

| op | codec | library | size | µs/call | MB/s | vs C LZAV |
| --- | --- | --- | --- | --- | --- | --- |
| compress | lzav | nish | 2854 | 14.92 | 350 | 2.37x |
| compress | lzav | C (upstream) | 2854 | 6.29 | 830 | 1.00x |
| compress | deflate-1 | nish | 1872 | 22.43 | 233 | 3.57x |
| compress | deflate-1 | libdeflate | 1870 | 17.44 | 299 | 2.77x |
| decompress | lzav | nish | 2854 | 2.14 | 2444 | 2.19x |
| decompress | lzav | C (upstream) | 2854 | 0.97 | 5356 | 1.00x |
| decompress | deflate-1 | nish | 1872 | 10.70 | 488 | 10.98x |
| decompress | deflate-1 | libdeflate | 1870 | 8.47 | 617 | 8.69x |

## An 880 KB text body

`docs/LANGUAGE.md` (879,253 bytes when measured), 200 calls per round:

| op | codec | library | size | µs/call | MB/s | vs C LZAV |
| --- | --- | --- | --- | --- | --- | --- |
| compress | lzav | nish | 359607 | 4358.31 | 202 | 1.44x |
| compress | lzav | C (upstream) | 359607 | 3028.71 | 290 | 1.00x |
| compress | deflate-1 | nish | 315986 | 9300.40 | 95 | 3.07x |
| compress | deflate-1 | libdeflate | 315997 | 5244.88 | 168 | 1.73x |
| decompress | lzav | nish | 359607 | 1459.15 | 603 | 2.66x |
| decompress | lzav | C (upstream) | 359607 | 548.91 | 1602 | 1.00x |
| decompress | deflate-1 | nish | 315986 | 1982.46 | 444 | 3.61x |
| decompress | deflate-1 | libdeflate | 315997 | 1241.11 | 708 | 2.26x |

## What the tables say

**Against DEFLATE level 1.** The Nish LZAV port compresses 1.5 to 2.1 times
faster than Nish's own DEFLATE level 1, and faster than libdeflate -1 on both
bodies. It decompresses 5 times faster than Nish's DEFLATE on the JSON body
and 1.36 times faster on the text body, where libdeflate -1 decompresses
faster than the port (1,241 µs against 1,459). The cost is size: on JSON it writes 52 % more bytes
(2,854 against 1,872), and on text 14 % more. LZAV suits data a program
writes and reads back itself, such as caches, spill files and messages
between its own processes. Use DEFLATE when anything else reads the bytes or
when size matters most.

**Against the C original.** Compression costs 1.44 times C's time on the
large body and 2.37 times on the small one. Decompression costs 2.2 to 2.7
times. Part of the gap is bounds checks the C code does not make; it was not
measured apart from the rest. The decoder checks every copy against the output's length, because a hostile
stream must not write outside it (see COMP-16 in
`docs/security/compress.md`). C trusts its own `dstlen` arithmetic and copies
with fixed-size `memcpy` calls that the compiler turns into vector moves. Each word copy here is guarded so that
the performance prover can prove its index. Before those guards were written
in a form the prover reads, compression took 3.20x C's time and decompression
4.36x on the small body.
