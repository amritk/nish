function insertionSort(xs: number[]): void {
  for (let i = 1; i < xs.length; i++) {
    const key = xs[i];
    let j = i - 1;
    while (j >= 0 && xs[j] > key) {
      xs[j + 1] = xs[j];
      j--;
    }
    xs[j + 1] = key;
  }
}

export function main(): number {
  const xs = [17, 3, 99, -4, 42, 8, 0, 23, 15, 61, 7, 88, -12, 5, 30, 2, 71, 19, 44, 1];
  insertionSort(xs);
  let line = "";
  for (const x of xs) {
    line = `${line}${x} `;
  }
  console.log(line);
  return 0;
}
