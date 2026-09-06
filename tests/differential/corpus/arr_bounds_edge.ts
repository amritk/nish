// Index edges that are still in range: a[0], a[a.length - 1], computed indices, writes at the end.
function last(xs: number[]): number {
  return xs[xs.length - 1];
}

function rotate(xs: number[]): void {
  const first = xs[0];
  for (let i = 0; i + 1 < xs.length; i++) {
    xs[i] = xs[i + 1];
  }
  xs[xs.length - 1] = first;
}

export function main(): number {
  const xs = [10, 20, 30, 40, 50];
  console.log(xs[0]);
  console.log(last(xs));
  console.log(xs[xs.length - 1]);
  console.log(xs[xs.length / 2]);
  console.log(xs[(xs.length - 1) % xs.length]);
  rotate(xs);
  console.log(`${xs[0]} ${xs[1]} ${xs[2]} ${xs[3]} ${xs[4]}`);
  xs[xs.length - 1] = xs[0] + xs[xs.length - 1];
  console.log(last(xs));
  const one = [7];
  console.log(last(one));
  console.log(one[one.length - 1]);
  rotate(one);
  console.log(one[0]);
  const fill = new Array<number>(4);
  for (let i = fill.length - 1; i >= 0; i--) {
    fill[i] = i * i;
  }
  console.log(`${fill[0]} ${fill[1]} ${fill[2]} ${fill[3]}`);
  let k = 0;
  const seen = [0, 0, 0];
  while (k < 30) {
    seen[k % seen.length] += k;
    k++;
  }
  console.log(`${seen[0]} ${seen[1]} ${seen[2]}`);
  const idx: f64 = 2.9;
  console.log(xs[toI32(idx)]);
  return 0;
}
