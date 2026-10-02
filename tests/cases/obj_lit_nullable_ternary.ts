// #324: an object literal as a ternary arm where `Box | null` is expected takes
// `Box` from the context and is the struct, so the arm and `null` meet as one
// pointer.
interface Box {
  v: i32
}

export const main = (): void => {
  const some = true
  const z: Box | null = some ? { v: 7 } : null
  if (z !== null) {
    console.log(`${z.v}`)
  }
}
