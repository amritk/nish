declare function puts(s: string): i32
declare function strlen(s: string): u64

const greet = (name: string): u64 => strlen(`hi ${name}`)

export const main = (): i32 => {
  puts("hello")
  return greet("ada") === 6 ? 0 : 1
}
