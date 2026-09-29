// `<T>x` is the older spelling of `x as T`, and is refused under its own name.
export const run = (n: i32): i32 => <i32>n
