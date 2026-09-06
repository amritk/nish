// Run by the WP4 block of tests/run.js: must exit 1 with "index out of range" on stderr.
function pick(xs: number[], i: number): number {
  return xs[i];
}

export function main(): number {
  console.log(pick([1, 2, 3], 2));
  console.log(pick([1, 2, 3], 5));
  return 0;
}
