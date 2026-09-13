// NL2116: There are no static members; the message names the top-level function that replaces one.
// The code covers two sentences — this one and `Constructor of class `C`: ...` — so a case here
// proves nothing about the constructor: `tests/cases/reject_cls_ctor_static` is what pins that.
class Point {
  x: i32 = 0;
  static origin(): i32 {
    return 0;
  }
}
