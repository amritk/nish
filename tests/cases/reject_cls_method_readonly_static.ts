// The other order of `reject_cls_method_static_readonly`: `readonly` is written
// first, so it is the modifier the message names, on both compilers.
export class Point {
  x: i32 = 0;
  readonly static origin(): i32 {
    return 0;
  }
}
