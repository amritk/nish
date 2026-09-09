// `pop` shortens the array, which is a write even though it reads a value out.
function last(xs: readonly number[]): number {
  return xs.pop();
}
export function main(): number {
  const a: number[] = [1];
  return last(a);
}
