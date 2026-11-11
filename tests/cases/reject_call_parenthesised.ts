// A call names a function or a function reference: a parenthesised number is neither, so calling it is refused.
const twice = (n: number): number => n * 2;

export const run = (n: number): number => (n)(twice(n));
