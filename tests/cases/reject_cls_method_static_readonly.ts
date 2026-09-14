// A method can carry neither modifier, so the one written *first* is the one
// the message is about: here `static`, and in `reject_cls_method_readonly_static`
// the other way round. That ordering is the whole reason the parser records
// `FLAG_STATIC_FIRST` beside the two bits.
export class Point {
  x: i32 = 0;
  static readonly origin(): i32 {
    return 0;
  }
}
