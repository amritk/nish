// WP51 stage 1: a generic function called through its reference parameter.
// Each instantiation checks the body into its own tables, so the one call
// node is a site per instance, each given its instance's dispatcher.
type F = (x: i32) => i32

const plus1 = (x: i32): i32 => x + 1
const plus3 = (x: i32): i32 => x + 3

function apply<T>(f: F, tag: T): i32 {
  return f(1)
}

export const main = (): void => {
  console.log(`${apply(plus3, "a")} ${apply(plus1, 2)}`)
}
