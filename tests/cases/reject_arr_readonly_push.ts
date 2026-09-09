// `push` writes through the header, so it is refused for the same reason a
// store is; the message names the annotation to change rather than the call.
function grow(xs: readonly number[]): number {
  return xs.push(1);
}
export function main(): number {
  const a: number[] = [1];
  return grow(a);
}
