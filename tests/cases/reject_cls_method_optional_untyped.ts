// As `reject_cls_field_optional_untyped`, for a method: `m?()` with no return
// type annotation is a syntax error to stage1 before the checker can say that a
// method cannot be optional, so the two compilers agree about the program and
// not about the sentence.
export class Point {
  m?() {
    return 0;
  }
}
