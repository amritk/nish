// An interface element is stored inline, but a string field would be a pointer.
interface Named {
  id: i32
  label: string
}

const named = new Array<Named>(4)

export const main = (): void => {
  console.log(`${named[0].id}`)
}
