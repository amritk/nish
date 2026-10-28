# gzip: one-shot compression of a JSON response

`main.ts` gzips `feed.json` (5,221 bytes of feed JSON, written by `feed.mjs`,
which gzip -6 takes to about 1.85 KB) with a reused `GzipCompressor` into a
reused buffer, at level 1 and level 6, and gunzips it back with a reused
`GzipDecompressor`. `gzip.c` does the same with zlib (a reused `z_stream`,
`deflateReset` per call) and libdeflate (a reused compressor). `run.mjs`
builds both, runs them alternately and reports the median of the rounds:

```bash
node bench/gzip/run.mjs --rounds 9 --calls 10000
```

It needs clang, zlib and libdeflate's shared object (`libdeflate.so.0`).

## Result

A 2.1 GHz Xeon virtual machine, 4 cores, clang 18, the system zlib 1.3 and
libdeflate; 9 rounds of 10,000 calls. Rounds on this machine vary by about
±10 %.

| op | level | library | size | µs/call | MB/s | vs libdeflate |
| --- | --- | --- | --- | --- | --- | --- |
| gzip | -1 | nish | 1890 | 25.14 | 208 | 1.58x |
| gzip | -1 | libdeflate | 1888 | 15.96 | 327 | 1.00x |
| gzip | -1 | zlib | 1958 | 26.40 | 198 | 1.65x |
| gzip | -6 | nish | 1863 | 41.64 | 125 | 1.47x |
| gzip | -6 | libdeflate | 1846 | 28.32 | 184 | 1.00x |
| gzip | -6 | zlib | 1864 | 44.86 | 116 | 1.58x |
| gunzip | -1 | nish | 1890 | 14.56 | 359 | 1.93x |
| gunzip | -1 | libdeflate | 1888 | 7.55 | 692 | 1.00x |
| gunzip | -1 | zlib | 1958 | 14.67 | 356 | 1.94x |
| gunzip | -6 | nish | 1863 | 14.37 | 363 | 1.96x |
| gunzip | -6 | libdeflate | 1846 | 7.34 | 711 | 1.00x |
| gunzip | -6 | zlib | 1864 | 14.38 | 363 | 1.96x |

Level 1 is within 1.6x of libdeflate's level 1 at the same size (1,890 bytes
against 1,888), and a little faster than zlib's level 1, which is 70 bytes
larger. Level 6 is within 1.5x of libdeflate's level 6 and as fast as zlib's.
Decompression runs at zlib's speed, about half libdeflate's. Everything is
pure Nish: no C kernel was needed to meet the 2x target, so none was added.
