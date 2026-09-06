// The numeric conversions take a number; a string is not one, and there is no
// implicit parse (use parseInt).
function f(): u32 {
  return toU32("7");
}
