// Bubble sort, in-place reverse, and a selection of the k smallest values.
function bubbleSort(xs: number[]): number {
  let swaps = 0;
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j + 1 < xs.length - i; j++) {
      if (xs[j] > xs[j + 1]) {
        const t = xs[j];
        xs[j] = xs[j + 1];
        xs[j + 1] = t;
        swaps++;
      }
    }
  }
  return swaps;
}

function reverse(xs: number[]): void {
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const t = xs[lo];
    xs[lo] = xs[hi];
    xs[hi] = t;
    lo++;
    hi--;
  }
}

function show(xs: number[]): string {
  let s = "[";
  for (let i = 0; i < xs.length; i++) {
    s = i === 0 ? `${s}${xs[i]}` : `${s}, ${xs[i]}`;
  }
  return s + "]";
}

export function main(): number {
  const xs = [5, -3, 99, 0, 2147483647, -2147483647 - 1, 42, 42, 7, -1];
  console.log(show(xs));
  console.log(bubbleSort(xs));
  console.log(show(xs));
  reverse(xs);
  console.log(show(xs));
  const one = [1];
  reverse(one);
  console.log(show(one));
  const none: number[] = [];
  reverse(none);
  console.log(show(none));
  console.log(bubbleSort(none));
  const seq: number[] = [];
  let v = 17;
  for (let i = 0; i < 50; i++) {
    v = (v * 31 + 7) % 1000;
    seq.push(v);
  }
  console.log(bubbleSort(seq));
  console.log(`${seq[0]} ${seq[1]} ${seq[2]} ... ${seq[seq.length - 1]}`);
  reverse(seq);
  console.log(seq[0]);
  return 0;
}
