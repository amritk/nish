// WP51 stage 1: an array of references nothing is ever stored into. Its
// place's set is empty, so its dispatcher has no member to call and traps; no
// call through it runs.
type F = (x: i32) => i32

const plus1 = (x: i32): i32 => x + 1

export const main = (): void => {
  const fs: F[] = []
  if (fs.length > 0) {
    console.log(`${fs[0](1)}`)
  }
  console.log(`${plus1(1)} none`)
}
