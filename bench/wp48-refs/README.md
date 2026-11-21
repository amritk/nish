# Compressed references: one tree, five layouts

The measurements behind the lean sibling-link layout that
[docs/AI.md](../../docs/AI.md#a-tree-links-first-child-and-next-sibling)
recommends for a tree, taken for WP48, which weighed 32-bit compressed
references and declined to build them.
Every program builds the same AST-shaped tree (a seeded xorshift picks each
node's kind and its 2 to 6 children, depth at most 16), then walks it two ways a
compiler pass does: a recursive visitor from the root, and a parent-pointer
climb from every leaf to the root. All five print the same checksum, natively
and under Node. WP48's recommendation, accepted on 2026-11-11, was to
build neither 32-bit design and to write ports in `sibling.ts`'s layout, with
`columns.ts`'s for hot, closed tables.
WP48 was reopened on 2026-11-17 for a narrower design, 32-bit links for the
linked classes the compiler picks ([`docs/wp48-ref32-classes.md`](../../docs/wp48-ref32-classes.md)),
which measures its decode on `sibling.ts`. That design shipped: the compiler
now picks `sibling.ts`'s `Node` by itself and stores its three links as 32-bit
offsets, so a `sibling.ts` node is 20 bytes, the same as `columns.ts`'s
(`build/nish bench/wp48-refs/sibling.ts --explain-layout` prints the verdict,
and `--compact off` builds the 32-byte layout). The 1M- and 4M-node gate in
that note's §5.5 has `sibling.ts` level with its pointer layout in time, at
0.63x the memory.

| program | a node is | a link is | bytes a node |
| --- | --- | --- | ---: |
| `class.ts` | a class instance with a `kids: Node[]` array, as an idiomatic port writes it | an 8-byte pointer | 62.8 |
| `sibling.ts` | a class instance with `first` and `next` sibling links | a 32-bit offset (compact) | 20.4 |
| `pool.ts` | an `interface` record in one `Rec[]`, children as a run of a flat `i32[]` | an `i32` index | 24.5 |
| `records.ts` | `sibling.ts`'s five fields as one `interface` record in one `Rec[]` | an `i32` index | 20.4 |
| `columns.ts` | the same five fields, one presized `i32[]` column each | an `i32` index | 20.4 |

`records.ts` is what a whole-program 32-bit reference mode (Design A in
WP48) would make of `sibling.ts`; `pool.ts` and `columns.ts` are what a
library `Pool` (Design B) can write today. The byte counts are peak RSS over
the node count at 4,000,000 nodes, so they include the blocks a growing array
leaves behind in the arena. They are from `node bench/wp48-refs/run.mjs
--rounds 3 --sizes 4000000` with `build/nish` at 568e1ef5, on a 4-core cloud
container. The first WP48 run, before arrays grew in place and before compact
classes, read 63, 32, 50, 41 and 20.

```bash
npm run build
node bench/wp48-refs/run.mjs                      # 9 rounds at 20k, 400k and 4M nodes
node bench/wp48-refs/run.mjs --rounds 3 --sizes 100000
```

Each round runs every program in a fresh process, in a shuffled order, under
[`bench/rss.c`](../rss.c) for the peak resident set; `class-copy` is a
byte-identical copy of `class`'s binary whose gap from `class` is the noise
band. One program by hand, and the same program under Node:

```bash
build/nish bench/wp48-refs/records.ts --link build/wp48/records
build/wp48/records 400000 25          # <nodes> <walks of each kind>
node --experimental-strip-types --no-warnings --import ./runtime/nish.mjs \
  -e "const m = await import('./bench/wp48-refs/records.ts'); process.exit(m.main());" \
  records 400000 25
```

Under Node the first argument after `-e`'s script stands for the program's
name (`process.argv[0]`), so it is a placeholder. Every program is legal
TypeScript:

```bash
npx tsc --noEmit --strict --target es2022 --lib es2022 --typeRoots /nonexistent \
  runtime/nish.d.ts bench/wp48-refs/records.ts
```

(`--typeRoots /nonexistent` keeps `@types/node` out: its globals collide with
`runtime/nish.d.ts`'s.)

## The compact-class range: `range.mjs`

[`range.mjs`](range.mjs) is WP48 stage 1's gate
([`docs/wp48-ref32-classes.md`](../../docs/wp48-ref32-classes.md) §5.4): what
the arena on a reserved range costs a program with no IR change. It compiles
one program to IR once and links that module three ways at `--profile speed`:
`ptr` on the default runtime, `ptr-copy` a byte-identical copy of it (the
noise band) and `ptr-range` on the compact-class runtime
(`scripts/build.sh --arena-range`). Linux only, from the repository root; the
compiler is `build/nish`, or `$NISH` when it is set.

```bash
NISH=build/seed/bin/nish node bench/wp48-refs/range.mjs --rounds 21 --sizes 400000,4000000
NISH=build/seed/bin/nish node bench/wp48-refs/range.mjs --program tree --rounds 21 --sizes 24
```

- `--program sibling|tree`: `sibling.ts` (the default), or `tree` for
  [`bench/goose/tree.ts`](../goose/tree.ts).
- `--rounds N`: rounds per size, 21 by default. Each round runs every variant
  once, in a seeded shuffled order, each in a fresh process under
  [`bench/rss.c`](../rss.c).
- `--sizes a,b`: node counts for `sibling.ts` (`400000,4000000` by default,
  with `max(4, round(1e7 / n))` walks of each kind), or the depth for
  `tree.ts` (`24` by default).

Every variant must print the same checksum first. "wall" is `sibling.ts`'s
own build + visit + climb timers, or `tree.ts`'s process lifetime, and a
figure is the median over the rounds. It prints two bands from the same runs,
each with a verdict on whether `ptr-range`'s median wall is within that band of
`ptr`'s: the widest per-round gap between `ptr` and `ptr-copy`, which covers a
round's spread, and the median of those per-round gaps, which is tighter.
