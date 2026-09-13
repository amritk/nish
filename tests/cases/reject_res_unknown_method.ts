// A `Result` has five methods and this is not one of them.
export const run = (r: Result<number, string>): number => r.unwrap();
