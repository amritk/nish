// `u32 + i32` is a type error: there is no implicit conversion in AmritScript, so
// the two are not the same numeric type even though their LLVM types are both
// `i32`. Convert one side with toU32 / toI32.
function f(a: u32, b: i32): u32 {
  return a + b;
}
