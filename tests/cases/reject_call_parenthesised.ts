// A call names the function it calls: a function is not a value to hold or parenthesise.
const twice = (n: number): number => n * 2;

export const run = (n: number): number => (twice)(n);
