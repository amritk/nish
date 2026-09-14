// A generic class claims its name in the one declaration namespace, so a
// function may not take it. The structs pass runs first, so the clash is the
// same whichever of the two was written first; stage1 answers from `nameTaken`,
// which counts a template, and stage0 used to compile this with
// `%struct.Box$i32` and `@Box$i32.constructor` beside a `@Box$i32` function.
class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}

const Box = (x: i32): i32 => x;

export const main = (): i32 => {
  const b = new Box<i32>(7);
  return b.value + Box(1);
};
