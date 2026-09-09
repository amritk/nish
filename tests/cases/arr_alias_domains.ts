// WP15: an element store must not be read as a clobber of an array header.
// Writing `dst[i]` while reading `src[i]` and `src.length` is the shape where
// that costs the most — without the alias domains LLVM reloads both headers on
// every iteration, which blocks LICM. `tests/run.js` pins the consequence: after
// `opt -O2` no `%struct.amrit_array` access is left inside the loop.
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
