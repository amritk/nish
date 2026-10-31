# map-keys: `Map` operations by integer, enum and string key

`main.ts` times one `Map` operation per row: `insert` (`set` of every key into
a cleared table, its capacity kept), `hit` (`get` of a present key) and `miss`
(`get` of an absent one), probing in an LCG's order. Its tables:

- a `Map<i32, i32>` with keys spread by a multiply (`i * 7919`);
- a `Map<i64, i32>` over a grid 1024 wide, keyed by two `i32`s packed into one
  `i64` (`(toI64(hi) << toI64(32)) | (toI64(lo) & toI64(0xffffffff))`, the composite-key idiom in
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
`head`. `head` is the compiler before this change, with integer keys on
murmur3's `fmix32`/`fmix64` as in 0.28; `keyed` is this change; `head-copy`
is `head`'s binary timed again, so its distance from 1.000 is the noise band,
0.86 to 1.09 and within ±4% on most rows.

| row | head | head-copy | 0.28.0 | keyed | rust-fx |
| --- | --- | --- | --- | --- | --- |
| i32-hit-L1 | 11.67 (1.000) | 11.19 (0.959) | 11.18 (0.958) | 10.42 (0.894) | 2.82 (0.242) |
| i32-miss-L1 | 18.77 (1.000) | 17.51 (0.933) | 18.01 (0.960) | 17.05 (0.908) | 3.66 (0.195) |
| i32-insert-L1 | 9.08 (1.000) | 9.39 (1.034) | 8.95 (0.986) | 8.93 (0.983) | 3.68 (0.406) |
| i64-hit-L1 | 13.39 (1.000) | 12.47 (0.931) | 12.38 (0.925) | 10.80 (0.807) | 2.97 (0.222) |
| i64-miss-L1 | 18.82 (1.000) | 18.47 (0.981) | 18.03 (0.958) | 17.98 (0.955) | 2.77 (0.147) |
| i64-insert-L1 | 9.16 (1.000) | 9.33 (1.018) | 9.51 (1.037) | 9.15 (0.999) | 3.84 (0.419) |
| i32-hit-L2 | 15.14 (1.000) | 14.77 (0.976) | 14.39 (0.951) | 15.53 (1.026) | 3.76 (0.248) |
| i32-miss-L2 | 20.15 (1.000) | 19.92 (0.989) | 20.32 (1.009) | 18.50 (0.918) | 2.49 (0.124) |
| i32-insert-L2 | 15.61 (1.000) | 14.58 (0.934) | 16.94 (1.085) | 16.31 (1.044) | 4.69 (0.300) |
| i64-hit-L2 | 18.85 (1.000) | 17.09 (0.907) | 19.91 (1.056) | 17.59 (0.933) | 17.02 (0.903) |
| i64-miss-L2 | 20.24 (1.000) | 22.07 (1.090) | 22.02 (1.088) | 20.36 (1.006) | 13.84 (0.684) |
| i64-insert-L2 | 17.16 (1.000) | 17.01 (0.991) | 16.81 (0.980) | 16.34 (0.952) | 7.31 (0.426) |
| i32-hit-L3+ | 116.92 (1.000) | 118.61 (1.014) | 117.21 (1.002) | 121.38 (1.038) | 38.73 (0.331) |
| i32-miss-L3+ | 63.58 (1.000) | 54.79 (0.862) | 63.53 (0.999) | 52.62 (0.828) | 9.35 (0.147) |
| i32-insert-L3+ | 64.79 (1.000) | 68.94 (1.064) | 69.96 (1.080) | 63.38 (0.978) | 32.46 (0.501) |
| i64-hit-L3+ | 123.26 (1.000) | 127.02 (1.030) | 121.51 (0.986) | 124.65 (1.011) | 4203.02 (34.099) |
| i64-miss-L3+ | 67.64 (1.000) | 68.98 (1.020) | 66.33 (0.981) | 61.51 (0.909) | 8812.58 (130.291) |
| i64-insert-L3+ | 72.56 (1.000) | 71.34 (0.983) | 69.49 (0.958) | 68.50 (0.944) | 4318.34 (59.517) |
| enum-hit-L1 | 5.89 (1.000) | 5.78 (0.981) | 5.60 (0.950) | 4.93 (0.837) | 2.54 (0.431) |
| enum-miss-L1 | 4.40 (1.000) | 4.36 (0.991) | 4.22 (0.958) | 3.87 (0.879) | 2.04 (0.464) |
| enum-insert-L1 | 8.62 (1.000) | 8.42 (0.976) | 7.37 (0.856) | 8.02 (0.930) | 9.91 (1.149) |
| string-hit-L1 | 24.79 (1.000) | 24.49 (0.988) | 24.75 (0.999) | 23.39 (0.943) | - |
| string-miss-L1 | 30.83 (1.000) | 29.60 (0.960) | 30.22 (0.980) | 30.24 (0.981) | - |
| string-insert-L1 | 16.96 (1.000) | 17.62 (1.039) | 16.90 (0.997) | 17.20 (1.014) | - |
| string-hit-L2 | 134.78 (1.000) | 132.97 (0.987) | 123.87 (0.919) | 126.89 (0.941) | - |
| string-miss-L2 | 112.09 (1.000) | 114.22 (1.019) | 119.30 (1.064) | 111.31 (0.993) | - |
| string-insert-L2 | 33.31 (1.000) | 32.56 (0.978) | 34.18 (1.026) | 33.30 (1.000) | - |

The keyed hashes cost what `fmix` did: `keyed` is 0.83 to 1.09 of 0.28.0 on
every row, inside the noise band, and the string rows did not move.

Rust's `FxHashMap` is 2 to 7 times faster on the `i32` rows and the L1 `i64` rows, and
about twice as fast on the enum. That gap is the table, not the hash: a Nish
`Map` keeps insertion order, so a hit loads a bucket, then the entry's stored
hash, then its key, then its value, from four arrays, through a probe the call
site does not inline, where SwissTable compares a control byte and reads the
key and value from one slot. An Fx-style multiply put in place of the keyed
hash, in an earlier version of this bench, took about 20% off the integer
rows, not 70%. Fx's own failure mode is in the `i64` rows: the low bits of
`k * C` depend only on the low bits of `k`, SwissTable takes the bucket from the
low bits, and the packed grid's low word has only 1,024 values, so every key
lands on one of 1,024 buckets. At L2 that is 64 keys a bucket and Fx no faster
than Nish; at L3+, 8,192 a bucket and 35 to 130 times slower. A keyed hash has
neither that cliff nor the predictability a flooding attack exploits; the
reasoning is in [docs/wp32-map.md](../../docs/wp32-map.md) §5.2.
