# map-keys: `Map` lookups by integer and enum key

`main.ts` times `set`, `get` and `has` on three tables:

- a `Map<i32, i32>` of 65,536 keys spread by a multiply;
- a `Map<i64, i32>` over a 256 by 256 grid, keyed by two `i32`s packed into
  one `i64` (`(toI64(hi) << toI64(32)) + toI64(lo)`, the composite-key
  idiom in [the user guide](../../docs/guide/language/maps-and-sets.md));
- a `Map<Op, i32>` histogram over a 16-member enum, then probes of a `get` and
  a `has` each.

Half the `get`s and `has`s find their key. Each pass is fed the last one's
checksum, so no pass can be hoisted, and a checksum that differs between
binaries fails the run. `run.mjs` builds `main.ts` with each compiler it is
given at `--profile speed`, adds a byte-identical copy of the first one's
binary as the noise band, and runs them in turn, rotating which goes first:

```bash
bash scripts/fetch-seed.sh 0.28.0 && cp -r build/seed build/rel028
node bench/map-keys/run.mjs --rounds 15
node bench/map-keys/run.mjs --compiler head=build/nish --compiler other=path/to/nish
```

## Result

A 2.1 GHz Xeon virtual machine (4 cores), clang 18; 15 rounds of 20 passes,
median ns per operation. `head-copy` is `head`'s own binary timed again, so its
distance from 1.000 is the noise band: about ±6%.

`head` is the HEAD compiler with integer keys on murmur3's `fmix32`/`fmix64`
(the 0.28 hashes); `keyed` is this change, multiply-add-shift under the
process's random integer key, apart from the string hash's, for keys of 32 bits or fewer and a keyed folded multiply
for 64-bit ones; `fx` is a throwaway build with rustc's unkeyed `FxHasher`
multiply, kept only as the floor to measure against.

| key | head | head-copy | 0.28.0 | fx | keyed |
| --- | --- | --- | --- | --- | --- |
| i32 | 21.77 (1.000) | 20.55 (0.944) | 21.79 (1.001) | 17.48 (0.803) | 21.75 (0.999) |
| i64 | 21.88 (1.000) | 22.14 (1.012) | 21.31 (0.974) | 17.18 (0.785) | 20.21 (0.924) |
| enum | 7.21 (1.000) | 7.11 (0.985) | 7.28 (1.009) | 4.12 (0.572) | 7.67 (1.064) |

The keyed hashes cost what `fmix` did, within the noise band. Fx is 20% faster
on `i32` and `i64` keys and 43% faster on the enum, and it stays out: most of
its lead is that it spreads an arithmetic sequence of keys (`i * 7919`, enum
members 0 to 15) over distinct buckets with no collisions, which is the
predictability a flooding attack exploits and a keyed hash cannot have. The
reasoning is in [docs/wp32-map.md](../../docs/wp32-map.md) §5.2.
