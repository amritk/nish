// The negatives of `mem_return_array_scope` one level down: `rowsOf` pushes
// arrays that `wordsOf` filled with fresh strings, so its elements are arrays
// whose own elements are as new as the call. Only a string is carried into a
// returned array, so the pushed row escapes as it always did and each loop
// that reads a string out of a row keeps what it allocated: through a local
// bound to a row, through a `for...of` over the rows, through a function that
// answers a row's first string, and through a `return` inside the loop. Each
// kept string reads back intact after `churn` has reused every byte a wrong
// release would have freed.
const wordsOf = (i: i32): string[] => {
  const xs: string[] = [];
  xs.push(`a${i}`);
  xs.push(`b${i}`);
  return xs;
};

const rowsOf = (i: i32): string[][] => {
  const out: string[][] = [];
  out.push(wordsOf(i));
  return out;
};

const firstOf = (row: string[]): string => row[0];

const lastFirst = (n: i32): string => {
  for (let i = 0; i < n; i++) {
    const row = rowsOf(i)[0];
    if (i === n - 1) {
      return row[0];
    }
  }
  return "";
};

export const main = (): void => {
  let viaLocal = "";
  let viaForOf = "";
  let viaCall = "";
  for (let i = 0; i < 1000; i++) {
    const row = rowsOf(i)[0];
    viaLocal = row[0];
  }
  for (let i = 0; i < 1000; i++) {
    for (const row of rowsOf(i)) {
      viaForOf = row[0];
    }
  }
  for (let i = 0; i < 1000; i++) {
    viaCall = firstOf(rowsOf(i)[0]);
  }
  const viaReturn = lastFirst(1000);
  console.log(`${churn()}`);
  console.log(viaLocal);
  console.log(viaForOf);
  console.log(viaCall);
  console.log(viaReturn);
};

// Reuse the arena above wherever the kept values live.
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx${i}`.length;
  }
  return t;
};
