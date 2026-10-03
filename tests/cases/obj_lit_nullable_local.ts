// #330: a local declared `E | null` and initialised with a literal holds an
// `E`, and can be set to `null` afterwards.
interface E {
  tag: i32
}

const make = (at: i32): E | null => {
  const e: E | null = { tag: at }
  return e
}

export const main = (): void => {
  let e: E | null = { tag: 1 }
  if (e !== null) {
    console.log(`${e.tag}`)
  }
  e = null
  if (e === null) {
    console.log("null")
  }
  const m = make(4)
  if (m !== null) {
    console.log(`${m.tag}`)
  }
}
