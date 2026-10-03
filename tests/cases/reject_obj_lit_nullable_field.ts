// A literal in an `E | null` context is checked against `E` as it would be in
// an `E` one: a missing field, an unknown one and a mistyped one are refused.
interface E {
  tag: i32
  name: string
}

const missing = (): E | null => ({ tag: 1 })

const unknown = (some: boolean): E | null => (some ? { tag: 1, name: "a", extra: 2 } : null)

export const main = (): void => {
  const e: E | null = { tag: "x", name: "b" }
  if (e !== null && missing() !== null && unknown(true) !== null) {
    console.log(e.name)
  }
}
