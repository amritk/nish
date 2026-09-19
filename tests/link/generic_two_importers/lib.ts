// One template, two importers, one definition each of `pick$i32` and
// `pick$str` — which is the whole claim of WP18 G7 (§12). The count is what
// matters: `a.ts` and `b.ts` both ask for `pick<i32>`, and a compiler that
// answered each of them in its own module would emit two `define`s of one
// symbol and `llvm-as` would refuse the second.

export const pick = <T>(a: T, b: T, first: boolean): T => (first ? a : b);
