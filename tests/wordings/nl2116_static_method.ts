// NL2116: There are no static members; the message names the top-level function that replaces one.
class Point {
  x: i32 = 0;
  static origin(): i32 {
    return 0;
  }
}
