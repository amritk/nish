const LIMIT: i32 = 4

const capped = (n: i32): i32 => (n > LIMIT ? LIMIT : n)

const start = 1
let total = start
for (let i = 0; i < 3; i++) {
  total += capped(i + 2)
}
console.log(total)
