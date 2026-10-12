// A captured array that could be the destination is refused (NL2497), and a
// field read through `const self = this` is the field `this.out` names: the
// body would read `self.out` while `parallelMapInto` writes `this.out`, the
// same array, from every thread. Every array `self` reaches could be `dst`,
// so the refusal names the first of them, `self.src`.
import { parallelMapInto } from "nish/threads";

class Table {
  src: i32[];
  out: i32[];
  constructor() {
    this.src = [1, 2, 3];
    this.out = [0, 0, 0];
  }

  fill(): i32 {
    const self = this;
    parallelMapInto(this.src, this.out, (x) => x + self.out[0]);
    return this.out[2];
  }
}

export const main = (): i32 => {
  const t = new Table();
  console.log(`${t.fill()}`);
  return 0;
};
