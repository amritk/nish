// WP15 §8: a bounds check the analysis could not remove, inside a loop, warns
// and names the guard that would remove it. Every access here is one the
// compiler genuinely cannot prove, and the program is legal and still exits 0.
const weigh = (ys: i32[]): i32 => ys.length;

export const test = (): number => {
  // Two arrays, one length: nothing says `ys` is as long as `xs`.
  const xs = [1, 2, 3];
  const ys = [4, 5, 6];
  let total = 0;
  for (let i = 0; i < xs.length; i = i + 1) {
    total = total + ys[i];
  }

  // A callee that holds the array may `push` or `pop`, so the guard in the
  // loop condition proves nothing about the access that follows the call.
  const zs = [7, 8, 9];
  let j = 0;
  while (j < zs.length) {
    total = total + weigh(zs) + zs[j];
    j = j + 1;
  }

  // A cursor that only ever moves down keeps no upper bound.
  const ws = [1, 2];
  let k = ws.length - 1;
  while (k > 0) {
    total = total + ws[k];
    k = k - 1;
  }
  return total;
};
