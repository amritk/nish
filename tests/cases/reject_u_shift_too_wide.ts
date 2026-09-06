// A literal shift amount at or beyond the width is a compile error: `lshr`
// makes it poison, so catching it here costs nothing at run time.
function f(a: u8): u8 {
  return a >> 8;
}
