export function double(n: number): number {
  return helper(n) * 2;
}

function helper(n: number): number {
  return n + 1;
}
