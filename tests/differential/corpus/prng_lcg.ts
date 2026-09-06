// A 32-bit linear congruential generator relies on wrapping multiplication.
function next(seed: number): number {
  return seed * 1103515245 + 12345;
}

export function main(): number {
  let s = 42;
  for (let i = 0; i < 10; i++) {
    s = next(s);
    console.log(s);
  }
  let hist0 = 0;
  let hist1 = 0;
  let hist2 = 0;
  let hist3 = 0;
  for (let i = 0; i < 10000; i++) {
    s = next(s);
    let bucket = s % 4;
    if (bucket < 0) {
      bucket = -bucket;
    }
    if (bucket === 0) {
      hist0++;
    } else if (bucket === 1) {
      hist1++;
    } else if (bucket === 2) {
      hist2++;
    } else {
      hist3++;
    }
  }
  console.log(`${hist0} ${hist1} ${hist2} ${hist3}`);
  console.log(s);
  return 0;
}
