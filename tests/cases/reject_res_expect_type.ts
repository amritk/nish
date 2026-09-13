// `expect` takes the message it panics with, which is a string.
export const run = (r: Result<number, string>): number => r.expect(1);
