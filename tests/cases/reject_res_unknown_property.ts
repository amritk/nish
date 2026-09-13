// A `Result` has three properties and this is not one of them.
export const run = (r: Result<number, string>): number => r.payload;
