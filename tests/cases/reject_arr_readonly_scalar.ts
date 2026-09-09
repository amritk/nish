// TypeScript allows `readonly` on array and tuple types and nothing else
// (TS1354), so this is not a construct the compiler has yet to support: the
// source is not TypeScript either, and the message names the rule it broke.
function twice(n: readonly number): number {
  return n + n;
}
export function main(): number {
  return twice(1);
}
