// A `readonly T[]` may not be stored into: the whole point of the annotation is
// that the caller keeps the only way to write to the array it lent out.
function clear(xs: readonly number[]): number {
  xs[0] = 0;
  return xs.length;
}
export function main(): number {
  const a: number[] = [1];
  return clear(a);
}
