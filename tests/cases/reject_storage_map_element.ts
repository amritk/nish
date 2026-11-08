// A `Map` element is a pointer, so storage refuses it.
const maps = new Array<Map<string, i32>>(2)

export const main = (): void => {
  console.log(`${maps.length}`)
}
