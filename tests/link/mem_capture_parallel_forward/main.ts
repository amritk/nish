// An arrow given to an ordinary function that hands it on to a data-parallel
// form has no capture target (`captureTarget`): past `parallelMap` the
// capture travels in a context the form's own facts describe, so the function
// that wrote the arrow keeps today's answer. `k` stays an escape there, so
// `scaleAll`'s `k` is neither `readonly` nor `nocapture`, and every `%cap.0`
// on the way is `noundef` alone.
import { parallelMap } from "nish/threads";

class Scale {
  k: i32;

  constructor(k: i32) {
    this.k = k;
  }
}

const each = (xs: i32[], f: (x: i32) => i32): i32[] => parallelMap(xs, f);

const scaleAll = (xs: i32[], k: Scale): i32 => {
  const ys = each(xs, (x) => x * k.k);
  return ys[0] + ys[1] + ys[2];
};

export const main = (): i32 => {
  console.log(`${scaleAll([1, 2, 3], new Scale(4))}`);
  return 0;
};
