// WP15 §8, the false-positive guards for the allocation-in-a-loop warning.
// Each loop below allocates, and in each one the compiler already did the
// right thing or the program genuinely asked for the memory, so none of them
// may warn.
class Point {
  x: i32 = 0;
  y: i32 = 0;
}

export function test(): number {
  let total = 0;

  // Stackable: a literal length is an entry-block alloca whose slot WP6 reuses
  // on every pass, so there is nothing to hoist.
  for (let i = 0; i < 3; i = i + 1) {
    const fixed = new Array<i32>(4);
    fixed[0] = i;
    total = total + fixed[0] + fixed.length;
  }

  // Stackable for the same reason: a struct and an array literal are fixed size.
  for (let i = 0; i < 3; i = i + 1) {
    const p = new Point();
    const pair = [i, i + 1];
    total = total + p.x + pair[1];
  }

  // The value escapes the iteration, so the program wants one array per pass
  // and hoisting would be wrong.
  const kept: i32[][] = [];
  const width = 2;
  for (let i = 0; i < 3; i = i + 1) {
    const row = new Array<i32>(width + i);
    row[0] = i;
    kept.push(row);
  }

  // Outside any loop: allocated once already.
  const once = new Array<i32>(width);
  once[0] = 7;

  return total + kept.length + once[0];
}
