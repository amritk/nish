function total(xs: number[]): number {
  let sum = 0;
  for (const x of xs) {
    if (x < 0) {
      continue;
    }
    if (x > 100) {
      break;
    }
    sum += x;
  }
  return sum;
}

export function main(): number {
  console.log(total([1, -2, 3, 500, 4]));
  for (let word of ["a", "b"]) {
    word = `<${word}>`;
    console.log(word);
  }
  return 0;
}
