// The atomics in the four data-parallel forms. Each body's one shared write
// is an atomic update — a count, a sum, a minimum, a maximum — which commutes,
// so the totals are the same however the iterations were split across the
// pool's threads, and under Node, where each form runs in order. Each line
// prints the form's own answer beside what its body counted.
import { AtomicI32, AtomicI64, parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const made = new AtomicI32(0);
  const xs: i32[] = parallelFrom(100000, (i: i32): i32 => {
    made.add(1);
    return (i * 7919) % 1009;
  });
  console.log(`from ${xs.length} ${made.load()}`);

  const total = new AtomicI64(0);
  const step: i64 = 3000000000;
  const top = new AtomicI32(-1);
  const ys: i32[] = parallelMap(xs, (x: i32): i32 => {
    total.add(step);
    top.max(x);
    return x * 2;
  });
  console.log(`map ${ys[5]} ${total.load()} ${top.load()}`);

  const zs: i32[] = new Array<i32>(xs.length);
  zs.fill(0);
  const bottom = new AtomicI32(1000000);
  const evens = new AtomicI32(0);
  parallelMapInto(xs, zs, (x: i32): i32 => {
    bottom.min(x + 1);
    if (x % 2 === 0) {
      evens.add(1);
    } else {
      evens.sub(0);
    }
    return x + 1;
  });
  console.log(`into ${zs[5]} ${bottom.load()} ${evens.load()}`);

  // A combine sees the partial sums of other threads too, and each is at
  // least the elements it covers, so the least `b` it is handed is the least
  // element however the input was split.
  const least = new AtomicI32(1000000);
  const sum: i32 = parallelReduce(
    xs,
    (a: i32, b: i32): i32 => {
      least.min(b);
      return a + b;
    },
    0
  );
  console.log(`reduce ${sum} ${least.load()}`);
  return 0;
};
