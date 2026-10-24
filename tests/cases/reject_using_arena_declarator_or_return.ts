// `orReturn()` in a later declarator's initialiser of `using a = arena(), ...`
// runs with the arena open (each declarator opens before the next initialiser
// runs), so its propagated `Result`, too large for a register here, may be
// built in the arena that the block releases before the function returns:
// refused as it is in the block's body (`reject_using_arena_or_return`).
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

const pathFor = (n: i32): Result<string, string> => (n === 0 ? Ok("/dev/null") : Err(`missing ${n * 7}`))

const opened = (n: i32): Result<i32, string> => {
  using a = arena(), f = new File(pathFor(n).orReturn())
  return Ok(n)
}

export const main = (): i32 => {
  console.log(`${opened(3).ok}`)
  return 0
}
