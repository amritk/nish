// WP51 stage 2: a `F | null` parameter is called only after a test excludes
// `null`, as TypeScript requires: tag 0 names no function (NL2740).
type F = (x: i32) => i32

export const run = (h: F | null, x: i32): i32 => h(x)

export const main = (): void => {
  console.log(`${run(null, 1)}`)
}
