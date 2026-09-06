// push growth across many capacity doublings, arrays of every scalar kind, and length checkpoints.
export function main(): number {
  const xs: number[] = [];
  let checkpoints = "";
  for (let i = 0; i < 5000; i++) {
    const n = xs.push(i * 7 % 101);
    if (n === 1 || n === 4 || n === 5 || n === 64 || n === 1024 || n === 1025 || n === 5000) {
      checkpoints = `${checkpoints}${n} `;
    }
  }
  console.log(checkpoints);
  console.log(xs.length);
  let sum = 0;
  for (const x of xs) {
    sum += x;
  }
  console.log(sum);
  console.log(xs[0]);
  console.log(xs[4999]);
  console.log(xs[xs.length - 1]);
  const flags: boolean[] = [];
  for (let i = 0; i < 100; i++) {
    flags.push(i % 3 === 0);
  }
  let trues = 0;
  for (const f of flags) {
    if (f) {
      trues++;
    }
  }
  console.log(`${flags.length} ${trues} ${flags[0]} ${flags[1]} ${flags[99]}`);
  const words: string[] = [];
  for (let i = 0; i < 20; i++) {
    words.push(`w${i}`);
  }
  console.log(words.length);
  console.log(words[19]);
  const fs: f64[] = [];
  for (let i = 0; i < 10; i++) {
    fs.push(toF64(i) / 4);
  }
  console.log(fs[3]);
  console.log(fs.length);
  const zeros = new Array<number>(1000);
  console.log(zeros.length);
  console.log(zeros[999]);
  zeros.push(1);
  console.log(zeros.length);
  console.log(zeros[1000]);
  const literal = [1, 2, 3];
  console.log(literal.push(4) + literal.push(5));
  console.log(literal.length);
  return 0;
}
