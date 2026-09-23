class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const total = (h: Holder): i32 => {
  let s = 0;
  let i = 0;
  while (i < h.xs.length) {
    s = s + h.xs[i];
    i = i + 1;
  }
  return s;
};
