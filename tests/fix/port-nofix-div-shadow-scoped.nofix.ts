// A local `const toI32` inside one function gets the module no review edit, even
// for a division in another function, where the name is the builtin's: the
// decline reads the whole module, not the scope at the site.
const f = (a: i32, b: i32): i32 => a / b

const g = (x: i32): i32 => {
  const toI32: i32 = 1000
  return x + toI32
}

export const main = (): i32 => {
  console.log(`${f(17, 4)} ${g(4)}`)
  return 0
}
