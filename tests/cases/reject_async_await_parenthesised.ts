// Outside an `async` function, `await(...)` is a call to a function named
// `await`, as TypeScript reads it too (NL2651). Inside one it is the
// operator, `await (f(x))` (`reject_async_not_lowered`).
function run(): void {
  await(1)
}

export const main = (): i32 => 0
