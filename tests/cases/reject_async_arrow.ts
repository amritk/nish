// An `async` arrow passed where the parameter's function type answers a plain
// `i32`: an async function is passed only where its caller awaits it (NL2639).
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)

export const main = (): i32 => apply(async (x) => x + 1, 1)
