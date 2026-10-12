import { parallelMap } from "nish/threads";
class Inner {
  arr: i32[];
  constructor() {
    this.arr = [0, 0];
  }
}
class Outer {
  inner: Inner;
  constructor() {
    this.inner = new Inner();
  }
}
export const main = (): i32 => {
  const cap = new Outer();
  const xs = new Array<i32>(3000000);
  const ys = parallelMap(xs, (x): i32 => {
    cap.inner.arr[0] = cap.inner.arr[0] + 1;
    return x;
  });
  console.log(`${cap.inner.arr[0]} ${ys.length}`);
  return 0;
};
