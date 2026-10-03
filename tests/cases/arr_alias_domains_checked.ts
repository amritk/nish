// arr_alias_domains under the checked default (arr_alias_domains itself is
// compiled with `--wrapping`). `src[i] * 2` is unbounded, so it is
// `llvm.smul.with.overflow` and a branch to the overflow panic. The alias
// domains do not depend on the mode: tests/run.js pins that after `opt -O2`
// every array header load is still hoisted out of the loop, and that the
// overflow check is still in it.
export function scale(dst: i32[], src: i32[]): void {
  let i = 0;
  while (i < src.length) {
    dst[i] = src[i] * 2;
    i = i + 1;
  }
}

export function test(): i32 {
  const src = [1, 2, 3, 4];
  const dst = new Array<i32>(4);
  scale(dst, src);
  return dst[0] + dst[1] + dst[2] + dst[3];
}
