// WP51 stage 1: a nullable array of references is refused as a `Map` value,
// like the array itself: the map would hand out a place the place pass does
// not follow (NL2738).
type Op = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

export const main = (): void => {
  const byName = new Map<string, Op[] | null>()
  byName.set("up", [inc])
  console.log(`${byName.size}`)
}
