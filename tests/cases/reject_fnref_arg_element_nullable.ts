// WP51 stage 2: an element of nullable reference type, passed for a function
// parameter, is refused like a non-null one (NL2759): read it into a `const`,
// narrow the `const`, and pass it.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)

export const main = (): void => {
  const ops: (F | null)[] = []
  ops.push(inc)
  console.log(`${apply(ops[0], 3)}`)
}
