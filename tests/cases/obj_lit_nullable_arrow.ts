// #330 and #324: an arrow's concise body is the context its return type gives,
// alone and as a ternary arm, so neither literal needs a non-nullable local.
interface E {
  tag: i32
}

const make = (at: i32): E | null => ({ tag: at })

const pick = (some: boolean): E | null => (some ? { tag: 7 } : null)

export const main = (): void => {
  const e = make(3)
  if (e !== null) {
    console.log(`${e.tag}`)
  }
  const p = pick(true)
  if (p !== null) {
    console.log(`${p.tag}`)
  }
  if (pick(false) === null) {
    console.log("null")
  }
}
