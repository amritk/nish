// An unsigned type has no negative value at all, so a negative literal in an
// unsigned context is an error naming the width.
function f(): u8 {
  const b: u8 = -1;
  return b;
}
