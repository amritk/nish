// Both operands must be the same width: there is no implicit widening from
// i32 to i64 anywhere in AmritScript, and an LLVM `and` needs one type.
function test(a: i32, b: i64): i32 {
  return a & b;
}
