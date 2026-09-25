// A bounds check, an integer division and a `slice` range check can each end
// the process, and none of them writes memory a caller could see: the panic
// prints to fd 2 and `_exit`s. So `pick`, `ratio` and `head` are
// `effect=write`, because nothing may be reordered across a panic, but
// `sharedWrite=false`.
const pick = (xs: number[], i: number): number => xs[i];

const ratio = (a: number, b: number): number => a / b;

const head = (s: string, n: number): string => s.slice(0, n);

export const run = (xs: number[]): number => ratio(pick(xs, 0), xs.length) + head("abc", 2).length;
