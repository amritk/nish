// WP15 §8, NL9016: a local declared outside a loop and given a new allocation
// on every pass drops the value the pass before gave it, and nothing frees it
// while the loop runs. `last` was declared holding a literal, so NL9003 says
// nothing about it; before this rule nothing did, and 10,000,000 passes of
// that first loop peaked at 392 MB.
class Point {
  x: i32;
  constructor(x: i32) {
    this.x = x;
  }
}

// A pointer-returning function warns too: what its loop drops is garbage
// whoever owns the value it returns.
const lastLabel = (n: i32): string => {
  let label = "none";
  for (let i = 0; i < n; i++) {
    label = `#${i}`;
  }
  return label;
};

export const main = (): void => {
  let last = "";
  for (let i = 0; i < 1000; i++) {
    last = `item ${i}`;
  }
  // Declared outside the inner loop, which is the one that drops it.
  let total = 0;
  for (let round = 0; round < 3; round++) {
    let at: Point | null = null;
    let j = 0;
    while (j < 10) {
      at = new Point(j);
      j++;
    }
    if (at !== null) {
      total = total + at.x;
    }
  }
  // Declared holding an allocation: NL9003 reports this line, and this rule
  // stays quiet so that the line gets one warning.
  let row = [0, 0];
  for (let i = 0; i < 4; i++) {
    row = [i, i];
  }
  console.log(`${last} ${total} ${row[1]} ${lastLabel(5)}`);
};
