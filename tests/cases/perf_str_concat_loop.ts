// WP15 §8: `out = out + ...` inside a loop copies the whole accumulator every
// pass, so the compiler names the `string[]` + `join` rewrite. The program is
// legal and still exits 0; only the warning is new.
export function test(): number {
  let out = "";
  for (let i = 0; i < 4; i = i + 1) {
    out = out + "ab";
  }

  // A template with the accumulator in a hole copies just as much as `+` does.
  let tagged = "";
  let n = 0;
  while (n < 2) {
    tagged = `${tagged}.`;
    n = n + 1;
  }

  // Declared in the outer loop and assigned in the inner one: still quadratic,
  // because the accumulator outlives the iteration that grows it.
  let rows = 0;
  for (let i = 0; i < 2; i = i + 1) {
    let row = "";
    for (let j = 0; j < 3; j = j + 1) {
      row = row + "#";
    }
    rows = rows + row.length;
  }

  // `do` is a loop like the others.
  let tail = "";
  let k = 0;
  do {
    tail = tail + "z";
    k = k + 1;
  } while (k < 2);

  return out.length + tagged.length + rows + tail.length;
}
