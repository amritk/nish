// A 33-bit binary literal is past i32 however it is spelled (#267).
export const main = (): void => {
  const x: i32 = 0b1_0000_0000_0000_0000_0000_0000_0000_0000
  console.log(x)
}
