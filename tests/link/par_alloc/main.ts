// WP29: a parallel body that allocates, long enough to divide. `label` builds a
// string on every call and assigns it to a `let`, which keeps WP6 from giving
// it an arena scope; as a parallel body it gets one anyway, so each element
// marks the arena of the thread it runs on and releases it before the next
// element. The checksum is the loop's, and the compiler warns (NL9012).
import { parallelMapInto } from "nish/threads";

const label = (x: i32): i32 => {
  let s = "small";
  if (x % 3 === 0) {
    s = `fizz ${x}`;
  }
  return s.length;
};

export const main = (): i32 => {
  const n: i32 = 1000000;
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < toI32(src.length); i++) {
    src[i] = i;
  }
  const dst = new Array<i32>(n);
  parallelMapInto(src, dst, label);
  let sum: i64 = 0;
  for (let i: i32 = 0; i < toI32(dst.length); i++) {
    sum = sum + toI64(dst[i]);
  }
  console.log(`${dst[0]} ${dst[1]} ${dst[999999]} ${sum}`);
  return 0;
};
