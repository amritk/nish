// Under Node the first line runs before `twice` exists, through `four`, so the
// declaration below the code that reaches it is refused even though the
// native program, which declares everything first, would run.
const four = (): number => twice(2)
console.log(four())
const twice = (n: number): number => n * 2
