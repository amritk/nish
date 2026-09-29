// `async` on a method is the modifier TypeScript reads there: on the line of
// the method's name. Phase 0 refuses it with the function rule (NL1015).
class Worker {
  async run(): i32 {
    return 1
  }
}

export const main = (): i32 => 0
