// The atomic arrays in data-parallel bodies: a `parallelMapInto` body bins
// each element into one shared `AtomicI32Array`, and a `parallelMap` body
// adds a block past 32 bits into one bucket of an `AtomicI64Array`. Each
// body's one shared write is an element update, which commutes, so the bins
// are the same however the iterations were split across the pool's threads,
// and under Node, where each form runs in order.
import { AtomicI32Array, AtomicI64Array, parallelFrom, parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = parallelFrom(100000, (i: i32): i32 => (i * 7919) % 1009);

  const bins = new AtomicI32Array(16);
  const zs: i32[] = new Array<i32>(xs.length);
  zs.fill(0);
  parallelMapInto(xs, zs, (x: i32): i32 => {
    bins.add(x % 16, 1);
    return x + 1;
  });
  let line = "into";
  let total: i32 = 0;
  for (let b: i32 = 0; b < bins.length; b++) {
    line = `${line} ${bins.load(b)}`;
    total = total + bins.load(b);
  }
  console.log(`${line} = ${total} ${zs[5]}`);

  const squares = new AtomicI64Array(4);
  const ys: i32[] = parallelMap(xs, (x: i32): i32 => {
    const block: i64 = 3000000000;
    squares.add(x % 4, block);
    return x * 2;
  });
  console.log(`map ${squares.load(0)} ${squares.load(1)} ${squares.load(2)} ${squares.load(3)} ${ys[5]}`);
  return 0;
};
