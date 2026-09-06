import { scale } from "./other";

// main imports other, other imports main: a cycle. Exit code: 4 * 10 = 40.
export function base(): number {
  return 10;
}

export function main(): number {
  return scale(4);
}
