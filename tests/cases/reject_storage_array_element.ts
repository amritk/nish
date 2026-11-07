// An array element would be a pointer in zero-filled storage.
const rows = new Array<i32[]>(4)

export const main = (): void => {
  console.log(`${rows.length}`)
}
