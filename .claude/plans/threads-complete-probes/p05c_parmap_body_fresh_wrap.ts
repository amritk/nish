import { parallelMapInto, scope } from "nish/threads";

class Inner {
  x: i32 = 0;

  bump(): void {
    this.x = 1;
  }
}

class Holder {
  inner: Inner;
  items: Inner[];
  nums: i32[];

  constructor() {
    this.inner = new Inner();
    this.items = [new Inner()];
    this.nums = [5];
  }
}

const read = (h: Holder): i32 => h.inner.x + h.items[0].x + h.nums.length + h.nums[0];

class Wrap {
  inner: Inner;
  items: Inner[];

  constructor() {
    this.inner = new Inner();
    this.items = [new Inner()];
  }
}

const body = (h: Holder): i32 => {
  const w = new Wrap();
  w.inner = h.inner;
  w.inner.x = w.inner.x + 1;
  return w.inner.x;
};

export const main = (): i32 => {
  const h = new Holder();
  const src: Holder[] = [h, h, h, h];
  const dst: i32[] = [0, 0, 0, 0];
  parallelMapInto(src, dst, body);
  console.log(`${dst[0]} ${dst[1]} ${dst[2]} ${dst[3]} ${h.inner.x}`);
  return 0;
};
