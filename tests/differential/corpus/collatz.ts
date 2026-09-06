// Collatz sequence lengths and peaks for 1..30 (do-while, while, nested loops).
function steps(n: number): number {
  let x = n;
  let count = 0;
  while (x !== 1) {
    if (x % 2 === 0) {
      x /= 2;
    } else {
      x = 3 * x + 1;
    }
    count++;
  }
  return count;
}

function peak(n: number): number {
  let x = n;
  let best = n;
  do {
    if (x > best) {
      best = x;
    }
    x = x % 2 === 0 ? x / 2 : 3 * x + 1;
  } while (x !== 1);
  return best;
}

export function main(): number {
  let longest = 0;
  let arg = 0;
  for (let n = 1; n <= 30; n++) {
    const s = steps(n);
    console.log(`${n}: ${s} steps, peak ${peak(n)}`);
    if (s > longest) {
      longest = s;
      arg = n;
    }
  }
  console.log(`longest: ${arg} (${longest})`);
  return 0;
}
