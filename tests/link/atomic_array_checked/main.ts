// The checked twins of the atomic array constructors: a valid length gives
// `Ok` with a zeroed array of that length, a negative one `Err` with the
// message the constructor panics with. The last line pins that panic for
// `AtomicI64Array`, so a twin and its constructor refuse a length alike.
import { AtomicI64Array, atomicI32ArrayChecked, atomicI64ArrayChecked } from "nish/threads";

export const main = (): i32 => {
  const a = atomicI32ArrayChecked(3);
  console.log(a.isErr() ? `i32 3: Err ${a.error}` : `i32 3: Ok ${a.value.length} ${a.value.load(2)}`);
  const b = atomicI64ArrayChecked(4);
  console.log(b.isErr() ? `i64 4: Err ${b.error}` : `i64 4: Ok ${b.value.length} ${b.value.load(3)}`);
  const n: i32 = b.isErr() ? 0 : b.value.length - 5;
  const c = atomicI32ArrayChecked(n);
  console.log(c.isErr() ? `i32 ${n}: Err ${c.error}` : `i32 ${n}: Ok ${c.value.length}`);
  const d = atomicI64ArrayChecked(n);
  console.log(d.isErr() ? `i64 ${n}: Err ${d.error}` : `i64 ${n}: Ok ${d.value.length}`);
  const bins = new AtomicI64Array(n);
  console.log(`not reached ${bins.length}`);
  return 0;
};
