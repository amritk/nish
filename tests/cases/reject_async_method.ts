// `async` on a method is the modifier TypeScript reads there: on the line of
// the method's name. A task never keeps a `this`, so only a top-level
// function or an arrow may be `async` (NL1063).
class Worker {
  async run(): i32 {
    return 1
  }
}

export const main = (): i32 => 0
