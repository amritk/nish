// Nested loops with break/continue: a sieve, a multiplication table, and a search.
export function main(): number {
  const limit = 50;
  const composite = new Array<boolean>(limit + 1);
  for (let i = 2; i <= limit; i++) {
    if (composite[i]) {
      continue;
    }
    for (let j = i * i; j <= limit; j += i) {
      composite[j] = true;
    }
  }
  let primes = "";
  for (let i = 2; i <= limit; i++) {
    if (!composite[i]) {
      primes = `${primes}${i} `;
    }
  }
  console.log(primes);
  for (let i = 1; i <= 5; i++) {
    let row = "";
    for (let j = 1; j <= 5; j++) {
      if (j > i) {
        break;
      }
      row = `${row}${i * j} `;
    }
    console.log(row);
  }
  let found = -1;
  let checks = 0;
  for (let a = 1; a < 30 && found < 0; a++) {
    for (let b = a; b < 30; b++) {
      checks++;
      if (a * a + b * b === 25 * 25) {
        found = a * 100 + b;
        break;
      }
      if (a * a + b * b > 25 * 25) {
        break;
      }
    }
  }
  console.log(`${found} after ${checks} checks`);
  let n = 0;
  do {
    let m = 0;
    do {
      m++;
      if (m % 2 === 0) {
        continue;
      }
      n += m;
    } while (m < 5);
  } while (n < 30);
  console.log(n);
  let w = 0;
  while (true) {
    w++;
    if (w % 7 !== 0) {
      continue;
    }
    if (w > 50) {
      break;
    }
  }
  console.log(w);
  return 0;
}
