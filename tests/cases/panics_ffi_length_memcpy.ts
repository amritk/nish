// WP40 B1.2: each buffer of a run is checked against the run's count. The
// count is `dst`'s length, proven for `dst`; `src` is the shorter array, so
// its check fails before C copies a byte past its end.
declare function memcpy(dst: u8[], src: readonly u8[], n: u64): CPtr;

export function shortSource(): i32 {
  const dst = new Array<u8>(8);
  const src: u8[] = [1, 2, 3];
  memcpy(dst, src, toU64(dst.length));
  return 0;
}
