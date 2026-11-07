// Module storage is zero-filled where a page can read it, so a string element
// (a pointer) is refused.
const names = new Array<string>(4)

export const main = (): void => {
  console.log(`${names.length}`)
}
