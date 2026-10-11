// An offset index `ys[i + 1]` that keeps its check warns like a local one, and
// names a guard on the sum: the loop is bounded by `xs`, and nothing says `ys`
// is as long. `xs[i + 1]` beside it is proven by the loop condition and is
// quiet. The program is legal and still exits 0.

export const test = (): number => {
  const xs = [1, 2, 3, 4];
  const ys = [5, 6, 7, 8];
  let total = 0;
  for (let i = 0; i + 1 < xs.length; i = i + 1) {
    total = total + xs[i + 1] + ys[i + 1];
  }
  return total;
};
