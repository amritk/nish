// The readings WP33 R1's fifth stage keeps. It reads `abstract` and `declare`
// before a class, `declare` before an interface or an enum, `abstract` before
// a member, `static` before a block, an accessibility or `readonly` word
// before a parameter's name, a member named by a string or a number, an index
// signature, a call or construct signature, `extends` on an interface, a
// method or a key that is not a name in an object literal, a class where an
// operand stands, and a method or constructor with no body — each at a
// position that was a syntax error before. None of those is in this file,
// which holds the programs beside them that already compiled, and every one
// compiles as it did, to the same bytes: the words as fields, methods,
// parameters, locals, functions, constants and object keys, alone on their
// line before a member's type or parameters, a body on the line after its
// signature, and `get`, `set` and `async` as keys and shorthands.
//
// `tests/run.js` compiles it and reads the members and functions out of the IR.
class Words {
  abstract: i32 = 1
  declare: i32 = 2
  static: i32 = 3
  public: i32 = 4
  readonly: i32 = 5
  override: i32 = 6
  async: i32 = 7

  sum(): i32 {
    return this.abstract + this.declare + this.static + this.public + this.readonly + this.override + this.async
  }
}

class Lines {
  abstract
  : i32 = 1
  readonly value: i32 = 2

  static
  (): i32 {
    return 3
  }

  declare(): i32
  {
    return 4
  }
}

class Params {
  x: i32

  constructor(public: i32, readonly: i32, private: i32) {
    this.x = public + readonly + private
  }

  abstract(protected: i32): i32 {
    return protected + this.x
  }
}

interface Keys {
  abstract: i32
  declare: i32
  static: i32
  readonly: i32
  get: i32
  set: i32
  async: i32
}

const declare = (readonly: i32): i32 => readonly + 1
const abstract = (public: i32, override: i32): i32 => public * override

const keys = (): Keys => {
  const get: i32 = 5
  const set: i32 = 6
  const async: i32 = 7
  return { abstract: 1, declare: 2, static: 3, readonly: 4, get, set, async }
}

export const main = (): i32 => {
  const words: Words = new Words()
  const lines: Lines = new Lines()
  const params: Params = new Params(1, 2, 3)
  const k: Keys = keys()
  const static: i32 = k.static + k.get + k.set + k.async
  console.log(`${words.sum()} ${lines.abstract + lines.value} ${lines.static()} ${lines.declare()}`)
  console.log(`${params.abstract(4)} ${declare(static)} ${abstract(2, 3)}`)
  return 0
}
