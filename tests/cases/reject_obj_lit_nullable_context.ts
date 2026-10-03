// `null` gives a ternary no struct to take, so an object literal arm with no
// declared type around it is still refused.
interface Box {
  v: i32
}

export const main = (): void => {
  const some = true
  const z = some ? { v: 7 } : null
  if (z !== null) {
    console.log("set")
  }
}
