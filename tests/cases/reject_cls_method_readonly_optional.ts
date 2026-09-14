// A method's modifiers are read before its `?`, which is stage0's order: this
// is about `readonly` and not about the marker. A field is the other way round
// (`reject_cls_field_optional`), and the asymmetry is deliberate.
export class Point {
  x: i32 = 0;
  readonly scale?(by: i32): i32 {
    return this.x * by;
  }
}
