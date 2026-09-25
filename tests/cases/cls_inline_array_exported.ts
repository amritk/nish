// Negative: an exported class in an IR-only build. `-o` writes a module a C
// host may link, and that host may lay the class out from its declaration, so
// `export` keeps the pointer layout here (`hostVisible` in
// `self/visibility.ts`). The same class is inlined in a closed-world
// `--link` (`tests/link/cls_inline_array_exported`).
export class Tally {
  counts: i32[];

  constructor() {
    this.counts = new Array<i32>(4);
  }
}

export const makeTally = (): Tally => {
  const t = new Tally();
  t.counts[2] = 5;
  return t;
};

export const tallyAt = (t: Tally, i: i32): i32 => t.counts[i];

export const test = (): number => {
  const t = makeTally();
  t.counts[1] = 3;
  return tallyAt(t, 1) + tallyAt(t, 2) + t.counts.length;
};
