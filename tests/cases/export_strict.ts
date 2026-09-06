export function double(n: number): number {
  return n * 2;
}

function helper(n: number): number {
  return n + 1;
}

export function next(n: number): number {
  return helper(double(n));
}
