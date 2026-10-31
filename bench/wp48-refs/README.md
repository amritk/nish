# Compressed references: one tree, five layouts

The measurements behind
[docs/wp48-compressed-references.md](../../docs/wp48-compressed-references.md).
Every program builds the same AST-shaped tree (a seeded xorshift picks each
node's kind and its 2 to 6 children, depth at most 16), then walks it two ways a
compiler pass does: a recursive visitor from the root, and a parent-pointer
climb from every leaf to the root. All five print the same checksum, natively
and under Node.

| program | a node is | a link is | bytes a node |
| --- | --- | --- | ---: |
| `class.ts` | a class instance with a `kids: Node[]` array, as an idiomatic port writes it | an 8-byte pointer | 63 |
| `sibling.ts` | a class instance with `first` and `next` sibling links | an 8-byte pointer | 32 |
| `pool.ts` | an `interface` record in one `Rec[]`, children as a run of a flat `i32[]` | an `i32` index | 50 |
| `records.ts` | `sibling.ts`'s five fields as one `interface` record in one `Rec[]` | an `i32` index | 41 |
| `columns.ts` | the same five fields, one presized `i32[]` column each | an `i32` index | 20 |

`records.ts` is what a whole-program 32-bit reference mode (Design A in the
note) would make of `sibling.ts`; `pool.ts` and `columns.ts` are what a
library `Pool` (Design B) can write today. The byte counts are peak RSS over
the node count at 4,000,000 nodes, so they include the blocks a growing array
leaves behind in the arena.

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
