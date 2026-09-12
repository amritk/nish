// NL2046: A method is either declared or it is not; `m?()` has no vtable slot to leave empty.
class Point {
  x: i32 = 0;
  m?(): void {}
}
