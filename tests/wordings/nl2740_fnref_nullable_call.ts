// NL2740: a call through a nullable function reference no test has narrowed.
type F = (x: i32) => i32

export const run = (h: F | null): i32 => h(1)

export const main = (): i32 => run(null)
