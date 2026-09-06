// for...of: break/continue, push during iteration, nested for-of, a `let` loop variable.
export function main(): number {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6];
  let sum = 0;
  for (const x of xs) {
    if (x === 1) {
      continue;
    }
    if (x === 9) {
      break;
    }
    sum += x;
  }
  console.log(sum);
  const grow = [1, 2, 3];
  let seen = 0;
  for (const g of grow) {
    seen++;
    if (grow.length < 6) {
      grow.push(g * 10);
    }
  }
  console.log(seen);
  console.log(grow.length);
  console.log(grow[5]);
  const words = ["a", "bb", "ccc"];
  let joined = "";
  for (const w of words) {
    for (const x of xs) {
      if (x > 4) {
        break;
      }
      joined = joined + w;
    }
    joined = joined + "|";
  }
  console.log(joined);
  let doubled = "";
  for (let v of xs) {
    v = v * 2;
    doubled = `${doubled}${v} `;
  }
  console.log(doubled);
  console.log(xs[0]);
  const flags = [true, false, true];
  let count = 0;
  for (const f of flags) {
    if (f) {
      count++;
    }
  }
  console.log(count);
  const empty: number[] = [];
  let ran = false;
  for (const e of empty) {
    ran = e > 0;
  }
  console.log(ran);
  const rows = [
    [1, 2],
    [3, 4],
    [5, 6],
  ];
  let product = 1;
  for (const row of rows) {
    for (const v of row) {
      product *= v;
    }
  }
  console.log(product);
  return 0;
}
