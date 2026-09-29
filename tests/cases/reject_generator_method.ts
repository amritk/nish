// `*m()`, a generator method: a class member never opens with `*` otherwise
// (NL1044).
class Counter {
  *count(): i32 {
    return 1
  }
}

export const main = (): i32 => 0
