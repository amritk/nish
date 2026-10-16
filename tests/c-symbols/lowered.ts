// The second program `tests/run.js` links to read the C library calls a
// program's own code reaches (`src/c-symbols.ts`), past `Math`: `i64`
// multiplication and division, checked for overflow; array copies and fills,
// which LLVM lowers to `memcpy`, `memmove` and `memset`; and string building
// and printing, which LTO may rewrite into `puts`, `putchar` or `fwrite`.
// Every value depends on `process.argv`, so that nothing folds.
export const main = (): i32 => {
  const n: i64 = toI64(process.argv.length) + 3000000000;
  const big: i64 = n * n;
  const q: i64 = big / n;
  const r: i64 = big % (n - 7);
  const xs: i32[] = new Array<i32>(toI32(n % 64) + 32);
  xs.fill(toI32(n % 7));
  const ys: i32[] = new Array<i32>(xs.length);
  ys.set(xs);
  const grown: i32[] = [];
  for (let i: i32 = 0; i < toI32(n % 100) + 50; i++) {
    grown.push(i);
  }
  ys.set(grown.length > ys.length ? xs : grown, 0);
  const words: string[] = [];
  for (let i: i32 = 0; i < toI32(n % 5) + 3; i++) {
    words.push(`w${i}`);
  }
  console.log(`${q} ${r} ${ys[0]} ${words.join(",")}`);
  console.log("x");
  return 0;
};
