// Compound assignment on locals and on array elements, with wrapping.
export function main(): number {
  let x = 2147483000;
  x += 1000;
  console.log(x);
  x -= 2000;
  console.log(x);
  x *= 3;
  console.log(x);
  x /= -7;
  console.log(x);
  x %= 1000;
  console.log(x);
  const xs = [1, 2, 3, 4];
  for (let i = 0; i < xs.length; i++) {
    xs[i] *= 1000000;
    xs[i] += i;
  }
  xs[3] *= 4000;
  xs[0] -= 5;
  xs[1] /= 3;
  xs[2] %= 7;
  let line = "";
  for (const v of xs) {
    line = `${line}${v},`;
  }
  console.log(line);
  let k = 0;
  const ys = [10, 20, 30];
  ys[k] += 5;
  k++;
  ys[k] -= 5;
  k++;
  console.log(`${ys[0]} ${ys[1]} ${ys[2]} ${k}`);
  return 0;
}
