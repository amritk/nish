// WP34 N5: `udpRecvFrom` writes `meta`'s elements, so in a scope's region it
// is refused as `meta.fill(v)` is while a task may be reading `meta`.
import { scope } from "nish/threads";

const sumOf = (xs: i32[]): i32 => {
  let t = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

export const main = (): i32 => {
  const buf: u8[] = new Array<u8>(8);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [0, 0];
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, meta, sums, 0);
    udpRecvFrom(0, buf, 0, 8, from, meta);
  }
  return sums[0];
};
