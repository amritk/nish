// break/continue interplay with for updates, while counters, and do-while conditions.
export function main(): number {
  let log = "";
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      continue;
    }
    if (i > 7) {
      break;
    }
    log = `${log}${i}`;
  }
  console.log(log);
  let i = 0;
  let out = "";
  while (i < 20) {
    i++;
    if (i % 3 !== 0) {
      continue;
    }
    out = `${out}${i} `;
    if (i >= 15) {
      break;
    }
  }
  console.log(out);
  console.log(i);
  let n = 0;
  let iterations = 0;
  do {
    iterations++;
    if (iterations % 4 === 0) {
      continue;
    }
    n += iterations;
  } while (iterations < 10);
  console.log(`${n} ${iterations}`);
  let found = 0;
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      if (b > a) {
        break;
      }
      if ((a + b) % 2 === 1) {
        continue;
      }
      found++;
    }
  }
  console.log(found);
  let count = 0;
  for (;;) {
    count++;
    if (count === 7) {
      break;
    }
  }
  console.log(count);
  let k = 100;
  while (true) {
    k -= 7;
    if (k < 0) {
      break;
    }
  }
  console.log(k);
  return 0;
}
