// `true & true` in JavaScript is the *number* 1, and AmritScript has no
// truthiness to turn that back into a boolean, so the operator is refused and
// the message names `&&` instead.
function test(a: boolean, b: boolean): boolean {
  return a & b;
}
