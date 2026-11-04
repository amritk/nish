// An entry with no `main` runs its top-level code as `main` (docs/LANGUAGE.md
// → "Top-level code"). `LIMIT` is named by a function, so it stays a module
// constant; `start` and `step` are named only by the code, so they become its
// locals, with `total` beside them.
const LIMIT: i32 = 4

const capped = (n: i32): i32 => (n > LIMIT ? LIMIT : n)

const start = 1
let total = start
for (let i = 0; i < 3; i++) {
  total += capped(i + 2)
}
console.log(total)
