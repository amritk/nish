// `ReadonlyArray<T>` is the other spelling of `readonly T[]`, and takes exactly
// one type argument for the same reason `Array<T>` does.
function count(xs: ReadonlyArray<number, string>): number {
  return xs.length;
}
export function main(): number {
  const a: number[] = [1];
  return count(a);
}
