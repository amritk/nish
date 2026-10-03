// #330: a block body's `return { ... }` in a function returning `E | null`
// builds an `E`, which the nullable return type holds as it is.
interface E {
  tag: i32
}

const make = (at: i32): E | null => {
  if (at < 0) {
    return null
  }
  return { tag: at }
}

export const main = (): void => {
  const e = make(5)
  if (e !== null) {
    console.log(`${e.tag}`)
  }
  if (make(-1) === null) {
    console.log("null")
  }
}
