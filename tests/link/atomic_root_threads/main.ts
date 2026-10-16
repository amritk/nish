// A root-package `std/threads.ts` is an ordinary module: the `AtomicI32` and
// `AtomicI64` it declares are classes of the program's own, whose methods run
// as they are written. Only `nish/threads`'s are lowered to one atomic
// instruction each, so `add` here adds twice, `double` is a method like any
// other, and an `AtomicI64` may call its field `v`.
import { AtomicI32, AtomicI64 } from "./std/threads";
export const main = (): i32 => {
  const a = new AtomicI32();
  a.add(1);
  a.double();
  const b = new AtomicI64();
  console.log(`${a.load()} ${a.value} ${b.load()}`);
  return 0;
};
