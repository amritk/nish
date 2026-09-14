// As `reject_cls_method_readonly`, for the constructor: stage0 reads both with
// the same helper, so the sentence is the method's with `Constructor` in front
// of it. The class still collects its constructor after the refusal, so the
// report is this one line and not a second about `x` never being assigned.
export class Point {
  x: i32;
  readonly constructor() {
    this.x = 1;
  }
}
