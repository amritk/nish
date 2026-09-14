// `readonly` describes a field's storage, and a method has none, so it is an
// unsupported modifier rather than a no-op. The rule is the checker's on both
// sides: stage1's parser records the word and `collectMethod` states it.
export class Point {
  x: i32 = 0;
  readonly scale(by: i32): i32 {
    return this.x * by;
  }
}
