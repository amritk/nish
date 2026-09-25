// `??` has TypeScript's precedence (WP32): the level of `||`, operands as
// tight as `|`, left associative, looser than every comparison and tighter
// than the ternary. Every line has one tree and the oracle knows which it is.
function f(a: number, b: number, c: number, d: boolean): number {
  let x = a ?? b;
  x = a ?? b ?? c;
  x = a | b ?? c | a;
  x = a ?? b + c * a;
  const y = a ?? b === c;
  const z = (d || d) ?? d;
  const w = d ?? (d && d);
  x = d ?? d ? a : b;
  x = (a ?? b) + c;
  return x;
}
