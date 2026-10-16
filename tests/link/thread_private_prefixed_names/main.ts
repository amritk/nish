// #618: a name that begins with `_` or `napi_` is refused only where it is the
// symbol, exported or public under `--no-strict-exports`. A private one is
// `internal` and spelled `@_helper$`, a private one handed to `spawn` is
// `hidden` and spelled `@_task$` and `@napi_square$`, and an arrow lifted out
// of a private `_h` is `@_h$arrow0`, whose `$` its lifting already wrote: none
// of them is the C name, so all of them compile, and print what Node prints.
import { parallelMapInto, scope } from "nish/threads";

const _helper = (x: i32): i32 => x + 1;

const _task = (n: i32): i32 => n * 10;

const napi_square = (n: i32): i32 => n * n;

const _h = (xs: i32[]): i32 => {
  const ys: i32[] = [0, 0, 0];
  parallelMapInto(xs, ys, (x: i32): i32 => x + 100);
  return ys[0] + ys[1] + ys[2];
};

export const main = (): i32 => {
  const done: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(_task, 4, done, 0);
    s.spawn(napi_square, 5, done, 1);
  }
  console.log(`${_helper(1)} ${done[0]} ${done[1]} ${_h([1, 2, 3])}`);
  return 0;
};
