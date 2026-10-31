# map-keys: `Map` operations by integer, enum and string key

`main.ts` times one `Map` operation per row: `insert` (`set` of every key into
a cleared table, its capacity kept), `hit` (`get` of a present key) and `miss`
(`get` of an absent one), probing in an LCG's order. Its tables:

- a `Map<i32, i32>` with keys spread by a multiply (`i * 7919`);
- a `Map<i64, i32>` over a grid 1024 wide, keyed by two `i32`s packed into one
  `i64` (`(toI64(hi) << toI64(32)) | toI64(toU32(lo))`, the composite-key idiom in
  [the user guide](../../docs/guide/language/maps-and-sets.md));
- a `Map<Op, i32>` over a 16-member enum (`miss` probes a table of 8);
- a `Map<string, i32>`, its keys built before any clock starts, to show the
  string hash did not move.

The integer tables come in three sizes: 1 Ki keys fit in L1, 64 Ki in L2, and
8 Mi (half what a `Map` holds, over 128 MiB of table) is past a server's L3.
Every row prints a checksum, and a checksum that differs between binaries
fails the run. `run.mjs` builds `main.ts` with each compiler it is given at
`--profile speed`, adds a byte-identical copy of the first one's binary as the
noise band, builds `fx.rs` with `rustc` if there is one (its integer and enum
rows, with the same keys and checksums, from Rust's `HashMap` under rustc's
unkeyed `FxHasher`), and runs them in turn, rotating which goes first:

```bash
bash scripts/fetch-seed.sh 0.28.0 && cp -r build/seed build/rel028
node bench/map-keys/run.mjs
node bench/map-keys/run.mjs --compiler head=build/nish --compiler other=path/to/nish --rounds 15
```

## Result

A 2.1 GHz Xeon virtual machine (4 cores, 48 KiB L1d, 2 MiB L2), clang 18,
rustc 1.97; 9 rounds, median ns per operation, and in brackets the ratio to
`head`. `head` is this change (the compiler at f0fb2c63, keyed integer
hashes); `0.28.0` is the last release, with integer keys on murmur3's
unkeyed `fmix32`/`fmix64`; `head-copy` is `head`'s binary timed again, so its
distance from 1.000 is the noise band. On this run that band is 0.78 to 1.33,
and within ±5% on most rows.

| row | head | head-copy | 0.28.0 | rust-fx |
| --- | --- | --- | --- | --- |
| i32-hit-L1 | 11.42 (1.000) | 12.80 (1.121) | 13.61 (1.192) | 3.01 (0.264) |
| i32-miss-L1 | 19.37 (1.000) | 18.60 (0.960) | 20.52 (1.059) | 3.80 (0.196) |
| i32-insert-L1 | 9.28 (1.000) | 9.50 (1.024) | 9.53 (1.027) | 3.74 (0.404) |
| i64-hit-L1 | 12.10 (1.000) | 12.56 (1.038) | 13.62 (1.126) | 3.33 (0.276) |
| i64-miss-L1 | 19.02 (1.000) | 19.31 (1.015) | 21.12 (1.110) | 3.07 (0.161) |
| i64-insert-L1 | 10.45 (1.000) | 9.35 (0.895) | 10.04 (0.961) | 4.32 (0.414) |
| i32-hit-L2 | 15.20 (1.000) | 14.45 (0.951) | 15.08 (0.992) | 3.83 (0.252) |
| i32-miss-L2 | 21.67 (1.000) | 20.83 (0.961) | 22.85 (1.055) | 2.77 (0.128) |
| i32-insert-L2 | 15.92 (1.000) | 15.85 (0.996) | 16.26 (1.021) | 4.62 (0.290) |
| i64-hit-L2 | 16.16 (1.000) | 15.81 (0.978) | 16.65 (1.030) | 18.75 (1.160) |
| i64-miss-L2 | 22.29 (1.000) | 21.59 (0.969) | 23.21 (1.041) | 15.90 (0.713) |
| i64-insert-L2 | 16.80 (1.000) | 16.31 (0.971) | 17.49 (1.041) | 8.17 (0.486) |
| i32-hit-L3+ | 76.78 (1.000) | 86.14 (1.122) | 78.89 (1.028) | 29.02 (0.378) |
| i32-miss-L3+ | 41.97 (1.000) | 55.72 (1.328) | 50.06 (1.193) | 6.72 (0.160) |
| i32-insert-L3+ | 52.81 (1.000) | 57.26 (1.084) | 56.45 (1.069) | 22.17 (0.420) |
| i64-hit-L3+ | 92.59 (1.000) | 100.36 (1.084) | 104.72 (1.131) | 3194.68 (34.502) |
| i64-miss-L3+ | 52.33 (1.000) | 49.90 (0.954) | 54.44 (1.040) | 6875.30 (131.381) |
| i64-insert-L3+ | 59.47 (1.000) | 57.66 (0.970) | 58.48 (0.983) | 3058.06 (51.424) |
| enum-hit-L1 | 7.11 (1.000) | 5.51 (0.776) | 6.91 (0.973) | 2.85 (0.401) |
| enum-miss-L1 | 4.51 (1.000) | 4.00 (0.886) | 5.23 (1.158) | 2.28 (0.505) |
| enum-insert-L1 | 9.59 (1.000) | 9.18 (0.958) | 10.14 (1.057) | 10.80 (1.127) |
| string-hit-L1 | 29.09 (1.000) | 27.21 (0.935) | 27.24 (0.936) | - |
| string-miss-L1 | 35.51 (1.000) | 35.01 (0.986) | 35.38 (0.996) | - |
| string-insert-L1 | 19.43 (1.000) | 19.76 (1.017) | 20.41 (1.050) | - |
| string-hit-L2 | 85.10 (1.000) | 84.93 (0.998) | 82.52 (0.970) | - |
| string-miss-L2 | 78.53 (1.000) | 78.10 (0.995) | 81.76 (1.041) | - |
| string-insert-L2 | 33.72 (1.000) | 31.84 (0.944) | 31.75 (0.941) | - |

The keyed hashes cost what `fmix` did: 0.28.0 is 0.94 to 1.19 of `head` on
every row, inside the noise band, and the string rows did not move. An
earlier run of the same bench, with a narrower band (0.86 to 1.09), put the
keyed hash at 0.83 to 1.09 of 0.28.0: no regression, and no speedup beyond
noise either.

Rust's `FxHashMap` is up to 8 times faster on the `i32` rows and the L1 `i64`
rows (2.4 to 7.8 times), and about twice as fast on the enum. That gap is the
table, not the hash: a Nish `Map` keeps insertion order, so a hit loads a
bucket, then the entry's stored hash, then its key, then its value, from four
arrays, through a probe the call site does not inline, where SwissTable
compares a control byte and reads the key and value from one slot. An
Fx-style multiply put in place of the keyed hash, in an earlier version of
this bench, took something like a fifth off the integer rows, measured once
and inside a wide band, never the 70% or more the gap would need. Fx's own
failure mode is in the `i64` rows, whose keys pack a grid only 1,024 wide, so
their low word has 1,024 values: the low bits of `k * C` depend only on the
low bits of `k`, SwissTable takes the bucket from the low bits, so every key
lands on one of 1,024 buckets. At L2 that is 64 keys a bucket and Fx no faster
than Nish; at L3+, 8,192 a bucket and 34 to 131 times slower. A keyed hash
has neither that cliff nor the predictability a flooding attack exploits; the
reasoning is in [docs/wp32-map.md](../../docs/wp32-map.md) §5.2.
