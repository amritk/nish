// `xs.findIndex(pred)` compiles to `std/array`'s `findIndex`: the first index
// whose element satisfies `pred`, or -1. Nish has no `find`, whose answer is
// `T | undefined`; the index, tested and then used, is how a program finds one.

interface User {
  name: string
  age: number
}

export const main = (): void => {
  const xs: number[] = [4, 9, 2, 9]
  console.log(`${xs.findIndex((x) => x === 9)} ${xs.findIndex((x) => x === 7)}`)
  console.log(`${xs.findIndex((x, i) => i > 0 && x < 5)}`)
  const users: User[] = [
    { name: "ann", age: 31 },
    { name: "bob", age: 17 },
  ]
  const i = users.findIndex((u) => u.age < 18)
  if (i >= 0) {
    console.log(`${users[i].name} is ${users[i].age}`)
  }
}
