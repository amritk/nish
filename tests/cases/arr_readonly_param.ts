// `readonly T[]` is the same array with every write refused, so a mutable array
// widens into it at the call and the callee still reads it every way there is:
// `length`, `a[i]`, `for...of`, `indexOf`, `join`. The golden is the point of
// the feature — it must be the IR the mutable spelling emits, instruction for
// instruction, because the flag is a promise to the checker and not a value.
function total(xs: readonly number[]): number {
  let sum = 0;
  for (const x of xs) {
    sum = sum + x;
  }
  return sum + xs.length + xs[0] + xs.indexOf(30);
}

function label(parts: ReadonlyArray<string>): string {
  return parts.join("-");
}

export function main(): number {
  const xs: number[] = [10, 20, 30];
  console.log(total(xs));
  console.log(label(["a", "b"]));
  // The array is still mutable here: widening happens at the parameter, and
  // nothing about `xs` changed by being passed to a `readonly` one.
  xs.push(40);
  console.log(total(xs));
  return 0;
}
