// `+=` is arithmetic, not concatenation: the target must be numeric, so a
// string one is refused however the right-hand side is spelled. Build the text
// with a template literal instead. The refusal names `+=`, the token that was
// written, rather than the `+` behind it — stage1 was routing this through the
// binary-operator rule, which takes two strings, and so compiled a program
// stage0 refuses (WP19 §A2).
export function main(): i32 {
  let s = "a";
  s += "b";
  return toI32(s.length);
}
